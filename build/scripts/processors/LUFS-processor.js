"use strict";
class LUFSProcessor extends AudioWorkletProcessor {
    logging;
    logs;
    active;
    ran;
    biquad1;
    biquad2;
    block;
    blockIndex;
    sampleRate;
    window;
    sampleSize;
    LUFS;
    constructor() {
        super();
        this.logging = true;
        this.logs = 0;
        this.LUFS = -100;
        this.active = true;
        this.ran = 0;
        this.sampleRate = 44100;
        this.window = 400;
        this.sampleSize = 128;
        if (this.sampleRate === 48000) {
            this.biquad1 = new BiquadFilter44100(1.53512485958697, -2.69169618940638, 1.19839281085285, 1.19839281085285, 0.73248077421585);
            this.biquad2 = new BiquadFilter44100(1.0, -2.0, 1.0, -1.99004745483398, 0.99007225036621);
        }
        else if (this.sampleRate === 44100) {
            this.biquad1 = new BiquadFilter44100(1.4878, -1.5303, 0.4578, -1.7828, 0.8123);
            this.biquad2 = new BiquadFilter44100(1.0, -2.0, 1.0, -1.9774, 0.9778);
        }
        else {
            this.biquad1 = new BiquadFilter44100(1.4878, -1.5303, 0.4578, -1.7828, 0.8123);
            this.biquad2 = new BiquadFilter44100(1.0, -2.0, 1.0, -1.9774, 0.9778);
        }
        this.block = new Float32Array(this.sampleRate * this.window / 1000);
        this.blockIndex = 0;
        this.port.onmessage = (event) => {
            if (event.data.action === 'deactivate') {
                this.active = false;
            }
        };
    }
    process(inputs, outputs, parameters) {
        this.ran += 1;
        if (!this.active) {
            return false;
        }
        const inputsLength = inputs.length;
        if (inputsLength > 0) {
            const input = inputs[inputsLength - 1];
            if (input && input.every(item => item instanceof Float32Array)) {
                const samples = new Float32Array(this.sampleSize);
                for (let sample = 0; sample < this.sampleSize; sample++) {
                    let average = 0;
                    for (let channel = 0; channel < input.length; channel++) {
                        const inputChannel = input[channel];
                        if (inputChannel instanceof Float32Array) {
                            const frame = inputChannel[sample];
                            if (frame !== undefined) {
                                average += frame;
                            }
                        }
                    }
                    average /= this.sampleSize;
                    samples[sample] = average;
                }
                for (let sample = 0; sample < this.sampleSize; sample++) {
                    const x = samples[sample];
                    if (x !== undefined) {
                        this.block[this.blockIndex] = x;
                        this.blockIndex += 1;
                    }
                    if (this.blockIndex >= this.block.length) {
                        this.blockIndex = 0;
                        const n = this.block.length;
                        const weighted = new Array(n);
                        for (let i = 0; i < n; i++) {
                            let x = this.block[i];
                            if (x !== undefined) {
                                x = this.biquad1.process(x);
                                x = this.biquad2.process(x);
                                weighted[i] = x;
                            }
                        }
                        const powerSum = weighted.reduce((accumulator, value) => accumulator + value ** 2, 0);
                        const MS = powerSum / n;
                        const logConvert = 10 * Math.log10(MS) + 24;
                        if (this.logging) {
                            if (this.LUFS <= logConvert || Math.abs(this.LUFS - logConvert) < 10) {
                                const levels = [0, -1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11, -12, -15, -18, -21, -24, -30];
                                let index = 0;
                                for (let i = 0; i < levels.length; i++) {
                                    const level = levels[i];
                                    if (level !== undefined && logConvert < level) {
                                        index = i;
                                    }
                                }
                                const out = levels[index];
                                this.port.postMessage({
                                    msg: 'LUFS',
                                    logConvert: logConvert,
                                    data: out
                                });
                                this.LUFS = logConvert;
                            }
                            else {
                                const levels = [0, -1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11, -12, -15, -18, -21, -24, -30];
                                let index = 0;
                                for (let i = 0; i < levels.length; i++) {
                                    const level = levels[i];
                                    if (level !== undefined && this.LUFS < level) {
                                        index = i;
                                    }
                                }
                                const out = levels[index];
                                this.port.postMessage({
                                    msg: 'LUFS (10+ LU drop)',
                                    logConvert: logConvert,
                                    data: out
                                });
                            }
                        }
                        break;
                    }
                }
            }
        }
        return true;
    }
}
class BiquadFilter44100 {
    x1;
    x2;
    y1;
    y2;
    b0;
    b1;
    b2;
    a1;
    a2;
    constructor(b0, b1, b2, a1, a2) {
        this.b0 = b0;
        this.b1 = b1;
        this.b2 = b2;
        this.a1 = a1;
        this.a2 = a2;
        this.x1 = 0;
        this.x2 = 0;
        this.y1 = 0;
        this.y2 = 0;
    }
    process(x) {
        const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
        this.x2 = this.x1;
        this.x1 = x;
        this.y2 = this.y1;
        this.y1 = y;
        return y;
    }
}
;
registerProcessor("LUFS-processor", LUFSProcessor);
//# sourceMappingURL=LUFS-processor.js.map