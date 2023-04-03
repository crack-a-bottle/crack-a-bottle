// I'm actually surprised at how this turned out
import * as assert from "assert";
import { PNGFilter } from ".";

// Returns methods to manipulate PNG data using filters.
// This takes a list of images in the data, and also the number of channels per pixel and the number of bits per channel.
export = function filters(images: Record<"width" | "height", number>[], { channels, depth }: Record<"channels" | "depth", number>) {
    // An empty buffer. Yep, that's about it.
    const empty = Buffer.of();
    // The byte length between filter channels.
    // If the bit depth is eight or more bits per channel, then compare channel-wise, byte-wise, otherwise just compare byte-wise
    // (Usually this would mean the filter method is NONE, as there is assumed to be no byte correlation)
    const length = Math.max((depth >> 3) * channels, 1);

    // Creates and returns a function to reverse the specified filter.
    function reverseFilter(filter: PNGFilter, previous: number[]) {
        // Make sure the filter is valid
        assert.strictEqual(filter % 5, filter, "IDAT: Unrecognized filter type");

        // Determine function by checking filter (See what I did here)
        switch (filter) {
            case PNGFilter.NONE: // Least complex filter, leave byte (X) as is
                return (x: number, i: number, r: number[]) => {
                    return r[i] = x & 255;
                }
            case PNGFilter.SUB: // Add the unfiltered left byte (A) to the current filtered byte (X)
                return (x: number, i: number, r: number[]) => {
                    const a = r[i - length] ?? 0;
                    return r[i] = x + a & 255;
                }
            case PNGFilter.UP: // Add the unfiltered upper byte (B) to the current filtered byte (X)
                return (x: number, i: number, r: number[]) => {
                    const b = previous[i] ?? 0;
                    return r[i] = x + b & 255;
                }
            case PNGFilter.AVERAGE: // Add the floored mean of the unfiltered left (A) and upper (B) bytes to the current filtered byte (X)
                return (x: number, i: number, r: number[]) => {
                    const a = r[i - length] ?? 0;
                    const b = previous[i] ?? 0;
                    return r[i] = x + Math.floor((a + b) / 2) & 255;
                }
            case PNGFilter.PAETH: // Most complex filter, add the byte that is closest to P (A + B - C) to the current filtered byte (X)
                return (x: number, i: number, r: number[]) => {
                    const a = r[i - length] ?? 0;
                    const b = previous[i] ?? 0;
                    const c = previous[i - length] ?? 0;

                    // I optimized this by subtracting from both sides lmao
                    const paethA = Math.abs(b - c);         // P - A = A + B - C - A = B - C
                    const paethB = Math.abs(a - c);         // P - B = A + B - C - B = A - C
                    const paethC = Math.abs(a + b - 2 * c); // P - C = A + B - C - C = A + B - 2C
                    switch (Math.min(paethA, paethB, paethC)) {
                        case paethA:
                            return r[i] = x + a & 255;
                        case paethB:
                            return r[i] = x + b & 255;
                        case paethC:
                        default:
                            return r[i] = x + c & 255;
                    }
                }
        }
    }

    return {
        // Reverse the filters that were used on each scanline of the sepcified PNG image data.
        reverse(data: Buffer) {
            // The data offset of the current image
            let o = 0;
            // For each image, reverse scanline filters and append to image data
            return Buffer.from(images.reduce((image: number[], { width, height }) =>
                image.concat(Array(height).fill([]).flatMap((_, i, r) => {
                    const [ f, ...l ] = data.subarray(o, o += width + 1);
                    return r[i] = l.map(reverseFilter(f, r[i - 1] ?? empty));
                })), []));
        }
    }
}
