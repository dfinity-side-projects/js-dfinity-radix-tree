const IPFS = require('ipfs')
const blake2s = require('../ext/blake2s.js')
const RadixTree = require('../')
const cbor = require('borc')
const lzma = require('lzma')

// start ipfs
const node = new IPFS({
  start: false,
  repo: './ipfs-repo'
})

node.on('ready', async () => {
  const tree = new RadixTree({
    dag: node.dag,
    // root: { '/': 'zdpuAmHPs6YDFyFoaUHg5YgyNHoUGKzug5n5ZzdjUrk36Gnzg'}
  })

  const entries = 10000 //5117051
  console.log('entries', entries)
  for (let i = 0; i < entries; i++) {
    const key = (new blake2s(20)).update(Buffer.from(i.toString())).digest()
    await tree.set(key, i)
  }
  console.log('flushing')
  const sr = await tree.flush()
  console.log('done', sr)

  let proofSize = 0
  let compressedSize = 0
  const root = tree.root

  for (let i = 0; i < entries; i++) {
    const tree = new RadixTree({
      dag: node.dag,
      root: {'/': root['/']}
    })
    const key = (new blake2s(20)).update(Buffer.from(i.toString())).digest()
    await tree.get(key)
    removeLink(tree.root['/'])
    const encoded = cbor.encode(tree.root['/'])
    proofSize += encoded.length
    compressedSize += lzma.compress(encoded, 9).length
  }
  console.log('cbor size', proofSize / entries)
  console.log('compressed size', compressedSize / entries)
})

function removeLink (root) {
  if (root) {
    if (root[0]) {
      root[0] = root[0]['/']
    }

    if (root[1]) {
      root[1] = root[1]['/']
    }

    if (!Buffer.isBuffer(root[1])) {
      removeLink(root[1])
    }

    if (!Buffer.isBuffer(root[0])) {
      removeLink(root[0])
    }
  }
}
