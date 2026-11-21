// Lógica pura, compartilhada entre o hook (escreve) e a ilha (lê).
const os = require('node:os');
const path = require('node:path');

const STATE_DIR = path.join(os.homedir(), '.claude', 'island');
// A ilha grava aqui a decisão de cada pedido de permissão (<id>.json); o permission-hook lê e apaga.
const DECISIONS_DIR = path.join(STATE_DIR, 'decisions');
// Batimento da ilha: sem ele o permission-hook não espera por botões que ninguém vai ver.
const HEARTBEAT_FILE = path.join(STATE_DIR, '.heartbeat');
const HEARTBEAT_INTERVAL_MS = 2_000;
const HEARTBEAT_STALE_MS = 6_000;
// Quanto o permission-hook espera pela resposta na ilha antes de deixar só o terminal decidir.
const PERMISSION_WAIT_MS = 5 * 60_000;
// Os botões só valem depois que o pedido ficou este tempo na tela: a ilha abre sozinha, e um
// clique que já estava a caminho de outra janela não pode virar uma aprovação.
const PERMISSION_ARM_MS = 800;
// Acima disto o pedido não cabe na ilha de forma legível; quem decide é o terminal.
const PERMISSION_TEXT_LIMIT = 600;
const PERMISSION_LINE_LIMIT = 20;
const PERMISSION_TOOL_LIMIT = 100;

// Tempo suficiente para alcançar o botão "Abrir" antes de a ilha sumir.
const DONE_VISIBLE_MS = 10_000;
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
      return { state: 'running', detail: input.tool_name || 'Trabalhando…' };
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

/**
 * Um pedido de permissão pendente só continua valendo quando o evento seguinte é o
 * Notification do mesmo pedido. Qualquer outro evento da sessão quer dizer que ele já foi
 * respondido (no terminal); sumir do arquivo de estado é o aviso para o permission-hook.
 */
function keepsPermission(hookEventName) {
  return hookEventName === 'Notification';
}

// Campos do Bash que a ilha mostra (command) ou que não alteram o que o comando pode fazer.
const BASH_DISPLAYED_OR_HARMLESS_FIELDS = new Set(['command', 'description', 'timeout', 'run_in_background']);
const UUID_PATTERN =/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// Caracteres de controle e de formatação invisível (inversão de direção, largura zero,
// separadores de linha Unicode): com eles o texto exibido pode não ser o que será executado.
const DECEPTIVE_CHARACTERS = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;

/** O usuário só pode aprovar pela ilha o que consegue ler inteiro e sem truques. */
function isReadablePermissionText(text) {
  if (typeof text !== 'string' || text.trim() === '' || text.length > PERMISSION_TEXT_LIMIT) return false;
  const lines = text.split('\n');
  return lines.length <= PERMISSION_LINE_LIMIT && !lines.some((line) => DECEPTIVE_CHARACTERS.test(line));
}

const isPermissionTool = (tool) => typeof tool === 'string' && tool !== '' && tool.length <= PERMISSION_TOOL_LIMIT
  && !DECEPTIVE_CHARACTERS.test(tool);

/**
 * Monta, a partir do payload do hook PermissionRequest, o que a ilha vai mostrar:
 * { tool, text }. Devolve null quando o pedido não pode ser decidido pela ilha (texto
 * ilegível ou longo demais, ou ferramenta que pede mais que um sim/não); aí o terminal resolve.
 */
function permissionRequest(input) {
  const tool = input.tool_name;
  if (!isPermissionTool(tool) || ASKING_TOOLS[tool]) return null;
  const toolInput = input.tool_input;
  if (!toolInput || typeof toolInput !== 'object') return null;
  // Do Bash a ilha mostra só o comando. Se o pedido traz outro campo (ex.: rodar fora do
  // sandbox), o risco muda sem aparecer na tela; aí quem decide é o terminal.
  if (tool === 'Bash' && Object.keys(toolInput).some((field) => !BASH_DISPLAYED_OR_HARMLESS_FIELDS.has(field))) return null;
  const text = tool === 'Bash' ? toolInput.command : JSON.stringify(toolInput, null, 2);
  return isReadablePermissionText(text) ? { tool, text } : null;
}

/** Valida o pedido lido do arquivo de estado (dado em disco: nunca confiar). */
function validPermission(permission) {
  if (!permission || typeof permission !== 'object') return null;
  const { id, tool, text } = permission;
  if (typeof id !== 'string' || !UUID_PATTERN.test(id)) return null;
  if (!isPermissionTool(tool) || !isReadablePermissionText(text)) return null;
  return { id, tool, text };
}

/**
 * Saída que o Claude Code espera do hook PermissionRequest. Vale só para esta chamada:
 * nada de updatedPermissions. Devolve null se `behavior` não for exatamente allow ou deny.
 */
function decisionOutput(behavior) {
  if (behavior !== 'allow' && behavior !== 'deny') return null;
  const decision = behavior === 'allow' ? { behavior } : { behavior, message: 'Negado pelo usuário na ilha' };
  return JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision } });
}

const refuseDecision = (reason) => ({ accept: false, reason });

/**
 * Decide se um clique em Permitir/Negar vira uma decisão gravada. Nunca lança. Devolve
 * { accept: true, permissionId, behavior }, em que permissionId é sempre o pedido exibido
 * (`shownId`): o eco enviado pelo renderer (`echoedId`) só pode recusar, nunca escolher o
 * alvo. Ou devolve { accept: false, reason }. A ordem das checagens é contrato, fixada pelos
 * vetores de fixtures/permission-vectors.json.
 */
function acceptDecision({ behavior, echoedId, shownId, shownSince, now }) {
  if (decisionOutput(behavior) === null) return refuseDecision('invalid-behavior');
  if (typeof shownId !== 'string' || shownId === '') return refuseDecision('nothing-shown');
  // Igualdade estrita: eco ausente, de outro tipo, de outro pedido ou com outra caixa recusa.
  if (echoedId !== shownId) return refuseDecision('echo-mismatch');
  // Cobre também o relógio que andou para trás (delta negativo) e dado que não é número.
  if (!Number.isFinite(now) || !Number.isFinite(shownSince) || now - shownSince < PERMISSION_ARM_MS) {
    return refuseDecision('not-armed');
  }
  return { accept: true, permissionId: shownId, behavior };
}

/** A ilha está no ar se o batimento dela é recente (e não veio do futuro). */
function isHeartbeatFresh(heartbeatAt, now) {
  return Number.isFinite(heartbeatAt) && heartbeatAt <= now + HEARTBEAT_STALE_MS && now - heartbeatAt <= HEARTBEAT_STALE_MS;
}

// Faixas do anel de contexto: verde, amarelo e vermelho.
const CONTEXT_WARN_PERCENT = 50;
const CONTEXT_CRITICAL_PERCENT = 80;

/**
 * Normaliza o percentual de contexto usado, que vem de um arquivo gravado por outra
 * ferramenta. Devolve { percent, level } ou null se o valor não for um percentual válido.
 */
function contextUsage(usedPercent) {
  if (typeof usedPercent !== 'number' || !Number.isFinite(usedPercent)) return null;
  const percent = Math.round(Math.min(100, Math.max(0, usedPercent)));
  const level = percent >= CONTEXT_CRITICAL_PERCENT ? 'critical' : percent >= CONTEXT_WARN_PERCENT ? 'warn' : 'ok';
  return { percent, level };
}

const PRIORITY = { waiting: 3, running: 2, done: 1 };

/**
 * Escolhe o que a ilha mostra entre todas as sessões: a mais urgente e, no empate,
 * a mais recente. `count` é quantas sessões estão ativas (para o contador da ilha) e
 * `windowPid` é o processo dono da janela do terminal dela (null se desconhecido).
 * `permission` é o pedido de permissão que a ilha pode responder (null se não houver).
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
  const { state, detail, project, windowPid, contextPercent, permission } = alive[0];
  // windowPid vem de um arquivo em disco: só sai daqui se for um PID plausível.
  const hasWindow = Number.isInteger(windowPid) && windowPid > 0;
  return {
    state, detail, project, count: alive.length,
    windowPid: hasWindow ? windowPid : null,
    context: contextUsage(contextPercent),
    // Só quem está esperando resposta tem pedido pendente.
    permission: state === 'waiting' ? validPermission(permission) : null,
  };
}

/** Posição padrão da janela da ilha: topo central da área útil do monitor. */
function defaultIslandPosition(workArea, windowSize) {
  return { x: Math.round(workArea.x + (workArea.width - windowSize.width) / 2), y: workArea.y };
}

/**
 * Mantém a janela da ilha dentro da área útil do monitor dela. `horizontalSlack` é quanto
 * da janela pode sair pelos lados: a janela é mais larga que a pílula, e sem essa folga a
 * pílula nunca encostaria na borda da tela.
 */
function clampIslandPosition(position, workArea, windowSize, horizontalSlack) {
  // Monitor menor que a janela: o máximo cairia abaixo do mínimo; vence o mínimo.
  const clamp = (value, min, max) => Math.round(Math.max(min, Math.min(value, max)));
  return {
    x: clamp(position.x, workArea.x - horizontalSlack, workArea.x + workArea.width - windowSize.width + horizontalSlack),
    y: clamp(position.y, workArea.y, workArea.y + workArea.height - windowSize.height),
  };
}

module.exports = {
  STATE_DIR, DECISIONS_DIR, HEARTBEAT_FILE, HEARTBEAT_INTERVAL_MS, PERMISSION_WAIT_MS, PERMISSION_ARM_MS, PERMISSION_TEXT_LIMIT,
  eventToState, keepsPermission, permissionRequest, validPermission, decisionOutput, acceptDecision, isHeartbeatFresh,
  pickState, contextUsage, defaultIslandPosition, clampIslandPosition,
};
