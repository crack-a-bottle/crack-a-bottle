export const BPP_MAP = [1, 0, 3, 1, 2, 0, 4];
export const INTERLACE_PASSES = [
    { x: [0], y: [0] },
    { x: [4], y: [0] },
    { x: [0, 4], y: [4] },
    { x: [2, 6], y: [0, 4] },
    { x: [0, 2, 4, 6], y: [2, 6] },
    { x: [1, 3, 5, 7], y: [0, 2, 4, 6] },
    { x: [0, 1, 2, 3, 4, 5, 6, 7], y: [1, 3, 5, 7] }
];
export const SIGNATURE = String.fromCodePoint(137, 80, 78, 71, 13, 10, 26, 10);