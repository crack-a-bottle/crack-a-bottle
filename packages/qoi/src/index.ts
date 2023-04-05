import * as assert from "assert";

export const END_SIGNATURE = Buffer.of(0, 0, 0, 0, 0, 0, 0, 1);
export const SIGNATURE = Buffer.of(113, 111, 105, 102);

export interface QOI {
    width: number;
    height: number;
    type: QOIType;
    colorspace: number;
    data: number[][];
}

export enum QOIChunk {
    INDEX = 0,
    DIFF = 64,
    LUMA = 128,
    RUN = 192,
    RGB = 254,
    RGBA = 255
}

export enum QOIType {
    RGB = 3,
    RGBA = 4
}

export function qoi(data: Buffer) {
    assert.deepStrictEqual(SIGNATURE, data.subarray(0, 4), "Start signature not found");
    assert.ok(data.includes(END_SIGNATURE), "End signature not found");
    const json: QOI = { width: 0, height: 0, type: 3, colorspace: 0, data: [] };

    json.width = data.readUInt32BE(4);
    assert.notStrictEqual(json.width, 0, "Image width cannot be less than one");
    json.height = data.readUInt32BE(8);
    assert.notStrictEqual(json.height, 0, "Image height cannot be less than one");
    json.type = data[12];
    assert.strictEqual((json.type - 3) % 2 + 3, json.type, "Invalid image type");
    json.colorspace = data[13];
    assert.strictEqual(json.colorspace % 2, json.colorspace, "Unsupported colorspace");

    const { width, height, type } = json;
    const colors = Array(64).fill([0, 0, 0, 0].slice(0, type));
    const end = data.indexOf(END_SIGNATURE);

    let c = [0, 0, 0, 255].slice(0, type);
    let o = 14;
    let l = 0;
    for (let y = 0; y < height; y++) {
        const row = Array(width * type);
        for (let x = 0; x < row.length; x += type) {
            if (l > 0) l--;
            else if (o < end) {
                const px = data[o] & 63;
                const chunk = data[o] & (data[o] > 253 ? 255 : 192);
                switch (chunk) {
                    case QOIChunk.RGB:
                        c[0] = data[++o];
                        c[1] = data[++o];
                        c[2] = data[++o];
                        break;
                    case QOIChunk.RGBA:
                        c[0] = data[++o];
                        c[1] = data[++o];
                        c[2] = data[++o];
                        c[3] = type == QOIType.RGBA ? data[o + 1] : c[3];
                        o++;
                        break;
                    case QOIChunk.INDEX:
                        c = colors[px].slice(0, type);
                        break;
                    case QOIChunk.DIFF:
                        c[0] += (px & 3) - 2;
                        c[1] += (px >> 2 & 3) - 2;
                        c[2] += (px >> 4 & 3) - 2;
                        c = c.map(i => i & 255);
                        break;
                    case QOIChunk.LUMA:
                        const px2 = data[++o];
                        c[0] += px + (px2 & 15) - 40;
                        c[1] += px - 32;
                        c[2] += (px2 >> 4 & 15) - 40;
                        c = c.map(i => i & 255);
                        break;
                    case QOIChunk.RUN:
                        l = px;
                        break;
                }

                c = c.map(v => v & 255);
                if (chunk != QOIChunk.RUN && chunk != QOIChunk.INDEX)
                    colors.splice((c[0] * 3 + c[1] * 5 + c[2] * 7 + (c[3] ?? 255) * 11) % 64, 1, c);

                o++;
            }

            row.splice(x, type, ...c);
        }

        json.data.splice(y, 1, row);
    }

    return json;
}
