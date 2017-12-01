const Graph = require('ipld-graph-builder')
const cbor = require('borc')
const Uint1Array = require('uint1array')
const TextEncoder = require('text-encoding').TextEncoder
const DataStore = require('./datastore.js')
const treeNode = require('./treeNode.js')

const encoder = new TextEncoder('utf-8')

module.exports = class RadixTree {
  /**
   * @param opts
   * @param opts.root {object} a merkle root to a radix tree. If none, RadixTree will create an new root.
   * @param opts.db {object} a level db  instance alternitly `opts.graph` can be used
   * @param opts.graph {object} an instance of [ipld-graph-builder](https://github.com/ipld/js-ipld-graph-builder) alternitvly `opts.dag` can be used
   * @param opts.dag {object} an instance if [ipfs.dag](https://github.com/ipfs/js-ipfs#dag). If there is no `opts.graph` this will be used to create a new graph instance.
   */
  constructor (opts) {
    this.root = opts.root || {
      '/': RadixTree.emptyTreeState
    }

    this.dag = opts.dag || new DataStore(opts.db)
    this.graph = opts.graph || new Graph(this.dag)
    this._setting = Promise.resolve()
  }

  async _mutationLockWait () {
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
   * returns the state of an empty tree
   */
  static get emptyTreeState () {
    return [null, null, null]
  }

  /**
   * returns an Uint1Array constructir which is used to repersent keys
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

  async _get (key) {
    let index = 0
    let root = this.root
    let parent

    while (1) {
      // load the root
      const exNode = await this.graph.get(root, treeNode.EXTENSION, true)
      if (exNode) {
        let subKey = key.subarray(index)

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
        const branch = treeNode.getBranch(root)
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

    const value = treeNode.getValue(root)

    return {
      value: value,
      root: root,
      parent: parent,
      index: index
    }
  }

  /**
   * gets a value given a key. The promise resolves with an object containing
   * `node` the node in the merkle tree and `value` the value of the that the
   * node contains
   * @param {*} key
   * @return {Promise}
   */
  async get (key, decode) {
    await this._mutationLockWait()
    key = RadixTree.formatKey(key)
    let {root, value} = await this._get(key)
    if (decode && Buffer.isBuffer(value)) {
      value = cbor.decode(value)
      treeNode.setValue(root, value)
    }
    return {node: root, value}
  }

  /**
   * stores a value at a given key
   * @param {*} key
   * @return {Promise}
   */
  set (key, value) {
    return this._mutationLock(this._set.bind(this, key, value))
  }

  async _set (key, value) {
    key = RadixTree.formatKey(key)

    if (treeNode.isEmpty(this.root)) {
      this.root['/'] = createNode(key, [null, null], value)['/']
    } else {
      let {root, extensionIndex, extension, index, value: rValue} = await this._get(key)

      if (rValue) {
        treeNode.setValue(root, value)
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
        } else {
          treeNode.setValue(root, value)
        }
      }
    }
  }

  /**
   * deletes a value at a given key
   * @param {*} key
   * @return {Promise}
   */
  delete (key) {
    return this._mutationLock(this._delete.bind(this, key))
  }

  async _delete (key) {
    key = RadixTree.formatKey(key)
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
   * creates a merkle root for the current tree and stores the data perstantly
   * @returns {Promise}
   */
  async flush () {
    await this._mutationLockWait()
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

  return {
    extensionIndex: extensionIndex,
    extensionLen: extensionLen,
    extension: extension
  }
}
