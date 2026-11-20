// Chamado pelo Claude Code no evento PermissionRequest: mostra o pedido na ilha e espera o
// clique em "Permitir" ou "Negar". Fica separado do hook.js porque este processo pode viver
// minutos, e o hook.js roda em todo evento e precisa continuar rápido.
//
// Contrato com o Claude Code: stdout recebe só o JSON da decisão, e só quando houve decisão.
// Em qualquer outro desfecho (ilha parada, pedido ilegível, respondido no terminal, prazo,
// erro) o processo sai com 0 sem imprimir nada, e o diálogo do terminal segue valendo.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  STATE_DIR, DECISIONS_DIR, HEARTBEAT_FILE, PERMISSION_WAIT_MS,
  permissionRequest, decisionOutput, isHeartbeatFresh,
} = require('./state');

const POLL_MS = 250;

function isIslandAlive() {
  try {
    return isHeartbeatFresh(Number(fs.readFileSync(HEARTBEAT_FILE, 'utf8')), Date.now());
  } catch {
    return false; // sem batimento: a ilha não está rodando
  }
}

/** Estado da sessão em disco; null se o arquivo não existe; undefined se está ilegível agora. */
function readSessionState(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  try {
    const state = JSON.parse(raw);
    return state && typeof state === 'object' ? state : undefined;
  } catch {
    return undefined; // pela metade (o hook.js está gravando agora): o próximo ciclo pega
  }
}

function waitForDecision(input) {
  // session_id vira nome de arquivo: não pode carregar separador de caminho.
  const sessionId = String(input.session_id || '').replace(/[^\w-]/g, '');
  if (!sessionId || !isIslandAlive()) return;
  const request = permissionRequest(input);
  if (!request) return;

  const id = crypto.randomUUID();
  const stateFile = path.join(STATE_DIR, `${sessionId}.json`);
  const decisionFile = path.join(DECISIONS_DIR, `${id}.json`);
  const previous = readSessionState(stateFile) || {};

  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify({
    state: 'waiting',
    detail: `Permissão: ${request.tool}`,
    project: previous.project || path.basename(input.cwd || '') || 'Claude',
    windowPid: previous.windowPid,
    permission: { id, ...request },
    updatedAt: Date.now(),
  }));

  const isStillOurs = (state) => Boolean(state && state.permission && state.permission.id === id);

  // Tira o pedido da ilha, mas só se ainda for o nosso: outro evento pode ter regravado o estado.
  const withdrawRequest = (nextState) => {
    const state = readSessionState(stateFile);
    if (!isStillOurs(state)) return;
    const { permission, ...rest } = state;
    fs.writeFileSync(stateFile, JSON.stringify({ ...rest, ...nextState, updatedAt: Date.now() }));
  };

  const deadline = Date.now() + PERMISSION_WAIT_MS;
  const timer = setInterval(() => {
    // Qualquer falha encerra a espera em silêncio: sem o timer o processo termina sozinho.
    try {
      let decided;
      try {
        decided = fs.readFileSync(decisionFile, 'utf8');
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      if (decided !== undefined) {
        clearInterval(timer);
        fs.rmSync(decisionFile, { force: true });
        let behavior;
        try {
          behavior = JSON.parse(decided).behavior;
        } catch {
          // arquivo de decisão corrompido: não vale como decisão
        }
        const output = decisionOutput(behavior);
        if (!output) return withdrawRequest({});
        process.stdout.write(output);
        // O PostToolUse pode demorar (comando longo); a ilha não pode seguir pedindo resposta.
        withdrawRequest({ state: 'running', detail: behavior === 'allow' ? request.tool : 'Pensando…' });
        return;
      }

      const state = readSessionState(stateFile);
      if (state === undefined) return;
      // Outro evento regravou (ou apagou) o estado: o pedido foi respondido no terminal.
      if (!isStillOurs(state)) return clearInterval(timer);

      if (!isIslandAlive() || Date.now() >= deadline) {
        clearInterval(timer);
        withdrawRequest({});
      }
    } catch {
      clearInterval(timer);
    }
  }, POLL_MS);
}

let raw = '';
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  // Um hook que falha atrapalha a sessão do Claude; a ilha nunca pode custar isso.
  try {
    waitForDecision(JSON.parse(raw));
  } catch {
    // silencioso de propósito (ver contrato no topo)
  }
});
