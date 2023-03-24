const pattern = [
    { x: [0], y: [0] },
    { x: [4], y: [0] },
    { x: [0, 4], y: [4] },
    { x: [2, 6], y: [0, 4] },
    { x: [0, 2, 4, 6], y: [2, 6] },
    { x: [1, 3, 5, 7], y: [0, 2, 4, 6] },
    { x: [0, 1, 2, 3, 4, 5, 6, 7], y: [1, 3, 5, 7] }
]

export function interlace(width: number, height: number) {
    const passWidth = Math.ceil(width / 8);
    const passHeight = Math.ceil(height / 8);

    const result: number[][] = [];
    for (let i = 0; i < pattern.length; i++) {
        const pass = pattern[i];
        for (let y = 0; y < passHeight; y++) {
            for (let x = 0; x < passWidth; x++) {
                result.push(...pass.y.filter(z => ((y + 1) >= passHeight && height % 8 > 0) ? (z < height % 8) : (z == z))
                    .flatMap(p => pass.x.filter(q => ((x + 1) >= passWidth && width % 8 > 0) ? (q < width % 8) : (q == q)).map(q => [q + x * 8, p + y * 8])));
            }
        }
    }

    return result;
}

export function passes(width: number, height: number) {
    return pattern.map(({ x, y }) => ({
        width: Math.floor(width / 8) * x.length + x.filter(c => c < width % 8).length,
        height: Math.floor(height / 8) * y.length + y.filter(c => c < height % 8).length,
        coords: [],
    })).filter(p => p.width > 0 && p.height > 0);
}

export function position(width: number, x: number, y: number, index: number) {
    const pass = pattern[index];
    return (Math.floor(x / pass.x.length) * 8 + pass.x[x % pass.x.length]) * 4 +
        (Math.floor(y / pass.y.length) * 8 + pass.y[y % pass.y.length]) * width * 4;
}
