const { contextBridge } = require('electron')

// Keep preload minimal for now; expose a tiny marker for later extension.
contextBridge.exposeInMainWorld('electronAPI', {
  ready: true
})
