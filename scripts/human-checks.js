// Verificações que só uma pessoa na tela confirma (CHK-01 e CHK-02 da pesquisa da Fase 4):
//   CHK-01 (HOV-02): o hover sob um terminal elevado (UIPI) chega por polling do cursor mesmo quando o DOM não recebe
//          mais nada. A pílula de teste compara os dois caminhos: o antigo (ignorar o mouse com a opção forward) e o novo.
//   CHK-02 (PREF-03): AltGr+C no ABNT2 chega como Ctrl+Alt+C, então o atalho padrão da ilha é Ctrl+Alt+Shift+C.
// Ferramenta de verificação, não lógica da ilha em execução; por isso mora em scripts/ e nenhum módulo da ilha a carrega.
//
// ANTES de rodar, pare a ilha (encerre o electron.exe da pasta do repositório e espere cerca de 6 s, até o batimento
// envelhecer): ela segura Control+Alt+Shift+C e ocupa o topo central, onde a pílula de teste aparece. A ferramenta
// recusa rodar com a ilha no ar. Uma sessão do Claude Code que comece no meio do teste pode subir a ilha de novo.
//
// Uso (a ilha parada):
//   node_modules\electron\dist\electron.exe scripts\human-checks.js --mode=hover|hotkey [--out=<pasta>]
//   node scripts/human-checks.js --selftest        (Node puro, confere só as funções puras)
//
//   --mode=hover  (40 s): rode uma vez com um terminal comum em foco e outra com o Gerenciador de Tarefas (elevado) em
//                 foco, passando o cursor sobre a pílula laranja no topo central. Esperado: com o elevado o contador do
//                 DOM para e o do polling segue. Grava human-hover-out.json.
//   --mode=hotkey (20 s): digite AltGr+C e depois Ctrl+Alt+Shift+C. verdict 'disparou' em Control+Alt+C com AltGr
//                 confirma o conflito que fez o padrão ser Ctrl+Alt+Shift+C; 'tomado-por-outro-processo' invalida a
//                 rodada (a ilha ou outro programa segura o atalho). Grava human-hotkey-out.json.
//
// A ferramenta só escuta: não gera tecla, clique nem movimento, não mexe em janela de outro app e usa uma pasta de
// dados descartável (não toca os dados da ilha).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { HEARTBEAT_FILE, isHeartbeatFresh } = require('../state');

const HOVER_RUN_MS = 40_000;
const HOTKEY_RUN_MS = 20_000;
const CURSOR_POLL_MS = 33;
const PILL_SIZE = { width: 120, height: 36 };
const HOTKEYS = ['Control+Alt+C', 'Control+Alt+Shift+C'];
const USAGE = 'Uso: electron scripts/human-checks.js --mode=hover|hotkey [--out=<pasta>]\n'
  + '     node scripts/human-checks.js --selftest\n';

const MODES = ['hover', 'hotkey'];
// Contagem inválida (texto, NaN, negativo) vale 0: o resumo nunca lança.
const count = (value) => (Number.isFinite(value) && value > 0 ? value : 0);

/** Devolve { mode, out, selftest }; mode é null se ausente ou diferente de hover e hotkey. */
function parseArgs(argv) {
  const parsed = { mode: null, out: null, selftest: false };
  for (const arg of Array.isArray(argv) ? argv : []) {
    if (arg === '--selftest') parsed.selftest = true;
    else if (arg.startsWith('--mode=')) {
      const mode = arg.slice('--mode='.length);
      parsed.mode = MODES.includes(mode) ? mode : null;
    } else if (arg.startsWith('--out=')) parsed.out = arg.slice('--out='.length) || null;
  }
  return parsed;
}

/** Compara o hover pelo DOM (caminho antigo, com forward) com o polling do cursor (caminho novo). */
function summarizeHover(counts) {
  const { domMoves, pollHits } = counts && typeof counts === 'object' ? counts : {};
  const pollHitsAccumulated = count(pollHits);
  return {
    domMovesForward: count(domMoves),
    pollHitsAccumulated,
    verdict: pollHitsAccumulated > 0 ? 'polling-viu-o-cursor' : 'sem-dados',
  };
}

/**
 * Um veredito por acelerador: 'tomado-por-outro-processo' se o register devolveu false, 'disparou' se ouviu
 * algum disparo, 'sem-disparos' se registrou e nunca disparou. Entrada que não é objeto devolve {}.
 */
function summarizeHotkey(results) {
  const summary = {};
  if (!results || typeof results !== 'object') return summary;
  for (const [accelerator, entry] of Object.entries(results)) {
    if (!entry || typeof entry !== 'object') continue;
    const registered = entry.registered === true;
    const hits = count(entry.hits);
    summary[accelerator] = {
      registered,
      hits,
      verdict: !registered ? 'tomado-por-outro-processo' : hits > 0 ? 'disparou' : 'sem-disparos',
    };
  }
  return summary;
}

/** O batimento da ilha é recente? Texto vazio ou não numérico vale false. */
function islandIsRunning(heartbeatText, now) {
  const text = String(heartbeatText ?? '').trim();
  return text !== '' && isHeartbeatFresh(Number(text), now);
}

function selftest() {
  const assert = require('node:assert/strict');
  const now = 1_000_000;
  assert.deepEqual(parseArgs(['--mode=hover']), { mode: 'hover', out: null, selftest: false });
  assert.deepEqual(parseArgs(['--mode=hotkey', '--out=C:/tmp']), { mode: 'hotkey', out: 'C:/tmp', selftest: false });
  assert.equal(parseArgs(['--selftest']).selftest, true);
  assert.equal(parseArgs(['--mode=outro']).mode, null);
  assert.equal(parseArgs([]).mode, null);
  assert.equal(parseArgs(undefined).mode, null);

  assert.deepEqual(summarizeHover({ domMoves: 12, pollHits: 30 }),
    { domMovesForward: 12, pollHitsAccumulated: 30, verdict: 'polling-viu-o-cursor' });
  assert.equal(summarizeHover({ domMoves: 12, pollHits: 0 }).verdict, 'sem-dados');
  assert.deepEqual(summarizeHover({ domMoves: 'x', pollHits: NaN }),
    { domMovesForward: 0, pollHitsAccumulated: 0, verdict: 'sem-dados' });
  assert.equal(summarizeHover(null).verdict, 'sem-dados');

  const hotkeys = summarizeHotkey({
    'Control+Alt+C': { registered: true, hits: 2 },
    'Control+Alt+Shift+C': { registered: false, hits: 0 },
    'Control+Alt+X': { registered: true, hits: 0 },
  });
  assert.equal(hotkeys['Control+Alt+C'].verdict, 'disparou');
  assert.equal(hotkeys['Control+Alt+Shift+C'].verdict, 'tomado-por-outro-processo');
  assert.equal(hotkeys['Control+Alt+X'].verdict, 'sem-disparos');
  assert.deepEqual(summarizeHotkey(null), {});
  assert.deepEqual(summarizeHotkey('texto'), {});

  assert.equal(islandIsRunning(String(now - 1_000), now), true);
  assert.equal(islandIsRunning(String(now - 10_000), now), false);
  assert.equal(islandIsRunning('', now), false);
  assert.equal(islandIsRunning('abc', now), false);
  assert.equal(islandIsRunning(undefined, now), false);
  console.log('selftest ok');
}

function readHeartbeatText() {
  try {
    return fs.readFileSync(HEARTBEAT_FILE, 'utf8');
  } catch {
    // sem arquivo de batimento a ilha nunca subiu: vale como parada
    return '';
  }
}

function writeResult(outDirectory, fileName, content) {
  const directory = outDirectory || os.tmpdir();
  fs.mkdirSync(directory, { recursive: true });
  const target = path.join(directory, fileName);
  fs.writeFileSync(target, JSON.stringify(content, null, 2));
  console.log(`Gravado em ${target}`);
}

const PILL_PAGE = 'data:text/html,' + encodeURIComponent(
  '<body style="margin:0;background:#f97316"><script>window.moves=0;'
  + 'addEventListener("mousemove",()=>{window.moves++});</script></body>',
);

function runHover(electron, options) {
  const { app, BrowserWindow, screen } = electron;
  const { workArea } = screen.getPrimaryDisplay();
  const win = new BrowserWindow({
    width: PILL_SIZE.width,
    height: PILL_SIZE.height,
    x: Math.round(workArea.x + (workArea.width - PILL_SIZE.width) / 2),
    y: workArea.y,
    frame: false,
    focusable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
  });
  // O caminho antigo, só aqui, para comparar: com forward o DOM recebe mousemove, e deixa de receber sob janela elevada.
  win.setIgnoreMouseEvents(true, { forward: true });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.loadURL(PILL_PAGE);
  win.once('ready-to-show', () => win.showInactive());

  let pollHits = 0;
  const timer = setInterval(() => {
    const cursor = screen.getCursorScreenPoint();
    const bounds = win.getBounds();
    if (cursor.x >= bounds.x && cursor.x < bounds.x + bounds.width
      && cursor.y >= bounds.y && cursor.y < bounds.y + bounds.height) pollHits += 1;
  }, CURSOR_POLL_MS);

  setTimeout(async () => {
    clearInterval(timer);
    let domMoves = 0;
    try {
      domMoves = await win.webContents.executeJavaScript('window.moves');
    } catch {
      // página não carregou: o resumo trata como sem dados
    }
    writeResult(options.out, 'human-hover-out.json', summarizeHover({ domMoves, pollHits }));
    app.quit();
  }, HOVER_RUN_MS);
}

function runHotkey(electron, options) {
  const { app, globalShortcut } = electron;
  const results = {};
  for (const accelerator of HOTKEYS) {
    let registered = false;
    try {
      registered = globalShortcut.register(accelerator, () => { results[accelerator].hits += 1; }) === true;
    } catch {
      // acelerador que o Electron recusa vale como não registrado
    }
    results[accelerator] = { registered, hits: 0 };
  }
  setTimeout(() => {
    globalShortcut.unregisterAll();
    writeResult(options.out, 'human-hotkey-out.json', summarizeHotkey(results));
    app.quit();
  }, HOTKEY_RUN_MS);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selftest) return selftest();
  if (!process.versions.electron || !options.mode) {
    process.stderr.write(USAGE);
    return process.exit(1);
  }
  if (islandIsRunning(readHeartbeatText(), Date.now())) {
    process.stderr.write('Pare a ilha antes: o batimento está recente\n');
    return process.exit(1);
  }
  const electron = require('electron');
  // Pasta descartável, para não tocar os dados da ilha; só antes do ready.
  electron.app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'island-human-checks-')));
  electron.app.on('window-all-closed', () => {});
  electron.app.whenReady().then(() => (options.mode === 'hover' ? runHover : runHotkey)(electron, options));
}

module.exports = { parseArgs, summarizeHover, summarizeHotkey, islandIsRunning };

if (require.main === module) main();
