import * as assert from "assert";

const SIGNATURE = Buffer.of(66, 77);

export interface BMP {
    width: number;
    height: number;
    depth: number;
    dimensions: number[];
    palette?: Record<number, number[]>;
    data: number[][];
}

export enum BMPCompression {
    BI_RGB = 0,
    BI_RLE8 = 1,
    BI_RLE4 = 2,
    BI_BITFIELDS = 3,
    BI_JPEG = 4,
    BI_PNG = 5,
    BI_ALPHABITFIELDS = 6,
    BI_CMYK = 11,
    BI_CMYKRLE8 = 12,
    BI_CMYKRLE4 = 13
}

export enum BMPHeader {
    BITMAPCOREHEADER = 12,
    OS22XBITMAPHEADER = 16,
    BITMAPINFOHEADER = 40
}

export function bmp(data: Buffer) {
    assert.deepStrictEqual(SIGNATURE, data.subarray(0, 2), "Start signature not found");
    const json: BMP = { width: 0, height: 0, depth: 0, dimensions: [], data: [] };
    const misc = { offset: data.readUInt32LE(10), compression: 0, imageSize: 0, colorsUsed: 0 };
    switch (data.readUInt32LE(14)) {
        case BMPHeader.BITMAPCOREHEADER:
            json.width = data.readUInt16LE(18);
            json.height = data.readUInt16LE(20);
            json.depth = data.readUInt16LE(24);
            break;
        case BMPHeader.BITMAPINFOHEADER:
            json.width = data.readInt32LE(18);
            json.height = data.readInt32LE(22);
            json.depth = data.readUInt16LE(28);
            misc.compression = data.readUInt32LE(30);
            misc.imageSize = data.readUInt32LE(34);
            json.dimensions = [data.readInt32LE(38), data.readInt32LE(42)];
            misc.colorsUsed = data.readUInt32LE(46);
            break;
        case BMPHeader.OS22XBITMAPHEADER:
            json.width = data.readUInt32LE(18);
            json.height = data.readUInt32LE(22);
            json.depth = data.readUInt16LE(24);
            break;
    }
    switch (misc.compression) {
        case BMPCompression.BI_RGB:
            for (let y = 0; y < json.height; y++) {
                json.data.push([]);
                for (let x = 0; x < json.width; x++) {
                    json.data[x].push(data.readUInt8(misc.offset + y * json.width + x));
                }
            }
            break;
    }

    return json;
}
bmp.SIGNATURE = SIGNATURE.toString("latin1");
