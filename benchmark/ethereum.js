var Trie = require('merkle-patricia-tree')
const blake2s = require('../ext/blake2s.js')
// const rlp = require('rlp')
const level = require('level')
const db = level('./eth-testdb')

db._get = db.get
let lookups = 0
db.get = function (key, opts, cb) {
  lookups++
  return db._get(key, opts, cb)
}

let trie = new Trie(db)

const entries = 100000
console.log('entries', entries)

async function run () {

  let start = new Date()
  let hrstart = process.hrtime()

  for (let i = 0; i < entries; i++) {
    const key = (new blake2s(20)).update(Buffer.from(i.toString())).digest()
    await new Promise((resolve, reject) => {
      trie.put(key, i, resolve)
    })
  }

  let end = new Date() - start
  let hrend = process.hrtime(hrstart)

  console.info('state root creation time: %dms', end)
  console.info('state root creation time (hr): %ds %dms', hrend[0], hrend[1] / 1000000)

  start = new Date()
  hrstart = process.hrtime()

  console.log('root', trie.root.toString('hex'))

  let proofSize = 0
  for (let i = 0; i < entries; i++) {
    const key = (new blake2s(20)).update(Buffer.from(i.toString())).digest()
    trie = new Trie(db, trie.root)
    const promise = new Promise((resolve, reject) => {
      trie.get(key, (err, value) => {
        // console.log(value)
        // let proof = stack.map(el => {
        //   return el.raw
        // })
        // let encoded = rlp.encode(proof)
        // proofSize += encoded.length
        resolve()
      })
    })
    await promise
  }

  end = new Date() - start
  hrend = process.hrtime(hrstart)

  console.info('read time: %dms', end)
  console.info('read time (hr): %ds %dms', hrend[0], hrend[1] / 1000000)
  console.info('db lookups', lookups)
  // console.log('rlp size', proofSize / entries)
}

run()
