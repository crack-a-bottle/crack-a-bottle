import * as assert from "assert";
import * as zlib from "zlib";
import * as adam7 from "./adam7";
import * as crc from "./crc";
import * as filter from "./filter";
import * as util from "./util";

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

export function png(data: Buffer, checkRedundancy: boolean = true) {
    assert.deepStrictEqual(SIGNATURE, data.subarray(0, 8), "Start signature not found");

    const json: PNG = { width: 0, height: 0, type: 0, palette: undefined, data: [] };
    const info = { depth: 0, interlace: false, channels: 0 };

    let imageData = Buffer.of();
    for (let i = 8; i < data.length; i += 12) {
        const cLength = data.readUInt32BE(i);
        const cType = data.subarray(i + 4, i + 8).toString();
        const chunk = data.subarray(i + 8, i + cLength + 8);

        if (checkRedundancy) assert.strictEqual(crc.check(data.subarray(i + 4, i + cLength + 8)), data.readUint32BE(i + cLength + 8),
            cType + ": Cyclic redundancy check failed");

        switch (cType) {
            case "IHDR": { // Image header chunk
                const width = chunk.readUInt32BE(0);
                assert.ok(width > 0, "IHDR: Image width cannot be less than one");
                const height = chunk.readUInt32BE(4);
                assert.ok(height > 0, "IHDR: Image height cannot be less than one");
                const depth = chunk[8];
                assert.ok([1, 2, 4, 8, 16].includes(depth), "IHDR: Invalid bit depth " + depth);
                const type = chunk[9];
                assert.ok([0, 2, 3, 4, 6].includes(type), "IHDR: Invalid color type " + type);
                const channels = 1 + 2 * (type & 1 ^ 1) * (type >> 1 & 1) + (type >> 2 & 1);
                assert.strictEqual(chunk[10], 0, "IHDR: Unsupported compression method");
                assert.strictEqual(chunk[11], 0, "IHDR: Unsupported filter method");
                const interlace = chunk[12];
                assert.ok(interlace < 2, "IHDR: Unsupported interlace method " + interlace);

                json.width = width;
                json.height = height;
                json.type = type;

                info.channels = channels;
                info.depth = depth;
                info.interlace = !!interlace;

                json.data = util.fill(height, Array(width * channels));
                break;
            }
            case "PLTE": {// Color palette chunk (Required for type 3 only)
                json.palette = { ...util.groupArray(chunk.toJSON().data, 3) };
                break;
            }
            case "IDAT": { // Compressed image data chunk(s)
                imageData = Buffer.concat([imageData, chunk]);
                break;
            }
            case "IEND": { // Image ending chunk (After ALL chunks are parsed, parse the image data)
                const { width, height } = json;
                const { depth, interlace, channels } = info;
                const byteWidth = width * channels;

                imageData = zlib.inflateSync(imageData, {
                    chunkSize: interlace ?
                        zlib.constants.Z_DEFAULT_CHUNK :
                        Math.max((((width * channels * depth + 7) >> 3) + 1) * height, zlib.constants.Z_MIN_CHUNK)
                });
                if (!imageData || !imageData.length) throw new Error("IDAT: Invalid inflate response");
                else imageData = filter.reverse(imageData, { width, height, depth, channels, interlace });

                const bitmap = depth <= 8 ?
                    imageData.toJSON().data.flatMap(x => util.fill(depth / 8, y => (x >> depth * y) % 2 ** depth).reverse()) :
                    imageData.toJSON().data.map((x, j) => j % 2 == 0 ? ((x << 8) | imageData[j + 1]) : null).filter((x): x is number => x != null);
                if (interlace) {
                    const coords = adam7.coords(width, height).map(x => [x[0] * channels, x[1]]);
                    json.data = util.groupArray(util.fill(byteWidth * height, x => {
                        const j = coords.findIndex(y => y[0] == x % byteWidth && y[1] == Math.floor(x / byteWidth));
                        return bitmap.slice(j, j + channels);
                    }).flat(), byteWidth);
                } else json.data = util.groupArray(bitmap, byteWidth);

                break;
            }
        }

        i += cLength;
    }

    return json;
}
