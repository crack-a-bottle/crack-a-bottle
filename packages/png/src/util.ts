import { PNGType } from ".";

export function bitsPerPixel(type: PNGType, depth: number) {
    return depth * (1 + (getBit(type, 1) ? getBit(type, 0) ? 0 : 2 : 0) + (getBit(type, 2) ? 1 : 0));
}

export function getBit(num: number, index: number = 0) {
    return ((num >> index) & 1) > 0;
}

export function groupArray<T>(array: T[], length: number) {
    return array.reduce((a: T[][], x: T, i: number) => {
        if (i % length == 0) a.push([x]);
        else a[a.length - 1].push(x);
        return a;
    }, []);
}
