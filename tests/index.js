const fs = require('fs-extra')
const tape = require('tape')
const blake2s = require('../ext/blake2s.js')
const level = require('level-browserify')
const RadixTree = require('../')
const RemoteDataStore = require('../remoteDatastore')
const remote = require('./remote')

fs.removeSync('./testdb')
const db = level('./testdb')

tape('root existence', async t => {
  const tree = new RadixTree({
    db
  })
  let exists = await tree.rootExists(Buffer.from([0]))
  t.equals(exists, false)

  tree.set('test', Buffer.from('cat'))
  exists = await tree.rootExists(Buffer.from('0145fb4f4b0d9ba062b5c1f8f9ea3011abf05a78', 'hex'))
  t.equals(exists, true)
  t.end()
})

tape('should generate the same stateRoot', async t => {
  const tree = new RadixTree({
    db
  })
  tree.root = [null, null, null]
  const stateRoot1 = await tree.flush()
  const stateRoot2 = await tree.flush()
  t.deepEquals(stateRoot2, stateRoot1)
  t.end()
})

tape('should generate the same stateRoot', async t => {
  const tree1 = new RadixTree({
    db
  })

  const tree2 = new RadixTree({
    db
  })
  await tree1.flush()
  tree1.set('test', Buffer.from('cat'))
  tree2.set('test', Buffer.from('cat'))
  const stateRoot1 = await tree1.flush()
  const stateRoot2 = await tree2.flush()
  t.deepEquals(stateRoot2, stateRoot1)
  t.end()
})

tape('insert that creates one new node', async t => {
  const tree = new RadixTree({
    db
  })
  tree.set('foo', Buffer.from('bar'))
  tree.set('foob', Buffer.from('baz'))
  const node = await tree.get('foob')
  t.equals(node.value.toString(), 'baz')

  tree.delete('foob')
  const node2 = await tree.get('foo')
  t.equals(node2.value.toString(), 'bar')
  t.end()
})

tape('insert that creates one new node', async t => {
  const tree = new RadixTree({
    db
  })
  tree.set([0, 0, 1], Buffer.from('bar'))
  await tree.set([0, 0, 0], Buffer.from('baz'))
  await tree.set([0, 0], Buffer.from('lol'))
  const node = await tree.get([0, 0, 0])
  t.equals(node.value.toString(), 'baz')

  await tree.delete([0, 0])
  const node2 = await tree.get([0, 0, 1])
  t.equals(node2.value.toString(), 'bar')
  t.end()
})

tape('set and get', async t => {
  const r = await RadixTree.getMerkleLink(Buffer.from([0]))

  t.equal(r.toString('hex'), '63a5f3dba42c1ee9ce4147c1b22e0b61f4c7a17a', 'should hash')

  let tree = new RadixTree({
    db
  })

  tree.set('test', Buffer.from('cat'))
  let val = await tree.get('test')
  t.equals(val.value.toString(), 'cat')
  tree.set('te', Buffer.from('blop'))
  val = await tree.get('test')
  t.equals(val.value.toString(), 'cat')

  val = await tree.get('te')
  t.equals(val.value.toString(), 'blop')

  tree.set('rad', Buffer.from('cat2'))

  val = await tree.get('rad')
  t.equals(val.value.toString(), 'cat2')

  tree.set('test', Buffer.from('cat111'))
  val = await tree.get('test')
  t.equals(val.value.toString(), 'cat111')

  const stateRoot = await tree.flush()

  // try reteriving node from ipfs
  tree = new RadixTree({
    db,
    root: stateRoot
  })

  val = await tree.get('te')
  t.equals(val.value.toString(), 'blop')

  val = await tree.get('rad')
  t.equals(val.value.toString(), 'cat2')

  val = await tree.get('test')
  t.equals(val.value.toString(), 'cat111')

  const json = [
    [5, '0,1,1,1,0'], {
      '/': [
        [18, '1,0,0,1,1,0,0,0,0,1,0,1,1,0,0,1,0,0'], null, null, '0x63617432'
      ]
    }, {
      '/': [
        [10, '0,0,0,1,1,0,0,1,0,1'], {
          '/': [
            [15, '1,1,1,0,0,1,1,0,1,1,1,0,1,0,0'], null, null, '0x636174313131'
          ]
        },
        null, '0x626c6f70'
      ]
    }
  ]
  t.deepEquals(tree.toJSON(), json)
  t.end()
})

tape('branch nodes', async t => {
  const tree = new RadixTree({
    db
  })

  let key0 = [1, 1]
  let key1 = [0, 1]
  let key2 = [1, 0]
  let key3 = [0, 0]

  tree.set(key0, Buffer.from('cat'))
  tree.set(key1, Buffer.from('cat2'))
  tree.set(key2, Buffer.from('cat'))
  tree.set(key3, Buffer.from('cat3'))

  let val = await tree.get(key0)
  t.equals(val.value.toString(), 'cat')
  val = await tree.get(key1)
  t.equals(val.value.toString(), 'cat2')
  val = await tree.get(key2)
  t.equals(val.value.toString(), 'cat')
  val = await tree.get(key3)
  t.equals(val.value.toString(), 'cat3')

  t.end()
})

tape('delete', async t => {
  const tree = new RadixTree({
    db
  })
  tree.set('test', Buffer.from('cat'))
  tree.set('ter', Buffer.from('cat3'))
  tree.delete('te')
  tree.delete('test')
  await tree.delete('ter')
  t.deepEquals(tree.root, RadixTree.emptyTreeState)

  // tests delete midle branchs
  tree.set('test', Buffer.from('cat'))
  tree.set('te', Buffer.from('cat2'))
  tree.set('ter', Buffer.from('cat3'))
  await tree.delete('te')
  let val = await tree.get('test')
  t.equals(val.value.toString(), 'cat')

  // tests delete end branchs
  tree.set('te', 'cat2')
  tree.delete('ter')
  tree.delete('te')
  await tree.delete('test')
  t.deepEquals(tree._root['/'], RadixTree.emptyTreeState)
  t.end()
})

tape('large values', async t => {
  const tree = new RadixTree({
    db
  })
  const saved = Buffer.alloc(33).fill(1)
  tree.set('test', saved)
  const value = await tree.get('test')
  t.equals(value.value.toString(), saved.toString())
  t.end()
})

tape('errors', async t => {
  const tree = new RadixTree({
    db,
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
    db
  })
  const entries = 100
  for (let i = 0; i < entries; i++) {
    const key = (new blake2s(20)).update(Buffer.from(i.toString())).digest()
    tree.set(key, Buffer.from([i]))
  }
  await tree.flush()

  for (let i = 0; i < entries; i++) {
    const key = (new blake2s(20)).update(Buffer.from(i.toString())).digest()
    const value = await tree.get(key)
    t.equals(value.value[0], i)
  }

  await tree.flush()
  for (let i = 0; i < entries; i++) {
    const key = (new blake2s(20)).update(Buffer.from(i.toString())).digest()
    await tree.delete(key)
  }

  t.deepEquals(tree._root['/'], RadixTree.emptyTreeState)

  t.end()
})

tape('remote', async t => {
  // remote
  const remoteTree = new RadixTree({
    db
  })
  const server = remote.listen(db)

  const entries = 100
  for (let i = 0; i < entries; i++) {
    const key = (new blake2s(20)).update(Buffer.from(i.toString())).digest()
    remoteTree.set(key, Buffer.from([i]))
  }
  const stateRoot = await remoteTree.flush()

  // local
  fs.removeSync('./localdb')
  const localTree = new RadixTree({
    dag: new RemoteDataStore(level('./localdb'), {uri: 'http://localhost:3000'})
  })
  localTree.root = stateRoot

  for (let i = 0; i < entries; i++) {
    const key = (new blake2s(20)).update(Buffer.from(i.toString())).digest()
    const value = await localTree.get(key)
    t.equals(value.value[0], i)
  }

  server.close()
  t.end()
})

tape('reset', async t => {
  const tree = new RadixTree({
    db
  })

  const stateRoot1 = await tree.flush()

  const entries = 100
  for (let i = 0; i < entries; i++) {
    const key = (new blake2s(20)).update(Buffer.from(i.toString())).digest()
    tree.set(key, Buffer.from([i]))
  }

  await tree.flush()

  tree.root = RadixTree.emptyTreeState

  const stateRoot2 = await tree.flush()

  t.deepEquals(stateRoot1, stateRoot2)

  t.end()
})
