declare class RMSProcessor extends AudioWorkletProcessor {
    logging: boolean;
    RMS: number;
    frames: number;
    interval: number;
    active: boolean;
    constructor();
    process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean;
}
//# sourceMappingURL=RMS-processor.d.ts.map