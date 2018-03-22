const Buffer = require('safe-buffer').Buffer
const crypto = require('crypto')
const DAG = require('ipld-graph-builder/datastore.js')
const HASH_LEN = 20
const cbor = require('borc')

module.exports = class TreeDAG extends DAG {
  async put (val) {
    if (val[1]) {
      val[1] = new cbor.Tagged(42, val[1]['/'])
    }

    if (val[2]) {
      val[2] = new cbor.Tagged(42, val[2]['/'])
    }
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
          if (decoded[1]) {
            decoded[1]['/'] = decoded[1].value
          }

          if (decoded[2]) {
            decoded[2]['/'] = decoded[2].value
          }
          resolve(decoded)
        }
      })
    })
  }

  static isValidLink (link) {
    return Buffer.isBuffer(link) && link.length === HASH_LEN
  }

  static getMerkleLink (buf) {
    const hash = crypto.createHash('sha256')
    hash.update(buf)
    return hash.digest().slice(0, HASH_LEN)
  }
}
