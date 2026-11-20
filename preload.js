const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('island', {
  onState: (callback) => ipcRenderer.on('island:state', (_event, state) => callback(state)),
  setHover: (isOverPill) => ipcRenderer.send('island:hover', isOverPill),
  focusSession: () => ipcRenderer.send('island:focus'),
});
