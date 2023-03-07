import { EMPTY_BUFFER, SIGNATURE } from "./constants";

export interface BaseQOIStream {
    width: number;
    height: number;
    channels: QOIChannels;
    colorspace: number;
    data: Buffer;
}

export enum QOIChannels {
    RGB = 3,
    RGBA = 4
}

export type QOIObject = {
    width: number;
    height: number;
    channels: QOIChannels;
    colorspace: number;
    data: number[];
}

export interface QOIStream extends BaseQOIStream {
    toJSON(): QOIObject;
}

export function qoi(data: Buffer) {
    if (!data.subarray(0, 4).equals(SIGNATURE)) throw new SyntaxError("qoi_header: Signature not found at start of datastream");

    const json: BaseQOIStream = {
        width: data.readUInt32BE(4),
        height: data.readUInt32BE(8),
        channels: data[12],
        colorspace: data[13],
        data: EMPTY_BUFFER
    }
    for (let i = 14; i < data.length - 8; i++) {
        switch (data[i] >> 6) {
            
        }
    }

    if (!data.subarray(0, 4).equals(SIGNATURE)) throw new SyntaxError("#: Signature not found at start of datastream");
}