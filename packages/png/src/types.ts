export interface BasePNGStream {
    header: PNGHeader;
    palette?: Buffer;
    data: PNGData;
    chunks: PNGChunks;
}

export type PNGChunks = {
    bKGD?: number | Uint16Array;
    gAMA?: number;
    pHYs?: { ppuX: number, ppuY: number, specifier: boolean };
    sRGB?: number;
    tEXt?: { [key: string]: string };
    tIME?: string;
    tRNS?: number | Uint16Array | Buffer;
    [key: string]: any;
}

export type PNGData = {
    original: Buffer | Uint16Array;
    filtered: Buffer;
    compressed: Buffer;
}

export enum PNGFilter { // A is the left byte, B is the upper byte, C is the upper left byte
    NONE = 0, // Leave as is
    SUB = 1, // Subtract/Add the left byte
    UP = 2, // Subtract/Add the upper byte
    AVERAGE = 3, // Subtract/Add the floored mean of the left and upper bytes
    PAETH = 4 // Subtract/Add the byte closest to the absolute value of A + B - C
}

export type PNGHeader = {
    width: number;
    height: number;
    depth: number;
    type: PNGType;
    methods: { compression: number; filter: number; };
    interlace: boolean;
}

export type PNGObject = {
    header: PNGHeader;
    palette?: number[];
    chunks: {
        bKGD?: number | number[];
        gAMA?: number;
        pHYs?: { ppuX: number, ppuY: number, specifier: boolean };
        sRGB?: number;
        tEXt?: { [key: string]: string };
        tIME?: string;
        tRNS?: number | number[];
        [key: string]: any;
    }
    data: {
        compressed: number[];
        filtered: number[];
        original: number[];
    }
}

export interface PNGStream extends BasePNGStream {
    toJSON(): PNGObject;
}

export enum PNGType {
    GRAYSCALE = 0,
    TRUECOLOR = 2,
    INDEX_COLOR = 3,
    GRAYSCALE_ALPHA = 4,
    TRUECOLOR_ALPHA = 6
}
