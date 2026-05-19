// rerender file
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
// DOM selections
const btn1: HTMLElement | null = document.getElementById('btn1');
const btn2: HTMLElement | null = document.getElementById('btn2');
// DOM manipulation
if (btn1) {
    btn1.addEventListener('click', () => {
        const channel: string = 'btn1-channel';
        const message: string = 'ipc renderer to main';
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
    })
}