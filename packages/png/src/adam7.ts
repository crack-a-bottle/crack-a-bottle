// Adam7 interlace algorithm (Implementing this was torturous)
const pattern = [
    { x: [0], y: [0] },
    { x: [4], y: [0] },
    { x: [0, 4], y: [4] },
    { x: [2, 6], y: [0, 4] },
    { x: [0, 2, 4, 6], y: [2, 6] },
    { x: [1, 3, 5, 7], y: [0, 2, 4, 6] },
    { x: [0, 1, 2, 3, 4, 5, 6, 7], y: [1, 3, 5, 7] }
]

// Get the non-interlaced coordinates of each pixel in the image, ordered by interlace position.
export function coords(width: number, height: number) {
    return pattern.flatMap(({ x, y }) => {
        const rows = Array.from({ length: Math.ceil(width / 8) }, (_, i) => x.map(v => v + i * 8).filter(v => v < width)).flat();
        const columns = Array.from({ length: Math.ceil(height / 8) }, (_, i) => y.map(v => v + i * 8).filter(v => v < height)).flat();
        return columns.flatMap(c => rows.map(r => [r, c]));
    }, []);
}

// Get the width and height of each interlace pass.
export function passes(width: number, height: number) {
    return pattern.map(({ x, y }) => ({
        width: Math.floor(width / 8) * x.length + x.filter(v => v < width % 8).length,
        height: Math.floor(height / 8) * y.length + y.filter(v => v < height % 8).length
    })).filter(p => p.width > 0 && p.height > 0);
}
