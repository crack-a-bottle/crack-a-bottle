export function fill<T>(length: number, value: T) {
    return Array.from({ length }, () => Array.isArray(value) ? [ ...value ] : { ...value });
}
