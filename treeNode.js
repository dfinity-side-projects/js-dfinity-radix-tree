const leb128 = require('leb128').unsigned
const LebStream = require('leb128/stream')
const Uint1Array = require('uint1array')
const HASH_LEN = 20

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
  delete node['/'][VALUE]
}

exports.getExtension = function (node) {
  if (node['/'][EXTENSION]) {
    const len = node['/'][EXTENSION][0]
    const extension = toTypedArray(node['/'][EXTENSION][1])
    return extension.subarray(0, len)
  } else {
    return []
  }
}

exports.setExtension = function (node, ex) {
  if (ex && ex.length) {
    node['/'][EXTENSION] = [ex.length, Buffer.from(ex.buffer)]
  } else {
    delete node['/'][EXTENSION]
  }
}

exports.setValue = function (node, val) {
  node['/'][VALUE] = val
}

exports.isEmpty = function (node) {
  const branch = exports.getBranch(node)
  return !node['/'][EXTENSION] && !branch[0] && !branch[1] && node['/'][VALUE] === undefined
}

// PREFIX :=  | LBP | RBP | EXT | LB | RB | VALUE |
// NODE := | PREFIX | LEN | PAYLOAD
const MASK = {
  EXTENSION: 8,
  LBRANCH: 4,
  RBRANCH: 2,
  VALUE: 1
}

exports.encode = function (node, prefix = 0, encodeLen = false) {
  let encoded = []
  const ext = node[EXTENSION]
  if (ext) {
    const len = leb128.encode(ext[0])
    encoded.push(len)
    encoded.push(ext[1])
    prefix += MASK.EXTENSION
  }

  const lb = node[LBRANCH]
  if (lb) {
    encoded.push(lb['/'])
    prefix += MASK.LBRANCH
  }

  const rb = node[RBRANCH]
  if (rb) {
    encoded.push(rb['/'])
    prefix += MASK.RBRANCH
  }

  const val = node[VALUE]
  if (val !== undefined) {
    encoded.push(val)
    prefix += MASK.VALUE
  }

  encoded.unshift(Buffer.from([prefix]))
  encoded = Buffer.concat(encoded)
  if (encodeLen) {
    const len = leb128.encode(encoded.length)
    encoded = Buffer.concat([len, encoded])
  }
  return encoded
}

exports.decode = function (val) {
  const node = [null, null, null]
  const prefix = val[0]
  const lebStream = new LebStream(val.slice(1))

  if (prefix & MASK.EXTENSION) {
    const len = Number(leb128.read(lebStream))
    const ext = lebStream.read(Math.ceil(len / 8))
    node[EXTENSION] = [len, ext]
  }

  if (prefix & MASK.LBRANCH) {
    node[LBRANCH] = {
      '/': lebStream.read(HASH_LEN)
    }
  }

  if (prefix & MASK.RBRANCH) {
    node[RBRANCH] = {
      '/': lebStream.read(HASH_LEN)
    }
  }

  if (prefix & MASK.VALUE) {
    node[VALUE] = lebStream.buffer
  }
  return node
}
