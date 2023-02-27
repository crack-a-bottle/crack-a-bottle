import { PNGHeader } from ".";
import * as adam7 from "./adam7";
import { BPP_MAP as bppMap } from "./constants";
import Reader from "./reader";

function getByteWidth(width: number, bpp: number, depth: number) {
    return depth == 8 ? width * bpp : Math.ceil(width * bpp / (8 / depth));
}

function paethPredictor(left: number, above: number, upLeft: number) {
    const pLeft = Math.abs(above - upLeft);
    const pAbove = Math.abs(left - upLeft);
    const pUpLeft = Math.abs(left + above - 2 * upLeft);

    return (pLeft <= pAbove && pLeft <= pUpLeft) ? left : ((pAbove <= pUpLeft) ? above : upLeft);
}

class Filter {
    #data: Buffer[] = [];
    #images: { byteWidth: number; height: number; lineIndex: number; }[] = [];
    #index: number = 0;
    #xComparison: number = 1;
    #reader: Reader;
    #lastLine: Buffer | null = null;

    constructor(buffer: Buffer, { width, height, depth, type, interlace }: PNGHeader) {
        const bpp = bppMap[type];

        if (interlace) {
            for (const pass of adam7.imagePasses(width, height)) {
                this.#images.push({ byteWidth: getByteWidth(pass.width, bpp, depth), height: pass.height, lineIndex: 0, });
            }
        } else this.#images.push({ byteWidth: getByteWidth(width, bpp, depth), height: height, lineIndex: 0, });

        this.#xComparison = depth == 8 ? bpp : (depth == 16 ? bpp * 2 : 1);
        this.#reader = new Reader(buffer);
    }

    data() {
        this.#reader.read(this.#images[this.#index].byteWidth + 1, this.#reverseFilterLine.bind(this));
        this.#reader.process();

        return Buffer.concat(this.#data);
    }

    #unfilterLine(rawData: Buffer, byteWidth: number) {
        const xComparison = this.#xComparison;
        const lastLine = this.#lastLine;
        const filter = rawData[0];

        if (filter > 4 || filter < 0) throw new RangeError(`Unrecognized filter type ${filter}`);

        let unfilteredLine = Buffer.allocUnsafe(byteWidth);
        for (let x = 0; x < byteWidth; x++) {
            const rawByte = rawData[1 + x];
            let addend = 0;
            switch (filter) {
                case 1:
                    addend = x > (xComparison - 1) ? unfilteredLine[x - xComparison] : 0;
                    break;
                case 2:
                    addend = lastLine ? lastLine[x] : 0;
                    break;
                case 3:
                    addend = Math.floor(((x > (xComparison - 1) ? unfilteredLine[x - xComparison] : 0) +
                                (lastLine ? lastLine[x] : 0)) / 2);
                    break;
                case 4:
                    addend = paethPredictor((x > (xComparison - 1) ? unfilteredLine[x - xComparison] : 0),
                                lastLine ? lastLine[x] : 0, x > (xComparison - 1) && lastLine ? lastLine[x - xComparison] : 0);
                    break;
            }
            unfilteredLine[x] = rawByte + addend;
        }

        return unfilteredLine;
    }

    #reverseFilterLine(rawData: Buffer) {
        let currentImage = this.#images[this.#index];
        const byteWidth = currentImage.byteWidth;
        const unfilteredLine = rawData[0] <= 0 ? rawData.subarray(1, byteWidth + 1) : this.#unfilterLine(rawData, byteWidth);

        this.#data.push(unfilteredLine);

        currentImage.lineIndex++;
        if (currentImage.lineIndex >= currentImage.height) {
            this.#lastLine = null;
            currentImage = this.#images[++this.#index];
        } else this.#lastLine = unfilteredLine;

        if (currentImage) this.#reader.read(currentImage.byteWidth + 1, this.#reverseFilterLine.bind(this));
        else this.#lastLine = null;
    }
}

export default Filter;