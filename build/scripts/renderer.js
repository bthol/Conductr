"use strict";
console.log("linked script");
;
window.electronAPI.res((data) => {
    console.log(data);
});
const options = { 'sampleRate': 44100.0, 'latencyHint': 'interactive' };
const audioContext = new AudioContext(options);
let macros = {
    'master': .75,
    'pan': 0,
    'tempo': 128,
    'beatsPerMeasure': 4,
    'FortePiano': 1,
    'creciendo': 5,
    'expressivity': 4,
    'variance': 4,
    'driveMult': 1,
    'Attack': 3,
    'Sustain': 5,
    'Release': 4,
};
let oscillators = {};
let sequencers = {};
let voices = [];
let sequences = {};
let analysis = {};
let playback = false;
let macrosInitialized = false;
let oscillatorsInitialized = false;
let sequencersInitialized = false;
const masterGain = document.getElementById('master-gain');
const masterPan = document.getElementById('master-pan');
const masterTempo = document.getElementById('master-tempo');
const masterMeasure = document.getElementById('master-beat-per-measure');
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
const seq1 = document.getElementById('seq1');
const seq2 = document.getElementById('seq2');
const seq3 = document.getElementById('seq3');
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
                    console.log(peakVal);
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
function initMacros() {
    macros['master'] = .75;
    macros['pan'] = 0;
    macros['tempo'] = 128;
    macros['beatsPerMeasure'] = 4;
    macros['FortePiano'] = 1;
    macros['creciendo'] = 1;
    macros['expressivity'] = 4;
    macros['variance'] = 2;
    macros['driveMult'] = 1;
    macros['Attack'] = 3;
    macros['Sustain'] = 5;
    macros['Release'] = 4;
    if (masterGain && masterPan && DMControl && FPControl && CControl && VControl) {
        masterGain.value = '75';
        masterPan.value = '0';
        DMControl.value = '1';
        FPControl.value = '1';
        CControl.value = '0';
        VControl.value = '2';
    }
    else {
        console.log('macro display initialization failed');
    }
    macrosInitialized = true;
}
;
function initOscillators() {
    oscillators = {};
    const oscsNodeList = document.querySelectorAll('.oscs');
    for (const osc of oscsNodeList) {
        const frequency = 65.4;
        const detune = -3;
        const partials = 256;
        const ID = crypto.randomUUID().split('-')[0];
        if (typeof ID === 'string') {
            const v = (macros['variance'] * (frequency / 20000));
            const timbFactor = .1;
            const stereoFactor = .15;
            const stereoV = Math.random() * v * stereoFactor / 1.5;
            const phi = (1 + stereoV * 30) * Math.PI / 180;
            const phaze = Math.pow(Math.E, phi);
            const real = new Float32Array(partials);
            const imag = new Float32Array(partials);
            let waveform;
            for (let n = 1; n < partials + 1; n++) {
                if (n % 2 !== 0) {
                    const sign = ((n - 1) / 2) % 2 === 0 ? 1 : -1;
                    const partial = (8 / Math.pow(Math.PI, 2)) * (sign / Math.pow(n, 2));
                    const timbCalc = ((Math.random() * (macros['variance'] - 1) + 1) / 10 * timbFactor - .01) * sign;
                    const out = partial + timbCalc;
                    imag[n] = out;
                }
                else {
                    imag[n] = 0;
                }
                real[n] = 0;
            }
            waveform = audioContext.createPeriodicWave(real, imag);
            oscillators[ID] = {
                'gain': .5,
                'drive': 1,
                'driveCharacter': 'sigmoid1',
                'oscVoices': 3,
                'freq': frequency,
                'detune': detune,
                'waveform': waveform,
            };
        }
        else {
            console.log('Oscillator ID generation failed during initialization');
        }
        const oscGain = osc.querySelector('.amplitude');
        const oscDriv = osc.querySelector('.drive');
        const oscDrCh = osc.querySelector('.drive-character');
        const oscVoic = osc.querySelector('.voices');
        const oscFreq = osc.querySelector('.frequency');
        const oscDetu = osc.querySelector('.detune');
        const oscPart = osc.querySelector('.partials');
        const oscType = osc.querySelector('.type');
        if (oscGain && oscDriv && oscDrCh && oscVoic && oscFreq && oscDetu && oscPart && oscType) {
            oscGain.value = '50';
            oscDriv.value = '1';
            oscDrCh.value = 'sigmoid1';
            oscVoic.value = '3';
            oscFreq.value = `${frequency}`;
            oscDetu.value = `${detune}`;
            oscPart.value = `${partials}`;
            oscType.value = 'triangle';
        }
        else {
            console.log('parameter elements not found during initialization');
        }
    }
    oscillatorsInitialized = true;
}
;
function initSequencers() {
    sequencers = {};
    const seqNodeList = document.querySelectorAll('.seqs');
    for (const seq of seqNodeList) {
        const ID = crypto.randomUUID().split('-')[0];
        if (typeof ID === 'string') {
            seq.id = ID;
            sequencers[ID] = setInterval(() => { }, 1000);
            clearInterval(sequences[ID]);
            sequencers[ID] = {
                'stages': 4,
                'levels': 25,
                'seqRate': '1/4',
                'type': 'lowpass',
                'cutoff': 1400,
                'resonance': 1,
                'ampMod': 0,
                'filtMod': 0,
                'freqMod': 0,
                'ampLvls': [0, 0, 0, 0],
                'filtLvls': [0, 0, 0, 0],
                'freqLvls': [0, 0, 0, 0],
            };
        }
        else {
            console.log('Sequencer ID generation failed during initialization');
        }
        const stagesEl = seq.querySelector('.stages');
        const levelsEl = seq.querySelector('.stage-levels');
        const seqRateEl = seq.querySelector('.sequence-rate');
        const filterTypeEL = seq.querySelector('.filter-type');
        const filterCutoffEL = seq.querySelector('.filter-cutoff');
        const filterResonanceEl = seq.querySelector('.filter-resonance');
        const ampModEl = seq.querySelector('.amp-mod');
        const filtModEl = seq.querySelector('.filt-mod');
        const freqModEl = seq.querySelector('.freq-mod');
        const ampSeqLvlsContEl = seq.querySelector('.amp-sequence-leveler-container');
        const filtSeqLvlsContEl = seq.querySelector('.filt-sequence-leveler-container');
        const freqSeqLvlsContEl = seq.querySelector('.freq-sequence-leveler-container');
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
            const ampList = ampSeqLvlsContEl.querySelectorAll('.leveler-stage-style');
            ampList.forEach((stage) => {
                stage.querySelector('.level-style')?.classList.remove('level-style');
                stage.firstElementChild?.classList.add('level-style');
            });
            const filtList = filtSeqLvlsContEl.querySelectorAll('.leveler-stage-style');
            filtList.forEach((stage) => {
                stage.querySelector('.level-style')?.classList.remove('level-style');
                stage.firstElementChild?.classList.add('level-style');
            });
            const freqList = freqSeqLvlsContEl.querySelectorAll('.leveler-stage-style');
            freqList.forEach((stage) => {
                stage.querySelector('.level-style')?.classList.remove('level-style');
                stage.firstElementChild?.classList.add('level-style');
            });
        }
        else {
            console.log('Sequencer parameter not found during initialization');
        }
    }
    sequencersInitialized = true;
}
;
function updateMacros() {
    if (masterGain && masterPan && masterTempo && masterMeasure && DMControl && FPControl && CControl && VControl) {
        let masterVal = Number(masterGain.value);
        if (masterVal > 100) {
            masterVal = 100;
        }
        else if (masterVal < 0) {
            masterVal = 0;
        }
        else if (masterVal % 1 !== 0) {
            masterVal = Math.ceil(masterVal);
        }
        macros['master'] = masterVal / 100;
        let masterPanVal = Number(masterPan.value);
        if (masterPanVal > 50) {
            masterPanVal = 50;
        }
        else if (masterPanVal < -50) {
            masterPanVal = -50;
        }
        else if (masterPanVal % 1 !== 0) {
            masterPanVal = Math.ceil(masterPanVal);
        }
        macros['pan'] = masterPanVal;
        let tempoVal = Number(masterTempo.value);
        if (tempoVal > 200) {
            tempoVal = 200;
        }
        else if (tempoVal < 1) {
            tempoVal = 1;
        }
        else if (tempoVal % 1 !== 0) {
            tempoVal = Math.ceil(tempoVal);
        }
        macros['tempo'] = tempoVal;
        let measureVal = Number(masterMeasure.value);
        if (measureVal > 200) {
            measureVal = 200;
        }
        else if (measureVal < 1) {
            measureVal = 1;
        }
        else if (measureVal % 1 !== 0) {
            measureVal = Math.ceil(measureVal);
        }
        macros['beatsPerMeasure'] = measureVal;
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
            macros['creciendo'] = 1;
        }
        else if (CreciendoVal > 0) {
            macros['creciendo'] = 1 + CreciendoVal / CreciendoRange;
        }
        else if (CreciendoVal < 0) {
            macros['creciendo'] = 1 + CreciendoVal / CreciendoRange;
        }
        else {
            macros['creciendo'] = 1;
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
            macros['FortePiano'] = 1;
        }
        else if (expVal > 0) {
            macros['FortePiano'] = 1 + expVal / expRange;
        }
        else if (expVal < 0) {
            macros['FortePiano'] = 1 + expVal / expRange;
        }
        else {
            macros['FortePiano'] = 1;
            console.log('macro range error: Expressivity');
        }
        let driveMultiplier = Number(DMControl.value);
        const driveMultRange = 3 * macros['creciendo'];
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
            macros['driveMult'] = 1;
        }
        else if (driveMultiplier > 0) {
            macros['driveMult'] = 1 + driveMultiplier / driveMultGran * macros['creciendo'];
        }
        else if (driveMultiplier < 0) {
            macros['driveMult'] = 1 + driveMultiplier / driveMultGran * macros['creciendo'];
        }
        else {
            macros['driveMult'] = 1;
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
            macros['FortePiano'] = 1;
        }
        else if (inVal > 0) {
            macros['FortePiano'] = 1 + inVal / inRange;
        }
        else if (inVal < 0) {
            macros['FortePiano'] = 1 + inVal / inRange;
        }
        else {
            macros['FortePiano'] = 1;
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
        macros['variance'] = vary;
        return true;
    }
    else {
        return false;
    }
}
;
function updateOscillator(oscID) {
    if (osc1 && osc2 && osc3) {
        const oscsNodeList = document.querySelectorAll('.oscs');
        const oscsKeyArray = Object.keys(oscillators);
        let osc = undefined;
        for (let i = 0; i < oscsKeyArray.length; i++) {
            const key = oscsKeyArray[i];
            if (key && key === oscID) {
                const result = oscsNodeList[i];
                if (result) {
                    osc = result;
                }
                break;
            }
        }
        if (osc) {
            const oscGain = osc.querySelector('.amplitude');
            const oscDriv = osc.querySelector('.drive');
            const oscDrCh = osc.querySelector('.drive-character');
            const oscVoic = osc.querySelector('.voices');
            const oscFreq = osc.querySelector('.frequency');
            const oscDetu = osc.querySelector('.detune');
            const oscPart = osc.querySelector('.partials');
            const oscType = osc.querySelector('.type');
            if (oscGain && oscDriv && oscDrCh && oscVoic && oscFreq && oscDetu && oscPart && oscType) {
                const gain = Number(oscGain.value);
                const drive = Number(oscDriv.value);
                const driveCharacter = oscDrCh.value;
                const voices = Number(oscVoic.value);
                const freq = Number(oscFreq.value);
                const detune = Number(oscDetu.value);
                const partials = Number(oscPart.value);
                const type = oscType.value;
                const v = (macros['variance'] * (freq / 20000));
                const gainFactor = .25;
                const gainV = Math.random() * v * gainFactor;
                const gainCalc = gain === 0 ? 0 : gain === 99 ? (1 - gainV - .01) * macros['FortePiano'] : (-Math.log10(-(gain / 100) + 1) / 2 + gainV) * macros['FortePiano'];
                const freqFactor = .5;
                const freqV = Math.random() * v * freqFactor;
                const freqCalc = freq - freqV;
                const stereoFactor = .15;
                const stereoV = Math.random() * v * stereoFactor / 1.5;
                const timbFactor = .1;
                let gainVal = gainCalc;
                if (gainCalc >= 1) {
                    gainVal = 1 - gainV;
                }
                else if (gainCalc < 0) {
                    gainVal = gainV;
                }
                else if (gainVal % 1 !== 0) {
                    gainVal = Math.ceil(gainVal);
                }
                let freqVal = freqCalc;
                if (freqVal > 20000) {
                    freqVal = 20000 - freqV;
                }
                else if (freqVal < 20) {
                    freqVal = 20 + freqV;
                }
                let voiceVal = voices;
                if (voiceVal > 4) {
                    voiceVal = 4;
                }
                else if (voiceVal < 1) {
                    voiceVal = 1;
                }
                else if (voiceVal % 1 !== 0) {
                    voiceVal = Math.ceil(voiceVal);
                }
                let driveVal = drive;
                if (driveVal > 10) {
                    driveVal = 10;
                }
                else if (driveVal < 1) {
                    driveVal = 1;
                }
                else if (driveVal % 1 !== 0) {
                    driveVal = Math.ceil(driveVal);
                }
                let detuneVal = detune;
                if (detuneVal > 24) {
                    detuneVal = 24;
                }
                else if (detuneVal < -24) {
                    detuneVal = -24;
                }
                else if (detuneVal % 1 !== 0) {
                    detuneVal = Math.ceil(detuneVal);
                }
                let partialsVal = partials;
                if (partialsVal > 4096) {
                    partialsVal = 4096;
                }
                else if (partialsVal < 16) {
                    partialsVal = 16;
                }
                else if (partialsVal % 1 !== 0) {
                    partialsVal = Math.ceil(partials);
                }
                const phi = (1 + stereoV * 30) * Math.PI / 180;
                const phaze = Math.pow(Math.E, phi);
                const real = new Float32Array(partialsVal);
                const imag = new Float32Array(partialsVal);
                let waveform;
                if (type === 'sine') {
                    real[1] = 1 * Math.cos(phaze);
                    imag[1] = 1 * Math.sin(phaze);
                    waveform = audioContext.createPeriodicWave(real, imag);
                }
                else if (type === 'triangle') {
                    for (let n = 1; n < partialsVal + 1; n++) {
                        if (n % 2 !== 0) {
                            const sign = ((n - 1) / 2) % 2 === 0 ? 1 : -1;
                            const partial = (8 / Math.pow(Math.PI, 2)) * (sign / Math.pow(n, 2));
                            const timbCalc = ((Math.random() * (macros['variance'] - 1) + 1) / 10 * timbFactor - .01) * sign;
                            const out = partial + timbCalc;
                            imag[n] = out;
                        }
                        else {
                            imag[n] = 0;
                        }
                        real[n] = 0;
                    }
                    waveform = audioContext.createPeriodicWave(real, imag);
                }
                else if (type === 'saw') {
                    for (let n = 1; n < partialsVal + 1; n++) {
                        const partial = 1 / (n * Math.PI);
                        const timbCalc = (Math.random() * (macros['variance'] - 1) + 1) / 10 * timbFactor - 0.01;
                        const out = partial - timbCalc;
                        imag[n] = out;
                    }
                    waveform = audioContext.createPeriodicWave(real, imag);
                }
                else if (type === 'square') {
                    for (let n = 0; n < partialsVal; n++) {
                        if (n % 2 !== 0) {
                            const partial = 4 / (n * Math.PI);
                            const timbCalc = (Math.random() * (macros['variance'] - 1) + 1) / 10 * timbFactor - .01;
                            const out = partial - timbCalc;
                            imag[n] = out;
                        }
                        else {
                            imag[n] = 0;
                        }
                    }
                    waveform = audioContext.createPeriodicWave(real, imag);
                }
                else if (type === 'inf-conv-geo-series-0.5') {
                    let a = 0;
                    let b = 1;
                    for (let i = 1; i < partialsVal; i++) {
                        const timbCalc = (Math.random() * (macros['variance'] - 1) + 1) / 10 * timbFactor - 0.01;
                        const out = b - timbCalc;
                        real[i] = a;
                        imag[i] = out;
                        b *= .5;
                    }
                    waveform = audioContext.createPeriodicWave(real, imag);
                }
                else if (type === 'inf-conv-geo-series-0.25') {
                    let a = 0;
                    let b = 1;
                    for (let i = 1; i < partialsVal; i++) {
                        const timbCalc = (Math.random() * (macros['variance'] - 1) + 1) / 10 * timbFactor - 0.01;
                        const out = b - timbCalc;
                        real[i] = a;
                        imag[i] = out;
                        b *= .25;
                    }
                    waveform = audioContext.createPeriodicWave(real, imag);
                }
                else if (type === 'inf-conv-geo-series-0.125') {
                    let a = 0;
                    let b = 1;
                    for (let i = 1; i < partialsVal; i++) {
                        const timbCalc = (Math.random() * (macros['variance'] - 1) + 1) / 10 * timbFactor - 0.01;
                        const out = b - timbCalc;
                        real[i] = a;
                        imag[i] = out;
                        b *= .125;
                    }
                    waveform = audioContext.createPeriodicWave(real, imag);
                }
                else if (type === 'inf-conv-geo-series-0.0625') {
                    let a = 0;
                    let b = 1;
                    for (let i = 1; i < partialsVal; i++) {
                        const timbCalc = (Math.random() * (macros['variance'] - 1) + 1) / 10 * timbFactor - 0.01;
                        const out = b - timbCalc;
                        real[i] = a;
                        imag[i] = out;
                        b *= .0625;
                    }
                    waveform = audioContext.createPeriodicWave(real, imag);
                }
                else {
                    real[0] = 0;
                    imag[0] = 0;
                    imag[1] = 1;
                    waveform = audioContext.createPeriodicWave(real, imag);
                }
                oscillators[oscID]['waveform'] = waveform;
                oscillators[oscID]['oscVoices'] = voiceVal;
                oscillators[oscID]['gain'] = gainVal;
                oscillators[oscID]['drive'] = driveVal;
                oscillators[oscID]['driveCharacter'] = driveCharacter;
                oscillators[oscID]['freq'] = freqVal;
                oscillators[oscID]['detune'] = detuneVal;
                return true;
            }
            else {
                console.log('parameter elements not found');
                return false;
            }
        }
        else {
            console.log('oscillator element not found');
            return false;
        }
    }
    else {
        console.log('oscillator element integrity degraded');
        return false;
    }
}
;
function updateSequence(seqID) {
    if (seq1 && seq2 && seq3) {
        const seqs = document.querySelectorAll('.seqs');
        const seqsKeyArray = Object.keys(sequencers);
        let seq = undefined;
        for (let i = 0; i < seqsKeyArray.length; i++) {
            const key = seqsKeyArray[i];
            if (key && key === seqID) {
                const result = seqs[i];
                if (result) {
                    seq = result;
                }
                break;
            }
        }
        if (seq) {
            const stagesEl = seq.querySelector('.stages');
            const levelsEl = seq.querySelector('.stage-levels');
            const seqRateEl = seq.querySelector('.sequence-rate');
            const filterTypeEL = seq.querySelector('.filter-type');
            const filterCutoffEL = seq.querySelector('.filter-cutoff');
            const filterResonanceEl = seq.querySelector('.filter-resonance');
            const ampModEl = seq.querySelector('.amp-mod');
            const filtModEl = seq.querySelector('.filt-mod');
            const freqModEl = seq.querySelector('.freq-mod');
            const ampSeqLvlsContEl = seq.querySelector('.amp-sequence-leveler-container');
            const filtSeqLvlsContEl = seq.querySelector('.filt-sequence-leveler-container');
            const freqSeqLvlsContEl = seq.querySelector('.freq-sequence-leveler-container');
            if (stagesEl && levelsEl && seqRateEl && filterTypeEL && filterCutoffEL && filterResonanceEl && ampModEl && filtModEl && freqModEl && ampSeqLvlsContEl && filtSeqLvlsContEl && freqSeqLvlsContEl) {
                const stages = Number(stagesEl.value);
                const levels = Number(levelsEl.value);
                const seqRate = ['1/32', '1/16', '1/8', '1/4', '1/2', '1/1', '2/1'].includes(seqRateEl.value) ? seqRateEl.value : '1/4';
                const filtType = ['allpass', 'bandpass', 'highpass', 'highshelf', 'lowpass', 'lowshelf', 'notch', 'peaking'].includes(filterTypeEL.value) ? filterTypeEL.value : 'lowpass';
                const cutoff = Number(filterCutoffEL.value);
                const resonance = Number(filterResonanceEl.value);
                const ampMod = Number(ampModEl.value);
                const filtMod = Number(filtModEl.value);
                const freqMod = Number(freqModEl.value);
                const ampLvlsStageList = ampSeqLvlsContEl.querySelectorAll('.leveler-stage-style');
                const filtLvlsStageList = filtSeqLvlsContEl.querySelectorAll('.leveler-stage-style');
                const freqLvlsStageList = freqSeqLvlsContEl.querySelectorAll('.leveler-stage-style');
                let ampLvls = [];
                let filtLvls = [];
                let freqLvls = [];
                for (let stage = 0; stage < stages; stage++) {
                    const ampStageLevelList = ampLvlsStageList[stage]?.querySelectorAll('div');
                    const filtStageLevelList = filtLvlsStageList[stage]?.querySelectorAll('div');
                    const freqStageLevelList = freqLvlsStageList[stage]?.querySelectorAll('div');
                    if (ampStageLevelList) {
                        for (let level = 0; level < levels; level++) {
                            if (ampStageLevelList[level]?.classList.contains('level-style')) {
                                ampLvls.push(level);
                                break;
                            }
                        }
                    }
                    else {
                        ampLvls.push(NaN);
                    }
                    if (filtStageLevelList) {
                        for (let level = 0; level < levels; level++) {
                            if (filtStageLevelList[level]?.classList.contains('level-style')) {
                                filtLvls.push(level);
                                break;
                            }
                        }
                    }
                    else {
                        filtLvls.push(NaN);
                    }
                    if (freqStageLevelList) {
                        for (let level = 0; level < levels; level++) {
                            if (freqStageLevelList[level]?.classList.contains('level-style')) {
                                freqLvls.push(level);
                                break;
                            }
                        }
                    }
                    else {
                        freqLvls.push(NaN);
                    }
                }
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
            }
            else {
                console.log('Sequencer parameter not found');
                return false;
            }
        }
        else {
            console.log('Sequencer element not found');
            return false;
        }
    }
    else {
        console.log('sequencer element integrity degraded');
        return false;
    }
}
;
function setupSequencer(seqID, oscFreq, oscVoic, inputNode) {
    if (sequencersInitialized) {
        const seq = sequencers[seqID];
        const levels = seq['levels'];
        const type = seq['filtType'];
        const cutoff = seq['cutoff'];
        const resonance = seq['resonance'];
        let ampMod = seq['ampMod'];
        let filtMod = seq['filtMod'];
        let freqMod = seq['freqMod'];
        const ampLvls = seq['ampLvls'];
        const filtLvls = seq['filtLvls'];
        const freqLvls = seq['freqLvls'];
        const stages = Number(seq['stages']);
        const measureDuration = 1 / (macros['tempo'] / macros['beatsPerMeasure']) * 60 * 1000;
        const rate = Number(seq['seqRate'].split('/')[0]) / Number(seq['seqRate'].split('/')[1]);
        const stageDuration = measureDuration * rate;
        if (ampMod > 10) {
            ampMod = 10;
        }
        else if (ampMod < 0) {
            ampMod = 0;
        }
        else if (ampMod % 1 !== 0) {
            ampMod = Math.ceil(ampMod);
        }
        ampMod = ampMod / 10;
        if (filtMod > 10) {
            filtMod = 10;
        }
        else if (filtMod < -10) {
            filtMod = -10;
        }
        else if (filtMod % 1 !== 0) {
            filtMod = Math.ceil(filtMod);
        }
        filtMod = (cutoff - 200) * (filtMod / 10);
        if (freqMod > 24) {
            freqMod = 24;
        }
        else if (freqMod < -24) {
            freqMod = -24;
        }
        else if (freqMod % 1 !== 0) {
            freqMod = Math.ceil(freqMod);
        }
        let oscs = [];
        for (let voice = voices.length - oscVoic; voice < voices.length; voice++) {
            const v = voices[voice];
            if (v) {
                oscs.push(v);
            }
            ;
        }
        const gainNode = audioContext.createGain();
        const filterNode = new BiquadFilterNode(audioContext, {
            type: type,
            frequency: cutoff,
            Q: resonance
        });
        inputNode.connect(gainNode);
        gainNode.connect(filterNode);
        for (let i = 0; i < stages; i++) {
            const amp = ampLvls[i];
            const filter = filtLvls[i];
            const frequency = freqLvls[i];
            if (amp !== undefined) {
                ampLvls[i] = amp / (levels - 1) * ampMod;
            }
            if (filter !== undefined) {
                filtLvls[i] = filter / (levels - 1) * filtMod;
            }
            if (frequency !== undefined) {
                const freq = Math.ceil(frequency / (levels - 1) * freqMod);
                const ratio = freq > 0 ? 1 + freq / 12 : freq < 0 ? 1 + (freq / 24 * .75) : 1;
                freqLvls[i] = ratio > 3 ? 3 : ratio < .25 ? .25 : ratio;
            }
        }
        const root = oscFreq;
        if (ampMod !== 0) {
            const amp = ampLvls[0];
            if (amp !== undefined) {
                gainNode.gain.value = amp;
            }
        }
        if (filtMod !== 0) {
            const filter = filtLvls[0];
            if (filter !== undefined) {
                filterNode.frequency.value = cutoff + filter;
            }
        }
        if (freqMod !== 0) {
            const ratio = freqLvls[0];
            if (ratio !== undefined) {
                oscs.forEach((osc) => {
                    osc.frequency.value = root * ratio;
                });
            }
        }
        let stage = 1;
        sequences[seqID] = setInterval(() => {
            if (ampMod !== 0) {
                const amp = ampLvls[stage];
                if (amp !== undefined) {
                    gainNode.gain.value = amp;
                }
            }
            if (filtMod !== 0) {
                const filter = filtLvls[stage];
                if (filter !== undefined) {
                    filterNode.frequency.value = cutoff + filter;
                }
            }
            if (freqMod !== 0) {
                const ratio = freqLvls[stage];
                if (ratio !== undefined) {
                    oscs.forEach((osc) => {
                        osc.frequency.value = root * ratio;
                    });
                }
            }
            stage += 1;
            if (stage === stages) {
                stage = 0;
            }
        }, stageDuration);
        return filterNode;
    }
    else {
        console.log(`cannot setup sequence ${seqID} before initialization`);
        return false;
    }
}
;
function shutup() {
    voices.forEach((osc) => { osc.stop(audioContext.currentTime); });
    const sequenceKeys = Object.keys(sequences);
    for (const seqID of sequenceKeys) {
        clearInterval(sequences[seqID]);
    }
    voices = [];
    analysis = {};
}
;
function soundAll(update = 'all') {
    let gotit = ['all', 'osc', 'seq'].includes(update);
    !gotit && console.log('passed bad argument to update parameter in soundAll function');
    if (gotit) {
        if (playback) {
            shutup();
        }
        ;
    }
    if (gotit) {
        if (update === 'all') {
            if (!updateMacros()) {
                gotit = false;
            }
            ;
        }
    }
    if (gotit) {
        if (update === 'all' || update === 'osc') {
            const oscKeys = Object.keys(oscillators);
            if (oscKeys.length > 0) {
                for (const key of oscKeys) {
                    if (!updateOscillator(key)) {
                        gotit = false;
                        break;
                    }
                }
            }
            else {
                gotit = false;
                console.log('Failed to get oscillator keys during update');
            }
        }
    }
    if (gotit) {
        if (update === 'all' || update === 'seq' || update === 'osc') {
            const seqKeys = Object.keys(sequencers);
            if (seqKeys.length > 0) {
                for (const key of seqKeys) {
                    if (!updateSequence(key)) {
                        gotit = false;
                        break;
                    }
                }
            }
            else {
                gotit = false;
                console.log('Failed to get sequencer keys during update');
            }
        }
    }
    if (gotit && playback) {
        const dry = audioContext.createGain();
        const wet = audioContext.createGain();
        const oscKeys = Object.keys(oscillators);
        const oscKeysLength = oscKeys.length;
        const seqKeys = Object.keys(sequencers);
        let seqKeyIndex = 0;
        for (const key of oscKeys) {
            const oscil = oscillators[key];
            const oscVoic = oscil['oscVoices'];
            const oscFreq = oscil['freq'];
            const oscDetu = oscil['detune'];
            const oscVol = oscil['gain'];
            const oscDrive = oscil['drive'];
            const oscDriCh = oscil['driveCharacter'];
            const waveform = oscil['waveform'];
            const gainNode = audioContext.createGain();
            gainNode.gain.value = oscVoic === 0 ? 0 : oscVol / oscVoic;
            for (let v = 0; v < oscVoic; v++) {
                const osc = audioContext.createOscillator();
                osc.setPeriodicWave(waveform);
                osc.frequency.setValueAtTime(oscFreq, audioContext.currentTime);
                osc.detune.value = oscDetu / oscVoic * v;
                osc.connect(gainNode);
                voices.push(osc);
            }
            const preAnalyzer = audioContext.createAnalyser();
            analysis[key] = [];
            analysis[key].push(preAnalyzer);
            gainNode.connect(preAnalyzer);
            const makeupGainNode = audioContext.createGain();
            if (oscDrive > 1) {
                const waveshaper = audioContext.createWaveShaper();
                const oversample = '2x';
                let waveshaperCurve;
                if (oscDriCh === 'sigmoid1') {
                    waveshaperCurve = sigmoid1(oscDrive * macros['driveMult']);
                }
                else if (oscDriCh === 'sigmoid2') {
                    waveshaperCurve = sigmoid2(oscDrive * macros['driveMult']);
                }
                else if (oscDriCh === 'sigmoid3') {
                    waveshaperCurve = sigmoid3(oscDrive * macros['driveMult']);
                }
                else {
                    waveshaperCurve = sigmoid3(oscDrive * macros['driveMult']);
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
            const seqID = seqKeys[seqKeyIndex];
            if (seqID) {
                const seqNode = setupSequencer(seqID, oscFreq, oscVoic, makeupGainNode);
                if (typeof seqNode !== "boolean") {
                    seqNode.connect(dry);
                    seqNode.connect(wet);
                }
                else {
                    console.log('sequencer setup failed');
                    makeupGainNode.connect(dry);
                    makeupGainNode.connect(wet);
                }
            }
            else {
                console.log('sequencer not found during setup');
                makeupGainNode.connect(dry);
                makeupGainNode.connect(wet);
            }
            seqKeyIndex += 1;
        }
        let dryVal = 0;
        let wetVal = 1;
        dry.gain.value = oscKeysLength === 0 ? 0 : dryVal / oscKeysLength;
        wet.gain.value = oscKeysLength === 0 ? 0 : wetVal / oscKeysLength;
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
    }
    if (gotit && playback) {
        const keys = Object.keys(analysis);
        const key = keys[0];
        if (typeof key === 'string') {
            const nodeList = analysis[key];
            if (nodeList) {
            }
        }
        for (const voice of voices) {
            voice.start();
        }
    }
}
;
function sequencerEvent(event) {
    console.log('seq event');
    const target = event.target;
    if (event.type === 'click') {
        const parent = target.parentElement;
        if (parent) {
            const seqID = parent.parentElement?.parentElement?.parentElement?.parentElement?.parentElement?.id;
            if (seqID) {
                if (parent.classList.contains('leveler-stage-style')) {
                    if (!target.classList.contains('level-style')) {
                        const leveler = parent.parentElement;
                        if (leveler) {
                            if (leveler.classList.contains('amp-sequence-leveler-container')) {
                                const stageNum = Number(parent.classList[1]?.split('-')[1]);
                                const stage = stageNum === undefined ? 0 : stageNum;
                                const levelList = parent.querySelectorAll('div');
                                let level = 0;
                                for (const el of levelList) {
                                    if (el === target) {
                                        parent.querySelector('.level-style')?.classList.remove('level-style');
                                        el.classList.add('level-style');
                                        break;
                                    }
                                    else {
                                        level += 1;
                                    }
                                }
                                sequencers[seqID]['ampLvls'][stage] = level;
                                soundAll('seq');
                            }
                            else if (leveler.classList.contains('filt-sequence-leveler-container')) {
                                const stageNum = Number(parent.classList[1]?.split('-')[1]);
                                const stage = stageNum === undefined ? 0 : stageNum;
                                const levelList = parent.querySelectorAll('div');
                                let level = 0;
                                for (const el of levelList) {
                                    if (el === target) {
                                        parent.querySelector('.level-style')?.classList.remove('level-style');
                                        el.classList.add('level-style');
                                        break;
                                    }
                                    else {
                                        level += 1;
                                    }
                                }
                                sequencers[seqID]['filtLvls'][stage] = level;
                                soundAll('seq');
                            }
                            else if (leveler.classList.contains('freq-sequence-leveler-container')) {
                                const stageNum = Number(parent.classList[1]?.split('-')[1]);
                                const stage = stageNum === undefined ? 0 : stageNum;
                                const levelList = parent.querySelectorAll('div');
                                let level = 0;
                                for (const el of levelList) {
                                    if (el === target) {
                                        parent.querySelector('.level-style')?.classList.remove('level-style');
                                        el.classList.add('level-style');
                                        break;
                                    }
                                    else {
                                        level += 1;
                                    }
                                }
                                sequencers[seqID]['freqLvls'][stage] = level;
                                soundAll('seq');
                            }
                        }
                    }
                }
            }
        }
    }
    else if (event.type === 'change') {
        soundAll('seq');
    }
}
;
function oscillatorEvent(event) {
    console.log('osc event');
    const target = event.target;
    if (event.type === 'change' && target.classList.contains('type')) {
        soundAll('osc');
    }
    if (target.classList.contains('amplitude') || target.classList.contains('drive') || target.classList.contains('drive-character') || target.classList.contains('frequency') || target.classList.contains('voices') || target.classList.contains('detune') || target.classList.contains('partials')) {
        soundAll('osc');
    }
}
;
let cache = setTimeout(() => { }, 0);
async function setup() {
    if (playBtn && stopBtn && breakerBtn && masterGain && masterPan && FPControl && CControl && VControl && seq1 && seq2 && seq3 && osc1 && osc2 && osc3) {
        await getProcessorModules();
        initMacros();
        initOscillators();
        initSequencers();
        const latency = 150;
        let listening = true;
        playBtn.addEventListener('click', () => {
            if (listening) {
                clearTimeout(cache);
                cache = setTimeout(() => {
                    clearTimeout(cache);
                    listening = false;
                    playback = true;
                    soundAll();
                    listening = true;
                }, latency);
            }
        });
        stopBtn.addEventListener('click', () => {
            if (listening) {
                clearTimeout(cache);
                cache = setTimeout(() => {
                    clearTimeout(cache);
                    listening = false;
                    shutup();
                    playback = false;
                    listening = true;
                }, latency);
            }
        });
        breakerBtn.addEventListener('click', () => { window.location.reload(); });
        masterGain.addEventListener('input', () => {
            if (listening && playback) {
                clearTimeout(cache);
                cache = setTimeout(() => {
                    clearTimeout(cache);
                    listening = false;
                    soundAll();
                    listening = true;
                }, latency);
            }
        });
        masterPan.addEventListener('input', () => {
            if (listening && playback) {
                clearTimeout(cache);
                cache = setTimeout(() => {
                    clearTimeout(cache);
                    listening = false;
                    soundAll();
                    listening = true;
                }, latency);
            }
        });
        masterTempo.addEventListener('input', () => {
            if (listening && playback && masterTempo) {
                clearTimeout(cache);
                cache = setTimeout(() => {
                    clearTimeout(cache);
                    listening = false;
                    soundAll();
                    listening = true;
                }, latency);
            }
        });
        masterMeasure.addEventListener('input', () => {
            if (listening && playback && masterMeasure) {
                clearTimeout(cache);
                cache = setTimeout(() => {
                    clearTimeout(cache);
                    listening = false;
                    soundAll();
                    listening = true;
                }, latency);
            }
        });
        FPControl.addEventListener('input', () => {
            if (listening && playback) {
                clearTimeout(cache);
                cache = setTimeout(() => {
                    clearTimeout(cache);
                    listening = false;
                    soundAll();
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
                    soundAll();
                    listening = true;
                }, latency);
            }
        });
        VControl.addEventListener('input', () => {
            if (playback) {
                clearTimeout(cache);
                cache = setTimeout(() => {
                    clearTimeout(cache);
                    listening = false;
                    soundAll();
                    listening = true;
                }, latency);
            }
        });
        const seqsNodeList = document.querySelectorAll('.seqs');
        if (seqsNodeList.length > 0) {
            for (const seqEl of seqsNodeList) {
                if (seqEl) {
                    ['click', 'change'].forEach((eventType) => {
                        seqEl.addEventListener(eventType, (event) => {
                            listening = false;
                            sequencerEvent(event);
                            listening = true;
                        });
                    });
                }
            }
        }
        else {
            console.log('sequencer elements not found during listener setup');
        }
        const oscsNodeList = document.querySelectorAll('.oscs');
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
                    });
                }
            }
        }
        else {
            console.log('oscillator elements not found during listener setup');
        }
    }
    else {
        console.log('Element Integrity Degraded during listener setup');
    }
}
;
setup();
//# sourceMappingURL=renderer.js.map