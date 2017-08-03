const Graph = require('ipld-graph-builder')
const Uint1Array = require('uint1array')
const TextEncoder = require('text-encoding').TextEncoder

const encoder = new TextEncoder('utf-8')

const EXTENSION = 0
const BRANCH = 1
const VALUE = 2

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
    let parent
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
          parent = root
          root = nextRoot
        }
      } else {
        break
      }

      index++
    }

    let value = getValue(root)

    if (value && value['/']) {
      value = await this.graph.get(root, VALUE)
    }

    return {
      value: value,
      root: root,
      parent: parent,
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

    if (value.length > 32) {
      value = {'/': value}
    }

    // initial set
    if (this.root['/'] === null) {
      this.root['/'] = createNode(key, [], value)['/']
    } else {
      const result = await this._get(key)
      let root = result.root

      if (result.value) {
        setValue(root, value)
      } else {
        if (result.extensionIndex !== undefined) {
          // split the extension node in two
          let extension = getExtension(root)
          const extensionKey = extension[result.extensionIndex]
          const remExtension = extension.subarray(result.extensionIndex + 1)
          extension = extension.subarray(0, result.extensionIndex)

          setExtension(root, remExtension)
          const branch = []
          branch[extensionKey] = {'/': root['/']}
          root['/'] = createNode(extension, branch)['/']
        }

        // if there are remaning key segments create an extension node
        if (result.index < key.length) {
          const keySegment = key[result.index]
          const extension = key.subarray(result.index + 1, key.length)
          const newNode = createNode(extension, [], value)
          const rootBranch = getBranch(root)
          rootBranch[keySegment] = newNode
        } else {
          setValue(root, value)
        }
      }
    }
  }

  async delete (key) {
    key = RadixTree.formatKey(key)
    const results = await this._get(key)
    if (results.value) {
      const root = results.root
      const parent = results.parent

      deleteValue(root)

      if (getBranch(root).length) {
        joinNodes(root)
      } else {
        if (!parent) {
          root['/'] = null
        } else {
          let branch = getBranch(parent)
          branch = branch.map(node => node === root ? null : node)
          setBranch(parent, branch)

          joinNodes(parent)
        }
      }
    }

    function joinNodes (root) {
      if (getValue(root) === undefined) {
        let index
        const branch = getBranch(root)
        const nodes = branch.filter((node, i) => {
          if (node) {
            index = i
            return true
          }
        })

        if (nodes.length === 1) {
          const child = nodes[0]
          const pExtension = getExtension(root)
          const childExtension = getExtension(child)
          const newExtension = new RadixTree.ArrayConstructor(pExtension.length + childExtension.length + 1)

          newExtension.set(pExtension)
          newExtension[pExtension.length] = index
          newExtension.set(childExtension, pExtension.length + 1)

          setExtension(child, newExtension)
          root['/'] = child['/']
        }
      }
    }
  }

  static formatKey (key) {
    if (typeof key === 'string') {
      key = encoder.encode(key)
      return new RadixTree.ArrayConstructor(key.buffer)
    } else {
      return key
    }
  }
}

function setBranch (node, branch) {
  node['/'][BRANCH] = branch
}

function getBranch (node) {
  return node['/'][BRANCH]
}

function getValue (node) {
  return node['/'][VALUE]
}

function deleteValue (node) {
  node['/'].pop()
}

function hasExtension (node) {
  return node['/'][EXTENSION].length === 2
}

function getExtension (node) {
  return RadixTree.toTypedArray(node['/'][EXTENSION][1]).subarray(0, getExLength(node))
}

function getExLength (node) {
  return node['/'][EXTENSION][0]
}

function setExtension (node, ex) {
  if (ex && ex.length) {
    node['/'][EXTENSION] = [ex.length, new Buffer(ex.buffer)]
  } else {
    node['/'][EXTENSION] = []
  }
}

function setValue (node, val) {
  node['/'][VALUE] = val
}

function createNode (ex, branch, value) {
  if (ex && ex.length) {
    ex = [ex.length, new Buffer(ex.buffer)]
  } else {
    ex = []
  }

  const node = {
    '/': [ex, branch]
  }

  if (value !== undefined) {
    node['/'].push(value)
  }
  return node
}
