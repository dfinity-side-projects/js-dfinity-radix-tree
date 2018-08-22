const blake2s = require('../ext/blake2s.js')
const crypto = require('crypto')

const entries = 5000000
console.log('entries', entries)

let start = new Date()
let hrstart = process.hrtime()

for (let i = 0; i < entries; i++) {
  const key = (new blake2s(20)).update(Buffer.from(i.toString())).digest()
}

let end = new Date() - start
let hrend = process.hrtime(hrstart)

console.info('blake2s raw: %dms', end)
console.info('blake2s raw (hr): %ds %dms', hrend[0], hrend[1] / 1000000)


start = new Date()
hrstart = process.hrtime()

for (let i = 0; i < entries; i++) {
  const key = (new blake2s(20)).update(Buffer.from(i.toString())).hexDigest()
}

end = new Date() - start
hrend = process.hrtime(hrstart)

console.info('blake2s hex: %dms', end)
console.info('blake2s hex (hr): %ds %dms', hrend[0], hrend[1] / 1000000)


start = new Date()
hrstart = process.hrtime()

for (let i = 0; i < entries; i++) {
  const key = crypto.createHash('sha256').update(i.toString()).digest().slice(0, 20)
}

end = new Date() - start
hrend = process.hrtime(hrstart)

console.info('sha256 raw: %dms', end)
console.info('sha256 raw (hr): %ds %dms', hrend[0], hrend[1] / 1000000)


start = new Date()
hrstart = process.hrtime()

for (let i = 0; i < entries; i++) {
  const key = crypto.createHash('sha256').update(i.toString()).digest().slice(0, 20).toString('hex')
}

end = new Date() - start
hrend = process.hrtime(hrstart)

console.info('sha256 hex: %dms', end)
console.info('sha256 hex (hr): %ds %dms', hrend[0], hrend[1] / 1000000)
