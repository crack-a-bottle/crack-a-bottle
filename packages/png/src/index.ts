import * as assert from "assert";
import * as zlib from "zlib";
import adam7 from "./adam7";
import * as bits from "./bits";
import crc from "./crc";
import * as filter from "./filter";

export const END_SIGNATURE = Buffer.of(0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130);
export const SIGNATURE = Buffer.of(137, 80, 78, 71, 13, 10, 26, 10);

export interface PNG {
    width: number;
    height: number;
    type: PNGType;
    palette?: Record<number, number[]>;
    data: number[][];
}

export enum PNGFilter {
    NONE = 0,
    SUB = 1,
    UP = 2,
    AVERAGE = 3,
    PAETH = 4
}

export enum PNGType {
    GRAYSCALE = 0,
    TRUECOLOR = 2,
    INDEX_COLOR = 3,
    GRAYSCALE_ALPHA = 4,
    TRUECOLOR_ALPHA = 6
}

const DEPTHS = [1, 2, 4, 8, 16];
const TYPES = [0, 2, 3, 4, 6];

export function png(data: Buffer, checkRedundancy: boolean = true) {
    assert.deepStrictEqual(SIGNATURE, data.subarray(0, 8), "Start signature not found");
    assert.ok(data.includes(END_SIGNATURE), "End signature not found");

    const json: PNG = { width: 0, height: 0, type: 0, palette: undefined, data: [] };
    const info = { depth: 0, interlace: false, channels: 0 };
    const end = data.indexOf(END_SIGNATURE) + 12;

    let imageData = Buffer.of();
    for (let i = 8; i < end; i += 12) {
        const cLength = data.readUInt32BE(i);
        const cType = data.subarray(i + 4, i + 8).toString();
        const chunk = data.subarray(i + 8, i + cLength + 8);

        if (checkRedundancy) assert.strictEqual(crc(data.subarray(i + 4, i + cLength + 8)), data.readUint32BE(i + cLength + 8),
            cType + ": Cyclic redundancy check failed");

        switch (cType) {
            case "IHDR": { // Image header chunk
                assert.strictEqual(i, 8, "IHDR: Header chunk cannot be after another chunk");
                assert.strictEqual(cLength, 13, "IHDR: Header chunk cannot be longer or shorter than 13 bytes");

                const width = chunk.readUInt32BE(0);
                assert.ok(width > 0, "IHDR: Image width cannot be less than one");

                const height = chunk.readUInt32BE(4);
                assert.ok(height > 0, "IHDR: Image height cannot be less than one");

                const depth = chunk[8];
                assert.ok(DEPTHS.includes(depth), "IHDR: Invalid bit depth " + depth);

                const type = chunk[9];
                assert.ok(TYPES.includes(type), "IHDR: Invalid color type " + type);

                assert.strictEqual(chunk[10], 0, "IHDR: Unsupported compression method");
                assert.strictEqual(chunk[11], 0, "IHDR: Unsupported filter method");

                const interlace = chunk[12];
                assert.ok(interlace < 2, "IHDR: Unsupported interlace method " + interlace);

                json.width = width;
                json.height = height;
                json.type = type;
                info.channels = 1 + 2 * (type & 1 ^ 1) * (type >> 1 & 1) + (type >> 2 & 1);
                info.depth = depth;
                info.interlace = !!interlace;
                break;
            }
            case "PLTE": {// Color palette chunk (Required for type 3 only)
                json.palette ??= {};
                chunk.reduce((a: number[][], x, j) => j % 3 == 0 ? a.concat([[x]]) :
                    a.slice(0, -1).concat([a[a.length - 1].concat(x)]), []).forEach((x, j) => json.palette![j] = x);
                break;
            }
            case "IDAT": { // Compressed image data chunk(s)
                imageData = Buffer.concat([imageData, chunk]);
                break;
            }
            case "IEND": { // Image ending chunk (After ALL chunks are parsed, parse the image data)
                const { width, height, type } = json;
                const { depth, interlace, channels } = info;
                const sampleDepth = channels * depth;
                const bitWidth = width * sampleDepth;

                imageData = zlib.inflateSync(imageData, {
                    chunkSize: interlace ? zlib.constants.Z_DEFAULT_CHUNK :
                        Math.max(((bitWidth + 7 >> 3) + 1) * height, zlib.constants.Z_MIN_CHUNK)
                });
                if (!imageData || !imageData.length) throw new Error("IDAT: Invalid inflate response");

                const passes = (interlace ? adam7(width, height).passes : [{
                    x: Array(width).fill(0).map((_, x) => x),
                    y: Array(height).fill(0).map((_, y) => y),
                }]);
                const bitmap = bits.extract(filter.reverse(imageData, passes.map(({ x, y }) => ({
                    width: (x.length * sampleDepth + 7 >> 3) + 1,
                    height: y.length
                })), { ...info }), { depth, type });

                const coords = passes.map(({ x, y }) => ({
                    x: x.concat(Array((8 - (x.length * sampleDepth % 8 || 8)) / depth).fill(NaN)),
                    y })).flatMap(({ x, y }) => y.flatMap(r => x.map(c => [c, r])));
                json.data = Array(height).fill(Array(width).fill(0)
                    .concat(Array((8 - (bitWidth % 8 || 8)) / depth).fill(NaN)))
                    .map((r: number[], y) => r
                        .flatMap((c, x) => Number.isNaN(c) ? [NaN] :
                            bitmap.slice(coords.findIndex(z => z[0] == x && z[1] == y) * channels).slice(0, channels))
                        .filter(x => !Number.isNaN(x)));
                break;
            }
        }

        i += cLength;
    }

    return json;
}
