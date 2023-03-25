export function fill<T>(length: number, value: T) {
    return Array(length).fill(null).map(() => Array.isArray(value) ? [ ...value ] : { ...value });
}
