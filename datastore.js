const Buffer = require('safe-buffer').Buffer
const crypto = require('node-webcrypto-shim')
const DAG = require('ipld-graph-builder/datastore.js')
const HASH_LEN = 20
const cbor = require('borc')

module.exports = class TreeDAG extends DAG {
  async put (val) {
    const encoded = cbor.encode(val)
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
          const decoded = cbor.decode(val)
          resolve(decoded)
        }
      })
    })
  }

  static isValidLink (link) {
    return Buffer.isBuffer(link) && link.length === HASH_LEN
  }

  static getMerkleLink (buf) {
    return crypto.subtle.digest({
      name: 'SHA-256'
    }, buf).then(link => Buffer.from(link.slice(0, HASH_LEN)))
  }
}
