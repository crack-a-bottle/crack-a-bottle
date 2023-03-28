// I'm actually surprised at how this turned out
import * as assert from "assert";
import { PNGFilter } from ".";

// Reverse the filters that were used on each scanline of the PNG image data.
// This takes the uncompressed data, and reverses the filters used on its scanlines to get the original data.
// To properly identify scanlines, the function needs to know some header info as well.
export function reverse(data: Buffer, { channels, depth, images }:
    Record<"channels" | "depth", number> & Record<"images", Record<"width" | "height", number>[]>) {
    const bpp = channels * depth;
    const scanlines: Buffer[] = [];

    let i = 0;
    for (const { width, height } of images) {
        // The block of image data to scan from, starting from a specified offset in case of Adam7
        const imageData = data.subarray(i, i += width * height);
        // An empty buffer with a length of the image's byte width
        const empty = Buffer.alloc(width - 1);

        // A function to reverse the filter used on the scanline.
        let unfilter: (a: Buffer, b: number, x: number) => Buffer = a => a;
        // For every scanline, do the following
        for (let y = 0; y < height; y++) {
            // The scanline to reverse the filter (at index 0) on.
            const scanline = imageData.subarray(y * width, (y + 1) * width);
            // The sample distance, in bytes
            // If the bit depth is eight or more bits per sample, then compare channel-wise, byte-wise,
            // otherwise just compare byte-wise (Usually this means the filter method is NONE)
            const distance = (!!(depth >> 3) ? bpp : 8) / 8;
            // The previous unfiltered scanline, or an empty one if y is more than zero
            const previous = y > 0 ? scanlines[scanlines.length - 1] : empty;

            // Make sure the filter is valid
            assert.ok(scanline[0] < 5, "IDAT: Unrecognized filter type " + scanline[0]);
            // Get the filter used on the scanline and determine what to do
            switch (scanline[0]) {
                case PNGFilter.NONE: // Least complex filter, leave byte as is
                    unfilter = (a, b, x) => {
                        a.set([b], x);
                        return a;
                    }
                    break;
                case PNGFilter.SUB: // Add the unfiltered left byte to the current filtered byte
                    unfilter = (a, b, x) => {
                        a.set([b + (x >= distance ? a[x - distance] : 0)], x);
                        return a;
                    }
                    break;
                case PNGFilter.UP: // Add the unfiltered upper byte to the current filtered byte
                    unfilter = (a, b, x) => {
                        a.set([b + (y > 0 ? previous[x] : 0)], x);
                        return a;
                    }
                    break;
                case PNGFilter.AVERAGE: // Add the floored mean of the unfiltered left and upper bytes to the current filtered byte
                    unfilter = (a, b, x) => {
                        a.set([b + Math.floor(((x >= distance ? a[x - distance] : 0) + (y > 0 ? previous[x] : 0)) / 2)], x);
                        return a;
                    }
                    break;
                case PNGFilter.PAETH: // Most complex filter, add the byte that is closest to P (A + B - C) to the current filtered byte
                    unfilter = (a, b, x) => {
                        const A = x >= distance ? a[x - distance] : 0;
                        const B = y > 0 ? previous[x] : 0;
                        const C = x >= distance && y > 0 ? previous[x - distance] : 0;

                        // I optimized this by subtracting from both sides lmao
                        const paethA = Math.abs(B - C);         // P - A = A + B - C - A = B - C
                        const paethB = Math.abs(A - C);         // P - B = A + B - C - B = A - C
                        const paethC = Math.abs(A + B - 2 * C); // P - C = A + B - C - C = A + B - 2C

                        switch (Math.min(paethA, paethB, paethC)) {
                            case paethA:
                                a.set([b + A], x);
                                break;
                            case paethB:
                                a.set([b + B], x);
                                break;
                            case paethC:
                            default:
                                a.set([b + C], x);
                                break;
                        }
                        return a;
                    }
                    break;
            }

            // Use TypedArray#reduce to view unfiltered scanline as it is created
            // Push to scanlines array when finished
            scanlines.push(scanline.subarray(1).reduce(unfilter, Buffer.from(empty)));
        }
    }

    // Return unfiltered PNG data
    return Buffer.concat(scanlines);
}
