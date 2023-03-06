import { PNGType } from ".";

export function getBit(num: number, index: number) {
    return ((num >> index) & 1) > 0;
}

export function bitsPerPixel(type: PNGType, depth: number) {
    return depth * (1 + (getBit(type, 1) ? 2 : 0) + (getBit(type, 2) ? 1 : 0));
}

export function checkArray(o: any) {
    try {
        return [...o];
    } catch {
        return o;
    }
}

export function map<T>(predicate: (v: T, k: string, o: { [s: string]: T } | ArrayLike<T>) => [string, T][], o: { [s: string]: T } | ArrayLike<T>) {
    return Object.fromEntries(Object.entries(o).map(x => predicate(x[1], x[0], o)));
}
