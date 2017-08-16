const Graph = require('ipld-graph-builder')
const Buffer = require('safe-buffer').Buffer
const Uint1Array = require('uint1array')
const TextEncoder = require('text-encoding').TextEncoder

const encoder = new TextEncoder('utf-8')

const RadixTree = module.exports = class RadixTree {
  /**
   * @param opts
   * @param opts.root {object} a merkle root to a radix tree. If none, RadixTree will create an new root.
   * @param opts.graph {object} an instance of [ipld-graph-builder](https://github.com/ipld/js-ipld-graph-builder) alternitvly `opts.dag` can be used
   * @param opts.dag {object} an instance if [ipfs.dag](https://github.com/ipfs/js-ipfs#dag). If there is no `opts.graph` this will be used to create a new graph instance.
   */
  constructor (opts) {
    this.root = opts.root || {'/': RadixTree.emptyTreeState}
    this.graph = opts.graph || new Graph(opts.dag)
  }

  /**
   * returns the state of an empty tree
   */
  static get emptyTreeState () {
    return [null, null]
  }

  /**
   * returns an Uint1Array constructir which is used to repersent keys
   * @returns {object}
   */
  static get ArrayConstructor () {
    return Uint1Array
  }

  /**
   * converts a TypedArray or Buffer to an Uint1Array
   * @param {TypedArray} array - the array to convert
   * @returns {TypedArray}
   */
  static toTypedArray (array) {
    return new RadixTree.ArrayConstructor(new Uint8Array(array).buffer)
  }

  async _get (key) {
    let index = 0
    let root = this.root
    let parent

    while (1) {
      // load the root
      const exNode = await this.graph.get(root, EXTENSION, true)
      if (exNode) {
        let subKey = key.subarray(index)

        // let extensionIndex = 0
        // const extension = getExtension(root)
        // const extensionLen = extension.length
        // // checks the extension against the key
        // while (extensionIndex < extensionLen && extension[extensionIndex] === subKey[extensionIndex]) {
        //   extensionIndex++
        // }
        const {extensionIndex, extensionLen, extension} = findMatchBits(subKey, root)
        index += extensionIndex
        // check if we compelete travered the extension
        if (extensionIndex !== extensionLen) {
          return {
            index: index,
            root: root,
            extension: extension,
            extensionIndex: extensionIndex
          }
        }
      }

      let keySegment = key[index]
      if (keySegment !== undefined) {
        const branch = getBranch(root)
        await this.graph.get(branch, keySegment, true)
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
      value = await this.graph.get(root, VALUE, true)
    }

    return {
      value: value,
      root: root,
      parent: parent,
      index: index
    }
  }

  /**
   * gets a value given a key
   * @param {*} key
   * @return {Promise}
   */
  async get (key) {
    key = RadixTree.formatKey(key)
    const result = await this._get(key)
    return result.value
  }

  /**
   * stores a value at a given key
   * @param {*} key
   * @return {Promise}
   */
  async set (key, value) {
    key = RadixTree.formatKey(key)

    if (value.length > 32) {
      value = {'/': value}
    }

    if (isEmpty(this.root)) {
      this.root['/'] = createNode(key, [null, null], value)['/']
    } else {
      let {root, extensionIndex, extension, index, value: rValue} = await this._get(key)

      if (rValue) {
        setValue(root, value)
      } else {
        if (extensionIndex !== undefined) {
          // split the extension node in two
          const extensionKey = extension[extensionIndex]
          const remExtension = extension.subarray(extensionIndex + 1)
          extension = extension.subarray(0, extensionIndex)

          setExtension(root, remExtension)
          const branch = [null, null]
          branch[extensionKey] = {'/': root['/']}
          root['/'] = createNode(extension, branch)['/']
        }

        // if there are remaning key segments create an extension node
        if (index < key.length) {
          const keySegment = key[index]
          const extension = key.subarray(index + 1, key.length)
          const newNode = createNode(extension, [null, null], value)
          const rootBranch = getBranch(root)
          rootBranch[keySegment] = newNode
          setBranch(root, rootBranch)
        } else {
          setValue(root, value)
        }
      }
    }
  }

  /**
   * deletes a value at a given key
   * @param {*} key
   * @return {Promise}
   */
  async delete (key) {
    key = RadixTree.formatKey(key)
    const results = await this._get(key)
    if (results.value !== undefined) {
      const root = results.root
      const parent = results.parent

      deleteValue(root)

      const branch = getBranch(root)
      if (branch.some(el => el !== null)) {
        joinNodes(root)
      } else {
        if (!parent) {
          root['/'] = RadixTree.emptyTreeState
        } else {
          let branch = getBranch(parent)
          branch = branch.map(node => node === root ? null : node)
          setBranch(parent, branch)
          await this.graph.tree(parent, 2)

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

  /**
   * creates a merkle root for the current tree and stores the data perstantly
   * @returns {Promise}
   */
  flush () {
    return this.graph.flush(this.root)
  }

  static formatKey (key) {
    if (typeof key === 'string') {
      key = encoder.encode(key)
    }

    if (key.constructor !== RadixTree.ArrayConstructor) {
      return new RadixTree.ArrayConstructor(key.buffer)
    } else {
      return key
    }
  }
}

function createNode (ex, branch, value) {
  const node = {
    '/': []
  }

  setValue(node, value)
  setExtension(node, ex)
  setBranch(node, branch)

  return node
}

// helper functions for nodes
const LBRANCH = 0
const RBRANCH = 1
const EXTENSION = 2
const VALUE = 3

function setBranch (node, branch) {
  node['/'][LBRANCH] = branch[0]
  node['/'][RBRANCH] = branch[1]
}

function getBranch (node) {
  return node['/'].slice(LBRANCH, 2)
}

function getValue (node) {
  return node['/'][VALUE]
}

function deleteValue (node) {
  node['/'].pop()
}

function getExtension (node) {
  if (node['/'][EXTENSION]) {
    const len = node['/'][EXTENSION][0]
    const extension = RadixTree.toTypedArray(node['/'][EXTENSION].subarray(1))
    return extension.subarray(0, extension.length - len)
  } else {
    return []
  }
}

function setExtension (node, ex) {
  if (ex && ex.length) {
    const paddingLen = ((8 - (ex.length % 8)) % 8)
    node['/'][EXTENSION] = Buffer.concat([Buffer.from([paddingLen]), Buffer.from(ex.buffer)])
  } else {
    if (getValue(node) === undefined && !Array.isArray(node['/'][EXTENSION])) {
      node['/'].pop()
    } else if (node['/'][EXTENSION] !== undefined) {
      node['/'][EXTENSION] = null
    }
  }
}

function setValue (node, val) {
  if (val !== undefined) {
    node['/'][VALUE] = val
  }
}

function isEmpty (node) {
  const branch = getBranch(node)
  return node['/'].length === 2 && branch[0] === null && branch[1] === null
}

function findMatchBits (key, node) {
  let extensionIndex = 0
  const extension = getExtension(node)
  const extensionLen = extension.length

  // checks the extension against the key
  while (extensionIndex < extensionLen && extension[extensionIndex] === key[extensionIndex]) {
    extensionIndex++
  }

  return {
    extensionIndex: extensionIndex,
    extensionLen: extensionLen,
    extension: extension
  }
}
