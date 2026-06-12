interface Window {
    electronAPI: {
        msg: (channel: string, message: string) => void;
        res: (callback: (data: any) => void) => void;
    };
}
declare const options: Object;
declare const audioContext: AudioContext;
declare let playback: boolean;
declare let oscillators: {
    [key: string]: any;
};
declare let voices: Array<OscillatorNode>;
declare let analysis: {
    [key: string]: Array<AnalyserNode>;
};
declare let master: number;
declare let FortePiano: number;
declare let creciendo: number;
declare let expressivity: number;
declare let variance: number;
declare let driveMult: number;
declare let Attack: number;
declare let Release: number;
declare let Sustain: number;
declare const masterGain: HTMLInputElement;
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
declare function shutup(): void;
declare function sound(): Promise<void>;
declare let cache: ReturnType<typeof setTimeout>;
declare function setup(): Promise<void>;
//# sourceMappingURL=renderer.d.ts.map