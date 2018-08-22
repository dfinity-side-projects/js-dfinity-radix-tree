const Buffer = require('safe-buffer').Buffer
const DAG = require('ipld-graph-builder/datastore.js')
const cbor = require('borc')
const node = require('./treeNode.js')
const Blake2s = require('./ext/blake2s.js')

const HASH_LEN = 20

module.exports = class TreeDAG extends DAG {
  constructor (dag, decoder = new cbor.Decoder({
    tags: {
      42: val => {
        return {
          '/': val
        }
      }
    },
    size: 4194304 // set heap usage to 4MB
  })) {
    super(dag)
    this.decoder = decoder
  }

  async put (val) {
    const encoded = node.encodeNode(val)
    const key = await TreeDAG.getMerkleLink(encoded)

    return new Promise((resolve, reject) => {
      this._dag.put(key, encoded.toString('hex'), () => {
        resolve(key)
      })
    })
  }

  get (link) {
    return new Promise((resolve, reject) => {
      this._dag.get(link, (err, val) => {
        if (err) {
          reject(err)
        } else {
          val = Buffer.from(val, 'hex')
          const decoded = this.decoder.decodeFirst(val)
          resolve(decoded)
        }
      })
    })
  }

  static isValidLink (link) {
    return Buffer.isBuffer(link) && link.length === HASH_LEN
  }

  static getMerkleLink (buf) {
    const hash = new Blake2s(HASH_LEN)
    hash.update(buf)
    return Buffer.from(hash.digest())
  }
}
