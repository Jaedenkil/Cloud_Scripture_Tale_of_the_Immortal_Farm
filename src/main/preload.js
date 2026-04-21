const { contextBridge, ipcRenderer } = require('electron')

// Keep preload minimal for now; expose a tiny marker for later extension.
contextBridge.exposeInMainWorld('electronAPI', {
  ready: true,
  getWindowResolution: () => ipcRenderer.invoke('window:get-resolution'),
  setWindowResolution: (width, height) => ipcRenderer.invoke('window:set-resolution', { width, height })
})
