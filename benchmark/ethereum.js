var Trie = require('merkle-patricia-tree')
const crypto = require('crypto')
const rlp = require('rlp')

const trie = new Trie()

const entries = 100000
console.log('entries', entries)

async function run () {
  for (let i = 0; i < entries; i++) {
    const key = crypto.createHash('sha256').update(i.toString()).digest().slice(0, 20)
    await new Promise((resolve, reject) => {
      trie.put(key, i, resolve)
    })
  }

  let proofSize = 0
  for (let i = 0; i < entries; i++) {
    const key = crypto.createHash('sha256').update(i.toString()).digest().slice(0, 20)
    const promise = new Promise((resolve, reject) => {
      trie.findPath(key, (err, node, remainder, stack) => {
        let proof = stack.map(el => {
          return el.raw
        })
        let encoded = rlp.encode(proof)
        proofSize += encoded.length
        resolve()
      })
    })
    await promise
  }
  console.log('rlp size', proofSize / entries)
}

run()
