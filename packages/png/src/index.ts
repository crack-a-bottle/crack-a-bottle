import * as assert from "assert";
import * as zlib from "zlib";
import adam7 from "./adam7";
import bit from "./bits";
import * as chunks from "./chunks";
import filters from "./filter";

export const END_SIGNATURE = Buffer.of(0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130);
export const SIGNATURE = Buffer.of(137, 80, 78, 71, 13, 10, 26, 10);

export interface PNG {
    width: number;
    height: number;
    depth: number;
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

    const json: PNG = { width: 0, height: 0, depth: 0, type: 0, palette: undefined, data: [] };
    const misc = { interlace: false, channels: 0 };
    const end = data.indexOf(END_SIGNATURE) + 12;

    let imageData = Buffer.of();
    for (const [o, chunk] of chunks.extract(data.subarray(8, end), checkRedundancy).entries()) {
        switch (chunk.type) {
            case "IHDR": { // Image header chunk
                assert.strictEqual(o, 0, "IHDR: Header chunk cannot be after another chunk");
                assert.strictEqual(chunk.data.length, 13, "IHDR: Header chunk must be 13 bytes long");

                const width = chunk.data.readUInt32BE(0);
                assert.notStrictEqual(width, 0, "IHDR: Image width cannot be less than one");
                const height = chunk.data.readUInt32BE(4);
                assert.notStrictEqual(height, 0, "IHDR: Image height cannot be less than one");

                const depth = chunk.data[8];
                assert.ok(DEPTHS.includes(depth), "IHDR: Invalid bit depth " + depth);
                const type = chunk.data[9];
                assert.ok(TYPES.includes(type), "IHDR: Invalid color type " + type);
                switch (type) {
                    case PNGType.TRUECOLOR:
                        assert.strictEqual(depth % 8, 0, "IHDR: Truecolor bit depth cannot be lower than 8 bits");
                        break;
                    case PNGType.INDEX_COLOR:
                        assert.strictEqual(depth % 16, depth, "IHDR: Indexed color bit depth cannot be higher than 8 bits");
                        break;
                    case PNGType.GRAYSCALE_ALPHA:
                        assert.strictEqual(depth % 8, 0, "IHDR: Grayscale alpha bit depth cannot be lower than 8 bits");
                        break;
                    case PNGType.TRUECOLOR_ALPHA:
                        assert.strictEqual(depth % 8, 0, "IHDR: Truecolor alpha bit depth cannot be lower than 8 bits");
                        break;
                }

                assert.strictEqual(chunk.data[10], 0, "IHDR: Unsupported compression method");
                assert.strictEqual(chunk.data[11], 0, "IHDR: Unsupported filter method");
                const interlace = chunk.data[12];
                assert.strictEqual(interlace % 2, interlace, "IHDR: Unsupported interlace method");

                json.width = width;
                json.height = height;
                json.depth = depth;
                json.type = type;
                misc.channels = 1 + 2 * (type & 1 ^ 1) * (type >> 1 & 1) + (type >> 2 & 1);
                misc.interlace = !!interlace;
                break;
            }
            case "PLTE": {// Color palette chunk (Required for type 3 only)
                json.palette ??= {};
                chunk.data.forEach((x, i) => i % 3 == 0 ? json.palette![i / 3] = [x] : json.palette![Math.floor(i / 3)].push(x));
                break;
            }
            case "IDAT": { // Compressed image data chunk(s)
                imageData = Buffer.concat([imageData, chunk.data]);
                break;
            }
            case "IEND": { // Image ending chunk (After ALL chunks are parsed, parse the image data)
                const { width, height, depth } = json;
                const { interlace, channels } = misc;
                const bpp = { channels, depth };
                const bits = bit(bpp);

                imageData = zlib.inflateSync(imageData, { chunkSize:
                    Math.max(interlace ? zlib.constants.Z_DEFAULT_CHUNK : (bits.byteWidth(width) + 1) * height, zlib.constants.Z_MIN_CHUNK) });
                if (!imageData || !imageData.length) throw new SyntaxError("IDAT: Invalid inflate response");

                const images = (interlace ? adam7(width, height).passes : [{
                    c: Array(width).fill(0).map((_, x) => x),
                    r: Array(height).fill(0).map((_, y) => y)
                }]).map(({ c, r }) => ({ c: c.concat(Array(bits.padWidth(c.length)).fill(NaN)), r }));
                const bitmap = bits.extract(filters(images.map(({ c: { length: w }, r: { length: h } }) =>
                    ({ width: bits.byteWidth(w), height: h })), bpp).reverse(imageData));

                const coords = images.flatMap(({ c, r }) => r.flatMap(y => c.map(x => !Number.isNaN(x) ? [x * channels, y] : [])))
                    .flatMap(p => Array(Math.max(p.length / 2 * channels, 1)).fill(0).map((_, b) => p.length > 0 ? [p[0] + b, p[1]] : p));
                json.data = Array(height).fill(Array(width * channels).fill(0)).map((r: number[], y) =>
                    r.flatMap((_, x) => bitmap[coords.findIndex(z => z[0] == x && z[1] == y)]));
                break;
            }
        }
    }

    return json;
}
