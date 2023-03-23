import * as assert from "assert";
import * as zlib from "zlib";
import { EMPTY_BUFFER, SIGNATURE } from "./constants";
import * as crc from "./crc";
import * as filter from "./filter";
import * as util from "./util";

export type PNGChunks = Record<string, any> & {
    bKGD?: number | number[];
    gAMA?: number;
    hIST?: number[];
    pHYs?: { ppuX: number, ppuY: number, specifier: number };
    sRGB?: number;
    tEXt?: { [key: string]: string };
    tIME?: string;
    tRNS?: number | number[];
    zTXt?: { [key: string]: string };
}

export enum PNGFilter { // A is the left byte, B is the upper byte, C is the upper left byte
    NONE = 0, // Leave as is
    SUB = 1, // Subtract/Add the left byte
    UP = 2, // Subtract/Add the upper byte
    AVERAGE = 3, // Subtract/Add the floored mean of the left and upper bytes
    PAETH = 4 // Subtract/Add the byte closest to the absolute value of A + B - C
}

export type PNGHeader = {
    width: number;
    height: number;
    depth: number;
    type: PNGType;
    interlace: boolean;
}

export type PNGPixel = {
    r: number;
    g: number;
    b: number;
    a?: number;
}

export interface PNGStream {
    header: PNGHeader;
    palette?: PNGPixel[];
    data: (PNGPixel | number)[][];
    chunks: PNGChunks;
}

export enum PNGType {
    GRAYSCALE = 0,
    TRUECOLOR = 2,
    INDEX_COLOR = 3,
    GRAYSCALE_ALPHA = 4,
    TRUECOLOR_ALPHA = 6
}

export function png(data: Buffer, check: boolean = true): PNGStream {
    if (!data.subarray(0, 8).equals(SIGNATURE)) throw new SyntaxError("#: Signature not found at start of datastream");

    const json: PNGStream = {
        header: { width: 0, height: 0, depth: 0, type: 0, interlace: false },
        data: [],
        chunks: {}
    }

    let imageData = EMPTY_BUFFER;
    for (let i = 8; i < data.length; i += 12) {
        const chkLength = data.readUInt32BE(i);
        const chkType = data.subarray(i + 4, i + 8).toString();
        const chkData = data.subarray(i + 8, i + chkLength + 8);

        switch (chkType) {
            case "IHDR": // Image header chunk
                if (![1, 2, 4, 8, 16].includes(chkData[8])) throw new SyntaxError(`IHDR: Unrecognized bit depth ${chkData[8]}`);
                if (![0, 2, 3, 4, 6].includes(chkData[9])) throw new SyntaxError(`IHDR: Unsupported color type ${chkData[9]}`);
                if (chkData[12] > 1) throw new SyntaxError(`IHDR: Unsupported interlace method ${chkData[12]}`);

                json.header.width = chkData.readUInt32BE(0);
                json.header.height = chkData.readUint32BE(4);
                json.header.depth = chkData[8];
                json.header.type = chkData[9];
                json.header.interlace = chkData[12] > 0;
                json.data = Array.from({ length: json.header.height }, () => Array(json.header.width));
                break;
            case "PLTE": // Color palette chunk (Required for type 3 only)
                json.palette = util.groupArray(chkData.toJSON().data, 3).map(x => ({ r: x[0], g: x[1], b: x[2] }));
                break;
            case "IDAT": // Compressed image data chunk(s)
                imageData = Buffer.concat([imageData, chkData]);
                break;
            case "IEND": // Image ending chunk
                break;
        }

        const ancillary = util.getBit(chkType.codePointAt(0)!, 5);
        if (ancillary) try {
            const nullIndex = chkData.indexOf(0);
            switch (chkType) {
                case "bKGD": // Background color chunk
                    json.chunks.bKGD = util.getBit(json.header.type, 0) ? chkData[0] : (util.getBit(json.header.type, 1) ?
                            [chkData.readUint16BE(0), chkData.readUint16BE(2), chkData.readUint16BE(4)] :
                            chkData.readUint16BE(0));
                    break;
                case "gAMA": // Gamma chunk
                    json.chunks.gAMA = chkData.readUInt32BE(0) / 100000;
                    break;
                case "hIST": // Gamma chunk
                    json.chunks.hIST = Array.from(new Uint16Array(chkData.buffer));
                    break;
                case "pHYs": // Physical image size chunk
                    json.chunks.pHYs = {
                        ppuX: chkData.readUInt32BE(0),
                        ppuY: chkData.readUInt32BE(4),
                        specifier: chkData[8]
                    }
                    break;
                case "sPLT":
                    json.chunks.sPLT ??= {};
                    json.chunks.sPLT[chkData.subarray(0, nullIndex).toString("latin1")] =
                        chkData[nullIndex + 1] > 8 ? new Uint16Array(chkData.subarray(nullIndex + 2).buffer) : chkData;
                    break;
                case "sRGB": // sRGB intent chunk
                    json.chunks.sRGB = chkData[0];
                    break;
                case "tEXt":
                    json.chunks.tEXt ??= {};
                    json.chunks.tEXt[chkData.subarray(0, nullIndex).toString("latin1")] = chkData.subarray(nullIndex + 1).toString("latin1");
                    break;
                case "tIME":
                    json.chunks.tIME = `${[
                        chkData.readUint16BE(0).toString(),
                        chkData[2].toString().padStart(2, "0"),
                        chkData[3].toString().padStart(2, "0")
                    ].join("-")}T${[
                        chkData[4].toString().padStart(2, "0"),
                        chkData[5].toString().padStart(2, "0"),
                        chkData[6].toString().padStart(2, "0")
                    ].join(":")}+00:00`;
                    break;
                case "tRNS": // Transparent colors chunk
                    json.chunks.tRNS = util.getBit(json.header.type, 0) ? chkData.toJSON().data : (util.getBit(json.header.type, 1) ?
                    [chkData.readUint16BE(0), chkData.readUint16BE(2), chkData.readUint16BE(4)] :
                    chkData.readUint16BE(0));
                    break;
                case "zTXt":
                    json.chunks.zTXt ??= {};
                    json.chunks.zTXt[chkData.subarray(0, nullIndex).toString("latin1")] = zlib.inflateSync(chkData.subarray(nullIndex + 2)).toString("latin1");
                    break;
                default:
                    json.chunks[chkType] = chkData.toJSON().data;
                    break;
            }
        } catch { continue; }

        if (check) {
            try {
                assert.ok(data.readInt32BE(i + chkLength + 8) == crc.check(data.subarray(i + 4, i + chkLength + 8)),
                    `${chkType}: Cyclic redundancy check failed`);
            } catch (err) {
                if (!ancillary) throw err;
            }
        }

        i += chkLength;
    }

    const { width, height, depth, type, interlace } = json.header;

    imageData = zlib.inflateSync(imageData, {
        chunkSize: interlace ? 16384 : Math.max((((width * util.bitsPerPixel(type, depth) + 7) >> 3) + 1) * height, zlib.constants.Z_MIN_CHUNK)
    });
    if (!imageData || !imageData.length) throw new Error("IDAT: Invalid inflate response");
    else imageData = filter.reverse(imageData, json.header);

    const multiplier = 8 / depth;
    json.data = util.groupArray(
        util.groupArray((depth <= 8 ? imageData.reduce((a: number[], x: number, i: number) => [
            ...a.slice(0, i * multiplier),
            ...[7, 6, 5, 4, 3, 2, 1, 0].slice(8 - multiplier).map(y => depth * y).map(y => (x >> y) & (2 ** depth - 1)),
            ...a.slice((i + 1) * multiplier)
        ], Array(imageData.length * multiplier)) : Array.from(new Uint16Array(imageData.buffer))), util.bitsPerPixel(type, 1))
            .map(x => {
                switch (type) {
                    case PNGType.GRAYSCALE: return { r: x[0], g: x[0], b: x[0] };
                    case PNGType.TRUECOLOR: return { r: x[0], g: x[1], b: x[2] };
                    case PNGType.INDEX_COLOR: return x[0];
                    case PNGType.GRAYSCALE_ALPHA: return { r: x[0], g: x[0], b: x[0], a: x[1] };
                    case PNGType.TRUECOLOR_ALPHA: return { r: x[0], g: x[1], b: x[2], a: x[3] };
                }
            }),
        width
    );

    return json;
}
