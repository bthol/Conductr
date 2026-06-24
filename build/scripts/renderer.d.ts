interface Window {
    electronAPI: {
        msg: (channel: string, message: string) => void;
        res: (callback: (data: any) => void) => void;
    };
}
declare const options: Object;
declare const audioContext: AudioContext;
declare let macros: {
    [key: string]: any;
};
declare let master: any, pan: any, FortePiano: any, creciendo: any, expressivity: any, variance: any, driveMult: any, Attack: any, Sustain: any, Release: any;
declare let oscillators: {
    [key: string]: any;
};
declare let sequencers: {
    [key: string]: any;
};
declare let macrosInitialized: boolean;
declare let oscillatorsInitialized: boolean;
declare let sequencersInitialized: boolean;
declare let playback: boolean;
declare let tempo: number;
declare let beatsPerMeasure: number;
declare let voices: Array<OscillatorNode>;
declare let sequences: {
    [key: string]: ReturnType<typeof setTimeout>;
};
declare let analysis: {
    [key: string]: Array<AnalyserNode>;
};
declare const masterGain: HTMLInputElement;
declare const masterPan: HTMLInputElement;
declare const breakerBtn: HTMLElement | null;
declare const playBtn: HTMLElement | null;
declare const stopBtn: HTMLElement | null;
declare const FPControl: HTMLInputElement;
declare const DMControl: HTMLInputElement;
declare const SControl: HTMLInputElement;
declare const LControl: HTMLInputElement;
declare const TControl: HTMLInputElement;
declare const VControl: HTMLInputElement;
declare const EControl: HTMLInputElement;
declare const CControl: HTMLInputElement;
declare const seq1: HTMLElement | null;
declare const seq2: HTMLElement | null;
declare const seq3: HTMLElement | null;
declare const osc1: HTMLElement | null;
declare const osc2: HTMLElement | null;
declare const osc3: HTMLElement | null;
declare function linear(): Float32Array<ArrayBuffer>;
declare function sigmoid1(amount?: number): Float32Array<ArrayBuffer>;
declare function sigmoid2(amount?: number): Float32Array<ArrayBuffer>;
declare function sigmoid3(amount?: number): Float32Array<ArrayBuffer>;
declare function getProcessorModules(): Promise<void>;
declare function integrateNumericalTrapezoidal(data: Float32Array<ArrayBuffer>): number;
declare function peak(data: Float32Array<ArrayBuffer>): number;
declare function analyzePeak(node: AnalyserNode | undefined): void;
declare function analyze(node: AnalyserNode | undefined): void;
declare function clamp(input: AudioNode): AudioWorkletNode;
declare function initMacros(): void;
declare function initOscillators(): void;
declare function initSequencers(): void;
declare function updateMacros(): boolean;
declare function updateOscillator(oscID: string): boolean;
declare function updateSequence(seqID: string): boolean;
declare function setupSequencer(seqID: string, oscFreq: number, oscVoic: number, inputNode: AudioNode): BiquadFilterNode | boolean;
declare function shutup(): void;
declare function soundAll(): void;
declare function sequencerEvent(event: Event): void;
declare let cache: ReturnType<typeof setTimeout>;
declare function setup(): Promise<void>;
//# sourceMappingURL=renderer.d.ts.map