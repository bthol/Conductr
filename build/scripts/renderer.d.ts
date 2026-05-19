interface Window {
    electronAPI: {
        msg: (channel: string, message: string) => void;
        res: (callback: (data: any) => void) => void;
    };
}
declare const btn1: HTMLElement | null;
declare const btn2: HTMLElement | null;
//# sourceMappingURL=renderer.d.ts.map