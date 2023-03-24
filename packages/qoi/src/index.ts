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
    data: Buffer;
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
    assert.ok(data.subarray(0, 4).equals(SIGNATURE), "Start signature not found");
    assert.ok(data.subarray(-8).equals(END_SIGNATURE), "End signature not found");

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
        data: Buffer.alloc(width * height * channels)
    }

    const colors = Array.from({ length: 64 }, (): number[] => ([0, 0, 0, 0]));

    let c = [0, 0, 0, 255].slice(0, channels);
    let o = 14;
    let l = 0;
    for (let i = 0; i < json.data.length; i += channels) {
        if (l > 0) l--;
        else if (o < data.length - 8) {
            const [ r, g, b ] = c;
            const px = data[o] & 63;
            const pxType = data[o] <= 253 ? data[o] : data[o] & 192;
            switch (pxType) {
                case QOIPixelType.RGB:
                    c[0] = data[++o];
                    c[1] = data[++o];
                    c[2] = data[++o];
                    break;
                case QOIPixelType.RGBA:
                    c[0] = data[++o];
                    c[1] = data[++o];
                    c[2] = data[++o];
                    if (channels == QOIChannels.RGBA) c[3] = data[++o];
                    break;
                case QOIPixelType.INDEX:
                    c = colors[px].slice(0, channels);
                    break;
                case QOIPixelType.DIFF:
                    c[0] = (r + (px & 3) - 2) & 255;
                    c[1] = (g + ((px >> 2) & 3) - 2) & 255;
                    c[2] = (b + ((px >> 4) & 3) - 2) & 255;
                    break;
                case QOIPixelType.LUMA:
                    const px2 = data[++o];
                    c[0] = (r + px + (px2 & 15) - 40) & 255;
                    c[1] = (g + px - 32) & 255;
                    c[2] = (b + px + ((px2 >> 4) & 15) - 40) & 255;
                    break;
                case QOIPixelType.RUN:
                    l = px;
                    break;
            }

            if (pxType != QOIPixelType.RUN && pxType != QOIPixelType.INDEX)
                colors.splice((c[0] * 3 + c[1] * 5 + c[2] * 7 + (c[3] ?? 255) * 11) % 64, 1, c);

            o++;
        }

        json.data.set(c, i);
    }

    return json;
}
