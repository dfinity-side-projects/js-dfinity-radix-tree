[![NPM Package](https://img.shields.io/npm/v/dfinity-radix-tree.svg?style=flat-square)](https://www.npmjs.org/package/dfinity-radix-tree)
[![Build Status](https://img.shields.io/travis/dfinity/js-dfinity-radix-tree.svg?branch=master&style=flat-square)](https://travis-ci.org/dfinity/js-dfinity-radix-tree)
[![Coverage Status](https://img.shields.io/coveralls/dfinity/js-dfinity-radix-tree.svg?style=flat-square)](https://coveralls.io/dfinity/js-dfinity-radix-tree)

[![js-standard-style](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)  

# SYNOPSIS 
This implements a binary merkle radix tree. The point of using a binary radix
tree is that it generates smaller proof size then trees with larger radixes.
This tree is well suited for storing large dictonaries of fairly random keys.
And is optimized for storing keys of the same length. If the keys are not 
random better performance can be achived by hashing them first. It builds on 
top of [ipld-graph-builder](https://github.com/ipld/js-ipld-graph-builder)
and the resulting state and proofs are generated using it.

# INSTALL
`npm install dfinity-radix-tree`

# USAGE

```javascript
const RadixTree = require('js-dfinity-radix-tree')
const level = require('level')
const db = level('./tempdb')

async function main () {
  const prover = new RadixTree({
    db: db
  })

  await prover.set('test', Buffer.from('value'))
  await prover.set('doge', Buffer.from('coin'))
  await prover.set('cat', Buffer.from('dog'))
  await prover.set('monkey', Buffer.from('wrench'))

  // create a merkle root and save the tree
  const merkleroot = await prover.flush()

  // start a new Instance with the root
  const verifier = new RadixTree({
    db: db,
    root: merkleroot
  })

  const val = await verifier.get('monkey')
  console.log(val.toString())
}

main()
```
# API
['./docs/'](./docs/index.md)

# SPEC
['./docs/spec.md'](./docs/spec.md)

# BENCHMARKS
The result of the benchmarks show that the binary radix tree produces proofs on
average %67 small then the Ethereum Trie with 100000 keys stored.

['./benchmarks/benchmarks.md'](./benchmark/results.md)

# TESTS
`npm run tests`

# LICENSE
[MPL-2.0](https://tldrlegal.com/license/mozilla-public-license-2.0-(mpl-2))
