const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('island', {
  onState: (callback) => ipcRenderer.on('island:state', (_event, state, shouldChime) => callback(state, shouldChime)),
  setHover: (isOverPill) => ipcRenderer.send('island:hover', isOverPill),
  focusSession: () => ipcRenderer.send('island:focus'),
  drag: (deltaX, deltaY) => ipcRenderer.send('island:drag', deltaX, deltaY),
  endDrag: () => ipcRenderer.send('island:drag-end'),
  resetPosition: () => ipcRenderer.send('island:reset-position'),
});
