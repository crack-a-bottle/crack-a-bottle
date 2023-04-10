import * as assert from "assert";
import * as zlib from "zlib";
import adam7 from "./adam7";
import bit from "./bits";
import * as chunks from "./chunks";
import filters from "./filter";

const END_SIGNATURE = Buffer.of(0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130);
const SIGNATURE = Buffer.of(137, 80, 78, 71, 13, 10, 26, 10);

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
    assert.deepStrictEqual(data.subarray(0, 8), SIGNATURE, "Start signature not found");
    assert.notStrictEqual(data.indexOf(END_SIGNATURE), -1, "End signature not found");

    const json: PNG = { width: 0, height: 0, depth: 0, type: 0, palette: undefined, data: [] };
    const misc = { interlace: false, channels: 0 };

    let imageData = Buffer.of();
    for (const [o, chunk] of chunks.extract(data.subarray(8, data.indexOf(END_SIGNATURE) + 12), checkRedundancy).entries()) {
        switch (chunk.type) {
            case "IHDR":
                assert.strictEqual(o, 0, "IHDR: Header chunk cannot be after another chunk");
                assert.strictEqual(chunk.data.length, 13, "IHDR: Header chunk must be 13 bytes long");

                json.width = chunk.data.readUInt32BE(0);
                assert.notStrictEqual(json.width, 0, "IHDR: Image width cannot be less than one");
                json.height = chunk.data.readUInt32BE(4);
                assert.notStrictEqual(json.height, 0, "IHDR: Image height cannot be less than one");

                json.depth = chunk.data[8];
                assert.ok(DEPTHS.includes(json.depth), "IHDR: Invalid bit depth " + json.depth);
                json.type = chunk.data[9];
                assert.ok(TYPES.includes(json.type), "IHDR: Invalid color type " + json.type);
                switch (json.type) {
                    case PNGType.TRUECOLOR:
                        assert.strictEqual(json.depth % 8, 0, "IHDR: Truecolor bit depth cannot be lower than 8 bits");
                        break;
                    case PNGType.INDEX_COLOR:
                        assert.strictEqual(json.depth % 16, json.depth, "IHDR: Indexed color bit depth cannot be higher than 8 bits");
                        break;
                    case PNGType.GRAYSCALE_ALPHA:
                        assert.strictEqual(json.depth % 8, 0, "IHDR: Grayscale alpha bit depth cannot be lower than 8 bits");
                        break;
                    case PNGType.TRUECOLOR_ALPHA:
                        assert.strictEqual(json.depth % 8, 0, "IHDR: Truecolor alpha bit depth cannot be lower than 8 bits");
                        break;
                }

                assert.strictEqual(chunk.data[10], 0, "IHDR: Unsupported compression method");
                assert.strictEqual(chunk.data[11], 0, "IHDR: Unsupported filter method");
                assert.strictEqual(chunk.data[12] % 2, chunk.data[12], "IHDR: Unsupported interlace method");

                misc.channels = 1 + 2 * (json.type & 1 ^ 1) * (json.type >> 1 & 1) + (json.type >> 2 & 1);
                misc.interlace = !!chunk.data[12];
                break;
            case "PLTE":
                json.palette ??= {};
                chunk.data.forEach((x, i) => i % 3 == 0 ? json.palette![i / 3] = [x] : json.palette![Math.floor(i / 3)].push(x));
                break;
            case "IDAT":
                imageData = Buffer.concat([imageData, chunk.data]);
                break;
            case "IEND":
                const { width, height, depth } = json;
                const { interlace, channels } = misc;
                const bpp = { channels, depth };
                const bits = bit(bpp);
                const imageCoords = (interlace ? adam7(width, height).passes : [{
                    c: Array(width).fill(0).map((_, x) => x),
                    r: Array(height).fill(0).map((_, y) => y)
                }]).map(({ c, r }) => ({ c: c.concat(Array(bits.padWidth(c.length)).fill(NaN)), r }));
                const images = imageCoords.map(({ c, r }) => ({ width: bits.byteWidth(c.length), height: r.length }));

                imageData = zlib.inflateSync(imageData, { chunkSize:
                    Math.max(images.reduce((a, x) => a + (x.width + 1) * x.height, 0), zlib.constants.Z_MIN_CHUNK) });
                if (!imageData || !imageData.length) throw new SyntaxError("IDAT: Invalid inflate response");
                const bitmap = bits.extract(filters(images, bpp).reverse(imageData));

                const coords = imageCoords.flatMap(({ c, r }) => r.flatMap(y => c.map(x => !Number.isNaN(x) ? [x * channels, y] : [])))
                    .flatMap(p => Array(Math.max(p.length / 2 * channels, 1)).fill(0).map((_, b) => p.length > 0 ? [p[0] + b, p[1]] : p));
                json.data = Array(height).fill(Array(width * channels).fill(0)).map((r: number[], y) =>
                    r.flatMap((_, x) => bitmap[coords.findIndex(z => z[0] == x && z[1] == y)]));
                break;
        }
    }

    return json;
}
png.END_SIGNATURE = END_SIGNATURE.toString("latin1");
png.SIGNATURE = SIGNATURE.toString("latin1");
