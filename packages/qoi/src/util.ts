export function hashIndex(rgba: number) {
    const rgb = intToRgba(rgba);
    return (rgb[0] * 3 + rgb[1] * 5 + rgb[2] * 7 + rgb[3] * 11) % 64;
}

export function intToRgba(rgba: number): [number, number, number, number] {
    return [(rgba >> 24) & 255, (rgba >> 16) & 255, (rgba >> 8) & 255, rgba & 255];
}

export function rgbaToInt(r: number, g: number, b: number, a: number) {
    return Uint32Array.of(((r & 255) << 24) | ((g & 255) << 16) | ((b & 255) << 8) | (a & 255))[0];
}
