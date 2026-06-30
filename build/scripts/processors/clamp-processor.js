"use strict";
class ClampProcessor extends AudioWorkletProcessor {
    count;
    logoff;
    lognum;
    maxlog;
    processed;
    active;
    constructor() {
        super();
        this.count = 0;
        this.logoff = false;
        this.lognum = 0;
        this.maxlog = 5;
        this.processed = 0;
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
        this.count++;
        if (inputs.length > 0) {
            for (let put = 0; put < outputs.length; put++) {
                const input = inputs[put];
                const output = outputs[put];
                if (input && output && input.every(item => item instanceof Float32Array) && output.every(item => item instanceof Float32Array)) {
                    for (let channel = 0; channel < output.length; channel++) {
                        const inputChannel = input[channel];
                        const outputChannel = output[channel];
                        if (inputChannel instanceof Float32Array && outputChannel instanceof Float32Array) {
                            for (let i = 0; i < outputChannel.length; i++) {
                                const out = Math.max(-1.0, Math.min(1.0, Number(inputChannel[i])));
                                outputChannel[i] = out;
                            }
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