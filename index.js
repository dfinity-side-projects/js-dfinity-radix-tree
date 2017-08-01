const Graph = require('ipld-graph-builder')
const Uint1Array = require('uint1array')
const TextEncoder = require('text-encoding').TextEncoder

const encoder = new TextEncoder('utf-8')

module.exports = class RadixTree {
  constructor (opts) {
    this.root = opts.root || {'/': null}
    this.dag = opts.dag
    this.radix = opts.radix || 2
    this.graph = new Graph(this.dag)
  }

  get ArrayConstructor () {
    switch (this.radix) {
      case 2:
        return Uint1Array
      case 8:
        return Uint8Array
      case 16:
        return Uint16Array
      case 32:
        return Uint32Array
    }
  }

  toTypedArray (array) {
    return new this.ArrayConstructor(new Uint8Array(array).buffer)
  }

  async _get (key) {
    let index = 0
    let root = this.root
    let extensionIndex = 0
    while (key.length > index) {
      extensionIndex = 0
      let nextRoot

      if (root['/'].extension) {
        const extension = this.toTypedArray(root['/'].extension)
        let subKey
        let subKeyLen
        if (this.radix === 2) {
          subKey = key.slice(index, index + extension.length)
          subKeyLen = subKey.length
          subKey = new this.ArrayConstructor(subKey.buffer)
          subKeyLen = subKey.length - subKeyLen
        } else {
          subKey = key.subarray(index, extension.length)
        }
        while (extensionIndex < extension.length && extension[extensionIndex] === subKey[extensionIndex]) {
          extensionIndex++
        }
        index += extensionIndex - subKeyLen
        if (extensionIndex !== extension.length) {
          return {
            extensionIndex: extensionIndex,
            root: root,
            index: index
          }
        }

        let keySegment = key[index]
        if (Array.isArray(root['/'].node) && keySegment) {
          await this.graph.get(root['/'].node, keySegment)
          nextRoot = root['/'].node[keySegment]
          if (!nextRoot) {
            return {
              root: root,
              index: index
            }
          }
          root = nextRoot
        }
      } else {
        let keySegment = key[index]
        await this.graph.get(root, keySegment)
        nextRoot = root['/'][keySegment]
        if (!nextRoot) {
          return {
            root: root,
            index: index
          }
        }
        root = nextRoot
      }

      index++
    }
    let value
    if (root['/'].extension) {
      if (Array.isArray(root['/'].node)) {
        value = root['/'].node[root['/'].node.length - 1]
      } else {
        value = root['/'].node
      }
    } else {
      if (Array.isArray(root['/'])) {
        value = root['/'][root.length - 1]
      } else {
        value = root['/']
      }
    }
    if (value.length >= 32) {
      value = await this.graph.get(root, root.length - 1)
    }

    return {
      value: value,
      extensionIndex: extensionIndex,
      root: root,
      index: index
    }
  }

  async get (key) {
    key = this.formatKey(key)
    const results = await this._get(key)
    return results.value
  }

  async set (key, value) {
    key = this.formatKey(key)

    // initial set
    if (this.root['/'] === null) {
      this.root['/'] = {
        extension: new Buffer(key.buffer),
        node: value
      }
      return
    }

    const result = await this._get(key)
    let root = result.root
    let keySegment = key[result.index]

    if (result.extensionIndex !== undefined) {
      let extension = this.toTypedArray(root['/'].extension)
      // save the common part of the extension
      const extensionKey = extension[result.extensionIndex + 1]
      const remExtension = extension.subarray(1 - result.extensionIndex)
      extension = extension.subarray(0, result.extensionIndex)
      const node = root['/'].node

      if (extension.length) {
        root['/'].extension = new Buffer(extension.buffer)
        root['/'].node = []
        if (remExtension.length) {
          root['/'].node[extensionKey] = {
            '/': {
              extension: new Buffer(remExtension.buffer),
              node: node
            }
          }
        } else {
          root['/'].node[extensionKey] = node
        }
      } else {
        // there is no extension
        root['/'] = []
        if (remExtension.length) {
          root['/'][extensionKey] = {
            '/': {
              extension: remExtension,
              node: node
            }
          }
        } else {
          root['/'][extensionKey] = node
        }
      }
    }

    let newNode
    if (result.index + 1 < key.length) {
      // if there are remaning key segments create an extension node
      const extension = key.subarray(result.index + 1, key.length)
      newNode = {
        '/': {
          extension: new Buffer(extension.buffer),
          node: value
        }
      }
    } else {
      newNode = value
    }

    if (root['/'].extension) {
      if (!Array.isArray(root['/'].node)) {
        const val = root['/'].node
        root['/'].node = []
        root['/'].node[this.radix] = val
      }
      if (keySegment === undefined) {
        root['/'].node[this.radix] = newNode
      } else {
        root['/'].node[keySegment] = newNode
      }
    } else {
      if (keySegment === undefined) {
        root['/'][this.radix] = newNode
      } else {
        root['/'][keySegment] = newNode
      }
    }
  }

  async delete (key) {
    key = new this.ArrayConstructor(key)
    const results = await this._get(key)
    const root = results.root
    if (results.value) {
      if (results.extensionIndex) {
        key = key.subarray(-results.extensionIndex)
      }
      const keySegment = key[key.length - 1]
      delete root[keySegment]
      if (this.isEmptyNode(root) && results.parent) {
        delete results.parent[results.parentKey]
      } else if (!root[root.length - 1]) {
        let oneNode = false
        let rNodeIndex
        for (let i = 0; i < root.length - 1; i++) {
          const el = root[i]
          if (el) {
            if (!oneNode) {
              rNodeIndex = i
              oneNode = true
            } else {
              oneNode = false
              break
            }
          }
        }

        if (oneNode) {
          let extension = root[rNodeIndex].extension || []
          extension = concat([rNodeIndex], extension)
          const parentExtenstion = results.parent[results.parentIndex].extension
          if (parentExtenstion) {
            extension = concat(parentExtenstion, extension)
          }
          results.parent[results.parentIndex] = {
            extension: extension,
            root: root
          }
        }
      }
    }
  }
  isEmptyNode (node) {
    return node.evey(el => !el)
  }
  formatKey (key) {
    if (typeof key === 'string') {
      key = encoder.encode(key)
    }
    return new this.ArrayConstructor(key.buffer)
  }
}

function concat(a, b) {}
function readData (data) {
  return new Uint8Array(data)
}
