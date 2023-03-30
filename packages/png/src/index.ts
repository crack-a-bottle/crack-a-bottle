import * as assert from "assert";
import * as zlib from "zlib";
import adam7 from "./adam7";
import bit from "./bits";
import crc from "./crc";
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
    const info = { interlace: false, channels: 0 };
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
                assert.strictEqual(cLength, 13, "IHDR: Header chunk must be 13 bytes long");

                const width = chunk.readUInt32BE(0);
                assert.notStrictEqual(width, 0, "IHDR: Image width cannot be less than one");
                const height = chunk.readUInt32BE(4);
                assert.notStrictEqual(height, 0, "IHDR: Image height cannot be less than one");
                const depth = chunk[8];
                assert.ok(DEPTHS.includes(depth), "IHDR: Invalid bit depth " + depth);
                const type = chunk[9];
                assert.ok(TYPES.includes(type), "IHDR: Invalid color type " + type);
                switch (type) {
                    case PNGType.TRUECOLOR:
                        assert.strictEqual(depth % 8, 0, "IHDR: Truecolor bit depth cannot be lower than 8 bits");
                    case PNGType.INDEX_COLOR:
                        assert.strictEqual(depth % 16, depth, "IHDR: Indexed color bit depth cannot be higher than 8 bits");
                    case PNGType.GRAYSCALE_ALPHA:
                        assert.strictEqual(depth % 8, 0, "IHDR: Grayscale alpha bit depth cannot be lower than 8 bits");
                    case PNGType.TRUECOLOR_ALPHA:
                        assert.strictEqual(depth % 8, 0, "IHDR: Truecolor alpha bit depth cannot be lower than 8 bits");
                }

                assert.strictEqual(chunk[10], 0, "IHDR: Unsupported compression method");
                assert.strictEqual(chunk[11], 0, "IHDR: Unsupported filter method");
                const interlace = chunk[12];
                assert.strictEqual(interlace % 2, interlace, "IHDR: Unsupported interlace method");

                json.width = width;
                json.height = height;
                json.depth = depth;
                json.type = type;
                info.channels = 1 + 2 * (type & 1 ^ 1) * (type >> 1 & 1) + (type >> 2 & 1);
                info.interlace = !!interlace;
                break;
            }
            case "PLTE": {// Color palette chunk (Required for type 3 only)
                json.palette ??= {};
                chunk.forEach((x, j) => j % 3 == 0 ? json.palette![j / 3] = [x] : json.palette![Math.floor(j / 3)].push(x));
                break;
            }
            case "IDAT": { // Compressed image data chunk(s)
                imageData = Buffer.concat([imageData, chunk]);
                break;
            }
            case "IEND": { // Image ending chunk (After ALL chunks are parsed, parse the image data)
                const { width, height, depth } = json;
                const { interlace, channels } = info;
                const bits = bit({ channels, depth });

                imageData = zlib.inflateSync(imageData, {
                    chunkSize: interlace ? zlib.constants.Z_DEFAULT_CHUNK :
                        Math.max(bits.byteWidth(width) * height, zlib.constants.Z_MIN_CHUNK)
                });
                if (!imageData || !imageData.length) throw new Error("IDAT: Invalid inflate response");

                const images = (interlace ? adam7(width, height).passes : [{
                    x: Array(width).fill(0).map((_, x) => x),
                    y: Array(height).fill(0).map((_, y) => y)
                }]).map(({ x, y }) => ({ x: x.concat(Array(bits.padWidth(x.length)).fill(NaN)), y }));
                const bitmap = bits.extract(filters(imageData, images.map(({ x, y }) => ({
                    width: bits.byteWidth(x.length),
                    height: y.length
                })), { channels, depth }).reverse());

                const coords = images.flatMap(({ x, y }) => y.flatMap(r => x.map(c => !Number.isNaN(c) ? [c, r] : [])));
                json.data = Array(height).fill(Array(width + bits.padWidth(width)).fill(0))
                    .map((r: number[], y) => r.flatMap((_, x) => x < width ?
                        bitmap.slice(coords.findIndex(z => z[0] == x && z[1] == y) * channels).slice(0, channels) : []));
                break;
            }
        }

        i += cLength;
    }

    return json;
}
