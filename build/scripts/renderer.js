"use strict";
console.log("linked script");
;
window.electronAPI.res((data) => {
    console.log(data);
});
const variance = 4;
const options = { 'sampleRate': 44100.0, 'latencyHint': 'interactive' };
const audioContext = new AudioContext(options);
async function getProcessorModules() {
    await audioContext.audioWorklet.addModule('./build/scripts/processors/clamp-processor.js');
}
;
function analyze(node) {
    if (node) {
        const bufferSize = 128;
        node.fftSize = bufferSize;
        node.maxDecibels = 6;
        node.minDecibels = -200;
        let data = new Float32Array(bufferSize);
        let debounce;
        function loop(currentTime) {
            if (node) {
                clearTimeout(debounce);
                debounce = setTimeout(() => {
                    clearTimeout(debounce);
                    node.getFloatTimeDomainData(data);
                    let peak = 0;
                    for (let i = 0; i < data.length; i++) {
                        const datum = data[i];
                        if (typeof datum === 'number') {
                            const absValue = Math.abs(datum);
                            if (absValue > peak) {
                                peak = absValue;
                            }
                        }
                    }
                    requestAnimationFrame(loop);
                }, 1000);
            }
        }
        ;
        loop(audioContext.currentTime);
    }
}
;
function clamp(input) {
    const processor = new AudioWorkletNode(audioContext, 'clamp-processor');
    processor.port.onmessage = (event) => {
        console.log('clamp-processor thread: ', event.data);
    };
    input.connect(processor);
    return processor;
}
;
let oscillators = {};
let voices = [];
let analysis = {};
let playback = false;
let maxIn = 0.5;
let maxOut = 0.5;
const breakerBtn = document.getElementById('breaker');
const playBtn = document.getElementById('play-btn');
const stopBtn = document.getElementById('stop-btn');
const masterGainIn = document.getElementById('master-gain-in');
const masterGainOut = document.getElementById('master-gain-out');
const osc1 = document.getElementById('osc1');
const osc2 = document.getElementById('osc2');
const osc3 = document.getElementById('osc3');
function shutup() {
    oscillators = {};
    voices.forEach((osc) => { osc.stop(audioContext.currentTime); });
    voices = [];
}
;
async function sound() {
    if (playback) {
        shutup();
    }
    if (masterGainIn && masterGainOut) {
        let inVal = Number(masterGainIn.value);
        let outVal = Number(masterGainOut.value);
        if (inVal > 100) {
            inVal = 100;
        }
        else if (inVal < 0) {
            inVal = 0;
        }
        if (outVal > 99) {
            outVal = 100;
        }
        else if (outVal < 0) {
            outVal = 0;
        }
        maxIn = inVal / 100;
        maxOut = outVal / 100;
    }
    const oscs = document.querySelectorAll('.oscs');
    let gotit = true;
    for (const osc of oscs) {
        if (osc) {
            const oscGain = osc.querySelector('.amplitude');
            const oscFreq = osc.querySelector('.frequency');
            const oscPart = osc.querySelector('.partials');
            const oscType = osc.querySelector('.type');
            const ID = crypto.randomUUID().split('-')[0];
            if (oscGain && oscFreq && oscPart && oscType && typeof ID === 'string') {
                const type = oscType.value;
                const hz = Number(oscFreq.value);
                const gain = Number(oscGain.value);
                const v = (variance * (hz / 20000));
                const gainFactor = .25;
                const gainV = Math.random() * v * gainFactor;
                const gainCalc = (((-(Math.log10((-(gain * maxIn + gainV) / 100) + 1)) / 2))) * maxOut;
                const freqFactor = .5;
                const freqV = Math.random() * v * freqFactor;
                const freqCalc = hz - freqV;
                const stereoFactor = .15;
                const stereoV = Math.random() * v * stereoFactor;
                const timbFactor = .1;
                const partials = Number(oscPart.value);
                const real = new Float32Array(partials);
                const imag = new Float32Array(partials);
                let waveform;
                if (type === 'sine') {
                    real[0] = 0;
                    imag[0] = 0;
                    imag[1] = 1;
                    waveform = audioContext.createPeriodicWave(real, imag);
                }
                else if (type === 'triangle') {
                    real[0] = 0;
                    imag[0] = 0;
                    for (let n = 1; n < partials + 1; n++) {
                        if (n % 2 !== 0) {
                            const sign = ((n - 1) / 2) % 2 === 0 ? 1 : -1;
                            const partial = (8 / Math.pow(Math.PI, 2)) * (sign / Math.pow(n, 2));
                            const cutoff = 500 / 20000;
                            const adjust = partial / cutoff;
                            const timbCalc = (adjust * ((Math.random() * (variance - 1) + 1) * timbFactor));
                            imag[n] = partial + timbCalc;
                        }
                        else {
                            imag[n] = 0;
                        }
                        real[n] = 0;
                    }
                    waveform = audioContext.createPeriodicWave(real, imag);
                }
                else if (type === 'saw') {
                    real[0] = 0;
                    imag[0] = 0;
                    for (let n = 1; n < partials + 1; n++) {
                        const partial = 1 / (n * Math.PI);
                        const cutoff = 10000 / 20000;
                        const adjust = partial / cutoff;
                        const timbCalc = (adjust * ((Math.random() * (variance - 1) + 1) * timbFactor));
                        imag[n] = partial + timbCalc;
                    }
                    waveform = audioContext.createPeriodicWave(real, imag);
                }
                else if (type === 'square') {
                    real[0] = 0;
                    imag[0] = 0;
                    for (let n = 0; n < partials; n++) {
                        if (n % 2 !== 0) {
                            const partial = 4 / (n * Math.PI);
                            const cutoff = 1000 / 20000;
                            const adjust = partial / cutoff;
                            const timbCalc = (adjust * ((Math.random() * (variance - 1) + 1) * timbFactor));
                            imag[n] = partial + timbCalc;
                        }
                        else {
                            imag[n] = 0;
                        }
                    }
                    waveform = audioContext.createPeriodicWave(real, imag);
                }
                else if (type === 'conv-geo-series-0.5') {
                    real[0] = 0;
                    imag[0] = 0;
                    let a = 0;
                    let b = 1;
                    for (let i = 1; i < partials; i++) {
                        real[i] = a;
                        imag[i] = b;
                        b *= .5;
                    }
                    waveform = audioContext.createPeriodicWave(real, imag);
                }
                else if (type === 'conv-geo-series-0.25') {
                    real[0] = 0;
                    imag[0] = 0;
                    let a = 0;
                    let b = 1;
                    for (let i = 1; i < partials; i++) {
                        real[i] = a;
                        imag[i] = b;
                        b *= .25;
                    }
                    waveform = audioContext.createPeriodicWave(real, imag);
                }
                else if (type === 'conv-geo-series-0.125') {
                    real[0] = 0;
                    imag[0] = 0;
                    let a = 0;
                    let b = 1;
                    for (let i = 1; i < partials; i++) {
                        real[i] = a;
                        imag[i] = b;
                        b *= .125;
                    }
                    waveform = audioContext.createPeriodicWave(real, imag);
                }
                else {
                    real[0] = 0;
                    imag[0] = 0;
                    imag[1] = 1;
                    waveform = audioContext.createPeriodicWave(real, imag);
                }
                if (gainCalc < 1 && gainCalc >= 0) {
                    const osc = { 'waveform': waveform, 'hz': freqCalc, 'gain': gainCalc };
                    oscillators[ID] = osc;
                    gotit = true;
                }
                else {
                    const osc = { 'waveform': waveform, 'hz': freqCalc, 'gain': 0.99 * maxOut };
                    oscillators[ID] = osc;
                    gotit = true;
                }
            }
            else {
                console.log('parameter elements not found');
                gotit = false;
            }
        }
        else {
            console.log('oscillator element not found');
            gotit = false;
        }
        if (!gotit) {
            console.log('failed to set oscillator parameters');
            break;
        }
    }
    if (gotit) {
        const keys = Object.keys(oscillators);
        for (const key of keys) {
            const oscil = oscillators[key];
            const osc = audioContext.createOscillator();
            const waveform = oscil['waveform'];
            const oscFreq = oscil['hz'];
            const oscGain = audioContext.createGain();
            const oscVol = oscil['gain'];
            osc.setPeriodicWave(waveform);
            osc.frequency.setValueAtTime(oscFreq, audioContext.currentTime);
            oscGain.gain.value = oscVol;
            osc.connect(oscGain);
            const preAnalyzer = audioContext.createAnalyser();
            analysis[key] = [];
            analysis[key].push(preAnalyzer);
            oscGain.connect(preAnalyzer);
            const compressor = audioContext.createDynamicsCompressor();
            compressor.threshold.value = -12;
            compressor.knee.value = 9;
            compressor.ratio.value = 3;
            compressor.attack.value = 0.05;
            compressor.release.value = 0.1;
            oscGain.connect(compressor);
            const limiter = audioContext.createDynamicsCompressor();
            limiter.threshold.value = -6;
            limiter.knee.value = 3;
            limiter.ratio.value = 2;
            limiter.attack.value = 0.05;
            limiter.release.value = 0.05;
            compressor.connect(limiter);
            const brickwall = audioContext.createDynamicsCompressor();
            brickwall.threshold.value = -2.8;
            brickwall.knee.value = 0;
            brickwall.ratio.value = 3.4;
            brickwall.attack.value = 0;
            brickwall.release.value = 0.1;
            limiter.connect(brickwall);
            const clampNode = clamp(brickwall);
            const dry = audioContext.createGain();
            clampNode.connect(dry);
            oscil['FX'] = dry;
            dry.connect(audioContext.destination);
            const postAnalyzer = audioContext.createAnalyser();
            analysis[key].push(postAnalyzer);
            clampNode.connect(postAnalyzer);
            voices.push(osc);
            osc.start(0);
        }
    }
    if (gotit) {
        const keys = Object.keys(analysis);
        const key = keys[0];
        if (typeof key === 'string') {
            const nodeList = analysis[key];
            if (nodeList) {
                analyze(nodeList[1]);
            }
        }
    }
}
;
let cache = setTimeout(() => { }, 0);
async function setup() {
    if (playBtn && stopBtn && breakerBtn && masterGainIn && masterGainOut && osc1 && osc2 && osc3) {
        await getProcessorModules();
        playBtn.addEventListener('click', () => {
            sound();
            playback = true;
        });
        stopBtn.addEventListener('click', () => {
            shutup();
            playback = false;
        });
        breakerBtn.addEventListener('click', () => { window.location.reload(); });
        masterGainIn.addEventListener('input', () => {
            if (playback) {
                clearTimeout(cache);
                cache = setTimeout(() => {
                    clearTimeout(cache);
                    sound();
                }, 100);
            }
        });
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
}
;
setup();
//# sourceMappingURL=renderer.js.map