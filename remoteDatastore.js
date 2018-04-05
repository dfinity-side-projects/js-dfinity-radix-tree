const Buffer = require('safe-buffer').Buffer
const TreeDAG = require('./datastore.js')
const fetch = require('node-fetch')

module.exports = class RemoteTreeDAG extends TreeDAG {
  /**
   * @param dag {object} a level db instance
   * @param remoteOpts
   * @param remoteOpts.uri {string} the HTTP uri which has an interface: GET /:key -> value
   * @param remoteOpts.encoding {string} the encoding of the reponse
   * @param opts.decoder {object} a cbor decoder
   */
  constructor (dag, remoteOpts, decoder) {
    super(dag, decoder)
    this.remoteOpts = Object.assign({
      uri: null,
      encoding: 'base64'
    }, remoteOpts)
  }

  async get (link) {
    try {
      return await super.get(link)
    } catch (e) {
      if (this.remoteOpts.uri) {
        await this.fetchRemote(link)
        return super.get(link)
      }
    }
  }

  fetchRemote (key) {
    if (!Buffer.isBuffer(key)) {
      key = Buffer.from(key.buffer)
    }

    const route = `${this.remoteOpts.uri}/${key.toString('hex')}`
    return fetch(route)
      .then(res => res.text())
      .then(text => {
        const encoded = Buffer.from(text, this.remoteOpts.encoding)
        return new Promise((resolve, reject) => {
          this._dag.put(key, encoded.toString('hex'), () => {
            resolve(key)
          })
        })
      })
      .catch(err => {
        console.warn(`error fetching ${route}:`, err.message)
      })
  }
}
