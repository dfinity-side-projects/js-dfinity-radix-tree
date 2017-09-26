[![NPM Package](https://img.shields.io/npm/v/merkle-radix-tree.svg?style=flat-square)](https://www.npmjs.org/package/merkle-radix-tree)
[![Build Status](https://img.shields.io/travis/primea/merkle-radix-tree.svg?branch=master&style=flat-square)](https://travis-ci.org/primea/merkle-radix-tree)
[![Coverage Status](https://img.shields.io/coveralls/primea/merkle-radix-tree.svg?style=flat-square)](https://coveralls.io/primea/merkle-radix-tree)

[![js-standard-style](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)  

# install
`npm install merkle-radix-tree`

# SYNOPSIS 
This implements a binary merkle radix tree. The point of using a binary radix
tree is that it generates smaller proof size then trees with larger radixes.
This tree is well suited for storing large dictonaries of fairly random keys.
And is optimized for storing keys of the same length. If the keys are not 
random better performance can be achived by hashing them first.It builds on 
top of [ipld-graph-builder](https://github.com/ipld/js-ipld-graph-builder)
and the resulting state and proofs are generated using it.

# INSTALL
`npm install merkle-radix-tree`

# USAGE

```javascript
const IPFS = require('ipfs')
const RadixTree = require('merkle-radix-tree')

// start ipfs
const node = new IPFS({
  start: false,
  repo: './ipfs-repo'
})

node.on('ready', async () => {
  const prover = new RadixTree({
    dag: node.dag
  })

  // set some values
  await prover.set('test', 'value')
  await prover.set('doge', 'coin')
  await prover.set('cat', 'dog')
  await prover.set('monkey', 'wrench')

  // create a merkle root and save the tree
  const merkleRoot = await prover.flush()

  // start a new Instance with the root
  const verifier = new RadixTree({
    dag: node.dag,
    root: merkleRoot
  })

  // gets the merkle proof from ipfs-js and returns the result
  const val = await verifier.get('monkey')
  console.log(val)
})
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
