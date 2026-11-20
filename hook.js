// Chamado pelo Claude Code em cada evento de hook: recebe o payload no stdin
// e grava o estado da sessão em ~/.claude/island/<session_id>.json.
const fs = require('node:fs');
const path = require('node:path');
const { STATE_DIR, eventToState, keepsPermission } = require('./state');
const { findWindowPid } = require('./window');

let raw = '';
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  // Um hook que falha atrapalha a sessão do Claude; a ilha nunca pode custar isso.
  try {
    const input = JSON.parse(raw);
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
