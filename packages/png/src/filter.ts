// I'm actually surprised at how this turned out
import { PNGFilter } from ".";
import * as adam7 from "./adam7";

// Reverse the filters that were used on each scanline of the PNG image data.
// This takes the uncompressed data, and reverses the filters used on its scanlines to get the original data.
// To properly identify scanlines, the function needs to know some header info as well.
export function reverse(data: Buffer, { width, height, channels, depth, interlace }:
    Record<"width" | "height" | "channels" | "depth", number> & Record<"interlace", boolean>) {
    const bpp = channels * depth / 8;
    const images = interlace ?
        adam7.passes(width, height).map(x => ({ byteWidth: Math.ceil(x.width * bpp) + 1, imageHeight: x.height })) :
        [{ byteWidth: Math.ceil(width * bpp) + 1, imageHeight: height }];
    const scanlines: Buffer[] = [];

    let i = 0;
    for (const { byteWidth, imageHeight } of images) {
        // The block of image data to scan from, starting from a specified offset in case of Adam7
        const imageData = data.subarray(i, i += byteWidth * imageHeight);
        // An empty buffer with a length of the image's byte width
        const empty = Buffer.alloc(byteWidth - 1);

        // A function to reverse the filter used on the scanline.
        let unfilter: (x: number, a?: number, b?: number, c?: number) => number;
        // For every scanline, do the following
        for (let y = 0; y < imageHeight; y++) {
            // The scanline to reverse the filter (at index 0) on.
            const scanline = imageData.subarray(y * byteWidth, (y + 1) * byteWidth);
            // Get the filter used on the scanline and determine what to do
            switch (scanline[0]) {
                case PNGFilter.NONE:    // Least complex filter, leave byte (X) as is
                    unfilter = (x, a = 0, b = 0, c = 0) => x;
                    break;
                case PNGFilter.SUB:     // Add the unfiltered left byte (A) to the current filtered byte (X)
                    unfilter = (x, a = 0, b = 0, c = 0) => x + a;
                    break;
                case PNGFilter.UP:      // Add the unfiltered upper byte (B) to the current filtered byte (X)
                    unfilter = (x, a = 0, b = 0, c = 0) => x + b;
                    break;
                case PNGFilter.AVERAGE: // Add the floored mean of the unfiltered left (A) and upper bytes (B) to the current filtered byte (X)
                    unfilter = (x, a = 0, b = 0, c = 0) => x + Math.floor((a + b) / 2);
                    break;
                case PNGFilter.PAETH:   // Most complex filter, add the byte that is closest to P (A + B - C) to the current filtered byte (X)
                    unfilter = (x, a = 0, b = 0, c = 0) => {
                        // I optimized this by subtracting from both sides lmao
                        const paethA = Math.abs(b - c);         // P - A = A + B - C - A = B - C
                        const paethB = Math.abs(a - c);         // P - B = A + B - C - B = A - C
                        const paethC = Math.abs(a + b - 2 * c); // P - C = A + B - C - C = A + B - 2C

                        switch (Math.min(paethA, paethB, paethC)) {
                            case paethA:
                                return x + a;
                            case paethB:
                                return x + b;
                            case paethC:
                            default:
                                return x + c;
                        }
                    }
                    break;
                default:
                    throw new RangeError(`IDAT: Unrecognized filter type ${scanline[0]}`);
            }

            // The sample distance, in bytes
            // If the bit depth is eight or more bits per sample, then compare channel-wise, byte-wise,
            // otherwise just compare byte-wise (Usually this means the filter method is NONE)
            const distance = !!(depth >> 3) ? bpp : 1;
            // The previous unfiltered scanline, or an empty one if y is more than zero
            const previous = y > 0 ? scanlines[scanlines.length - 1] : empty;

            // Use TypedArray#reduce to view unfiltered scanline as it is created
            // Push to scanlines array when finished
            scanlines.push(Buffer.from(scanline.subarray(1).reduce((a, b, x) => [
                a.slice(0, x),
                unfilter(b, x >= distance ? a[x - distance] : 0, y > 0 ? previous[x] : 0, x >= distance && y > 0 ? previous[x - distance] : 0),
                a.slice(x + 1)
            ], Array(byteWidth - 1))));
        }
    }

    // Return unfiltered PNG data
    return Buffer.concat(scanlines);
}
