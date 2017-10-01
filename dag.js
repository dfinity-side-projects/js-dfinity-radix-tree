const crypto = require('crypto')
const DAG = require('ipld-graph-builder/dag')
const treeNode = require('./treeNode.js')
const HASH_LEN = 20

module.exports = class TreeDAG extends DAG {
  put (val, options) {
    const encoded = treeNode.encode(val).toString('hex')
    const key = crypto.createHash('sha256').update(encoded).digest().slice(0, HASH_LEN)
    return new Promise((resolve, reject) => {
      this._dag.put(key, encoded, () => {
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
          const decoded = treeNode.decode(val)
          resolve(decoded)
        }
      })
    })
  }

  isValidLink (link) {
    return Buffer.isBuffer(link) && link.length === HASH_LEN
  }
}
