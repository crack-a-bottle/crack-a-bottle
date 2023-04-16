import * as assert from "assert";

const SIGNATURE = Buffer.of(66, 77);

export interface BMP {
    data: number[][];
}

export function bmp(data: Buffer): { data: number[][] }  {
    assert.deepStrictEqual(SIGNATURE, data.subarray(0, 2), "Start signature not found");

    return { data: [] };
}
bmp.SIGNATURE = SIGNATURE.toString("latin1");
