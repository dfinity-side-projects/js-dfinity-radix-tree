const Graph = require('ipld-graph-builder')
const Uint1Array = require('uint1array')
const TextEncoder = require('text-encoding').TextEncoder
const DataStore = require('./datastore.js')
const treeNode = require('./treeNode.js')

const encoder = new TextEncoder('utf-8')

module.exports = class RadixTree {
  /**
   * @param opts
   * @param opts.root {object} a merkle root to a radix tree. If none, RadixTree will create an new root.
   * @param opts.db {object} a level db instance; alternatively, `opts.graph` can be used
   * @param opts.graph {object} an instance of [ipld-graph-builder](https://github.com/ipld/js-ipld-graph-builder); alternatively, `opts.dag` can be used
   * @param opts.dag {object} an instance if [ipfs.dag](https://github.com/ipfs/js-ipfs#dag). If there is no `opts.graph` this will be used to create a new graph instance.
   * @param opts.decoder {object} a cbor decoder
   */
  constructor (opts) {
    this._root = {}
    this.root = opts.root || RadixTree.emptyTreeState

    this.dag = opts.dag || new DataStore(opts.db, opts.decoder)
    this.graph = opts.graph || new Graph(this.dag)
    this._setting = Promise.resolve()
  }

  /**
   * the root of the tree
   * @type {Buffer}
   */
  get root () {
    return this._root['/']
  }

  set root (root) {
    this._root['/'] = root
  }

  /**
   * gets a value given a key
   * @param {*} key
   * @return {Promise}
   */
  async get (key) {
    key = this.formatKey(key)
    await this.done()
    return this._get(key)
  }

  async _get (key) {
    let index = 0
    let root = this._root
    let parent

    while (1) {
      // load the root
      const exNode = await this.graph.get(root, treeNode.EXTENSION, true)
      if (exNode) {
        let subKey = key.subarray(index)
        const {extensionIndex, extensionLen, extension} = findMatchBits(subKey, root)
        index += extensionIndex
        // check if we complete traversed the extension
        if (extensionIndex !== extensionLen) {
          return {index, root, extension, extensionIndex}
        }
      }

      let keySegment = key[index]
      if (keySegment !== undefined) {
        const branch = treeNode.getBranch(root)
        await this.graph.get(branch, keySegment, true)
        // preserves the '/'
        const nextRoot = branch[keySegment]
        if (!nextRoot) {
          return {root, index}
        } else {
          parent = root
          root = nextRoot
        }
      } else {
        break
      }

      index++
    }

    const value = treeNode.getValue(root)
    const node = root['/']

    return {value, root, node, parent, index}
  }

  /**
   * stores a value at a given key returning the tree node that the value was saved in
   * @param {*} key
   * @return {Promise}
   */
  set (key, value) {
    key = this.formatKey(key)
    return this._mutationLock(this._set.bind(this, key, value))
  }

  async _set (key, value) {
    if (treeNode.isEmpty(this._root)) {
      this._root['/'] = createNode(key, [null, null], value)['/']
      return this._root['/']
    } else {
      let {node, root, extensionIndex, extension, index, value: rValue} = await this._get(key)

      if (rValue) {
        treeNode.setValue(root, value)
        return node
      } else {
        if (extensionIndex !== undefined) {
          // split the extension node in two
          const extensionKey = extension[extensionIndex]
          const remExtension = extension.subarray(extensionIndex + 1)
          extension = extension.subarray(0, extensionIndex)

          treeNode.setExtension(root, remExtension)
          const branch = [null, null]
          branch[extensionKey] = {
            '/': root['/']
          }
          root['/'] = createNode(extension, branch)['/']
        }

        // if there are remaning key segments create an extension node
        if (index < key.length) {
          const keySegment = key[index]
          const extension = key.subarray(index + 1, key.length)
          const newNode = createNode(extension, [null, null], value)
          const rootBranch = treeNode.getBranch(root)
          rootBranch[keySegment] = newNode
          treeNode.setBranch(root, rootBranch)
          return newNode['/']
        } else {
          treeNode.setValue(root, value)
          return root['/']
        }
      }
    }
  }

  /**
   *smContainer.js deletes a value at a given key
   * @param {*} key
   * @return {Promise}
   */
  delete (key) {
    key = this.formatKey(key)
    return this._mutationLock(this._delete.bind(this, key))
  }

  async _delete (key) {
    const results = await this._get(key)
    if (results.value !== undefined) {
      const root = results.root
      const parent = results.parent

      treeNode.deleteValue(root)

      const branch = treeNode.getBranch(root)
      if (branch.some(el => el !== null)) {
        joinNodes(root)
      } else {
        if (!parent) {
          root['/'] = RadixTree.emptyTreeState
        } else {
          let branch = treeNode.getBranch(parent)
          branch = branch.map(node => node === root ? null : node)
          treeNode.setBranch(parent, branch)
          await this.graph.tree(parent, 2)

          joinNodes(parent)
        }
      }
    }

    function joinNodes (root) {
      if (treeNode.getValue(root) === undefined) {
        let index
        const branch = treeNode.getBranch(root)
        const nodes = branch.filter((node, i) => {
          if (node) {
            index = i
            return true
          }
        })

        if (nodes.length === 1) {
          const child = nodes[0]
          const pExtension = treeNode.getExtension(root)
          const childExtension = treeNode.getExtension(child)
          const newExtension = new RadixTree.ArrayConstructor(pExtension.length + childExtension.length + 1)

          newExtension.set(pExtension)
          newExtension[pExtension.length] = index
          newExtension.set(childExtension, pExtension.length + 1)

          treeNode.setExtension(child, newExtension)
          root['/'] = child['/']
        }
      }
    }
  }

  /**
   * returns a promise that resolve when the tree is done with all of its writes
   * @returns {Promise}
   */
  async done () {
    let setting
    while (this._setting !== setting) {
      setting = this._setting
      await setting
    }
  }

  _mutationLock (func) {
    const setting = this._setting
    this._setting = new Promise((resolve, reject) => {
      return setting.then(() => {
        return func().then(resolve).catch(reject)
      })
    })
    return this._setting
  }

  /**
   * creates a merkle root for the current tree and stores the data persistently
   * @returns {Promise}
   */
  async flush () {
    await this.done()
    await this.graph.flush(this._root)
    return this.root
  }

  formatKey (key) {
    key = RadixTree.formatKey(key)
    return key
  }

  /**
   * Checks if a given root exists or not
   * @param {Buffer} root
   * @return {Promise<boolean>}
   */
  async rootExists (root) {
    await this.flush()
    try {
      await this.dag.get(root)
    } catch (e) {
      return false
    }
    return true
  }

  static formatKey (key) {
    if (typeof key === 'string') {
      key = encoder.encode(key)
    }

    if (key.constructor !== RadixTree.ArrayConstructor) {
      if (Buffer.isBuffer(key)) {
        return new RadixTree.ArrayConstructor(new Uint8Array(key).buffer)
      } else {
        return new RadixTree.ArrayConstructor(key.buffer)
      }
    } else {
      return key
    }
  }

  /**
   * returns the state of an empty tree
   */
  static get emptyTreeState () {
    return [null, null, null]
  }

  /**
   * returns an Uint1Array constructor which is used to represent keys
   * @returns {object}
   */
  static get ArrayConstructor () {
    return Uint1Array
  }

  /**
   * returns a merkle link for some given data
   * @param {Buffer} data - the data which you would like to hash
   * @returns {Buffer}
   */
  static getMerkleLink (data) {
    return DataStore.getMerkleLink(data)
  }
}

function createNode (ex, branch, value) {
  const node = {
    '/': []
  }

  treeNode.setValue(node, value)
  treeNode.setExtension(node, ex)
  treeNode.setBranch(node, branch)

  return node
}

function findMatchBits (key, node) {
  let extensionIndex = 0
  const extension = treeNode.getExtension(node)
  const extensionLen = extension.length

  // checks the extension against the key
  while (extensionIndex < extensionLen && extension[extensionIndex] === key[extensionIndex]) {
    extensionIndex++
  }

  return {extensionIndex, extensionLen, extension}
}
