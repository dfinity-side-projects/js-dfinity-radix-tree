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
      if (isExtension(root)) {
        let extensionIndex = 0
        const extensionLen = getLength(root)
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
        root = branch[keySegment]
      } else {
        break
      }

      index++
    }

    const node = getBranch(root)
    // get the value
    let value
    if (Array.isArray(node)) {
      value = node[this.radix]
    } else {
      value = node
    }

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
    key = this.formatKey(key)
    const result = await this._get(key)
    return result.value
  }

  async set (key, value) {
    key = this.formatKey(key)

    // initial set
    if (this.root['/'] === null) {
      this.root['/'] = createExtension(key, value)['/']
      return
    }

    const result = await this._get(key)
    let root = result.root
    let keySegment = key[result.index]

    if (result.extensionIndex !== undefined) {
      // split the extension node in two
      let extension = getExtension(root)
      const extensionKey = extension[result.extensionIndex]
      const remExtension = extension.subarray(result.extensionIndex + 1)
      extension = extension.subarray(0, result.extensionIndex)

      const node = getNode(root)
      let newNode
      // create the new extension node
      if (extension.length) {
        setExtension(root, extension)
        newNode = []
        setNode(root, newNode)
      } else {
        newNode = root['/'] = []
      }

      // save the remainer of the extension node
      if (remExtension.length) {
        newNode[extensionKey] = createExtension(remExtension, node)
      } else {
        newNode[extensionKey] = node
      }
    }

    let newNode
    if (result.index + 1 < key.length) {
      // if there are remaning key segments create an extension node
      const extension = key.subarray(result.index + 1, key.length)
      newNode = createExtension(extension, value)
    } else {
      newNode = value
    }

    let targetNode = getBranch(root)

    // set the value
    if (keySegment === undefined) {
      targetNode[this.radix] = newNode
    } else {
      targetNode[keySegment] = newNode
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
  isEmptyNode (node) {
    return node.evey(el => !el)
  }
  formatKey (key) {
    if (typeof key === 'string') {
      key = encoder.encode(key)
      return new RadixTree.ArrayConstructor(key.buffer)
    } else {
      return key
    }
  }
}

function getBranch (node) {
  if (isExtension(node)) {
    return getNode(node)
  } else {
    return node['/']
  }
}

function isExtension (node) {
  return !!node['/'].extension
}

function getExtension (node) {
  return RadixTree.toTypedArray(node['/'].extension).subarray(0, getLength(node))
}

function getNode (node) {
  return node['/'].node
}

function getLength (node) {
  return node['/'].length
}

function setExtension (node, ex) {
  node['/'].extension = new Buffer(ex.buffer)
  node['/'].length = ex.length
}

function setNode (node, val) {
  node['/'].node = val
}

function createExtension (ex, node) {
  return {
    '/': {
      extension: new Buffer(ex.buffer),
      node: node,
      length: ex.length
    }
  }
}
