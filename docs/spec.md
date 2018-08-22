This document provides the structure of the [Dfinity Radix Tree.](https://ipfs.io/ipns/QmdJiuMWp2FxyaerfLrtdLF6Nr1EWpL7dPAxA9oKSPYYgV/wiki/Radix_tree.html)
The radix tree data structure stores the key-values; the tree is an instance of nodes that contains the value and the key is the path to the node in the tree. All values are encoded with [CBOR](http://cbor.io)

## Node
Each node has a type and contains at most four elements:
"extension", "left branch", "right branch" and "value".

```
node : = TYPE | EXTENSION | LBRANCH | RBRANCH | VALUE
```

### Type
The type field contains a byte. The first 4 bits are padded to zero while the Node is stored in the tree. These bits are reserved as indicators of type when sending the nodes to other clients which we will describe later. The last 4 bits are used to signify which elements a node contains. The bit field is defined a the following

```
Type := 0 | 0 | 0 | 0 | HasEXTENSION | HasLBRANCH | HasRBRANCH | HasVALUE
```

For example a node that contained a left branch and a value would have a prefix byte of 00000101 or 0x07

The full encoded node would then look something like. `0x07<20_bytes_for_lbranch><remaing_bytes_for_value>`


### Branches

The branch elements point to the next node in the tree using a merkle link.
A merkle link is defined by a 20 byte BLAKE2s hash of an encoded node.


```
branch : = <merkle link>
```

```
link := BLAKE2s(encoded_node, 20)
```


### Extensions
For optimization, we use the Extension element that encodes shared paths in the tree. Extensions are defined as

```
extension := Length | ExtensionValue

```
Where the length is the number of bits that extension represents. This varuint32
encoded with leb128. And the extension is bit array padded with 0's to the nearest byte.

For example if the binary keys [0, 0, 1, 1] and
[0, 0, 1, 0] have a shared path of [0, 0, 1]. The extension node would therefor be

`0x03, 0x04`

where 3 is the the shared path length and the `0x04` is the shared path encoded
as a little endian byte array.
