// Cyclic redundancy table (Auto-generated because ughhhh)
const table = Array(256).fill(Array(8).fill(0)).map((x: number[], i) => x.reduce(c => ((c & 1) * 3988292384) ^ (c >>> 1), i) >>> 0);

// Cyclic redundancy checker (In case of inaccuracies)
export = function crc(data: Buffer) {
    return ~data.reduce((c, x) => table[(c ^ x) & 255] ^ (c >>> 8), -1) >>> 0;
}
