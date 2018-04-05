const RadixTree = require('../')

const cbor = require('borc')
const http = require('http')

let tree

const server = http.createServer(async (req, res) => {
  const key = Buffer.from(req.url.slice(1), 'hex')
  const value = await tree.graph._dag.get(key)
  res.end(cbor.encode(value).toString('base64'))
})

module.exports = {
  listen: (db, port = 3000) => {
    server.listen(port, (err) => {
      if (err) { return console.error(err) }

      tree = new RadixTree({db})

      console.log(`server is listening on ${port}`)
    })

    return server
  }
}
