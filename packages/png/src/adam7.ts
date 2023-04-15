const pattern = [
    { c: [0], r: [0] },
    { c: [4], r: [0] },
    { c: [0, 4], r: [4] },
    { c: [2, 6], r: [0, 4] },
    { c: [0, 2, 4, 6], r: [2, 6] },
    { c: [1, 3, 5, 7], r: [0, 2, 4, 6] },
    { c: [0, 1, 2, 3, 4, 5, 6, 7], r: [1, 3, 5, 7] }
]

export = function adam7(width: number, height: number) {
    const cols = Array(Math.ceil(width / 8)).fill(0).map((_, x) => x * 8);
    const rows = Array(Math.ceil(height / 8)).fill(0).map((_, y) => y * 8);

    return {
        passes: pattern.map(({ c, r }) => ({
            c: cols.flatMap(x => c.map(w => w + x).filter(w => w < width)),
            r: rows.flatMap(y => r.map(h => h + y).filter(h => h < height))
        })).filter(({ c, r }) => c.length > 0 && r.length > 0),
        interlace(data: number[], channels: number, depth: number) {
            const padWidth = (8 - width * channels * depth % 8) % 8 / depth;
            const coords = this.passes
                .map(({ c, r }) => ({ c: c.concat(Array(padWidth).fill(NaN)), r }))
                .flatMap(({ c, r }) => r.flatMap(y => c.map(x => !Number.isNaN(x) ? [x * channels, y] : [])))
                .flatMap(p => Array(Math.max(p.length / 2 * channels, 1)).fill(0).map((_, b) => p.length > 0 ? [p[0] + b, p[1]] : p));

            return Array(height).fill(Array(width * channels).fill(0)).flatMap((r: number[], y) =>
                r.flatMap((_, x) => data[coords.findIndex(z => z[0] == x && z[1] == y)]));
        }
    }
}
