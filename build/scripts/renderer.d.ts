interface Window {
    electronAPI: {
        msg: (channel: string, message: string) => void;
        res: (callback: (data: any) => void) => void;
    };
}
declare const options: Object;
declare const audioContext: AudioContext;
declare const meterLevels: Array<number>;
declare let macros: {
    [key: string]: any;
};
declare let oscillators: {
    [key: string]: any;
};
declare let sequencers: {
    [key: string]: any;
};
declare let voices: Array<OscillatorNode>;
declare let sequences: {
    [key: string]: ReturnType<typeof setTimeout>;
};
declare let analysis: {
    [key: string]: Array<AnalyserNode>;
};
declare let audioWorkletNodes: Array<AudioWorkletNode>;
declare let playback: boolean;
declare let macrosInitialized: boolean;
declare let oscillatorsInitialized: boolean;
declare let sequencersInitialized: boolean;
declare const meterMaster: HTMLElement | null;
declare const meterFX: HTMLElement | null;
declare const meter1: HTMLElement | null;
declare const meter2: HTMLElement | null;
declare const meter3: HTMLElement | null;
declare const masterGain: HTMLInputElement;
declare const masterPan: HTMLInputElement;
declare const masterTempo: HTMLInputElement;
declare const masterMeasure: HTMLInputElement;
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
declare function renderLeveler(stages: number, levels: number, container: Element): void;
declare function renderMeterLevel(level: number, root: HTMLElement | null, selector: string): void;
declare function meanSquare(data: Float32Array<ArrayBuffer>): number;
declare function linear(): Float32Array<ArrayBuffer>;
declare function sigmoid1(amount?: number): Float32Array<ArrayBuffer>;
declare function sigmoid2(amount?: number): Float32Array<ArrayBuffer>;
declare function sigmoid3(amount?: number): Float32Array<ArrayBuffer>;
declare function getProcessorModules(): Promise<void>;
declare function clamp(input: AudioNode): AudioWorkletNode;
declare function peakLevel(input: AnalyserNode, root: HTMLElement | null, selector: string): void;
declare function RMSLevel(input: AnalyserNode, root: HTMLElement | null, selector: string): void;
declare function LUFSLevel(input: AnalyserNode, root: HTMLElement | null, selector: string): void;
declare function initMacros(): void;
declare function initOscillators(): void;
declare function initSequencers(): void;
declare function updateMacros(): boolean;
declare function updateOscillator(oscID: string): boolean;
declare function updateSequence(seqID: string): boolean;
declare function setupSequencer(seqID: string, oscFreq: number, oscVoic: number, inputNode: AudioNode): BiquadFilterNode | boolean;
declare function shutup(): void;
declare function soundAll(update?: string): void;
declare function sequencerEvent(event: Event): void;
declare function oscillatorEvent(event: Event): void;
declare let cache: ReturnType<typeof setTimeout>;
declare function setup(): Promise<void>;
//# sourceMappingURL=renderer.d.ts.map