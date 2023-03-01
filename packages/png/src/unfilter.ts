import type { PNGHeader } from ".";
import { ADAM7_IMAGE_PASSES as passes, BYTES_PER_PIXEL as bppMap } from "./constants";

function unfilter(data: Buffer, header: PNGHeader) {
    const buffers: Buffer[] = [];
    const bpp = bppMap[header.type];
    const images: { byteWidth: number; height: number; }[] = [];
    let lastLine: Buffer | null = null;

    if (header.interlace) {
        const { width, height, depth } = header;
        for (const pass of passes) {
            let passWidth = (width - (width % 8)) / 8 * pass.x.length;
            for (let i = 0; pass.x[i] < (width % 8); i++) { passWidth++; }
            let passHeight = (height - (height % 8)) / 8 * pass.y.length;
            for (let i = 0; pass.y[i] < (height % 8); i++) { passHeight++; }
    
            if (passWidth > 0 && passHeight > 0) images.push({ byteWidth: Math.ceil(width * bpp / (8 / depth)), height: passHeight });
        }
    } else images.push({ byteWidth: Math.ceil(header.width * bpp / (8 / header.depth)), height: header.height });

    const xComparison = header.depth == 8 ? bpp : (header.depth == 16 ? bpp * 2 : 1);

    for (const currentImage of images) {
        const { byteWidth, height } = currentImage;
        for (let i = 0; i < currentImage.height; i++) {
            const filter = data[i * height];
            if (filter > 4 || filter < 0) throw new RangeError(`Unrecognized filter type ${filter}`);

            const filteredLine = data.subarray(i * height + 1, (i + 1) * byteWidth + 1);
            if (filter > 0) {
                const unfilteredLine = Buffer.allocUnsafe(byteWidth);
                for (let x = 0; x < byteWidth; x++) {
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
                            const left = x > (xComparison - 1) ? unfilteredLine[x - xComparison] : 0;
                            const above = lastLine ? lastLine[x] : 0;
                            const upLeft = x > (xComparison - 1) && lastLine ? lastLine[x - xComparison] : 0;
                            const pLeft = Math.abs(above - upLeft);
                            const pAbove = Math.abs(left - upLeft);
                            const pUpLeft = Math.abs(left + above - 2 * upLeft);
                        
                            addend = (pLeft <= pAbove && pLeft <= pUpLeft) ? left : ((pAbove <= pUpLeft) ? above : upLeft);
                            break;
                    }

                    unfilteredLine[x] = filteredLine[x] + addend;
                }

                buffers.push(unfilteredLine);
                lastLine = (i + 1) < currentImage.height ? unfilteredLine : null;
            } else {
                buffers.push(filteredLine);
                lastLine = (i + 1) < currentImage.height ? filteredLine : null;
            }
        }
    }

    return Buffer.concat(buffers);
}

export default unfilter;