import * as zlib from "zlib";
import { EMPTY_BUFFER, SIGNATURE } from "./constants";
import { CRC } from "./crc";
import * as filter from "./filter";
import * as util from "./util";

export interface BasePNGStream {
    header: PNGHeader;
    palette?: Buffer;
    data: PNGData;
    chunks: PNGChunks;
}

export type PNGChunks = {
    bKGD?: number | Uint16Array;
    gAMA?: number;
    hIST?: Uint16Array;
    pHYs?: { ppuX: number, ppuY: number, specifier: number };
    sRGB?: number;
    tEXt?: { [key: string]: string };
    tIME?: string;
    tRNS?: number | Uint16Array | Buffer;
    zTXt?: { [key: string]: string };
    [key: string]: any;
}

export type PNGData = {
    original: Buffer | Uint16Array;
    filtered: Buffer;
    compressed: Buffer;
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

export type PNGObject = {
    header: PNGHeader;
    palette?: number[];
    chunks: {
        bKGD?: number | number[];
        gAMA?: number;
        hIST?: number[];
        pHYs?: { ppuX: number, ppuY: number, specifier: number };
        sRGB?: number;
        tEXt?: { [key: string]: string };
        tIME?: string;
        tRNS?: number | number[];
        zTXt?: { [key: string]: string };
        [key: string]: any;
    }
    data: {
        compressed: number[];
        filtered: number[];
        original: number[];
    }
}

export interface PNGStream extends BasePNGStream {
    toJSON(): PNGObject;
}

export enum PNGType {
    GRAYSCALE = 0,
    TRUECOLOR = 2,
    INDEX_COLOR = 3,
    GRAYSCALE_ALPHA = 4,
    TRUECOLOR_ALPHA = 6
}

class PNG implements PNGStream {
    public header: PNGHeader;
    public palette?: Buffer;
    public data: PNGData;
    public chunks: PNGChunks;

    public constructor(data: BasePNGStream) {
        this.header = data.header;
        if (data.palette) this.palette = data.palette;
        this.data = data.data;
        this.chunks = data.chunks;
    }

    public toJSON(): PNGObject {
        return {
            header: this.header,
            palette: this.palette ? this.palette.toJSON().data : undefined,
            chunks: util.map((x, y) => [y, util.checkArray(x)], this.chunks),
            data: {
                compressed: util.checkArray(this.data.compressed),
                filtered: util.checkArray(this.data.filtered),
                original: util.checkArray(this.data.original),
            }
        }
    }
}

export function png(data: Buffer, checkCRC: boolean = false): PNGStream {
    if (!data.subarray(0, 8).equals(SIGNATURE)) throw new SyntaxError("#: Signature not found at start of datastream");

    const json: BasePNGStream = {
        header: { width: 0, height: 0, depth: 0, type: 0, interlace: false },
        data: { original: EMPTY_BUFFER, filtered: EMPTY_BUFFER, compressed: EMPTY_BUFFER },
        chunks: {}
    }
    for (let i = 8; i < data.length; i += 12) {
        const chkLength = data.readUInt32BE(i);
        const chkType = data.subarray(i + 4, i + 8).toString("ascii");
        const chkData = data.subarray(i + 8, i + chkLength + 8);

        const crc = checkCRC ? new CRC() : null;
        if (checkCRC) {
            crc!.write(Buffer.from(chkType));
            crc!.write(chkData);
        }

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
                break;
            case "PLTE": // Color palette chunk (Required for type 3 only)
                json.palette = chkData;
                break;
            case "IDAT": // Compressed image data chunk(s)
                json.data.compressed = Buffer.concat([json.data.compressed, chkData]);
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
                            Uint16Array.of(chkData.readUint16BE(0), chkData.readUint16BE(2), chkData.readUint16BE(4)) :
                            chkData.readUint16BE(0));
                    break;
                case "gAMA": // Gamma chunk
                    json.chunks.gAMA = chkData.readUInt32BE(0) / 100000;
                    break;
                case "hIST": // Gamma chunk
                    json.chunks.hIST = new Uint16Array(chkData.buffer);
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
                    json.chunks.tRNS = util.getBit(json.header.type, 0) ? chkData : (util.getBit(json.header.type, 1) ?
                    Uint16Array.of(chkData.readUint16BE(0), chkData.readUint16BE(2), chkData.readUint16BE(4)) :
                    chkData.readUint16BE(0));
                    break;
                case "zTXt":
                    json.chunks.zTXt ??= {};
                    json.chunks.zTXt[chkData.subarray(0, nullIndex).toString("latin1")] = zlib.inflateSync(chkData.subarray(nullIndex + 2)).toString("latin1");
                    break;
                default:
                    json.chunks[chkType] = chkData;
                    break;
            }
        } catch { continue; }

        if (checkCRC) {
            const chkCRC = data.readInt32BE(i + chkLength + 8);
            const calcCRC = crc!.read();
            if (chkCRC != calcCRC && !ancillary) throw new Error(`${chkType}: CRC failed (expected 0x${chkCRC.toString(16)}, got 0x${calcCRC.toString(16)})`);
        }

        i += chkLength;
    }

    const { width, height, depth, type, interlace } = json.header;

    json.data.filtered = zlib.inflateSync(json.data.compressed, {
        chunkSize: interlace ? 16384 : Math.max((((width * util.bitsPerPixel(type, depth) + 7) >> 3) + 1) * height, zlib.constants.Z_MIN_CHUNK)
    });
    if (!json.data.filtered || !json.data.filtered.length) throw new Error("IDAT: Invalid inflate response");

    json.data.original = filter.reverse(json.data.filtered, json.header);

    const multiplier = 8 / depth;
    json.data.original = depth <= 8 ? json.data.original.reduce((a, x, i) => {
        a.set([0, 1, 2, 3, 4, 5, 6, 7].slice(0, multiplier).reverse().map(y => (x >> (depth * y)) & (2 ** depth - 1)), i * multiplier);
        return a;
    }, Buffer.alloc(json.data.original.length * multiplier)) : new Uint16Array(json.data.original.buffer);

    return new PNG(json);
}
