import * as assert from "assert";
import * as zlib from "zlib";
const { Z_DEFAULT_CHUNK, Z_MIN_CHUNK } = zlib.constants;
import adam7 from "./adam7";
import { bits } from "./bits";
import * as chunks from "./chunks";
import filters from "./filter";

const END_SIGNATURE = Buffer.of(0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130); // 00 00 00 49 45 4E 44 AE 42 60 82
const SIGNATURE = Buffer.of(137, 80, 78, 71, 13, 10, 26, 10); // 89 50 4E 47 0D 0A 1A 0A

export interface PNG {
    width: number;
    height: number;
    depth: number;
    type: PNGType;
    palette?: Record<number, number[]>;
    misc?: {
        bKGD?: number | number[];
        cHRM?: Record<"white" | "red" | "green" | "blue", number[]>;
        gAMA?: number;
        hIST?: Record<number, number[]>;
        pHYs?: Record<"x" | "y" | "unit", number>;
        sBIT?: number | number[];
        sPLT?: Record<string, Record<number, number[]>>;
        sRGB?: number;
        tEXt?: Record<string, string>;
        tIME?: string;
        tRNS?: number | number[];
        zTXt?: Record<string, string>;
    }
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

    const json: PNG = { width: 0, height: 0, depth: 0, type: 0, palette: undefined, misc: undefined, data: [] };
    const misc = { interlace: false, channels: 0 };

    let idat = Buffer.of();
    for (const chunk of chunks.extract(data.subarray(8, data.indexOf(END_SIGNATURE) + 12), checkRedundancy)) {
        switch (chunk.type) {
            case "IHDR":
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
            case "bKGD":
                json.misc ??= {};
                switch (json.type) {
                    case PNGType.GRAYSCALE:
                        json.misc.bKGD = chunk.data.readUInt16BE(0);
                        break;
                    case PNGType.TRUECOLOR:
                        json.misc.bKGD = [chunk.data.readUInt16BE(0), chunk.data.readUInt16BE(2), chunk.data.readUInt16BE(4)];
                        break;
                    case PNGType.INDEX_COLOR:
                        json.misc.bKGD = chunk.data[0];
                        break;
                }
                break;
            case "cHRM":
                json.misc ??= {};
                json.misc.cHRM = {
                    white: [ chunk.data.readUInt32BE(0) / 100000, chunk.data.readUInt32BE(4) / 100000 ],
                    red: [ chunk.data.readUInt32BE(8) / 100000, chunk.data.readUInt32BE(12) / 100000 ],
                    green: [ chunk.data.readUInt32BE(16) / 100000, chunk.data.readUInt32BE(20) / 100000 ],
                    blue: [ chunk.data.readUInt32BE(24) / 100000, chunk.data.readUInt32BE(28) / 100000 ]
                };
                break;
            case "gAMA":
                json.misc ??= {};
                json.misc.gAMA = chunk.data.readUInt32BE(0) / 100000;
                break;
            case "hIST":
                json.misc ??= {};
                json.misc.hIST ??= {};
                chunk.data.reduce((a, x, i) => i % 2 == 0 ? a.concat(x << 8) : (a[a.length - 1] |= x, a), [] as number[])
                    .forEach((x, i) => i % 3 == 0 ? json.misc!.hIST![i / 3] = [x] : json.misc!.hIST![Math.floor(i / 3)].push(x));
                break;
            case "pHYs":
                json.misc ??= {};
                json.misc.pHYs = { x: chunk.data.readUInt32BE(0), y: chunk.data.readUInt32BE(4), unit: chunk.data[8] };
                break;
            case "sBIT":
                json.misc ??= {};
                switch (json.type) {
                    case PNGType.GRAYSCALE:
                        json.misc.sBIT = chunk.data[0];
                        break;
                    case PNGType.TRUECOLOR:
                    case PNGType.INDEX_COLOR:
                        json.misc.sBIT = [chunk.data[0], chunk.data[1], chunk.data[2]];
                        break;
                    case PNGType.GRAYSCALE_ALPHA:
                        json.misc.sBIT = [chunk.data[0], chunk.data[1]];
                        break;
                    case PNGType.TRUECOLOR_ALPHA:
                        json.misc.sBIT = [chunk.data[0], chunk.data[1], chunk.data[2], chunk.data[3]];
                        break;
                }
                break;
            case "sPLT":
                json.misc ??= {};
                json.misc.sPLT ??= {};
                const name = chunk.data.toString("latin1").split("\0")[0];
                json.misc.sPLT[name] = {};
                switch (chunk.data[name.length + 1]) {
                    case 8:
                        chunk.data.subarray(name.length + 2)
                            .reduce((a, x, i) => i % 6 == 0 ? a.concat([[x]]) : (a[a.length - 1].push(x), a), [] as number[][])
                            .forEach((x, i) => json.misc!.sPLT![name][i] =
                                [x[0], x[1], x[2], x[3], x[4] << 8 | x[5]]);
                        break;
                    case 16:
                        chunk.data.subarray(name.length + 2)
                            .reduce((a, x, i) => i % 10 == 0 ? a.concat([[x]]) : (a[a.length - 1].push(x), a), [] as number[][])
                            .forEach((x, i) => json.misc!.sPLT![name][i] =
                                [x[0] << 8 | x[1], x[2] << 8 | x[3], x[4] << 8 | x[5], x[6] << 8 | x[7], x[8] << 8 | x[9]]);
                        break;
                }
                break;
            case "sRGB":
                json.misc ??= {};
                json.misc.sRGB = chunk.data[0];
                break;
            case "tEXt":
                json.misc ??= {};
                json.misc.tEXt ??= {};
                const text = chunk.data.toString("latin1").split("\0");
                json.misc.tEXt[text[0]] = text[1];
                break;
            case "tIME":
                json.misc ??= {};
                json.misc.tIME = `${[
                    chunk.data.readUint16BE(0).toString(10),
                    chunk.data[2].toString(10).padStart(2, "0"),
                    chunk.data[3].toString(10).padStart(2, "0")
                ].join("-")}T${[
                    chunk.data[4].toString(10).padStart(2, "0"),
                    chunk.data[5].toString(10).padStart(2, "0"),
                    chunk.data[6].toString(10).padStart(2, "0")
                ].join(":")}+00:00`;
                break;
            case "tRNS":
                json.misc ??= {};
                switch (json.type) {
                    case PNGType.GRAYSCALE:
                        json.misc.tRNS = chunk.data.readUInt16BE(0);
                        break;
                    case PNGType.TRUECOLOR:
                        json.misc.tRNS = [chunk.data.readUInt16BE(0), chunk.data.readUInt16BE(2), chunk.data.readUInt16BE(4)];
                        break;
                    case PNGType.INDEX_COLOR:
                        json.misc.tRNS = chunk.data.toJSON().data;
                        break;
                }
                break;
            case "zTXt":
                json.misc ??= {};
                json.misc.zTXt ??= {};
                const ztext = chunk.data.toString("latin1").split("\0");
                json.misc.zTXt[ztext[0]] = zlib.inflateSync(chunk.data.subarray(ztext[0].length + 2)).toString("latin1");
                break;
            case "IDAT":
                idat = Buffer.concat([idat, chunk.data]);
                break;
            case "IEND":
                const { width, height, depth } = json;
                const { interlace, channels } = misc;
                const adam = interlace ? adam7(width, height) : {
                    passes: [{ c: Array(width), r: Array(height) }],
                    interlace: (x: number[]) => x
                }
                const bit = bits(channels, depth);
                const images = adam.passes.map(({ c, r }) => ({ width: c.length, height: r.length }));

                idat = zlib.inflateSync(idat, {
                    chunkSize: interlace ? Z_DEFAULT_CHUNK : Math.max((bit.byteWidth(width) + 1) * height, Z_MIN_CHUNK)
                });
                if (!idat || !idat.length) throw new SyntaxError("IDAT: Invalid inflate response");
                const bitmap = bit.extract(filters(images, bit).reverse(idat), images);

                json.data = adam.interlace(bitmap, channels, depth).reduce((a, x, i) => {
                    if (i % width == 0) a.push([]);
                    return a[a.length - 1].push(x), a;
                }, [] as number[][]);
                break;
        }
    }

    return json;
}

png.END_SIGNATURE = END_SIGNATURE.toString("latin1");
png.SIGNATURE = SIGNATURE.toString("latin1");
