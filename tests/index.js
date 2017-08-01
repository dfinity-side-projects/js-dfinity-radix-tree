const tape = require('tape')
const IPFS = require('ipfs')
const RadixTree = require('../')

// start ipfs
const node = new IPFS({
  start: false
})

node.on('ready', () => {
  tape('set', async t => {
    const tree = new RadixTree({
      dag: node.dag
    })
    try {
      await tree.set('test', 'cat')
      let val = await tree.get('test')
      t.equals(val, 'cat')
      await tree.set('te', 'blop')
      // console.log(JSON.stringify(tree.root, null, 2))
      val = await tree.get('test')
      t.equals(val, 'cat')

      val = await tree.get('te')
      t.equals(val, 'blop')
    } catch (e) {
      console.log(e)
    }
    t.end()
  })
})
