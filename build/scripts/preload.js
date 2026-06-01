"use strict";
const { ipcRenderer } = require('electron/renderer');
const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
    msg: (channel, message) => ipcRenderer.send(channel, message),
    res: (callback) => ipcRenderer.on('main-channel', (_event, value) => callback(value))
});
//# sourceMappingURL=preload.js.map