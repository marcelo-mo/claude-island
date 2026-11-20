// Lógica pura, compartilhada entre o hook (escreve) e a ilha (lê).
const os = require('node:os');
const path = require('node:path');

const STATE_DIR = path.join(os.homedir(), '.claude', 'island');

const DONE_VISIBLE_MS = 6_000;
// Sessão que morreu sem disparar SessionEnd deixa o arquivo para trás;
// depois desses prazos ela para de aparecer.
const RUNNING_STALE_MS = 2 * 60 * 60_000;
const WAITING_STALE_MS = 12 * 60 * 60_000;

// Ferramentas que param a execução esperando o usuário, sem passar por Notification.
const ASKING_TOOLS = { AskUserQuestion: 'Pergunta para você', ExitPlanMode: 'Plano aguardando aprovação' };
// Notification também dispara para avisos que não pedem resposta (ex.: idle_prompt,
// que chegaria 60s depois de todo Stop e deixaria a ilha pulsando para sempre).
const WAITING_NOTIFICATIONS = new Set(['permission_prompt', 'elicitation_dialog']);

/**
 * Traduz o payload de um hook do Claude Code no que fazer com o estado da sessão.
 * Retorna { state, detail }, 'remove' (apagar a sessão) ou null (ignorar o evento).
 */
function eventToState(input) {
  switch (input.hook_event_name) {
    case 'UserPromptSubmit':
      return { state: 'running', detail: 'Pensando…' };
    case 'PreToolUse':
      if (ASKING_TOOLS[input.tool_name]) return { state: 'waiting', detail: ASKING_TOOLS[input.tool_name] };
      return { state: 'running', detail: input.tool_name || 'Executando…' };
    case 'PostToolUse':
      // Também é o que tira a sessão de 'waiting' depois que a permissão é concedida.
      return { state: 'running', detail: 'Pensando…' };
    case 'Notification':
      if (input.notification_type && !WAITING_NOTIFICATIONS.has(input.notification_type)) return null;
      return { state: 'waiting', detail: input.message || 'Precisa da sua resposta' };
    case 'Stop':
      return { state: 'done', detail: 'Concluído' };
    case 'SessionEnd':
      return 'remove';
    default:
      return null;
  }
}

const PRIORITY = { waiting: 3, running: 2, done: 1 };

/**
 * Escolhe o que a ilha mostra entre todas as sessões: a mais urgente e, no empate,
 * a mais recente. `count` é quantas sessões estão ativas (para o contador da ilha) e
 * `windowPid` é o processo dono da janela do terminal dela (null se desconhecido).
 */
function pickState(sessions, now) {
  const alive = sessions.filter((session) => {
    const age = now - session.updatedAt;
    if (session.state === 'done') return age < DONE_VISIBLE_MS;
    if (session.state === 'running') return age < RUNNING_STALE_MS;
    if (session.state === 'waiting') return age < WAITING_STALE_MS;
    return false;
  });
  if (alive.length === 0) return { state: 'idle', count: 0 };
  alive.sort((a, b) => PRIORITY[b.state] - PRIORITY[a.state] || b.updatedAt - a.updatedAt);
  const { state, detail, project, windowPid } = alive[0];
  // windowPid vem de um arquivo em disco: só sai daqui se for um PID plausível.
  const hasWindow = Number.isInteger(windowPid) && windowPid > 0;
  return { state, detail, project, count: alive.length, windowPid: hasWindow ? windowPid : null };
}

module.exports = { STATE_DIR, eventToState, pickState };
