const cbor = require('borc')
const EMPTY_STATE_ROOT = Buffer.from('20fa0017102396a41d3a85d0f012cafecc386791', 'hex')

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
    const extension = exports.buffer2bits(node['/'][EXTENSION][1])
    return extension.slice(0, len)
  } else {
    return []
  }
}

exports.setExtension = function (node, ex) {
  if (ex && ex.length) {
    node['/'][EXTENSION] = [ex.length, exports.bit2buffer(ex)]
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
  const encoded = cbor.encode(val)
  return encoded
}

exports.buffer2bits = function (buffer) {
  const bitArray = []
  for (const elem of buffer) {
    for (let i = 7; i >= 0; i--) {
      bitArray.push((elem & (1 << i)) >> i)
    }
  }
  return bitArray
}

exports.bit2buffer = function (bits) {
  bits = bits.slice(0)
  const byteArray = []
  for (const index in bits) {
    const bit = bits[index]
    const arrayIndex = Math.floor(index / 8)
    byteArray[arrayIndex] = byteArray[arrayIndex] | bit << (7 - (index % 8))
  }
  return Buffer.from(byteArray)
}
