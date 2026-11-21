const { app, BrowserWindow, Menu, ipcMain, screen, globalShortcut } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const {
  STATE_DIR, DECISIONS_DIR, HEARTBEAT_FILE, HEARTBEAT_INTERVAL_MS, PERMISSION_WAIT_MS,
  pickState, sessionList, nextSelection, acceptDecision, anchorPosition, horizontalSlackFor, besideFits, islandDisplays, clampIslandPosition, isWithinWorkArea, nextShownPermission,
  SECURE_WEB_PREFERENCES, isIslandSender, PREFERENCES_FILE, DEFAULT_PREFERENCES, normalizePreferences, isSessionFile,
  WINDOW_SIZE, positionFromSavedOffset, menuTemplate, PREFERENCES_MAX_BYTES, quarantinePath, registerShortcut,
  effectiveOpacity, isIslandVisible, nextUserHidden, toMenuItem,
} = require('./state');
const { focusWindow } = require('./window');

const POLL_MS = 400;
// ponytail: taxa fixa de cerca de 30 Hz; getCursorScreenPoint custa 0,69 µs por chamada (medido na
// pesquisa da Fase 4). Adaptar a taxa só se o custo aparecer.
const CURSOR_TICK_MS = 33;
// O main só manda o ponto com o cursor a até esta distância da janela: mais longe, a histerese do
// renderer não captura de qualquer jeito.
const CURSOR_NEAR_PX = 24;
// A ilha carrega por esta URL e só aceita mensagens da página que está nela (ver islandOf).
const ISLAND_URL = pathToFileURL(path.join(__dirname, 'index.html')).href;

// No Linux (melhor esforço, não testado) a ilha mantém o comportamento de hoje, sem click-through: a
// janela transparente captura o mouse inteira (D-03). O hover vem do cursor do main em todas as
// plataformas; só a captura do mouse depende disto.
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
// Pedido de permissão em exibição, desde quando (performance.now) e a época do armamento: é a este
// id que um clique em "Permitir" ou "Negar" se refere. O renderer só devolve o id como eco, que
// apenas pode recusar. Só muda dentro de refresh (invariante I2), para toda troca rearmar.
let shown = { id: null, since: 0, epoch: 0 };
// Qual sessão está exibida e os pedidos que a ilha já viu. Uma seleção só para todas as ilhas, que
// espelham a mesma sessão; só muda por nextSelection, no refresh e no handler do clique no ponto,
// que termina em refresh.
let selection = { key: null, requests: [] };
// A lista viva do último refresh, na ordem dos pontos e com as chaves de sessão. O clique no ponto
// anda nela; ela nunca vai ao renderer.
let lastSessionList = [];
// Último estado serializado enviado às ilhas; refresh só reenvia quando algo mudou.
let lastSent = JSON.stringify(lastPickedState);
// Último pedido cuja decisão foi gravada. Primeiro clique vence: só o main enxerga as duas ilhas
// (cada renderer só trava o próprio botão), então é ele que recusa a segunda decisão.
let decidedPermissionId = null;
// Preferências visuais, lidas uma vez na subida. O renderer só recebe o valor pelo estado: nunca
// escolhe nem envia preferência (SEG-08).
let preferences = DEFAULT_PREFERENCES;
// Ilha cujo menu de preferências está aberto. Um menu por vez: pedido de menu enquanto há um aberto
// é descartado.
let menuIsland = null;
// Último pedido de captura do mouse de cada ilha. Quem decide é o renderer, pelo retângulo vivo da
// pílula; o main só aplica (applyCapture).
const captureRequests = new Map();
// Ilhas que receberam o ponto do cursor no último tique, para mandar null uma vez só quando o cursor
// se afasta.
const nearIslands = new Set();
let cursorTimer = null;
// Escondida pelo usuário, pelo atalho ou pelo menu. Não é persistida: a ilha sempre sobe visível (D-12).
let userHidden = false;
// Monitor coberto por app em tela cheia -> HWND que o cobre. Só o main calcula, nunca o renderer (D-19).
// Vazio enquanto não houver sensor: nenhum monitor conhecido conta como coberto.
// ponytail: não há sensor de tela cheia porque o autor não autorizou o pacote nativo (D-20). Ele entraria
// aqui: a 2 Hz, uma amostra do primeiro plano do Windows vai para nextFullscreen (state.js) com este mapa,
// process.pid e os monitores em pixels físicos (screen.dipToScreenRect(null, display.bounds)); o mapa novo
// troca este e, se mudou, chama applyVisibility(). Duas opções, medidas na pesquisa da Fase 4: (1)
// koffi@3.3.8 com allowBuilds: { koffi: false } (+5,0 a 5,1 MB, 7,8 µs por sondagem); (2) sem dependência
// nova, um processo PowerShell filho único e persistente com P/Invoke em user32, no padrão do window.js,
// consultado por stdin (28,3 MB numa amostra; um spawn por sondagem custa cerca de 0,45 s e está descartado).
const fullscreenByDisplay = new Map();
// Resultado do registro do atalho em start ('ok', 'unavailable' ou 'invalid'); o menu o mostra.
let shortcutStatus = 'unavailable';

const positionsFile = () => path.join(app.getPath('userData'), 'positions.json');

function loadSavedOffsets() {
  try {
    const parsed = JSON.parse(fs.readFileSync(positionsFile(), 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) savedOffsets = parsed;
  } catch {
    // arquivo ausente ou corrompido: a ilha sobe na posição padrão
  }
}

// O arquivo é editado à mão, e a próxima gravação do menu apagaria o que o usuário escreveu errado.
// Guardado com carimbo de tempo, nenhuma cópia anterior se perde e dá para consertar.
function quarantinePreferences() {
  const quarantined = quarantinePath(PREFERENCES_FILE, Date.now());
  try {
    fs.renameSync(PREFERENCES_FILE, quarantined);
    console.error('Preferências da ilha inválidas; o arquivo foi guardado em', quarantined);
  } catch (error) {
    // nem renomear deu: valem só os padrões
    console.error('Não foi possível guardar o arquivo de preferências inválido:', error.message);
  }
}

// Nunca lança: arquivo ausente, corrompido, enorme ou ilegível não impede a ilha de subir.
function loadPreferences() {
  let text;
  try {
    if (fs.statSync(PREFERENCES_FILE).size > PREFERENCES_MAX_BYTES) {
      quarantinePreferences();
      return;
    }
    text = fs.readFileSync(PREFERENCES_FILE, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Não foi possível ler as preferências da ilha:', error.message);
    return; // sem arquivo ou ilegível: valem os padrões
  }
  try {
    preferences = normalizePreferences(JSON.parse(text));
  } catch {
    quarantinePreferences();
  }
}

function persistSavedOffsets() {
  try {
    writeFileAtomic(positionsFile(), JSON.stringify(savedOffsets));
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

/**
 * Grava num temporário e renomeia: quem lê nunca vê o arquivo pela metade, e uma queda no meio da
 * gravação não zera o conteúdo anterior.
 */
function writeFileAtomic(file, text) {
  const temporaryFile = `${file}.tmp`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(temporaryFile, text);
  fs.renameSync(temporaryFile, file);
}

function writePreferences() {
  try {
    writeFileAtomic(PREFERENCES_FILE, JSON.stringify(preferences, null, 2));
  } catch (error) {
    console.error('Não foi possível salvar as preferências da ilha:', error.message);
  }
}

// Só o menu nativo chama isto: o renderer nunca escolhe preferência (SEG-08). Toda mudança pode
// mover botões sob o cursor, então termina em rearme (SEG-02, D-09).
function applyPreference(key, value) {
  const next = normalizePreferences({ ...preferences, [key]: value });
  if (JSON.stringify(next) === JSON.stringify(preferences)) return;
  if (next.anchor !== preferences.anchor) {
    // Os deslocamentos salvos eram relativos à âncora antiga: aplicá-los à nova jogaria a ilha num lugar
    // sem sentido.
    savedOffsets = {};
    persistSavedOffsets();
  }
  preferences = next;
  writePreferences();
  // Reposiciona toda ilha que não está sendo arrastada antes de rearmar: a âncora move os botões.
  syncIslands();
  refresh('rearm');
}

// Esconder nunca aprova: o gate recusa decisão com a janela escondida (windowVisible). Reexibir passa
// pelo evento 'show', que chama refresh('rearm'); showInactive não rouba o foco do terminal. Nunca
// destruir a ilha para esconder: o som do pedido e o rearme dependem da janela viva. O hide() emite
// 'hide' (solta a captura e reavalia o timer do cursor) e o showInactive() emite 'show' (religa).
function setUserHidden(hidden) {
  userHidden = hidden;
  applyVisibility();
}

// Único lugar que esconde e mostra a ilha: combina o usuário com a tela cheia do monitor dela. Nunca
// destrói a janela (o som do pedido e o rearme dependem dela viva). Reexibir emite 'show', que rearma;
// esconder emite 'hide', que solta a captura e, sem ilha visível, para o timer do cursor.
function applyVisibility() {
  for (const [displayId, island] of islands) {
    const visible = isIslandVisible({ userHidden, covered: fullscreenByDisplay.has(displayId) });
    if (visible && !island.isVisible()) island.showInactive();
    else if (!visible && island.isVisible()) island.hide();
  }
}

// O menu abre sobre a pílula e pode cobrir Permitir e Negar, e o clique que o fecha pode cair num
// botão: abrir e fechar rearmam os botões (D-09).
function openMenu(island) {
  // toMenuItem vive no state.js (lógica pura, com teste de comportamento): o clique de cada item chama um
  // destes dois efeitos, os únicos que o menu tem.
  const effects = { onHide: () => setUserHidden(true), onPreference: applyPreference };
  const menu = Menu.buildFromTemplate(menuTemplate(preferences, shortcutStatus).map((item) => toMenuItem(item, effects)));
  menu.on('menu-will-show', () => refresh('rearm'));
  menu.on('menu-will-close', () => {
    menuIsland = null;
    // Com o menu fechado vale de novo o último pedido do renderer.
    applyCapture(island);
    refresh('rearm');
  });
  menuIsland = island;
  try {
    // Sem x nem y: abre no cursor, que é onde o usuário clicou (a janela é focusable: false).
    menu.popup({ window: island });
  } catch (error) {
    // Janela destruída no meio do pedido: sem isto menuIsland ficaria preso e todo pedido seguinte
    // seria descartado.
    menuIsland = null;
    applyCapture(island);
    console.error('Não foi possível abrir o menu da ilha:', error.message);
  }
}

// Arraste e menu seguram a captura: soltá-la no meio devolveria o clique à janela de trás. Quando eles
// terminam, vale o último pedido do renderer. Sem a opção forward de setIgnoreMouseEvents: ela para de
// funcionar sob janela elevada (UIPI, doc do Electron), e o hover vem do cursor do main de qualquer jeito.
function applyCapture(island) {
  // O menu pode fechar depois de syncIslands ter destruído a ilha dona (escolher "Só no monitor principal"
  // na ilha de um monitor secundário): setIgnoreMouseEvents numa janela destruída lança.
  if (!CAN_CLICK_THROUGH || island.isDestroyed()) return;
  const capture = captureRequests.get(island) === true || dragStartPositions.has(island) || island === menuIsland;
  island.setIgnoreMouseEvents(!capture);
}

// Solta a captura e manda o renderer desligar o hover: a janela transparente nunca fica engolindo cliques.
function releaseCapture(island) {
  captureRequests.delete(island);
  nearIslands.delete(island);
  if (island.isDestroyed()) return;
  island.webContents.send('island:cursor', null);
  applyCapture(island);
}

function cursorTick() {
  const point = screen.getCursorScreenPoint();
  // No modo 'cursor' a ilha vai para o monitor do cursor, nunca com ilha sendo arrastada nem com pedido na
  // tela (D-15). Trocar de monitor move os botões, então rearma depois de mover.
  if (preferences.islandMode === 'cursor' && dragStartPositions.size === 0 && !lastPickedState.permission
    && !islands.has(screen.getDisplayNearestPoint(point).id)) {
    syncIslands();
    refresh('rearm');
  }
  for (const island of islands.values()) {
    if (!island.isVisible()) continue;
    const bounds = island.getBounds();
    const isNear = point.x >= bounds.x - CURSOR_NEAR_PX && point.x <= bounds.x + bounds.width + CURSOR_NEAR_PX
      && point.y >= bounds.y - CURSOR_NEAR_PX && point.y <= bounds.y + bounds.height + CURSOR_NEAR_PX;
    if (isNear) {
      nearIslands.add(island);
      island.webContents.send('island:cursor', { x: point.x - bounds.x, y: point.y - bounds.y });
    } else if (nearIslands.delete(island)) {
      island.webContents.send('island:cursor', null);
    }
  }
}

// Só roda com pelo menos uma ilha visível e fora de ociosa (D-02). Ociosa ou sem ilha visível, nenhum
// timer roda e nenhuma janela transparente segue engolindo cliques.
function updateCursorTick() {
  const active = lastPickedState.state !== 'idle' && [...islands.values()].some((island) => island.isVisible());
  if (active && !cursorTimer) {
    cursorTimer = setInterval(cursorTick, CURSOR_TICK_MS);
  } else if (!active && cursorTimer) {
    clearInterval(cursorTimer);
    cursorTimer = null;
    for (const island of islands.values()) releaseCapture(island);
  }
}

// Primeira aparição de cada sessão, que dá a ordem estável dos pontos. Vem do birthtime do arquivo, então
// a ordem sobrevive a reiniciar a ilha; é um statSync por sessão nova, não por ciclo.
const firstSeenAtByKey = new Map();

function readSessions() {
  let files;
  try {
    files = fs.readdirSync(STATE_DIR);
  } catch {
    firstSeenAtByKey.clear();
    return []; // pasta ainda não existe: nenhum hook rodou
  }
  const sessions = [];
  const presentKeys = new Set();
  for (const file of files) {
    if (!isSessionFile(file)) continue;
    const key = path.basename(file, '.json');
    presentKeys.add(key);
    try {
      const session = JSON.parse(fs.readFileSync(path.join(STATE_DIR, file), 'utf8'));
      if (!session || typeof session !== 'object') continue;
      if (!firstSeenAtByKey.has(key)) {
        let firstSeenAt = Date.now();
        try {
          const birthtime = fs.statSync(path.join(STATE_DIR, file)).birthtimeMs;
          if (birthtime > 0) firstSeenAt = birthtime;
        } catch {
          // arquivo sumiu entre ler e medir, ou sistema sem birthtime: vale o instante em que a ilha viu a sessão
        }
        firstSeenAtByKey.set(key, firstSeenAt);
      }
      // A chave e a ordem vêm do nome do arquivo e da ilha, depois do parse de propósito: o arquivo é
      // escrito por outro processo e não escolhe a própria chave nem a própria ordem.
      session.key = key;
      session.firstSeenAt = firstSeenAtByKey.get(key);
      session.contextPercent = readContextPercent(key);
      sessions.push(session);
    } catch {
      // arquivo pela metade (hook gravando agora): o próximo ciclo pega
    }
  }
  // A chave sai quando o arquivo some; podar pela lista viva faria um statSync por ciclo para cada
  // "concluído" que já expirou.
  for (const key of firstSeenAtByKey.keys()) {
    if (!presentKeys.has(key)) firstSeenAtByKey.delete(key);
  }
  return sessions;
}

function displayOf(island) {
  for (const [displayId, candidate] of islands) {
    if (candidate === island) return screen.getAllDisplays().find((display) => display.id === displayId);
  }
  return undefined;
}

// A única conferência de "a janela inteira está à vista", para o renderer (fitsWorkArea) e para o gate
// (withinVisibleArea): por isso os dois nunca divergem. Ao lado da ilha do sistema, numa área útil estreita, a
// pílula do mod fica por cima da nossa e cobre o começo do pedido, então isso conta como fora da área visível
// (SEG-06).
function fitsVisibleArea(island, display) {
  return Boolean(display)
    && isWithinWorkArea(island.getBounds(), display.workArea, horizontalSlackFor(preferences.anchor))
    && besideFits(preferences.anchor, display.workArea);
}

function moveIsland(island, position, workArea) {
  // setBounds com o tamanho explícito (e não setPosition): com escala de DPI fracionária a
  // janela transparente muda de tamanho a cada setPosition no Windows.
  island.setBounds({ ...clampIslandPosition(position, workArea, WINDOW_SIZE, horizontalSlackFor(preferences.anchor)), ...WINDOW_SIZE });
}

function savedPosition(display) {
  return positionFromSavedOffset(display.workArea, WINDOW_SIZE, savedOffsets[display.id], preferences.anchor);
}

// Só uma ilha toca o aviso sonoro; senão cada monitor tocaria o seu ao mesmo tempo.
function sendState(island) {
  // O estado leva o texto do pedido: só vai para a página da ilha, nunca para uma que a substituísse.
  if (!isIslandSender({ isMainFrame: true, url: island.webContents.getURL(), islandUrl: ISLAND_URL })) return;
  const isFirstIsland = island === islands.values().next().value;
  // answeredId faz a outra ilha travar os botões do pedido que uma ilha já decidiu; armEpoch
  // sobe a cada troca, reexibição ou mudança de monitor, e o renderer rearma quando ele muda.
  // fitsWorkArea é a mesma conferência que o gate faz no clique: com o palco maior que a área útil
  // (monitor baixo, DPI alto) toda decisão seria recusada, então o renderer nem oferece os botões.
  // Só pode desabilitar: o gate continua sendo quem decide.
  const display = displayOf(island);
  const fitsWorkArea = fitsVisibleArea(island, display);
  island.webContents.send(
    'island:state',
    { ...lastPickedState, answeredId: decidedPermissionId, armEpoch: shown.epoch, preferences, fitsWorkArea },
    isFirstIsland,
  );
}

/**
 * Único lugar que muda o pedido exibido. `reason` 'rearm' (reexibir, restaurar, monitor) reinicia
 * o armamento mesmo sem o estado das sessões ter mudado, então o retorno antecipado olha o estado
 * e a época separados: olhar só o estado engoliria o rearme.
 */
function refresh(reason) {
  const now = Date.now();
  const sessions = readSessions();
  const list = sessionList(sessions, now);
  // A lista do refresh anterior serve para achar a vizinha da sessão que saiu.
  selection = nextSelection(selection, list, { type: 'poll', previousKeys: lastSessionList.map((entry) => entry.key) });
  lastSessionList = list;
  const picked = pickState(sessions, now, selection);
  const serialized = JSON.stringify(picked);
  const permissionId = picked.permission ? picked.permission.id : null;
  // Relógio monotônico: o de parede salta com NTP e suspensão, o que armaria os botões antes da
  // hora (ou nunca). Só a regra do armamento usa este instante; pickState segue em relógio de parede.
  const nextShown = nextShownPermission(shown, permissionId, performance.now(), reason === 'rearm');
  if (serialized === lastSent && nextShown.epoch === shown.epoch) return;
  lastSent = serialized;
  lastPickedState = picked;
  shownWindowPid = picked.windowPid ?? null;
  shown = nextShown;
  for (const island of islands.values()) {
    applyOpacity(island);
    sendState(island);
  }
  updateCursorTick();
}

// Transparência de 100/85/70/55%, só sem pedido na tela (invariante I5). O main é o dono do fato "há
// pedido": a opacidade sai do mesmo passo do refresh que decide o pedido exibido e chega antes do estado
// ao renderer. No Linux o setOpacity não tem efeito (aceito).
function applyOpacity(island) {
  island.setOpacity(effectiveOpacity(preferences.opacity, Boolean(lastPickedState.permission)));
}

function createIsland(display) {
  const island = new BrowserWindow({
    ...WINDOW_SIZE,
    ...clampIslandPosition(savedPosition(display), display.workArea, WINDOW_SIZE, horizontalSlackFor(preferences.anchor)),
    frame: false,
    transparent: true,
    show: isIslandVisible({ userHidden, covered: fullscreenByDisplay.has(display.id) }), // monitor novo já nasce escondido se for o caso
    resizable: false,
    movable: false, // o arraste é manual (ver island:drag); o do sistema engoliria o hover
    skipTaskbar: true,
    focusable: false, // nunca rouba o foco do terminal
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      autoplayPolicy: 'no-user-gesture-required', // o aviso sonoro toca sem clique
      // Por último, para nada acima sobrescrever.
      ...SECURE_WEB_PREFERENCES,
    },
  });
  // A 125% de escala a janela nasce 6 DIP mais alta (520×416 medido). O setBounds com o tamanho explícito a
  // devolve a 520×412, e a deriva de +2 DIP que resta cabe na tolerância do gate. Nunca setPosition, que
  // também muda o tamanho.
  moveIsland(island, savedPosition(display), display.workArea);
  applyOpacity(island);
  // Reexibir ou restaurar de minimizada põe os botões sob o cursor de novo, então o main reinicia
  // os 0,8 s. O atalho e o menu escondem por hide() (setUserHidden) e reexibem por showInactive().
  island.on('show', () => refresh('rearm'));
  island.on('restore', () => refresh('rearm'));
  // Todo caminho que esconde a ilha (atalho e menu na Fase 4, tela cheia quando houver sensor) passa
  // por este evento: a ilha escondida solta a captura e, se era a última visível, o timer do cursor
  // para. Reexibir emite 'show', que chama refresh('rearm'), e o refresh religa o timer.
  island.on('hide', () => {
    releaseCapture(island);
    updateCursorTick();
  });
  // Por padrão o Chromium navega a janela quando um link ou arquivo é solto nela, e a página nova
  // herdaria o preload (window.island). A ilha nunca sai do index.html nem abre outra janela.
  island.webContents.on('will-navigate', (event) => event.preventDefault());
  island.webContents.on('will-redirect', (event) => event.preventDefault());
  island.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  // Acima de apps em tela cheia. Só aqui, uma vez por janela (CONV-02): outro overlay que suba depois (a ilha
  // do Windhawk sobe a dela quando se sobrepõe a nós) fica por cima, e repetir esta chamada ou puxar a janela
  // para a frente num timer ou ao reexibir viraria disputa pelo topo. Medido no Electron 45.4.1:
  // hide/showInactive, setBounds e setIgnoreMouseEvents não mexem na ordem. Travado em coexistence.test.js.
  island.setAlwaysOnTop(true, 'screen-saver');
  island.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  if (CAN_CLICK_THROUGH) island.setIgnoreMouseEvents(true);
  islands.set(display.id, island);
  // Janela criada depois (monitor plugado) não pode esperar a próxima mudança de estado.
  island.webContents.on('did-finish-load', () => sendState(island));
  island.loadURL(ISLAND_URL);
}

// Reconciliação única para monitor adicionado, removido ou alterado (resolução, escala,
// barra de tarefas): mais simples e mais seguro que tratar cada evento à parte.
function syncIslands() {
  const displays = screen.getAllDisplays();
  // Ao suspender, o Windows pode relatar zero monitores por um instante; fechar tudo
  // ali encerraria o app (window-all-closed).
  if (displays.length === 0) return;

  const wanted = islandDisplays({
    mode: preferences.islandMode,
    displayIds: displays.map((display) => display.id),
    primaryId: screen.getPrimaryDisplay().id,
    cursorDisplayId: screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).id,
    currentIds: [...islands.keys()],
    // Com pedido na tela a ilha não troca de monitor (D-15): o botão pararia sob o cursor.
    hasPermission: Boolean(lastPickedState.permission),
  });
  // Ilhas de monitor que não deve mais ter ilha (outro modo, monitor removido): sobram para reaproveitar.
  const leftovers = [...islands].filter(([displayId]) => !wanted.includes(displayId));
  for (const display of displays.filter((candidate) => wanted.includes(candidate.id))) {
    const island = islands.get(display.id);
    if (island) {
      if (!dragStartPositions.has(island)) moveIsland(island, savedPosition(display), display.workArea);
      continue;
    }
    // ponytail: a janela sobrando é reaproveitada por setBounds, mesmo entre monitores de DPI diferente (na
    // pesquisa da Fase 4 manteve o tamanho físico certo, uma tentativa por sentido). Se a janela crescer cerca
    // de 25% ao trocar de escala, recriar em vez de mover.
    const reusable = leftovers.findIndex(([, candidate]) => !dragStartPositions.has(candidate));
    if (reusable < 0) {
      createIsland(display);
      continue;
    }
    const [[previousId, reused]] = leftovers.splice(reusable, 1);
    islands.delete(previousId);
    islands.set(display.id, reused);
    // Num monitor novo o pedido de captura e o ponto do cursor antigos não valem mais.
    releaseCapture(reused);
    moveIsland(reused, savedPosition(display), display.workArea);
  }
  // Nunca destrói para esconder: só sobra de modo ou de monitor removido.
  for (const [displayId, island] of leftovers) {
    islands.delete(displayId);
    dragStartPositions.delete(island);
    captureRequests.delete(island);
    nearIslands.delete(island);
    // Sem isto o menuIsland preso numa janela destruída descartaria todo pedido de menu seguinte.
    if (island === menuIsland) menuIsland = null;
    island.destroy();
  }
  // Uma ilha reaproveitada pode ter ido para um monitor coberto por tela cheia.
  applyVisibility();
  // A ilha destruída pode ter sido a última visível, e destruir não emite o evento 'hide'.
  updateCursorTick();
}

function registerIpcHandlers() {
  // Fronteira de confiança: só o index.html, no frame principal, fala com o main. Bloquear a navegação
  // (createIsland) é a primeira camada; esta é a segunda, para todo canal. Remetente estranho: null,
  // e o handler ignora a mensagem.
  const islandOf = (event) => {
    const frame = event.senderFrame;
    const isMainFrame = Boolean(frame) && frame === event.sender.mainFrame;
    if (!isIslandSender({ isMainFrame, url: frame?.url, islandUrl: ISLAND_URL })) return null;
    return BrowserWindow.fromWebContents(event.sender);
  };

  // Só um booleano: o renderer pede captura e o main aplica (arraste e menu a seguram). Outro valor,
  // identificador ou preferência é ignorado.
  ipcMain.on('island:capture', (event, capture) => {
    const island = islandOf(event);
    if (!island || typeof capture !== 'boolean') return;
    // Ociosa, a pílula é invisível e o main já soltou a captura: um pedido de captura agora só pode vir
    // de um renderer fora do contrato e engoliria cliques das janelas de baixo até a próxima sessão.
    if (capture && lastPickedState.state === 'idle') return;
    captureRequests.set(island, capture);
    applyCapture(island);
  });

  // O renderer só pede "abrir"; itens, valores e gravação são do main (SEG-08).
  ipcMain.on('island:menu', (event) => {
    const island = islandOf(event);
    if (!island || menuIsland) return;
    openMenu(island);
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
    // O arraste segurava a captura; terminado, volta o último pedido do renderer.
    applyCapture(island);
    const standard = anchorPosition(preferences.anchor, display.workArea, WINDOW_SIZE);
    const bounds = island.getBounds();
    savedOffsets[display.id] = { x: bounds.x - standard.x, y: bounds.y - standard.y };
    persistSavedOffsets();
    // Soltar a ilha pode deixar um botão sob o cursor parado, e o renderer não percebe o movimento da
    // janela: sem rearmar, o armamento antigo valeria (SEG-02).
    refresh('rearm');
  });

  ipcMain.on('island:reset-position', (event) => {
    const island = islandOf(event);
    const display = island && displayOf(island);
    if (!display) return;
    delete savedOffsets[display.id];
    persistSavedOffsets();
    moveIsland(island, anchorPosition(preferences.anchor, display.workArea, WINDOW_SIZE), display.workArea);
    // O duplo clique leva a janela de uma vez ao lugar padrão, e um botão pode parar sob o cursor.
    refresh('rearm');
  });

  // O renderer só diz "focar"; o PID é o da sessão em exibição, guardado aqui.
  ipcMain.on('island:focus', (event) => {
    if (!islandOf(event)) return;
    focusWindow(shownWindowPid, (error) => {
      if (error) console.error('Não foi possível focar a janela da sessão:', error.message);
    });
  });

  // O renderer manda só o índice do ponto clicado; o main confere que ele existe na lista que os pontos
  // mostram e o traduz para a sessão. Chave de sessão e id de pedido nunca vêm do renderer; ociosa, não
  // há pontos.
  ipcMain.on('island:select', (event, index) => {
    const island = islandOf(event);
    if (!island || !Number.isInteger(index)) return;
    if (lastPickedState.state === 'idle') return;
    selection = nextSelection(selection, lastSessionList, { type: 'select', index });
    refresh('select');
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
      shownId: shown.id,
      shownSince: shown.since,
      now: performance.now(),
      decidedId: decidedPermissionId,
      windowVisible: island.isVisible() && !island.isMinimized(),
      // Fail-safe (D-19): monitor desconhecido conta como coberto.
      coveredByFullscreen: display ? fullscreenByDisplay.has(display.id) : true,
      withinVisibleArea: fitsVisibleArea(island, display),
    });
    // Recusa e falha de gravação reenviam o estado a quem clicou: o renderer trava os botões ao enviar
    // e só os solta quando o main responde. Ele nunca reenvia sozinho; o próximo clique é do usuário.
    if (!verdict.accept) {
      sendState(island);
      return;
    }
    try {
      writeDecision(verdict.permissionId, verdict.behavior);
      // Só depois de gravar: marcar antes impediria tentar de novo se a gravação falhar. O handler
      // roda num turno síncrono do event loop, sem intercalação entre checar e marcar.
      decidedPermissionId = verdict.permissionId;
      for (const each of islands.values()) sendState(each);
    } catch (error) {
      console.error('Não foi possível gravar a decisão do pedido de permissão:', error.message);
      sendState(island);
    }
  });
}

function start() {
  loadSavedOffsets();
  loadPreferences();
  removeOrphanDecisions();
  writeHeartbeat();
  setInterval(writeHeartbeat, HEARTBEAT_INTERVAL_MS);
  registerIpcHandlers();
  // Uma vez só e sem nova tentativa: o atalho só muda no JSON (D-11). A ilha sobe com qualquer status.
  shortcutStatus = registerShortcut(
    (accelerator, onPress) => globalShortcut.register(accelerator, onPress),
    preferences.shortcut,
    () => setUserHidden(nextUserHidden({ userHidden, displayIds: [...islands.keys()], coveredDisplayIds: [...fullscreenByDisplay.keys()] })),
  );
  if (shortcutStatus !== 'ok') console.error(`Não foi possível registrar o atalho ${preferences.shortcut}: ${shortcutStatus}`);
  syncIslands();
  screen.on('display-added', syncIslands);
  screen.on('display-removed', syncIslands);
  screen.on('display-metrics-changed', syncIslands);
  // A janela muda de lugar e os botões andam sob o cursor; rearmar a mais é o lado seguro. Os
  // listeners rodam na ordem de registro, então syncIslands reposiciona antes do rearme.
  for (const eventName of ['display-added', 'display-removed', 'display-metrics-changed']) screen.on(eventName, () => refresh('rearm'));

  // ponytail: polling em vez de fs.watch — são poucos arquivos minúsculos, e o timer
  // é necessário de qualquer jeito para o "concluído" expirar. Trocar por fs.watch
  // se o custo aparecer.
  setInterval(() => refresh('poll'), POLL_MS);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(start);
  app.on('window-all-closed', () => app.quit());
  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    // Sem isto um permission-hook em espera só perceberia a saída quando o batimento envelhecesse.
    fs.rmSync(HEARTBEAT_FILE, { force: true });
  });
}
