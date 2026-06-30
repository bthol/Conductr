declare class LUFSProcessor extends AudioWorkletProcessor {
    logging: boolean;
    LUFS: number;
    frames: number;
    interval: number;
    active: boolean;
    constructor();
    process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean;
}
//# sourceMappingURL=LUFS-processor.d.ts.map