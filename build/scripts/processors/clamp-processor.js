"use strict";
function isFloat32ArrayArray(input) {
    if (!Array.isArray(input))
        return false;
    if (input.length === 0)
        return true;
    return input.every(item => item instanceof Float32Array);
}
;
class ClampProcessor extends AudioWorkletProcessor {
    count;
    logoff;
    lognum;
    maxlog;
    processed;
    constructor() {
        super();
        this.count = 0;
        this.logoff = false;
        this.lognum = 0;
        this.maxlog = 5;
        this.processed = 0;
        this.port.onmessage = (event) => {
            if (event.data.type === 'PING') {
                this.port.postMessage({ msg: 'clamp-processor pinged' });
            }
        };
    }
    process(inputs, outputs, parameters) {
        this.count++;
        this.processed = 0;
        if (!this.logoff) {
            this.lognum++;
            if (this.lognum >= this.maxlog) {
                this.logoff = true;
            }
            ;
            this.port.postMessage({ msg: 'clamp-processor ran', count: this.count });
        }
        for (let put = 0; put < outputs.length; put++) {
            const input = inputs[put];
            const output = outputs[put];
            if (isFloat32ArrayArray(input) && isFloat32ArrayArray(output)) {
                for (let channel = 0; channel < output.length; channel++) {
                    const inputChannel = input[channel];
                    const outputChannel = output[channel];
                    if (inputChannel instanceof Float32Array && outputChannel instanceof Float32Array) {
                        if (!this.logoff) {
                            this.lognum++;
                            if (this.lognum >= this.maxlog) {
                                this.logoff = true;
                            }
                            ;
                            this.port.postMessage({ msg: `input ${put} channel ${channel} data`, data: inputChannel, count: this.count });
                        }
                        for (let i = 0; i < outputChannel.length; i++) {
                            const out = Math.max(-1.0, Math.min(1.0, Number(inputChannel[i])));
                            outputChannel[i] = out;
                        }
                        if (!this.logoff) {
                            this.lognum++;
                            if (this.lognum >= this.maxlog) {
                                this.logoff = true;
                            }
                            ;
                            this.port.postMessage({ msg: `output ${put} channel ${channel} data`, data: outputChannel, count: this.count });
                        }
                    }
                }
            }
        }
        return true;
    }
}
registerProcessor("clamp-processor", ClampProcessor);
//# sourceMappingURL=clamp-processor.js.map