"use strict";
// rerender file
// handles element navigation events
console.log("linked script");
;
// main process response handler
window.electronAPI.res((data) => {
    console.log(data);
});
// DOM selections
const btn1 = document.getElementById('btn1');
const btn2 = document.getElementById('btn2');
// DOM manipulation
if (btn1) {
    btn1.addEventListener('click', () => {
        const channel = 'btn1-channel';
        const message = 'ipc renderer to main';
        console.log(message);
        window.electronAPI.msg(channel, message);
        btn1.innerText = `clicked`;
        btn1.style.color = '#ff0000'; // set text to red
    });
}
if (btn2) {
    btn2.addEventListener('click', () => {
        console.log('clicked btn2');
        window.location.reload();
    });
}
//# sourceMappingURL=renderer.js.map