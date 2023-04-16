export type Bits = {
    channels: number;
    depth: number;
    byteWidth(width: number): number;
    extract(data: number[], images: Record<"width" | "height", number>[]): number[];
}

export function bits(channels: number, depth: number): Bits {
    const bpp = channels * depth;
    return {
        channels,
        depth,
        byteWidth(width: number) {
            return Math.ceil(width * bpp / 8);
        },
        extract(data: number[], images: Record<"width" | "height", number>[]) {
            if (depth <= 8) {
                const bitArray = [7, 6, 5, 4, 3, 2, 1, 0].slice(8 - 8 / depth).map(x => depth * x);
                const max = 2 ** depth - 1;
                const result = data.reduce((a, x) => a.concat(bitArray.map(y => (x >> y) & max)), [] as number[]);
                let i = 0;
                for (const { width, height } of images) {
                    const padWidth = (8 - width * bpp % 8) % 8 / depth;
                    Array(height).fill(0).forEach(() => result.splice(i += width * channels, padWidth));
                }
                return result;
            } else return data.reduce((a, x, i) => i % 2 == 0 ? a.concat(x << 8) : (a[a.length - 1] |= x, a), [] as number[]);
        }
    }
}
