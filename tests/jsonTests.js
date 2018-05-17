const tape = require('tape')
const level = require('level-browserify')
const RadixTree = require('../')
const db = level('./testdb')
let tests = require('./tests.json')

const generate = false

async function main () {
  for (const testName in tests) {
    await new Promise((resolve, reject) => {
      tape(testName, async t => {
        const test = tests[testName]
        let tree = new RadixTree({
          db: db
        })

        for (const index in test) {
          const op = test[index]
          if (op.op === 'set') {
            const val = Buffer.from(op.value.slice(2), 'hex')
            const key = Buffer.from(op.key.slice(2), 'hex')
            await tree.set(key, val)
          } else if (op.op === 'get') {
            const key = Buffer.from(op.key.slice(2), 'hex')
            const val = await tree.get(key)
            t.equals('0x' + val.value.toString('hex'), op.value, `value at key ${op.key} should be ${op.value}`)
          } else if (op.op === 'delete') {
            const key = Buffer.from(op.key.slice(2), 'hex')
            await tree.delete(key)
          } else if (op.op === 'stateRoot') {
            await tree.flush()
            const sr = '0x' + tree.root.toString('hex')
            if (generate) {
              op.value = sr
            } else {
              t.equals(sr, op.value, 'should have correct state root')
            }
          }
        }
        // console.log(JSON.stringify(tree.toJSON(), null, 2))
        t.end()
        resolve()
      })
    })
  }
  if (generate) {
    console.error(JSON.stringify(tests, null, 2))
  }
}

main()
