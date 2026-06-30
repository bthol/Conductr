// clamp-processor: prevents peaking above 0 dB
class ClampProcessor extends AudioWorkletProcessor {
  // logging
  count: number;
  logoff: boolean;
  lognum: number;
  maxlog: number;
  processed: number;
  constructor() {
    super();
    // logging
    this.count = 0; // counts the number of calls to the process method per session
    this.logoff = false; // controls whether logging is active (true) or inactive (false)
    this.lognum = 0; // counts the number of logs to compare with maxlog
    this.maxlog = 5; // maximum number of logs per run
    this.processed = 0; // stores the number of inputs processed into outputs

    // Listen to messages from main thread
    // this.port.onmessage = (event) => {
    //   // ping response for testing messaging
    //   if (event.data.type === 'PING') {
    //     this.port.postMessage({ msg: 'clamp-processor pinged'});
    //   }
    // };

  }
  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean {
    // logging to renderer main process
    this.count++;
    // this.processed = 0;
    // if (!this.logoff) {
    //   this.lognum++;
    //   if (this.lognum >= this.maxlog) {this.logoff = true};
    //   this.port.postMessage({ msg: 'clamp-processor ran', count:this.count});
    // }
    // iterate over all inputs and corresponding outputs
    // assuming:
    //  - an equal number of inputs and outputs
    //  - a 1 to 1 input-to-output mapping
    // inputs greater than the largest output put index will be omitted
    // undefined inputs or outputs at a given put index will be omitted
    // undefined channels in each input and output for each put index will be omitted

    // count number of inputs and outputs
    // if (!this.logoff) {
    //   this.lognum++;
    //   if (this.lognum >= this.maxlog) {this.logoff = true};
    //   this.port.postMessage({ msg: 'inputs', number: inputs.length, count:this.count});
    //   this.port.postMessage({ msg: 'outputs:', number: outputs.length, count:this.count});
    // }

    // iterate for number of outputs over inputs and outputs
    if (inputs.length > 0) {
      for (let put = 0; put < outputs.length; put++) {
        
        // Take an input and an output at the same put index
        const input: Float32Array<ArrayBufferLike>[] | undefined = inputs[put];
        const output: Float32Array<ArrayBufferLike>[] | undefined = outputs[put];
        
        // check input and output types aren't undefined
        if (input && output && input.every(item => item instanceof Float32Array) && output.every(item => item instanceof Float32Array)) {
          // count number of channels
          // if (!this.logoff) {
          //   this.lognum++;
          //   if (this.lognum >= this.maxlog) {this.logoff = true};
          //   this.port.postMessage({ msg: `input ${put} channels`, number: input.length, count:this.count});
          //   this.port.postMessage({ msg: `output ${put} channels`, number: output.length, count:this.count});
          // }
          
          // iterate over all channels for each input and output at each put index
          for (let channel = 0; channel < output.length; channel++) {
            
            // each channel
            const inputChannel: Float32Array<ArrayBufferLike> | undefined = input[channel];
            const outputChannel: Float32Array<ArrayBufferLike> | undefined = output[channel];
            
            // check inputChannel and outputChannel types aren't undefined
            if (inputChannel instanceof Float32Array && outputChannel instanceof Float32Array) {
              
              // input data in each channel
              // if (!this.logoff) {
              //   this.lognum++;
              //   if (this.lognum >= this.maxlog) {this.logoff = true};
              //   this.port.postMessage({ msg: `input ${put} channel ${channel} data`, data: inputChannel, count:this.count});
              // }
              
              // processes audio in chunks of 128 samples
              // to prevent data loss by lengths greater than 128, iterate for number of samples in output channel
              for (let i = 0; i < outputChannel.length; i++) {
                // impliment logic for custom processing here
                // this.processed++; // optional value to determine number of inputs processed
                
                // Clamp the audio sample between -1.0 and 1.0 (0 dB limit)
                
                // process input
                const out: number = Math.max( -1.0, Math.min(1.0, Number(inputChannel[i]) ));
                
                // assign to output
                outputChannel[i] = out;
              }
              
              // ouput data in each channel
              // if (!this.logoff) {
              //   this.lognum++;
              //   if (this.lognum >= this.maxlog) {this.logoff = true};
              //   this.port.postMessage({ msg: `output ${put} channel ${channel} data`, data: outputChannel, count:this.count});
              // }

            }
          }
        }
      }
    }

    // Return true to keep the processor alive
    return true;
  }
}

registerProcessor("clamp-processor", ClampProcessor);
