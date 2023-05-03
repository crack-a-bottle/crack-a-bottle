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
        interlace(data: number[], channels: number) {
            const coords = this.passes
                .flatMap(({ c, r }) => r.flatMap(y => c.map(x => [x * channels, y])))
                .flatMap(([ x, y ]) => Array(channels).fill([]).map((_, b) => [x + b, y]));

            return Array<number[]>(height).fill(Array(width * channels).fill(0)).flatMap((r, y) =>
                r.flatMap((_, x) => data[coords.findIndex(z => z[0] == x && z[1] == y)]));
        }
    }
}
