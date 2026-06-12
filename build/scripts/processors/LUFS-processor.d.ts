declare class LUFSProcessor extends AudioWorkletProcessor {
    count: number;
    logoff: boolean;
    lognum: number;
    maxlog: number;
    processed: number;
    constructor();
    process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean;
}
//# sourceMappingURL=LUFS-processor.d.ts.map