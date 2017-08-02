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
    while (key.length > index) {
      if (root['/'].extension) {
        let extensionIndex = 0
        const extension = this.toTypedArray(root['/'].extension)
        let subKey
        // alll extension are padded to 8 bit alignment. So we need to update
        // the index later to count for the added padding
        let padLen
        if (this.radix === 2) {
          subKey = key.slice(index, index + extension.length)
          padLen = subKey.length
          subKey = new this.ArrayConstructor(subKey.buffer)
          padLen = subKey.length - padLen
        } else {
          subKey = key.subarray(index, extension.length)
        }
        // checks the extension against the key
        while (extensionIndex < extension.length && extension[extensionIndex] === subKey[extensionIndex]) {
          extensionIndex++
        }
        index += extensionIndex - padLen
        // check if we compelete travered the extension
        if (extensionIndex !== extension.length) {
          return {
            extensionIndex: extensionIndex,
            root: root,
            index: index
          }
        }
      }

      let keySegment = key[index]
      if (keySegment) {
        const branch = getBranch(root)
        await this.graph.get(branch, keySegment)
        root = branch[keySegment]
      }

      index++
    }

    const node = getBranch(root)
    // get the value
    let value
    if (Array.isArray(node)) {
      value = node[node.length - 1]
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
      // split the extension node in two
      let extension = this.toTypedArray(root['/'].extension)
      const extensionKey = extension[result.extensionIndex + 1]
      const remExtension = extension.subarray(1 - result.extensionIndex)
      extension = extension.subarray(0, result.extensionIndex)

      const node = root['/'].node
      let newNode
      // create the new extension node
      if (extension.length) {
        root['/'].extension = new Buffer(extension.buffer)
        newNode = root['/'].node = []
      } else {
        newNode = root['/'] = []
      }

      // save the remainer of the extension node
      if (remExtension.length) {
        newNode[extensionKey] = {
          '/': {
            extension: new Buffer(remExtension.buffer),
            node: node
          }
        }
      } else {
        newNode[extensionKey] = node
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
    }
    return new this.ArrayConstructor(key.buffer)
  }
}

function getBranch (node) {
  if (node['/'].extension) {
    return node['/'].node
  } else {
    return root['/']
  }
}

