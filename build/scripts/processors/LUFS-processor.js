"use strict";
class LUFSProcessor extends AudioWorkletProcessor {
    logging;
    LUFS;
    frames;
    interval;
    active;
    constructor() {
        super();
        this.logging = true;
        this.LUFS = 0;
        this.frames = 0;
        this.interval = 4410;
        this.active = true;
        this.port.onmessage = (event) => {
            if (event.data.action === 'deactivate') {
                this.active = false;
            }
        };
    }
    process(inputs, outputs, parameters) {
        this.frames += 128;
        const inputsLength = inputs.length;
        if (inputsLength > 0 && this.frames >= this.interval) {
            this.frames = 0;
            for (let put = 0; put < inputsLength; put++) {
                const input = inputs[put];
                if (input && input.every(item => item instanceof Float32Array)) {
                    for (let channel = 0; channel < input.length; channel++) {
                        const inputChannel = input[channel];
                        if (inputChannel instanceof Float32Array) {
                            const powerSum = inputChannel.reduce((accumulator, value) => accumulator + value ** 2, 0);
                            const n = inputChannel.length;
                            const MS = powerSum / n;
                            const LUFS = 0;
                            const logConvert = Math.log(LUFS) * 8.65617;
                            const levels = [0, -1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11, -12, -15, -18, -21, -24, -30];
                            let index = 0;
                            for (let i = 0; i < levels.length; i++) {
                                const level = levels[i];
                                if (level !== undefined && logConvert < level) {
                                    index = i;
                                }
                            }
                            const out = levels[index];
                            if (out !== undefined && this.logging) {
                                this.LUFS = out;
                                this.port.postMessage({ msg: 'LUFS', data: out, input: put, channel: channel });
                            }
                        }
                    }
                }
            }
        }
        return true;
    }
}
registerProcessor("LUFS-processor", LUFSProcessor);
//# sourceMappingURL=LUFS-processor.js.map