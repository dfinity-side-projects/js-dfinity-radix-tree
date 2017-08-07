const tape = require('tape')
const crypto = require('crypto')
const IPFS = require('ipfs')
const RadixTree = require('../')

// start ipfs
const node = new IPFS({
  start: false
})

node.on('ready', () => {
  tape('set and get', async t => {
    let tree = new RadixTree({
      dag: node.dag
    })

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

    const stateRoot = await tree.flush()

    // try reteriving node from ipfs
    tree = new RadixTree({
      dag: node.dag,
      root: stateRoot
    })

    val = await tree.get('te')
    t.equals(val, 'blop')

    val = await tree.get('rad')
    t.equals(val, 'cat2')

    val = await tree.get('test')
    t.equals(val, 'cat111')
    // console.log(JSON.stringify(tree.root, null, 2))

    t.end()
  })

  tape('branch nodes', async t => {
    const tree = new RadixTree({
      dag: node.dag
    })

    let key0 = new RadixTree.ArrayConstructor([1, 1])
    await tree.set(key0, 'cat')
    let key1 = new RadixTree.ArrayConstructor([0, 1])
    await tree.set(key1, 'cat2')

    // console.log(JSON.stringify(tree.root, null, 2))
    let key2 = new RadixTree.ArrayConstructor([1, 0])
    await tree.set(key2, 'cat')
    let key3 = new RadixTree.ArrayConstructor([0, 0])
    await tree.set(key3, 'cat3')

    let val = await tree.get(key0)
    t.equals(val, 'cat')
    val = await tree.get(key1)
    t.equals(val, 'cat2')
    val = await tree.get(key2)
    t.equals(val, 'cat')
    val = await tree.get(key3)
    t.equals(val, 'cat3')

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
      t.deepEquals(tree.root['/'], [undefined, undefined])

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
      t.deepEquals(tree.root['/'], [undefined, undefined])
    } catch (e) {
      console.log(e)
    }
    t.end()
  })

  tape('large values', async t => {
    const tree = new RadixTree({
      dag: node.dag
    })
    const saved = Buffer.alloc(33).fill(1)
    await tree.set('test', saved)
    const value = await tree.get('test')
    t.equals(value.toString(), saved.toString())
    t.end()
  })

  tape('random', async t => {
    const tree = new RadixTree({
      dag: node.dag
    })
    const entries = 100
    for (let i = 0; i < entries; i++) {
      const key = crypto.createHash('sha256').update(i.toString()).digest().slice(0, 20)
      await tree.set(key, i)
    }

    for (let i = 0; i < entries; i++) {
      const key = crypto.createHash('sha256').update(i.toString()).digest().slice(0, 20)
      const value = await tree.get(key)
      t.equals(value, i)
    }

    for (let i = 0; i < entries; i++) {
      const key = crypto.createHash('sha256').update(i.toString()).digest().slice(0, 20)
      await tree.delete(key)
    }

    t.deepEquals(tree.root['/'], [undefined, undefined])

    t.end()
  })
})
