interface Window {
    electronAPI: {
        msg: (channel: string, message: string) => void;
        res: (callback: (data: any) => void) => void;
    };
}
declare const variance: number;
declare const options: Object;
declare const audioContext: AudioContext;
declare function getProcessorModules(): Promise<void>;
declare function analyze(node: AnalyserNode | undefined): void;
declare function clamp(input: AudioNode): AudioWorkletNode;
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
declare const breakerBtn: HTMLElement | null;
declare const playBtn: HTMLElement | null;
declare const stopBtn: HTMLElement | null;
declare const masterGainIn: HTMLInputElement;
declare const masterGainOut: HTMLInputElement;
declare const osc1: HTMLElement | null;
declare const osc2: HTMLElement | null;
declare const osc3: HTMLElement | null;
declare function shutup(): void;
declare function sound(): Promise<void>;
declare let cache: ReturnType<typeof setTimeout>;
declare function setup(): Promise<void>;
//# sourceMappingURL=renderer.d.ts.map