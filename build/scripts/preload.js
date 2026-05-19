"use strict";
// Source - https://stackoverflow.com/a/78305575
// Posted by Praise Dare
// Retrieved 2026-05-19, License - CC BY-SA 4.0
const { ipcRenderer } = require('electron/renderer');
const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
    msg: (channel, message) => ipcRenderer.send(channel, message),
    res: (callback) => ipcRenderer.on('main-channel', (_event, value) => callback(value))
});
//# sourceMappingURL=preload.js.map