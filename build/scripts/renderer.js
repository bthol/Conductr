"use strict";
console.log("linked script");
;
window.electronAPI.res((data) => {
    console.log(data);
});
let variance = 4;
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
function sigmoid(amount = 2) {
    const k = typeof amount === 'number' ? amount : 2;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
        const x = (i * 2) / n_samples - 1;
        curve[i] = Math.tanh(x * k) / Math.tanh(k);
    }
    return curve;
}
;
let oscillators = {};
let voices = [];
let analysis = {};
let playback = false;
let maxIn = 1;
let maxOut = 0.5;
let master = .75;
const breakerBtn = document.getElementById('breaker');
const playBtn = document.getElementById('play-btn');
const stopBtn = document.getElementById('stop-btn');
const OscPreGain = document.getElementById('osc-gain-in');
const OscPostGain = document.getElementById('osc-gain-out');
const masterGain = document.getElementById('master-gain');
const variability = document.getElementById('variability');
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
    if (OscPreGain && OscPostGain) {
        let inVal = Number(OscPreGain.value);
        if (inVal > 100) {
            inVal = 100;
        }
        else if (inVal < 0) {
            inVal = 0;
        }
        maxIn = inVal / 100;
        let outVal = Number(OscPostGain.value);
        if (outVal > 99) {
            outVal = 99;
        }
        else if (outVal < 0) {
            outVal = 0;
        }
        maxOut = outVal / 100;
        let masterVal = Number(masterGain.value);
        if (masterVal > 99) {
            masterVal = 99;
        }
        else if (masterVal < 0) {
            masterVal = 0;
        }
        master = masterVal / 100;
        let vary = Number(variability.value);
        if (vary > 10) {
            vary = 10;
        }
        else if (vary < 1) {
            vary = 1;
        }
        variance = vary;
    }
    const oscs = document.querySelectorAll('.oscs');
    let gotit = true;
    for (const osc of oscs) {
        if (osc) {
            const oscGain = osc.querySelector('.amplitude');
            const oscDriv = osc.querySelector('.drive');
            const oscVoic = osc.querySelector('.voices');
            const oscFreq = osc.querySelector('.frequency');
            const oscDetu = osc.querySelector('.detune');
            const oscPart = osc.querySelector('.partials');
            const oscType = osc.querySelector('.type');
            const ID = crypto.randomUUID().split('-')[0];
            if (oscGain && oscDriv && oscVoic && oscFreq && oscDetu && oscPart && oscType && typeof ID === 'string') {
                const gain = Number(oscGain.value);
                const drive = Number(oscDriv.value);
                const voices = Number(oscVoic.value);
                const hz = Number(oscFreq.value);
                const detune = Number(oscDetu.value);
                const partials = Number(oscPart.value);
                const type = oscType.value;
                const v = (variance * (hz / 20000));
                const gainFactor = .25;
                const gainV = Math.random() * v * gainFactor;
                const gainCalc = gain === 0 ? 0 : gain === 99 ? (1 - gainV - .01) * maxIn : (-Math.log10(-(gain / 100) + 1) / 2 + gainV) * maxIn;
                const freqFactor = .5;
                const freqV = Math.random() * v * freqFactor;
                const freqCalc = hz - freqV;
                const stereoFactor = .15;
                const stereoV = Math.random() * v * stereoFactor;
                const timbFactor = .1;
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
                let gainVal = gainCalc;
                if (gainCalc >= 1 || gainCalc < 0) {
                    gainVal = (1 - gainV - .01) * maxIn;
                }
                let voiceVal = voices;
                if (voiceVal > 4) {
                    voiceVal = 4;
                }
                else if (voiceVal < 1) {
                    voiceVal = 1;
                }
                let driveVal = drive;
                if (driveVal > 10) {
                    driveVal = 10;
                }
                else if (driveVal < 2) {
                    driveVal = 2;
                }
                let freqVal = freqCalc;
                if (freqVal > 20000) {
                    freqVal = 20000;
                }
                else if (freqVal < 20) {
                    freqVal = 20;
                }
                let detuneVal = detune;
                if (detuneVal > 24) {
                    detuneVal = 24;
                }
                else if (detuneVal < -24) {
                    detuneVal = -24;
                }
                const osc = { 'waveform': waveform, 'voices': voiceVal, 'gain': gainVal, 'drive': driveVal, 'hz': freqVal, 'detune': detuneVal };
                oscillators[ID] = osc;
                gotit = true;
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
        const dry = audioContext.createGain();
        const wet = audioContext.createGain();
        const keys = Object.keys(oscillators);
        for (const key of keys) {
            const oscil = oscillators[key];
            const waveform = oscil['waveform'];
            const oscVoic = oscil['voices'];
            const oscFreq = oscil['hz'];
            const oscDetu = oscil['detune'];
            const oscVol = oscil['gain'];
            const oscDrive = oscil['drive'];
            const preGain = audioContext.createGain();
            preGain.gain.value = oscVoic === 0 ? 0 : oscVol / oscVoic;
            for (let v = 0; v < oscVoic; v++) {
                const osc = audioContext.createOscillator();
                osc.setPeriodicWave(waveform);
                osc.frequency.setValueAtTime(oscFreq, audioContext.currentTime);
                osc.detune.value = v * oscDetu;
                osc.connect(preGain);
                voices.push(osc);
            }
            const waveshaper = audioContext.createWaveShaper();
            const oversample = '4x';
            waveshaper.curve = sigmoid(oscDrive);
            waveshaper.oversample = oversample;
            preGain.connect(waveshaper);
            const preAnalyzer = audioContext.createAnalyser();
            analysis[key] = [];
            analysis[key].push(preAnalyzer);
            preGain.connect(preAnalyzer);
            const postGain = audioContext.createGain();
            postGain.gain.value = maxOut;
            waveshaper.connect(postGain);
            const compressor = audioContext.createDynamicsCompressor();
            compressor.threshold.value = -12;
            compressor.knee.value = 9;
            compressor.ratio.value = 3;
            compressor.attack.value = 0.05;
            compressor.release.value = 0.1;
            postGain.connect(compressor);
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
            brickwall.connect(dry);
            brickwall.connect(wet);
            const postAnalyzer = audioContext.createAnalyser();
            analysis[key].push(postAnalyzer);
            brickwall.connect(postAnalyzer);
        }
        const FX = audioContext.createGain();
        wet.connect(FX);
        const masterGainNode = audioContext.createGain();
        masterGainNode.gain.value = Number(masterGain.value) / 100;
        let dryVal = 0;
        let wetVal = 1;
        dry.gain.value = keys.length === 0 ? 0 : dryVal / keys.length;
        wet.gain.value = keys.length === 0 ? 0 : wetVal / keys.length;
        dry.connect(masterGainNode);
        FX.connect(masterGainNode);
        const clampOut = clamp(masterGainNode);
        clampOut.connect(audioContext.destination);
        for (const v of voices) {
            v.start(0);
        }
    }
    if (gotit) {
        const keys = Object.keys(analysis);
        const key = keys[0];
        if (typeof key === 'string') {
            const nodeList = analysis[key];
            if (nodeList) {
                analyze(nodeList[0]);
            }
        }
    }
}
;
let cache = setTimeout(() => { }, 0);
async function setup() {
    if (playBtn && stopBtn && breakerBtn && OscPreGain && OscPostGain && masterGain && variability && osc1 && osc2 && osc3) {
        await getProcessorModules();
        const latency = 150;
        let listening = true;
        playBtn.addEventListener('click', () => {
            if (listening) {
                clearTimeout(cache);
                cache = setTimeout(() => {
                    clearTimeout(cache);
                    listening = false;
                    sound();
                    listening = true;
                    playback = true;
                }, latency);
            }
        });
        stopBtn.addEventListener('click', () => {
            if (listening) {
                clearTimeout(cache);
                cache = setTimeout(() => {
                    clearTimeout(cache);
                    shutup();
                    playback = false;
                }, latency);
            }
        });
        breakerBtn.addEventListener('click', () => { window.location.reload(); });
        OscPreGain.addEventListener('input', () => {
            if (listening && playback) {
                clearTimeout(cache);
                cache = setTimeout(() => {
                    clearTimeout(cache);
                    listening = false;
                    sound();
                    listening = true;
                }, latency);
            }
        });
        OscPostGain.addEventListener('input', () => {
            if (listening && playback) {
                clearTimeout(cache);
                cache = setTimeout(() => {
                    clearTimeout(cache);
                    listening = false;
                    sound();
                    listening = true;
                }, latency);
            }
        });
        masterGain.addEventListener('input', () => {
            if (listening && playback) {
                clearTimeout(cache);
                cache = setTimeout(() => {
                    clearTimeout(cache);
                    sound();
                }, latency);
            }
        });
        variability.addEventListener('input', () => {
            if (playback) {
                clearTimeout(cache);
                cache = setTimeout(() => {
                    clearTimeout(cache);
                    sound();
                }, latency);
            }
        });
    }
}
;
setup();
//# sourceMappingURL=renderer.js.map