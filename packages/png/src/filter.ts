// I'm actually surprised at how this turned out
import { PNGFilter, type PNGHeader } from ".";
import * as adam7 from "./adam7";
import * as util from "./util";

// Reverse the filters that were used on each scanline of the PNG image data.
// This takes the inflated data, and reverses the filters used on its scanlines to get the original data.
// To properly identify scanlines, the function needs to take the PNG datastream header as well.
export function reverse(data: Buffer, { width, height, type, depth, interlace }: PNGHeader) {
    const scanlines: Buffer[] = [];
    const bpp = util.bitsPerPixel(type, depth / 8);
    const images: { byteWidth: number; imageHeight: number; }[] = interlace ?
        adam7.passes(width, height).map(x => ({ byteWidth: Math.ceil(x.width * bpp), imageHeight: x.height })) :
        [{ byteWidth: Math.ceil(width * bpp), imageHeight: height }];

    let i = 0;
    for (const { byteWidth, imageHeight } of images) {
        // The block of image data to scan from, starting from a specified offset, in case of Adam7
        const imageData = data.subarray(i, i += (byteWidth + 1) * imageHeight);
        // An empty buffer with a length of the image's byte width
        const empty = Buffer.alloc(byteWidth);

        for (let y = 0; y < imageHeight; y++) {
            // The filter method used on this scanline.
            const filter = imageData[y * (byteWidth + 1)];
            // A function to reverse the filter.
            let unfilterByte: (x: number, a?: number, b?: number, c?: number) => number;
            switch (filter) {
                case PNGFilter.NONE:    // Least complex filter, leave byte as is
                    unfilterByte = (x: number, a = 0, b = 0, c = 0) => x;
                    break;
                case PNGFilter.SUB:     // Add the unfiltered left byte to the current filtered byte
                    unfilterByte = (x: number, a = 0, b = 0, c = 0) => x + a;
                    break;
                case PNGFilter.UP:      // Add the unfiltered upper byte to the current filtered byte
                    unfilterByte = (x: number, a = 0, b = 0, c = 0) => x + b;
                    break;
                case PNGFilter.AVERAGE: // Add the floored mean of the unfiltered left and upper bytes to the current filtered byte
                    unfilterByte = (x: number, a = 0, b = 0, c = 0) => x + Math.floor((a + b) / 2);
                    break;
                case PNGFilter.PAETH:   // Most complex filter, add the byte that is closest to P (equal to A + B - C) to the current filtered byte.
                    unfilterByte = (x: number, a = 0, b = 0, c = 0) => { // I optimized this by subtracting from both sides lmao
                        const paethA = Math.abs(b - c);         // P - A = A + B - C - A = B - C
                        const paethB = Math.abs(a - c);         // P - B = A + B - C - B = A - C
                        const paethC = Math.abs(a + b - 2 * c); // P - C = A + B - C - C = A + B - 2C

                        // Check if P - A is less than/equal to P - B AND less than/equal to P - C, add A, if not,
                        // check if P - B is less than/equal to P - C, add B, otherwise add C
                        return x + ((paethA <= paethB && paethA <= paethC) ? a : ((paethB <= paethC) ? b : c));
                    }
                    break;
                default:
                    throw new RangeError(`IDAT: Unrecognized filter type ${filter}`);
            }

            // If depth is eight or more bits per channel, then compare channel-wise, byte-wise,
            // otherwise just compare byte-wise (Usually this means the filter method is NONE)
            const distance = depth >> 3 > 0 ? bpp : 1;
            // The previous unfiltered scanline, if y is more than zero
            const previous = y > 0 ? scanlines[scanlines.length - 1] : empty;

            // Use TypedArray#reduce to view unfiltered scanline as it is created
            // Push to scanlines array when finished
            scanlines.push(imageData.subarray(y * (byteWidth + 1) + 1, (y + 1) * (byteWidth + 1)).reduce((l, c, x) => Buffer.concat([
                l.subarray(0, x),
                Buffer.of(unfilterByte(
                    c,
                    x >= distance ? l[x - distance] : 0,
                    y > 0 ? previous[x] : 0,
                    x >= distance && y > 0 ? previous[x - distance] : 0
                )),
                l.subarray(x + 1)
            ]), empty));
        }
    }

    // Return unfiltered PNG data
    return Buffer.concat(scanlines);
}
