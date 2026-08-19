"use strict";
;
window.electronAPI.res((data) => {
    console.log(data);
});
const options = { 'sampleRate': 44100.0, 'latencyHint': 'interactive' };
const audioContext = new AudioContext(options);
const meterLevels = [0, -1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11, -12, -15, -18, -21, -24, -30];
const targetPeak = 1.0;
const upperEnergyThreshhold = 0.15;
const lowerEnergyThreshhold = 0.025;
let macros = {
    'master': .75,
    'pan': 0,
    'tempo': 128,
    'beatsPerMeasure': 4,
    'FortePiano': 1,
    'driveMult': 1,
    'creciendo': 0,
    'variance': 2,
    'expressivity': 0,
    'Attack': 3,
    'Release': 4,
    'Sustain': 5,
};
let FXdata = {
    'DryWet': 1,
};
let oscillators = {};
let sequencers = {};
let voices = [];
let sequences = {};
let sequencesGain = [];
let analysis = {};
let audioWorkletNodes = [];
let playback = false;
let macrosInitialized = false;
let oscillatorsInitialized = false;
let sequencersInitialized = false;
let FXInitialized = false;
let analysisInitialized = false;
const meterMaster = document.getElementById('meter-master');
const meterFX = document.getElementById('meter-FX');
const meter1 = document.getElementById('meter-1');
const meter2 = document.getElementById('meter-2');
const meter3 = document.getElementById('meter-3');
const breakerBtn = document.getElementById('breaker');
const playBtn = document.getElementById('play-btn');
const stopBtn = document.getElementById('stop-btn');
const masterGain = document.getElementById('master-gain');
const masterPan = document.getElementById('master-pan');
const masterTempo = document.getElementById('master-tempo');
const masterMeasure = document.getElementById('master-beat-per-measure');
const DryWetFX = document.getElementById('dry-wet-fx');
const EQBandControl1 = document.getElementById('eq-band-1');
const EQBandControl2 = document.getElementById('eq-band-2');
const EQBandControl3 = document.getElementById('eq-band-3');
const EQCutoffControl1 = document.getElementById('eq-cutoff-1');
const EQCutoffControl2 = document.getElementById('eq-cutoff-2');
const EQQControl = document.getElementById('eq-Q-control');
const FPControl = document.getElementById('forte-piano');
const DMControl = document.getElementById('drive-multiplier');
const EControl = document.getElementById('expressivity');
const SControl = document.getElementById('staccato');
const LControl = document.getElementById('legato');
const TControl = document.getElementById('tenuto');
const CControl = document.getElementById('creciendo');
const VControl = document.getElementById('variability');
const seq1 = document.getElementById('seq1');
const seq2 = document.getElementById('seq2');
const seq3 = document.getElementById('seq3');
const osc1 = document.getElementById('osc1');
const osc2 = document.getElementById('osc2');
const osc3 = document.getElementById('osc3');
function renderLeveler(stages, levels, container) {
    container.innerHTML = '';
    for (let s = 1; s < stages + 1; s++) {
        const stage = document.createElement('div');
        stage.setAttribute('class', `leveler-stage-style stage-${s}`);
        for (let l = 0; l < levels; l++) {
            const level = document.createElement('div');
            stage.appendChild(level);
        }
        if (stage.firstElementChild) {
            stage.firstElementChild.setAttribute('class', 'level-style');
        }
        container.appendChild(stage);
    }
}
;
function renderMeterLevel(level, root, selector) {
    if (root) {
        const container = root.querySelector(`.${selector}`);
        if (container) {
            container.querySelector('.on')?.classList.remove('on');
            const NodeList = container.querySelectorAll('.gradation');
            let index = 0;
            for (let i = 0; i < meterLevels.length; i++) {
                const compare = meterLevels[i];
                if (compare && compare === level) {
                    index = i;
                    break;
                }
            }
            const node = NodeList[index];
            if (node) {
                node.classList.add('on');
            }
            else {
                console.log('meter level rerender failed due to missing level element');
            }
        }
        else {
            console.log('meter level rerender failed due to faulty selector');
        }
    }
    else {
        console.log('meter level rerender failed due to missing root element');
    }
}
;
function normEngine(partials, real, imag) {
    let maxPeak = 0;
    const r = real[0];
    const i = imag[0];
    let fallback = false;
    if (r !== undefined && i !== undefined) {
        maxPeak += Math.sqrt(r ** 2 + i ** 2);
        for (let p = 1; p < partials; p++) {
            const r = real[p];
            const i = imag[p];
            if (r !== undefined && i !== undefined) {
                const amp = 2 * Math.sqrt(r ** 2 + i ** 2);
                maxPeak += amp;
            }
            else {
                fallback = true;
                break;
            }
        }
        const scalingFactor = targetPeak / maxPeak;
        const normReal = new Float32Array(partials);
        const normImag = new Float32Array(partials);
        for (let i = 0; i < real.length; i++) {
            let rea = real[i];
            let ima = imag[i];
            if (rea !== undefined && ima !== undefined) {
                normReal[i] = rea * scalingFactor;
                normImag[i] = ima * scalingFactor;
            }
            else {
                fallback = true;
                break;
            }
        }
        let componentAmps = new Float32Array(partials);
        for (let c = 0; c < real.length; c++) {
            const r = normReal[c];
            const i = normImag[c];
            if (r !== undefined && i !== undefined) {
                const amp = 2 * Math.sqrt(r ** 2 + i ** 2);
                componentAmps[c] = amp;
            }
        }
        const E = meanSquare(componentAmps) * partials;
        const EFactor = E > upperEnergyThreshhold ? upperEnergyThreshhold / E : E < lowerEnergyThreshhold ? lowerEnergyThreshhold / E : 1;
        const realE = new Float32Array(partials);
        const imagE = new Float32Array(partials);
        for (let c = 0; c < real.length; c++) {
            const r = normReal[c];
            const i = normImag[c];
            if (i !== undefined && r !== undefined) {
                realE[c] = r * EFactor;
                imagE[c] = i * EFactor;
            }
        }
        if (!fallback) {
            return audioContext.createPeriodicWave(realE, imagE, { disableNormalization: true });
        }
    }
    else {
        fallback = true;
    }
    if (fallback) {
        console.log('fell back to default normalization');
        return audioContext.createPeriodicWave(real, imag);
    }
    return audioContext.createPeriodicWave(real, imag);
}
;
function varyEngine(gain, freq) {
    const v = (macros['variance'] * (freq / 20000));
    const gainFactor = .25;
    const freqFactor = .5;
    const stereoFactor = .15;
    const timbFactor = .1;
    const gainV = Math.random() * v * gainFactor;
    const freqV = Math.random() * v * freqFactor;
    const stereoV = Math.random() * v * stereoFactor;
    const timbreV = Math.random() * v * timbFactor;
    const curve = gain === 0 || gain / 100 < gainV ** 2 ? 0 : (gain / 100) ** 2 - gainV ** 2;
    const gainCalc = macros['FortePiano'] / 4 * curve;
    const freqCalc = freq - (Math.abs(freq - 20) / 15 * freqV);
    const phi = (45 + timbreV * 30) * Math.PI / 180;
    const phaze = Math.pow(Math.E, phi);
    return { gainCalc: gainCalc, freqCalc: freqCalc, phi: phi, phaze: phaze, timbFactor: timbFactor };
}
;
function meanSquare(data) {
    const ms = data.reduce((accumulator, value) => { return accumulator + value ** 2; }, 0);
    return ms / data.length;
}
;
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
function logistic(drive = 1) {
    const k = typeof drive === 'number' ? drive > 1 ? drive : 1 : 1;
    const L = 1;
    const x0 = 0;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    for (let n = 1; n <= n_samples; n++) {
        const x = ((n * 2) / n_samples) - 1;
        const output = L / (Math.E ** (-k * (x - x0)));
        curve[n] = output < 1 ? output > -1 ? output : -1 : 1;
    }
    curve[0] = 0;
    curve[n_samples - 1] = 1;
    return curve;
}
;
function serpentine(drive = 1) {
    const k = typeof drive === 'number' ? drive > 1 ? drive : 1 : 1;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    for (let n = 1; n <= n_samples; n++) {
        const x = ((n * 2) / n_samples) - 1;
        const output = (4 * x / Math.sqrt(4 * x ** 2 + 1)) * k;
        curve[n] = output < 1 ? output > -1 ? output : -1 : 1;
    }
    curve[0] = 0;
    curve[n_samples - 1] = 1;
    return curve;
}
;
function gompertz(drive = 1) {
    const c = typeof drive === 'number' ? drive > 1 ? drive : 1 : 1;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    for (let n = 1; n <= n_samples; n++) {
        const x = ((n * 2) / n_samples) - 1;
        const numerator = Math.E ** (-(Math.E ** (-c * x))) - Math.E ** (-(Math.E ** c));
        const denominator = Math.E ** (-(Math.E ** (-c))) - Math.E ** (-(Math.E ** c));
        const output = numerator / denominator * 2 - 1;
        curve[n] = output < 1 ? output > -1 ? output : -1 : 1;
    }
    curve[0] = 0;
    curve[n_samples - 1] = 1;
    return curve;
}
;
async function getProcessorModules() {
    await audioContext.audioWorklet.addModule('./build/scripts/processors/clamp-processor.js');
    await audioContext.audioWorklet.addModule('./build/scripts/processors/peak-processor.js');
    await audioContext.audioWorklet.addModule('./build/scripts/processors/RMS-processor.js');
    await audioContext.audioWorklet.addModule('./build/scripts/processors/LUFS-processor.js');
}
;
function clamp(input) {
    const processor = new AudioWorkletNode(audioContext, 'clamp-processor');
    audioWorkletNodes.push(processor);
    input.connect(processor);
    return processor;
}
;
function peakLevel(input, root, selector) {
    if (root) {
        const processor = new AudioWorkletNode(audioContext, 'peak-processor');
        audioWorkletNodes.push(processor);
        processor.port.onmessage = (event) => {
            renderMeterLevel(event.data.data, root, selector);
        };
        input.connect(processor);
    }
    else {
        console.log('peak meter setup failed because root element not found');
    }
}
;
function RMSLevel(input, root, selector) {
    if (root) {
        const processor = new AudioWorkletNode(audioContext, 'RMS-processor');
        audioWorkletNodes.push(processor);
        processor.port.onmessage = (event) => {
            renderMeterLevel(event.data.data, root, selector);
        };
        input.connect(processor);
    }
    else {
        console.log('RMS meter setup failed because root element not found');
    }
}
function LUFSLevel(input, root, selector) {
    if (root) {
        const processor = new AudioWorkletNode(audioContext, 'LUFS-processor');
        audioWorkletNodes.push(processor);
        processor.port.onmessage = (event) => {
            renderMeterLevel(event.data.data, root, selector);
        };
        input.connect(processor);
    }
    else {
        console.log('LUFS meter setup failed because root element not found');
    }
}
;
function initMacros() {
    macros['master'] = 1;
    macros['pan'] = 0;
    macros['tempo'] = 128;
    macros['beatsPerMeasure'] = 4;
    macros['FortePiano'] = 4;
    macros['driveMult'] = 1;
    macros['creciendo'] = 0;
    macros['variance'] = 2;
    macros['expressivity'] = 0;
    macros['Attack'] = 3;
    macros['Release'] = 10;
    macros['Sustain'] = 3.5;
    if (masterGain && masterPan && DMControl && FPControl && EControl && CControl && VControl && SControl && LControl && TControl) {
        masterGain.value = '100';
        masterPan.value = '0';
        DMControl.value = '0';
        FPControl.value = '30';
        CControl.value = '0';
        VControl.value = '2';
        EControl.value = '0';
        SControl.value = '1';
        LControl.value = '5';
        TControl.value = '5';
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
    let count = 0;
    for (const osc of oscsNodeList) {
        count += 1;
        const gain = 0.244089621695242;
        const frequency = 261.6;
        const detune = -3;
        const partials = 256;
        const unique = crypto.randomUUID().split('-')[0];
        if (typeof unique === 'string') {
            const ID = `${count}-${unique}`;
            osc.id = ID;
            const { gainCalc, freqCalc, phi, phaze, timbFactor } = varyEngine(gain, frequency);
            const real = new Float32Array(partials);
            const imag = new Float32Array(partials);
            let waveform;
            for (let n = 1; n < partials + 1; n++) {
                if (n % 2 !== 0) {
                    const sign = ((n - 1) / 2) % 2 === 0 ? 1 : -1;
                    const partial = (8 / Math.pow(Math.PI, 2)) * (sign / Math.pow(n, 2));
                    const timbCalc = (Math.random() * (macros['variance'] / 10) * timbFactor) * sign;
                    const out = partial + timbCalc;
                    imag[n] = out;
                }
                else {
                    imag[n] = 0;
                }
                real[n] = 0;
            }
            real[0] = 0;
            imag[0] = 0;
            waveform = normEngine(partials, real, imag);
            oscillators[ID] = {
                'gain': gainCalc,
                'drive': 0,
                'driveCharacter': 'Logistic',
                'oscVoices': 3,
                'freq': freqCalc,
                'detune': detune,
                'waveform': waveform,
                'meterID': `meter-${count}`,
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
            oscDriv.value = '0';
            oscDrCh.value = 'Logistic';
            oscVoic.value = '2';
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
    const seqNodeList = document.querySelectorAll('.seqs');
    let count = 0;
    for (const seq of seqNodeList) {
        count += 1;
        const unique = crypto.randomUUID().split('-')[0];
        if (typeof unique === 'string') {
            const ID = `${count}-${unique}`;
            seq.id = ID;
            sequencers[ID] = {
                'stages': 4,
                'levels': 25,
                'seqRate': '1/4',
                'type': 'lowpass',
                'cutoff': 1680,
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
            filterCutoffEL.value = '1680';
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
function initFX() {
    FXdata['DryWet'] = 0;
    FXdata['EQ'] = {
        'b1': 1,
        'b2': .5,
        'b3': .63,
        'c1': 500,
        'c2': 3000,
        'Q': .1,
    };
    if (DryWetFX && EQBandControl1 && EQBandControl2 && EQBandControl3 && EQCutoffControl1 && EQCutoffControl2 && EQQControl) {
        DryWetFX.value = '0';
        EQBandControl1.value = '100';
        EQBandControl2.value = '50';
        EQBandControl3.value = '63';
        EQCutoffControl1.value = '500';
        EQCutoffControl2.value = '3000';
        EQQControl.value = '1';
    }
    else {
        console.log('FX parameter not found during initialization');
    }
    FXInitialized = true;
}
;
function initAnalysis() {
    analysis['master'] = [];
    analysis['FX'] = [];
    analysisInitialized = true;
}
;
function updateMacros() {
    if (macrosInitialized && masterGain && masterPan && masterTempo && masterMeasure && DMControl && FPControl && EControl && CControl && VControl && SControl && LControl && TControl) {
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
        let expVal = Number(EControl.value);
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
            macros['expressivity'] = 0;
        }
        else if (expVal > 0) {
            macros['expressivity'] = expVal / expRange;
        }
        else if (expVal < 0) {
            macros['expressivity'] = expVal / expRange;
        }
        else {
            macros['expressivity'] = 0;
            console.log('macro range error: Expressivity');
        }
        let driveMultiplier = Number(DMControl.value);
        const driveMultRange = 3;
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
            macros['driveMult'] = (1 + driveMultiplier / driveMultGran) * macros['creciendo'];
        }
        else if (driveMultiplier < 0) {
            macros['driveMult'] = (1 + driveMultiplier / driveMultGran) * macros['creciendo'];
        }
        else {
            macros['driveMult'] = 1;
            console.log('macro range error: Drive Multiplier');
        }
        let inVal = Number(FPControl.value);
        if (inVal > 30) {
            inVal = 30;
        }
        else if (inVal < -10) {
            inVal = -10;
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
            macros['FortePiano'] = (1 + inVal / 10) * macros['creciendo'];
        }
        else if (inVal < 0) {
            macros['FortePiano'] = macros['creciendo'] === 0 ? 0 : (1 + inVal / 10) / macros['creciendo'];
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
        if (vary === 1) {
            macros['variance'] = 0;
        }
        else {
            macros['variance'] = vary * macros['creciendo'];
        }
        let staccato = Number(SControl.value);
        if (staccato > 10) {
            staccato = 10;
        }
        else if (staccato < 1) {
            staccato = 1;
        }
        else if (staccato % 1 !== 0) {
            staccato = Math.ceil(staccato);
        }
        let legato = Number(LControl.value);
        if (legato > 10) {
            legato = 10;
        }
        else if (legato < 1) {
            legato = 1;
        }
        else if (legato % 1 !== 0) {
            legato = Math.ceil(legato);
        }
        let tenuto = Number(TControl.value);
        if (tenuto > 10) {
            tenuto = 10;
        }
        else if (tenuto < 1) {
            tenuto = 1;
        }
        else if (tenuto % 1 !== 0) {
            tenuto = Math.ceil(tenuto);
        }
        let A, R, S;
        A = (tenuto + legato) / 2;
        R = 11 - legato;
        S = 5.5 + (staccato - tenuto) / 2;
        macros['Attack'] = A;
        macros['Release'] = R;
        macros['Sustain'] = S;
        return true;
    }
    else {
        return false;
    }
}
;
function updateOscillator(oscID) {
    if (oscillatorsInitialized && osc1 && osc2 && osc3) {
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
                const { gainCalc, freqCalc, phi, phaze, timbFactor } = varyEngine(gain, freq);
                let gainVal = gainCalc;
                if (gainCalc > 1) {
                    gainVal = 1 - Math.random() * .1;
                }
                else if (gainCalc < 0) {
                    gainVal = Math.random() * .1;
                }
                let freqVal = freqCalc;
                if (freqVal > 20000) {
                    freqVal = 20000 - Math.random() * 1000;
                }
                else if (freqVal < 20) {
                    freqVal = 20 + Math.random() * 10;
                }
                let voiceVal = voices;
                if (voiceVal > 3) {
                    voiceVal = 3;
                }
                else if (voiceVal < 0) {
                    voiceVal = 0;
                }
                else if (voiceVal % 1 !== 0) {
                    voiceVal = Math.ceil(voiceVal);
                }
                let driveVal = drive;
                if (driveVal > 10) {
                    driveVal = 10;
                }
                else if (driveVal < 0) {
                    driveVal = 0;
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
                const real = new Float32Array(partialsVal);
                const imag = new Float32Array(partialsVal);
                let waveform = [];
                if (type === 'sine') {
                    imag[1] = 1;
                }
                else if (type === 'triangle') {
                    for (let n = 1; n < partialsVal + 1; n++) {
                        if (n % 2 !== 0) {
                            const sign = ((n - 1) / 2) % 2 === 0 ? 1 : -1;
                            const partial = (8 / Math.pow(Math.PI, 2)) * (sign / Math.pow(n, 2));
                            const timbCalc = (Math.random() * (macros['variance'] / 10) * timbFactor);
                            const out = partial + (timbCalc * sign);
                            imag[n] = out;
                        }
                        else {
                            imag[n] = 0;
                        }
                        real[n] = 0;
                    }
                }
                else if (type === 'saw') {
                    for (let n = 1; n < partialsVal + 1; n++) {
                        const partial = 1 / (n * Math.PI);
                        const timbCalc = Math.random() * (macros['variance'] / 10) * timbFactor;
                        const out = partial - timbCalc;
                        imag[n] = out;
                    }
                }
                else if (type === 'square') {
                    for (let n = 1; n < partialsVal; n++) {
                        if (n % 2 !== 0) {
                            const partial = 4 / (n * Math.PI);
                            const timbCalc = Math.random() * (macros['variance'] / 10) * timbFactor;
                            const out = partial - timbCalc;
                            imag[n] = out;
                        }
                        else {
                            imag[n] = 0;
                        }
                    }
                }
                else if (type === 'inf-conv-geo-series-0.5') {
                    let a = 0;
                    let b = 1;
                    for (let i = 1; i < partialsVal; i++) {
                        const timbCalc = Math.random() * (macros['variance'] / 10) * timbFactor;
                        const out = b - timbCalc;
                        real[i] = a;
                        imag[i] = out;
                        b *= .5;
                    }
                }
                else if (type === 'inf-conv-geo-series-0.25') {
                    let a = 0;
                    let b = 1;
                    for (let i = 1; i < partialsVal; i++) {
                        const timbCalc = Math.random() * (macros['variance'] / 10) * timbFactor;
                        const out = b - timbCalc;
                        real[i] = a;
                        imag[i] = out;
                        b *= .25;
                    }
                }
                else if (type === 'inf-conv-geo-series-0.125') {
                    let a = 0;
                    let b = 1;
                    for (let i = 1; i < partialsVal; i++) {
                        const timbCalc = Math.random() * (macros['variance'] / 10) * timbFactor;
                        const out = b - timbCalc;
                        real[i] = a;
                        imag[i] = out;
                        b *= .125;
                    }
                }
                else if (type === 'inf-conv-geo-series-0.0625') {
                    let a = 0;
                    let b = 1;
                    for (let i = 1; i < partialsVal; i++) {
                        const timbCalc = Math.random() * (macros['variance'] / 10) * timbFactor;
                        const out = b - timbCalc;
                        real[i] = a;
                        imag[i] = out;
                        b *= .0625;
                    }
                }
                else {
                    imag[1] = 1;
                }
                real[0] = 0;
                imag[0] = 0;
                waveform = normEngine(partialsVal, real, imag);
                oscillators[oscID]['waveform'] = waveform;
                oscillators[oscID]['oscVoices'] = voiceVal + 1;
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
    if (sequencersInitialized && seq1 && seq2 && seq3) {
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
                sequencers[seqID]['stages'] = Math.max(2, Math.min(36, stages));
                sequencers[seqID]['levels'] = Math.max(2, Math.min(25, levels));
                sequencers[seqID]['seqRate'] = seqRate;
                sequencers[seqID]['filtType'] = filtType;
                sequencers[seqID]['cutoff'] = Math.max(100, Math.min(20000, cutoff));
                sequencers[seqID]['resonance'] = Math.max(0.1, Math.min(10, resonance));
                sequencers[seqID]['ampMod'] = Math.max(0, Math.min(10, ampMod));
                sequencers[seqID]['filtMod'] = Math.max(-10, Math.min(10, filtMod));
                sequencers[seqID]['freqMod'] = Math.max(-24, Math.min(24, freqMod));
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
function updateFX() {
    if (FXInitialized && DryWetFX && EQBandControl1 && EQBandControl2 && EQBandControl3 && EQCutoffControl1 && EQCutoffControl2 && EQQControl) {
        let dryWetVal = Number(DryWetFX.value);
        const DWrange = 50;
        if (dryWetVal > DWrange) {
            dryWetVal = DWrange;
        }
        else if (dryWetVal < -DWrange) {
            dryWetVal = -DWrange;
        }
        else if (dryWetVal % 1 !== 0) {
            dryWetVal = Math.ceil(dryWetVal);
        }
        if (dryWetVal === 0) {
            dryWetVal = 1;
        }
        else if (dryWetVal > 0) {
            dryWetVal = 1 + dryWetVal / DWrange;
        }
        else if (dryWetVal < 0) {
            dryWetVal = 1 + dryWetVal / DWrange;
        }
        FXdata['DryWet'] = dryWetVal;
        let bandVal1 = Number(EQBandControl1.value);
        if (bandVal1 > 100) {
            bandVal1 = 100;
        }
        else if (bandVal1 < 0) {
            bandVal1 = 0;
        }
        else if (bandVal1 % 1 !== 0) {
            bandVal1 = Math.ceil(bandVal1);
        }
        FXdata['EQ']['b1'] = bandVal1 / 100;
        let bandVal2 = Number(EQBandControl2.value);
        if (bandVal2 > 100) {
            bandVal2 = 100;
        }
        else if (bandVal2 < 0) {
            bandVal2 = 0;
        }
        else if (bandVal2 % 1 !== 0) {
            bandVal2 = Math.ceil(bandVal2);
        }
        FXdata['EQ']['b2'] = bandVal2 / 100;
        let bandVal3 = Number(EQBandControl3.value);
        if (bandVal3 > 100) {
            bandVal3 = 100;
        }
        else if (bandVal3 < 0) {
            bandVal3 = 0;
        }
        else if (bandVal3 % 1 !== 0) {
            bandVal3 = Math.ceil(bandVal3);
        }
        FXdata['EQ']['b3'] = bandVal3 / 100;
        let cutoffVal1 = Number(EQCutoffControl1.value);
        if (cutoffVal1 > 20000) {
            cutoffVal1 = 20000;
        }
        else if (cutoffVal1 < 100) {
            cutoffVal1 = 100;
        }
        else if (cutoffVal1 % 1 !== 0) {
            cutoffVal1 = Math.ceil(cutoffVal1);
        }
        FXdata['EQ']['c1'] = cutoffVal1;
        let cutoffVal2 = Number(EQCutoffControl2.value);
        if (cutoffVal2 > 20000) {
            cutoffVal2 = 20000;
        }
        else if (cutoffVal2 < 100) {
            cutoffVal2 = 100;
        }
        else if (cutoffVal2 % 1 !== 0) {
            cutoffVal2 = Math.ceil(cutoffVal2);
        }
        FXdata['EQ']['c2'] = cutoffVal2;
        let QControlVal = Number(EQQControl.value);
        if (QControlVal > 100) {
            QControlVal = 100;
        }
        else if (QControlVal < 1) {
            QControlVal = 1;
        }
        else if (QControlVal % 1 !== 0) {
            QControlVal = Math.ceil(QControlVal);
        }
        FXdata['EQ']['Q'] = QControlVal / 100;
        return true;
    }
    else {
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
        ampMod = ampMod / 10;
        filtMod = Math.abs(cutoff - 100) * (filtMod / 10);
        let oscs = [];
        for (let voice = voices.length - oscVoic; voice < voices.length; voice++) {
            const v = voices[voice];
            if (v) {
                oscs.push(v);
            }
            ;
        }
        const gainNode = audioContext.createGain();
        sequencesGain.push(gainNode);
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
                const ratio = freq === 0 ? 1 : 2 ** (freq / 12);
                freqLvls[i] = ratio > 3 ? 3 : ratio < .25 ? .25 : ratio;
            }
        }
        const root = oscFreq;
        const minFreqDelta = 0.000061;
        const expMac = macros['expressivity'];
        const envelope = Math.abs(expMac) ** .5;
        const Amac = macros['Attack'];
        const Rmac = macros['Release'];
        const Smac = macros['Sustain'];
        const whole = Amac + Rmac + Smac;
        const interTransient = .00005;
        const stageSeconds = stageDuration / 1000;
        const A = Amac / whole * (stageSeconds - 3 * interTransient);
        const R = Rmac / whole * (stageSeconds - 3 * interTransient);
        const S = Smac / whole * (stageSeconds - 3 * interTransient);
        const Astart = interTransient / 2;
        const Rstart = Astart + A + interTransient;
        const Sstart = Rstart + R + interTransient;
        const sectionCondition = A >= .0005 && R >= .0005 && S >= .0005;
        const durationCondition = stageSeconds === interTransient * 3 + A + R + S;
        const envelopeEnabled = sectionCondition && durationCondition;
        if (ampMod !== 0) {
            const amp = ampLvls[0];
            if (amp !== undefined) {
                if (envelopeEnabled && expMac > 0) {
                    const initGain = 1 - envelope;
                    const gainChange = initGain - amp;
                    const current = audioContext.currentTime;
                    gainNode.gain.setTargetAtTime(Math.max(0, Math.min(1, initGain + gainChange)), current + Astart, A / 4);
                    gainNode.gain.setTargetAtTime(Math.max(0, Math.min(1, initGain - gainChange)), current + Rstart, R / 4);
                    gainNode.gain.setTargetAtTime(Math.max(0, Math.min(1, initGain)), current + Sstart, S / 4);
                }
                else if (envelopeEnabled && expMac < 0) {
                    const initGain = 1 - envelope;
                    const gainChange = amp - initGain;
                    const current = audioContext.currentTime;
                    gainNode.gain.setTargetAtTime(Math.max(0, Math.min(1, initGain + gainChange)), current + Astart, A / 4);
                    gainNode.gain.setTargetAtTime(Math.max(0, Math.min(1, initGain - gainChange)), current + Rstart, R / 4);
                    gainNode.gain.setTargetAtTime(Math.max(0, Math.min(1, initGain)), current + Sstart, S / 4);
                }
                else {
                    gainNode.gain.value = amp;
                }
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
                    if (Math.abs(root * ratio - root) < minFreqDelta) {
                        if (ratio > 1) {
                            osc.frequency.value = root + minFreqDelta;
                        }
                        else {
                            osc.frequency.value = root - minFreqDelta;
                        }
                    }
                    else {
                        osc.frequency.value = root * ratio;
                    }
                });
            }
        }
        let stage = 1;
        sequences[seqID] = setInterval(() => {
            if (ampMod !== 0) {
                const amp = ampLvls[stage];
                if (amp !== undefined) {
                    if (envelopeEnabled && expMac > 0) {
                        const initGain = 1 - envelope;
                        const gainChange = initGain - amp;
                        const current = audioContext.currentTime;
                        gainNode.gain.setTargetAtTime(Math.max(0, Math.min(1, initGain + gainChange)), current + Astart, A / 4);
                        gainNode.gain.setTargetAtTime(Math.max(0, Math.min(1, initGain - gainChange)), current + Rstart, R / 4);
                        gainNode.gain.setTargetAtTime(Math.max(0, Math.min(1, initGain)), current + Sstart, S / 4);
                    }
                    else if (envelopeEnabled && expMac < 0) {
                        const initGain = 1 - envelope;
                        const gainChange = amp - initGain;
                        const current = audioContext.currentTime;
                        gainNode.gain.setTargetAtTime(Math.max(0, Math.min(1, initGain + gainChange)), current + Astart, A / 4);
                        gainNode.gain.setTargetAtTime(Math.max(0, Math.min(1, initGain - gainChange)), current + Rstart, R / 4);
                        gainNode.gain.setTargetAtTime(Math.max(0, Math.min(1, initGain)), current + Sstart, S / 4);
                    }
                    else {
                        gainNode.gain.value = amp;
                    }
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
                        if (Math.abs(root * ratio - root) < minFreqDelta) {
                            if (ratio > 1) {
                                osc.frequency.value = root + minFreqDelta;
                            }
                            else {
                                osc.frequency.value = root - minFreqDelta;
                            }
                        }
                        else {
                            osc.frequency.value = root * ratio;
                        }
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
function setupDDL(input) {
    return input;
}
;
function setupEQ(input, b1, b2, b3, cutoff1, cutoff2, Q) {
    if (cutoff1 >= cutoff2 || Math.abs(cutoff1 - cutoff2) < 100) {
        return input;
    }
    ;
    const splitter = audioContext.createGain();
    splitter.gain.value = 1 / 3;
    input.connect(splitter);
    const biquad1 = new BiquadFilterNode(audioContext, {
        type: "lowpass",
        frequency: Math.max(100, Math.min(20000, cutoff1)),
        Q: Math.max(.1, Math.min(5, Q / 2)),
    });
    const band1 = audioContext.createGain();
    band1.gain.value = Math.max(0, Math.min(1, b1));
    splitter.connect(biquad1);
    biquad1.connect(band1);
    const biquadA = new BiquadFilterNode(audioContext, {
        type: "highpass",
        frequency: Math.max(100, Math.min(20000, cutoff1)),
        Q: Math.max(.1, Math.min(5, Q / 2)),
    });
    const biquadB = new BiquadFilterNode(audioContext, {
        type: "lowpass",
        frequency: Math.max(100, Math.min(20000, cutoff2)),
        Q: Math.max(.1, Math.min(5, Q / 2)),
    });
    const band2 = audioContext.createGain();
    band2.gain.value = Math.max(0, Math.min(1, b2));
    splitter.connect(biquadA);
    biquadA.connect(biquadB);
    biquadB.connect(band2);
    const biquad2 = new BiquadFilterNode(audioContext, {
        type: "highpass",
        frequency: Math.max(100, Math.min(20000, cutoff1)),
        Q: Math.max(.1, Math.min(5, Q / 2)),
    });
    const band3 = audioContext.createGain();
    band3.gain.value = Math.max(0, Math.min(1, b3));
    splitter.connect(biquad2);
    biquad2.connect(band3);
    const summer = audioContext.createGain();
    band1.connect(summer);
    band2.connect(summer);
    band3.connect(summer);
    return summer;
}
;
function breakdown() {
    voices.forEach((osc) => { osc.stop(audioContext.currentTime); });
    sequencesGain.forEach((gainNode) => { gainNode.gain.cancelScheduledValues(audioContext.currentTime); });
    const sequenceKeys = Object.keys(sequences);
    for (const seqID of sequenceKeys) {
        clearInterval(sequences[seqID]);
    }
    ;
    for (const node of audioWorkletNodes) {
        node.disconnect();
        node.port.postMessage({ 'action': 'deactivate' });
    }
    voices = [];
    sequences = {};
    sequencesGain = [];
    analysis = {};
    audioWorkletNodes = [];
}
;
function buildup(update = 'all') {
    let gotit = ['all', 'osc', 'seq', 'FX'].includes(update);
    !gotit && console.log('passed bad argument to update parameter in buildup function');
    update = 'all';
    if (gotit) {
        breakdown();
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
        if (update === 'all' || update === 'seq') {
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
    if (gotit) {
        if (update === 'all' || update === 'FX') {
            if (!updateFX()) {
                gotit = false;
            }
        }
    }
    if (gotit && playback) {
        console.log(FXdata);
        const dry = audioContext.createGain();
        const wet = audioContext.createGain();
        const endFX = audioContext.createGain();
        const oscKeys = Object.keys(oscillators);
        const seqKeys = Object.keys(sequencers);
        let seqKeyIndex = 0;
        let mutedOscillatorCount = 0;
        for (const key of oscKeys) {
            const oscil = oscillators[key];
            const oscVoic = oscil['oscVoices'];
            const oscFreq = oscil['freq'];
            const oscDetu = oscil['detune'];
            const oscVol = oscil['gain'];
            const oscDrive = oscil['drive'];
            const oscDriCh = oscil['driveCharacter'];
            const waveform = oscil['waveform'];
            if (oscVol === 0) {
                mutedOscillatorCount += 1;
            }
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
            const transient = audioContext.createDynamicsCompressor();
            transient.threshold.value = -100;
            transient.knee.value = 0;
            transient.ratio.value = 1;
            transient.attack.value = 0.250;
            transient.release.value = 0.250;
            gainNode.connect(transient);
            const preAnalyzer = audioContext.createAnalyser();
            analysis[key] = [];
            analysis[key].push(preAnalyzer);
            transient.connect(preAnalyzer);
            const makeupGainNode = audioContext.createGain();
            if (oscDrive > 0) {
                const waveshaper = audioContext.createWaveShaper();
                const oversample = '4x';
                const drive = oscDrive * macros['driveMult'];
                let waveshaperCurve;
                if (oscDriCh === 'Logistic') {
                    waveshaperCurve = logistic(drive);
                }
                else if (oscDriCh === 'Serpentine') {
                    waveshaperCurve = serpentine(drive);
                }
                else if (oscDriCh === 'Gompertz') {
                    waveshaperCurve = gompertz(drive);
                }
                else {
                    waveshaperCurve = logistic(drive);
                }
                waveshaper.curve = waveshaperCurve;
                waveshaper.oversample = oversample;
                const initialPower = 1 / 3;
                const finalPower = meanSquare(waveshaperCurve);
                const powerFactor = 1 / (1 + ((finalPower - initialPower) / initialPower));
                makeupGainNode.gain.value = powerFactor;
                transient.connect(waveshaper);
                waveshaper.connect(makeupGainNode);
            }
            else {
                transient.connect(makeupGainNode);
                makeupGainNode.gain.value = 1;
            }
            const postAnalyzer = audioContext.createAnalyser();
            analysis[key].push(postAnalyzer);
            makeupGainNode.connect(postAnalyzer);
            const seqOut = audioContext.createGain();
            const seqID = seqKeys[seqKeyIndex];
            if (seqID) {
                const seqNode = setupSequencer(seqID, oscFreq, oscVoic, makeupGainNode);
                if (typeof seqNode !== "boolean") {
                    seqNode.connect(seqOut);
                }
                else {
                    console.log('sequencer setup failed');
                    makeupGainNode.connect(seqOut);
                }
            }
            else {
                console.log('sequencer not found during setup');
                makeupGainNode.connect(seqOut);
            }
            seqKeyIndex += 1;
            seqOut.connect(dry);
            seqOut.connect(wet);
            const seqAnalyzer = audioContext.createAnalyser();
            analysis[key].push(seqAnalyzer);
            seqOut.connect(seqAnalyzer);
        }
        const DWC = FXdata['DryWet'];
        const dryVal = DWC > 1 ? .5 - ((DWC - 1) / 2) : DWC < 1 ? .5 + (.5 - (DWC / 2)) : 0.5;
        const wetVal = DWC > 1 ? .5 + ((DWC - 1) / 2) : DWC < 1 ? .5 - (.5 - (DWC / 2)) : 0.5;
        dry.gain.value = oscKeys.length - mutedOscillatorCount === 0 ? 0 : dryVal / (oscKeys.length - mutedOscillatorCount);
        wet.gain.value = oscKeys.length - mutedOscillatorCount === 0 ? 0 : wetVal / (oscKeys.length - mutedOscillatorCount);
        endFX.gain.value = 1;
        const mix = audioContext.createGain();
        const mixFactor = .5;
        mix.gain.value = mixFactor;
        const preAnalysis = audioContext.createAnalyser();
        analysis['FX'] = [];
        analysis['FX'].push(preAnalysis);
        const postAnalysis = audioContext.createAnalyser();
        analysis['FX'].push(postAnalysis);
        const dryAnalysis = audioContext.createAnalyser();
        analysis['FX'].push(dryAnalysis);
        wet.connect(preAnalysis);
        endFX.connect(mix);
        endFX.connect(postAnalysis);
        dry.connect(mix);
        dry.connect(dryAnalysis);
        const DDL = setupDDL(wet);
        const b1 = FXdata['EQ']['b1'];
        const b2 = FXdata['EQ']['b2'];
        const b3 = FXdata['EQ']['b3'];
        const c1 = FXdata['EQ']['c1'];
        const c2 = FXdata['EQ']['c2'];
        const Q = FXdata['EQ']['Q'];
        const EQ = setupEQ(DDL, b1, b2, b3, c1, c2, Q);
        EQ.connect(endFX);
        const compressor = audioContext.createDynamicsCompressor();
        compressor.threshold.value = -12;
        compressor.knee.value = 9;
        compressor.ratio.value = 3;
        compressor.attack.value = 0.05;
        compressor.release.value = 0.25;
        mix.connect(compressor);
        const limiter = audioContext.createDynamicsCompressor();
        limiter.threshold.value = -6;
        limiter.knee.value = 3;
        limiter.ratio.value = 2;
        limiter.attack.value = 0.05;
        limiter.release.value = 0.25;
        compressor.connect(limiter);
        const brickwall = audioContext.createDynamicsCompressor();
        brickwall.threshold.value = -2.8;
        brickwall.knee.value = 0;
        brickwall.ratio.value = 3.4;
        brickwall.attack.value = 0.003;
        brickwall.release.value = 0.25;
        limiter.connect(brickwall);
        const masterGainNode = audioContext.createGain();
        masterGainNode.gain.value = Number(masterGain.value) / 100;
        brickwall.connect(masterGainNode);
        const clampOut = clamp(masterGainNode);
        clampOut.connect(audioContext.destination);
        const masterAnalysis = audioContext.createAnalyser();
        analysis['master'] = [];
        analysis['master'].push(masterAnalysis);
        masterGainNode.connect(masterAnalysis);
    }
    if (gotit && playback) {
        if (analysisInitialized) {
            const keys = Object.keys(analysis);
            for (let key of keys) {
                const nodeList = analysis[key];
                if (nodeList) {
                    if (key === 'master') {
                        const out = nodeList[0];
                        if (out) {
                            peakLevel(out, meterMaster, 'true-peak-container');
                            RMSLevel(out, meterMaster, 'RMS-container');
                            LUFSLevel(out, meterMaster, 'LUFS-container');
                        }
                    }
                    else if (key === 'FX') {
                        const pre = nodeList[0];
                        if (pre) {
                            RMSLevel(pre, meterFX, 'pre-peak-container');
                        }
                        const post = nodeList[1];
                        if (post) {
                            RMSLevel(post, meterFX, 'post-peak-container');
                        }
                        const dry = nodeList[2];
                        if (dry) {
                            RMSLevel(dry, meterFX, 'dry-peak-container');
                        }
                    }
                    else {
                        const meterID = oscillators[key]['meterID'];
                        const root = document.getElementById(meterID);
                        if (root) {
                            const pre = nodeList[0];
                            if (pre) {
                                peakLevel(pre, root, 'pre-peak-container');
                            }
                            const post = nodeList[1];
                            if (post) {
                                peakLevel(post, root, 'post-peak-container');
                            }
                            const seq = nodeList[2];
                            if (seq) {
                                peakLevel(seq, root, 'seq-peak-container');
                            }
                        }
                        else {
                            console.log('oscillator meter setup failed due to missing oscillator element');
                        }
                    }
                }
            }
        }
        for (const voice of voices) {
            voice.start();
        }
    }
}
;
function sequencerEvent(event) {
    const target = event.target;
    if (event.type === 'click') {
        const parent = target.parentElement;
        if (parent) {
            const seqID = parent.parentElement?.parentElement?.parentElement?.parentElement?.parentElement?.parentElement?.id;
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
                                buildup('seq');
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
                                buildup('seq');
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
                                buildup('seq');
                            }
                        }
                    }
                }
            }
        }
    }
    else if (event.type === 'change') {
        if (target.classList.contains('stages')) {
            const seqID = target?.parentElement?.parentElement?.parentElement?.parentElement?.parentElement?.parentElement?.id;
            if (seqID) {
                const wireEl = target?.parentElement?.parentElement?.parentElement?.parentElement;
                if (wireEl === null || wireEl === undefined) {
                    console.log('failed to select leveler element during rerender');
                }
                else {
                    const containers = wireEl.querySelectorAll('.leveler-layout');
                    const targetInput = target;
                    const stages = Number(targetInput.value);
                    const levels = sequencers[seqID]['levels'];
                    for (const container of containers) {
                        renderLeveler(stages, levels, container);
                    }
                    buildup();
                }
            }
            else {
                console.log('seqID not found during leveler rerender');
            }
        }
        else if (target.classList.contains('stage-levels')) {
            const seqID = target?.parentElement?.parentElement?.parentElement?.parentElement?.parentElement?.parentElement?.id;
            if (seqID) {
                const wireEl = target?.parentElement?.parentElement?.parentElement?.parentElement;
                if (wireEl === null || wireEl === undefined) {
                    console.log('failed to select leveler element during rerender');
                }
                else {
                    const containers = wireEl.querySelectorAll('.leveler-layout');
                    const targetInput = target;
                    const stages = sequencers[seqID]['stages'];
                    const levels = Number(targetInput.value);
                    for (const container of containers) {
                        renderLeveler(stages, levels, container);
                    }
                    buildup();
                }
            }
            else {
                console.log('seqID not found during leveler rerender');
            }
        }
        else {
            buildup('seq');
        }
    }
}
;
function oscillatorEvent(event) {
    const target = event.target;
    if (event.type === 'input' && target.classList.contains('type')) {
        buildup('osc');
    }
    else if (target.classList.contains('amplitude') || target.classList.contains('drive') || target.classList.contains('drive-character') || target.classList.contains('frequency') || target.classList.contains('voices') || target.classList.contains('detune') || target.classList.contains('partials')) {
        buildup('osc');
    }
    else if (event.type === 'input' && target.classList.contains('knob-input')) {
        buildup('osc');
    }
}
;
let cache = setTimeout(() => { }, 0);
async function setup() {
    if (playBtn && stopBtn && breakerBtn && masterGain && masterPan && masterTempo && masterMeasure && FPControl && DMControl && CControl && VControl && EControl && SControl && LControl && TControl && seq1 && seq2 && seq3 && osc1 && osc2 && osc3 && DryWetFX && meterMaster && meterFX && meter1 && meter2 && meter3) {
        await getProcessorModules();
        initMacros();
        initOscillators();
        initSequencers();
        initFX();
        initAnalysis();
        if (!macrosInitialized || !oscillatorsInitialized || !sequencersInitialized || !FXInitialized || !analysisInitialized) {
            return;
        }
        ;
        const latency = 150;
        let listening = true;
        playBtn.addEventListener('click', () => {
            if (listening) {
                clearTimeout(cache);
                cache = setTimeout(() => {
                    clearTimeout(cache);
                    listening = false;
                    playback = true;
                    buildup();
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
                    breakdown();
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
                    buildup();
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
                    buildup();
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
                    buildup();
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
                    buildup();
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
                    buildup();
                    listening = true;
                }, latency);
            }
        });
        DMControl.addEventListener('input', () => {
            if (listening && playback) {
                clearTimeout(cache);
                cache = setTimeout(() => {
                    clearTimeout(cache);
                    listening = false;
                    buildup();
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
                    buildup();
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
                    buildup();
                    listening = true;
                }, latency);
            }
        });
        EControl.addEventListener('input', () => {
            if (listening && playback) {
                clearTimeout(cache);
                cache = setTimeout(() => {
                    clearTimeout(cache);
                    listening = false;
                    buildup();
                    listening = true;
                }, latency);
            }
        });
        SControl.addEventListener('input', () => {
            if (listening && playback) {
                clearTimeout(cache);
                cache = setTimeout(() => {
                    clearTimeout(cache);
                    listening = false;
                    buildup();
                    listening = true;
                }, latency);
            }
        });
        TControl.addEventListener('input', () => {
            if (listening && playback) {
                clearTimeout(cache);
                cache = setTimeout(() => {
                    clearTimeout(cache);
                    listening = false;
                    buildup();
                    listening = true;
                }, latency);
            }
        });
        LControl.addEventListener('input', () => {
            if (listening && playback) {
                clearTimeout(cache);
                cache = setTimeout(() => {
                    clearTimeout(cache);
                    listening = false;
                    buildup();
                    listening = true;
                }, latency);
            }
        });
        DryWetFX.addEventListener('input', () => {
            if (playback) {
                clearTimeout(cache);
                cache = setTimeout(() => {
                    clearTimeout(cache);
                    listening = false;
                    buildup('FX');
                    listening = true;
                }, latency);
            }
        });
        const oscsNodeList = document.querySelectorAll('.oscs');
        if (oscsNodeList.length > 0) {
            for (const oscEl of oscsNodeList) {
                if (oscEl) {
                    ['input'].forEach((eventType) => {
                        oscEl.addEventListener(eventType, (event) => {
                            clearTimeout(cache);
                            cache = setTimeout(() => {
                                clearTimeout(cache);
                                listening = false;
                                oscillatorEvent(event);
                                listening = true;
                            }, latency);
                        });
                    });
                }
            }
        }
        else {
            console.log('oscillator elements not found during listener setup');
        }
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
    }
    else {
        console.log('Element Integrity Degraded during listener setup');
    }
}
;
setup();
const knobs = document.querySelectorAll('.knob-container');
const minDeg = -135;
const maxDeg = 135;
const degRange = Math.abs(maxDeg - minDeg);
const knobSensitivity = 1;
function renderKnob(degree, ID) {
    const input = document.getElementById(ID);
    if (input === null)
        return;
    const knob = input.parentElement?.querySelector('.knob-dial');
    if (knob === null || knob === undefined)
        return;
    knob.style.setProperty('--knob-rotation', `${degree}deg`);
}
;
knobs.forEach((container) => {
    const input = container.querySelector('input');
    const ID = input.id;
    const maxVal = parseInt(input.max);
    const minVal = parseInt(input.min);
    const unitVal = 1;
    const positions = Math.abs(maxVal - minVal) * unitVal;
    let initVal = parseInt(input.value);
    let percPos = 0;
    for (let i = minVal; i < maxVal + 1; i = i + unitVal) {
        if (initVal === i) {
            percPos = Math.abs(i / positions);
            break;
        }
    }
    let initDeg;
    if (minVal >= 0) {
        initDeg = Math.max(minDeg, Math.min(maxDeg, percPos * degRange + minDeg));
    }
    else {
        initDeg = Math.max(minDeg, Math.min(maxDeg, percPos * degRange));
    }
    renderKnob(initDeg, input.id);
    const knob = container.querySelector('.knob-dial');
    if (knob) {
        let isDragging = false;
        let startY = 0;
        let startVal = 0;
        let Ts;
        let Ti;
        knob.addEventListener('dblclick', (event) => {
            const target = event.target;
            if (target.classList.contains('on-dbl-100')) {
                input.value = '100';
            }
            else if (target.classList.contains('on-dbl')) {
                input.value = '1';
            }
            else {
                input.value = '0';
            }
            if (minVal >= 0) {
                renderKnob(minDeg, input.id);
            }
            else {
                renderKnob(0, input.id);
            }
        });
        knob.addEventListener('mousedown', (e) => {
            isDragging = true;
            startY = e.clientY;
            startVal = parseInt(input.value);
            Ts = Ti = performance.now();
            document.body.style.userSelect = 'none';
        });
        container.addEventListener('mousemove', (e) => {
            if (!isDragging)
                return;
            const endY = e.clientY;
            const dY = startY - endY;
            const Tf = performance.now();
            const T = Math.max(.5, Math.min(2, (Tf - Ti) / 1000));
            Ti = Tf;
            const ppp = 20;
            const dPos = Math.floor(dY / ppp / T * knobSensitivity);
            initVal = parseInt(input.value);
            const numPos = Math.max(minVal, Math.min(maxVal, initVal + dPos));
            percPos = 0;
            for (let i = minVal; i < maxVal + 1; i = i + unitVal) {
                if (numPos === i) {
                    percPos = i / positions;
                    break;
                }
            }
            let Degree;
            if (minVal >= 0) {
                Degree = Math.max(minDeg, Math.min(maxDeg, percPos * degRange + minDeg));
            }
            else {
                Degree = Math.max(minDeg, Math.min(maxDeg, percPos * degRange));
            }
            input.value = numPos.toString();
            renderKnob(Degree, ID);
        });
        ['mouseup', 'mouseleave'].forEach((eventType) => {
            container.addEventListener(eventType, () => {
                if (isDragging) {
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
                ;
                isDragging = false;
                document.body.style.userSelect = 'auto';
            });
        });
        input.addEventListener('input', (e) => {
            const event = e.target;
            const numPos = Math.max(minVal, Math.min(maxVal, parseInt(event.value)));
            percPos = 0;
            for (let i = minVal; i < maxVal + 1; i = i + unitVal) {
                if (numPos === i) {
                    percPos = i / positions;
                    break;
                }
            }
            let Degree;
            if (minVal >= 0) {
                Degree = Math.max(minDeg, Math.min(maxDeg, percPos * degRange + minDeg));
            }
            else {
                Degree = Math.max(minDeg, Math.min(maxDeg, percPos * degRange));
            }
            input.value = numPos.toString();
            renderKnob(Degree, ID);
        });
    }
    else {
        console.log('knob listeners disconnected');
    }
});
//# sourceMappingURL=renderer.js.map