const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("appApi", {
  readYaml(filePath, options = {}) {
    return ipcRenderer.invoke("app:read-yaml", { filePath, options });
  }
});
