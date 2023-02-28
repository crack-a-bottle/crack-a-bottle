import CRC from "./crc";
import { SIGNATURE } from "./constants";
import Filter from "./filter";
import inflate from "./inflate";
import parse from "./parse";

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
    keepScale?: boolean;
    noUnfilter?: boolean;
    noParse?: boolean;
}

class PNG {
    public header: PNGHeader = { width: 0, height: 0, depth: 0, type: 0, interlace: false };
    public palette?: Buffer;
    public data: Buffer | Uint16Array;
    public chunks: { [key: string]: Buffer } = {};

    public constructor(data: Buffer, { checkCRC = false, keepScale = false, noUnfilter = false, noParse = false }: PNGOptions) {
        let png = Buffer.isBuffer(data) ? data : null;
        if (png == null) {
            try {
                png = Buffer.from(data);
            } catch {
                throw new TypeError("Data cannot be converted to Buffer");
            }
        }
        if (!png.subarray(0, 8).equals(Buffer.from(SIGNATURE))) throw new SyntaxError("Invalid or missing PNG signature");

        let outputData: Buffer | null = null;
        for (let i = 8; i < png.length; i += 4) {
            const chkLength = png.readUInt32BE(i);
            i += 4;
            const chkType = String.fromCharCode(png[i++], png[i++], png[i++], png[i++]);
            const chkData = Buffer.allocUnsafe(chkLength);
            if (chkLength > 0) {
                for (let j = 0; j < chkLength; j++) {
                    chkData[j] = png[i++];
                }
            }

            const crc = checkCRC ? new CRC() : null;
            if (checkCRC) {
                crc!.write(Buffer.from(chkType));
                crc!.write(chkData);
            }

            switch (chkType) {
                case "IHDR":
                    this.header = {
                        width: chkData.readUInt32BE(0),
                        height: chkData.readUInt32BE(4),
                        depth: chkData[8],
                        type: chkData[9],
                        interlace: chkData[12] > 0
                    }
                    break;
                case "PLTE":
                    this.palette = chkData;
                    break;
                case "IDAT":
                    outputData = outputData != null ? Buffer.concat([outputData, chkData]) : chkData;
                    break;
                case "IEND":
                    break;
                default:
                    this.chunks[chkType] = this.chunks[chkType] ? Buffer.concat([this.chunks[chkType], chkData]) : chkData;
                    break;
            }

            if (checkCRC) {
                const chkCRC = png.readInt32BE(i);
                const calcCRC = crc!.read();
                if (chkCRC != calcCRC) throw new Error(`CRC failed: expected ${chkCRC}, got ${calcCRC}`);
            }
        }

        outputData = inflate(outputData!, this.header);
        if (!outputData || !outputData.length) throw new Error("Invalid PNG inflate response");
        if (!noUnfilter) {
            this.data = new Filter(outputData!, this.header).data();
            this.data = !noParse ? parse(this, keepScale) : this.data;
        } else this.data = outputData!;
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

export default PNG;