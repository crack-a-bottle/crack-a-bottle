import * as assert from "assert";

const END_SIGNATURE = Buffer.of(0, 0, 0, 0, 0, 0, 0, 1); // 00 00 00 00 00 00 00 01
const SIGNATURE = Buffer.of(113, 111, 105, 102); // 71 6F 69 66

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
    assert.deepStrictEqual(data.subarray(0, 4), SIGNATURE, "Start signature not found");
    assert.notStrictEqual(data.indexOf(END_SIGNATURE), -1, "End signature not found");
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
    const colors = Array<number[]>(64).fill([0, 0, 0, 0].slice(0, type));
    colors[53] = [0, 0, 0, 255].slice(0, type);
    const end = data.indexOf(END_SIGNATURE);

    let c = [0, 0, 0, 255].slice(0, type);
    let i = 14;
    let l = 0;
    for (let y = 0; y < height; y++) {
        json.data.push([]);
        for (let x = 0; x < width; x++) {
            if (l > 0) l--;
            else if (i < end) {
                const px = data[i] & 63;
                const chunk = data[i] & (data[i] > 253 ? 255 : 192);
                switch (chunk) {
                    case QOIChunk.RGB:
                        c[0] = data[++i];
                        c[1] = data[++i];
                        c[2] = data[++i];
                        break;
                    case QOIChunk.RGBA:
                        c[0] = data[++i];
                        c[1] = data[++i];
                        c[2] = data[++i];
                        c[3] = data[++i];
                        break;
                    case QOIChunk.INDEX:
                        c = colors[px].slice(0, type);
                        break;
                    case QOIChunk.DIFF:
                        c[0] += (px >> 4 & 3) - 2;
                        c[1] += (px >> 2 & 3) - 2;
                        c[2] += (px & 3) - 2;
                        break;
                    case QOIChunk.LUMA:
                        const px2 = data[++i];
                        c[0] += px - 32 + ((px2 >> 4 & 15) - 8);
                        c[1] += px - 32;
                        c[2] += px - 32 + ((px2 & 15) - 8);
                        break;
                    case QOIChunk.RUN:
                        l = px;
                        break;
                }

                c = c.slice(0, type).map(v => v & 255);
                if (chunk != QOIChunk.RUN && chunk != QOIChunk.INDEX)
                    colors[(c[0] * 3 + c[1] * 5 + c[2] * 7 + (c[3] ?? 255) * 11) % 64] = c;

                i++;
            }

            json.data[y].push(...c);
        }
    }

    return json;
}

qoi.END_SIGNATURE = END_SIGNATURE.toString("latin1");
qoi.SIGNATURE = SIGNATURE.toString("latin1");
