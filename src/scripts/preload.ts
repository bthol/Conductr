// Source - https://stackoverflow.com/a/78305575
// Posted by Praise Dare
// Retrieved 2026-05-19, License - CC BY-SA 4.0

const {ipcRenderer} = require('electron/renderer');
const {contextBridge} = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // .send() renderer to main, .on() main to renderer
  // .invoke() sends and awaits a promise of response
  msg: (channel: string, message: string) => ipcRenderer.send(channel, message),
  res: (callback: (data: any) => void) => {
    ipcRenderer.on('main-channel', (_event: any, value: any) => callback(value));
    ipcRenderer.on('save-channel', (_event: any, value: any) => callback(value));
  },
  open: (callback: (data: any, dir: string) => void) => {
    ipcRenderer.on('open-channel', (_event: any, data: any, dir: string) => callback(data, dir));
  }
});
