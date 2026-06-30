// renderer file/ main process

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
// channelCountMode, ConstantSourceNode, AudioBufferSourceNode


// create audio context
const options: Object = {'sampleRate': 44100.0, 'latencyHint': 'interactive'};
const audioContext: AudioContext = new AudioContext(options);

// declare contant features
const meterLevels: Array<number> = [0, -1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11, -12, -15, -18, -21, -24, -30];

// Preset structures
let macros: { [key: string]: any} = {
    // player control macros
    'master': .75, // 0 - 0.99
    'pan': 0, // -50 - 50
    'tempo': 128, // 1 - 200
    'beatsPerMeasure': 4, // 1 - 100
    // Conductor Macros
    'FortePiano': 1, // 0 - 2
    'creciendo': 5, // 1 - 10
    'expressivity': 4, // 1 - 10
    'variance': 4, // 1 - 10
    'driveMult': 1, // 1 - 10
    // dynamic modifiers
    'Attack': 3, // 1 - 10
    'Sustain': 5, // 1 - 10
    'Release': 4, // 1 - 1
}; // stores the parameters for each macro from user parameters; data for preset
let oscillators: { [key: string]: any } = {}; // stores parameters for each oscillator from user parameters; data for preset
let sequencers: { [key: string]: any } = {}; // stores parameters for each sequencer from user parameters; data for preset

// Playback structures
let voices: Array<OscillatorNode> = []; // stores voices generated with oscillator parameters
let sequences: {[key:string]: ReturnType<typeof setTimeout> } = {}; // stores cache for sequencer schedule caches
let analysis: {[key: string]: Array<AnalyserNode>} = {}; // first index = oscillator or sequencer, second index = analyzer node for that oscillator

// Status Booleans
let playback: boolean = false; // stores the program run state (run: true, off: false)
let macrosInitialized: boolean = false; // boolean for testing initialization status
let oscillatorsInitialized: boolean = false; // boolean for testing initialization status
let sequencersInitialized: boolean = false; // boolean for testing initialization status

// DOM elements

// Meters
const meterMaster = document.getElementById('meter-master'); // master levels
const meterFX = document.getElementById('meter-FX'); // FX levels
const meter1 = document.getElementById('meter-1'); // 
const meter2 = document.getElementById('meter-2'); // 
const meter3 = document.getElementById('meter-3'); // 

// Player Controls
const masterGain = document.getElementById('master-gain') as HTMLInputElement; // Master Gain out
const masterPan = document.getElementById('master-pan') as HTMLInputElement; // Master Stereo Pan
const masterTempo = document.getElementById('master-tempo') as HTMLInputElement; // Tempo = Beats per Minute
const masterMeasure = document.getElementById('master-beat-per-measure') as HTMLInputElement; // Time Signature = Beats per Measure

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

// Circuit

// wire 1
const seq1: HTMLElement | null = document.getElementById('seq1');

// wire 2
const seq2: HTMLElement | null = document.getElementById('seq2');

// wire 3
const seq3: HTMLElement | null = document.getElementById('seq3');

// Orchestra

// 1st Section
const osc1: HTMLElement | null = document.getElementById('osc1');

// 2nd Section
const osc2: HTMLElement | null = document.getElementById('osc2');

// 3rd Section
const osc3: HTMLElement | null = document.getElementById('osc3');

// GUI functions
function renderLeveler(stages:number, levels:number, container:Element): void {
    // clear previous elements
    container.innerHTML = '';
    // create new elements
    for (let s = 1; s < stages + 1; s++) {
        const stage: HTMLDivElement = document.createElement('div');
        stage.setAttribute('class', `leveler-stage-style stage-${s}`);
        for (let l = 0; l < levels; l++) {
            const level: HTMLDivElement = document.createElement('div');
            stage.appendChild(level);
        }
        if (stage.firstElementChild) {
            stage.firstElementChild.setAttribute('class', 'level-style');
        }
        container.appendChild(stage);
    }
};

function renderMeterLevel(level: number, root: HTMLElement | null, selector: string): void {
    if (root) {
        const container: HTMLElement | null = root.querySelector(`.${selector}`);
        if (container) {
            // remove old level
            container.querySelector('.on')?.classList.remove('on');
            // get new level
            const NodeList: NodeListOf<HTMLElement> = container.querySelectorAll('.gradation');
            let index: number = 0;
            for (let i = 0; i < meterLevels.length; i++) {
                const compare: number | undefined = meterLevels[i];
                if (compare && compare === level) {
                    index = i;
                    break;
                }
            }
            const node: HTMLElement | undefined = NodeList[index];
            if (node) {
                // add new level
                node.classList.add('on');
            } else {
                console.log('meter level rerender failed due to missing level element');
            }
        } else {
            console.log('meter level rerender failed due to faulty selector');
        }
    } else {
        console.log('meter level rerender failed due to missing root element');
    }
};

// waveshaper functions
function integrateNumericalTrapezoidal(data: Float32Array<ArrayBuffer>): number {
    // function purpose: calculate wave energy for automatic gain correction from waveshaper curve distortion

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

// custom processor import function
async function getProcessorModules(): Promise<void> {
    // collects all processor scripts by adding their modules to the global audio context
    // runs on initial setup
    await audioContext.audioWorklet.addModule('./build/scripts/processors/clamp-processor.js');
    await audioContext.audioWorklet.addModule('./build/scripts/processors/peak-processor.js');
    await audioContext.audioWorklet.addModule('./build/scripts/processors/RMS-processor.js');
    await audioContext.audioWorklet.addModule('./build/scripts/processors/LUFS-processor.js');
};

// Multi-thread Audio Processor Setup functions

// clamp procesor eliminates audio peaking over 0 dB at the sample level
function clamp(input: AudioNode): AudioWorkletNode {

    // create processor node
    const processor = new AudioWorkletNode(audioContext, 'clamp-processor');

    // setup worklet dev logs
    // processor.port.onmessage = (event) => {
    //     console.log('clamp-processor thread: ', event.data);
    // };

    // connect input node to processor node
    input.connect(processor);

    // return worklet node for further routing
    return processor;
};

// Peak processor measures the peak level over a 128 sample window
function peakLevel(input: AnalyserNode, root: HTMLElement | null, selector: string): void {
    // prevent function on null root
    if (root) {
        // create processor node
        const processor = new AudioWorkletNode(audioContext, 'peak-processor');
        // processor.channelCountMode = 'explicit'; // use channel count
        // processor.channelInterpretation = 'speakers'; // each channel is a different array
        // processor.channelCount = 2; // 2 stereo channels
    
        // setup worklet dev logs
        processor.port.onmessage = (event) => {
            // use data here
            // console.log('peak-processor thread: ', event.data);
            // render GUI state with data
            const level: number = event.data.data;
            renderMeterLevel(level, root, selector);
        };
    
        // connect input nodes to processor node
        input.connect(processor);
    } else {
        console.log('peak meter setup failed because root element not found');
    }
};

// RMS processor measures the root mean square level over a 128 sample window
function RMSLevel(input: AnalyserNode, root: HTMLElement | null, selector: string): void {
    // prevent function on null root
    if (root) {
        // create processor node
        const processor = new AudioWorkletNode(audioContext, 'RMS-processor');
        // processor.channelCountMode = 'explicit'; // use channel count
        // processor.channelInterpretation = 'speakers'; // each channel is a different array
        // processor.channelCount = 2; // 2 stereo channels

        // setup worklet dev logs
        processor.port.onmessage = (event) => {
            // use data here
            // console.log('RMS-processor thread: ', event.data);
            // render GUI state with data
            const level: number = event.data.data;
            renderMeterLevel(level, root, selector);
        };

        // connect input nodes to processor node
        input.connect(processor);
    } else {
        console.log('RMS meter setup failed because root element not found');
    }
}

// LUFS procesor measures Loudness Units relative to Full Scale over a 128 sample window
function LUFSLevel(input: AnalyserNode, root: HTMLElement | null, selector: string): void {
    // prevent function on null root
    if (root) {
        // create processor node
        const processor = new AudioWorkletNode(audioContext, 'LUFS-processor');
        // processor.channelCountMode = 'explicit'; // use channel count
        // processor.channelInterpretation = 'speakers'; // each channel is a different array
        // processor.channelCount = 2; // 2 stereo channels

        // setup worklet dev logs
        processor.port.onmessage = (event) => {
            // use data here
            // console.log('LUFS-processor thread: ', event.data);
            // render GUI state with data
            const level: number = event.data.data;
            renderMeterLevel(level, root, selector);
        };

        // connect input nodes to processor node
        input.connect(processor);
    } else {
        console.log('LUFS meter setup failed because root element not found');
    }
};

// Main Thread Analysis

// // calculates peak level
// function peakMain(data: Float32Array<ArrayBuffer>): number {
//     let peak: number = 0;
//     for (let i = 0; i < data.length; i++) {
//         const datum: number | undefined = data[i];
//         if (typeof datum === 'number') {
//             const absValue = Math.abs(datum);
//             if (absValue > peak) {
//                 peak = absValue;
//             }
//         }
//     }
//     return peak;
// };

// // setup peak level analysis on node
// function analyzePeakMain(node: AnalyserNode | undefined): void {
//     // performs real-time analysis on peak value of data stream from analyser node
//     if (node) {
        
//         const bufferSize: number = 128; // number of samples per second
//         node.fftSize = bufferSize;
//         node.maxDecibels = 6; // measure up to +6 dB to detect peaks over 0 dB
//         node.minDecibels = -200; // measure down to ensure detection of dynamic behavior
//         let data: Float32Array<ArrayBuffer> = new Float32Array(bufferSize);
    
//         // console.log(audioContext.state); // should be "running"
//         // console.log(node); // should not be undefined + have updated properties

//         let debounce: ReturnType<typeof setTimeout>;
//         function loop(currentTime: number) {
//             if (node) {
//                 clearTimeout(debounce);
//                 debounce = setTimeout(() => {
//                     // cleanup timeout
//                     clearTimeout(debounce);
//                     // get data
//                     node.getFloatTimeDomainData(data);
//                     // calculate peak from data
//                     const peakVal: number = peakMain(data);

//                     // console.log(data);
//                     console.log(peakVal);

//                     requestAnimationFrame(loop);
//                 }, 1000)
//             }
//         };
    
//         loop(audioContext.currentTime);

//     }
// };

// // setup general analysis on node
// function analyze(node: AnalyserNode | undefined): void {
//     // performs real-time analysis on analyser node
//     // gets:
//     //  - peak value

//     if (node) {
        
//         const bufferSize: number = 128; // number of samples per second
//         node.fftSize = bufferSize;
//         node.maxDecibels = 6; // measure up to +6 dB to detect peaks over 0 dB
//         node.minDecibels = -200; // measure down to ensure detection of dynamic behavior
//         let data: Float32Array<ArrayBuffer> = new Float32Array(bufferSize);
    
//         // console.log(audioContext.state); // should be "running"
//         // console.log(node); // should not be undefined + have updated properties

//         let debounce: ReturnType<typeof setTimeout>;
//         function loop(currentTime: number) {
//             if (node) {
//                 clearTimeout(debounce);
//                 debounce = setTimeout(() => {
//                     // cleanup timeout
//                     clearTimeout(debounce);
//                     // get data
//                     node.getFloatTimeDomainData(data);
//                     // calculate peak from data
//                     const peakVal: number = peakMain(data);

//                     // console.log(data);
//                     // console.log(peakVal);

//                     requestAnimationFrame(loop);
//                 }, 1000)
//             }
//         };
    
//         loop(audioContext.currentTime);

//     }
// };

// Data Handling Functions

// data initialization
function initMacros(): void {
    // model
    // player control macros
    macros['master'] = .75; // 0 - 0.99
    macros['pan'] = 0; // -50 - 50
    macros['tempo'] = 128; // 1 - 200
    macros['beatsPerMeasure'] = 4; // 1 - 100
    // Conductor Macros
    macros['FortePiano'] = 1; // 0 - 2
    macros['creciendo'] = 1; // 0 - 10
    macros['expressivity'] = 4; // 1 - 10
    macros['variance'] = 2; // 1 - 10
    macros['driveMult'] = 1; // 1 - 10
    // dynamic modifiers
    macros['Attack'] = 3; // 1 - 10
    macros['Sustain'] = 5; // 1 - 10
    macros['Release'] = 4; // 1 - 1

    // display
    if (masterGain && masterPan && DMControl && FPControl && CControl && VControl) { // test element integrity
        masterGain.value = '75'; // 0 - 100
        masterPan.value = '0'; // -50 - 50
        DMControl.value = '1'; // -10 - 30
        FPControl.value = '1'; // -50 - 50
        CControl.value = '0'; // -10 - 10
        VControl.value = '2'; // 1 - 10
    } else {
        console.log('macro display initialization failed');
    }
    
    // update status
    macrosInitialized = true;
};

function initOscillators(): void {
    oscillators = {}; // delete old data
    const oscsNodeList: NodeListOf<Element> = document.querySelectorAll('.oscs');
    let count: number = 0;
    for (const osc of oscsNodeList) {
        count += 1;

        // Model parameters
        const frequency: number = 65.4;
        const detune: number = -3;
        const partials: number = 256;

        // Generate a unique Oscillator ID
        const ID: string | undefined = crypto.randomUUID().split('-')[0];
        if (typeof ID === 'string') {
            // apply ID to HTML element
            osc.id = ID;
            // generate default waveform
            const v: number = (macros['variance'] * (frequency / 20000)); // maximum possible variation
            const timbFactor: number = .1; // 10:1 variation to timbre (partial phase shift)
            const stereoFactor: number = .15 // 20:3 variation to stereo
            const stereoV: number = Math.random() * v*stereoFactor / 1.5; // variation ammount for stereo: 0 - 1
            const phi: number = (1 + stereoV * 30) * Math.PI/180; // 1 - 46 deg => radians
            const phaze: number = Math.pow(Math.E, phi); // (vertical phaze; k-phase; k-scalar) stereo varation => % max degrees => radian phaze shift
            const real: Float32Array = new Float32Array(partials); // real coefficients
            const imag: Float32Array = new Float32Array(partials); // imaginary coefficients
            let waveform: PeriodicWave; // use coefficients with Inverse Fast Fourier Transform (IFFT) to generate complex waveform
            
            // DC offset (horizontal phaze)
            // automatically set to 0 by setPeriodicWave method
            // real[0] = 0;
            // imag[0] = 0;

            // generate partials
            for (let n = 1; n < partials + 1; n++) {
                if (n % 2 !== 0) {
                    // Triangle wave uses only odd harmonics
                    // Formula: (8 / (pi^2)) * ((-1)^((n-1)/2) / n^2)
                    const sign: number = ((n - 1) / 2) % 2 === 0 ? 1 : -1;
                    const partial: number = (8 / Math.pow(Math.PI, 2)) * (sign / Math.pow(n, 2)); // weights for cos component
                    const timbCalc: number = ((Math.random() * (macros['variance'] - 1) + 1) / 10 * timbFactor - .01) * sign; // timbral variation (amp and phase change per partial; partial non-linearity): 0 - .09
                    // const out: number = partial * phaze + timbCalc;
                    const out: number = partial + timbCalc;
                    imag[n] = out;
                } else {
                    // Even harmonics are zero
                    imag[n] = 0;
                }
                // Cosine terms are zero
                real[n] = 0;
            }

            // use partial data to create custom waveform
            waveform = audioContext.createPeriodicWave(real, imag);

            // structure
            oscillators[ID] = {
                'gain':.5, // 0 - 1
                'drive':1, // 1 - 10
                'driveCharacter':'sigmoid1', // option value string
                'oscVoices':3, // 1 - 4
                'freq':frequency, // 20 - 20,000
                'detune':detune, // -24 - 24
                'waveform':waveform, // periodic waveform
                'meterID': `meter-${count}`,
            };

        } else {
            console.log('Oscillator ID generation failed during initialization');
        }

        // Display
        
        // oscillator elements
        const oscGain: HTMLInputElement | null = osc.querySelector('.amplitude');
        const oscDriv: HTMLInputElement | null = osc.querySelector('.drive');
        const oscDrCh: HTMLInputElement | null = osc.querySelector('.drive-character');
        const oscVoic: HTMLInputElement | null = osc.querySelector('.voices');
        const oscFreq: HTMLInputElement | null = osc.querySelector('.frequency');
        const oscDetu: HTMLInputElement | null = osc.querySelector('.detune');
        const oscPart: HTMLInputElement | null = osc.querySelector('.partials');
        const oscType: HTMLInputElement | null = osc.querySelector('.type');

        // test oscilator element integrity + OSC ID
        if (oscGain && oscDriv && oscDrCh && oscVoic && oscFreq && oscDetu && oscPart && oscType) {
            // set Oscillator parameters to default
            oscGain.value = '50'; // 0 - 99
            oscDriv.value = '1'; // 1 - 10, 1 == bypass
            oscDrCh.value = 'sigmoid1';
            oscVoic.value = '3'; // 1 - 4
            oscFreq.value = `${frequency}`; // 20 - 20,000
            oscDetu.value = `${detune}`; // -24 - 24
            oscPart.value = `${partials}`; // 4 - 4096
            oscType.value = 'triangle';

        } else {
            console.log('parameter elements not found during initialization');
        }
    }

    // update status
    oscillatorsInitialized = true;
};

function initSequencers(): void {
    sequencers = {}; // delete old data
    const seqNodeList: NodeListOf<Element> = document.querySelectorAll('.seqs');
    for (const seq of seqNodeList) {
        
        // Model

        // Generate a unique Sequencer ID
        const ID: string | undefined = crypto.randomUUID().split('-')[0];
        if (typeof ID === 'string') {
            // apply ID to HTML element
            seq.id = ID;

            // setup and clear sequence schedule cache
            sequencers[ID] = setInterval(() => {}, 1000);
            clearInterval(sequences[ID]);

            // default model features
            sequencers[ID] = {
                'stages':4,
                'levels':25,
                'seqRate':'1/4',
                'type': 'lowpass',
                'cutoff': 1400,
                'resonance': 1,
                'ampMod':0,
                'filtMod':0,
                'freqMod':0,
                'ampLvls':[0, 0, 0, 0],
                'filtLvls':[0, 0, 0, 0],
                'freqLvls':[0, 0, 0, 0],
            };
        } else {
            console.log('Sequencer ID generation failed during initialization');
        }

        // Display

        // Sequencer Elements
        const stagesEl: HTMLInputElement | null = seq.querySelector('.stages');
        const levelsEl: HTMLInputElement | null = seq.querySelector('.stage-levels');
        const seqRateEl: HTMLInputElement | null = seq.querySelector('.sequence-rate');
        const filterTypeEL: HTMLInputElement | null = seq.querySelector('.filter-type');
        const filterCutoffEL: HTMLInputElement | null = seq.querySelector('.filter-cutoff');
        const filterResonanceEl: HTMLInputElement | null = seq.querySelector('.filter-resonance');
        const ampModEl: HTMLInputElement | null = seq.querySelector('.amp-mod');
        const filtModEl: HTMLInputElement | null = seq.querySelector('.filt-mod');
        const freqModEl: HTMLInputElement | null = seq.querySelector('.freq-mod');
        const ampSeqLvlsContEl: HTMLElement | null = seq.querySelector('.amp-sequence-leveler-container');
        const filtSeqLvlsContEl: HTMLElement | null = seq.querySelector('.filt-sequence-leveler-container');
        const freqSeqLvlsContEl: HTMLElement | null = seq.querySelector('.freq-sequence-leveler-container');

        if (stagesEl && levelsEl && seqRateEl && filterTypeEL && filterCutoffEL && filterResonanceEl && ampModEl && filtModEl && freqModEl && ampSeqLvlsContEl && filtSeqLvlsContEl && freqSeqLvlsContEl) {
            stagesEl.value = '4';
            levelsEl.value = '25';
            seqRateEl.value = '1/4';
            filterTypeEL.value = 'lowpass';
            filterCutoffEL.value = '1400';
            filterResonanceEl.value = '1';
            ampModEl.value = '0';
            filtModEl.value = '0';
            freqModEl.value = '0';

            const ampList: NodeListOf<Element> = ampSeqLvlsContEl.querySelectorAll('.leveler-stage-style');
            ampList.forEach((stage: Element) => {
                // remove current level
                stage.querySelector('.level-style')?.classList.remove('level-style');
                // add default level
                stage.firstElementChild?.classList.add('level-style');
            });

            const filtList: NodeListOf<Element> = filtSeqLvlsContEl.querySelectorAll('.leveler-stage-style');
            filtList.forEach((stage: Element) => {
                // remove current level
                stage.querySelector('.level-style')?.classList.remove('level-style');
                // add default level
                stage.firstElementChild?.classList.add('level-style');
            });

            const freqList: NodeListOf<Element> = freqSeqLvlsContEl.querySelectorAll('.leveler-stage-style');
            freqList.forEach((stage: Element) => {
                // remove current level
                stage.querySelector('.level-style')?.classList.remove('level-style');
                // add default level
                stage.firstElementChild?.classList.add('level-style');
            });

        } else {
            console.log('Sequencer parameter not found during initialization');
        }    
    }

    // update status
    sequencersInitialized = true;
};

// data update from user input
function updateMacros(): boolean {
    // collects macro control input data, enforces ranges and adjusts scale on input data, updates marco global variables with sanitized data
    
    if (masterGain && masterPan && masterTempo && masterMeasure && DMControl && FPControl && CControl && VControl) { // test element integrity

        // Master Gain
        let masterVal: number = Number(masterGain.value);
        // enforce range
        if (masterVal > 100) { // above max
            masterVal = 100;
        } else if (masterVal < 0) { // below min
            masterVal = 0;
        } else if (masterVal % 1 !== 0) { // round + fractions up
            masterVal = Math.ceil(masterVal);
        }
        // convert scale
        macros['master'] = masterVal/100;

        // Master Pan
        let masterPanVal: number = Number(masterPan.value);
        // enforce range
        if (masterPanVal > 50) { // above maximum
            masterPanVal = 50;
        } else if (masterPanVal < -50) { // below minimum
            masterPanVal = -50;
        } else if (masterPanVal % 1 !== 0) { // round fractions up
            masterPanVal = Math.ceil(masterPanVal);
        }
        // convert scale
        macros['pan'] = masterPanVal; // no conversion necessary

        // Master Tempo
        let tempoVal: number = Number(masterTempo.value);
        // enforce range
        if (tempoVal > 200) { // above maximum
            tempoVal = 200;
        } else if (tempoVal < 1) { // below minimum
            tempoVal = 1;
        } else if (tempoVal % 1 !== 0) { // round fractions up
            tempoVal = Math.ceil(tempoVal);
        }
        // convert scale
        macros['tempo'] = tempoVal; // no conversion necessary

        // Beats per Measure (Time Signature)
        let measureVal: number = Number(masterMeasure.value);
        // enforce range
        if (measureVal > 200) { // above maximum
            measureVal = 200;
        } else if (measureVal < 1) { // below minimum
            measureVal = 1;
        } else if (measureVal % 1 !== 0) { // round fractions up
            measureVal = Math.ceil(measureVal);
        }
        // convert scale
        macros['beatsPerMeasure'] = measureVal; // no conversion necessary

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
            macros['creciendo'] = 1;
        } else if (CreciendoVal > 0) { // +
            macros['creciendo'] = 1 + CreciendoVal/CreciendoRange;
        } else if (CreciendoVal < 0) { // -
            macros['creciendo'] = 1 + CreciendoVal/CreciendoRange;
        } else { // bypass
            macros['creciendo'] = 1;
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
            macros['FortePiano'] = 1;
        } else if (expVal > 0) { // +
            macros['FortePiano'] = 1 + expVal/expRange;
        } else if (expVal < 0) { // -
            macros['FortePiano'] = 1 + expVal/expRange;
        } else { // bypass
            macros['FortePiano'] = 1;
            console.log('macro range error: Expressivity');
        }

        // Major Gusto = Drive Multiplier
        let driveMultiplier: number = Number(DMControl.value); // control range: -10 - 0 | 0 - 30, converted range: 0 - 1 | 1 - 5, mult range: 0.1X - 5X 
        const driveMultRange: number = 3 * macros['creciendo']; // range of multiplication
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
            macros['driveMult'] = 1;
        } else if (driveMultiplier > 0) { // +
            macros['driveMult'] = 1 + driveMultiplier/driveMultGran * macros['creciendo']; // 1/driveMultGran = 1 grain, 1 grain * driveMultiplier = number of grains
        } else if (driveMultiplier < 0) { // -
            macros['driveMult'] = 1 + driveMultiplier/driveMultGran * macros['creciendo'];
        } else { // bypass
            macros['driveMult'] = 1;
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
            macros['FortePiano'] = 1;
        } else if (inVal > 0) { // +
            macros['FortePiano'] = 1 + inVal/inRange;
        } else if (inVal < 0) { // -
            macros['FortePiano'] = 1 + inVal/inRange;
        } else { // bypass
            macros['FortePiano'] = 1;
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
        macros['variance'] = vary;

        return true;

    } else {
        return false;
    }
};

function updateOscillator(oscID: string): boolean {
    // collects, validates, structures and stores oscillator data
    
    if (osc1 && osc2 && osc3) { // test element integrity

        // get user data + add data to oscillators structure
        const oscsNodeList: NodeListOf<Element> = document.querySelectorAll('.oscs');
        const oscsKeyArray: Array<string> = Object.keys(oscillators);
        let osc: Element | undefined = undefined;
        for (let i = 0; i < oscsKeyArray.length; i++) {
            const key: string | undefined = oscsKeyArray[i];
            if (key && key === oscID) {
                const result: Element | undefined = oscsNodeList[i];
                if (result) { osc = result }
                break;
            }
        }
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
            
            // test oscilator element integrity + OSC ID
            if (oscGain && oscDriv && oscDrCh && oscVoic && oscFreq && oscDetu && oscPart && oscType) {
                
                // Oscillator properties
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
                const v: number = (macros['variance'] * (freq / 20000)); // maximum possible variation
                
                // gain variation
                const gainFactor: number = .25; // 4:1  variation to gain
                const gainV: number = Math.random() * v*gainFactor; // variation ammount for gain
                const gainCalc: number = gain === 0 ? 0 : gain === 99 ? (1 - gainV - .01) * macros['FortePiano'] : (-Math.log10(-(gain/100) + 1)/2 + gainV) * macros['FortePiano'];
                
                // frequency variation
                const freqFactor: number = .5; // 2:1  variation to frequency
                const freqV: number = Math.random() * v*freqFactor; // variation ammount for frequency
                const freqCalc: number = freq - freqV;

                // stereo varation
                const stereoFactor: number = .15 // 20:3 variation to stereo
                const stereoV: number = Math.random() * v*stereoFactor / 1.5; // variation ammount for stereo: 0 - 1

                // timbral variation
                const timbFactor: number = .1; // 10:1 variation to timbre (partial phase shift)

                // enforce ranges to validate user input and prevent variability engine from causing trouble
                
                // varied properties

                // gain
                let gainVal: number = gainCalc;
                // enforce range
                if (gainCalc >= 1) { // above max
                    gainVal = 1 - gainV;
                } else if (gainCalc < 0) { // below min
                    gainVal = gainV;
                } else if (gainVal % 1 !== 0) { // round fraction up
                    gainVal = Math.ceil(gainVal);
                }

                // frequency
                let freqVal: number = freqCalc;
                // enforce range
                if (freqVal > 20000) {
                    freqVal = 20000 - freqV;
                } else if (freqVal < 20) {
                    freqVal = 20 + freqV;
                }

                // unvaried properties
                let voiceVal: number = voices;
                if (voiceVal > 4) { // above max
                    voiceVal = 4;
                } else if (voiceVal < 1) { // below min
                    voiceVal = 1;
                } else if (voiceVal % 1 !== 0) { // round fraction up
                    voiceVal = Math.ceil(voiceVal);
                }
                let driveVal: number = drive;
                if (driveVal > 10) { // above max
                    driveVal = 10;
                } else if (driveVal < 1) { // below min
                    driveVal = 1;
                } else if (driveVal % 1 !== 0) { // round fraction up
                    driveVal = Math.ceil(driveVal);
                }
                let detuneVal: number = detune;
                if (detuneVal > 24) { // above max
                    detuneVal = 24;
                } else if (detuneVal < -24) { // below min
                    detuneVal = -24;
                } else if (detuneVal % 1 !== 0) { // round fraction up
                    detuneVal = Math.ceil(detuneVal);
                }
                let partialsVal: number = partials;
                if (partialsVal > 4096) { // above max
                    partialsVal = 4096;
                } else if (partialsVal < 16) { // below min
                    partialsVal = 16;
                } else if (partialsVal % 1 !== 0) { // round fractions up
                    partialsVal = Math.ceil(partials);
                }

                // generate waveform
                // e^i*phi
                const phi: number = (1 + stereoV * 30) * Math.PI/180; // 1 - 46 deg => radians
                const phaze: number = Math.pow(Math.E, phi); // (vertical phaze; k-phase; k-scalar) stereo varation => % max degrees => radian phaze shift
                const real: Float32Array = new Float32Array(partialsVal); // real coefficients
                const imag: Float32Array = new Float32Array(partialsVal); // imaginary coefficients
                let waveform: PeriodicWave; // use coefficients with Inverse Fast Fourier Transform (IFFT) to generate complex waveform
                if (type === 'sine') {
                    // DC offset (horizontal phaze)
                    // automatically set to 0 by setPeriodicWave method
                    // real[0] = 0;
                    // imag[0] = 0;

                    // set partial
                    real[1] = 1 * Math.cos(phaze);
                    imag[1] = 1 * Math.sin(phaze);

                    // use partial data to create custom waveform
                    waveform = audioContext.createPeriodicWave(real, imag);

                } else if (type === 'triangle') {
                    // DC offset (horizontal phaze)
                    // automatically set to 0 by setPeriodicWave method
                    // real[0] = 0;
                    // imag[0] = 0;

                    // generate partials
                    for (let n = 1; n < partialsVal + 1; n++) {
                        if (n % 2 !== 0) {
                            // Triangle wave uses only odd harmonics
                            // Formula: (8 / (pi^2)) * ((-1)^((n-1)/2) / n^2)
                            const sign: number = ((n - 1) / 2) % 2 === 0 ? 1 : -1;
                            const partial: number = (8 / Math.pow(Math.PI, 2)) * (sign / Math.pow(n, 2)); // weights for cos component
                            const timbCalc: number = ((Math.random() * (macros['variance'] - 1) + 1) / 10 * timbFactor - .01) * sign; // timbral variation (amp and phase change per partial; partial non-linearity): 0 - .09
                            // const out: number = partial * phaze + timbCalc;
                            const out: number = partial + timbCalc;
                            imag[n] = out;
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
                    // DC offset (horizontal phaze)
                    // automatically set to 0 by setPeriodicWave method
                    // real[0] = 0;
                    // imag[0] = 0;

                    // generate partials
                    for (let n = 1; n < partialsVal + 1; n++) {
                        const partial: number = 1 / (n * Math.PI);
                        const timbCalc: number = (Math.random() * (macros['variance'] - 1) + 1) / 10 * timbFactor - 0.01; // timbral variation (amp phaze change per partial/harmonic): 0 - .09
                        const out: number = partial - timbCalc;
                        imag[n] = out;
                    }

                    // use partial data to create custom waveform
                    waveform = audioContext.createPeriodicWave(real, imag);

                } else if (type === 'square') {
                    // DC offset (horizontal phaze)
                    // automatically set to 0 by setPeriodicWave method
                    // real[0] = 0;
                    // imag[0] = 0;

                    // generate partials
                    for (let n = 0; n < partialsVal; n++) {
                        if (n % 2 !== 0) {
                            const partial: number = 4 / (n * Math.PI); // Fourier series coefficient for square wave
                            const timbCalc: number = (Math.random() * (macros['variance'] - 1) + 1) / 10 * timbFactor -.01; // timbral variation (amp phaze change per partial/harmonic): 0 - .09
                            const out: number = partial - timbCalc;
                            imag[n] = out;
                        } else {
                            imag[n] = 0;
                        }
                    }

                    // use partial data to create custom waveform
                    waveform = audioContext.createPeriodicWave(real, imag);
                    
                } else if (type === 'inf-conv-geo-series-0.5') {
                    // DC offset (horizontal phaze)
                    // automatically set to 0 by setPeriodicWave method
                    // real[0] = 0;
                    // imag[0] = 0;

                    // generate partials
                    let a: number = 0;
                    let b: number = 1;
                    for (let i = 1; i < partialsVal; i++) {
                        const timbCalc: number = (Math.random() * (macros['variance'] - 1) + 1) / 10 * timbFactor - 0.01; // timbral variation (amp phaze change per partial/harmonic): 0 - .09
                        const out: number = b - timbCalc;
                        real[i] = a;
                        imag[i] = out;
                        b *= .5;
                    }

                    // use partial data to create custom waveform
                    waveform = audioContext.createPeriodicWave(real, imag);
                
                } else if (type === 'inf-conv-geo-series-0.25') {
                    // DC offset (horizontal phaze)
                    // automatically set to 0 by setPeriodicWave method
                    // real[0] = 0;
                    // imag[0] = 0;

                    // generate partials
                    let a: number = 0;
                    let b: number = 1;
                    for (let i = 1; i < partialsVal; i++) {
                        const timbCalc: number = (Math.random() * (macros['variance'] - 1) + 1) / 10 * timbFactor - 0.01; // timbral variation (amp phaze change per partial/harmonic): 0 - .09
                        const out: number = b - timbCalc;
                        real[i] = a;
                        imag[i] = out;
                        b *= .25;
                    }

                    // use partial data to create custom waveform
                    waveform = audioContext.createPeriodicWave(real, imag);
                } else if (type === 'inf-conv-geo-series-0.125') {
                    // DC offset (horizontal phaze)
                    // automatically set to 0 by setPeriodicWave method
                    // real[0] = 0;
                    // imag[0] = 0;

                    // generate partials
                    let a: number = 0;
                    let b: number = 1;
                    for (let i = 1; i < partialsVal; i++) {
                        const timbCalc: number = (Math.random() * (macros['variance'] - 1) + 1) / 10 * timbFactor - 0.01; // timbral variation (amp phaze change per partial/harmonic): 0 - .09
                        const out: number = b - timbCalc;
                        real[i] = a;
                        imag[i] = out;
                        b *= .125;
                    }

                    // use partial data to create custom waveform
                    waveform = audioContext.createPeriodicWave(real, imag);

                } else if (type === 'inf-conv-geo-series-0.0625') {
                    // DC offset (horizontal phaze)
                    // automatically set to 0 by setPeriodicWave method
                    // real[0] = 0;
                    // imag[0] = 0;

                    // generate partials
                    let a: number = 0;
                    let b: number = 1;
                    for (let i = 1; i < partialsVal; i++) {
                        const timbCalc: number = (Math.random() * (macros['variance'] - 1) + 1) / 10 * timbFactor - 0.01; // timbral variation (amp phaze change per partial/harmonic): 0 - .09
                        const out: number = b - timbCalc;
                        real[i] = a;
                        imag[i] = out;
                        b *= .0625;
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

                // assign new oscillator data to initialized structure
                oscillators[oscID]['waveform'] = waveform;
                oscillators[oscID]['oscVoices'] = voiceVal;
                oscillators[oscID]['gain'] = gainVal;
                oscillators[oscID]['drive'] = driveVal;
                oscillators[oscID]['driveCharacter'] = driveCharacter;
                oscillators[oscID]['freq'] = freqVal;
                oscillators[oscID]['detune'] = detuneVal;
                return true;

            } else {
                console.log('parameter elements not found');
                return false;
            }
        } else {
            console.log('oscillator element not found');
            return false;
        }
    } else {
        console.log('oscillator element integrity degraded');
        return false;
    }
};

function updateSequence(seqID: string): boolean {
    // collects, validates, structures and stores sequencer data
    if (seq1 && seq2 && seq3) {
            
        // get user data + add to sequencers structure
        const seqs: NodeListOf<Element> = document.querySelectorAll('.seqs');
        const seqsKeyArray: Array<string> = Object.keys(sequencers);
        let seq: Element | undefined = undefined;
        for (let i = 0; i < seqsKeyArray.length; i++) {
            const key: string | undefined = seqsKeyArray[i];
            if (key && key === seqID) {
                const result: Element | undefined = seqs[i];
                if (result) { seq = result }
                break;
            }
        }
        
        // node itegrity
        if (seq) {
            // Sequencer Elements
            const stagesEl: HTMLInputElement | null = seq.querySelector('.stages');
            const levelsEl: HTMLInputElement | null = seq.querySelector('.stage-levels');
            const seqRateEl: HTMLInputElement | null = seq.querySelector('.sequence-rate');
            const filterTypeEL: HTMLInputElement | null = seq.querySelector('.filter-type');
            const filterCutoffEL: HTMLInputElement | null = seq.querySelector('.filter-cutoff');
            const filterResonanceEl: HTMLInputElement | null = seq.querySelector('.filter-resonance');
            const ampModEl: HTMLInputElement | null = seq.querySelector('.amp-mod');
            const filtModEl: HTMLInputElement | null = seq.querySelector('.filt-mod');
            const freqModEl: HTMLInputElement | null = seq.querySelector('.freq-mod');
            const ampSeqLvlsContEl: HTMLElement | null = seq.querySelector('.amp-sequence-leveler-container');
            const filtSeqLvlsContEl: HTMLElement | null = seq.querySelector('.filt-sequence-leveler-container');
            const freqSeqLvlsContEl: HTMLElement | null = seq.querySelector('.freq-sequence-leveler-container');

            if (stagesEl && levelsEl && seqRateEl && filterTypeEL && filterCutoffEL && filterResonanceEl && ampModEl && filtModEl && freqModEl && ampSeqLvlsContEl && filtSeqLvlsContEl && freqSeqLvlsContEl) {

                // Sequencer Parameters
                const stages: number = Number(stagesEl.value);
                const levels: number = Number(levelsEl.value);
                const seqRate: string = ['1/32', '1/16', '1/8', '1/4', '1/2', '1/1', '2/1'].includes(seqRateEl.value) ? seqRateEl.value : '1/4';
                const filtType: string = ['allpass', 'bandpass', 'highpass', 'highshelf', 'lowpass', 'lowshelf', 'notch', 'peaking'].includes(filterTypeEL.value) ? filterTypeEL.value : 'lowpass';
                const cutoff: number = Number(filterCutoffEL.value);
                const resonance: number = Number(filterResonanceEl.value);
                const ampMod: number = Number(ampModEl.value);
                const filtMod: number = Number(filtModEl.value);
                const freqMod: number = Number(freqModEl.value);

                // collect Amp level from each bar
                // collect Filter level from each bar
                // collect Frequency level from each bar
                const ampLvlsStageList: NodeListOf<Element> = ampSeqLvlsContEl.querySelectorAll('.leveler-stage-style');
                const filtLvlsStageList: NodeListOf<Element> = filtSeqLvlsContEl.querySelectorAll('.leveler-stage-style');
                const freqLvlsStageList: NodeListOf<Element> = freqSeqLvlsContEl.querySelectorAll('.leveler-stage-style');
                let ampLvls: Array<number> = []; // store levels
                let filtLvls: Array<number> = []; // store levels
                let freqLvls: Array<number> = []; // store levels
                for (let stage = 0; stage < stages; stage++) { // number of levels (stages) should be equal between amp, filt, and freq
                    const ampStageLevelList: NodeListOf<Element> | undefined = ampLvlsStageList[stage]?.querySelectorAll('div');
                    const filtStageLevelList: NodeListOf<Element> | undefined = filtLvlsStageList[stage]?.querySelectorAll('div');
                    const freqStageLevelList: NodeListOf<Element> | undefined = freqLvlsStageList[stage]?.querySelectorAll('div');
                    if (ampStageLevelList) { // get level from stage and store in array
                        for (let level = 0; level < levels; level++) { if (ampStageLevelList[level]?.classList.contains('level-style')) {
                            ampLvls.push(level);
                            break;
                        }}
                    } else { // preserve stage number index by NaN placeholder
                        ampLvls.push(NaN);
                    }
                    if (filtStageLevelList) { // get level from stage and store in array
                        for (let level = 0; level < levels; level++) { if (filtStageLevelList[level]?.classList.contains('level-style')) {
                            filtLvls.push(level);
                            break;
                        }}
                    } else { // preserve stage number index by NaN placeholder
                        filtLvls.push(NaN);
                    }
                    if (freqStageLevelList) { // get level from stage and store in array
                        for (let level = 0; level < levels; level++) { if (freqStageLevelList[level]?.classList.contains('level-style')) {
                            freqLvls.push(level);
                            break;
                        }}
                    } else { // preserve stage number index by NaN placeholder
                        freqLvls.push(NaN);
                    }
                }

                // assign new sequencer data to initialized structure
                sequencers[seqID]['stages'] = stages > 16 ? 16 : stages < 2 ? 2 : stages;
                sequencers[seqID]['levels'] = levels > 25 ? 25 : levels < 2 ? 2 : levels;
                sequencers[seqID]['seqRate'] = seqRate;
                sequencers[seqID]['filtType'] = filtType;
                sequencers[seqID]['cutoff'] = cutoff > 20000 ? 20000 : cutoff < 20 ? 20 : cutoff;
                sequencers[seqID]['resonance'] = resonance > 25 ? 25 : resonance < 0.1 ? 0.1 : resonance;
                sequencers[seqID]['ampMod'] = ampMod > 10 ? 10 : ampMod < 0 ? 0 : ampMod;
                sequencers[seqID]['filtMod'] = filtMod > 10 ? 10 : filtMod < -10 ? -10 : filtMod;
                sequencers[seqID]['freqMod'] = freqMod > 24 ? 24 : freqMod < -24 ? -24 : freqMod;
                sequencers[seqID]['ampLvls'] = ampLvls;
                sequencers[seqID]['filtLvls'] = filtLvls;
                sequencers[seqID]['freqLvls'] = freqLvls;
                return true;

            } else {
                console.log('Sequencer parameter not found');
                return false;
            }
        } else {
            console.log('Sequencer element not found');
            return false;
        }
    } else {
        console.log('sequencer element integrity degraded');
        return false;
    }
};

// setup functions
function setupSequencer(seqID:string, oscFreq:number, oscVoic:number, inputNode:AudioNode): BiquadFilterNode | boolean {
    if (sequencersInitialized) {
        // setup sequencer

        // 1 sequencer stage is a sequencer beat
        // 1 sequencer beat is a rate 

        // get sequencer data
        const seq = sequencers[seqID]; // sequencer object
        const levels: number = seq['levels']; // default = 25
        const type: BiquadFilterType = seq['filtType']; // default lowpass
        const cutoff: number = seq['cutoff']; // defualt 1000
        const resonance: number = seq['resonance']; // default 1
        let ampMod: number = seq['ampMod']; // 0 - 10
        let filtMod: number = seq['filtMod']; // 0 - 10
        let freqMod: number = seq['freqMod']; // -24 - 24
        const ampLvls: Array<number> = seq['ampLvls']; // amplitude control levels
        const filtLvls: Array<number> = seq['filtLvls']; // filter control levels
        const freqLvls: Array<number> = seq['freqLvls']; // frequency control levels
        const stages: number = Number(seq['stages']); // stages property of sequence object, number of stage durations per sequence
        // measures per minute  = beats per minute / beats per measure
        // minutes per measure = 1 / measures per minute
        // millisecs per measure = minutes per measure * (60 seconds / 1 minute) * (1000 millisecs / 1 second)
        const measureDuration: number = 1 / (macros['tempo'] / macros['beatsPerMeasure']) * 60 * 1000; // milliseconds per measure
        const rate: number = Number(seq['seqRate'].split('/')[0]) / Number(seq['seqRate'].split('/')[1]); // rate = percentage of measure per stage
        const stageDuration: number = measureDuration * rate; // measureDuration adjusted by rate
        // const sequenceDuration: number = stageDuration * stages; // duration of entire sequence

        // handle modifiers

        // enforce range
        if (ampMod > 10) { // above maximum
            ampMod = 10;
        } else if (ampMod < 0) { // below minimum
            ampMod = 0;
        } else if (ampMod % 1 !== 0) { // round fractions up
            ampMod = Math.ceil(ampMod);
        }
        // scale range
        ampMod = ampMod / 10; // 0 - 1

        // enforce range
        if (filtMod > 10) { // above maximum
            filtMod = 10;
        } else if (filtMod < -10) { // below minimum
            filtMod = -10;
        } else if (filtMod % 1 !== 0) { // round fractions up
            filtMod = Math.ceil(filtMod);
        }
        // scale range
        filtMod = (cutoff - 200) * (filtMod/10); // percentage down to min frequency

        // enforce range
        if (freqMod > 24) { // above maximum
            freqMod = 24;
        } else if (freqMod < -24) { // below minimum
            freqMod = -24;
        } else if (freqMod % 1 !== 0) { // round fractions up
            freqMod = Math.ceil(freqMod);
        }
        // scale range
        // freqMod = freqMod

        // get voices for sequencer frequency leveling
        let oscs: Array<OscillatorNode> = [];
        for (let voice = voices.length - oscVoic; voice < voices.length; voice++) {
            const v: OscillatorNode | undefined = voices[voice];
            if (v) { oscs.push(v) };
        }

        // create and configure sequencer nodes
        const gainNode: GainNode = audioContext.createGain(); // node to control amp leveling
        const filterNode: BiquadFilterNode = new BiquadFilterNode(audioContext, {
            type: type,
            frequency: cutoff,
            Q: resonance
        }); // node to control filter leveling
        inputNode.connect(gainNode);
        gainNode.connect(filterNode);
        
        // prime data for sequence performance
        for (let i = 0; i < stages; i++) {
            const amp: number | undefined = ampLvls[i]; // 0 - 25
            const filter: number | undefined = filtLvls[i]; // 0 - 25
            const frequency: number | undefined = freqLvls[i]; // -24 - 24
            // level percent of modifier scaled within property range
            if (amp !== undefined) {
                ampLvls[i] = amp / (levels - 1) * ampMod;
            }

            if (filter !== undefined) {
                filtLvls[i] = filter / (levels - 1) * filtMod;
            }

            if (frequency !== undefined) {
                // add ratio to 1 for pitch up and subtract ratio from 1 for pitch down and assign 1 to 0 values
                // l = leveler level (zero based)
                // n = number of values for level
                // k = number of maximum cents
                
                // f = ceil| l / (n - 1) * k |
                // f represents percentage of maximum cents for the level of a stage
                // r = {
                //     f > 0 : 1 + (f / 12)
                //     f < 0 : 1 + (f / 24 * .75)
                //     f = 0 : 1
                // }
                // r represents a ratio with a root frequency, whose product is a new frequency modified by f ammount
                const freq: number = Math.ceil(frequency / (levels - 1) * freqMod);
                const ratio: number = freq > 0 ? 1 + freq / 12 : freq < 0 ? 1 + (freq / 24 * .75) : 1;
                freqLvls[i] = ratio > 3 ? 3 : ratio < .25 ? .25 : ratio;
            }
        }

        // console.log('stage duration');
        // console.log(stageDuration);
        // console.log('Sequence Duration');
        // console.log(sequenceDuration);

        // console.log('amp mod');
        // console.log(ampMod);
        // console.log('filt mod');
        // console.log(filtMod);
        // console.log('freq mod');
        // console.log(freqMod);

        // console.log('amp');
        // console.log(ampLvls);
        // console.log('filter');
        // console.log(filtLvls);
        // console.log('frequency');
        // console.log(freqLvls);

        // set first stage of sequence
        const root: number = oscFreq; // stores root frequency for frequency sequence

        // set amp
        if (ampMod !== 0) {
            const amp: number | undefined = ampLvls[0];
            if (amp !== undefined) {
                gainNode.gain.value = amp;
            }
        }
        
        // set filter
        if (filtMod !== 0) {
            const filter: number | undefined = filtLvls[0];
            if (filter !== undefined) {
                filterNode.frequency.value = cutoff + filter;
            }
        }
        
        // set frequency
        if (freqMod !== 0) {
            const ratio: number | undefined = freqLvls[0];
            if (ratio !== undefined) {
                // voice frequency change spread
                oscs.forEach((osc) => {
                    osc.frequency.value = root * ratio;
                })
            }
        }

        // schedule sequence events using primed data
        let stage: number = 1; // start on second stage
        sequences[seqID] = setInterval(() => {
            // console.log('sequence');
            
            // set amp
            if (ampMod !== 0) {
                const amp: number | undefined = ampLvls[stage];
                if (amp !== undefined) {
                    gainNode.gain.value = amp;
                    // console.log(amp);
                }
            }
            
            // set filter
            if (filtMod !== 0) {
                const filter: number | undefined = filtLvls[stage];
                if (filter !== undefined) {
                    filterNode.frequency.value = cutoff + filter;
                    // console.log(cutoff + filter);
                }
            }
            
            // set frequency
            if (freqMod !== 0) {
                const ratio: number | undefined = freqLvls[stage];
                if (ratio !== undefined) {
                    // voice frequency change spread
                    // console.log(root * ratio);
                    oscs.forEach((osc) => {
                        osc.frequency.value = root * ratio;
                    })
                }
            }

            // prepare stage variable for next stage
            stage += 1;
            if (stage === stages) { // cycle back through sequence
                stage = 0;
            }

        }, stageDuration);

        return filterNode;

    } else {
        console.log(`cannot setup sequence ${seqID} before initialization`);
        return false;
    }
};

// playback functions
function shutup(): void {
    voices.forEach((osc) => { osc.stop(audioContext.currentTime) }); // mute each voice
    const sequenceKeys: Array<string> = Object.keys(sequences);
    for (const seqID of sequenceKeys) {clearInterval(sequences[seqID])} // stop each sequences
    voices = []; // clear voices data
    analysis = {}; // clear analysis data
};

function soundAll(update = 'all'): void {
    // stops all voices
    // stops all sequences
    // clears old voice data
    // data value determines updates
        // updates all macros data
        // updates all oscillators data
        // updates all sequencers data
    // regenerates all voices
    // sets up sequencer
    // sets up filter
    // sets up FX chain
    // sets up Analysis
    // plays all voices

    // update data
    let gotit: boolean = ['all', 'osc', 'seq'].includes(update); // falsification = terminates function
    !gotit && console.log('passed bad argument to update parameter in soundAll function');
    
    // clear your throat
    if (gotit) {
        if (playback) {shutup()};
    }
    
    // always update macros
    if (gotit) {
        if (update === 'all') {
            if (!updateMacros()) {gotit = false};
            // console.log('updated macros');
        }
    }
    
    // conditionally update oscillators
    if (gotit) {
        if (update === 'all' || update === 'osc') {
            const oscKeys: Array<string> = Object.keys(oscillators);
            if (oscKeys.length > 0) {
                for (const key of oscKeys) {
                    if (!updateOscillator(key)) {
                        gotit = false;
                        break;
                    }
                }
                // console.log('updated oscillators');
            } else {
                gotit = false;
                console.log('Failed to get oscillator keys during update');
            }
        }
    }

    // conditionally update sequencers
    if (gotit) {
        if (update === 'all' || update === 'seq' || update === 'osc') {
            const seqKeys: Array<string> = Object.keys(sequencers);
            if (seqKeys.length > 0) {
                for (const key of seqKeys) {
                    if (!updateSequence(key)) {
                        gotit = false;
                        break;
                    }
                }
                // console.log('updated sequencer');
            } else {
                gotit = false;
                console.log('Failed to get sequencer keys during update');
            }
        }
    }

    // generate voices from data
    if (gotit && playback) {

        // console.log(macros);
        // console.log(oscillators);
        // console.log(sequencers);

        // create out nodes to route to after each voice generation
        const dry: GainNode = audioContext.createGain(); // no FX
        const wet: GainNode = audioContext.createGain(); // FX

        // iterate over every oscillator
        const oscKeys: Array<string> = Object.keys(oscillators);
        const oscKeysLength: number = oscKeys.length;
        const seqKeys: Array<string> = Object.keys(sequencers);
        let seqKeyIndex: number = 0;
        for (const key of oscKeys) {
    
            // collect oscillator properties
            const oscil: {[key:string]: any} = oscillators[key]; // each oscillator
            const oscVoic: number = oscil['oscVoices'];
            const oscFreq: number = oscil['freq'];
            const oscDetu: number = oscil['detune'];
            const oscVol: number = oscil['gain'];
            const oscDrive: number = oscil['drive'];
            const oscDriCh: string = oscil['driveCharacter'];
            const waveform: PeriodicWave = oscil['waveform'];
            
            // generator process route map
            // oscillator: voice > gain > waveshaper > makeup > sequencer    > gain > dry
            //             voice >      > preAnalyzer         > postAnalyzer        > seqAnalyzer
            //             voice >                                                  > wet
            //             voice >
            
            // create gain node to apply pre gain value
            const gainNode: GainNode = audioContext.createGain();
            gainNode.gain.value = oscVoic === 0 ? 0 : oscVol / oscVoic; // set gain based on number of voices
            
            // create voices for oscilator
            for (let v = 0; v < oscVoic; v++) { // each oscillator
                // each voice from oscillator
                const osc: OscillatorNode = audioContext.createOscillator();
                // set waveform
                osc.setPeriodicWave(waveform);
                // set frequency
                osc.frequency.setValueAtTime(oscFreq, audioContext.currentTime);
                // set detune
                osc.detune.value = oscDetu/oscVoic * v;
                // connect each voice from the oscillator to pre gain node
                osc.connect(gainNode);
                // store pointer to oscillator in structure for global reference
                voices.push(osc);
            }

            // pre-analysis
            const preAnalyzer: AnalyserNode = audioContext.createAnalyser();
            // store in global structure
            analysis[key] = []; // init key for osc in structure
            analysis[key].push(preAnalyzer); // add node to array at key in structure
            gainNode.connect(preAnalyzer);

            // sigmoid curve waveshaper distortion
            const makeupGainNode: GainNode = audioContext.createGain();
            if (oscDrive > 1) {
                // build
                const waveshaper: WaveShaperNode = audioContext.createWaveShaper();
                const oversample: OverSampleType = '2x';
                let waveshaperCurve: Float32Array<ArrayBuffer>;
                if (oscDriCh === 'sigmoid1') {
                    waveshaperCurve = sigmoid1(oscDrive * macros['driveMult']);
                } else if (oscDriCh === 'sigmoid2') {
                    waveshaperCurve = sigmoid2(oscDrive * macros['driveMult']);
                } else if (oscDriCh === 'sigmoid3') {
                    waveshaperCurve = sigmoid3(oscDrive * macros['driveMult']);
                } else {
                    // default to sigmoid 3 if faulty string is provided
                    waveshaperCurve = sigmoid3(oscDrive * macros['driveMult']);
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

            // get sequence data
            const seqOut: GainNode = audioContext.createGain();
            const seqID: string | undefined = seqKeys[seqKeyIndex];
            if (seqID) {
                const seqNode: BiquadFilterNode | boolean = setupSequencer(seqID, oscFreq, oscVoic, makeupGainNode);
                if (typeof seqNode !== "boolean") {
                    // route to dry and wet gain nodes for FX chain through sequencer
                    seqNode.connect(seqOut);
                } else { // sequencer setup failed => bypass
                    // route to dry and wet gain nodes for FX chain bypassing sequencer
                    console.log('sequencer setup failed');
                    makeupGainNode.connect(seqOut);
                }
            } else {
                // route to dry and wet gain nodes for FX chain bypassing sequencer
                console.log('sequencer not found during setup');
                makeupGainNode.connect(seqOut);
            }
            seqKeyIndex += 1;
            seqOut.connect(dry);
            seqOut.connect(wet);

            // Analysis post sequence
            const seqAnalyzer: AnalyserNode = audioContext.createAnalyser();
            analysis[key].push(postAnalyzer) // store in global structure
            seqOut.connect(seqAnalyzer);
        }

        // FX Process Route Map
        // Dry              > out
        // Wet > chain > FX > out

        // dry and wet ammount should combine to 1
        
        let dryVal: number = 0; // store dry ammount
        let wetVal: number = 1; // store wet ammount
        dry.gain.value = oscKeysLength === 0 ? 0 : dryVal / oscKeysLength; // adjust ammount by number of oscilators
        wet.gain.value = oscKeysLength === 0 ? 0 : wetVal / oscKeysLength; // adjust ammount by number of oscilators

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

        // output analysis
        const masterAnalysis: AnalyserNode = audioContext.createAnalyser();
        analysis['master'] = []; // initialize master analysis key
        analysis['master'].push(masterAnalysis) // store in global structure
        masterGainNode.connect(masterAnalysis);

    }

    // setup analysis
    if (gotit && playback) {
        const keys: Array<string> = Object.keys(analysis);
        for (let key of keys) {
            const nodeList: AnalyserNode[] | undefined = analysis[key];
            if (nodeList) {
                // control which analyzers log data here
                // analysis[keys[key]] = list of AnalyzerNodes
                
                // Analyzer Nodes
                // generated ID key: pre analysis and post analysis for each oscillator
                // 'FX' key : pre FX analysis and post FX analysis
                // 'master' key:  master output analysis

                if (key === 'master') {
                    const out: AnalyserNode | undefined = nodeList[0];
                    if (out) {
                        // send to peak meter
                        peakLevel(out, meterMaster, 'true-peak-container');
                        // send to RMS meter
                        RMSLevel(out, meterMaster, 'RMS-container');
                        // send to LUFS meter
                        // LUFSLevel(out, meterMaster, 'LUFS-container');
                    }
                } else if (key === 'FX') {
                    // distinguish pre from post
                    const pre: AnalyserNode | undefined = nodeList[0];
                    if (pre) { // before FX chain
                       // send to pre FX meter
                       RMSLevel(pre, meterFX, 'pre-peak-container');
                    }

                    const post: AnalyserNode | undefined = nodeList[1];
                    if (post) { // after FX chain
                        // send to post FX meter
                        RMSLevel(post, meterFX, 'post-peak-container');
                    }
                } else { // oscillator
                    // get oscillator
                    const meterID = oscillators[key]['meterID'];
                    const root: HTMLElement | null = document.getElementById(meterID);
                    if (root) {
                        // distinguish pre from post from seq
                        const pre: AnalyserNode | undefined = nodeList[0];
                        if (pre) { // before distortion
                            // send to section meter
                            RMSLevel(pre, root, 'pre-peak-container');
                        }
    
                        const post: AnalyserNode | undefined = nodeList[1];
                        if (post) { // after distortion
                            // send to gusto meter
                            RMSLevel(post, root, 'post-peak-container');
                        }
                        
                        const seq: AnalyserNode | undefined = nodeList[2];
                        if (seq) { // after sequencer
                            // send to wire meter
                            RMSLevel(seq, root, 'seq-peak-container');
                        }
                    } else {
                        console.log('oscillator meter setup failed due to missing oscillator element');
                    }
                }
                
            }
        }
        
        // play voices
        for (const voice of voices) {
            voice.start();
        }
    }
};

function sequencerEvent(event: Event): void {
    // determine functionality by target of event
    // console.log('seq event');
    const target = event.target as HTMLElement;
    if (event.type === 'click') { // clicks are for levelers
        const parent: HTMLElement | null = target.parentElement;
        if (parent) {
            // determine sequencer ID
            const seqID: string | undefined = parent.parentElement?.parentElement?.parentElement?.parentElement?.parentElement?.id;
            if (seqID) {
                // sequencer[seqID] == sequencer in which the event occured
    
                // leveler control
                if (parent.classList.contains('leveler-stage-style')) {
                    // is leveler control type
                    if (!target.classList.contains('level-style')) {
                        // not a repeated level
            
                        // determine leveler type
                        const leveler: HTMLElement | null = parent.parentElement;
                        if (leveler) {
                            if (leveler.classList.contains('amp-sequence-leveler-container')) {
                                // determine which stage is being leveled
                                const stageNum: number | undefined = Number(parent.classList[1]?.split('-')[1]);
                                const stage: number = stageNum === undefined ? 0 : stageNum;
    
                                // determine new level
                                const levelList: NodeListOf<Element> = parent.querySelectorAll('div');
                                let level: number = 0;
                                for (const el of levelList) {
                                    if (el === target) {
                                        // remove previous level
                                        parent.querySelector('.level-style')?.classList.remove('level-style');
                                        // add current level
                                        el.classList.add('level-style');
                                        break;
                                    } else {
                                        level += 1;
                                    }
                                }
    
                                // apply change to model
                                sequencers[seqID]['ampLvls'][stage] = level;
    
                                // play sound with change
                                soundAll('seq');
                                
                            } else if (leveler.classList.contains('filt-sequence-leveler-container')) {
                                // determine which stage is being leveled
                                const stageNum: number | undefined = Number(parent.classList[1]?.split('-')[1]);
                                const stage: number = stageNum === undefined ? 0 : stageNum;
    
                                // determine new level
                                const levelList: NodeListOf<Element> = parent.querySelectorAll('div');
                                let level: number = 0;
                                for (const el of levelList) {
                                    if (el === target) {
                                        // remove previous level
                                        parent.querySelector('.level-style')?.classList.remove('level-style');
                                        // add current level
                                        el.classList.add('level-style');
                                        break;
                                    } else {
                                        level += 1;
                                    }
                                }
    
                                // apply change
                                sequencers[seqID]['filtLvls'][stage] = level;
                                
                                // play sound with change
                                soundAll('seq');
                                
                            } else if (leveler.classList.contains('freq-sequence-leveler-container')) {
                                // determine which stage is being leveled
                                const stageNum: number | undefined = Number(parent.classList[1]?.split('-')[1]);
                                const stage: number = stageNum === undefined ? 0 : stageNum;
    
                                // determine new level
                                const levelList: NodeListOf<Element> = parent.querySelectorAll('div');
                                let level: number = 0;
                                for (const el of levelList) {
                                    if (el === target) {
                                        // remove previous level
                                        parent.querySelector('.level-style')?.classList.remove('level-style');
                                        // add current level
                                        el.classList.add('level-style');
                                        break;
                                    } else {
                                        level += 1;
                                    }
                                }
    
                                // apply change
                                sequencers[seqID]['freqLvls'][stage] = level;
    
                                // play sound with change
                                soundAll('seq');
                            }
                        }
                    }
        
                }
    
            }
    
        }
    } else if (event.type === 'change') { // change is for sequence parameters
        // parametric leveler rerendering
        if (target.classList.contains('stages')) {
            // get seqID
            const seqID: string | undefined = target?.parentElement?.parentElement?.parentElement?.parentElement?.parentElement?.parentElement?.id;
            if (seqID) {
                // get common ancestor for control and container
                const wireEl: HTMLElement | null | undefined = target?.parentElement?.parentElement?.parentElement?.parentElement;
                if (wireEl === null || wireEl === undefined) {
                    console.log('failed to select leveler element during rerender');
                } else {
                    // select container elements
                    const containers: NodeListOf<Element> = wireEl.querySelectorAll('.leveler-layout');
                    // get sequence data
                    const targetInput: HTMLInputElement = target as HTMLInputElement;
                    const stages: number = Number(targetInput.value);
                    const levels: number = sequencers[seqID]['levels'];
                    // rerender levelers
                    for (const container of containers) {
                        renderLeveler(stages, levels, container);
                    }
                    // update all
                    soundAll();
                }
            } else {
                console.log('seqID not found during leveler rerender');
            }

        } else if (target.classList.contains('stage-levels')) {
            // get seqID
            const seqID: string | undefined = target?.parentElement?.parentElement?.parentElement?.parentElement?.parentElement?.parentElement?.id;
            if (seqID) {
                // get common ancestor for control and container
                const wireEl: HTMLElement | null | undefined = target?.parentElement?.parentElement?.parentElement?.parentElement;
                if (wireEl === null || wireEl === undefined) {
                    console.log('failed to select leveler element during rerender');
                } else {
                    // select container elements
                    const containers: NodeListOf<Element> = wireEl.querySelectorAll('.leveler-layout');
                    // get sequence data
                    const targetInput: HTMLInputElement = target as HTMLInputElement;
                    const stages: number =  sequencers[seqID]['stages'];
                    const levels: number = Number(targetInput.value);
                    // rerender levelers
                    for (const container of containers) {
                        renderLeveler(stages, levels, container);
                    }
                    // update all
                    soundAll();
                }
            } else {
                console.log('seqID not found during leveler rerender');
            }

        } else {
            soundAll('seq');
        }
    }
};

function oscillatorEvent(event: Event): void {
    // determine functionality by target of event
    // console.log('osc event');
    const target = event.target as HTMLElement;
    if (event.type === 'change' && target.classList.contains('type')) {
        soundAll('osc');
    }
    if (target.classList.contains('amplitude')  || target.classList.contains('drive') || target.classList.contains('drive-character') || target.classList.contains('frequency') || target.classList.contains('voices') || target.classList.contains('detune') || target.classList.contains('partials')) {
        soundAll('osc');
    }
};

// test UI integrity, load processor modules, and setup listeners for user controls
let cache: ReturnType<typeof setTimeout> = setTimeout(() => {}, 0);
async function setup(): Promise<void> {

    // initialize data and setup listeners

    // test UI integrity
    if (playBtn && stopBtn && breakerBtn && masterGain && masterPan && FPControl && CControl && VControl && seq1 && seq2 && seq3 && osc1 && osc2 && osc3) {

        // load processor modules
        await getProcessorModules();

        // initialize structures
        initMacros();
        initOscillators();
        initSequencers();

        // console.log(macros);
        // console.log(oscillators);
        // console.log(sequencers);

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
                    playback = true;
                    soundAll(); // don't listen until sound is done
                    listening = true;
                }, latency)
            }
        });
    
        // mute all and clear voices
        stopBtn.addEventListener('click', () => {
            if (listening) {
                clearTimeout(cache);
                cache = setTimeout(() => {
                    clearTimeout(cache);
                    listening = false;
                    shutup(); // don't listen until shutup is done
                    playback = false;
                    listening = true;
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
                    listening = false;
                    soundAll(); // don't listen until sound is done
                    listening = true;
                }, latency);
            }
        });
        
        // controls master pan position
        masterPan.addEventListener('input', () => {
            if (listening && playback) {
                clearTimeout(cache);
                cache = setTimeout(() => {
                    clearTimeout(cache);
                    listening = false;
                    soundAll(); // don't listen until sound is done
                    listening = true;
                }, latency);
            }
        });

        // Beats/Minute (BPM or Tempo)
        masterTempo.addEventListener('input', () => {
            if (listening && playback && masterTempo) {
                clearTimeout(cache);
                cache = setTimeout(() => {
                    clearTimeout(cache);
                    listening = false;
                    soundAll(); // don't listen until sound is done
                    listening = true;
                }, latency);
            }
        });

        // Beats/Measure (Time Signature)
        masterMeasure.addEventListener('input', () => {
            if (listening && playback && masterMeasure) {
                clearTimeout(cache);
                cache = setTimeout(() => {
                    clearTimeout(cache);
                    listening = false;
                    soundAll(); // don't listen until sound is done
                    listening = true;
                }, latency);
            }
        });
    
        // controls input gain for all oscillators
        FPControl.addEventListener('input', () => {
            if (listening && playback) {
                clearTimeout(cache);
                cache = setTimeout(() => {
                    clearTimeout(cache);
                    listening = false;
                    soundAll(); // don't listen until sound is done
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
                    soundAll(); // don't listen until sound is done
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
                    listening = false;
                    soundAll(); // don't listen until sound is done
                    listening = true;
                }, latency);
            }
        });

        // listener delegation for sequence events
        const seqsNodeList: NodeListOf<Element> = document.querySelectorAll('.seqs');
        if (seqsNodeList.length > 0) {
            for (const seqEl of seqsNodeList) {
                if (seqEl) {
                    ['click', 'change'].forEach((eventType) => {
                        seqEl.addEventListener(eventType, (event) => {
                            // no added latency on gui events
                            listening = false;
                            sequencerEvent(event);
                            listening = true;
                        });
                    })
                }
            }
        } else {
            console.log('sequencer elements not found during listener setup');
        }
        
        // listener delegation for oscillator events
        const oscsNodeList: NodeListOf<Element> = document.querySelectorAll('.oscs');
        if (oscsNodeList.length > 0) {
            for (const oscEl of oscsNodeList) {
                if (oscEl) {
                    ['change'].forEach((eventType) => {
                        oscEl.addEventListener(eventType, (event) => {
                            clearTimeout(cache);
                            cache = setTimeout(() => {
                                clearTimeout(cache);
                                listening = false;
                                oscillatorEvent(event);
                                listening = true;
                            }, 10);
                        });
                    })
                }
            }
        } else {
            console.log('oscillator elements not found during listener setup');
        }
        

    } else {
        console.log('Element Integrity Degraded during listener setup');
    }
};
setup();
