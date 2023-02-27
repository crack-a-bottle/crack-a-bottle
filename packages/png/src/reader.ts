interface ReadInfo {
    length: number;
    allowLess: boolean;
    callback: (buf: Buffer) => void;
}

class Reader {
    #reads: ReadInfo[] = [];
    #buffer: Buffer;

    constructor(buffer: Buffer) {
        this.#buffer = buffer;
    }

    read(length: number, callback: (buf: Buffer) => void) {
        this.#reads.push({ length: Math.abs(length), allowLess: length < 0, callback });
    }

    process() {
        while (this.#reads.length > 0 && this.#buffer.length) {
            const read = this.#reads[0];
            if (this.#buffer.length && (this.#buffer.length >= read.length || read.allowLess)) {
                this.#reads.shift();
                const buffer = this.#buffer;
                this.#buffer = buffer.subarray(read.length);
                read.callback.call(this, buffer.subarray(0, read.length));
            } else break;
        }

        if (this.#reads.length > 0) throw new Error("Read requests waiting on finished stream");
        if (this.#buffer.length > 0) throw new Error("Unrecognized content at end of stream");
    }
}

export default Reader;