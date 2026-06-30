"use strict";
class RMSProcessor extends AudioWorkletProcessor {
    logging;
    RMS;
    frames;
    interval;
    constructor() {
        super();
        this.logging = true;
        this.RMS = 0;
        this.frames = 0;
        this.interval = 4410;
    }
    process(inputs, outputs, parameters) {
        this.frames += 128;
        const inputLength = inputs.length;
        if (inputLength > 0 && this.frames >= this.interval) {
            this.frames = 0;
            for (let put = 0; put < inputLength; put++) {
                const input = inputs[put];
                if (input && input.every(item => item instanceof Float32Array)) {
                    let n = 0;
                    let powerSum = 0;
                    for (let channel = 0; channel < input.length; channel++) {
                        const inputChannel = input[channel];
                        if (inputChannel instanceof Float32Array) {
                            n += inputChannel.length;
                            powerSum += inputChannel.reduce((accumulator, value) => { return accumulator + value ** 2; }, 0);
                        }
                    }
                    const RMS = (powerSum / n) ** .5;
                    const logConvert = Math.log(RMS);
                    const levels = [0, -1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11, -12, -15, -18, -21, -24, -30];
                    let index = 0;
                    for (let i = 0; i < levels.length; i++) {
                        const level = levels[i];
                        if (level !== undefined && logConvert < level) {
                            index = i;
                        }
                    }
                    const out = levels[index];
                    if (out && this.logging) {
                        this.RMS = out;
                        this.port.postMessage({ msg: 'RMS', data: out, input: put });
                    }
                }
            }
        }
        return true;
    }
}
registerProcessor("RMS-processor", RMSProcessor);
//# sourceMappingURL=RMS-processor.js.map