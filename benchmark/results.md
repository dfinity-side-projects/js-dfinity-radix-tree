This compares the binary radix tree's proof to Ethereum tree. The proofs where
encoded in cbor and compressed with gzip. Etherum's proof where encoded using
rlp. The compressed results for Ethereum where not recoded since they where
larger then the uncompressed proofs

## 10000 keys
### Binary Radix Tree
```
cbor 660 bytes
compressed size 572
```

### Ethereum
```
rlp 1649 bytes
```

Diff 65%

## 20000 keys
### Binary Radix Tree
```
cbor 705 bytes
compressed size 607
```

### Ethereum
```
rlp 1772 bytes
```

Diff 66%

## 30000 keys
### Binary Radix Tree
```
cbor 731 bytes
compressed 628 size
```

### Ethereum
```
rlp 1829 bytes
```

Diff 66%

## 40000 keys
### Binary Radix Tree
```
cbor 749 bytes
compressed 643 size
```

### Ethereum
```
rlp 1876 bytes
```

Diff 66%

## 50000 keys
### Binary Radix Tree
```
cbor 764 bytes
compressed 654 size
```

### Ethereum
```
rlp 1917 bytes
```

Diff 66%

## 60000 keys
### Binary Radix Tree
```
cbor 776 bytes
compressed 663 size
```

### Ethereum
```
rlp 1956 bytes
```

## 70000 keys
### Binary Radix Tree
```
cbor 786 bytes
compressed 671 size
```

### Ethereum
```
rlp 1990 bytes
```

Diff 66%

## 80000 keys
### Binary Radix Tree
```
cbor 795 bytes
compressed 679 size
```

### Ethereum
```
rlp 2021 bytes
```

Diff 66%

## 90000 keys
### Binary Radix Tree
```
cbor 803 bytes
compressed 685 size
```

### Ethereum
```
rlp 2050 bytes
```

Diff 67%

## 100000 keys
### Binary Radix Tree
```
cbor 810 bytes
compressed 691 size
```

### Ethereum
```
rlp 2075 bytes
```

Diff 67%

# multikey
The following show that multikey are more compact the single key proofs . Each
tree was populated with 10000 keys

## Two Keys Proofs
```
cbor 1088
compressed 916
```

## Three Keys Proofs
```
cbor 1675
compressed 1381
```
## Four Keys Proofs
```
cbor 2221
compressed 1801
```
