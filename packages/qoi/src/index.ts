import { EMPTY_ARRAY, END_SIGNATURE, SIGNATURE } from "./constants";
import * as util from "./util";

export interface BaseQOIStream {
    width: number;
    height: number;
    channels: QOIChannels;
    colorspace: number;
    data: Uint32Array;
}

export enum QOIChannels {
    RGB = 3,
    RGBA = 4
}

export type QOIObject = {
    width: number;
    height: number;
    channels: QOIChannels;
    colorspace: number;
    data: number[];
}

export enum QOIPixel {
    INDEX = 0,
    DIFF = 64,
    LUMA = 128,
    RUN = 192,
    RGB = 254,
    RGBA = 255
}

export interface QOIStream extends BaseQOIStream {
    toJSON(): QOIObject;
}

class QOI implements QOIStream {
    public width: number;
    public height: number;
    public channels: QOIChannels;
    public colorspace: number;
    public data: Uint32Array;

    public constructor(data: BaseQOIStream) {
        this.width = data.width;
        this.height = data.height;
        this.channels = data.channels;
        this.colorspace = data.colorspace;
        this.data = data.data;
    }

    public toJSON(): QOIObject {
        return {
            width: this.width,
            height: this.height,
            channels: this.channels,
            colorspace: this.colorspace,
            data: Array.from(this.data)
        }
    }
}

export function qoi(data: Buffer): QOIStream {
    if (!data.subarray(0, 4).equals(SIGNATURE)) throw new SyntaxError("Signature not found at start of datastream");
    const json: BaseQOIStream = {
        width: data.readUInt32BE(4),
        height: data.readUInt32BE(8),
        channels: data[12],
        colorspace: data[13],
        data: EMPTY_ARRAY
    }

    const rawData = data.subarray(14, -8);
    const finalData = new Uint32Array(json.width * json.height);
    const indexes: Record<number, number> = {};
    for (let i = 0, p = 0, c = 255; i < rawData.length; i++) {
        if (rawData[i] > 253) switch (rawData[i]) {
            case QOIPixel.RGB: {
                c = util.rgbaToInt(rawData[++i], rawData[++i], rawData[++i], c & 255);
                indexes[util.hashIndex(c)] = c;
                finalData[p++] = c;
                continue;
            } case QOIPixel.RGBA: {
                c = util.rgbaToInt(rawData[++i], rawData[++i], rawData[++i], rawData[++i]);
                indexes[util.hashIndex(c)] = c;
                finalData[p++] = c;
                continue;
            }
        } else switch (rawData[i] & 192) {
            case QOIPixel.INDEX: {
                c = indexes[rawData[i] & 63];
                finalData[p++] = c;
                continue;
            } case QOIPixel.DIFF: { // oh boy
                const rgba = util.intToRgba(c);
                c = util.rgbaToInt(
                    rgba[0] + ((((rawData[i] >> 4) & 3) - 2) & 255),
                    rgba[1] + ((((rawData[i] >> 2) & 3) - 2) & 255),
                    rgba[2] + (((rawData[i] & 3) - 2) & 255),
                    rgba[3]);
                indexes[util.hashIndex(c)] = c;
                finalData[p++] = c;
                continue;
            } case QOIPixel.LUMA: { // seriously screw this
                const diffG = (rawData[i++] & 63) - 32;
                const rgba = util.intToRgba(c);
                c = util.rgbaToInt(
                    rgba[0] + (diffG - 8 + ((rawData[i] >> 4) & 15)) & 255,
                    (rgba[1] + diffG) & 255,
                    (rgba[2] + (diffG - 8 + (rawData[i] & 15))) & 255,
                    rgba[3]);
                indexes[util.hashIndex(c)] = c;
                finalData[p++] = c;
                continue;
            } case QOIPixel.RUN: {
                for (let run = (rawData[i] & 63) + 1; run > 0; run--) finalData[p++] = c;
                continue;
            }
        }
    }

    if (!data.subarray(-8).equals(END_SIGNATURE)) throw new SyntaxError("Signature not found at end of datastream");

    json.data = finalData;
    return new QOI(json);
}
