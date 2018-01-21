This documnet provides the structure of the [Dfinity's Radix Tree.](https://ipfs.io/ipns/QmdJiuMWp2FxyaerfLrtdLF6Nr1EWpL7dPAxA9oKSPYYgV/wiki/Radix_tree.html). 
Our radix tree data structure stores the key-valus; the tree nsists of Nodes that contains the value and the key is the path to the node in the tree.

## Node
Each node has a type and contains at most four elements: 
"extension", "left branch", "right branch" and "value".

```
node : = TYPE | EXTENSION | LBRANCH | RBRANCH | VALUE
```

### Type
The type feild contains a byte. The first 4 bits are paded to zero while the Node is stored in the tree. These bits are reserved as insicators of type when sending the nodes to other clients which we will describe later. The last 4 bits are used to signify which elements a node contains. The bit field is defined a the following

```
Type := 0 | 0 | 0 | 0 | HasEXTENSION | HasLBRANCH | HasRBRANCH | HasVALUE
```

For example a node that contained a left branch and a value would have a prefix byte of 00000101 or 0x07

The full encoded node would then look something like. `0x07<20_bytes_for_lbranch><remaing_bytes_for_value>` 


### Branches

The branch elements point to the next node in the tree using a merkle link.
A merkle link is defined by the first 20 bytes of the result SHA2-256 of an encoded node.


```
branch : = <merkle link>
```

```
link := SHA2(encoded_node)[0..20]
```


### Extensions
For optimization, we use the Extension element that encodes shared paths in the tree. Extensions are defined as

```
extension := Length | ExtensionValue

```
Where the length is the number of bits that extension repesents. This varuint32
encoded with leb128. And the extension is bit array padded with 0's to the nearst byte. 

For example if the binary keys [0, 0, 1, 1] and
[0, 0, 1, 0] have a shared path of [0, 0, 1]. The extension node would therefor be

`0x03, 0x04`

where 3 is the the shared path length and the `0x04` is the shared path encoded
as a little endian byte array.

## Examples

An empty tree has a merkle root which is a hash of sha256(0x00) or `6e340b9cffb37a989ca544e6bb780a2c78901d3f`.


A tree with a single node with key 'binary' and value of 'tree' is encoded as

```
0x093062696e61727974726565

0x09 this node has an extention and value
0x30 the extention has a length of 48 bits or 6 bytes
0x62696e617279 the key 'binary'
0x4726565 the value 'tree'
```

If we add another key-value with the key "bin" and the value "number" to the tree, the tree will have two nodes

The root node will be

```
0x0b1862696eaf39aa98eb0350611f230cbeb2e68dbe95ab5ecc6e756d626572

0xb this node has an extention, a right branch and a value
0x18 this the extention has a length of 24 bits
0x62696e the value extention "bin"
0xaf39aa98eb0350611f230cbeb2e68dbe95ab5ecc a merkle link to another node
0x6e756d626572 the value "number"

the link 0xaf39aa98eb0350611f230cbeb2e68dbe95ab5ecc points to the node

0x091730b93c74726565

0x09 this node has an extention and value
0x17 this the extention has a length of 23 bits
0x30b93c the extention 'ary' = 0x617279 that is shift left one bit. 'a' is 0x61 which
is read 100001100 (little endian) The was first bit is was used to choose the branch (right)
turns into 0x30 (110000)
```
