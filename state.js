// Lógica pura, compartilhada entre o hook (escreve) e a ilha (lê).
const os = require('node:os');
const path = require('node:path');

const STATE_DIR = path.join(os.homedir(), '.claude', 'island');
// A ilha grava aqui a decisão de cada pedido de permissão (<id>.json); o permission-hook lê e apaga.
const DECISIONS_DIR = path.join(STATE_DIR, 'decisions');
// Batimento da ilha: sem ele o permission-hook não espera por botões que ninguém vai ver.
const HEARTBEAT_FILE = path.join(STATE_DIR, '.heartbeat');
// Preferências da ilha. O main lê na subida e grava pelo menu (por .tmp + rename); o .tmp e a
// quarentena .bad ficam fora da leitura de sessões por não terminarem em .json.
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

/**
 * A ilha deve estar na tela? Só com o usuário não a escondendo e sem app em tela cheia no monitor dela:
 * o atalho não vence a tela cheia (D-12). Entrada ausente ou de outro tipo esconde (lado seguro).
 */
function isIslandVisible(facts) {
  const { userHidden, covered } = facts ?? {};
  return userHidden === false && covered === false;
}

/**
 * Próximo valor de `userHidden` quando o atalho é apertado. Nunca lança nem muta. Com toda ilha
 * coberta por tela cheia (inclusive sem nenhuma ilha) devolve o valor atual: o atalho não teria efeito
 * visível e, ao sair da tela cheia, a ilha voltaria escondida contra a intenção. `userHidden` é global,
 * então basta uma ilha não coberta para o atalho inverter. `userHidden` que não é `true` conta como
 * falso; ids que não são lista contam como vazios.
 */
function nextUserHidden(input) {
  const { userHidden, displayIds, coveredDisplayIds } = input ?? {};
  const current = userHidden === true;
  const ids = Array.isArray(displayIds) ? displayIds : [];
  const covered = Array.isArray(coveredDisplayIds) ? coveredDisplayIds : [];
  return ids.every((id) => covered.includes(id)) ? current : !current;
}

// A área cliente de um vídeo em tela cheia bate com o monitor a 100% e a 125% (medido); 1 px absorve
// arredondamento de escala.
const FULLSCREEN_TOLERANCE_PX = 1;
// Área de trabalho e barras de tarefas cobrem o monitor sem serem app em tela cheia (TELA-01).
const SHELL_WINDOW_CLASSES = Object.freeze(['Progman', 'WorkerW', 'Shell_TrayWnd', 'Shell_SecondaryTrayWnd']);
// Estilo estendido de janela que deixa o mouse passar (overlay): não conta como primeiro plano.
const WS_EX_TRANSPARENT = 0x20;

/**
 * Regra de D-18, o contrato do sensor de tela cheia, que ainda não existe (pendente da escolha do autor,
 * D-20). Devolve um Map novo de id de monitor para o HWND que o cobre; nunca lança nem muta `previous`.
 * `probe` é null ou { foreground, gone }: `foreground` é null ou { hwnd, className, pid, exStyle, visible,
 * minimized, cloaked, clientRect, monitorRect } (retângulos { left, top, right, bottom } em pixels físicos)
 * e `gone` lista os HWND lembrados que sumiram. `displays` é [{ id, rect }] em pixels físicos. Começa do
 * mapa anterior, solta o que sumiu ou saiu de `displays` e então olha o primeiro plano: o próprio pid e
 * janela invisível, minimizada, cloaked ou transparente não mudam nada; no monitor do primeiro plano, a
 * janela que cobre a área inteira (com a tolerância) fica lembrada e qualquer outra solta o monitor.
 * ponytail: sem enumerar janelas, uma janela em tela cheia totalmente coberta por outra maximizada no
 * mesmo monitor continua lembrada até o foco voltar a ela ou o HWND sumir.
 */
function nextFullscreen(input) {
  const { previous, probe, ownPid, displays } = input ?? {};
  const result = new Map(previous instanceof Map ? previous : []);
  const knownDisplays = Array.isArray(displays) ? displays : [];
  const gone = Array.isArray(probe?.gone) ? probe.gone : [];
  for (const [displayId, hwnd] of result) {
    if (gone.includes(hwnd) || !knownDisplays.some((display) => display?.id === displayId)) result.delete(displayId);
  }
  const foreground = probe?.foreground;
  if (!foreground || !Number.isInteger(foreground.hwnd) || foreground.pid === ownPid) return result;
  if (foreground.visible !== true || foreground.minimized !== false || foreground.cloaked !== false) return result;
  if (!Number.isInteger(foreground.exStyle) || (foreground.exStyle & WS_EX_TRANSPARENT) !== 0) return result;
  const sameRect = (a, b) => ['left', 'top', 'right', 'bottom'].every((side) => a?.[side] === b?.[side]);
  const display = knownDisplays.find((candidate) => sameRect(candidate?.rect, foreground.monitorRect));
  if (!display) return result;
  const client = foreground.clientRect;
  const coversMonitor = ['left', 'top', 'right', 'bottom'].every((side) => (
    Number.isFinite(client?.[side]) && Math.abs(client[side] - display.rect[side]) <= FULLSCREEN_TOLERANCE_PX
  ));
  if (SHELL_WINDOW_CLASSES.includes(foreground.className) || !coversMonitor) result.delete(display.id);
  else result.set(display.id, foreground.hwnd);
  return result;
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
// Decisão da Fase 4 (D-14): a tolerância continua 2 px. Depois do setBounds com o tamanho explícito a
// 125% a deriva é de +2 DIP, que cabe; +3 só aparece com setPosition, que a ilha não usa, e recusar essa
// por engano é o lado seguro. Os vetores de 125% do fixture fixam os dois lados do limite.
const WORK_AREA_TOLERANCE_PX = 2;

/**
 * A janela está dentro da área útil do monitor? `horizontalSlack` é a folga lateral que a
 * janela transparente já tem (ver clampIslandPosition): um número vale para os dois lados e um objeto
 * `{ left, right }` para cada lado. Devolve false quando `bounds` ou `workArea` não têm todos os campos
 * numéricos, ou quando a folga em objeto não traz os dois lados numéricos: dado que não confere não
 * decide. Num monitor menor que a janela também devolve false, que é o lado seguro.
 */
function isWithinWorkArea(bounds, workArea, horizontalSlack) {
  const slack = typeof horizontalSlack === 'object' && horizontalSlack !== null
    ? horizontalSlack
    : { left: horizontalSlack, right: horizontalSlack };
  const fields = [bounds && bounds.x, bounds && bounds.y, bounds && bounds.width, bounds && bounds.height,
    workArea && workArea.x, workArea && workArea.y, workArea && workArea.width, workArea && workArea.height,
    slack.left, slack.right];
  if (!fields.every(Number.isFinite)) return false;
  return bounds.x >= workArea.x - slack.left - WORK_AREA_TOLERANCE_PX
    && bounds.x + bounds.width <= workArea.x + workArea.width + slack.right + WORK_AREA_TOLERANCE_PX
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
// Distância da pílula à lateral e à base da área útil nas âncoras (valores do mod Dynamic Island for
// Windows, MIT, Copyright (c) 2026 devcode90; ver THIRD_PARTY_NOTICES.md).
const ANCHOR_SIDE_GAP_PX = 16;
const ANCHOR_BOTTOM_GAP_PX = 40;
// Âncoras ao lado da ilha do sistema: a borda interna da pílula fica a esta distância do centro horizontal da
// área útil. 190 é a meia-largura do painel expandido do mod (kExpandedWidth = 380), 4,75 o hover de 1,025
// dele e o resto folga visual (valores do mod, MIT, Copyright (c) 2026 devcode90; ver THIRD_PARTY_NOTICES.md).
// ponytail: distância fixa e o arraste da Fase 4 como ajuste fino. Se o arraste não bastar, virar a chave
// besideGapPx no esquema de preferências; seguir a pílula do mod ao vivo exige ler a janela dele (v2, INTG-01).
const BESIDE_GAP_PX = 210;
// Desce a janela para o centro da nossa pílula compacta (8 + 46 / 2 = 31) ficar na altura do centro da faixa
// ociosa do mod (palco 8 px abaixo da área útil, pílula 22 px dentro dele, 36 px de altura: 48).
const BESIDE_TOP_OFFSET_PX = 17;
// Margem do palco do lado ancorado para a sombra, que alcança 14 px para os lados e 19 px para baixo. O CSS
// a repete em --stage-shadow.
const STAGE_SHADOW_PX = 20;
// Largura da pílula expandida no CSS (#pill.expanded).
const EXPANDED_PILL_WIDTH_PX = 400;

/** Posição padrão da janela da ilha: topo central da área útil do monitor. */
function defaultIslandPosition(workArea, windowSize) {
  return { x: Math.round(workArea.x + (workArea.width - windowSize.width) / 2), y: workArea.y };
}

/**
 * Posição da janela nas âncoras ao lado da ilha do sistema, `{ x, y }`, ou null para as outras âncoras. A
 * borda interna da pílula (a que fica de frente para o mod) fica a BESIDE_GAP_PX do centro horizontal da
 * área útil (o mesmo centro que o mod usa, .wh.cpp:4041) e a janela começa STAGE_SHADOW_PX antes dela, para a
 * sombra caber; a pílula encosta nessa borda e cresce para fora (CSS). Com o mod expandido e com hover a
 * janela invade a pílula dele em até ~5 px, abaixo do limiar de 1/8 com que o mod se sobe sobre outra janela
 * (.wh.cpp:4141). O centro é arredondado uma vez, para os dois lados ficarem à mesma distância.
 * Limite conhecido: com a área útil abaixo de 1220 DIP (1366×768 a 125%, por exemplo) não cabe a pílula
 * expandida ao lado do mod, e clampIslandPosition puxa a janela para o centro, por cima da pílula dele. O gate
 * não vê outra janela cobrindo a nossa (isso já vale para a âncora padrão, que fica em cima do mod).
 * ponytail: sem âncora por monitor; quem usa o mod só no principal escolhe "Ilhas > Só no monitor
 * principal". Se isso não bastar, decidir a âncora efetiva por ilha no main. A forma Notch, colada no topo,
 * fica 17 px abaixo dele aqui: com o mod, prefira Pílula ou Windows 11.
 */
function besidePosition(anchor, workArea, windowSize) {
  if (anchor !== 'right-of-island' && anchor !== 'left-of-island') return null;
  const center = Math.round(workArea.x + workArea.width / 2);
  const x = anchor === 'right-of-island'
    ? center + BESIDE_GAP_PX - STAGE_SHADOW_PX
    : center - BESIDE_GAP_PX + STAGE_SHADOW_PX - windowSize.width;
  return { x, y: workArea.y + BESIDE_TOP_OFFSET_PX };
}

/**
 * Posição da janela para a âncora escolhida, `{ x, y }`; âncora fora de ANCHORS vale 'top-center', que é
 * igual a defaultIslandPosition. A pílula encosta no lado ancorado do palco, deixando só a margem da
 * sombra, então a janela sai STAGE_SHADOW_PX além da distância de 16 px à lateral e de 40 px à base. Em
 * cima a janela começa na área útil e o respiro vem do --stage-top do CSS. Embaixo a janela fica 20 px
 * acima da área útil, o que sobra para a deriva de getBounds() com escala de DPI de 125%.
 */
function anchorPosition(anchor, workArea, windowSize) {
  const valid = ANCHORS.includes(anchor) ? anchor : 'top-center';
  const beside = besidePosition(valid, workArea, windowSize);
  if (beside) return beside;
  let x = Math.round(workArea.x + (workArea.width - windowSize.width) / 2);
  if (valid.endsWith('-left')) x = workArea.x + ANCHOR_SIDE_GAP_PX - STAGE_SHADOW_PX;
  if (valid.endsWith('-right')) x = workArea.x + workArea.width - ANCHOR_SIDE_GAP_PX + STAGE_SHADOW_PX - windowSize.width;
  const y = valid.startsWith('bottom-')
    ? workArea.y + workArea.height - ANCHOR_BOTTOM_GAP_PX + STAGE_SHADOW_PX - windowSize.height
    : workArea.y;
  return { x, y };
}

/**
 * Folga lateral `{ left, right }` da janela para a âncora, sempre um objeto novo; âncora fora de ANCHORS
 * vale 'top-center'. No centro a pílula expandida fica centrada e sobram 60 px de cada lado. Numa âncora de
 * canto ela encosta no lado ancorado do palco, com só a margem da sombra: a folga simétrica deixaria a
 * pílula sair 40 px da tela e o gate aceitaria a decisão fora da área visível. Daí 20 px do lado ancorado e
 * o resto do outro, de modo que a folga mais a pílula expandida some sempre a largura do palco.
 */
function horizontalSlackFor(anchor) {
  const valid = ANCHORS.includes(anchor) ? anchor : 'top-center';
  const free = WINDOW_SIZE.width - STAGE_SHADOW_PX - EXPANDED_PILL_WIDTH_PX;
  // Ao lado do mod a pílula encosta na borda interna do palco: à direita dele, no lado esquerdo.
  if (valid === 'right-of-island') return { left: STAGE_SHADOW_PX, right: free };
  if (valid === 'left-of-island') return { left: free, right: STAGE_SHADOW_PX };
  if (valid.endsWith('-left')) return { left: STAGE_SHADOW_PX, right: free };
  if (valid.endsWith('-right')) return { left: free, right: STAGE_SHADOW_PX };
  return { left: HORIZONTAL_SLACK, right: HORIZONTAL_SLACK };
}

// A borda interna da pílula fica a BESIDE_GAP_PX do centro da área útil, dos dois lados, e a pílula expandida
// mede EXPANDED_PILL_WIDTH_PX. Abaixo disso o clamp puxa a janela para cima da pílula do mod, que sobe por
// cima da nossa e cobre o começo das linhas do pedido. Fica depois das duas constantes que usa.
const BESIDE_MIN_WORK_AREA_WIDTH_PX = 2 * (BESIDE_GAP_PX + EXPANDED_PILL_WIDTH_PX);

/**
 * A área útil comporta a pílula expandida ao lado da ilha do sistema? Devolve true quando `anchor` não é
 * 'right-of-island' nem 'left-of-island' (inclusive valor desconhecido ou ausente): a regra não se aplica e
 * quem confere a área útil é isWithinWorkArea. Nas duas âncoras ao lado devolve false com área útil ausente
 * ou sem largura numérica (dado que não confere não decide) e quando ela é mais estreita que
 * BESIDE_MIN_WORK_AREA_WIDTH_PX. Nunca lança.
 */
function besideFits(anchor, workArea) {
  if (anchor !== 'right-of-island' && anchor !== 'left-of-island') return true;
  return Number.isFinite(workArea?.width) && workArea.width >= BESIDE_MIN_WORK_AREA_WIDTH_PX;
}

/**
 * Posição da janela a partir do deslocamento salvo pelo usuário. O deslocamento é relativo à posição
 * da âncora (topo centro quando `anchor` falta ou é inválido), que centra pela largura da janela, então
 * trocar o tamanho do palco preserva o centro horizontal e o topo da pílula sem converter nada. Devolve a
 * posição da âncora quando o deslocamento não é um objeto com x e y numéricos: o arquivo é editável à
 * mão, e dado em disco não é confiável. Não muta nada. Quem prende a janela na área útil é
 * clampIslandPosition, e por isso uma ilha salva nos últimos ~86 px de baixo do monitor sobe até caber
 * (exceção aceita: o gate exige a janela inteira na área útil, ver isWithinWorkArea).
 */
function positionFromSavedOffset(workArea, windowSize, offset, anchor) {
  const standard = anchorPosition(anchor, workArea, windowSize);
  if (!offset || typeof offset !== 'object' || !Number.isFinite(offset.x) || !Number.isFinite(offset.y)) return standard;
  return { x: standard.x + offset.x, y: standard.y + offset.y };
}

/**
 * Mantém a janela da ilha dentro da área útil do monitor dela. `horizontalSlack` é quanto da janela pode
 * sair pelos lados: um número vale para os dois lados e um objeto `{ left, right }` (horizontalSlackFor)
 * para cada lado. A janela é mais larga que a pílula, e sem essa folga a pílula nunca encostaria na
 * borda da tela.
 */
function clampIslandPosition(position, workArea, windowSize, horizontalSlack) {
  const { left, right } = typeof horizontalSlack === 'object' && horizontalSlack !== null
    ? horizontalSlack
    : { left: horizontalSlack, right: horizontalSlack };
  // Monitor menor que a janela: o máximo cairia abaixo do mínimo; vence o mínimo.
  const clamp = (value, min, max) => Math.round(Math.max(min, Math.min(value, max)));
  return {
    x: clamp(position.x, workArea.x - left, workArea.x + workArea.width - windowSize.width + right),
    y: clamp(position.y, workArea.y, workArea.y + workArea.height - windowSize.height),
  };
}

/**
 * Ids de monitor que têm ilha, num array novo, a partir de `{ mode, displayIds, primaryId,
 * cursorDisplayId, currentIds, hasPermission }`. 'perDisplay' (o padrão, e também o que vale para modo
 * desconhecido ou ausente) devolve todos os ids numéricos, na ordem dada; 'primary' devolve só o monitor
 * principal (o primeiro da lista se ele não estiver nela); 'cursor' devolve o monitor do cursor, ou o
 * principal se o cursor não estiver em nenhum. No modo 'cursor' a ilha só segue o cursor com
 * `hasPermission === false`: com pedido na tela, ou com o fato desconhecido, o botão pararia sob o
 * cursor num monitor novo, então ela fica num monitor que já ocupa (o do cursor, se for um deles).
 * Sem monitores, ou com a entrada ausente, devolve []. Nunca lança e nunca muta a entrada.
 */
function islandDisplays(input) {
  const { mode, displayIds, primaryId, cursorDisplayId, currentIds, hasPermission } = input || {};
  const ids = Array.isArray(displayIds) ? displayIds.filter(Number.isFinite) : [];
  if (ids.length === 0) return [];
  const primary = ids.includes(primaryId) ? primaryId : ids[0];
  if (mode === 'primary') return [primary];
  if (mode !== 'cursor') return [...ids];
  const cursor = ids.includes(cursorDisplayId) ? cursorDisplayId : primary;
  if (hasPermission === false) return [cursor];
  const occupied = Array.isArray(currentIds) ? currentIds.filter((id) => ids.includes(id)) : [];
  if (occupied.length === 0 || occupied.includes(cursor)) return [cursor];
  return [occupied[0]];
}

/**
 * Opacidade com que a ilha deve aparecer. Devolve 1 quando há pedido na tela ou o fato é
 * desconhecido (`hasPermission !== false`, fail-safe) e quando a preferência não é um número em
 * (0, 1]; senão devolve a preferência. Quem a usa é applyOpacity no main (transparência de
 * 100/85/70/55%, PREF-06); com pedido na tela a transparência nunca vale (invariante I5).
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
const EXPAND_ON = Object.freeze(['hover', 'click']);
// Degraus de transparência do mod Dynamic Island for Windows (MIT, ver THIRD_PARTY_NOTICES.md).
const OPACITY_LEVELS = Object.freeze([1, 0.85, 0.7, 0.55]);
// As seis âncoras do mesmo mod (MIT, ver THIRD_PARTY_NOTICES.md) e as duas ao lado da ilha dele (Fase 6). As
// ao lado não terminam em -left/-right de propósito: esse sufixo quer dizer "encosta nesse lado do palco" aqui
// e no CSS, e à direita do mod a pílula encosta no lado esquerdo.
const ANCHORS = Object.freeze([
  'top-center', 'top-left', 'top-right', 'bottom-center', 'bottom-left', 'bottom-right', 'right-of-island', 'left-of-island',
]);
const ISLAND_MODES = Object.freeze(['perDisplay', 'primary', 'cursor']);
// Ctrl+Alt+C produz ¢ com AltGr+C no ABNT2 do autor e o register() do Electron não enxerga esse
// conflito; com Ctrl+Alt+Shift nenhuma letra produz caractere no ABNT2 nem no US (medido).
const DEFAULT_SHORTCUT = 'Control+Alt+Shift+C';
// ponytail: só letras, números e +; teclas de pontuação ficam de fora até alguém pedir. Um
// acelerador com forma válida que o Electron recusa vira status 'invalid' no registro do atalho.
const SHORTCUT_PATTERN = /^[A-Za-z0-9]+(?:\+[A-Za-z0-9]+)*$/;
// Uma tecla sozinha só vale se for de função (F1 a F24): uma letra ou um número sem modificador viraria
// atalho global e engoliria aquela tecla em todo programa.
const SHORTCUT_LONE_KEY_PATTERN = /^F(?:[1-9]|1\d|2[0-4])$/;
const SHORTCUT_MAX_LENGTH = 64;
// Sobe quando uma chave muda de nome ou de sentido, para a leitura poder migrar o arquivo antigo.
const PREFERENCES_VERSION = 1;
// Arquivo de preferências acima disto não é lido: vai para a quarentena.
const PREFERENCES_MAX_BYTES = 64 * 1024;
// Velocidades oferecidas no menu; o arquivo continua aceitando qualquer número da faixa acima.
const ANIMATION_SPEED_STEPS = Object.freeze([0.5, 0.75, 1, 1.5, 2]);
const DEFAULT_PREFERENCES = Object.freeze({
  theme: 'auto',
  shape: 'pill',
  animationStyle: 'default',
  animationSpeed: 1,
  expandOn: 'hover',
  pinExpanded: false,
  opacity: 1,
  anchor: 'top-center',
  islandMode: 'perDisplay',
  shortcut: DEFAULT_SHORTCUT,
  version: PREFERENCES_VERSION,
});

const isOneOf = (list) => (value) => typeof value === 'string' && list.includes(value);

// Um predicado por chave do esquema: decide se o valor vindo do arquivo vale. Valor que não passa
// volta ao padrão da chave.
const PREFERENCE_VALIDATORS = Object.freeze({
  theme: isOneOf(THEMES),
  shape: isOneOf(SHAPES),
  animationStyle: isOneOf(ANIMATION_STYLES),
  // NaN e Infinity falham na comparação.
  animationSpeed: (value) => typeof value === 'number' && value >= ANIMATION_SPEED_MIN && value <= ANIMATION_SPEED_MAX,
  expandOn: isOneOf(EXPAND_ON),
  pinExpanded: (value) => typeof value === 'boolean',
  // includes já recusa string e NaN; a ilha nunca fica invisível.
  opacity: (value) => OPACITY_LEVELS.includes(value),
  anchor: isOneOf(ANCHORS),
  islandMode: isOneOf(ISLAND_MODES),
  shortcut: (value) => typeof value === 'string' && value.length <= SHORTCUT_MAX_LENGTH && SHORTCUT_PATTERN.test(value)
    && (value.includes('+') || SHORTCUT_LONE_KEY_PATTERN.test(value)),
  version: (value) => Number.isInteger(value) && value >= 1,
});

/**
 * Diz se um nome de arquivo da pasta da ilha é o estado de uma sessão. O preferences.json mora na
 * mesma pasta e é editável à mão: sem esta exclusão explícita, uma chave `state` ou `permission`
 * nele viraria uma sessão fantasma (e alimentaria o gate). Nunca lança.
 */
function isSessionFile(fileName) {
  return typeof fileName === 'string' && fileName.endsWith('.json') && fileName !== path.basename(PREFERENCES_FILE);
}

/**
 * Preferências válidas a partir do que veio do arquivo, que pode estar ausente, corrompido ou ter
 * sido editado à mão. Devolve sempre um objeto novo e completo, com as 11 chaves de
 * DEFAULT_PREFERENCES na mesma ordem; cada chave inválida ou ausente cai sozinha no padrão dela.
 * Só as chaves do esquema são lidas, e só se forem próprias da entrada: chave extra, `__proto__` e
 * valor herdado são ignorados. Nunca lança e nunca muta a entrada.
 */
function normalizePreferences(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const result = {};
  for (const key of Object.keys(DEFAULT_PREFERENCES)) {
    result[key] = Object.hasOwn(source, key) && PREFERENCE_VALIDATORS[key](source[key])
      ? source[key]
      : DEFAULT_PREFERENCES[key];
  }
  return result;
}

/**
 * Caminho de quarentena de um arquivo estragado: `<arquivo>.<carimbo>.bad`, com `now` truncado.
 * Cada arquivo estragado ganha a sua cópia e uma quarentena nunca sobrescreve a anterior. O nome não
 * termina em .json, então isSessionFile o ignora. Se `now` não for um número finito, cai em
 * `<arquivo>.bad`. Nunca lança.
 */
function quarantinePath(file, now) {
  return Number.isFinite(now) ? `${file}.${Math.trunc(now)}.bad` : `${file}.bad`;
}

// Rótulos do menu em pt-BR, por chave e por valor (o arquivo guarda os valores em inglês). A chave da
// velocidade é String(valor), porque o objeto só tem chaves de texto.
const PREFERENCE_LABELS = Object.freeze({
  theme: Object.freeze({
    auto: 'Automático', obsidian: 'Obsidian', graphite: 'Graphite', slate: 'Slate', nord: 'Nord',
    evergreen: 'Evergreen', espresso: 'Espresso', plum: 'Plum', porcelain: 'Porcelain',
  }),
  shape: Object.freeze({ pill: 'Pílula', notch: 'Notch', win11: 'Windows 11' }),
  animationStyle: Object.freeze({ smooth: 'Suave', default: 'Padrão', bouncy: 'Elástico', snappy: 'Rápido' }),
  animationSpeed: Object.freeze({ 0.5: '0,5×', 0.75: '0,75×', 1: '1×', 1.5: '1,5×', 2: '2×' }),
  expandOn: Object.freeze({ hover: 'Ao passar o mouse', click: 'Ao clicar' }),
  opacity: Object.freeze({ 1: '100%', 0.85: '85%', 0.7: '70%', 0.55: '55%' }),
  anchor: Object.freeze({
    'top-center': 'Topo, centro', 'top-left': 'Topo, esquerda', 'top-right': 'Topo, direita',
    'bottom-center': 'Base, centro', 'bottom-left': 'Base, esquerda', 'bottom-right': 'Base, direita',
    'right-of-island': 'Ao lado da ilha do sistema, à direita', 'left-of-island': 'Ao lado da ilha do sistema, à esquerda',
  }),
  islandMode: Object.freeze({ perDisplay: 'Uma por monitor', primary: 'Só no monitor principal', cursor: 'No monitor do cursor' }),
});

// O atalho chega normalizado (só letras, números e +), então entra no rótulo sem escape.
function shortcutInfoLabel(shortcut, shortcutStatus) {
  if (shortcutStatus === 'ok') return `Atalho para mostrar e esconder: ${shortcut}`;
  if (shortcutStatus === 'unavailable') return `Atalho ${shortcut} indisponível: outro programa já o usa`;
  return `Atalho ${shortcut} inválido no preferences.json`;
}

/**
 * Registra o atalho global que esconde e mostra a ilha. `register` é o `globalShortcut.register` do
 * Electron, que entra por parâmetro para esta função não saber do Electron. Chama `register` uma única
 * vez, sem nova tentativa. Devolve 'ok' se o atalho foi registrado, 'unavailable' se não foi (o Electron
 * devolve false em silêncio quando outro programa já o usa) e 'invalid' se `register` lançar. Nunca lança.
 */
function registerShortcut(register, accelerator, onPress) {
  try {
    return register(accelerator, onPress) === true ? 'ok' : 'unavailable';
  } catch {
    // o Electron lança com acelerador que não entende (medido com 'Ctrl+Banana')
    return 'invalid';
  }
}

/**
 * Modelo do menu de preferências para o main montar com Menu.buildFromTemplate. Devolve um array novo
 * de submenus `{ label, submenu: [...] }` (Tema, Forma, Estilo da animação, Velocidade da animação,
 * Expandir, Transparência, Âncora, Ilhas) mais a caixa 'Fixar aberta', cada filho de submenu um rádio `{ type: 'radio', label, checked, key, value }` marcado quando `value` é o
 * atual. `key` e `value` são para o main traduzir o clique em applyPreference; as chaves que ainda
 * não têm item entram com o efeito delas. Depois deles vêm um separador, a informação do atalho
 * (desabilitada, conforme `shortcutStatus`, o resultado de registerShortcut) e 'Esconder'
 * (`action: 'hide'`). A entrada passa por normalizePreferences (lixo vira padrão). Nunca lança e nunca
 * muta a entrada.
 */
function menuTemplate(preferences, shortcutStatus) {
  const current = normalizePreferences(preferences);
  const radios = (key, values) => values.map((value) => ({
    type: 'radio',
    label: PREFERENCE_LABELS[key][String(value)],
    checked: value === current[key],
    key,
    value,
  }));
  return [
    { label: 'Tema', submenu: radios('theme', THEMES) },
    { label: 'Forma', submenu: radios('shape', SHAPES) },
    { label: 'Estilo da animação', submenu: radios('animationStyle', ANIMATION_STYLES) },
    { label: 'Velocidade da animação', submenu: radios('animationSpeed', ANIMATION_SPEED_STEPS) },
    { label: 'Expandir', submenu: radios('expandOn', EXPAND_ON) },
    // O clique grava o oposto do valor atual; o main não muda: todo item com key vira applyPreference.
    {
      type: 'checkbox', label: 'Fixar aberta', checked: current.pinExpanded, key: 'pinExpanded', value: !current.pinExpanded,
    },
    { label: 'Transparência', submenu: radios('opacity', OPACITY_LEVELS) },
    { label: 'Âncora', submenu: radios('anchor', ANCHORS) },
    { label: 'Ilhas', submenu: radios('islandMode', ISLAND_MODES) },
    { type: 'separator' },
    { label: shortcutInfoLabel(current.shortcut, shortcutStatus), enabled: false },
    // Sem atalho registrado esconder deixaria a ilha inalcançável até reiniciar.
    shortcutStatus === 'ok'
      ? { label: 'Esconder', action: 'hide', enabled: true }
      : { label: 'Esconder (sem atalho para mostrar de novo)', action: 'hide', enabled: false },
  ];
}

/**
 * Traduz um item do modelo de menuTemplate para o item que o Menu do Electron monta. Os efeitos entram por
 * parâmetro (`onHide`, `onPreference(key, value)`), como em registerShortcut, para esta função não saber do
 * Electron. Submenus são traduzidos recursivamente. A ação 'hide' vem antes do teste de `key`: o item de
 * Esconder não tem `key`, e testar `key` primeiro o deixaria sem clique. Item desabilitado nunca ganha
 * clique. Devolve um objeto novo e nunca muta a entrada.
 */
function toMenuItem(item, { onHide, onPreference }) {
  if (item.submenu) return { ...item, submenu: item.submenu.map((child) => toMenuItem(child, { onHide, onPreference })) };
  if (item.action === 'hide') {
    const { action, ...rest } = item;
    return item.enabled === false ? rest : { ...rest, click: () => onHide() };
  }
  if (item.key === undefined) return { ...item };
  const { key, value, ...rest } = item;
  return { ...rest, click: () => onPreference(key, value) };
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
  ANCHOR_SIDE_GAP_PX, ANCHOR_BOTTOM_GAP_PX, STAGE_SHADOW_PX, EXPANDED_PILL_WIDTH_PX, anchorPosition, horizontalSlackFor,
  BESIDE_GAP_PX, BESIDE_TOP_OFFSET_PX,
  BESIDE_MIN_WORK_AREA_WIDTH_PX, besideFits,
  islandDisplays, nextShownPermission, isIslandVisible, nextUserHidden,
  FULLSCREEN_TOLERANCE_PX, SHELL_WINDOW_CLASSES, WS_EX_TRANSPARENT, nextFullscreen,
  PREFERENCES_FILE, THEMES, SHAPES, ANIMATION_STYLES, ANIMATION_SPEED_MIN, ANIMATION_SPEED_MAX, DEFAULT_PREFERENCES,
  normalizePreferences, isSessionFile, ANIMATION_SPEED_STEPS, PREFERENCE_LABELS, menuTemplate, registerShortcut, toMenuItem,
  EXPAND_ON, OPACITY_LEVELS, ANCHORS, ISLAND_MODES, DEFAULT_SHORTCUT, SHORTCUT_PATTERN, SHORTCUT_MAX_LENGTH,
  PREFERENCES_VERSION, PREFERENCES_MAX_BYTES, PREFERENCE_VALIDATORS, quarantinePath,
};
