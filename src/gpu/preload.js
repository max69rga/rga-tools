const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('gpuApi', { report: (m) => ipcRenderer.send('gpu:report', m) });
