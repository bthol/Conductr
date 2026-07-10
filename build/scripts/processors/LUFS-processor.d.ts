declare class LUFSProcessor extends AudioWorkletProcessor {
    logging: boolean;
    logs: number;
    active: boolean;
    ran: number;
    biquad1: BiquadFilter44100;
    biquad2: BiquadFilter44100;
    block: Float32Array;
    blockIndex: number;
    sampleRate: number;
    window: number;
    sampleSize: number;
    LUFS: number;
    constructor();
    process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean;
}
declare class BiquadFilter44100 {
    x1: number;
    x2: number;
    y1: number;
    y2: number;
    b0: number;
    b1: number;
    b2: number;
    a1: number;
    a2: number;
    constructor(b0: number, b1: number, b2: number, a1: number, a2: number);
    process(x: number): number;
}
//# sourceMappingURL=LUFS-processor.d.ts.map