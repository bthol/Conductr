"use strict";
console.log("linked script");
;
window.electronAPI.res((data) => {
    console.log(data);
});
const options = { 'sampleRate': 44100.0, 'latencyHint': 'interactive' };
const audioContext = new AudioContext(options);
let playback = false;
let oscillators = {};
let voices = [];
let analysis = {};
let master = .75;
let FortePiano = 1;
let creciendo = 4;
let expressivity = 4;
let variance = 4;
let driveMult = 1;
let Attack = 1;
let Release = 1;
let Sustain = 1;
const masterGain = document.getElementById('master-gain');
const breakerBtn = document.getElementById('breaker');
const playBtn = document.getElementById('play-btn');
const stopBtn = document.getElementById('stop-btn');
const FPControl = document.getElementById('forte-piano');
const DMControl = document.getElementById('drive-multiplier');
const SControl = document.getElementById('staccato');
const LControl = document.getElementById('legato');
const TControl = document.getElementById('tenuto');
const VControl = document.getElementById('variability');
const EControl = document.getElementById('expressivity');
const CControl = document.getElementById('creciendo');
const osc1 = document.getElementById('osc1');
const osc2 = document.getElementById('osc2');
const osc3 = document.getElementById('osc3');
function linear() {
    const n_samples = 44100;
    const line = new Float32Array(n_samples);
    const incriment = 2 / n_samples;
    let y = -1;
    for (let x = 0; x < n_samples; x++) {
        line[x] = y;
        y += incriment;
    }
    line[n_samples / 2] = 0;
    line[n_samples - 1] = 1;
    return line;
}
;
function sigmoid1(amount = 2) {
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const k = typeof amount === 'number' ? amount >= 2 ? amount : 2 : 2;
    console.log(k);
    for (let i = 0; i < n_samples; ++i) {
        const x = (i * 2) / n_samples - 1;
        const output = Math.tanh(x * k) / Math.tanh(k);
        curve[i] = output < 1 ? output > -1 ? output : -1 : 1;
    }
    curve[n_samples - 1] = 1;
    return curve;
}
;
function sigmoid2(amount = 2) {
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const k = typeof amount === 'number' ? amount >= 2 ? amount : 2 : 2;
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
        const x = (i * 2) / n_samples - 1;
        const output = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
        curve[i] = output < 1 ? output > -1 ? output : -1 : 1;
    }
    curve[n_samples - 1] = 1;
    return curve;
}
;
function sigmoid3(amount = 1) {
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const k = typeof amount === 'number' ? amount >= 1 ? amount : 1 : 1;
    for (let i = 0; i < n_samples; ++i) {
        const x = ((i / (n_samples - 1)) * 2 - 1) * k;
        const output = (x / Math.sqrt(x * x + 1));
        curve[i] = output < 1 ? output > -1 ? output : -1 : 1;
    }
    curve[n_samples - 1] = 1;
    return curve;
}
;
async function getProcessorModules() {
    await audioContext.audioWorklet.addModule('./build/scripts/processors/clamp-processor.js');
    await audioContext.audioWorklet.addModule('./build/scripts/processors/LUFS-processor.js');
}
;
function integrateNumericalTrapezoidal(data) {
    let Area = 0;
    for (let i = 1; i < data.length - 1; i++) {
        const y = data[i];
        if (y === undefined) {
            return 0;
        }
        else {
            Area += Math.abs(y);
        }
    }
    const first = data[0];
    const last = data[data.length - 1];
    if (first === undefined || last === undefined) {
        return 0;
    }
    else {
        Area += (Math.abs(first) + Math.abs(last)) / 2;
    }
    return Area;
}
;
function peak(data) {
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
    return peak;
}
;
function analyzePeak(node) {
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
                    const peakVal = peak(data);
                    requestAnimationFrame(loop);
                }, 1000);
            }
        }
        ;
        loop(audioContext.currentTime);
    }
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
                    const peakVal = peak(data);
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
    if (masterGain && DMControl && FPControl && CControl && VControl) {
        let masterVal = Number(masterGain.value);
        if (masterVal > 100) {
            masterVal = 100;
        }
        else if (masterVal < 0) {
            masterVal = 0;
        }
        master = masterVal / 100;
        let CreciendoVal = Number(CControl.value);
        const CreciendoRange = 10;
        if (CreciendoVal > CreciendoRange) {
            CreciendoVal = CreciendoRange;
        }
        else if (CreciendoVal < -CreciendoRange) {
            CreciendoVal = -CreciendoRange;
        }
        else if (CreciendoVal > 0 && CreciendoVal % 1 !== 0) {
            CreciendoVal = Math.ceil(CreciendoVal);
        }
        else if (CreciendoVal < 0 && CreciendoVal % 1 !== 0) {
            CreciendoVal = Math.floor(CreciendoVal);
        }
        if (CreciendoVal === 0) {
            creciendo = 1;
        }
        else if (CreciendoVal > 0) {
            creciendo = 1 + CreciendoVal / CreciendoRange;
        }
        else if (CreciendoVal < 0) {
            creciendo = 1 + CreciendoVal / CreciendoRange;
        }
        else {
            creciendo = 1;
            console.log('macro range error: creciendo/diminuendo');
        }
        let expVal = Number(FPControl.value);
        const expRange = 10;
        if (expVal > expRange) {
            expVal = expRange;
        }
        else if (expVal < -expRange) {
            expVal = -expRange;
        }
        else if (expVal > 0 && expVal % 1 !== 0) {
            expVal = Math.ceil(expVal);
        }
        else if (expVal < 0 && expVal % 1 !== 0) {
            expVal = Math.floor(expVal);
        }
        if (expVal === 0) {
            FortePiano = 1;
        }
        else if (expVal > 0) {
            FortePiano = 1 + expVal / expRange;
        }
        else if (expVal < 0) {
            FortePiano = 1 + expVal / expRange;
        }
        else {
            FortePiano = 1;
            console.log('macro range error: Expressivity');
        }
        let driveMultiplier = Number(DMControl.value);
        const driveMultRange = 3 * creciendo;
        const driveMultGran = 10;
        if (driveMultiplier > driveMultGran * driveMultRange) {
            driveMultiplier = driveMultGran * driveMultRange;
        }
        else if (driveMultiplier < -driveMultGran) {
            driveMultiplier = -driveMultGran;
        }
        else if (driveMultiplier > 0 && driveMultiplier % 1 !== 0) {
            driveMultiplier = Math.ceil(driveMultiplier);
        }
        else if (driveMultiplier < 0 && driveMultiplier % 1 !== 0) {
            driveMultiplier = Math.floor(driveMultiplier);
        }
        if (driveMultiplier === 0) {
            driveMult = 1;
        }
        else if (driveMultiplier > 0) {
            driveMult = 1 + driveMultiplier / driveMultGran * creciendo;
        }
        else if (driveMultiplier < 0) {
            driveMult = 1 + driveMultiplier / driveMultGran * creciendo;
        }
        else {
            driveMult = 1;
            console.log('macro range error: Drive Multiplier');
        }
        let inVal = Number(FPControl.value);
        const inRange = 50;
        if (inVal > inRange) {
            inVal = inRange;
        }
        else if (inVal < -inRange) {
            inVal = -inRange;
        }
        else if (inVal > 0 && inVal % 1 !== 0) {
            inVal = Math.ceil(inVal);
        }
        else if (inVal < 0 && inVal % 1 !== 0) {
            inVal = Math.floor(inVal);
        }
        if (inVal === 0) {
            FortePiano = 1;
        }
        else if (inVal > 0) {
            FortePiano = 1 + inVal / inRange;
        }
        else if (inVal < 0) {
            FortePiano = 1 + inVal / inRange;
        }
        else {
            FortePiano = 1;
            console.log('macro range error: Forte Piano');
        }
        let vary = Number(VControl.value);
        if (vary > 10) {
            vary = 10;
        }
        else if (vary < 1) {
            vary = 1;
        }
        else if (inVal % 1 !== 0) {
            inVal = Math.ceil(inVal);
        }
        variance = vary;
    }
    const oscs = document.querySelectorAll('.oscs');
    let gotit = true;
    for (const osc of oscs) {
        if (osc) {
            const oscGain = osc.querySelector('.amplitude');
            const oscDriv = osc.querySelector('.drive');
            const oscDrCh = osc.querySelector('.drive-character');
            const oscVoic = osc.querySelector('.voices');
            const oscFreq = osc.querySelector('.frequency');
            const oscDetu = osc.querySelector('.detune');
            const oscPart = osc.querySelector('.partials');
            const oscType = osc.querySelector('.type');
            const ID = crypto.randomUUID().split('-')[0];
            if (oscGain && oscDriv && oscDrCh && oscVoic && oscFreq && oscDetu && oscPart && oscType && typeof ID === 'string') {
                const gain = Number(oscGain.value);
                const drive = Number(oscDriv.value);
                const driveCharacter = oscDrCh.value;
                const voices = Number(oscVoic.value);
                const freq = Number(oscFreq.value);
                const detune = Number(oscDetu.value);
                const partials = Number(oscPart.value);
                const type = oscType.value;
                const v = (variance * (freq / 20000));
                const gainFactor = .25;
                const gainV = Math.random() * v * gainFactor;
                const gainCalc = gain === 0 ? 0 : gain === 99 ? (1 - gainV - .01) * FortePiano : (-Math.log10(-(gain / 100) + 1) / 2 + gainV) * FortePiano;
                const freqFactor = .5;
                const freqV = Math.random() * v * freqFactor;
                const freqCalc = freq - freqV;
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
                else if (type === 'inf-conv-geo-series-0.5') {
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
                else if (type === 'inf-conv-geo-series-0.25') {
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
                else if (type === 'inf-conv-geo-series-0.125') {
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
                if (gainCalc >= 1) {
                    gainVal = 1 - gainV;
                }
                else if (gainCalc < 0) {
                    gainVal = 0;
                }
                let freqVal = freqCalc;
                if (freqVal > 20000) {
                    freqVal = 20000;
                }
                else if (freqVal < 20) {
                    freqVal = 20;
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
                else if (driveVal < 1) {
                    driveVal = 1;
                }
                let detuneVal = detune;
                if (detuneVal > 24) {
                    detuneVal = 24;
                }
                else if (detuneVal < -24) {
                    detuneVal = -24;
                }
                const osc = { 'waveform': waveform, 'oscVoices': voiceVal, 'gain': gainVal, 'drive': driveVal, 'driveCharacter': driveCharacter, 'freq': freqVal, 'detune': detuneVal };
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
            const oscVoic = oscil['oscVoices'];
            const oscFreq = oscil['freq'];
            const oscDetu = oscil['detune'];
            const oscVol = oscil['gain'];
            const oscDrive = oscil['drive'];
            const oscDriCh = oscil['driveCharacter'];
            const gainNode = audioContext.createGain();
            gainNode.gain.value = oscVoic === 0 ? 0 : oscVol / oscVoic;
            for (let v = 0; v < oscVoic; v++) {
                const osc = audioContext.createOscillator();
                osc.setPeriodicWave(waveform);
                osc.frequency.setValueAtTime(oscFreq, audioContext.currentTime);
                osc.detune.value = v * oscDetu;
                osc.connect(gainNode);
                voices.push(osc);
            }
            const preAnalyzer = audioContext.createAnalyser();
            analysis[key] = [];
            analysis[key].push(preAnalyzer);
            gainNode.connect(preAnalyzer);
            const makeupGainNode = audioContext.createGain();
            console.log('drive');
            console.log(oscDrive);
            if (oscDrive > 1) {
                const waveshaper = audioContext.createWaveShaper();
                const oversample = '2x';
                let waveshaperCurve;
                if (oscDriCh === 'sigmoid1') {
                    waveshaperCurve = sigmoid1(oscDrive * driveMult);
                }
                else if (oscDriCh === 'sigmoid2') {
                    waveshaperCurve = sigmoid2(oscDrive * driveMult);
                }
                else if (oscDriCh === 'sigmoid3') {
                    waveshaperCurve = sigmoid3(oscDrive * driveMult);
                }
                else {
                    waveshaperCurve = sigmoid3(oscDrive * driveMult);
                }
                waveshaper.curve = waveshaperCurve;
                waveshaper.oversample = oversample;
                const referenceLine = linear();
                const initialPower = integrateNumericalTrapezoidal(referenceLine);
                const finalPower = integrateNumericalTrapezoidal(waveshaperCurve);
                const powerFactor = 1 / (1 + ((finalPower - initialPower) / initialPower));
                makeupGainNode.gain.value = powerFactor;
                gainNode.connect(waveshaper);
                waveshaper.connect(makeupGainNode);
            }
            else {
                gainNode.connect(makeupGainNode);
                makeupGainNode.gain.value = 1;
            }
            const postAnalyzer = audioContext.createAnalyser();
            analysis[key].push(postAnalyzer);
            makeupGainNode.connect(postAnalyzer);
            makeupGainNode.connect(dry);
            makeupGainNode.connect(wet);
        }
        let dryVal = 0;
        let wetVal = 1;
        dry.gain.value = keys.length === 0 ? 0 : dryVal / keys.length;
        wet.gain.value = keys.length === 0 ? 0 : wetVal / keys.length;
        const FX = audioContext.createGain();
        FX.gain.value = 1;
        const preAnalysis = audioContext.createAnalyser();
        analysis['FX'] = [];
        analysis['FX'].push(preAnalysis);
        wet.connect(preAnalysis);
        const postAnalysis = audioContext.createAnalyser();
        analysis['FX'].push(postAnalysis);
        FX.connect(postAnalysis);
        wet.connect(FX);
        const compressor = audioContext.createDynamicsCompressor();
        compressor.threshold.value = -12;
        compressor.knee.value = 9;
        compressor.ratio.value = 3;
        compressor.attack.value = 0.05;
        compressor.release.value = 0.1;
        dry.connect(compressor);
        FX.connect(compressor);
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
        const masterGainNode = audioContext.createGain();
        masterGainNode.gain.value = Number(masterGain.value) / 100;
        brickwall.connect(masterGainNode);
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
            }
        }
    }
}
;
let cache = setTimeout(() => { }, 0);
async function setup() {
    if (playBtn && stopBtn && breakerBtn && masterGain && FPControl && CControl && VControl && osc1 && osc2 && osc3) {
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
        masterGain.addEventListener('input', () => {
            if (listening && playback) {
                clearTimeout(cache);
                cache = setTimeout(() => {
                    clearTimeout(cache);
                    sound();
                }, latency);
            }
        });
        FPControl.addEventListener('input', () => {
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
        CControl.addEventListener('input', () => {
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
}
;
setup();
//# sourceMappingURL=renderer.js.map