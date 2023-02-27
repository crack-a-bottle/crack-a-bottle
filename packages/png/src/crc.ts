const crcTable: number[] = [];

for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
        crc = crc & 1 ? crc = 3988292384 ^ (crc >>> 1) : crc >>> 1;
    }
    crcTable[i] = crc;
}

class CRC {
    #crc = -1;

    read() {
        return this.#crc ^ -1;
    }

    write(data: Buffer) {
        for (let i = 0; i < data.length; i++) {
            this.#crc = crcTable[(this.#crc ^ data[i]) & 255] ^ (this.#crc >>> 8);
        }

        return true;
    }
}

export default CRC;