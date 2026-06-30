declare class PeakProcessor extends AudioWorkletProcessor {
    logging: boolean;
    peak: number;
    frames: number;
    interval: number;
    active: boolean;
    constructor();
    process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean;
}
//# sourceMappingURL=peak-processor.d.ts.map