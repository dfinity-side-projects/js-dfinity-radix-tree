const tape = require('tape')
const crypto = require('crypto')
const level = require('level')
const RadixTree = require('../')
const db = level('./testdb')

tape('set and get', async t => {
  const r = await RadixTree.getMerkleLink(Buffer.from([0]))

  t.equal(r.toString('hex'), '6e340b9cffb37a989ca544e6bb780a2c78901d3f', 'should hash')

  let tree = new RadixTree({
    db: db
  })

  await tree.set('test', Buffer.from('cat'))
  let val = await tree.get('test')
  t.equals(val.toString(), 'cat')
  await tree.set('te', Buffer.from('blop'))
  val = await tree.get('test')
  t.equals(val.toString(), 'cat')

  val = await tree.get('te')
  t.equals(val.toString(), 'blop')

  await tree.set('rad', Buffer.from('cat2'))

  val = await tree.get('rad')
  t.equals(val.toString(), 'cat2')

  await tree.set('test', Buffer.from('cat111'))
  val = await tree.get('test')
  t.equals(val.toString(), 'cat111')

  const stateRoot = await tree.flush()

  // try reteriving node from ipfs
  tree = new RadixTree({
    db: db,
    root: stateRoot
  })

  val = await tree.get('te')
  t.equals(val.toString(), 'blop')

  val = await tree.get('rad')
  t.equals(val.toString(), 'cat2')

  val = await tree.get('test')
  t.equals(val.toString(), 'cat111')
  // console.log(JSON.stringify(tree.root, null, 2))
  t.end()
})

tape('branch nodes', async t => {
  const tree = new RadixTree({
    db: db
  })

  let key0 = new RadixTree.ArrayConstructor([1, 1])
  await tree.set(key0, Buffer.from('cat'))
  let key1 = new RadixTree.ArrayConstructor([0, 1])
  await tree.set(key1, Buffer.from('cat2'))

  let key2 = new RadixTree.ArrayConstructor([1, 0])
  await tree.set(key2, Buffer.from('cat'))
  let key3 = new RadixTree.ArrayConstructor([0, 0])
  await tree.set(key3, Buffer.from('cat3'))

  let val = await tree.get(key0)
  t.equals(val.toString(), 'cat')
  val = await tree.get(key1)
  t.equals(val.toString(), 'cat2')
  val = await tree.get(key2)
  t.equals(val.toString(), 'cat')
  val = await tree.get(key3)
  t.equals(val.toString(), 'cat3')

  t.end()
})

tape('delete', async t => {
  const tree = new RadixTree({
    db: db
  })
  await tree.set('test', Buffer.from('cat'))
  await tree.set('ter', Buffer.from('cat3'))
  await tree.delete('te')
  await tree.delete('test')
  await tree.delete('ter')
  t.deepEquals(tree.root['/'], RadixTree.emptyTreeState)

  // tests delete midle branchs
  await tree.set('test', Buffer.from('cat'))
  await tree.set('te', Buffer.from('cat2'))
  await tree.set('ter', Buffer.from('cat3'))
  await tree.delete('te')
  let val = await tree.get('test')
  t.equals(val.toString(), 'cat')

  // tests delete end branchs
  await tree.set('te', 'cat2')
  await tree.delete('ter')
  await tree.delete('te')
  await tree.delete('test')
  t.deepEquals(tree.root['/'], RadixTree.emptyTreeState)
  t.end()
})

tape('large values', async t => {
  const tree = new RadixTree({
    db: db
  })
  const saved = Buffer.alloc(33).fill(1)
  await tree.set('test', saved)
  const value = await tree.get('test')
  t.equals(value.toString(), saved.toString())
  t.end()
})

tape('errors', async t => {
  const tree = new RadixTree({
    db: db,
    root: {
      '/': Buffer.alloc(20)
    }
  })

  try {
    await tree.get('test')
  } catch (e) {
    t.end()
  }
})

tape('random', async t => {
  const tree = new RadixTree({
    db: db
  })
  const entries = 100
  for (let i = 0; i < entries; i++) {
    const key = crypto.createHash('sha256').update(i.toString()).digest().slice(0, 20)
    await tree.set(key, Buffer.from([i]))
  }
  // console.log(JSON.stringify(tree.root, null, 2))

  await tree.flush()

  for (let i = 0; i < entries; i++) {
    const key = crypto.createHash('sha256').update(i.toString()).digest().slice(0, 20)
    const value = await tree.get(key)
    t.equals(value[0], i)
  }

  await tree.flush()
  for (let i = 0; i < entries; i++) {
    const key = crypto.createHash('sha256').update(i.toString()).digest().slice(0, 20)
    await tree.delete(key)
  }

  t.deepEquals(tree.root['/'], RadixTree.emptyTreeState)

  t.end()
})
