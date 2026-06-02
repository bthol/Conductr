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

// variance affects the variability oscillator properties
const variance: number = 4;

// setup audio context
const options: Object = {'sampleRate': 44100.0, 'latencyHint': 'interactive'};
const audioContext: AudioContext = new AudioContext(options);

// add functions for custom processors
// I/O processor type convention: input type GainNode and output type GainNode
async function getProcessorModules() {
    // collects all processor scripts by adding their modules to the global audio context
    await audioContext.audioWorklet.addModule('./build/scripts/processors/clamp-processor.js');
};

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

                    // console.log(data);
                    // console.log(peak);

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

// declare global structures
let oscillators: { [key: string]: any } = {}; // stores parameters for each oscilator from user parameters
let voices: Array<OscillatorNode> = []; // stores voices generated with parameter values
let analysis: {[key: string]: Array<AnalyserNode>} = {}; // frist index = oscillator, second index = analyzer node for that oscillator
let playback: boolean = false;

// parameter for master volume control
// 0.5 output == -6 dB
let maxIn: number = 0.5; // 0 - 1
let maxOut: number = 0.5; // 0 - 0.99

// UI elements
const breakerBtn: HTMLElement | null = document.getElementById('breaker');
const playBtn: HTMLElement | null = document.getElementById('play-btn');
const stopBtn: HTMLElement | null = document.getElementById('stop-btn');
const masterGainIn = document.getElementById('master-gain-in') as HTMLInputElement;
const masterGainOut = document.getElementById('master-gain-out') as HTMLInputElement;
const osc1: HTMLElement | null = document.getElementById('osc1');
const osc2: HTMLElement | null = document.getElementById('osc2');
const osc3: HTMLElement | null = document.getElementById('osc3');

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
    if (masterGainIn && masterGainOut) {

        // get user values
        let inVal: number = Number(masterGainIn.value);
        let outVal: number = Number(masterGainOut.value);

        // enforce macro ranges
        if (inVal > 100) {
            inVal = 100;
        } else if (inVal < 0) {
            inVal = 0;
        }
        if (outVal > 99) {
            outVal = 100;
        } else if (outVal < 0) {
            outVal = 0;
        }

        // apply values to macros
        maxIn = inVal/100;
        maxOut = outVal/100;
    }

    // get user data + add data to oscillators structure
    const oscs: NodeListOf<Element> = document.querySelectorAll('.oscs');
    let gotit: boolean = true;
    for (const osc of oscs) {
        if (osc) {
            const oscGain: HTMLInputElement | null = osc.querySelector('.amplitude');
            const oscFreq: HTMLInputElement | null = osc.querySelector('.frequency');
            const oscPart: HTMLInputElement | null = osc.querySelector('.partials');
            const oscType: HTMLInputElement | null = osc.querySelector('.type');
            const ID: string | undefined = crypto.randomUUID().split('-')[0];
            if (oscGain && oscFreq && oscPart && oscType && typeof ID === 'string') {
                // oscillator properties
                const type: string = oscType.value;
                const hz: number = Number(oscFreq.value);
                const gain: number = Number(oscGain.value);

                // VARIABILITY ENGINE

                // GAIN
                // logarithmic distribution of gain levels
                // ranges: 0 - 99 => 0/100 - 99/100 => 0 - +inf or lim1 => 0 - 1
                // maxIn distributes levels below its percentage value within 0 - 99 range
                // maxOut distributes levels below its value within 0 - 1 range
                // as frequency increases, gain variation increases; stable bass and dynamic trebble
                // with a variance of 2 (not accounting for factor)
                //  - 100 hz has max possible variance of 0.01
                //  - 1,000 hz has max possible variance of 0.1
                //  - 10,000 hz has max possible variance of 1
                //  - 20,000 hz has max possible variance of 2
                // with a variance of 4 (not accounting for factor)
                //  - 100 hz has max possible variance of 0.02
                //  - 1,000 hz has max possible variance of 0.2
                //  - 10,000 hz has max possible variance of 2
                //  - 20,000 hz has max possible variance of 4
                
                // FREQUENCY
                // uses same v value for frequency variation

                // random ammount of possible variance applied, adjusted by frequency
                // each property has a factor of variation, which when all are summed euqals 1
                const v: number = (variance * (hz / 20000)); // maximum possible variation
                
                // gain variation
                const gainFactor: number = .25; // 4:1  variation to gain
                const gainV: number = Math.random() * v*gainFactor; // variation ammount for gain
                const gainCalc: number = (((-(Math.log10((-(gain * maxIn + gainV)/100) + 1))/2))) * maxOut;

                // frequency variation
                const freqFactor: number = .5; // 2:1  variation to frequency
                const freqV: number = Math.random() * v*freqFactor; // variation ammount for frequency
                const freqCalc: number = hz - freqV;

                // stereo varation
                const stereoFactor: number = .15 // 20:3 variation to stereo
                const stereoV: number = Math.random() * v*stereoFactor; // variation ammount for stereo

                // timbral variation
                const timbFactor: number = .1; // 10:1 variation to timbre

                // generate waveform
                const partials: number = Number(oscPart.value);
                const real: Float32Array = new Float32Array(partials);
                const imag: Float32Array = new Float32Array(partials);
                let waveform: PeriodicWave;
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
                    
                } else if (type === 'conv-geo-series-0.5') {
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
                
                } else if (type === 'conv-geo-series-0.25') {
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
                } else if (type === 'conv-geo-series-0.125') {
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

                // add oscillator to oscillators structure
                if (gainCalc < 1 && gainCalc >= 0) {
                    const osc: object = {'waveform':waveform, 'hz':freqCalc, 'gain':gainCalc};
                    oscillators[ID] = osc;
                    gotit = true;
                } else {
                    const osc: object = {'waveform':waveform, 'hz':freqCalc, 'gain':0.99 * maxOut};
                    oscillators[ID] = osc;
                    gotit = true;
                }

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

    // iterate over oscillators structure to generate voices
    if (gotit) {
        const keys: Array<string> = Object.keys(oscillators);
        for (const key of keys) {
    
            // declare oscillator variables
            const oscil: {[key:string]: any} = oscillators[key]; // each oscillator
            const osc: OscillatorNode = audioContext.createOscillator(); // each voice from oscillator
            const waveform: PeriodicWave = oscil['waveform'];

            // console.log(waveform);

            const oscFreq: number = oscil['hz'];
            const oscGain: GainNode = audioContext.createGain();
            const oscVol: number = oscil['gain'];

            // generator process routing
            // branch0 > oscillator > gain > branch1 or compression > soft limiter > brickwall limit > 0 dB clamp > output and branch2
            // branch1 > pre-analysis
            // branch2 > post-analysis

            // configure oscillator node with variables
            osc.setPeriodicWave(waveform); // set waveform
            osc.frequency.setValueAtTime(oscFreq, audioContext.currentTime); // set frequency
            oscGain.gain.value = oscVol; // set gain
            
            // route oscillator node to gain node to apply gain
            osc.connect(oscGain);
            
            // pre-analysis
            const preAnalyzer: AnalyserNode =  audioContext.createAnalyser();
            // store in global structure
            analysis[key] = []; // init key for osc in structure
            analysis[key].push(preAnalyzer); // add node to array at key in structure
            oscGain.connect(preAnalyzer);

            // generator dynamics system
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
            oscGain.connect(compressor);
            
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

            // clamp for 0 dB hard-clipping/peak-elimination
            const clampNode: AudioWorkletNode = clamp(brickwall);

            const dry: GainNode = audioContext.createGain();
            clampNode.connect(dry);
            oscil['FX'] = dry; // store dry gain node in FX property for oscillator FX chain
            dry.connect(audioContext.destination);

            // post-analysis
            const postAnalyzer: AnalyserNode = audioContext.createAnalyser();
            analysis[key].push(postAnalyzer) // store in global structure
            clampNode.connect(postAnalyzer);

            // store pointer to oscillator in structure for global reference
            voices.push(osc);
    
            // run oscilator
            osc.start(0);
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
                analyze(nodeList[1]) // postAnalysis for osc1

                // analyze(nodeList[0]) // preAnalysis for osc2
                // analyze(nodeList[1]) // postAnalysis for osc2

                // analyze(nodeList[0]) // preAnalysis for osc3
                // analyze(nodeList[1]) // postAnalysis for osc3
                
                // allstream logging (not reccomended)
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
    if (playBtn && stopBtn && breakerBtn && masterGainIn && masterGainOut && osc1 && osc2 && osc3) {

        // get processor modules
        await getProcessorModules();
        
        // setup listeners for user controls

        // mute voices and clear osc and voice data, generate osc and voice data and play voices
        playBtn.addEventListener('click', () => {
            sound();
            playback = true;
        });
    
        // mute all and clear voices
        stopBtn.addEventListener('click', () => {
            shutup();
            playback = false;
        });
    
        // breaker button reloads program
        breakerBtn.addEventListener('click', () => {window.location.reload()});
    
        // controls oscillator input gain
        masterGainIn.addEventListener('input', () => {
            if (playback) {
                clearTimeout(cache);
                cache = setTimeout(() => {
                    clearTimeout(cache);
                    sound();
                }, 100);
            }
        });
    
        // controls oscillator output gain
        masterGainOut.addEventListener('input', () => {
            if (playback) {
                clearTimeout(cache);
                cache = setTimeout(() => {
                    clearTimeout(cache);
                    sound();
                }, 100);
            }
        });
    }
};
setup();
