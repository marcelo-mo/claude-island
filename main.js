const { app, BrowserWindow, ipcMain, screen } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  STATE_DIR, DECISIONS_DIR, HEARTBEAT_FILE, HEARTBEAT_INTERVAL_MS, PERMISSION_WAIT_MS,
  pickState, acceptDecision, defaultIslandPosition, clampIslandPosition, isWithinWorkArea,
} = require('./state');
const { focusWindow } = require('./window');

// A janela é maior que a pílula para caber a versão expandida; a sobra é transparente.
// A altura é a da pílula com um pedido de permissão no tamanho máximo (texto com rolagem).
const WINDOW_SIZE = { width: 440, height: 324 };
// A pílula expandida (400px) fica centrada na janela (440px): sobram 20px transparentes de
// cada lado, que podem sair da tela para a pílula encostar na borda do monitor.
const HORIZONTAL_SLACK = 20;
const POLL_MS = 400;

// Em Linux o "forward" de setIgnoreMouseEvents não existe, então não dá para
// deixar o clique atravessar a área transparente e ainda detectar o hover.
const CAN_CLICK_THROUGH = process.platform !== 'linux';

// Uma janela por monitor, indexada por display.id.
const islands = new Map();
// Posição da janela no início do arraste em curso, por janela. Também é o que diz
// "esta janela está sendo arrastada".
const dragStartPositions = new Map();
// Deslocamento escolhido pelo usuário em relação à posição padrão, por display.id.
// ponytail: o display.id do Electron no Windows deriva do monitor/porta e pode mudar entre
// reinícios, troca de cabo ou dock; quando muda, a ilha só volta ao centro. Se isso
// incomodar, trocar a chave por algo mais estável (ex.: display.label + resolução).
let savedOffsets = {};
let lastPickedState = { state: 'idle', count: 0 };
let shownWindowPid = null;
// Pedido de permissão em exibição e desde quando: é a este id que um clique em "Permitir"
// ou "Negar" se refere. O renderer só devolve o id como eco, que apenas pode recusar.
let shownPermissionId = null;
let shownPermissionSince = 0;
// Último pedido cuja decisão foi gravada. Primeiro clique vence: só o main enxerga as duas ilhas
// (cada renderer só trava o próprio botão), então é ele que recusa a segunda decisão.
let decidedPermissionId = null;

const positionsFile = () => path.join(app.getPath('userData'), 'positions.json');

function loadSavedOffsets() {
  try {
    const parsed = JSON.parse(fs.readFileSync(positionsFile(), 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) savedOffsets = parsed;
  } catch {
    // arquivo ausente ou corrompido: a ilha sobe na posição padrão
  }
}

function persistSavedOffsets() {
  try {
    fs.writeFileSync(positionsFile(), JSON.stringify(savedOffsets));
  } catch (error) {
    console.error('Não foi possível salvar a posição da ilha:', error.message);
  }
}

/**
 * Percentual de contexto usado pela sessão. Nenhum hook recebe esse dado; quem tem é o
 * statusline. O do GSD já o grava por sessão em <tmp>/claude-ctx-<id>.json, então a ilha
 * só lê, sem disputar o único slot de statusLine do Claude Code.
 * ponytail: sem o GSD o anel não aparece; se precisar, a ilha registra um statusline próprio.
 */
function readContextPercent(sessionId) {
  try {
    const bridge = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), `claude-ctx-${sessionId}.json`), 'utf8'));
    return bridge.used_pct;
  } catch {
    return undefined; // sem arquivo (ou pela metade): a sessão fica sem anel
  }
}

// Avisa o permission-hook de que há uma ilha no ar para mostrar os botões.
function writeHeartbeat() {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(HEARTBEAT_FILE, String(Date.now()));
  } catch (error) {
    console.error('Não foi possível gravar o batimento da ilha:', error.message);
  }
}

// Decisão cujo hook já tinha saído (respondido no terminal, por exemplo) fica sem leitor.
function removeOrphanDecisions() {
  try {
    for (const file of fs.readdirSync(DECISIONS_DIR)) {
      const decisionFile = path.join(DECISIONS_DIR, file);
      if (Date.now() - fs.statSync(decisionFile).mtimeMs > PERMISSION_WAIT_MS) fs.rmSync(decisionFile, { force: true });
    }
  } catch {
    // pasta ainda não existe: nenhuma decisão foi gravada
  }
}

/** Grava a decisão do usuário para o permission-hook que espera por ela. */
function writeDecision(permissionId, behavior) {
  const decisionFile = path.join(DECISIONS_DIR, `${permissionId}.json`);
  // Grava num temporário e renomeia: o hook nunca lê uma decisão pela metade.
  const temporaryFile = `${decisionFile}.tmp`;
  fs.mkdirSync(DECISIONS_DIR, { recursive: true });
  fs.writeFileSync(temporaryFile, JSON.stringify({ behavior }));
  fs.renameSync(temporaryFile, decisionFile);
}

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
      const session = JSON.parse(fs.readFileSync(path.join(STATE_DIR, file), 'utf8'));
      session.contextPercent = readContextPercent(path.basename(file, '.json'));
      sessions.push(session);
    } catch {
      // arquivo pela metade (hook gravando agora): o próximo ciclo pega
    }
  }
  return sessions;
}

function displayOf(island) {
  for (const [displayId, candidate] of islands) {
    if (candidate === island) return screen.getAllDisplays().find((display) => display.id === displayId);
  }
  return undefined;
}

function moveIsland(island, position, workArea) {
  // setBounds com o tamanho explícito (e não setPosition): com escala de DPI fracionária a
  // janela transparente muda de tamanho a cada setPosition no Windows.
  island.setBounds({ ...clampIslandPosition(position, workArea, WINDOW_SIZE, HORIZONTAL_SLACK), ...WINDOW_SIZE });
}

function savedPosition(display) {
  const standard = defaultIslandPosition(display.workArea, WINDOW_SIZE);
  const offset = savedOffsets[display.id];
  // O arquivo é editável à mão: só vale deslocamento numérico.
  if (!offset || !Number.isFinite(offset.x) || !Number.isFinite(offset.y)) return standard;
  return { x: standard.x + offset.x, y: standard.y + offset.y };
}

// Só uma ilha toca o aviso sonoro; senão cada monitor tocaria o seu ao mesmo tempo.
function sendState(island) {
  const isFirstIsland = island === islands.values().next().value;
  // answeredId faz a outra ilha travar os botões do pedido que uma ilha já decidiu.
  island.webContents.send('island:state', { ...lastPickedState, answeredId: decidedPermissionId }, isFirstIsland);
}

function createIsland(display) {
  const island = new BrowserWindow({
    ...WINDOW_SIZE,
    ...clampIslandPosition(savedPosition(display), display.workArea, WINDOW_SIZE, HORIZONTAL_SLACK),
    frame: false,
    transparent: true,
    resizable: false,
    movable: false, // o arraste é manual (ver island:drag); o do sistema engoliria o hover
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
  islands.set(display.id, island);
  // Janela criada depois (monitor plugado) não pode esperar a próxima mudança de estado.
  island.webContents.on('did-finish-load', () => sendState(island));
  island.loadFile('index.html');
}

// Reconciliação única para monitor adicionado, removido ou alterado (resolução, escala,
// barra de tarefas): mais simples e mais seguro que tratar cada evento à parte.
function syncIslands() {
  const displays = screen.getAllDisplays();
  // Ao suspender, o Windows pode relatar zero monitores por um instante; fechar tudo
  // ali encerraria o app (window-all-closed).
  if (displays.length === 0) return;

  for (const display of displays) {
    const island = islands.get(display.id);
    if (!island) createIsland(display);
    else if (!dragStartPositions.has(island)) moveIsland(island, savedPosition(display), display.workArea);
  }
  for (const [displayId, island] of islands) {
    if (displays.some((display) => display.id === displayId)) continue;
    islands.delete(displayId);
    dragStartPositions.delete(island);
    island.destroy();
  }
}

function registerIpcHandlers() {
  const islandOf = (event) => BrowserWindow.fromWebContents(event.sender);

  ipcMain.on('island:hover', (event, isOverPill) => {
    const island = islandOf(event);
    // Durante o arraste o ponteiro pode sair da pílula (a janela para na borda da tela);
    // religar o click-through ali soltaria o arraste.
    if (!island || dragStartPositions.has(island) || !CAN_CLICK_THROUGH) return;
    island.setIgnoreMouseEvents(!isOverPill, { forward: true });
  });

  // O renderer manda o deslocamento total desde o pointerdown, em coordenadas de tela;
  // somar à posição inicial (e não à atual) evita acumular erro de arredondamento.
  ipcMain.on('island:drag', (event, deltaX, deltaY) => {
    const island = islandOf(event);
    const display = island && displayOf(island);
    if (!display || !Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return;
    if (!dragStartPositions.has(island)) dragStartPositions.set(island, island.getBounds());
    const start = dragStartPositions.get(island);
    moveIsland(island, { x: start.x + deltaX, y: start.y + deltaY }, display.workArea);
  });

  ipcMain.on('island:drag-end', (event) => {
    const island = islandOf(event);
    const display = island && displayOf(island);
    if (!display || !dragStartPositions.delete(island)) return;
    const standard = defaultIslandPosition(display.workArea, WINDOW_SIZE);
    const bounds = island.getBounds();
    savedOffsets[display.id] = { x: bounds.x - standard.x, y: bounds.y - standard.y };
    persistSavedOffsets();
  });

  ipcMain.on('island:reset-position', (event) => {
    const island = islandOf(event);
    const display = island && displayOf(island);
    if (!display) return;
    delete savedOffsets[display.id];
    persistSavedOffsets();
    moveIsland(island, defaultIslandPosition(display.workArea, WINDOW_SIZE), display.workArea);
  });

  // O renderer só diz "focar"; o PID é o da sessão em exibição, guardado aqui.
  ipcMain.on('island:focus', () => {
    focusWindow(shownWindowPid, (error) => {
      if (error) console.error('Não foi possível focar a janela da sessão:', error.message);
    });
  });

  // Fronteira de confiança: isto aprova a execução de um comando. O renderer envia a intenção
  // ('allow' ou 'deny') e o eco do id que ele estava mostrando; o eco só serve para recusar
  // (o pedido mudou entre ver e clicar). O alvo é sempre o pedido em exibição, guardado aqui.
  ipcMain.on('island:decide', (event, behavior, pressedId) => {
    const island = islandOf(event);
    if (![...islands.values()].includes(island)) return;
    const display = displayOf(island);
    const verdict = acceptDecision({
      behavior,
      echoedId: pressedId,
      shownId: shownPermissionId,
      shownSince: shownPermissionSince,
      now: performance.now(),
      decidedId: decidedPermissionId,
      windowVisible: island.isVisible() && !island.isMinimized(),
      // ponytail: sem sonda de tela cheia até a Fase 4 (TELA-01); a entrada já existe no contrato e nos vetores.
      coveredByFullscreen: false,
      withinVisibleArea: Boolean(display) && isWithinWorkArea(island.getBounds(), display.workArea, HORIZONTAL_SLACK),
    });
    if (!verdict.accept) return;
    try {
      writeDecision(verdict.permissionId, verdict.behavior);
      // Só depois de gravar: marcar antes impediria tentar de novo se a gravação falhar. O handler
      // roda num turno síncrono do event loop, sem intercalação entre checar e marcar.
      decidedPermissionId = verdict.permissionId;
      for (const each of islands.values()) sendState(each);
    } catch (error) {
      console.error('Não foi possível gravar a decisão do pedido de permissão:', error.message);
    }
  });
}

function start() {
  loadSavedOffsets();
  removeOrphanDecisions();
  writeHeartbeat();
  setInterval(writeHeartbeat, HEARTBEAT_INTERVAL_MS);
  registerIpcHandlers();
  syncIslands();
  screen.on('display-added', syncIslands);
  screen.on('display-removed', syncIslands);
  screen.on('display-metrics-changed', syncIslands);

  // ponytail: polling em vez de fs.watch — são poucos arquivos minúsculos, e o timer
  // é necessário de qualquer jeito para o "concluído" expirar. Trocar por fs.watch
  // se o custo aparecer.
  let lastSent = JSON.stringify(lastPickedState);
  setInterval(() => {
    const picked = pickState(readSessions(), Date.now());
    const serialized = JSON.stringify(picked);
    if (serialized === lastSent) return;
    lastSent = serialized;
    lastPickedState = picked;
    shownWindowPid = picked.windowPid ?? null;
    const permissionId = picked.permission ? picked.permission.id : null;
    if (permissionId !== shownPermissionId) {
      shownPermissionId = permissionId;
      // Relógio monotônico: o de parede salta com NTP e suspensão, o que armaria os botões
      // antes da hora (ou nunca). Só a regra do armamento usa este instante.
      shownPermissionSince = performance.now();
    }
    for (const island of islands.values()) sendState(island);
  }, POLL_MS);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(start);
  app.on('window-all-closed', () => app.quit());
  // Sem isto um permission-hook em espera só perceberia a saída quando o batimento envelhecesse.
  app.on('will-quit', () => fs.rmSync(HEARTBEAT_FILE, { force: true }));
}
