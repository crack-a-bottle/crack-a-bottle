import zlib from "zlib";
import CRC from "./crc";
import { BYTES_PER_PIXEL as bppMap, SIGNATURE } from "./constants";
import filter from "./unfilter";

export interface PNG {
    header: PNGHeader;
    palette?: Buffer;
    data: Buffer | Uint16Array | null;
    chunks: { [key: string]: Buffer };
}

export interface ParseablePNG extends PNG {
    toJSON(): PNGData;
}

export interface PNGData {
    header: PNGHeader;
    palette?: number[];
    data: number[];
    chunks: { [key: string]: number[] };
}

export interface PNGHeader {
    width: number;
    height: number;
    depth: number;
    type: PNGType;
    interlace: boolean;
}

export enum PNGType {
    GRAYSCALE = 0,
    TRUECOLOR = 2,
    INDEX_COLOR = 3,
    GRAYSCALE_ALPHA = 4,
    TRUECOLOR_ALPHA = 6
}

export type PNGOptions = {
    checkCRC?: boolean;
    keepFilter?: boolean;
}

class _PNG implements ParseablePNG {
    public header: PNGHeader;
    public palette?: Buffer;
    public data: Buffer | Uint16Array;
    public chunks: { [key: string]: Buffer };

    public constructor(data: PNG) {
        this.header = data.header;
        if (data.palette) this.palette = data.palette;
        this.data = data.data!;
        this.chunks = data.chunks;
    }

    public toJSON() {
        const json: PNGData = {
            header: this.header,
            data: Array.from(this.data),
            chunks: Object.fromEntries(Object.entries(this.chunks).map(x => [x[0], Array.from(x[1])]))
        }
        if (this.palette) json.palette = Array.from(this.palette);
        return json;
    }
}

function png(data: Buffer, { checkCRC = false, keepFilter = false }: PNGOptions = { checkCRC: false, keepFilter: false }): ParseablePNG {
    if (!data.subarray(0, 8).equals(Buffer.from(SIGNATURE, "hex"))) throw new SyntaxError("Invalid or missing PNG signature");

    const json: PNG = {
        header: { width: 0, height: 0, depth: 0, type: 0, interlace: false },
        data: null,
        chunks: {}
    }
    for (let i = 8; i < data.length; i += 4) {
        const chkLength = data.readUInt32BE(i);
        i += 4;
        const chkType = String.fromCharCode(data[i++], data[i++], data[i++], data[i++]);
        const chkData = Buffer.allocUnsafe(chkLength);
        if (chkLength > 0) {
            for (let j = 0; j < chkLength; j++) {
                chkData[j] = data[i++];
            }
        }

        const crc = checkCRC ? new CRC() : null;
        if (checkCRC) {
            crc!.write(Buffer.from(chkType));
            crc!.write(chkData);
        }

        switch (chkType) {
            case "IHDR":
                json.header = {
                    width: chkData.readUInt32BE(0),
                    height: chkData.readUInt32BE(4),
                    depth: chkData[8],
                    type: chkData[9],
                    interlace: chkData[12] > 0
                }
                break;
            case "PLTE":
                json.palette = chkData;
                break;
            case "IDAT":
                json.data = json.data != null ? Buffer.concat([json.data as Buffer, chkData]) : chkData;
                break;
            case "IEND":
                break;
            default:
                json.chunks[chkType] = json.chunks[chkType] ? Buffer.concat([json.chunks[chkType], chkData]) : chkData;
                break;
        }

        if (checkCRC) {
            const chkCRC = data.readInt32BE(i);
            const calcCRC = crc!.read();
            if (chkCRC != calcCRC) throw new Error(`CRC failed: expected ${chkCRC}, got ${calcCRC}`);
        }
    }

    const { depth } = json.header;
    if (![1, 2, 4, 8, 16].includes(depth)) throw new SyntaxError(`Unrecognized bit depth ${depth}`);

    json.data = zlib.inflateSync(json.data as Buffer, !json.header.interlace ? { chunkSize: Math.max(
        (((json.header.width * bppMap[json.header.type] * depth + 7) >> 3) + 1) * json.header.height, zlib.constants.Z_MIN_CHUNK) } : {});
    if (!json.data || !json.data.length) throw new Error("Invalid PNG inflate response");

    if (!keepFilter) json.data = filter(json.data, json.header);

    if (depth < 8) json.data = Buffer.from(Array.from(json.data).flatMap(x => Array(8 / depth).map((y, i) => x >> (depth * i) & (2 ** depth - 1))));
    else if (depth > 8) json.data = new Uint16Array(json.data.buffer);

    return new _PNG(json);
}

export default png;