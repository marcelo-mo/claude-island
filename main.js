const { app, BrowserWindow, ipcMain, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { STATE_DIR, pickState } = require('./state');
const { focusWindow } = require('./window');

// A janela é maior que a pílula para caber a versão expandida; a sobra é transparente.
const WINDOW_WIDTH = 440;
const WINDOW_HEIGHT = 160;
const POLL_MS = 400;

// Em Linux o "forward" de setIgnoreMouseEvents não existe, então não dá para
// deixar o clique atravessar a área transparente e ainda detectar o hover.
const CAN_CLICK_THROUGH = process.platform !== 'linux';

function readSessions() {
  let files;
  try {
    files = fs.readdirSync(STATE_DIR);
  } catch {
    return []; // pasta ainda não existe: nenhum hook rodou
  }
  const sessions = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      sessions.push(JSON.parse(fs.readFileSync(path.join(STATE_DIR, file), 'utf8')));
    } catch {
      // arquivo pela metade (hook gravando agora): o próximo ciclo pega
    }
  }
  return sessions;
}

function createIsland() {
  const { workArea } = screen.getPrimaryDisplay();
  const island = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x: Math.round(workArea.x + (workArea.width - WINDOW_WIDTH) / 2),
    y: workArea.y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    focusable: false, // nunca rouba o foco do terminal
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      autoplayPolicy: 'no-user-gesture-required', // o aviso sonoro toca sem clique
    },
  });
  island.setAlwaysOnTop(true, 'screen-saver'); // acima de apps em tela cheia
  island.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  if (CAN_CLICK_THROUGH) island.setIgnoreMouseEvents(true, { forward: true });
  island.loadFile('index.html');

  ipcMain.on('island:hover', (_event, isOverPill) => {
    if (CAN_CLICK_THROUGH) island.setIgnoreMouseEvents(!isOverPill, { forward: true });
  });

  // ponytail: polling em vez de fs.watch — são poucos arquivos minúsculos, e o timer
  // é necessário de qualquer jeito para o "concluído" expirar. Trocar por fs.watch
  // se o custo aparecer.
  let lastSent = '';
  let shownWindowPid = null;
  setInterval(() => {
    const picked = pickState(readSessions(), Date.now());
    const serialized = JSON.stringify(picked);
    if (serialized === lastSent) return;
    lastSent = serialized;
    shownWindowPid = picked.windowPid ?? null;
    island.webContents.send('island:state', picked);
  }, POLL_MS);

  // O renderer só diz "focar"; o PID é o da sessão em exibição, guardado aqui.
  ipcMain.on('island:focus', () => {
    focusWindow(shownWindowPid, (error) => {
      if (error) console.error('Não foi possível focar a janela da sessão:', error.message);
    });
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(createIsland);
  app.on('window-all-closed', () => app.quit());
}
