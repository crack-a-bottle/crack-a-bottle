// Extracts sample values from bytes using their bit depth.
export function extract(data: Buffer, depth: number) {
    const bits = Array(Math.max(8 / depth, 1)).fill(null).map((_, x) => x).reverse();
    const factor = 2 ** depth;
    return data.reduce((a, x, i) => depth <= 8 ? a.concat(bits.map(y => (x >> depth * y) % factor)) :
        (i % 2 == 0 ? a.concat(x << 8) : a.slice(0, -1).concat(a[a.length - 1] | x)), [] as number[]);
}
