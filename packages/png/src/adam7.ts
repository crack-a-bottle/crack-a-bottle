import { INTERLACE_PASSES as passes } from "./constants";

export function imagePasses(width: number, height: number) {
    const images = [];
    const xRemainder = width % 8;
    const yRemainder = height % 8;

    for (const [i, pass] of passes.entries()) {
        let passWidth = (width - xRemainder) / 8 * pass.x.length;
        let passHeight = (height - yRemainder) / 8 * pass.y.length;

        for (const xPass of pass.x) {
            if (xPass < xRemainder) passWidth++;
            else break;
        }
        for (const yPass of pass.y) {
            if (yPass < yRemainder) passHeight++;
            else break;
        }

        if (passWidth > 0 && passHeight > 0) images.push({ width: passWidth, height: passHeight, index: i });
    }
    return images;
}

export function interlaceIterator(width: number) {
    return (x: number, y: number, pass: number) => {
        const passX = passes[pass].x;
        const xRemainder = x % passX.length;
        const passY = passes[pass].y;
        const yRemainder = y % passY.length;

        return (((x - xRemainder) / passX.length) * 8 + passX[xRemainder]) * 4 + (((y - yRemainder) / passY.length) * 8 + passY[yRemainder]) * width * 4;
    }
}