import PNG from ".";
import { imagePasses, interlaceIterator } from "./adam7";
import { BPP_MAP as bppMap } from "./constants";

const pixelBppMapper: ((pixelData: Buffer, data: Buffer, pixelPos: number, rawPos: number) => void)[] = [
    () => {},
    (pixelData, data, pixelPos, rawPos) => {
        if (rawPos == data.length) throw new Error("Ran out of data");

        pixelData[pixelPos] = data[rawPos];
        pixelData[pixelPos + 1] = data[rawPos];
        pixelData[pixelPos + 2] = data[rawPos];
        pixelData[pixelPos + 3] = 255;
    },
    (pixelData, data, pixelPos, rawPos) => {
        if (rawPos + 1 >= data.length) throw new Error("Ran out of data");

        pixelData[pixelPos] = data[rawPos];
        pixelData[pixelPos + 1] = data[rawPos];
        pixelData[pixelPos + 2] = data[rawPos];
        pixelData[pixelPos + 3] = data[rawPos + 1];
    },
    (pixelData, data, pixelPos, rawPos) => {
        if (rawPos + 2 >= data.length) throw new Error("Ran out of data");

        pixelData[pixelPos] = data[rawPos];
        pixelData[pixelPos + 1] = data[rawPos + 1];
        pixelData[pixelPos + 2] = data[rawPos + 2];
        pixelData[pixelPos + 3] = 255;
    },
    (pixelData, data, pixelPos, rawPos) => {
        if (rawPos + 3 >= data.length) throw new Error("Ran out of data");

        pixelData[pixelPos] = data[rawPos];
        pixelData[pixelPos + 1] = data[rawPos + 1];
        pixelData[pixelPos + 2] = data[rawPos + 2];
        pixelData[pixelPos + 3] = data[rawPos + 3];
    }
]

const pixelBppCustomMapper: ((pixelData: Buffer | Uint16Array, data: Buffer | Uint16Array, pixelPos: number, maxBit: number) => void)[] = [
    () => {},
    (pixelData, data, pixelPos, maxBit) => {
        pixelData[pixelPos] = data[0];
        pixelData[pixelPos + 1] = data[0];
        pixelData[pixelPos + 2] = data[0];
        pixelData[pixelPos + 3] = maxBit;
    },
    (pixelData, data, pixelPos) => {
        pixelData[pixelPos] = data[0];
        pixelData[pixelPos + 1] = data[0];
        pixelData[pixelPos + 2] = data[0];
        pixelData[pixelPos + 3] = data[1];
    },
    (pixelData, data, pixelPos, maxBit) => {
        pixelData[pixelPos] = data[0];
        pixelData[pixelPos + 1] = data[1];
        pixelData[pixelPos + 2] = data[2];
        pixelData[pixelPos + 3] = maxBit;
    },
    (pixelData, data, pixelPos) => {
        pixelData[pixelPos] = data[0];
        pixelData[pixelPos + 1] = data[1];
        pixelData[pixelPos + 2] = data[2];
        pixelData[pixelPos + 3] = data[3];
    }
]

function bitRetriever(data: Buffer | Uint16Array, depth: number) {
    let leftOver: Buffer | Uint16Array;
    let i = 0;

    return {
        get(count: number) {
            leftOver = leftOver || (depth < 8 ? Buffer.allocUnsafe(count) : new Uint16Array(count));
            while (i < leftOver.length) {
                if (i == data.length) throw new Error("Ran out of data");

                let byte = data[i++];
                switch (depth) {
                    case 16:
                        leftOver.set([(byte << 8) + data[i++]], );
                        break;
                    case 4:
                        leftOver.set([byte >> 4, byte & 15]);
                        break;
                    case 2:
                        leftOver.set([(byte >> 6) & 3, (byte >> 4) & 3, (byte >> 2) & 3, byte & 3]);
                        break;
                    case 1:
                        leftOver.set([(byte >> 7) & 1, (byte >> 6) & 1, (byte >> 5) & 1, (byte >> 4) & 1, (byte >> 3) & 1, (byte >> 2) & 1, (byte >> 1) & 1, byte & 1]);
                        break;
                    default:
                        throw new Error("Unrecognized bit depth");
                }
            }
            let returner = leftOver.subarray(0, count);
            leftOver = leftOver.subarray(count);
            return returner;
        },
        resetAfterLine() {
            leftOver = leftOver.fill(0);
        },
        end() {
            if (i != data.length) throw new Error("Extra data was found");
        }
    };
}

function parse({ data, header: { width, height, interlace, type, depth }, palette, chunks }: PNG, keepScale = false) {
    const bpp = bppMap[type];

    const bits = depth != 8 ? bitRetriever(data, depth) : null;
    let pixelData = depth <= 8 ? Buffer.allocUnsafe(width * height * 4) : new Uint16Array(width * height * 4);
    let maxBit = 2 ** depth - 1;
    let rawPos = 0;
    let images: { width: number, height: number, index: number }[];
    let getPixelPos;
  
    if (interlace) {
        images = imagePasses(width, height);
        getPixelPos = interlaceIterator(width);
    } else {
        let realPixelPos = 0;
        getPixelPos = () => {
            let rpp = realPixelPos;
            realPixelPos += 4;
            return rpp;
        }
        images = [{ width: width, height: height, index: -1 }];
    }
  
    for (const image of images) {
        for (let y = 0; y < image.height; y++) {
            for (let x = 0; x < image.width; x++) {
                let pixelPos = getPixelPos(x, y, image.index);
                if (depth == 8) {
                    pixelBppMapper[bpp](pixelData as Buffer, data as Buffer, pixelPos, rawPos);
                    rawPos += bpp;
                } else {
                    pixelBppCustomMapper[bpp](pixelData, bits!.get(bpp), pixelPos, maxBit);
                    bits!.resetAfterLine();
                }
            }
        }
    }

    if (depth == 8) { if (rawPos != data.length) throw new Error("Extra data was found"); }
    else bits!.end();

    let parsedData = pixelData;
    if (typeof palette != "undefined") {
        let pixelPos = 0;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let color = palette[pixelData[pixelPos] * 3];
                if (!color) throw new Error("Index " + pixelData[pixelPos] + " not in palette");
        
                for (let i = 0; i < 4; i++) {
                    parsedData[pixelPos] = palette[pixelData[pixelPos] + i];
                }
                
            }
        }
    } else {
        if ("tRNS" in chunks) {
            const color = chunks.tRNS;
            let pixelPos = 0;

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    let makeTrans = false;
                    if (color.length == 1) {
                        if (color[0] == pixelData[pixelPos]) makeTrans = true;
                    }
                    else if (color[0] == pixelData[pixelPos] && color[1] == pixelData[pixelPos + 1] && color[2] == pixelData[pixelPos + 2]) makeTrans = true;

                    if (makeTrans) {
                        for (let i = 0; i < 4; i++) {
                            parsedData[pixelPos + i] = 0;
                        }
                    }
                    pixelPos += 4;
                }
            }
        }
        // if it needs scaling
        if (depth != 8 && !keepScale) {
            if (depth == 16) parsedData = Buffer.allocUnsafe(width * height * 4);

            let pixelPos = 0;
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    for (let i = 0; i < 4; i++) {
                        parsedData[pixelPos + i] = Math.floor((pixelData[pixelPos + i] * 255) / (2 ** depth - 1) + 0.5);
                    }
                    pixelPos += 4;
                }
            }
        }
    }
    return parsedData;
}

export default parse;