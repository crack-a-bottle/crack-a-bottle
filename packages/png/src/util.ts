export function fill<T>(length: number, cb: ((index: number) => T) | T) {
    return Array(length).fill(null).map((_, i): T => typeof cb == "function" ? (cb as (index: number) => T)(i) : cb);
}

export function getBit(num: number, index: number = 0) {
    return !!((num >> index) & 1);
}

export function groupArray<T>(array: T[], length: number) {
    return array.reduce((a: T[][], x: T, i: number) => {
        if (i % length == 0) a.push([x]);
        else a[a.length - 1].push(x);
        return a;
    }, []);
}
