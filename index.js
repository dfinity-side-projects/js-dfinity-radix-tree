const Graph = require('ipld-graph-builder')
const Uint1Array = require('uint1array')
const TextEncoder = require('text-encoding').TextEncoder

const encoder = new TextEncoder('utf-8')

const RadixTree = module.exports = class RadixTree {
  constructor (opts) {
    this.root = opts.root || {'/': null}
    this.dag = opts.dag
    this.radix = 2
    this.graph = new Graph(this.dag)
  }

  static get ArrayConstructor () {
    return Uint1Array
  }

  static toTypedArray (array) {
    return new RadixTree.ArrayConstructor(new Uint8Array(array).buffer)
  }

  async _get (key) {
    let index = 0
    let root = this.root
    while (1) {
      if (hasExtension(root)) {
        let extensionIndex = 0
        const extensionLen = getExLength(root)
        const extension = getExtension(root)
        let subKey
        subKey = key.slice(index, index + extensionLen)

        // checks the extension against the key
        while (extensionIndex < extensionLen && extension[extensionIndex] === subKey[extensionIndex]) {
          extensionIndex++
        }
        index += extensionIndex
        // check if we compelete travered the extension
        if (extensionIndex !== extensionLen) {
          return {
            extensionIndex: extensionIndex,
            root: root,
            index: index
          }
        }
      }

      let keySegment = key[index]
      if (keySegment !== undefined) {
        const branch = getBranch(root)
        await this.graph.get(branch, keySegment)
        // preseves the '/'
        const nextRoot = branch[keySegment]
        if (!nextRoot) {
          return {
            root: root,
            index: index
          }
        } else {
          root = nextRoot
        }
      } else {
        break
      }

      index++
    }

    let value = getValue(root)

    if (value.length >= 32) {
      value = await this.graph.get(root, root.length - 1)
    }

    return {
      value: value,
      root: root,
      index: index
    }
  }

  async get (key) {
    key = RadixTree.formatKey(key)
    const result = await this._get(key)
    return result.value
  }

  async set (key, value) {
    key = RadixTree.formatKey(key)

    // initial set
    if (this.root['/'] === null) {
      this.root['/'] = createNode(value, key)['/']
      return
    }

    const result = await this._get(key)
    let root = result.root

    if (result.value) {
      setValue(root, value)
      return
    }

    if (result.extensionIndex !== undefined) {
      // split the extension node in two
      let extension = getExtension(root)
      const extensionKey = extension[result.extensionIndex]
      const remExtension = extension.subarray(result.extensionIndex + 1)
      extension = extension.subarray(0, result.extensionIndex)

      setExtension(root, remExtension)
      const branch = []
      branch[extensionKey] = {'/': root['/']}
      root['/'] = createNode(null, extension, branch)['/']
    }

    // if there are remaning key segments create an extension node
    if (result.index < key.length) {
      const keySegment = key[result.index]
      const extension = key.subarray(result.index + 1, key.length)
      const newNode = createNode(value, extension)
      const rootBranch = getBranch(root)
      rootBranch[keySegment] = newNode
    } else {
      setValue(root, value)
    }
  }

  // async delete (key) {
  //   key = new this.ArrayConstructor(key)
  //   const results = await this._get(key)
  //   const root = results.root
  //   if (results.value) {
  //     if (results.extensionIndex) {
  //       key = key.subarray(-results.extensionIndex)
  //     }
  //     const keySegment = key[key.length - 1]
  //     delete root[keySegment]
  //     if (this.isEmptyNode(root) && results.parent) {
  //       delete results.parent[results.parentKey]
  //     } else if (!root[root.length - 1]) {
  //       let oneNode = false
  //       let rNodeIndex
  //       for (let i = 0; i < root.length - 1; i++) {
  //         const el = root[i]
  //         if (el) {
  //           if (!oneNode) {
  //             rNodeIndex = i
  //             oneNode = true
  //           } else {
  //             oneNode = false
  //             break
  //           }
  //         }
  //       }

  //       if (oneNode) {
  //         let extension = root[rNodeIndex].extension || []
  //         extension = concat([rNodeIndex], extension)
  //         const parentExtenstion = results.parent[results.parentIndex].extension
  //         if (parentExtenstion) {
  //           extension = concat(parentExtenstion, extension)
  //         }
  //         results.parent[results.parentIndex] = {
  //           extension: extension,
  //           root: root
  //         }
  //       }
  //     }
  //   }
  // }
  static formatKey (key) {
    if (typeof key === 'string') {
      key = encoder.encode(key)
      return new RadixTree.ArrayConstructor(key.buffer)
    } else {
      return key
    }
  }
}

function getBranch (node) {
  return node['/'].branch
}

function getValue (node) {
  return node['/'].value
}

function hasExtension (node) {
  return !!node['/'].extension
}

function getExtension (node) {
  return RadixTree.toTypedArray(node['/'].extension[1]).subarray(0, getExLength(node))
}

function getExLength (node) {
  return node['/'].extension[0]
}

function setExtension (node, ex) {
  if (ex && ex.length) {
    node['/'].extension = [ex.length, new Buffer(ex.buffer)]
  } else {
    node['/'].extension = null
  }
}

function setValue (node, val) {
  node['/'].value = val
}

function createNode (value, ex, branch = []) {
  if (ex && ex.length) {
    ex = [ex.length, new Buffer(ex.buffer)]
  } else {
    ex = null
  }

  return {
    '/': {
      extension: ex,
      branch: branch,
      value: value
    }
  }
}
