import * as assert from "assert";
import { END_SIGNATURE, SIGNATURE } from "./constants";

export enum QOIChannels {
    RGB = 3,
    RGBA = 4
}

export interface QOIStream {
    width: number;
    height: number;
    channels: QOIChannels;
    colorspace: number;
    data: QOIPixel[][];
}

export type QOIPixel = {
    r: number;
    g: number;
    b: number;
    a?: number;
}

export enum QOIPixelType {
    INDEX = 0,
    DIFF = 64,
    LUMA = 128,
    RUN = 192,
    RGB = 254,
    RGBA = 255
}

export function qoi(data: Buffer): QOIStream {
    if (!data.subarray(0, 4).equals(SIGNATURE)) throw new SyntaxError("Signature not found at start of datastream");

    const width = data.readUInt32BE(4);
    assert.ok(width > 0, "Image width is less than one");
    const height = data.readUInt32BE(8);
    assert.ok(height > 0, "Image height is less than one");
    const channels = data[12];
    assert.ok(channels >= 3 && channels <= 4, "Unsupported channel amount " + channels);
    const colorspace = data[12];
    assert.ok(channels >= 0 && channels <= 1, "Unsupported colorspace " + colorspace);

    const json: QOIStream = {
        width,
        height,
        channels,
        colorspace,
        data: Array.from({ length: height }, (): QOIPixel[] => Array(width))
    }

    const colors = Array.from({ length: 64 }, (): QOIPixel => ({ r: 0, g: 0, b: 0, a: 0 }));

    let c: QOIPixel = { r: 0, g: 0, b: 0 };
    if (channels == QOIChannels.RGBA) c.a = 255;
    let o = 14;
    let l = 0;
    for (const y of json.data.values()) {
        for (const x of y.keys()) {
            if (l > 0) l--;
            else if (o < data.length - 8) {
                const { r, g, b } = c;
                const px = data[o] & 63;
                const pxType = data[o] <= 253 ? data[o] : data[o] & 192;
                switch (pxType) {
                    case QOIPixelType.RGB:
                        c.r = data[++o];
                        c.g = data[++o];
                        c.b = data[++o];
                        break;
                    case QOIPixelType.RGBA:
                        c.r = data[++o];
                        c.g = data[++o];
                        c.b = data[++o];
                        if (channels == QOIChannels.RGBA) c.a = data[++o];
                        else o++;
                        break;
                    case QOIPixelType.INDEX:
                        const idx = colors[px];
                        c.r = idx.r;
                        c.g = idx.g;
                        c.b = idx.b;
                        if (channels == QOIChannels.RGBA) c.a = idx.a;
                        break;
                    case QOIPixelType.DIFF:
                        c.r = (r + (px & 3) - 2) & 255;
                        c.g = (g + ((px >> 2) & 3) - 2) & 255;
                        c.b = (b + ((px >> 4) & 3) - 2) & 255;
                        break;
                    case QOIPixelType.LUMA:
                        const px2 = data[++o];
                        c.r = (r + px + (px2 & 15) - 40) & 255;
                        c.g = (g + px - 32) & 255;
                        c.b = (b + px + ((px2 >> 4) & 15) - 40) & 255;
                        break;
                    case QOIPixelType.RUN:
                        l = px;
                        break;
                }

                if (pxType != QOIPixelType.RUN && pxType != QOIPixelType.INDEX)
                    colors.splice((c.r * 3 + c.g * 5 + c.b * 7 + (c.a ?? 255) * 11) % 64, 1, c);

                o++;
            }

            y.splice(x, 1, c);
        }
    }

    if (!data.subarray(-8).equals(END_SIGNATURE)) throw new SyntaxError("Signature not found at end of datastream");
    return json;
}
