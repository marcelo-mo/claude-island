const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('island', {
  onState: (callback) => ipcRenderer.on('island:state', (_event, state, shouldChime) => callback(state, shouldChime)),
  onCursor: (callback) => ipcRenderer.on('island:cursor', (_event, point) => callback(point)),
  setCapture: (capture) => ipcRenderer.send('island:capture', capture),
  focusSession: () => ipcRenderer.send('island:focus'),
  selectSession: (index) => ipcRenderer.send('island:select', index),
  wheel: (delta) => ipcRenderer.send('island:wheel', delta),
  decide: (behavior, pressedId) => ipcRenderer.send('island:decide', behavior, pressedId),
  drag: (deltaX, deltaY) => ipcRenderer.send('island:drag', deltaX, deltaY),
  endDrag: () => ipcRenderer.send('island:drag-end'),
  resetPosition: () => ipcRenderer.send('island:reset-position'),
  openMenu: () => ipcRenderer.send('island:menu'),
});
