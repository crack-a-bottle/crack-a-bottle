import * as assert from "assert";
import * as util from "./util";

export const END_SIGNATURE = Buffer.of(0, 0, 0, 0, 0, 0, 0, 1);
export const SIGNATURE = Buffer.of(113, 111, 105, 102);

export enum QOIChannels {
    RGB = 3,
    RGBA = 4
}

export interface QOI {
    width: number;
    height: number;
    channels: QOIChannels;
    colorspace: number;
    data: number[][];
}

export enum QOIPixel {
    INDEX = 0,
    DIFF = 64,
    LUMA = 128,
    RUN = 192,
    RGB = 254,
    RGBA = 255
}

export function qoi(data: Buffer): QOI {
    assert.deepStrictEqual(SIGNATURE, data.subarray(0, 4), "Start signature not found");
    assert.ok(data.includes(END_SIGNATURE), "End signature not found");

    const width = data.readUInt32BE(4);
    assert.ok(width > 0, "Image width cannot be less than one");
    const height = data.readUInt32BE(8);
    assert.ok(height > 0, "Image height cannot be less than one");
    const channels = data[12];
    assert.ok(channels > 2 && channels < 5, "Invalid channel amount " + channels);
    const colorspace = data[13];
    assert.ok(colorspace >= 0 && colorspace <= 1, "Unsupported colorspace " + colorspace);

    const json: QOI = {
        width,
        height,
        channels,
        colorspace,
        data: util.fill(height, () => Array(width * channels))
    }
    const colors = util.fill(64, () => [0, 0, 0, 0].slice(0, channels));
    const end = data.lastIndexOf(END_SIGNATURE);

    let c = [0, 0, 0, 255].slice(0, channels);
    let o = 14;
    let l = 0;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width * channels; x += channels) {
            if (l > 0) l--;
            else if (o < end) {
                const px = data[o] & 63;
                const pxType = data[o] <= 253 ? data[o] : data[o] & 192;
                switch (pxType) {
                    case QOIPixel.RGB:
                        c[0] = data[++o];
                        c[1] = data[++o];
                        c[2] = data[++o];
                        break;
                    case QOIPixel.RGBA:
                        c[0] = data[++o];
                        c[1] = data[++o];
                        c[2] = data[++o];
                        if (channels == QOIChannels.RGBA) c[3] = data[++o];
                        else o++;
                        break;
                    case QOIPixel.INDEX:
                        c = colors[px].slice(0, channels);
                        break;
                    case QOIPixel.DIFF:
                        c[0] += (px & 3) - 2;
                        c[1] += (px >> 2 & 3) - 2;
                        c[2] += (px >> 4 & 3) - 2;
                        c = c.map(v => v & 255);
                        break;
                    case QOIPixel.LUMA:
                        const px2 = data[++o];
                        c[0] += px + (px2 & 15) - 40;
                        c[1] += px - 32;
                        c[2] += (px2 >> 4 & 15) - 40;
                        c = c.map(v => v & 255);
                        break;
                    case QOIPixel.RUN:
                        l = px;
                        break;
                }

                c = c.map(v => v & 255);
                if (pxType != QOIPixel.RUN && pxType != QOIPixel.INDEX)
                    colors.splice((c[0] * 3 + c[1] * 5 + c[2] * 7 + (c[3] ?? 255) * 11) % 64, 1, c);

                o++;
            }

            json.data[y].splice(x, channels, ...c);
        }
    }

    return json;
}
