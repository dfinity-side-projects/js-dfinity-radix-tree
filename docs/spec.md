This is a simple Binary [Radix Tree](https://ipfs.io/ipns/QmdJiuMWp2FxyaerfLrtdLF6Nr1EWpL7dPAxA9oKSPYYgV/wiki/Radix_tree.html). 
The default encodeing used is [cbor](http://cbor.io/) and the default hashing
algorithim used is sha2-256.


## Node
Each node is an variable length array containing at the most four elements 
"left branch", "right branch" "extension", "value"

```
node : = [LBRANCH, RBRANCH, EXTENSION, VALUE]
```

If no value exists at a given node the array is truncated to

```
node : = [LBRANCH, RBRANCH, EXTENSION]
```

If no value and no extension exists at a given node the array is truncated to

```
node : = [LBRANCH, RBRANCH]
```

All empty values in the array are encoded as "undefined".
An emty tree is defined as `{}`

## Branches

Each link points to the next node in the tree.
```
branch : = <merkle link>
```
Where the link is a [CID](https://github.com/ipld/cid) is encoded as a byte string.
Using CIDs allow for the flexablity to update the hashing algorithim and encoding
at a later date while being backwards compatiable.

## Extensions
Extensions encode shared paths. Extensions are defined as
```
extension := [length, extension]

```
Where the length is an interger and the extension is a byte string padded with
0's

For example if the binary keys [0, 0, 1, 1] and
[0, 0, 1, 0] have a shared path of [0, 0]. If they where the only two values in 
the tree the root node would have an extension of [0, 0]

```
root := [undefined, <link>, [2, 0x00]]
```


