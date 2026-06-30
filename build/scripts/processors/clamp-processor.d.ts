declare class ClampProcessor extends AudioWorkletProcessor {
    count: number;
    logoff: boolean;
    lognum: number;
    maxlog: number;
    processed: number;
    active: boolean;
    constructor();
    process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean;
}
//# sourceMappingURL=clamp-processor.d.ts.map