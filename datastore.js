const Buffer = require('safe-buffer').Buffer
const crypto = require('crypto')
const DAG = require('ipld-graph-builder/datastore.js')
const cbor = require('borc')

const HASH_LEN = 20
const LINK_TAG = 42

function insertTags (val) {
  if (Array.isArray(val)) {
    val = val.map(v => {
      if (v && v.hasOwnProperty('/')) {
        return new cbor.Tagged(LINK_TAG, v['/'])
      } else {
        return insertTags(v)
      }
    })
  }
  return val
}

module.exports = class TreeDAG extends DAG {
  constructor (dag, decoder = new cbor.Decoder({
    tags: {
      42: val => {
        return {
          '/': val
        }
      }
    }
  })) {
    super(dag)
    this.decoder = decoder
  }

  async put (val) {
    val = insertTags(val)
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
    const hash = crypto.createHash('sha256')
    hash.update(buf)
    return hash.digest().slice(0, HASH_LEN)
  }
}
