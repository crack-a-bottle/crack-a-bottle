import assert from "assert";

const table = Array(256).fill(Array(8).fill(0)).map((x: number[], i) => x.reduce(c => ((c & 1) * 3988292384) ^ (c >>> 1), i) >>> 0);

function crc(data: Buffer) {
    return ~data.reduce((c, x) => table[(c ^ x) & 255] ^ (c >>> 8), -1) >>> 0;
}

export function extract(data: Buffer, checkRedundancy: boolean = true) {
    const chunks: { type: string, data: Buffer }[] = [];
    for (let i = 0; i < data.length; i += 4) {
        const chunk = data.subarray(i + 4, i + data.readUInt32BE(i) + 12);
        const type = chunk.subarray(0, 4).toString();

        if (checkRedundancy && !(chunk[0] >> 5 & 1)) assert.strictEqual(crc(chunk.subarray(0, -4)),
            chunk.readUInt32BE(chunk.length - 4), type + ": Cyclic redundancy check failed");

        chunks.push({ type, data: chunk.subarray(4, -4) });
        i += chunk.length;
    }

    return chunks;
}
