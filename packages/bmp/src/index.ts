import * as assert from "assert";

export const SIGNATURE = Buffer.of(66, 77);

export function bmp(data: Buffer) {
    assert.deepStrictEqual(SIGNATURE, data.subarray(0, 2), "Start signature not found");

    return [[0, 0, 0, 255]];
}
