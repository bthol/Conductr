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
                    console.log(peak);
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
            const oscType = osc.querySelector('.type');
            const ID = crypto.randomUUID().split('-')[0];
            if (oscGain && oscFreq && oscType && typeof ID === 'string') {
                const type = oscType.value;
                const hz = Number(oscFreq.value);
                const gain = Number(oscGain.value);
                const v = (variance * (hz / 20000));
                const gainFactor = .25;
                const gainV = Math.random() * v * gainFactor;
                const gainCalc = (((-(Math.log10((-((gain * maxIn) + (gainV)) / 100) + 1)) / 2))) * maxOut;
                const freqFactor = .5;
                const freqV = Math.random() * v * freqFactor;
                const freqCalc = hz - freqV;
                if (gainCalc < 1 && gainCalc >= 0) {
                    const osc = { 'type': type, 'hz': freqCalc, 'gain': gainCalc };
                    oscillators[ID] = osc;
                    gotit = true;
                }
                else {
                    const osc = { 'type': type, 'hz': freqCalc, 'gain': 0.99 * maxOut };
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
            const oscType = oscil['type'];
            const oscFreq = oscil['hz'];
            const oscGain = audioContext.createGain();
            const oscVol = oscil['gain'];
            osc.type = oscType;
            osc.frequency.setValueAtTime(oscFreq, audioContext.currentTime);
            oscGain.gain.value = oscVol;
            osc.connect(oscGain);
            const preAnalyzer = audioContext.createAnalyser();
            analysis[key] = [];
            analysis[key].push(preAnalyzer);
            oscGain.connect(preAnalyzer);
            const clampNode = clamp(oscGain);
            clampNode.connect(audioContext.destination);
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