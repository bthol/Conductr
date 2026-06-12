// rerender file/ main process

// handles element navigation events
console.log("linked script");

// extend window interface with electronAPI for IPC
interface Window {
    electronAPI: {
        msg: (channel: string, message: string) => void;
        res: (callback: (data: any) => void) => void;
    }
};
// main process response handler
window.electronAPI.res((data) => {
    console.log(data);
});

// TESTING ELECTRONAPI
// DOM selections
// const btn1: HTMLElement | null = document.getElementById('btn1');
// const btn2: HTMLElement | null = document.getElementById('btn2');
// // DOM manipulation
// if (btn1) {
//     btn1.addEventListener('click', () => {
//         const channel: string = 'btn1-channel';
//         const message: string = 'ipc renderer to main';
//         console.log(message);
//         window.electronAPI.msg(channel, message);
//         btn1.innerText = `clicked`;
//         btn1.style.color = '#ff0000';
//     });
// }
// if (btn2) {
//     btn2.addEventListener('click', () => {
//         console.log('clicked btn2');
//         window.location.reload();
//     })
// }


// use Web Audio API
// look into tone.js: https://tonejs.github.io/
// channelCountMode, AnalyserNode.getFloatTimeDomainData()


// setup audio context
const options: Object = {'sampleRate': 44100.0, 'latencyHint': 'interactive'};
const audioContext: AudioContext = new AudioContext(options);

// declare global structures
let playback: boolean = false; // stores the program run state (run: true, off: false)
let oscillators: { [key: string]: any } = {}; // stores parameters for each oscilator from user parameters
let voices: Array<OscillatorNode> = []; // stores voices generated with parameter values
let analysis: {[key: string]: Array<AnalyserNode>} = {}; // first index = oscillator, second index = analyzer node for that oscillator

// parameter for master volume control

// 0.5 output == -6 dB
let master: number = .75; // 0 - 0.99
let FortePiano: number = 1; // 0 - 2
let creciendo: number = 4; // 1 - 10
let expressivity: number = 4; // 1 - 10
let variance: number = 4; // 1 - 10

let driveMult: number = 1; // 

// global dynamic modifiers
let Attack: number = 1; // 1 - 10
let Release: number = 1; // 1 - 10
let Sustain: number = 1; // 1 - 10

// DOM elements

// Player Controls
const masterGain = document.getElementById('master-gain') as HTMLInputElement; // Master Gain out

const breakerBtn: HTMLElement | null = document.getElementById('breaker');
const playBtn: HTMLElement | null = document.getElementById('play-btn');
const stopBtn: HTMLElement | null = document.getElementById('stop-btn');

// Conductor

// Vertical Plane
const FPControl = document.getElementById('forte-piano') as HTMLInputElement; // Master Gain in
const DMControl = document.getElementById('drive-multiplier') as HTMLInputElement; // Master Drive

// Horizontal Plane
const SControl = document.getElementById('staccato') as HTMLInputElement; // ASR dynamic control: attack
const LControl = document.getElementById('legato') as HTMLInputElement; // ASR dynamic control: release
const TControl = document.getElementById('tenuto') as HTMLInputElement; // ASR dynamic control: sustain
const VControl = document.getElementById('variability') as HTMLInputElement; // increases range of variability engine

// Saggital Plane
const EControl = document.getElementById('expressivity') as HTMLInputElement; // dry-wet FX control
const CControl = document.getElementById('creciendo') as HTMLInputElement; // intensity control

// Orchestra

// Section 1
const osc1: HTMLElement | null = document.getElementById('osc1');

// Section 2
const osc2: HTMLElement | null = document.getElementById('osc2');

// Section 3
const osc3: HTMLElement | null = document.getElementById('osc3');

// waveshaper functions
function linear(): Float32Array<ArrayBuffer> {
    // line from -1 to 1
    const n_samples: number = 44100;
    const line: Float32Array<ArrayBuffer> = new Float32Array(n_samples);
    const incriment: number = 2/n_samples;
    let y: number = -1;
    for (let x = 0; x < n_samples; x++) {
        line[x] = y;
        y += incriment;
    }
    line[n_samples/2] = 0; // ensure middle value is correct
    line[n_samples - 1] = 1; // ensure end value is correct
    return line;
};

function sigmoid1(amount = 2): Float32Array<ArrayBuffer> {
    // generates curve for waveshaper
    const n_samples: number = 44100;
    const curve: Float32Array<ArrayBuffer> = new Float32Array(n_samples);
    const k = typeof amount === 'number' ? amount >= 2 ? amount : 2 : 2;
    for (let i = 0; i < n_samples; ++i) {
        // Map array index to an input audio range of [-1, 1]
        const x = (i * 2) / n_samples - 1;
        
        // S-curve functions -- Soft-clipping Sigmoid
        const output: number = Math.tanh(x * k) / Math.tanh(k); // k = drive
        curve[i] = output < 1 ? output > -1 ? output : -1 : 1; // clamp values at max and min value
    }
    curve[n_samples - 1] = 1; // ensure end value is correct
    return curve;
};

function sigmoid2(amount = 2): Float32Array<ArrayBuffer> {
    // generates curve for waveshaper
    const n_samples: number = 44100;
    const curve: Float32Array<ArrayBuffer> = new Float32Array(n_samples);
    const k = typeof amount === 'number' ? amount >= 2 ? amount : 2 : 2;
    const deg = Math.PI / 180;
    
    for (let i = 0; i < n_samples; ++i) {
        // Map array index to an input audio range of [-1, 1]
        const x = (i * 2) / n_samples - 1;
        
        // S-curve functions -- Soft-clipping Sigmoid
        const output: number = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));

        // clamp values at max and min value
        curve[i] =  output < 1 ? output > -1 ? output : -1 : 1; // clamp values at max and min value
    }
    curve[n_samples - 1] = 1; // ensure end value is correct
    return curve;
};

function sigmoid3(amount = 1): Float32Array<ArrayBuffer> {
    // generates curve for waveshaper
    const n_samples: number = 44100;
    const curve: Float32Array<ArrayBuffer> = new Float32Array(n_samples);
    const k = typeof amount === 'number' ? amount >= 1 ? amount : 1 : 1;

    for (let i = 0; i < n_samples; ++i) {
        // Normalize array index i to the domain [-1, 1]
        const x: number = ((i / (n_samples - 1)) * 2 - 1) * k;
        
        // hyperbolic tangent function * k
        const output: number = (x / Math.sqrt(x * x + 1));

        // clamp values at max and min value
        curve[i] = output < 1 ? output > -1 ? output : -1 : 1;
    }
    curve[n_samples - 1] = 1; // ensure end value is correct
    return curve;
};

// custom processors
// I/O processor type convention: input type GainNode and output type GainNode
async function getProcessorModules() {
    // collects all processor scripts by adding their modules to the global audio context
    await audioContext.audioWorklet.addModule('./build/scripts/processors/clamp-processor.js');
    await audioContext.audioWorklet.addModule('./build/scripts/processors/LUFS-processor.js');
};

// Analysis Functions
function integrateNumericalTrapezoidal(data: Float32Array<ArrayBuffer>): number {
    // Trapezoidal method of numerical definite integration for a discrete data set (data)
    // The total interval of integration from a to b is divided into subintervals represented as trapezoids on their side

    // returns 0 if there is an undefined value in data
    // otherwise it returns the area of the wave off of equilibrium (a value of zero)
    // a.k.a. total power of the wave

    // Reimann's Integration is more efficient, but lacks the desired accuracy accomplished by the Trapezoidal Method
    // Simpson's Rule is more accurate (using parabolas), but more computationally complex,
    // especially since the Trapezoidal Method can be highly optimized for the use case of this function
    // x axis = array index = time
    // y axis = value at x index = amplitude
    // it is possible to use uniform grid optimization
    // becauase the data array is read at a constant rate,
    // so change in x is constant,
    // and no need for sorting x into incrimental order,
    // because indexes already are in incrimental order
    // Trapezoid Area = (b1 + b2)/2 * h
    // Area = delta x * ( (y0 + yn)/2 + SUM(y1, ..., yn-1) )
    // Area = ( (y0 + yn)/2 + SUM(y1, ..., yn-1) ) // since delta x is 1 and anything multiplied by 1 is itself
    let Area: number = 0;
    for (let i = 1; i < data.length - 1; i++) {
        const y: number | undefined = data[i];
        if (y === undefined) {return 0} else {
            Area += Math.abs(y);
        }
    }
    const first: number | undefined = data[0];
    const last: number | undefined = data[data.length - 1];
    if (first === undefined || last === undefined) {return 0} else {
        Area += (Math.abs(first) + Math.abs(last)) / 2;
    }

    return Area;
};

// calculates peak level
function peak(data: Float32Array<ArrayBuffer>): number {
    let peak: number = 0;
    for (let i = 0; i < data.length; i++) {
        const datum: number | undefined = data[i];
        if (typeof datum === 'number') {
            const absValue = Math.abs(datum);
            if (absValue > peak) {
                peak = absValue;
            }
        }
    }
    return peak;
};

// analysis for peak levels
function analyzePeak(node: AnalyserNode | undefined) {
    // performs real-time analysis on peak value of data stream from analyser node
    if (node) {
        
        const bufferSize: number = 128; // number of samples per second
        node.fftSize = bufferSize;
        node.maxDecibels = 6; // measure up to +6 dB to detect peaks over 0 dB
        node.minDecibels = -200; // measure down to ensure detection of dynamic behavior
        let data: Float32Array<ArrayBuffer> = new Float32Array(bufferSize);
    
        // console.log(audioContext.state); // should be "running"
        // console.log(node); // should not be undefined + have updated properties

        let debounce: ReturnType<typeof setTimeout>;
        function loop(currentTime: number) {
            if (node) {
                clearTimeout(debounce);
                debounce = setTimeout(() => {
                    // cleanup timeout
                    clearTimeout(debounce);
                    // get data
                    node.getFloatTimeDomainData(data);
                    // calculate peak from data
                    const peakVal: number = peak(data);

                    // console.log(data);
                    console.log(peakVal);

                    requestAnimationFrame(loop);
                }, 1000)
            }
        };
    
        loop(audioContext.currentTime);

    }
};

// general analysis
function analyze(node: AnalyserNode | undefined) {
    // performs real-time analysis on analyser node
    // gets:
    //  - peak value

    if (node) {
        
        const bufferSize: number = 128; // number of samples per second
        node.fftSize = bufferSize;
        node.maxDecibels = 6; // measure up to +6 dB to detect peaks over 0 dB
        node.minDecibels = -200; // measure down to ensure detection of dynamic behavior
        let data: Float32Array<ArrayBuffer> = new Float32Array(bufferSize);
    
        // console.log(audioContext.state); // should be "running"
        // console.log(node); // should not be undefined + have updated properties

        let debounce: ReturnType<typeof setTimeout>;
        function loop(currentTime: number) {
            if (node) {
                clearTimeout(debounce);
                debounce = setTimeout(() => {
                    // cleanup timeout
                    clearTimeout(debounce);
                    // get data
                    node.getFloatTimeDomainData(data);
                    // calculate peak from data
                    const peakVal: number = peak(data);

                    // console.log(data);
                    // console.log(peakVal);

                    requestAnimationFrame(loop);
                }, 1000)
            }
        };
    
        loop(audioContext.currentTime);

    }
};

// clamp procesor ensures no audio peaking over 0 dB at the sample level
function clamp(input: AudioNode): AudioWorkletNode {

    // create processor node
    const processor = new AudioWorkletNode(audioContext, 'clamp-processor');

    // setup worklet dev logs
    processor.port.onmessage = (event) => {
        console.log('clamp-processor thread: ', event.data);
    };

    // connect input node to processor node
    input.connect(processor);

    // return worklet node for further routing
    return processor;
};

// audio functions
function shutup() {
    oscillators = {}; // clear oscilator data
    voices.forEach((osc) => { osc.stop(audioContext.currentTime) }); // mute each voice
    voices = []; // clear voices data
};

async function sound() {
    // generates voices from oscillators

    // clear your throat
    if (playback) {
        shutup();
    }

    // handle macros
    if (masterGain && DMControl && FPControl && CControl && VControl) {

        // obtain and sanitize user values from conductor module

        // Master Gain
        let masterVal: number = Number(masterGain.value);
        if (masterVal > 100) {
            masterVal = 100;
        } else if (masterVal < 0) {
            masterVal = 0;
        }
        master = masterVal/100;

        // Creciendo/Diminuendo = Intensity control
        let CreciendoVal: number = Number(CControl.value);
        const CreciendoRange: number = 10;
        // enforce range
        if (CreciendoVal > CreciendoRange) { // above max
            CreciendoVal = CreciendoRange;
        } else if (CreciendoVal < -CreciendoRange) { // below min
            CreciendoVal = -CreciendoRange;
        } else if (CreciendoVal > 0 && CreciendoVal % 1 !== 0) { // round + fractions up
            CreciendoVal = Math.ceil(CreciendoVal);
        } else if (CreciendoVal < 0 && CreciendoVal % 1 !== 0) { // round - fractions down
            CreciendoVal = Math.floor(CreciendoVal);
        }
        // convert scale
        if (CreciendoVal === 0) { // bypass
            creciendo = 1;
        } else if (CreciendoVal > 0) { // +
            creciendo = 1 + CreciendoVal/CreciendoRange;
        } else if (CreciendoVal < 0) { // -
            creciendo = 1 + CreciendoVal/CreciendoRange;
        } else { // bypass
            creciendo = 1;
            console.log('macro range error: creciendo/diminuendo');
        }

        // Expressivity = Envelope Multiplier
        let expVal: number = Number(FPControl.value);
        const expRange: number = 10;
        // enforce range
        if (expVal > expRange) { // above max
            expVal = expRange;
        } else if (expVal < -expRange) { // below min
            expVal = -expRange;
        } else if (expVal > 0 && expVal % 1 !== 0) { // round + fractions up
            expVal = Math.ceil(expVal);
        } else if (expVal < 0 && expVal % 1 !== 0) { // round - fractions down
            expVal = Math.floor(expVal);
        }
        // convert scale
        if (expVal === 0) { // bypass
            FortePiano = 1;
        } else if (expVal > 0) { // +
            FortePiano = 1 + expVal/expRange;
        } else if (expVal < 0) { // -
            FortePiano = 1 + expVal/expRange;
        } else { // bypass
            FortePiano = 1;
            console.log('macro range error: Expressivity');
        }

        // Major Gusto = Drive Multiplier
        let driveMultiplier: number = Number(DMControl.value); // control range: -10 - 0 | 0 - 30, converted range: 0 - 1 | 1 - 5, mult range: 0.1X - 5X 
        const driveMultRange: number = 3 * creciendo; // range of multiplication
        const driveMultGran: number = 10; // granularity per unit
        // enforce range
        if (driveMultiplier > driveMultGran * driveMultRange) { // above max
            driveMultiplier = driveMultGran * driveMultRange;
        } else if (driveMultiplier < -driveMultGran) { // blow min
            driveMultiplier = -driveMultGran;
        } else if (driveMultiplier > 0 && driveMultiplier % 1 !== 0) { // round + fractions up
            driveMultiplier = Math.ceil(driveMultiplier);
        } else if (driveMultiplier < 0 && driveMultiplier % 1 !== 0) { // round - fractions down
            driveMultiplier = Math.floor(driveMultiplier);
        }
        // convert scale
        if (driveMultiplier === 0) { // bypass
            driveMult = 1;
        } else if (driveMultiplier > 0) { // +
            driveMult = 1 + driveMultiplier/driveMultGran * creciendo; // 1/driveMultGran = 1 grain, 1 grain * driveMultiplier = number of grains
        } else if (driveMultiplier < 0) { // -
            driveMult = 1 + driveMultiplier/driveMultGran * creciendo;
        } else { // bypass
            driveMult = 1;
            console.log('macro range error: Drive Multiplier');
        }

        // Forte-Piano = oscillator pre-gain multiplier
        let inVal: number = Number(FPControl.value);
        const inRange: number = 50;
        // enforce range
        if (inVal > inRange) { // above max
            inVal = inRange;
        } else if (inVal < -inRange) { // below min
            inVal = -inRange;
        } else if (inVal > 0 && inVal % 1 !== 0) { // round + fractions up
            inVal = Math.ceil(inVal);
        } else if (inVal < 0 && inVal % 1 !== 0) { // round - fractions down
            inVal = Math.floor(inVal);
        }
        // convert scale
        if (inVal === 0) { // bypass
            FortePiano = 1;
        } else if (inVal > 0) { // +
            FortePiano = 1 + inVal/inRange;
        } else if (inVal < 0) { // -
            FortePiano = 1 + inVal/inRange;
        } else { // bypass
            FortePiano = 1;
            console.log('macro range error: Forte Piano');
        }

        // variability
        let vary: number = Number(VControl.value);
        // enforce range
        if (vary > 10) { // above max
            vary = 10;
        } else if (vary < 1) { // below min
            vary = 1;
        } else if (inVal % 1 !== 0) { // round + fractions up
            inVal = Math.ceil(inVal);
        }
        variance = vary;
    }

    // get user data + add data to oscillators structure
    const oscs: NodeListOf<Element> = document.querySelectorAll('.oscs');
    let gotit: boolean = true;
    for (const osc of oscs) {
        if (osc) {
            // oscillator elements
            const oscGain: HTMLInputElement | null = osc.querySelector('.amplitude');
            const oscDriv: HTMLInputElement | null = osc.querySelector('.drive');
            const oscDrCh: HTMLInputElement | null = osc.querySelector('.drive-character');
            const oscVoic: HTMLInputElement | null = osc.querySelector('.voices');
            const oscFreq: HTMLInputElement | null = osc.querySelector('.frequency');
            const oscDetu: HTMLInputElement | null = osc.querySelector('.detune');
            const oscPart: HTMLInputElement | null = osc.querySelector('.partials');
            const oscType: HTMLInputElement | null = osc.querySelector('.type');

            // oscillator ID
            const ID: string | undefined = crypto.randomUUID().split('-')[0]; // generate a unique Oscillator ID

            // test oscilator element integrity
            if (oscGain && oscDriv && oscDrCh && oscVoic && oscFreq && oscDetu && oscPart && oscType && typeof ID === 'string') {
                
                // oscillator properties
                const gain: number = Number(oscGain.value);
                const drive: number = Number(oscDriv.value);
                const driveCharacter: string = oscDrCh.value;
                const voices: number = Number(oscVoic.value);
                const freq: number = Number(oscFreq.value);
                const detune: number = Number(oscDetu.value);
                const partials: number = Number(oscPart.value);
                const type: string = oscType.value;

                // VARIABILITY ENGINE

                // GAIN
                // logarithmic distribution of gain levels
                // ranges: 0 - 99 => 0/100 - 99/100 => 0 - +inf or lim1 => 0 - 1
                // FortePiano distributes levels below its percentage value within 0 - 99 range
                // makeup distributes levels below its value within 0 - 1 range
                // as frequency increases, gain variation increases; stable bass and dynamic trebble
                // with a variance of 2 (not accounting for factor) = minimum
                //  - 100 hz has max possible of 0.01
                //  - 1,000 hz has max possible of 0.1
                //  - 10,000 hz has max possible of 1
                //  - 20,000 hz has max possible of 2
                // with a variance of 4 (not accounting for factor) = default
                //  - 100 hz has max possible of 0.02
                //  - 1,000 hz has max possible of 0.2
                //  - 10,000 hz has max possible of 2
                //  - 20,000 hz has max possible of 4
                // with a variance of 10 (not accounting for factor) = maximum
                //  - 100 hz has max possible of 0.05
                //  - 1,000 hz has max possible of 0.5
                //  - 10,000 hz has max possible of 5
                //  - 20,000 hz has max possible of 10
                
                // FREQUENCY
                // uses same v value for frequency variation

                // random ammount of possible variance applied, adjusted by frequency
                // each property has a factor of variation, which when all are summed euqals 1
                const v: number = (variance * (freq / 20000)); // maximum possible variation
                
                // gain variation
                const gainFactor: number = .25; // 4:1  variation to gain
                const gainV: number = Math.random() * v*gainFactor; // variation ammount for gain
                const gainCalc: number = gain === 0 ? 0 : gain === 99 ? (1 - gainV - .01) * FortePiano : (-Math.log10(-(gain/100) + 1)/2 + gainV) * FortePiano;

                // frequency variation
                const freqFactor: number = .5; // 2:1  variation to frequency
                const freqV: number = Math.random() * v*freqFactor; // variation ammount for frequency
                const freqCalc: number = freq - freqV;

                // stereo varation
                const stereoFactor: number = .15 // 20:3 variation to stereo
                const stereoV: number = Math.random() * v*stereoFactor; // variation ammount for stereo

                // timbral variation
                const timbFactor: number = .1; // 10:1 variation to timbre

                // generate waveform
                const real: Float32Array = new Float32Array(partials); // real coefficients
                const imag: Float32Array = new Float32Array(partials); // imaginary coefficients
                let waveform: PeriodicWave; // use coefficients with Inverse Fast Fourier Transform (IFFT) to generate complex waveform
                if (type === 'sine') {
                    // DC offset
                    real[0] = 0;
                    imag[0] = 0;

                    // set partial
                    imag[1] = 1;

                    // use partial data to create custom waveform
                    waveform = audioContext.createPeriodicWave(real, imag);

                } else if (type === 'triangle') {
                    // DC offset
                    real[0] = 0;
                    imag[0] = 0;

                    // generate partials
                    for (let n = 1; n < partials + 1; n++) {
                        if (n % 2 !== 0) {
                            // Triangle wave uses only odd harmonics
                            // Formula: (8 / (pi^2)) * ((-1)^((n-1)/2) / n^2)
                            const sign: number = ((n - 1) / 2) % 2 === 0 ? 1 : -1;
                            const partial: number = (8 / Math.pow(Math.PI, 2)) * (sign / Math.pow(n, 2));
                            const cutoff: number = 500/20000; // percent hertz
                            const adjust: number = partial/cutoff; // adjust: variation increases above cutoff and decreases below
                            const timbCalc: number = (adjust * ( (Math.random() * (variance - 1) + 1) * timbFactor) );
                            imag[n] = partial + timbCalc; // account for variation on each partial
                            // imag[n] = partial;
                        } else {
                            // Even harmonics are zero
                            imag[n] = 0;
                        }
                        // Cosine terms are zero
                        real[n] = 0;
                    }

                    // use partial data to create custom waveform
                    waveform = audioContext.createPeriodicWave(real, imag);

                } else if (type === 'saw') {
                    // DC offset
                    real[0] = 0;
                    imag[0] = 0;

                    // generate partials
                    for (let n = 1; n < partials + 1; n++) {
                        const partial: number = 1 / (n * Math.PI);
                        const cutoff: number = 10000/20000; // percent hertz
                        const adjust: number = partial/cutoff; // adjust: variation increases above cutoff and decreases below
                        const timbCalc: number = (adjust * ( (Math.random() * (variance - 1) + 1) * timbFactor) );
                        imag[n] = partial + timbCalc;
                    }

                    // use partial data to create custom waveform
                    waveform = audioContext.createPeriodicWave(real, imag);

                } else if (type === 'square') {
                    // DC offset
                    real[0] = 0;
                    imag[0] = 0;

                    // generate partials
                    for (let n = 0; n < partials; n++) {
                        if (n % 2 !== 0) {
                            const partial: number = 4 / (n * Math.PI); // Fourier series coefficient for square wave
                            const cutoff: number = 1000/20000; // percent hertz
                            const adjust: number = partial/cutoff; // adjust: variation increases above cutoff and decreases below
                            const timbCalc: number = (adjust * ( (Math.random() * (variance - 1) + 1) * timbFactor) );
                            imag[n] = partial + timbCalc;
                        } else {
                            imag[n] = 0;
                        }
                    }

                    // use partial data to create custom waveform
                    waveform = audioContext.createPeriodicWave(real, imag);
                    
                } else if (type === 'inf-conv-geo-series-0.5') {
                    // DC offset
                    real[0] = 0;
                    imag[0] = 0;

                    // generate partials
                    let a: number = 0;
                    let b: number = 1;
                    for (let i = 1; i < partials; i++) {
                        real[i] = a;
                        imag[i] = b;
                        b *= .5;
                    }

                    // use partial data to create custom waveform
                    waveform = audioContext.createPeriodicWave(real, imag);
                
                } else if (type === 'inf-conv-geo-series-0.25') {
                    // DC offset
                    real[0] = 0;
                    imag[0] = 0;

                    // generate partials
                    let a: number = 0;
                    let b: number = 1;
                    for (let i = 1; i < partials; i++) {
                        real[i] = a;
                        imag[i] = b;
                        b *= .25;
                    }

                    // use partial data to create custom waveform
                    waveform = audioContext.createPeriodicWave(real, imag);
                } else if (type === 'inf-conv-geo-series-0.125') {
                    // DC offset
                    real[0] = 0;
                    imag[0] = 0;

                    // generate partials
                    let a: number = 0;
                    let b: number = 1;
                    for (let i = 1; i < partials; i++) {
                        real[i] = a;
                        imag[i] = b;
                        b *= .125;
                    }

                    // use partial data to create custom waveform
                    waveform = audioContext.createPeriodicWave(real, imag);

                } else {
                    // if no type detected, default to sine waveform

                    // DC offset
                    real[0] = 0;
                    imag[0] = 0;

                    // set partial
                    imag[1] = 1;

                    // use partial data to create custom waveform
                    waveform = audioContext.createPeriodicWave(real, imag);
                }

                // apply stereo variation via phazing


                // enforce ranges to validate user input and prevent variability engine from causing trouble
                
                // varied properties
                let gainVal: number = gainCalc;
                if (gainCalc >= 1) {
                    gainVal = 1 - gainV;
                } else if (gainCalc < 0) {
                    gainVal = 0;
                }
                let freqVal: number = freqCalc;
                if (freqVal > 20000) {
                    freqVal = 20000;
                } else if (freqVal < 20) {
                    freqVal = 20;
                }

                // unvaried properties
                let voiceVal: number = voices;
                if (voiceVal > 4) {
                    voiceVal = 4;
                } else if (voiceVal < 1) {
                    voiceVal = 1;
                }
                let driveVal: number = drive;
                if (driveVal > 10) {
                    driveVal = 10;
                } else if (driveVal < 1) {
                    driveVal = 1;
                }
                let detuneVal: number = detune;
                if (detuneVal > 24) {
                    detuneVal = 24;
                } else if (detuneVal < -24) {
                    detuneVal = -24;
                }
                // add oscillator to oscillators object
                const osc: {[key:string]: any} = {'waveform':waveform, 'oscVoices':voiceVal, 'gain':gainVal, 'drive':driveVal, 'driveCharacter': driveCharacter, 'freq':freqVal, 'detune':detuneVal};
                oscillators[ID] = osc;
                gotit = true;

            } else {
                console.log('parameter elements not found');
                gotit = false;
            }
        } else {
            console.log('oscillator element not found');
            gotit = false;
        }

        if (!gotit) {
            console.log('failed to set oscillator parameters');
            break;
        }
    }

    // generate voices
    if (gotit) {

        // create out nodes to route to after each voice generation
        const dry: GainNode = audioContext.createGain(); // no FX
        const wet: GainNode = audioContext.createGain(); // FX

        // iterate over every oscillator
        const keys: Array<string> = Object.keys(oscillators);
        for (const key of keys) {
    
            // collect oscillator properties
            const oscil: {[key:string]: any} = oscillators[key]; // each oscillator
            const waveform: PeriodicWave = oscil['waveform'];
            const oscVoic: number = oscil['oscVoices'];
            const oscFreq: number = oscil['freq'];
            const oscDetu: number = oscil['detune'];
            const oscVol: number = oscil['gain'];
            const oscDrive: number = oscil['drive'];
            const oscDriCh: string = oscil['driveCharacter'];
            
            // generator process route map
            // oscillator: voice > gain > waveshaper > makeup > dry
            //             voice >      > preAnalyzer         > postAnalyzer
            //             voice >                            > wet
            //             voice >
            
            // create gain node to apply pre gain value
            const gainNode: GainNode = audioContext.createGain();
            gainNode.gain.value = oscVoic === 0 ? 0 : oscVol / oscVoic; // set gain based on number of voices
            
            // create voices for oscilator
            for (let v = 0; v < oscVoic; v++) {
                // each voice from oscillator
                const osc: OscillatorNode = audioContext.createOscillator();
                // set waveform
                osc.setPeriodicWave(waveform);
                // set frequency
                osc.frequency.setValueAtTime(oscFreq, audioContext.currentTime);
                // set detune
                osc.detune.value = v * oscDetu;
                // connect each voice from the oscillator to pre gain node
                osc.connect(gainNode);
                // store pointer to oscillator in structure for global reference
                voices.push(osc);
            }
            
            // pre-analysis
            const preAnalyzer: AnalyserNode =  audioContext.createAnalyser();
            // store in global structure
            analysis[key] = []; // init key for osc in structure
            analysis[key].push(preAnalyzer); // add node to array at key in structure
            gainNode.connect(preAnalyzer);

            // sigmoid curve waveshaper distortion
            const makeupGainNode: GainNode = audioContext.createGain();
            console.log('drive');
            console.log(oscDrive);
            if (oscDrive > 1) {
                // build
                const waveshaper: WaveShaperNode = audioContext.createWaveShaper();
                const oversample: OverSampleType = '2x';
                let waveshaperCurve: Float32Array<ArrayBuffer>;
                if (oscDriCh === 'sigmoid1') {
                    waveshaperCurve = sigmoid1(oscDrive * driveMult);
                } else if (oscDriCh === 'sigmoid2') {
                    waveshaperCurve = sigmoid2(oscDrive * driveMult);
                } else if (oscDriCh === 'sigmoid3') {
                    waveshaperCurve = sigmoid3(oscDrive * driveMult);
                } else {
                    // default to sigmoid 3 if faulty string is provided
                    waveshaperCurve = sigmoid3(oscDrive * driveMult);
                }
                waveshaper.curve = waveshaperCurve; // Higher number = sharper S-curve / more saturation
                waveshaper.oversample = oversample; // Reduces aliasing distortion artifacting
                const referenceLine: Float32Array<ArrayBuffer> = linear();
                // Calculate the power difference and set makeup gain value to a corrective factor
                // i = total input power  = integration of line with 1 to 1 slope between gain and amplitude
                // f = total output power = integration of the waveshaper curve
                // factor i multiplies to produce f by the factor: 1 + ((f - i)/i)
                // reciprocal of factor: 1/(1+(f-i)/i)
                const initialPower: number = integrateNumericalTrapezoidal(referenceLine);
                const finalPower: number = integrateNumericalTrapezoidal(waveshaperCurve);
                const powerFactor: number = 1 / (1 + ((finalPower - initialPower) / initialPower));
                makeupGainNode.gain.value = powerFactor;

                // route
                gainNode.connect(waveshaper);
                waveshaper.connect(makeupGainNode);

            } else {

                // bypass drive
                gainNode.connect(makeupGainNode);
                makeupGainNode.gain.value = 1;
            }
            
            // post-analysis
            const postAnalyzer: AnalyserNode = audioContext.createAnalyser();
            analysis[key].push(postAnalyzer) // store in global structure
            makeupGainNode.connect(postAnalyzer);

            // route to dry and wet gain nodes for FX chain
            makeupGainNode.connect(dry);
            makeupGainNode.connect(wet);

        }

        // FX Process Route Map
        // Dry              > out
        // Wet > chain > FX > out

        // dry and wet ammount should combine to 1
        
        let dryVal: number = 0; // store dry ammount
        let wetVal: number = 1; // store wet ammount
        dry.gain.value = keys.length === 0 ? 0 : dryVal / keys.length; // adjust ammount by number of oscilators
        wet.gain.value = keys.length === 0 ? 0 : wetVal / keys.length; // adjust ammount by number of oscilators

        const FX: GainNode = audioContext.createGain(); // FX chain endpoint
        FX.gain.value = 1; // ensure level is not affected

        // before FX
        const preAnalysis: AnalyserNode = audioContext.createAnalyser();
        analysis['FX'] = []; // init key for osc in structure
        analysis['FX'].push(preAnalysis) // store in global structure
        wet.connect(preAnalysis);

        // after FX
        const postAnalysis: AnalyserNode = audioContext.createAnalyser();
        analysis['FX'].push(postAnalysis) // store in global structure
        FX.connect(postAnalysis);

        // FX Chain

        // Modulations
        //  - Ring Modulation (RM)
        //  - Pulse Width Modulation (PWM)
        //  - Frequency Modulation (FM)

        // Stereoizations
        //  - Stereo Multiplier (doubler)
        //  - Haas Effect (stereo delay)
        //  - Stereo Panner

        // Spatializations
        //  - Dymanic Delay Line (DDL)
        //  - Rverberation Module

        wet.connect(FX); // bypass FX chain

        // Master Process Route Map
        // Dry > 3Comp > Master Gain > clamp > out
        // FX  > 

        // 3Comp: generator dynamics system
        // -12 dB - -3 dB total range before brickwall
        // 3X compressors affecting that range
        // 3X 3 dB ranges in total range
        //  -12 dB - -9 dB -- 1:1.1 ratio
        //      - comp1: applies 1/3 of 1:3 ratio
        //  -9 dB - -6 dB  -- 1:4 ratio
        //      - comp1: applies 2/3 of 1:3 ratio
        //      - comp2: applies 1/2 of 1:2 ratio
        //  -6 dB - -3 dB  -- 1.6 ratio
        //      - comp1: applies 3/3 of 1:3 ratio
        //      - comp2: applies 2/2 of 1:2 ratio
        //  -3 dB - 0 dB   -- 1:20 ratio
        //      - comp1: applies 3/3 of 1:3 ratio
        //      - comp2: applies 2/2 of 1:2 ratio
        //      - comp3: applies 1/1 of 1:3.4 ratio

        // compress to put dynamics on a curve
        const compressor: DynamicsCompressorNode = audioContext.createDynamicsCompressor();
        compressor.threshold.value = -12; // Start compressing at -12 dB
        compressor.knee.value = 9;        // 9 dB knee (stops at brickwall threshold)
        compressor.ratio.value = 3;       // 1:3 ratio
        compressor.attack.value = 0.05;   // 1:2 with release
        compressor.release.value = 0.1;   // slows release to bring up lower dynamics
        dry.connect(compressor);
        FX.connect(compressor);
        
        // soft limit before critical range
        const limiter: DynamicsCompressorNode = audioContext.createDynamicsCompressor();
        limiter.threshold.value = -6;    // limit at -9 dB
        limiter.knee.value = 3;          // 3 dB knee (full effect starts at beginning of critical range: -6 dB)
        limiter.ratio.value = 2;         // 1:2 ratio (soft limit)
        limiter.attack.value = 0.05;     // 1:1 with release
        limiter.release.value = 0.05;
        compressor.connect(limiter);
        
        // brickwall at maximum value
        const brickwall: DynamicsCompressorNode = audioContext.createDynamicsCompressor();
        brickwall.threshold.value = -2.8; // brickwall at -2.8 dB
        brickwall.knee.value = 0;         // 0 dB knee for immediate effect
        brickwall.ratio.value = 3.4;      // 1:3.4 ratio (brickwall limit when combined with other compressors)
        brickwall.attack.value = 0;       // allow peaks
        brickwall.release.value = 0.1;
        limiter.connect(brickwall);

        // master gain control
        const masterGainNode: GainNode = audioContext.createGain();
        masterGainNode.gain.value = Number(masterGain.value)/100;
        brickwall.connect(masterGainNode);
        
        // clamp for 0 dB hard-clipping peak-elimination
        const clampOut: AudioWorkletNode = clamp(masterGainNode);
        clampOut.connect(audioContext.destination);
        
        // run voices
        for (const v of voices) {
            v.start(0);
        }

    }

    // get data from analyser nodes
    if (gotit) {
        const keys: Array<string> = Object.keys(analysis);
        // start with first oscillator
        const key: string | undefined = keys[0];
        if (typeof key === 'string') {
            const nodeList: AnalyserNode[] | undefined = analysis[key];
            if (nodeList) {
                // control which analyzers log data here

                // analyze(nodeList[0]) // preAnalysis for osc1
                // analyze(nodeList[1]) // postAnalysis for osc1

                // analyze(nodeList[0]) // preAnalysis for osc2
                // analyze(nodeList[1]) // postAnalysis for osc2

                // analyze(nodeList[0]) // preAnalysis for osc3
                // analyze(nodeList[1]) // postAnalysis for osc3
                
                // allstream logging (not reccomended; mixes data streams)
                // for (const node of nodeList) {
                //     analyze(node);
                // }
            }
        }
    }
};

// test UI integrity, load processor modules, and setup listeners for user controls
let cache: ReturnType<typeof setTimeout> = setTimeout(() => {}, 0);
async function setup(): Promise<void> {

    // test UI integrity
    if (playBtn && stopBtn && breakerBtn && masterGain && FPControl && CControl && VControl && osc1 && osc2 && osc3) {

        // load processor modules
        await getProcessorModules();
        
        // setup listeners for user controls
        const latency: number = 150; // millisecs
        let listening: boolean = true;

        // playback controls

        // mute voices and clear osc and voice data, generate osc and voice data and play voices
        playBtn.addEventListener('click', () => {
            if (listening) {
                clearTimeout(cache);
                cache = setTimeout(() => {
                    clearTimeout(cache);
                    listening = false;
                    sound(); // don't listen until sound is done
                    listening = true;
                    playback = true;
                }, latency)
            }
        });
    
        // mute all and clear voices
        stopBtn.addEventListener('click', () => {
            if (listening) {
                clearTimeout(cache);
                cache = setTimeout(() => {
                    clearTimeout(cache);
                    shutup();
                    playback = false;
                }, latency)
            }
        });
    
        // breaker button reloads program
        breakerBtn.addEventListener('click', () => {window.location.reload()});

        // macros
        
        // controls master audio level
        masterGain.addEventListener('input', () => {
            if (listening && playback) {
                clearTimeout(cache);
                cache = setTimeout(() => {
                    clearTimeout(cache);
                    sound();
                }, latency);
            }
        });
    
        // controls gain for all oscillators
        FPControl.addEventListener('input', () => {
            if (listening && playback) {
                clearTimeout(cache);
                cache = setTimeout(() => {
                    clearTimeout(cache);
                    listening = false;
                    sound(); // don't listen until sound is done
                    listening = true;
                }, latency);
            }
        });
    
        // controls intensity
        CControl.addEventListener('input', () => {
            if (listening && playback) {
                clearTimeout(cache);
                cache = setTimeout(() => {
                    clearTimeout(cache);
                    listening = false;
                    sound(); // don't listen until sound is done
                    listening = true;
                }, latency);
            }
        });
        
        // controls variability
        VControl.addEventListener('input', () => {
            if (playback) {
                clearTimeout(cache);
                cache = setTimeout(() => {
                    clearTimeout(cache);
                    sound();
                }, latency);
            }
        });

    }
};
setup();
