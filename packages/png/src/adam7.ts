// Adam7 interlace algorithm (Implementing this was torturous, until it wasn't)

// The interlace pattern used in the Adam7 algorithm.
const pattern = [
    { x: [0], y: [0] },
    { x: [4], y: [0] },
    { x: [0, 4], y: [4] },
    { x: [2, 6], y: [0, 4] },
    { x: [0, 2, 4, 6], y: [2, 6] },
    { x: [1, 3, 5, 7], y: [0, 2, 4, 6] },
    { x: [0, 1, 2, 3, 4, 5, 6, 7], y: [1, 3, 5, 7] }
]

// Get info on each interlace pass of an image.
export = function adam7(width: number, height: number) {
    const passesX = Array(Math.ceil(width / 8)).fill(0).map((_, x) => x);
    const passesY = Array(Math.ceil(height / 8)).fill(0).map((_, y) => y);

    return {
        passes: pattern.map(({ x, y }) => ({
            x: passesX.flatMap(c => x.map(w => w + c * 8).filter(w => w < width)),
            y: passesY.flatMap(r => y.map(h => h + r * 8).filter(h => h < height))
        })).filter(({ x, y }) => x.length > 0 && y.length > 0)
    }
}
