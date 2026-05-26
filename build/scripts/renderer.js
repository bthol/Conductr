"use strict";
// rerender file
// handles element navigation events
console.log("linked script");
;
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
// AudioNode, AudioParam, AnalyserNode, 
// setup audio context
const options = { 'sampleRate': 44100.0, 'latencyHint': 'interactive' };
const audioContext = new AudioContext(options);
// declare global structures
let oscillators = {}; // stores parameters for each oscilator from user parameters
let voices = []; // stores voices generated with parameter values
let playback = false;
// parameter for master volume control
let maxIn = 1; // 0 - 1
let maxOut = 0.99; // 0 - 0.99
// parameter elements
const breakerBtn = document.getElementById('breaker');
const playBtn = document.getElementById('play-btn');
const stopBtn = document.getElementById('stop-btn');
const masterGainIn = document.getElementById('master-gain-in');
const masterGainOut = document.getElementById('master-gain-out');
const osc1 = document.getElementById('osc1');
const osc2 = document.getElementById('osc2');
const osc3 = document.getElementById('osc3');
function shutup() {
    oscillators = {}; // clear oscilator data
    voices.forEach((osc) => { osc.stop(audioContext.currentTime); }); // mute each voice
    voices = []; // clear voices data
}
;
function sound() {
    // generates voices from oscillators
    // clear your throat
    if (playback) {
        shutup();
    }
    // handle macros
    if (masterGainIn && masterGainOut) {
        // get user values
        let inVal = Number(masterGainIn.value);
        let outVal = Number(masterGainOut.value);
        // enforce macro ranges
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
        // apply values to macros
        maxIn = inVal / 100;
        maxOut = outVal / 100;
    }
    // get user data + add data to oscillators structure
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
                // 0 - 99 => 0/100 - 99/100 => 0 - +inf or lim1 => 0 - 1
                // maxIn distributes levels below its percentage value within 0 - 99 range
                // maxOut distributes levels below its value within 0 - 1 range
                const gainCalc = (-Math.log10(-(gain * maxIn) / 100 + 1)) / 2 * maxOut; // logarithmic distribution of gain
                if (gainCalc < 1 && gainCalc >= 0) {
                    const osc = { 'type': type, 'hz': hz, 'gain': gainCalc };
                    oscillators[ID] = osc;
                    gotit = true;
                }
                else {
                    const osc = { 'type': type, 'hz': hz, 'gain': 0.99 * maxOut };
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
    // iterate over oscillators structure
    if (gotit) {
        Object.keys(oscillators).forEach((key) => {
            // declare oscillator variables
            const oscil = oscillators[key]; // each oscillator
            const osc = audioContext.createOscillator(); // each voice from oscillator
            const oscType = oscil['type'];
            const oscFreq = oscil['hz'];
            const oscGain = audioContext.createGain();
            const oscVol = oscil['gain'];
            // configure oscillator with variables
            osc.type = oscType;
            osc.frequency.setValueAtTime(oscFreq, audioContext.currentTime);
            // route oscillator node to gain node
            oscGain.gain.value = oscVol;
            osc.connect(oscGain);
            // connect to destination (playback system for audio output)
            oscGain.connect(audioContext.destination);
            // store in structure for global reference
            voices.push(osc);
            // play oscilator
            osc.start(audioContext.currentTime);
        });
    }
}
;
// if all elements are working
let cache = setTimeout(() => { }, 0);
if (playBtn && stopBtn && breakerBtn && masterGainIn && masterGainOut && osc1 && osc2 && osc3) {
    // setup user controls
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
    breakerBtn.addEventListener('click', () => { window.location.reload(); });
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
//# sourceMappingURL=renderer.js.map