// Lógica pura, compartilhada entre o hook (escreve) e a ilha (lê).
const os = require('node:os');
const path = require('node:path');

const STATE_DIR = path.join(os.homedir(), '.claude', 'island');
// A ilha grava aqui a decisão de cada pedido de permissão (<id>.json); o permission-hook lê e apaga.
const DECISIONS_DIR = path.join(STATE_DIR, 'decisions');
// Batimento da ilha: sem ele o permission-hook não espera por botões que ninguém vai ver.
const HEARTBEAT_FILE = path.join(STATE_DIR, '.heartbeat');
// Preferências visuais (tema, forma, estilo e velocidade da animação). Nesta fase só o main lê o
// arquivo; quem grava é o menu da Fase 4.
const PREFERENCES_FILE = path.join(STATE_DIR, 'preferences.json');
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
function acceptDecision({
  behavior, echoedId, shownId, shownSince, now, decidedId, windowVisible, coveredByFullscreen, withinVisibleArea,
}) {
  if (decisionOutput(behavior) === null) return refuseDecision('invalid-behavior');
  if (typeof shownId !== 'string' || shownId === '') return refuseDecision('nothing-shown');
  // Igualdade estrita: eco ausente, de outro tipo, de outro pedido ou com outra caixa recusa.
  if (echoedId !== shownId) return refuseDecision('echo-mismatch');
  // Duas ilhas podem mostrar o mesmo pedido: só o primeiro clique vale.
  if (decidedId === shownId) return refuseDecision('already-decided');
  // Os três fatos abaixo só aceitam o valor exato: fato ausente ou de outro tipo recusa.
  if (windowVisible !== true) return refuseDecision('window-hidden');
  if (coveredByFullscreen !== false) return refuseDecision('covered-by-fullscreen');
  if (withinVisibleArea !== true) return refuseDecision('outside-visible-area');
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

// getBounds() arredonda com escala de DPI fracionária (como 125%), e a janela pode medir 1 ou 2 px
// a mais que o esperado. Recusar por engano é seguro (o terminal segue valendo), mas não pode
// virar recusa permanente de uma janela que está de fato na tela.
const WORK_AREA_TOLERANCE_PX = 2;

/**
 * A janela está dentro da área útil do monitor? `horizontalSlack` é a folga lateral que a
 * janela transparente já tem (ver clampIslandPosition). Devolve false quando `bounds` ou
 * `workArea` não têm todos os campos numéricos: dado que não confere não decide. Num monitor
 * menor que a janela também devolve false, que é o lado seguro.
 */
function isWithinWorkArea(bounds, workArea, horizontalSlack) {
  const fields = [bounds && bounds.x, bounds && bounds.y, bounds && bounds.width, bounds && bounds.height,
    workArea && workArea.x, workArea && workArea.y, workArea && workArea.width, workArea && workArea.height,
    horizontalSlack];
  if (!fields.every(Number.isFinite)) return false;
  const sideMargin = horizontalSlack + WORK_AREA_TOLERANCE_PX;
  return bounds.x >= workArea.x - sideMargin
    && bounds.x + bounds.width <= workArea.x + workArea.width + sideMargin
    && bounds.y >= workArea.y - WORK_AREA_TOLERANCE_PX
    && bounds.y + bounds.height <= workArea.y + workArea.height + WORK_AREA_TOLERANCE_PX;
}

/**
 * Próximo estado do pedido exibido, `{ id, since, epoch }`. Só um id diferente ou `rearm === true`
 * (exatamente true: reexibir, restaurar ou mudar de monitor) reinicia `since` e sobe `epoch`;
 * sem isso devolve o próprio `shown`. O renderer reinicia o armamento quando o `epoch` muda.
 */
function nextShownPermission(shown, permissionId, now, rearm) {
  if (permissionId === shown.id && rearm !== true) return shown;
  return { id: permissionId, since: now, epoch: shown.epoch + 1 };
}

// A janela é um palco fixo, maior que a pílula, e a sobra é transparente. O tamanho cobre o pico da mola do
// estilo Elástico a 2× com a ampliação do hover, o nudge e a sombra (conferido por simulação em
// gate.test.js) e nunca muda durante a animação, para a pílula nunca ser recortada.
// ponytail: um palco só para todos os monitores e escalas de DPI (cada monitor tem o seu renderer e as
// suas molas). Não validado em hardware com DPI misto; se recortar, dimensionar o palco por monitor.
// Limite conhecido: com a área útil menor que o palco (altura abaixo de 410 DIP, ex. 1366×768 a 200%) a janela
// passa da borda, o gate recusa toda decisão e a ilha mostra os botões desabilitados ("Responda no terminal").
const WINDOW_SIZE = Object.freeze({ width: 520, height: 410 });
// A pílula expandida (400 px) fica centrada no palco e sobram 60 px transparentes de cada lado, que podem
// sair da tela para a pílula encostar na borda do monitor. O valor subiu de 20 para 60 junto com a largura
// do palco (440 → 520) e mantém (largura − 400) / 2: a borda da pílula no mesmo lugar de antes.
const HORIZONTAL_SLACK = 60;

/** Posição padrão da janela da ilha: topo central da área útil do monitor. */
function defaultIslandPosition(workArea, windowSize) {
  return { x: Math.round(workArea.x + (workArea.width - windowSize.width) / 2), y: workArea.y };
}

/**
 * Posição da janela a partir do deslocamento salvo pelo usuário. O deslocamento é relativo à posição
 * padrão, que centra pela largura da janela, então trocar o tamanho do palco preserva o centro
 * horizontal e o topo da pílula sem converter nada. Devolve a posição padrão quando o
 * deslocamento não é um objeto com x e y numéricos: o arquivo é editável à mão, e dado em disco não é
 * confiável. Não muta nada. Quem prende a janela na área útil é clampIslandPosition, e por isso uma
 * ilha salva nos últimos ~86 px de baixo do monitor sobe até caber (exceção aceita: o gate exige a
 * janela inteira na área útil, ver isWithinWorkArea).
 */
function positionFromSavedOffset(workArea, windowSize, offset) {
  const standard = defaultIslandPosition(workArea, windowSize);
  if (!offset || typeof offset !== 'object' || !Number.isFinite(offset.x) || !Number.isFinite(offset.y)) return standard;
  return { x: standard.x + offset.x, y: standard.y + offset.y };
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

/**
 * Opacidade com que a ilha deve aparecer. Devolve 1 quando há pedido na tela ou o fato é
 * desconhecido (`hasPermission !== false`, fail-safe) e quando a preferência não é um número em
 * (0, 1]; senão devolve a preferência. Ainda sem consumidor: a transparência de 100/85/70/55% da
 * Fase 4 (PREF-06) a usa, e com pedido na tela a transparência nunca vale (invariante I5).
 */
function effectiveOpacity(preferredOpacity, hasPermission) {
  if (hasPermission !== false) return 1;
  if (typeof preferredOpacity !== 'number' || !(preferredOpacity > 0 && preferredOpacity <= 1)) return 1;
  return preferredOpacity;
}

// Mesma URL de arquivo escrita de dois jeitos que o Chromium e o Node produzem: letra de unidade em
// caixa diferente e trecho com ou sem percent-encoding. Lança com codificação malformada.
const canonicalFileUrl = (url) => decodeURI(url).replace(/^file:\/\/\/([a-z]):/i, (_match, drive) => `file:///${drive.toUpperCase()}:`);

/**
 * O remetente de uma mensagem IPC é a página da ilha? Só o frame principal (`isMainFrame` exatamente
 * true) com a URL do index.html, sem query nem fragmento. Uma página para a qual a janela navegasse
 * (arrastar um link ou arquivo) herdaria o preload e aprovaria pedidos. Devolve false para qualquer
 * entrada que não confira, inclusive URL ausente ou com codificação malformada.
 */
function isIslandSender(input) {
  const { isMainFrame, url, islandUrl } = input || {};
  if (isMainFrame !== true || typeof url !== 'string' || typeof islandUrl !== 'string' || islandUrl === '') return false;
  try {
    return canonicalFileUrl(url) === canonicalFileUrl(islandUrl);
  } catch {
    return false; // decodeURI recusou a URL: dado que não confere não decide
  }
}

// Valores de preferência em inglês (o arquivo é editável à mão); os rótulos em pt-BR chegam com o
// menu da Fase 4. A lista decide o que vale: `includes` não tropeça em chaves do protótipo.
const THEMES = Object.freeze(['auto', 'obsidian', 'graphite', 'slate', 'nord', 'evergreen', 'espresso', 'plum', 'porcelain']);
const SHAPES = Object.freeze(['pill', 'notch', 'win11']);
const ANIMATION_STYLES = Object.freeze(['smooth', 'default', 'bouncy', 'snappy']);
const ANIMATION_SPEED_MIN = 0.5;
const ANIMATION_SPEED_MAX = 2;
const DEFAULT_PREFERENCES = Object.freeze({ theme: 'auto', shape: 'pill', animationStyle: 'default', animationSpeed: 1 });

/**
 * Diz se um nome de arquivo da pasta da ilha é o estado de uma sessão. O preferences.json mora na
 * mesma pasta e é editável à mão: sem esta exclusão explícita, uma chave `state` ou `permission`
 * nele viraria uma sessão fantasma (e alimentaria o gate). Nunca lança.
 */
function isSessionFile(fileName) {
  return typeof fileName === 'string' && fileName.endsWith('.json') && fileName !== path.basename(PREFERENCES_FILE);
}

/**
 * Preferências visuais válidas a partir do que veio do arquivo, que pode estar ausente, corrompido
 * ou ter sido editado à mão. Devolve sempre um objeto novo com só as quatro chaves
 * { theme, shape, animationStyle, animationSpeed }; cada chave inválida ou ausente cai sozinha no
 * valor de DEFAULT_PREFERENCES. A velocidade só vale como número entre ANIMATION_SPEED_MIN e
 * ANIMATION_SPEED_MAX. Nunca lança e nunca muta a entrada.
 */
function normalizePreferences(input) {
  const { theme, shape, animationStyle, animationSpeed } = input || {};
  const pick = (value, list, fallback) => (typeof value === 'string' && list.includes(value) ? value : fallback);
  return {
    theme: pick(theme, THEMES, DEFAULT_PREFERENCES.theme),
    shape: pick(shape, SHAPES, DEFAULT_PREFERENCES.shape),
    animationStyle: pick(animationStyle, ANIMATION_STYLES, DEFAULT_PREFERENCES.animationStyle),
    // NaN e Infinity falham na comparação.
    animationSpeed: typeof animationSpeed === 'number' && animationSpeed >= ANIMATION_SPEED_MIN && animationSpeed <= ANIMATION_SPEED_MAX
      ? animationSpeed
      : DEFAULT_PREFERENCES.animationSpeed,
  };
}

// Explícito protege de regressão: ligar nodeIntegration desligaria o sandbox em silêncio. O renderer
// só carrega o index.html local, com CSP default-src 'none'.
const SECURE_WEB_PREFERENCES = Object.freeze({ contextIsolation: true, sandbox: true, nodeIntegration: false });

module.exports = {
  SECURE_WEB_PREFERENCES, effectiveOpacity, isIslandSender,
  STATE_DIR, DECISIONS_DIR, HEARTBEAT_FILE, HEARTBEAT_INTERVAL_MS, PERMISSION_WAIT_MS, PERMISSION_ARM_MS, PERMISSION_TEXT_LIMIT,
  PERMISSION_TOOL_LIMIT,
  eventToState, keepsPermission, permissionRequest, validPermission, decisionOutput, acceptDecision, isHeartbeatFresh,
  pickState, contextUsage, defaultIslandPosition, clampIslandPosition, isWithinWorkArea,
  WINDOW_SIZE, HORIZONTAL_SLACK, positionFromSavedOffset,
  nextShownPermission,
  PREFERENCES_FILE, THEMES, SHAPES, ANIMATION_STYLES, ANIMATION_SPEED_MIN, ANIMATION_SPEED_MAX, DEFAULT_PREFERENCES,
  normalizePreferences, isSessionFile,
};
