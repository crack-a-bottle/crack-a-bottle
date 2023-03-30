// I'm actually surprised at how this turned out
import * as assert from "assert";
import { PNGFilter } from ".";

// Returns methods to manipulate PNG data using filters.
// This takes the uncompressed data and a list of images in it, and also the number of channels per pixel and the number of bits per channel.
export = function filters(data: Buffer, images: Record<"width" | "height", number>[],
    { channels, depth }: Record<"channels" | "depth", number>) {
    // An empty buffer. Yep, that's about it.
    const empty = Buffer.of();
    // The byte length between filter channels.
    // If the bit depth is eight or more bits per channel, then compare channel-wise, byte-wise, otherwise just compare byte-wise
    // (Usually this would mean the filter method is NONE, as there is assumed to be no byte correlation)
    const length = Math.max((depth >> 3) * channels, 1);

    // Creates and returns a function to reverse the specified filter.
    function reverseFilter(filter: PNGFilter, previous: Buffer) {
        // Make sure the filter is valid
        assert.ok(filter < 5, "IDAT: Unrecognized filter type " + filter);

        // Determine function by checking filter (See what I did here)
        switch (filter) {
            case PNGFilter.NONE: // Least complex filter, leave byte (X) as is
                return (X: number, x: number, a: Uint8Array) => {
                    return a.set([X], x), a[x];
                }
            case PNGFilter.SUB: // Add the unfiltered left byte (A) to the current filtered byte (X)
                return (X: number, x: number, a: Uint8Array) => {
                    const A = a[x - length] ?? 0;
                    return a.set([X + A], x), a[x];
                }
            case PNGFilter.UP: // Add the unfiltered upper byte (B) to the current filtered byte (X)
                return (X: number, x: number, a: Uint8Array) => {
                    const B = previous[x] ?? 0;
                    return a.set([X + B], x), a[x];
                }
            case PNGFilter.AVERAGE: // Add the floored mean of the unfiltered left (A) and upper (B) bytes to the current filtered byte (X)
                return (X: number, x: number, a: Uint8Array) => {
                    const A = a[x - length] ?? 0;
                    const B = previous[x] ?? 0;
                    return a.set([X + Math.floor((A + B) / 2)], x), a[x];
                }
            case PNGFilter.PAETH: // Most complex filter, add the byte that is closest to P (A + B - C) to the current filtered byte (X)
                return (X: number, x: number, a: Uint8Array) => {
                    const A = a[x - length] ?? 0;
                    const B = previous[x] ?? 0;
                    const C = previous[x - length] ?? 0;

                    // I optimized this by subtracting from both sides lmao
                    const paethA = Math.abs(B - C);         // P - A = A + B - C - A = B - C
                    const paethB = Math.abs(A - C);         // P - B = A + B - C - B = A - C
                    const paethC = Math.abs(A + B - 2 * C); // P - C = A + B - C - C = A + B - 2C
                    switch (Math.min(paethA, paethB, paethC)) {
                        case paethA:
                            return a.set([X + A], x), a[x];
                        case paethB:
                            return a.set([X + B], x), a[x];
                        case paethC:
                        default:
                            return a.set([X + C], x), a[x];
                    }
                }
        }
    }

    return {
        // Reverse the filters that were used on each scanline of the PNG image data.
        reverse() {
            // The data offset of the current image
            let i = 0;
            // For each image, reverse scanline filters and append to data buffer
            return images.reduce((a, { width, height }) =>
                (a = Buffer.concat([ a, ...Array(height).fill(empty).map((_, y, s) => {
                    const o = i + y * width;
                    return s.splice(y, 1, Buffer.from(data.subarray(o + 1, o + width))
                        .map(reverseFilter(data[o], s[y - 1] ?? empty))), s[y];
                }) ]), i += width * height, a), empty);
        }
    }
}
