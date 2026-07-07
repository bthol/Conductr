// LUFS-processor: sends calculated LUFS level as message to main process
// A factory function that accepts a class constructor
class LUFSProcessor extends AudioWorkletProcessor {
  logging: boolean;
  logs: number;
  active: boolean;
  ran: number;
  biquad1: BiquadFilter44100; // prefilter (head shadow typically below 800 Hz)
  biquad2: BiquadFilter44100; // RLB (Revised Low-frequency B-weighting) Curve High Pass
  block: Float32Array; // circular buffer
  blockIndex: number; // index for circular buffer
  sampleRate: number;
  window: number;
  sampleSize: number;
  LUFS: number;
  constructor() {
    super();
    this.logging = true; // single control to turn off logs
    this.logs = 0;
    this.LUFS = -100; // last LUFS value
    this.active = true; // kill switch for processor instance
    this.ran = 0;

    // processor parameters
    this.sampleRate = 44100; // sample rate in Hertz
    this.window = 400; // window of observation in milliseconds
    this.sampleSize = 128; // number of samples per process call (128 by default)

    // biquad filter initialization based on parameters

    // 48 KHz
    if (this.sampleRate === 48000) {
      // Stage 1: prefilter
      this.biquad1 = new BiquadFilter44100(1.53512485958697, -2.69169618940638, 1.19839281085285, 1.19839281085285,  0.73248077421585);
      // Stage 2: RLB Curve High Pass
      this.biquad2 = new BiquadFilter44100(1.0, -2.0, 1.0, -1.99004745483398, 0.99007225036621);
    
    // 44.1 KHz
    } else if (this.sampleRate === 44100) {
      // Stage 1: prefilter
      this.biquad1 = new BiquadFilter44100(1.4878, -1.5303, 0.4578, -1.7828, 0.8123);
      // Stage 2: RLB Curve High Pass
      this.biquad2 = new BiquadFilter44100(1.0, -2.0, 1.0, -1.9774, 0.9778);

    // Default
    } else {
      // default to 44.1 KHz sample rate if no match for this.sampleRate
      // Stage 1: prefilter
      this.biquad1 = new BiquadFilter44100(1.4878, -1.5303, 0.4578, -1.7828, 0.8123);
      // Stage 2: RLB Curve High Pass
      this.biquad2 = new BiquadFilter44100(1.0, -2.0, 1.0, -1.9774, 0.9778);
    }

    // 1 process call = 128 samples
    // 1 sample = a frame for every channel
    // standard block time duration is 400ms

    // formula derivation
    // Web Audio API sample rate = 44,100 cycles/second aka Hz
    // 44,100 * 1 second / 1000 ms = 44.1 cycles/ms
    // 1 cycle = 1 process call = 128 samples
    // 44.1 cycles/ms * 128 samples/cycle = 5,644.8 or ~5,644 samples/ms
    // 400 ms * 5,644.8 frames/ms per channel = 2,257,600 samples in 1 window period

    // formula definition
    // block size = sample rate * window / 1000
    // sample rate = 44100
    // samples per cycle = 128
    // window = 400
    // block size = 2,257,600
    // 32 bit / element * 2,257,600 elements = 72,243,200 bit fixed contiguous storage per block
    // block is a circular buffer that accumulate a block size worth of samples
    this.block = new Float32Array( this.sampleRate * this.window / 1000);
    this.blockIndex = 0;

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
    this.ran += 1;
    if (!this.active) {
      return false; // kills processor
    }
    
    // logging to renderer main process
    // if (this.logging && this.ran === 128) {
    //   this.ran = 0;
    //   this.port.postMessage({ msg: 'LUFS-processor ran', data: this.block});
    // }

    // count number of inputs
    // if (this.logging) {
    //   this.port.postMessage({ msg: 'inputs', number: inputs.length, count:this.count});
    // }

    // iterate for number of inputs
    const inputsLength: number = inputs.length;
    if (inputsLength > 0) {
        
      // Always use last input
      const input: Float32Array<ArrayBufferLike>[] | undefined = inputs[inputsLength - 1];
      
      // check input type
      if (input && input.every(item => item instanceof Float32Array)) {

        // average the frames at the same index in each channel and store as a single sample
        const samples: Float32Array<ArrayBufferLike> = new Float32Array(this.sampleSize);
        for (let sample = 0; sample < this.sampleSize; sample++) {
          let average: number = 0;
          for (let channel = 0; channel < input.length; channel++) {
            // each channel
            const inputChannel: Float32Array<ArrayBufferLike> | undefined = input[channel];
            
            // check inputChannel type
            if (inputChannel instanceof Float32Array) {
  
              // sum frames at channel index
              const frame: number | undefined = inputChannel[sample];
              if (frame !== undefined) {
                average += frame;
              }
            }
          }
          average /= this.sampleSize;
          samples[sample] = average;
        }

        // if (this.logging && this.ran === 128) {
        //   this.ran = 0;
        //   this.port.postMessage({ msg: 'LUFS-processor: samples', data: samples});
        // }

        // accumulate samples to block
        for (let sample = 0; sample < this.sampleSize; sample++) {
          const x: number | undefined = samples[sample];
          if (x !== undefined) {
            // this.block.set(new Float32Array([x]), this.blockIndex); // bulk update .set() method for single value
            this.block[this.blockIndex] = x; // single value update

            // this.logs += 1;
            // if (this.logging && this.logs === 100) {
            //   this.logs = 0;
            //   this.port.postMessage({
            //     msg: 'LUFS-processor: accumulation',
            //     sample: x,
            //     value: this.block[this.blockIndex],
            //     index: this.blockIndex
            //   });
            // }

            this.blockIndex += 1;
          }

          // this.logs += 1;
          // if (this.logging && this.logs === 100) {
          //   this.logs = 0;
          //   this.port.postMessage({
          //     msg: 'accumulating',
          //     index: this.blockIndex,
          //     n: this.block.length
          //   });
          // }
          
          // once fully accumulated
          if (this.blockIndex >= this.block.length) {
            this.blockIndex = 0; // wrap index back to start or circle buffer

            // if (this.logging) {
            //   this.port.postMessage({
            //     msg: 'fully accumulated',
            //     data: this.block,
            //     // index: this.blockIndex,
            //     // n: this.block.length
            //   });
            // }
            
            // Caclulate LUFS level (ITU-R BS.1770-4 standard)
            
            // Pre-filtering (k-weighting): A high-pass and high-frequency shelving filter are applied to model human hearing
            // ISO 226 (Fletcher-Munson curve) used to represent equal loudness across frequency on input signal
            // inverse A-weighting (nonstandard alternative to ISO 226)
            // K-weighting includes two cascaded filter stages: 1) high pass filter (spherical head simulation) and 2) a high shelf boost (RLB curve (Revised Low-Frequency B-weighting); more accurate than A-weighting)
            // both stages are implimented with a 2nd order Infinite Impulse Response (IIR) to smooth adjustment using feedback
            // use bilinear transform to calculate coefficients for Biquad filters in the 44.1 kHz sample rate used by Web Audio API
            
            const n: number = this.block.length;
            const weighted: Array<number> = new Array(n);
            for (let i = 0; i < n; i++) {
              let x: number | undefined = this.block[i];
              
              // Cascade the two filters
              if (x !== undefined) {
                x = this.biquad1.process(x); // prefilter
                x = this.biquad2.process(x); // RLB High Pass
                
                weighted[i] = x;
              }
            }
    
            // Channel Weighting (optional): reduce weight of channels on stereo edges
            // number of channels: below 3 channels, the signal doesn't have stereo edge defined by a channel
            // 3.1, 5.1, 7.1 Surround Systems may be able to route the channels at will to different speaker positions (channel indexes don't represent stereo positions)
            // and ammount of adjustment for channel intensity is determined for a single listener position (listeners may occupy multiple and changing positions)
            // so the channels which represent the stereo edge are indeterminant, the ammount by which the channel should be adjusted is indeterminant
            // Therefore, channel weighting can only be effectively accomplished with a playback system configuration, rather than as a signal process
            // It is acceptable then to accumulate from all channels into one circle buffer block, because there is no signal differentiation between channels
            // and accumulating from all channels prevents outliers in data from events exclusive to one channel
            
            // objective multichannel loudness measurement algorithm
    
            // Mean Square (MS): calculate the mean square of the filtered channel
            const powerSum: number = weighted.reduce((accumulator:number, value:number) => accumulator + value**2, 0);
            const MS: number = powerSum / n;
    
            // Gating: Relative
            // ignore LUFS levels -10 LU below mean square
            // Gating: Absolute
            
            // standard curve for dBFS (deciebels full scale) (except for +24 for meter adjustment)
            const logConvert: number = 10 * Math.log10(MS) + 24;

            if (this.logging) {
              // apply relative gating (remove 10+ LU drop)
              if (this.LUFS <= logConvert || Math.abs(this.LUFS - logConvert) < 10) {
                // use current LUFS reading

                // calculate nearest meter level (out) using 
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
                this.port.postMessage({
                  msg: 'LUFS',
                  // weighted: weighted,
                  // meanSquare: MS,
                  logConvert: logConvert,
                  data: out
                });

                // save LUFS reading to buffer
                this.LUFS = logConvert;

              } else {
                // use last LUFS reading

                // calculate nearest meter level (out)
                const levels: Array<number> = [0, -1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11, -12, -15, -18, -21, -24, -30];
                let index: number = 0;
                for (let i = 0; i < levels.length; i++) {
                  const level: number | undefined = levels[i];
                  if (level !== undefined && this.LUFS < level) {
                    index = i;
                  }
                }
                const out: number | undefined = levels[index];

                // send calculated level as message to main process
                this.port.postMessage({
                  msg: 'LUFS (10+ LU drop)',
                  // weighted: weighted,
                  // meanSquare: MS,
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

    // Return true to keep the processor alive
    return true;
  }
}

// Simple Direct Form I/II Biquad implementation
class BiquadFilter44100 {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
  constructor(b0:number, b1:number, b2:number, a1:number, a2:number) {
    this.b0 = b0;
    this.b1 = b1;
    this.b2 = b2;
    
    this.a1 = a1;
    this.a2 = a2;
    
    // Delays
    this.x1 = 0;
    this.x2 = 0;
    
    this.y1 = 0;
    this.y2 = 0;
  }

  process(x:number) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    
    // Shift delays
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;

    return y;
  }
};

class RingBuffer {
  private buffer: Float32Array;
  private writeIndex: number = 0;
  private readIndex: number = 0;
  private capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Float32Array(capacity);
  }

  public write(data: Float32Array): void {
    const capacity: number = data.length;
    // Handle wrap-around scenarios
    if (this.writeIndex + data.length <= capacity) {
      this.buffer.set(data, this.writeIndex);
      this.writeIndex = (this.writeIndex + data.length) % capacity;
    } else {
      // Split the data chunk that overflows the buffer edge
      const firstPart = data.subarray(0, capacity - this.writeIndex);
      const secondPart = data.subarray(capacity - this.writeIndex);
      
      this.buffer.set(firstPart, this.writeIndex);
      this.buffer.set(secondPart, 0);
      this.writeIndex = secondPart.length;
    }
  };

  public read(): void {
    this.readIndex = 0;
  }
};

class CircularAudioBuffer {
  private buffer: Float32Array;
  private writePointer: number = 0;
  
  constructor(capacity: number) {
    this.buffer = new Float32Array(capacity);
  }

  public write(data: Float32Array): void {
    const capacity = this.buffer.length;
    
    // Handle wrap-around scenarios
    if (this.writePointer + data.length <= capacity) {
      this.buffer.set(data, this.writePointer);
      this.writePointer = (this.writePointer + data.length) % capacity;
    } else {
      // Split the data chunk that overflows the buffer edge
      const firstPart = data.subarray(0, capacity - this.writePointer);
      const secondPart = data.subarray(capacity - this.writePointer);
      
      this.buffer.set(firstPart, this.writePointer);
      this.buffer.set(secondPart, 0);
      this.writePointer = secondPart.length;
    }
  }
}


registerProcessor("LUFS-processor", LUFSProcessor);
