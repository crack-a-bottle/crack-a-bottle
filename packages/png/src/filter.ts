import * as assert from "assert";
import { PNGFilter } from ".";
import type { Bits } from "./bits";

export = function filters(images: Record<"width" | "height", number>[], bit: Bits) {
    const empty = Buffer.of();
    const length = Math.max((bit.depth >> 3) * bit.channels, 1);

    function reverseFilter(filter: PNGFilter, previous: number[]): (x: number, i: number, r: number[]) => number {
        assert.strictEqual(filter % 5, filter, "IDAT: Unrecognized filter type");

        switch (filter) {
            case PNGFilter.NONE:
                return (x, i, r) => {
                    return r[i] = x & 255;
                }
            case PNGFilter.SUB:
                return (x, i, r) => {
                    const a = r[i - length] ?? 0;
                    return r[i] = x + a & 255;
                }
            case PNGFilter.UP:
                return (x, i, r) => {
                    const b = previous[i] ?? 0;
                    return r[i] = x + b & 255;
                }
            case PNGFilter.AVERAGE:
                return (x, i, r) => {
                    const a = r[i - length] ?? 0;
                    const b = previous[i] ?? 0;
                    return r[i] = x + Math.floor((a + b) / 2) & 255;
                }
            case PNGFilter.PAETH:
                return (x, i, r) => {
                    const a = r[i - length] ?? 0;
                    const b = previous[i] ?? 0;
                    const c = previous[i - length] ?? 0;

                    const paethA = Math.abs(b - c);
                    const paethB = Math.abs(a - c);
                    const paethC = Math.abs(a + b - 2 * c);
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
        reverse(data: Buffer) {
            let o = 0;
            return Buffer.from(images.flatMap(({ width, height }) =>
                Array(height).fill([]).flatMap((_, i, r) => {
                    const [ f, ...l ] = data.subarray(o, o += bit.byteWidth(width) + 1);
                    return r[i] = l.map(reverseFilter(f, r[i - 1] ?? empty));
                })));
        }
    }
}
