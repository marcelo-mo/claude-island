// Chamado pelo Claude Code em cada evento de hook: recebe o payload no stdin
// e grava o estado da sessão em ~/.claude/island/<session_id>.json.
const fs = require('node:fs');
const path = require('node:path');
const { STATE_DIR, HEARTBEAT_FILE, eventToState, keepsPermission, isHeartbeatFresh } = require('./state');
const { findWindowPid } = require('./window');

/** Sobe a ilha se ela não estiver no ar: ninguém precisa lembrar de abri-la a cada dia. */
function startIslandIfStopped() {
  let heartbeatAt;
  try {
    heartbeatAt = Number(fs.readFileSync(HEARTBEAT_FILE, 'utf8'));
  } catch {
    // sem batimento: a ilha nunca rodou nesta máquina
  }
  if (isHeartbeatFresh(heartbeatAt, Date.now())) return;
  // Fora do Electron, require('electron') devolve o caminho do executável.
  // Desacoplada e sem stdio: tem de sobreviver ao fim do hook sem segurar a saída dele.
  // Duas sessões abrindo juntas disparam duas vezes; a trava de instância única resolve.
  const { spawn } = require('node:child_process');
  // Binário do Electron ausente chega como evento 'error' assíncrono, fora do try/catch: sem
  // ouvinte, o hook quebraria com exceção visível na sessão do Claude. A ilha só não sobe.
  spawn(require('electron'), [__dirname], { detached: true, stdio: 'ignore', windowsHide: true })
    .on('error', () => {})
    .unref();
}

let raw = '';
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  // Um hook que falha atrapalha a sessão do Claude; a ilha nunca pode custar isso.
  try {
    const input = JSON.parse(raw);
    if (input.hook_event_name === 'SessionStart') return startIslandIfStopped();
    // session_id vira nome de arquivo: não pode carregar separador de caminho.
    const sessionId = String(input.session_id || '').replace(/[^\w-]/g, '');
    if (!sessionId) return;
    const file = path.join(STATE_DIR, `${sessionId}.json`);

    const result = eventToState(input);
    if (result === 'remove') return fs.rmSync(file, { force: true });
    if (!result) return;

    // Achar a janela do terminal custa uma chamada ao sistema (~0,4 s no Windows), então
    // é feita uma vez por sessão. `null` também é reaproveitado: "já tentei e não achei".
    let windowPid;
    let permission;
    try {
      const previous = JSON.parse(fs.readFileSync(file, 'utf8'));
      windowPid = previous.windowPid;
      // Pedido de permissão pendente (gravado pelo permission-hook): ver keepsPermission.
      if (keepsPermission(input.hook_event_name)) permission = previous.permission;
    } catch {
      // primeiro evento da sessão: ainda não há arquivo
    }
    if (windowPid === undefined) windowPid = findWindowPid(process.ppid);

    fs.mkdirSync(STATE_DIR, { recursive: true });
    const project = path.basename(input.cwd || '') || 'Claude';
    fs.writeFileSync(file, JSON.stringify({ ...result, project, windowPid, permission, updatedAt: Date.now() }));
  } catch {
    // silencioso de propósito (ver comentário acima)
  }
});
