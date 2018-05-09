const Uint1Array = require('uint1array')
const cbor = require('borc')
const EMPTY_STATE_ROOT = Buffer.from('4cf812be9be2c6008325050f43d06676a08612c7', 'hex')

const LINK_TAG = 42

function insertTags (val) {
  if (Array.isArray(val)) {
    val = val.map(v => {
      if (v && v.hasOwnProperty('/')) {
        return new cbor.Tagged(LINK_TAG, v['/'])
      } else {
        return insertTags(v)
      }
    })
  }
  return val
}

function toTypedArray (array) {
  return new Uint1Array(new Uint8Array(array).buffer)
}

// helper functions for nodes
const EXTENSION = exports.EXTENSION = 0
const LBRANCH = exports.LBRANCH = 1
const RBRANCH = exports.RBRANCH = 2
const VALUE = exports.VALUE = 3

exports.setBranch = function (node, branch) {
  node['/'][LBRANCH] = branch[0]
  node['/'][RBRANCH] = branch[1]
}

exports.getBranch = function (node) {
  return node['/'].slice(LBRANCH, LBRANCH + 2)
}

exports.getValue = function (node) {
  return node['/'][VALUE]
}

exports.deleteValue = function (node) {
  node['/'] = node['/'].slice(0, 3)
}

exports.getExtension = function (node) {
  if (node['/'][EXTENSION]) {
    const len = node['/'][EXTENSION][0]
    const extension = toTypedArray(node['/'][EXTENSION][1])
    return extension.subarray(0, len)
  } else {
    return toTypedArray([])
  }
}

exports.setExtension = function (node, ex) {
  if (ex && ex.length) {
    node['/'][EXTENSION] = [ex.length, Buffer.from(ex.buffer)]
  } else {
    node['/'][EXTENSION] = null
  }
}

exports.setValue = function (node, val) {
  if (val !== undefined) {
    node['/'][VALUE] = val
  }
}

exports.isEmpty = function (node) {
  if (Buffer.isBuffer(node['/'])) {
    return !Buffer.compare(node['/'], EMPTY_STATE_ROOT)
  } else {
    return node['/'].every(el => !el)
  }
}

exports.encodeNode = function (node) {
  const val = insertTags(node)
  return cbor.encode(val)
}
