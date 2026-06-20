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
// channelCountMode, ConstantSourceNode, AudioBufferSourceNode


// setup audio context
const options: Object = {'sampleRate': 44100.0, 'latencyHint': 'interactive'};
const audioContext: AudioContext = new AudioContext(options);

// Preset structures
let macros: { [key: string]: any} = {
    // player control macros
    'master': .75, // 0 - 0.99
    'pan': 0, // -50 - 50
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
let { master, pan, FortePiano, creciendo, expressivity, variance, driveMult, Attack, Sustain, Release } = macros; // destructure for ease of access
let oscillators: { [key: string]: any } = {}; // stores parameters for each oscillator from user parameters; data for preset
let sequencers: { [key: string]: any } = {}; // stores parameters for each sequencer from user parameters; data for preset
let macrosInitialized: boolean = false; // boolean for testing initialization status
let oscillatorsInitialized: boolean = false; // boolean for testing initialization status
let sequencersInitialized: boolean = false; // boolean for testing initialization status

// Playback structures
let playback: boolean = false; // stores the program run state (run: true, off: false)
let tempo: number = 128; // Beats per Minute (BPM) tempo controls the rate of clocked events
let beatsPerMeasure: number = 4; // controls number of beats per measure, always give beat to 1/4th
let voices: Array<OscillatorNode> = []; // stores voices generated with oscillator parameters
let sequences: {[key:string]: ReturnType<typeof setInterval> } = {}; // stores cache for sequencer schedule caches
let analysis: {[key: string]: Array<AnalyserNode>} = {}; // first index = oscillator, second index = analyzer node for that oscillator

// DOM elements

// Player Controls
const masterGain = document.getElementById('master-gain') as HTMLInputElement; // Master Gain out
const masterPan = document.getElementById('master-pan') as HTMLInputElement; // Master Gain out

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
async function getProcessorModules(): Promise<void> {
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

// setup peak level analysis on node
function analyzePeak(node: AnalyserNode | undefined): void {
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

// setup general analysis on node
function analyze(node: AnalyserNode | undefined): void {
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

// data initialization
function initMacros(): void {
    // model
    // player control macros
    master = .75; // 0 - 0.99
    pan = 0; // -50 - 50
    // Conductor Macros
    FortePiano = 1; // 0 - 2
    creciendo = 1; // 0 - 10
    expressivity = 4; // 1 - 10
    variance = 2; // 1 - 10
    driveMult = 1; // 1 - 10
    // dynamic modifiers
    Attack = 3; // 1 - 10
    Sustain = 5; // 1 - 10
    Release = 4; // 1 - 1

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
    for (const osc of oscsNodeList) {

        // Model parameters
        const frequency: number = 32.7;
        const detune: number = -3;
        const partials: number = 256;

        // Generate a unique Oscillator ID
        const ID: string | undefined = crypto.randomUUID().split('-')[0];
        if (typeof ID === 'string') {
            // generate default waveform
            const v: number = (variance * (frequency / 20000)); // maximum possible variation
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
                    const timbCalc: number = ((Math.random() * (variance - 1) + 1) / 10 * timbFactor - .01) * sign; // timbral variation (amp and phase change per partial; partial non-linearity): 0 - .09
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
                'cutoff': 1000,
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
            filterCutoffEL.value = '1000';
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
    
    if (masterGain && masterPan && DMControl && FPControl && CControl && VControl) { // test element integrity

        // Master Gain
        let masterVal: number = Number(masterGain.value);
        if (masterVal > 100) { // above max
            masterVal = 100;
        } else if (masterVal < 0) { // below min
            masterVal = 0;
        } else if (masterVal % 1 !== 0) { // round + fractions up
            masterVal = Math.ceil(masterVal);
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
                const stereoV: number = Math.random() * v*stereoFactor / 1.5; // variation ammount for stereo: 0 - 1

                // timbral variation
                const timbFactor: number = .1; // 10:1 variation to timbre (partial phase shift)

                // enforce ranges to validate user input and prevent variability engine from causing trouble
                
                // varied properties
                let gainVal: number = gainCalc;
                if (gainCalc >= 1) { // above max
                    gainVal = 1 - gainV;
                } else if (gainCalc < 0) { // below min
                    gainVal = 0;
                } else if (gainVal % 1 !== 0) { // round fraction up
                    gainVal = Math.ceil(gainVal);
                }
                let freqVal: number = freqCalc;
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
                            const timbCalc: number = ((Math.random() * (variance - 1) + 1) / 10 * timbFactor - .01) * sign; // timbral variation (amp and phase change per partial; partial non-linearity): 0 - .09
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
                        const timbCalc: number = (Math.random() * (variance - 1) + 1) / 10 * timbFactor - 0.01; // timbral variation (amp phaze change per partial/harmonic): 0 - .09
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
                            const timbCalc: number = (Math.random() * (variance - 1) + 1) / 10 * timbFactor -.01; // timbral variation (amp phaze change per partial/harmonic): 0 - .09
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
                        const timbCalc: number = (Math.random() * (variance - 1) + 1) / 10 * timbFactor - 0.01; // timbral variation (amp phaze change per partial/harmonic): 0 - .09
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
                        const timbCalc: number = (Math.random() * (variance - 1) + 1) / 10 * timbFactor - 0.01; // timbral variation (amp phaze change per partial/harmonic): 0 - .09
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
                        const timbCalc: number = (Math.random() * (variance - 1) + 1) / 10 * timbFactor - 0.01; // timbral variation (amp phaze change per partial/harmonic): 0 - .09
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
                        const timbCalc: number = (Math.random() * (variance - 1) + 1) / 10 * timbFactor - 0.01; // timbral variation (amp phaze change per partial/harmonic): 0 - .09
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
                const seqRate: string = seqRateEl.value;
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
                sequencers[seqID]['stages'] = stages;
                sequencers[seqID]['levels'] = levels;
                sequencers[seqID]['seqRate'] = seqRate;
                sequencers[seqID]['filtType'] = filtType;
                sequencers[seqID]['cutoff'] = cutoff;
                sequencers[seqID]['resonance'] = resonance;
                sequencers[seqID]['ampMod'] = ampMod;
                sequencers[seqID]['filtMod'] = filtMod;
                sequencers[seqID]['freqMod'] = freqMod;
                sequencers[seqID]['ampLvlvs'] = ampLvls;
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
function setupSequencer(seqID:string, oscs:Array<OscillatorNode>): BiquadFilterNode | boolean {
    if (sequencersInitialized) {
        // setup sequencer

        // measures per minute  = beats per minute / beats per measure
        // minutes per measure = 1 / measures per minute
        // millisecs per measure = minutes per measure * (60 seconds / 1 minute) * (1000 millisecs / 1 second)
        const measureDuration: number = 1 / (tempo / beatsPerMeasure) * 60 * 1000; // measureDuration = milliseconds per measure

        // 1 sequencer stage is a sequencer beat
        // 1 sequencer beat is a rate 

        // get sequencer data
        const seq = sequencers[seqID]; // sequencer object
        const levels: number = seq['stages']; // default = 25
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
        const rate: number = Number(seq['seqRate'].split('/')[0]) / Number(seq['seqRate'].split('/')[1]); // rate = percentage of measure per stage
        const stageDuration: number = measureDuration * rate; // measureDuration adjusted by rate
        const sequenceDuration: number = stageDuration * stages; // duration of entire sequence

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
        } else if (filtMod < 0) { // below minimum
            filtMod = 0;
        } else if (filtMod % 1 !== 0) { // round fractions up
            filtMod = Math.ceil(filtMod);
        }
        // scale range
        filtMod = (cutoff - 20) * (filtMod/10); // percentage down to min frequency

        // enforce range
        if (freqMod > 24) { // above maximum
            freqMod = 24;
        } else if (freqMod < -24) { // below minimum
            freqMod = -24;
        }
        // scale range
        freqMod = freqMod
        

        // create and configure sequencer nodes
        const gainNode: GainNode = audioContext.createGain(); // node to control amp leveling
        const filterNode: BiquadFilterNode = new BiquadFilterNode(audioContext, {
            type: type,
            frequency: cutoff,
            Q: resonance
        }); // node to control filter leveling
        oscs.forEach((osc) => { osc.connect(gainNode) });
        gainNode.connect(filterNode);

        
        // prime data for sequence performance
        for (let i = 0; i < stages; i++) {
            const amp: number | undefined = ampLvls[i]; // 0 - 25
            const filter: number | undefined = filtLvls[i]; // 0 - 25
            const frequency: number | undefined = freqLvls[i]; // 0 - 25
            if (amp && filter && frequency) {
                // level percent of modifier scaled within property range
                ampLvls[i] = amp / levels * ampMod;
                filtLvls[i] = filter / levels * filtMod;
                freqLvls[i] = frequency / levels * freqMod;
            }
        }

        console.log('amp');
        console.log(ampLvls);
        console.log('filter');
        console.log(filtLvls);
        console.log('note');
        console.log(freqLvls);
        
        // schedule sequence events using primed data
        clearInterval(sequences[seqID]); // clear last sequence
        sequences[seqID] = setInterval( () => { // start new sequence
            for (let i = 0; i < stages; i++) { // each stage
                const amp: number | undefined = ampLvls[i];
                const filter: number | undefined = filtLvls[i];
                const frequency: number | undefined = freqLvls[i];
                if (amp && filter && frequency) {
                    const time: number = audioContext.currentTime + (stageDuration*i); // schedule
                    // set amp
                    gainNode.gain.setValueAtTime(gainNode.gain.value * amp, time);

                    // set filter
                    filterNode.frequency.setValueAtTime(cutoff - filter, time);

                    // voice frequency change spread
                    let voiceDelay: number = 0; // millisecs
                    let index: number = 0;
                    oscs.forEach((osc) => {
                        osc.frequency.setValueAtTime(frequency, time + (voiceDelay * index));
                        index += 1;
                    })
                    
                }
            }
            
        }, sequenceDuration);

        return filterNode;

    } else {
        console.log(`cannot setup sequence ${seqID} before initialization`);
        return false;
    }
};

// playback functions
// playback functions should only perform audio from stored data
function shutup(): void {
    voices.forEach((osc) => { osc.stop(audioContext.currentTime) }); // mute each voice
    voices = []; // clear voices data
    const sequenceKeys: Array<string> = Object.keys(sequences);
    for (const seq of sequenceKeys) {clearInterval(seq)} // stop sequences
};

function soundAll(): void {
    // generates voices from oscillators

    // clear your throat
    if (playback) {
        shutup();
    }

    // update macros
    if (updateMacros()) {

        // update oscillator model
        const oscKeys: Array<string> = Object.keys(oscillators);
        let gotit: boolean = true;
        if (oscKeys.length > 0) {
            for (const key of oscKeys) {
                if (!updateOscillator(key)) {
                    gotit = false;
                    break;
                }
            }
        } else {
            gotit = false;
            console.log('Failed to get oscillator keys during update');
        }

        // update sequencer model
        if (gotit) {
            const seqKeys: Array<string> = Object.keys(sequencers);
            if (seqKeys.length > 0) {
                for (const key of seqKeys) {
                    if (!updateSequence(key)) {
                        gotit = false;
                        break;
                    }
                }
            } else {
                gotit = false;
                console.log('Failed to get sequencer keys during update');
            }
        }
    
        // generate voices
        if (gotit) {

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
                // oscillator: voice > gain > waveshaper > makeup > dry
                //             voice >      > preAnalyzer         > postAnalyzer
                //             voice >                            > wet
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
                    console.log(oscDrive);
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

                // get sequence data
                const seqID: string | undefined = seqKeys[seqKeyIndex];
                if (seqID) {
                    // get voices for sequencer
                    let oscsNodes: Array<OscillatorNode> = [];
                    for (let voice = voices.length - oscVoic; voice < voices.length; voice++) {
                        const v: OscillatorNode | undefined = voices[voice];
                        if (v) { oscsNodes.push(v) };
                    }
                    const seqNode: BiquadFilterNode | boolean = setupSequencer(seqID, oscsNodes);
                    if (typeof seqNode !== "boolean") {
                        // route to dry and wet gain nodes for FX chain through sequencer
                        makeupGainNode.connect(seqNode);
                        seqNode.connect(dry);
                        seqNode.connect(wet);
                    } else { // sequencer setup failed => bypass
                        // route to dry and wet gain nodes for FX chain bypassing sequencer
                        console.log('sequencer setup failed');
                        makeupGainNode.connect(dry);
                        makeupGainNode.connect(wet);
                    }
                } else {
                    // route to dry and wet gain nodes for FX chain bypassing sequencer
                    console.log('sequencer not found during setup');
                    makeupGainNode.connect(dry);
                    makeupGainNode.connect(wet);
                }
                seqKeyIndex += 1;
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
    
        }
    
        // setup analysis
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
            
            // play voices
            for (const voice of voices) {
                voice.start();
            }
        }
    }
};

function sequencerEvent(event: Event): void {
    // determine functionality by taraget of event
    const target = event.target as HTMLElement;
    const parent: HTMLElement | null = target.parentElement;
    if (parent) {
        // determine sequencer ID
        const seqID: string | undefined = parent.parentElement?.parentElement?.parentElement?.parentElement?.parentElement?.id;
        if (seqID) {
            // sequencer[seqID] == sequencer in which the event occured

            // determine sequence control type
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
                            if (playback) {
                                soundAll();
                            }
                            
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
                            if (playback) {
                                soundAll();
                            }
                            
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
                            if (playback) {
                                soundAll();
                            }
                        }
                    }
                }
    
            }

        }

    }
};

// test UI integrity, load processor modules, and setup listeners for user controls
let cache: ReturnType<typeof setTimeout> = setTimeout(() => {}, 0);
async function setup(): Promise<void> {

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
                    soundAll(); // don't listen until sound is done
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
                    listening = false;
                    shutup(); // don't listen until shutup is done
                    listening = true;
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
    
        // controls gain for all oscillators
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

        const seqsNodeList: NodeListOf<Element> = document.querySelectorAll('.seqs');
        if (seqsNodeList.length > 0) {
            for (const seqEl of seqsNodeList) {
                if (seqEl) {
                    seqEl.addEventListener('click', (event) => {
                        // cache = setTimeout(() => {
                        //     clearTimeout(cache);
                        //     listening = false;
                        //     sequencerEvent(event);
                        //     listening = true;
                        // }, latency);

                        // no added latency on gui events
                        listening = false;
                        sequencerEvent(event);
                        listening = true;

                    });
                }
            }
        } else {
            console.log('sequencer elements not found during setup');
        }
        

    } else {
        console.log('Element Integrity Degraded during setup');
    }
};
setup();
