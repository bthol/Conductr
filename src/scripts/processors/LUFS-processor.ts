// LUFS-processor: sends calculated LUFS level as message to main process
class LUFSProcessor extends AudioWorkletProcessor {
  // logging
  logging: boolean;
  LUFS: number;
  frames: number;
  interval: number;
  constructor() {
    super();
    // logging
    this.logging = true; // controls whether logging is active (true) or inactive (false)
    this.LUFS = 0;
    this.frames = 0;
    this.interval = 4410; // @ 44.1kHz sample rate (0.02267573696145124716553287981859 ms/ 1 cycle, 100 ms / 4410 cycles)

    // Listen to messages from main thread
    // this.port.onmessage = (event) => {
    //   // ping response for testing messaging
    //   if (event.data.type === 'PING') {
    //     this.port.postMessage({ msg: 'RMS-processor pinged'});
    //   }
    // };

  }
  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean {
    this.frames += 128;
    // logging to renderer main process
    // if (this.logging) {
    //   this.port.postMessage({ msg: 'LUFS-processor ran',});
    // }

    // count number of inputs
    // if (this.logging) {
    //   this.port.postMessage({ msg: 'inputs', number: inputs.length, count:this.count});
    // }

    // iterate for number of inputs
    const inputsLength: number = inputs.length;
    if (inputsLength > 0 && this.frames >= this.interval) {
      this.frames = 0;
      for (let put = 0; put < inputsLength; put++) {
        
        // Take an input at a put index
        const input: Float32Array<ArrayBufferLike>[] | undefined = inputs[put];
        
        // check input type
        if (input && input.every(item => item instanceof Float32Array)) {
          
          // count number of channels in input
          // if (this.logging) {
          //   this.port.postMessage({ msg: `input ${put} channels`, number: input.length, count:this.count});
          // }
          
          // iterate over all channels for input at put index
          for (let channel = 0; channel < input.length; channel++) {
            
            // each channel
            const inputChannel: Float32Array<ArrayBufferLike> | undefined = input[channel];
            
            // check inputChannel type
            if (inputChannel instanceof Float32Array) {
              
              // input data in each channel
              // if (this.logging) {
              //   this.port.postMessage({ msg: `input ${put} channel ${channel} data`, data: inputChannel, count:this.count});
              // }
              
              // Caclulate LUFS level (ITU-R BS.1770-4 standard)

              // Pre-filtering (k-weighting): A high-pass and high-frequency shelving filter are applied to model human hearing
              // ISO 226 (Fletcher-Munson curve) used to represent equal loudness across frequency on input signal
              // inverse A-weighting (alternative to ISO 226)

              // Mean Square (MS): calculate the mean square of the filtered channel
              const powerSum: number = inputChannel.reduce((accumulator:number, value:number) => accumulator + value**2, 0);
              const n: number = inputChannel.length;
              const MS: number = powerSum / n;

              // Channel Weighting (optional): reduce weight of channels on stereo edges

              // Gating: Relative and Absolute gating
              const LUFS: number = 0;
              
              // convert to logarithmic scale
              const logConvert: number = LUFS;

              // calculate nearest meter level (out)
              const levels: Array<number> = [0, -1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11, -12, -15, -18, -21, -24, -30];
              let index: number = 0;
              for (let i = 0; i < levels.length; i++) {
                const level: number | undefined = levels[i];
                if (level !== undefined && logConvert < level) {
                  index = i;
                }
              }
              const out: number | undefined = levels[index];

              // send calculated level as message to main process
              if (out && this.logging) {
                this.LUFS = out;
                this.port.postMessage({ msg: 'LUFS', data: out, input: put, channel: channel});
              }

            }
          }
        }
      }
    }

    // Return true to keep the processor alive
    return true;
  }
}

registerProcessor("LUFS-processor", LUFSProcessor);
