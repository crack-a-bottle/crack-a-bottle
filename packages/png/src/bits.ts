import { PNGType } from ".";

// Extracts sample values from bytes using their bit depth.
export function extract(data: Buffer, { depth, type }: { depth: number; type: PNGType }) {
    const bits = Array(Math.floor(8 / depth)).fill(0).map((_, x) => x).reverse();
    const max = 2 ** depth;
    const factor = type != PNGType.INDEX_COLOR ? (255 / (max - 1)) : 1;
    return data.reduce((a: number[], x, i) => depth <= 8 ?
        a.concat(bits.map(y => (x >> depth * y) % max * factor)) :
        (i % 2 == 0 ? a.concat(x << 8) : a.slice(0, -1).concat(a[a.length - 1] | x)), []);
}
