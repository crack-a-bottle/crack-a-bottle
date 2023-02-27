import * as zlib from "zlib";
import { PNGHeader } from ".";
import { BPP_MAP as bppMap } from "./constants";

function inflate(data: Buffer, { width, height, depth, type, interlace }: PNGHeader) {
    let buf = Buffer.isBuffer(data) ? data : null;
    if (buf == null) {
        try {
            buf = Buffer.from(data);
        } catch {
            throw new TypeError("Data cannot be converted to Buffer");
        }
    }

    if (!interlace) {
        const imageSize = (((width * bppMap[type] * depth + 7) >> 3) + 1) * height;
        const inflated = zlib.createInflate({ chunkSize: Math.max(imageSize, zlib.constants.Z_MIN_CHUNK) });
        const chunks: Buffer[] = [];
        let leftToInflate = imageSize;

        inflated.on("error", err => {
            if (!leftToInflate) return;
            throw err;
        });

        inflated.on("data", chunk => {
            if (!leftToInflate) return;

            if (chunk.length > leftToInflate) chunk = chunk.slice(0, leftToInflate);
            leftToInflate -= chunk.length;

            chunks.push(chunk);
        });

        if (!inflated.write(buf)) inflated.once("drain", () => {});
        return Buffer.concat(chunks);
    } else return zlib.inflateSync(buf);
}

export default inflate;