export function fill<T>(length: number, value: T) {
    return Array(length).fill(null).map(() => value);
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

export function mapFill<T>(length: number, cb: (index: number) => T) {
    return Array(length).fill(null).map((_, i) => cb(i));
}
