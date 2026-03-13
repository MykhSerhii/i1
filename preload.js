const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getDataPort: () => ipcRenderer.invoke('get-data-port'),
  checkDataFiles: () => ipcRenderer.invoke('check-data-files'),
});
