// I'm actually surprised at how this turned out
import { PNGFilter, type PNGHeader } from ".";
import { getPassLength, IMAGE_PASSES as passes } from "./adam7";
import * as util from "./util";

// Reverse the filters that were used on each scanline of the PNG image data.
// This takes the inflated data, and reverses the filters used on its scanlines to get the original data.
// To properly identify scanlines, the function needs to take the PNG datastream header as well.
export function reverse(data: Buffer, { width, height, type, depth, interlace }: PNGHeader) {
    const scanlines: Buffer[] = [];
    const bpp = util.bitsPerPixel(type, depth) / 8;
    const images: { byteWidth: number; imageHeight: number; offset: number; }[] = [];

    if (interlace) {
        for (const [i, pass] of passes.entries()) {
            const byteWidth = Math.ceil(getPassLength(width, pass.x) * bpp);
            const imageHeight = getPassLength(height, pass.y);

            if (byteWidth > 0 && imageHeight > 0) {
                const prevImage = images[i - 1] ?? { byteWidth: 0, imageHeight: 0, offset: 0 };
                images.push({ byteWidth, imageHeight, offset: (prevImage.byteWidth + 1) * prevImage.imageHeight });
            }
        }
    } else images.push({ byteWidth: Math.ceil(width * bpp), imageHeight: height, offset: 0 });

    for (const { byteWidth, imageHeight, offset } of images) {
        // The block of image data to scan from, starting from a specified offset, in case of Adam7
        const imageData = data.subarray(offset, offset + ((byteWidth + 1) * imageHeight));
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

            // If depth is less than eight bits per pixel, then compare pixel-wise, byte-wise,
            // otherwise just compare byte-wise (Usually this means the filter method is NONE)
            const filterLength = depth >> 3 > 0 ? bpp : 1;
            // The previous unfiltered scanline, if y is more than zero
            const lastLine = y > 0 ? scanlines[scanlines.length - 1] : empty;

            // The unfiltered scanline, initialized as an exact copy of the filtered scanline
            // Use Array#reduce to view unfiltered scanline as it is created
            const scanline = imageData.subarray(y * (byteWidth + 1) + 1, (y + 1) * (byteWidth + 1)).reduce((line, byte, x) => {
                line.set([unfilterByte(
                    byte,
                    x >= filterLength ? line[x - filterLength] : 0,
                    y > 0 ? lastLine[x] : 0,
                    x >= filterLength && y > 0 ? lastLine[x - filterLength] : 0
                )], x);
                return line;
            }, Buffer.alloc(byteWidth));
            scanlines.push(scanline);
        }
    }

    return Buffer.concat(scanlines);
}
