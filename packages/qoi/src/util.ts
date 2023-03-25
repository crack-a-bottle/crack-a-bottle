export function fill<T>(length: number, cb: (index: number) => T) {
    return Array(length).fill(null).map((_, i) => cb(i));
}
