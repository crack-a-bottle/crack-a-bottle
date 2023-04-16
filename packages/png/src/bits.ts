export = function bits(channels: number, depth: number) {
    const bpp = channels * depth;
    return {
        byteWidth(width: number) {
            return Math.ceil(width * bpp / 8);
        },
        extract(data: Buffer) {
            const bitArray = [7, 6, 5, 4, 3, 2, 1, 0].slice(8 - 8 / depth).map((_, x) => depth * x);
            const max = 2 ** depth - 1;
            return depth <= 8 ? data.reduce((a, x) => a.concat(bitArray.map(y => (x >> y) & max)), [] as number[]) :
                data.reduce((a, x, i) => i % 2 == 0 ? a.concat(x << 8) : (a[a.length - 1] |= x, a), [] as number[]);
        },
        padWidth(width: number) {
            return (8 - width * bpp % 8) % 8 / depth;
        }
    }
}
