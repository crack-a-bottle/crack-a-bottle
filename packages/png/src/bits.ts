export = function bits({ channels, depth }: Record<"channels" | "depth", number>) {
    const bpp = channels * depth;
    return {
        byteWidth(width: number) {
            return width * bpp + 7 >>> 3;
        },
        extract(data: Buffer) {
            const bitArray = [7, 6, 5, 4, 3, 2, 1, 0].slice(8 - 8 / depth).map((_, x) => depth * x);
            const max = 2 ** depth - 1;
            return depth <= 8 ? data.reduce((a: number[], x) =>
                a.concat(bitArray.map(y => (x >> y) & max)), []) : data.reduce((a: number[], x, i) =>
                i % 2 == 0 ? a.concat(x << 8) : (a[a.length - 1] |= x, a), []);
        },
        padWidth(width: number) {
            return (8 - width * bpp % 8) / depth;
        }
    }
}
