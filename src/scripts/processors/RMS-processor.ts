// RMS-processor: sends calculated RMS level as message to main process
class RMSProcessor extends AudioWorkletProcessor {
  logging: boolean;
  RMS: number;
  frames: number;
  interval: number;
  active: boolean;
  constructor() {
    super();
    this.logging = true; // controls whether logging is active (true) or inactive (false)
    this.RMS = 0;
    this.frames = 0;
    this.interval = 4410; // @ 44.1kHz sample rate (0.02267573696145124716553287981859 ms/ 1 cycle, 100 ms / 4410 cycles)
    this.active = true;
    
    // Listen to messages from main thread
    this.port.onmessage = (event) => {
      // ping response for testing messaging
      // if (event.data.type === 'PING') {
      //   this.port.postMessage({ msg: 'RMS-processor pinged'});
      // }
      if (event.data.action === 'deactivate') {
        this.active = false;
      }
    };

  }
  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean {
    if (!this.active) {
      return false;
    }
    // logging to renderer main process
    // if (this.logging) {
    //   this.port.postMessage({ msg: 'RMS-processor ran', count:this.count});
    // }

    // count number of inputs
    // if (this.logging) {
    //   this.port.postMessage({ msg: 'inputs', number: inputs.length, count:this.count});
    // }

    // iterate for number of inputs
    this.frames += 128;
    const inputLength: number = inputs.length;
    if (inputLength > 0 && this.frames >= this.interval) {
      this.frames = 0;
      for (let put = 0; put < inputLength; put++) {
        
        // Take an input at a put index
        const input: Float32Array<ArrayBufferLike>[] | undefined = inputs[put];
        
        // check input type
        if (input && input.every(item => item instanceof Float32Array)) {
          
          // count number of channels in input
          // if (this.logging) {
          //   this.port.postMessage({ msg: `input ${put} channels`, number: input.length, count:this.count});
          // }
          
          // iterate over all channels for input at put index
          let n: number = 0;
          let powerSum: number = 0;
          for (let channel = 0; channel < input.length; channel++) {
            
            // each channel
            const inputChannel: Float32Array<ArrayBufferLike> | undefined = input[channel];
            
            // check inputChannel type
            if (inputChannel instanceof Float32Array) {
              
              // input data in each channel
              // if (this.logging) {
              //   this.port.postMessage({ msg: `input ${put} channel ${channel} data`, data: inputChannel});
              // }
              
              // accumulate values across channels
              n += inputChannel.length;
              powerSum += inputChannel.reduce((accumulator:number, value:number) => {return accumulator + value**2}, 0);

            }
          }

          // calculate rms with values accumulated from channels
          const RMS: number = (powerSum/n)**.5;

          // convert to logarithmic scale (let an RMS of 0.5 yield a value of -6 dB)
          // input range : 0 - 1
          // log range : -inf - 0
          // 8.655 = {.5, -5.999}, 8.658 = {.5, -6.001}, 8.6562 = {.5, -6.00002}, 8.65617 = {.5, -6}
          const logConvert: number = Math.log(RMS)*8.65617;

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
          if (out !== undefined && this.logging) {
            this.RMS = out;
            this.port.postMessage({ msg: 'RMS', data: out, input: put});
          }

        }
      }
    }

    // Return true to keep the processor alive
    return true;
  }
}

registerProcessor("RMS-processor", RMSProcessor);
