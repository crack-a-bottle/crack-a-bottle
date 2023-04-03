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
        assert.ok(filter < 5, "IDAT: Unrecognized filter type " + filter);

        // Determine function by checking filter (See what I did here)
        switch (filter) {
            case PNGFilter.NONE: // Least complex filter, leave byte (X) as is
                return (X: number, x: number, a: number[]) => {
                    return a[x] = X & 255;
                }
            case PNGFilter.SUB: // Add the unfiltered left byte (A) to the current filtered byte (X)
                return (X: number, x: number, a: number[]) => {
                    const A = a[x - length] ?? 0;
                    return a[x] = X + A & 255;
                }
            case PNGFilter.UP: // Add the unfiltered upper byte (B) to the current filtered byte (X)
                return (X: number, x: number, a: number[]) => {
                    const B = previous[x] ?? 0;
                    return a[x] = X + B & 255;
                }
            case PNGFilter.AVERAGE: // Add the floored mean of the unfiltered left (A) and upper (B) bytes to the current filtered byte (X)
                return (X: number, x: number, a: number[]) => {
                    const A = a[x - length] ?? 0;
                    const B = previous[x] ?? 0;
                    return a[x] = X + Math.floor((A + B) / 2) & 255;
                }
            case PNGFilter.PAETH: // Most complex filter, add the byte that is closest to P (A + B - C) to the current filtered byte (X)
                return (X: number, x: number, a: number[]) => {
                    const A = a[x - length] ?? 0;
                    const B = previous[x] ?? 0;
                    const C = previous[x - length] ?? 0;

                    // I optimized this by subtracting from both sides lmao
                    const paethA = Math.abs(B - C);         // P - A = A + B - C - A = B - C
                    const paethB = Math.abs(A - C);         // P - B = A + B - C - B = A - C
                    const paethC = Math.abs(A + B - 2 * C); // P - C = A + B - C - C = A + B - 2C
                    switch (Math.min(paethA, paethB, paethC)) {
                        case paethA:
                            return a[x] = X + A & 255;
                        case paethB:
                            return a[x] = X + B & 255;
                        case paethC:
                        default:
                            return a[x] = X + C & 255;
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
            return Buffer.from(images.map(({ width, height }) => ({ width: width + 1, height }))
                .reduce((image: number[], { width, height }) =>
                image.concat(Array(height).fill([]).map((_, y, lines) => {
                    const [ f, ...l ] = data.subarray(o, o += width);
                    return lines[y] = l.map(reverseFilter(f, lines[y - 1] ?? empty));
                }).flat()), []));
        }
    }
}
