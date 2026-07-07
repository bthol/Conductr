"use strict";
class PeakProcessor extends AudioWorkletProcessor {
    logging;
    peak;
    frames;
    interval;
    active;
    constructor() {
        super();
        this.logging = true;
        this.peak = 0;
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
        if (!this.active) {
            return false;
        }
        this.frames += 128;
        if (inputs.length > 0 && this.frames >= this.interval) {
            this.frames = 0;
            for (let put = 0; put < inputs.length; put++) {
                const input = inputs[put];
                if (input && input.every(item => item instanceof Float32Array)) {
                    let peak = 0;
                    for (let channel = 0; channel < input.length; channel++) {
                        const inputChannel = input[channel];
                        if (inputChannel instanceof Float32Array) {
                            for (let i = 0; i < inputChannel.length; i++) {
                                const x = inputChannel[i];
                                if (x && x > Math.abs(peak)) {
                                    peak = x;
                                }
                            }
                        }
                    }
                    const logConvert = 10 * Math.log10(peak);
                    const meterLevels = [0, -1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11, -12, -15, -18, -21, -24, -30];
                    let index = 0;
                    for (let i = 0; i < meterLevels.length; i++) {
                        const level = meterLevels[i];
                        if (level !== undefined && logConvert < level) {
                            index = i;
                        }
                    }
                    const out = meterLevels[index];
                    if (out !== undefined && this.logging) {
                        this.peak = out;
                        this.port.postMessage({ msg: 'peak', data: out, input: put });
                    }
                }
            }
        }
        return true;
    }
}
registerProcessor("peak-processor", PeakProcessor);
//# sourceMappingURL=peak-processor.js.map