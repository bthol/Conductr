interface Window {
    electronAPI: {
        msg: (channel: string, message: string) => void;
        res: (callback: (data: any) => void) => void;
    };
}
declare let variance: number;
declare const options: Object;
declare const audioContext: AudioContext;
declare function getProcessorModules(): Promise<void>;
declare function analyze(node: AnalyserNode | undefined): void;
declare function clamp(input: AudioNode): AudioWorkletNode;
declare function sigmoid(amount?: number): Float32Array<ArrayBuffer>;
declare let oscillators: {
    [key: string]: any;
};
declare let voices: Array<OscillatorNode>;
declare let analysis: {
    [key: string]: Array<AnalyserNode>;
};
declare let playback: boolean;
declare let maxIn: number;
declare let maxOut: number;
declare let master: number;
declare const breakerBtn: HTMLElement | null;
declare const playBtn: HTMLElement | null;
declare const stopBtn: HTMLElement | null;
declare const OscPreGain: HTMLInputElement;
declare const OscPostGain: HTMLInputElement;
declare const masterGain: HTMLInputElement;
declare const variability: HTMLInputElement;
declare const osc1: HTMLElement | null;
declare const osc2: HTMLElement | null;
declare const osc3: HTMLElement | null;
declare function shutup(): void;
declare function sound(): Promise<void>;
declare let cache: ReturnType<typeof setTimeout>;
declare function setup(): Promise<void>;
//# sourceMappingURL=renderer.d.ts.map