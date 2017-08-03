const tape = require('tape')
const IPFS = require('ipfs')
const RadixTree = require('../')

// start ipfs
const node = new IPFS({
  start: false
})

node.on('ready', () => {
  tape('set and get', async t => {
    const tree = new RadixTree({
      dag: node.dag
    })
    try {
      await tree.set('test', 'cat')
      let val = await tree.get('test')
      t.equals(val, 'cat')
      await tree.set('te', 'blop')
      val = await tree.get('test')
      t.equals(val, 'cat')

      val = await tree.get('te')
      t.equals(val, 'blop')

      await tree.set('rad', 'cat2')

      val = await tree.get('rad')
      t.equals(val, 'cat2')

      await tree.set('test', 'cat111')
      val = await tree.get('test')
      t.equals(val, 'cat111')
    } catch (e) {
      console.log(e)
    }
    t.end()
  })

  tape('branch nodes', async t => {
    const tree = new RadixTree({
      dag: node.dag
    })
    try {
      let key0 = new RadixTree.ArrayConstructor([1, 1, 0, 0])
      await tree.set(key0, 'cat')
      let key1 = new RadixTree.ArrayConstructor([0, 1, 0, 1])
      await tree.set(key1, 'cat2')
      let val = await tree.get(key0)
      t.equals(val, 'cat')

      val = await tree.get(key1)
      t.equals(val, 'cat2')

      let key3 = new RadixTree.ArrayConstructor([0, 1, 0, 1, 1])
      await tree.set(key3, 'test')
      val = await tree.get(key3)

      t.equals(val, 'test')

      let key4 = new RadixTree.ArrayConstructor([0, 1, 0, 0, 0])
      await tree.set(key4, 'dog')
      val = await tree.get(key4)
      t.equals(val, 'dog')
    } catch (e) {
      console.log(e)
    }
    t.end()
  })

  tape('delete', async t => {
    const tree = new RadixTree({
      dag: node.dag
    })
    try {
      await tree.set('test', 'cat')
      await tree.set('ter', 'cat3')
      await tree.delete('te')
      await tree.delete('test')
      await tree.delete('ter')
      t.equals(tree.root['/'], null)

      // tests delete midle branchs
      await tree.set('test', 'cat')
      await tree.set('te', 'cat2')
      await tree.set('ter', 'cat3')
      await tree.delete('te')
      let val = await tree.get('test')
      t.equals(val, 'cat')

      // tests delete end branchs
      await tree.set('te', 'cat2')
      await tree.delete('ter')
      await tree.delete('te')
      await tree.delete('test')
      t.equals(tree.root['/'], null)
    } catch (e) {
      console.log(e)
    }
    t.end()
  })

  tape('large values', async t => {
    const tree = new RadixTree({
      dag: node.dag
    })
    const saved = new Buffer(33).fill(1)
    await tree.set('test', saved)
    const value = await tree.get('test')
    t.equals(value.toString(), saved.toString())
    t.end()
  })
})
