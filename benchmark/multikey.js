const IPFS = require('ipfs')
const blake2s = require('../ext/blake2s.js')
const RadixTree = require('../')
const cbor = require('borc')
const zlib = require('zlib')

// start ipfs
const node = new IPFS({
  start: false,
  repo: './ipfs-repo'
})

node.on('ready', async () => {
  const tree = new RadixTree({
    dag: node.dag,
    // root: { '/': 'zdpuArkpWFfw49S1tNLY26YNkHCoKt2CG7rJ6iCaqkcwsGqH7' }
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

  const gzip = zlib.createGzip()
  gzip.on('data', (data) => {
    compressedSize += data.length
  })

  const numOfKeys = 3
  for (let i = 0; i < numOfKeys; i++) {
    const key = (new blake2s(20)).update(Buffer.from(i.toString())).digest()
    await tree.get(key)
  }

  const encoded = cbor.encode(tree.root)
  proofSize += encoded.length

  const promise = new Promise((resolve, reject) => {
    gzip.on('end', () => {
      resolve()
    })
  })
  gzip.end(encoded)
  await promise
  console.log('cbor size', proofSize)
  console.log('compressed size', compressedSize)
})

// if (i % 10000 === 0) {
//   console.log(i)
//   console.log(JSON.stringify(tree.root, null, 2))
//   try {
//     let start = new Date()
//     let hrstart = process.hrtime()
//     await tree.flush()
//     const end = new Date() - start
//     const hrend = process.hrtime(hrstart)

//     console.info('Execution time: %dms', end)
//     console.info('Execution time (hr): %ds %dms', hrend[0], hrend[1] / 1000000)
//     console.log(tree.root)
//     start = new Date()
//     hrstart = process.hrtime()
//   } catch (e) {
//     console.log(e)
//   }
// }
