const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  eventToState, pickState, contextUsage, defaultIslandPosition, clampIslandPosition,
  keepsPermission, permissionRequest, validPermission, decisionOutput, isHeartbeatFresh, PERMISSION_TEXT_LIMIT,
  normalizePreferences, DEFAULT_PREFERENCES, THEMES, SHAPES, ANIMATION_STYLES, isSessionFile,
  EXPAND_ON, OPACITY_LEVELS, ANCHORS, ISLAND_MODES,
  WINDOW_SIZE, HORIZONTAL_SLACK, isWithinWorkArea, positionFromSavedOffset,
  anchorPosition, horizontalSlackFor, ANCHOR_SIDE_GAP_PX, ANCHOR_BOTTOM_GAP_PX, STAGE_SHADOW_PX, EXPANDED_PILL_WIDTH_PX,
  islandDisplays, isIslandVisible, nextUserHidden, nextFullscreen, sessionList, nextSelection,
} = require('./state');
const { applyHooks, updateSettingsFile, COMMAND, PERMISSION_COMMAND, PERMISSION_TIMEOUT_SECONDS } = require('./install');

test('eventos do Claude Code viram estados da ilha', () => {
  assert.equal(eventToState({ hook_event_name: 'UserPromptSubmit' }).state, 'running');
  assert.deepEqual(eventToState({ hook_event_name: 'PreToolUse', tool_name: 'Bash' }), { state: 'running', detail: 'Bash' });
  assert.equal(eventToState({ hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion' }).state, 'waiting');
  assert.equal(eventToState({ hook_event_name: 'PostToolUse' }).state, 'running');
  assert.equal(eventToState({ hook_event_name: 'Notification', notification_type: 'permission_prompt', message: 'm' }).detail, 'm');
  assert.equal(eventToState({ hook_event_name: 'Notification', notification_type: 'idle_prompt' }), null);
  assert.equal(eventToState({ hook_event_name: 'Notification' }).state, 'waiting');
  assert.equal(eventToState({ hook_event_name: 'Stop' }).state, 'done');
  assert.equal(eventToState({ hook_event_name: 'SessionEnd' }), 'remove');
  assert.equal(eventToState({ hook_event_name: 'SubagentStop' }), null);
});

test('a ilha mostra a sessão mais urgente e expira as antigas', () => {
  const now = 1_000_000_000;
  assert.deepEqual(pickState([], now), { state: 'idle', count: 0 });

  const picked = pickState([
    { state: 'running', detail: 'Bash', project: 'a', updatedAt: now },
    { state: 'waiting', detail: 'Permissão', project: 'b', windowPid: 4242, updatedAt: now - 60_000 },
    { state: 'done', detail: 'Concluído', project: 'c', updatedAt: now - 1_000 },
  ], now);
  assert.deepEqual(picked, {
    state: 'waiting', detail: 'Permissão', project: 'b', count: 3, windowPid: 4242, context: null, permission: null,
    sessions: [
      { state: 'running', pending: false, current: false },
      { state: 'waiting', pending: false, current: true },
      { state: 'done', pending: false, current: false },
    ],
    queue: null,
  });

  // PID ausente ou adulterado no arquivo de estado: a ilha fica sem botão, não com PID inválido
  for (const windowPid of [undefined, null, '4242; calc', 1.5, -3]) {
    assert.equal(pickState([{ state: 'running', windowPid, updatedAt: now }], now).windowPid, null);
  }

  // empate de prioridade: vence a mais recente
  assert.equal(pickState([
    { state: 'running', project: 'velha', updatedAt: now - 5_000 },
    { state: 'running', project: 'nova', updatedAt: now },
  ], now).project, 'nova');

  assert.equal(pickState([{ state: 'done', updatedAt: now - 9_000 }], now).state, 'done');
  assert.equal(pickState([{ state: 'done', updatedAt: now - 11_000 }], now).state, 'idle');
  assert.equal(pickState([{ state: 'running', updatedAt: now - 3 * 60 * 60_000 }], now).state, 'idle');
});

test('a ilha arrastada fica dentro da área útil do monitor dela', () => {
  const windowSize = { width: 440, height: 160 };
  // monitor secundário à esquerda do primário, com barra de tarefas embaixo
  const workArea = { x: -1920, y: 0, width: 1920, height: 1040 };
  const clamp = (position) => clampIslandPosition(position, workArea, windowSize, 20);

  assert.deepEqual(defaultIslandPosition(workArea, windowSize), { x: -1180, y: 0 });
  assert.deepEqual(clamp({ x: -1180, y: 0 }), { x: -1180, y: 0 });
  assert.deepEqual(clamp({ x: -1000.4, y: 300.6 }), { x: -1000, y: 301 });
  // a folga horizontal deixa a pílula (não a janela) encostar na borda
  assert.deepEqual(clamp({ x: -5000, y: -50 }), { x: -1940, y: 0 });
  assert.deepEqual(clamp({ x: 5000, y: 5000 }), { x: -420, y: 880 });
  // monitor menor que a janela: não inverte os limites
  assert.deepEqual(clampIslandPosition({ x: 50, y: 50 }, { x: 0, y: 0, width: 300, height: 100 }, windowSize, 20), { x: -20, y: 0 });
});

test('o anel de contexto muda de faixa em 50% e 80% e rejeita valores inválidos', () => {
  assert.deepEqual(contextUsage(25), { percent: 25, level: 'ok' });
  assert.deepEqual(contextUsage(49.4), { percent: 49, level: 'ok' });
  assert.deepEqual(contextUsage(50), { percent: 50, level: 'warn' });
  assert.deepEqual(contextUsage(79.6), { percent: 80, level: 'critical' });
  assert.deepEqual(contextUsage(140), { percent: 100, level: 'critical' });
  assert.deepEqual(contextUsage(-5), { percent: 0, level: 'ok' });
  for (const invalid of [undefined, null, '25', NaN, Infinity]) assert.equal(contextUsage(invalid), null);

  const now = 1_000_000_000;
  const picked = pickState([{ state: 'running', contextPercent: 62, updatedAt: now }], now);
  assert.deepEqual(picked.context, { percent: 62, level: 'warn' });
});

test('o pedido de permissão só vai para a ilha se couber inteiro e for legível', () => {
  const bash = (command) => permissionRequest({ tool_name: 'Bash', tool_input: { command, description: 'd' } });
  assert.deepEqual(bash('node escreve.js'), { tool: 'Bash', text: 'node escreve.js' });
  assert.deepEqual(bash('echo a\necho b'), { tool: 'Bash', text: 'echo a\necho b' });
  assert.deepEqual(
    permissionRequest({ tool_name: 'Read', tool_input: { file_path: 'a.txt' } }),
    { tool: 'Read', text: '{\n  "file_path": "a.txt"\n}' },
  );

  assert.notEqual(bash('x'.repeat(PERMISSION_TEXT_LIMIT)), null);
  assert.equal(bash('x'.repeat(PERMISSION_TEXT_LIMIT + 1)), null);
  assert.equal(permissionRequest({ tool_name: 'Write', tool_input: { content: 'x'.repeat(PERMISSION_TEXT_LIMIT) } }), null);
  // texto que esconderia o comando real: muitas linhas, caracteres de controle ou invisíveis
  assert.equal(bash(`echo ok${'\n'.repeat(20)}rm -rf .`), null);
  for (const deceptive of ['echo ok\r', 'a\x1b[2Kb', 'a‮b', 'a​b', 'a b']) assert.equal(bash(deceptive), null);
  for (const invalid of [undefined, null, 42, '', '   ', ['ls']]) assert.equal(bash(invalid), null);

  // campo do Bash que muda o risco sem aparecer na ilha: o terminal decide
  assert.equal(permissionRequest({ tool_name: 'Bash', tool_input: { command: 'ls', dangerouslyDisableSandbox: true } }), null);
  assert.deepEqual(
    permissionRequest({ tool_name: 'Bash', tool_input: { command: 'ls', timeout: 5000, run_in_background: true } }),
    { tool: 'Bash', text: 'ls' },
  );
  assert.equal(permissionRequest({ tool_name: 'Bash' }), null);
  assert.equal(permissionRequest({ tool_name: 'Bash', tool_input: 'ls' }), null);
  assert.equal(permissionRequest({ tool_input: { command: 'ls' } }), null);
  assert.equal(permissionRequest({ tool_name: 'x'.repeat(101), tool_input: {} }), null);
  // pergunta e plano pedem mais que um sim/não: ficam com o terminal
  assert.equal(permissionRequest({ tool_name: 'AskUserQuestion', tool_input: { questions: [] } }), null);
  assert.equal(permissionRequest({ tool_name: 'ExitPlanMode', tool_input: { plan: 'p' } }), null);
});

test('o pedido lido do disco é validado antes de chegar à ilha', () => {
  const now = 1_000_000_000;
  const permission = { id: '3f2b8c1e-9d4a-4b6f-8a1c-2e5d7f9b0c3a', tool: 'Bash', text: 'node escreve.js' };
  assert.deepEqual(validPermission({ ...permission, extra: 'descartado' }), permission);
  assert.deepEqual(pickState([{ state: 'waiting', permission, updatedAt: now }], now).permission, permission);
  // só quem espera resposta tem pedido pendente
  assert.equal(pickState([{ state: 'running', permission, updatedAt: now }], now).permission, null);

  for (const invalid of [
    undefined, null, 'x', [],
    { ...permission, id: '../../settings' },
    { ...permission, id: `${permission.id}/..` },
    { ...permission, id: permission.id.toUpperCase() },
    { ...permission, id: 7 },
    { ...permission, tool: undefined },
    { ...permission, tool: '' },
    { ...permission, text: 42 },
    { ...permission, text: 'x'.repeat(PERMISSION_TEXT_LIMIT + 1) },
    { ...permission, text: 'a‮b' },
  ]) {
    assert.equal(validPermission(invalid), null);
    assert.equal(pickState([{ state: 'waiting', permission: invalid, updatedAt: now }], now).permission, null);
  }
});

test('a decisão só sai como allow ou deny, e o pedido só sobrevive ao Notification', () => {
  assert.equal(
    decisionOutput('allow'),
    '{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}',
  );
  assert.equal(
    decisionOutput('deny'),
    '{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"deny","message":"Negado pelo usuário na ilha"}}}',
  );
  for (const invalid of [undefined, null, '', 'ALLOW', 'allow ', 'ask', true, { behavior: 'allow' }, ['allow']]) {
    assert.equal(decisionOutput(invalid), null);
  }

  assert.equal(keepsPermission('Notification'), true);
  for (const event of ['PreToolUse', 'PostToolUse', 'UserPromptSubmit', 'Stop', undefined]) assert.equal(keepsPermission(event), false);
});

test('a ilha só conta como viva com batimento recente', () => {
  const now = 1_000_000_000;
  assert.equal(isHeartbeatFresh(now, now), true);
  assert.equal(isHeartbeatFresh(now - 6_000, now), true);
  assert.equal(isHeartbeatFresh(now - 6_001, now), false);
  // relógio adiantado no arquivo não vale como "viva para sempre"
  assert.equal(isHeartbeatFresh(now + 60_000, now), false);
  for (const invalid of [NaN, undefined, null, '']) assert.equal(isHeartbeatFresh(invalid, now), false);
});

test('instalar preserva hooks alheios, é idempotente e desinstalar limpa', () => {
  const foreign = { matcher: '', hooks: [{ type: 'command', command: 'node notify.js' }] };
  const original = { model: 'x', hooks: { Stop: [foreign], SubagentStop: [foreign], PermissionRequest: [foreign] } };

  const installed = applyHooks(applyHooks(original, true), true);
  assert.equal(installed.model, 'x');
  assert.deepEqual(installed.hooks.SubagentStop, [foreign]);
  assert.equal(installed.hooks.SessionStart.length, 1);
  assert.deepEqual(installed.hooks.Stop, [foreign, { matcher: '', hooks: [{ type: 'command', command: COMMAND }] }]);
  assert.equal(installed.hooks.PreToolUse.length, 1);
  // o pedido de permissão tem script próprio, com prazo maior que a espera pelo clique
  assert.deepEqual(installed.hooks.PermissionRequest, [
    foreign,
    { matcher: '', hooks: [{ type: 'command', command: PERMISSION_COMMAND, timeout: PERMISSION_TIMEOUT_SECONDS }] },
  ]);
  assert.equal(PERMISSION_TIMEOUT_SECONDS, 330);
  assert.match(PERMISSION_COMMAND, /permission-hook\.js" --claude-island$/);
  // nenhum outro evento chama o permission-hook, e o PermissionRequest não chama o hook.js
  assert.equal(JSON.stringify(installed).split('permission-hook.js').length - 1, 1);

  assert.deepEqual(applyHooks(installed, false), original);
});

test('hook da ilha de outra pasta ou de outro Node é trocado; hook.js alheio fica', () => {
  const entry = (command) => ({ matcher: '', hooks: [{ type: 'command', command }] });
  const moved = entry('"/old/node" "/repo-antigo/hook.js" --claude-island');
  const foreign = entry('node /outra-ferramenta/hook.js');
  const legacy = entry(COMMAND.replace(' --claude-island', ''));
  const installed = applyHooks({ hooks: { Stop: [moved, foreign, legacy] } }, true);
  assert.deepEqual(installed.hooks.Stop, [foreign, entry(COMMAND)]);
  assert.deepEqual(applyHooks(installed, false).hooks.Stop, [foreign]);
});

/** Cria um diretório temporário com um settings.json e devolve o caminho dele. */
function tempSettings(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'island-install-'));
  const file = path.join(dir, 'settings.json');
  fs.writeFileSync(file, JSON.stringify(content));
  return file;
}

test('o backup guarda a versão de antes da ilha, mesmo instalando duas vezes e desinstalando', () => {
  const original = { model: 'x', hooks: { Stop: [{ matcher: '', hooks: [{ type: 'command', command: 'node notify.js' }] }] } };
  const file = tempSettings(original);
  const backup = () => JSON.parse(fs.readFileSync(`${file}.island-backup`, 'utf8'));

  updateSettingsFile(file, true);
  updateSettingsFile(file, true);
  assert.deepEqual(backup(), original);
  updateSettingsFile(file, false);
  assert.deepEqual(backup(), original);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), original);
  // nenhum temporário fica para trás
  assert.deepEqual(fs.readdirSync(path.dirname(file)).sort(), ['settings.json', 'settings.json.island-backup']);
});

test('settings.json inválido não é tocado', () => {
  const file = tempSettings({});
  fs.writeFileSync(file, '{ quebrado');
  assert.throws(() => updateSettingsFile(file, true));
  assert.equal(fs.readFileSync(file, 'utf8'), '{ quebrado');
});

test('settings.json que é link (dotfiles) continua link e o alvo recebe os hooks', (t) => {
  const target = tempSettings({ model: 'x' });
  const link = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'island-link-')), 'settings.json');
  try {
    fs.symlinkSync(target, link, 'file');
  } catch {
    return t.skip('sem permissão para criar symlink nesta máquina');
  }
  updateSettingsFile(link, true);
  assert.equal(fs.lstatSync(link).isSymbolicLink(), true);
  assert.equal(JSON.parse(fs.readFileSync(target, 'utf8')).model, 'x');
  assert.ok(JSON.parse(fs.readFileSync(target, 'utf8')).hooks.Stop);
});

test('normalizePreferences: entrada que não é objeto devolve o padrão', () => {
  for (const input of [undefined, null, [], 'nord', 7, true]) {
    assert.deepEqual(normalizePreferences(input), DEFAULT_PREFERENCES);
  }
});

test('normalizePreferences: objeto válido completo volta igual', () => {
  const valid = { theme: 'nord', shape: 'notch', animationStyle: 'bouncy', animationSpeed: 2 };
  assert.deepEqual(normalizePreferences(valid), { ...DEFAULT_PREFERENCES, ...valid });
});

test('normalizePreferences: cada chave inválida cai sozinha no padrão', () => {
  const valid = { theme: 'nord', shape: 'notch', animationStyle: 'bouncy', animationSpeed: 2 };
  const complete = { ...DEFAULT_PREFERENCES, ...valid };
  assert.deepEqual(normalizePreferences({ ...valid, theme: 'NORD' }), { ...complete, theme: 'auto' });
  assert.deepEqual(normalizePreferences({ ...valid, shape: 3 }), { ...complete, shape: 'pill' });
  assert.deepEqual(normalizePreferences({ ...valid, animationStyle: 'elastico' }), { ...complete, animationStyle: 'default' });
  // 'toString' e 'constructor' existem no protótipo: a lista decide, não a busca por propriedade.
  assert.equal(normalizePreferences({ theme: 'constructor' }).theme, 'auto');
});

test('normalizePreferences: velocidade só vale dentro da faixa e como número', () => {
  for (const speed of [0.5, 1, 1.5, 2]) assert.equal(normalizePreferences({ animationSpeed: speed }).animationSpeed, speed);
  for (const speed of [0.49, 2.01, 0, -1, NaN, Infinity, '1', null, undefined]) {
    assert.equal(normalizePreferences({ animationSpeed: speed }).animationSpeed, 1, `velocidade ${String(speed)}`);
  }
  assert.equal(normalizePreferences({}).animationSpeed, 1);
});

test('normalizePreferences: descarta chave desconhecida, não muta a entrada e devolve objeto novo', () => {
  const input = { theme: 'slate', cor: 'vermelho' };
  const snapshot = JSON.stringify(input);
  const result = normalizePreferences(input);
  assert.deepEqual(Object.keys(result), Object.keys(DEFAULT_PREFERENCES));
  assert.equal(result.theme, 'slate');
  assert.equal(JSON.stringify(input), snapshot);
  assert.notEqual(normalizePreferences({}), DEFAULT_PREFERENCES);
  assert.notEqual(normalizePreferences(undefined), DEFAULT_PREFERENCES);
});

test('DEFAULT_PREFERENCES está congelado e cada valor pertence à lista dele', () => {
  assert.ok(Object.isFrozen(DEFAULT_PREFERENCES));
  assert.ok(THEMES.includes(DEFAULT_PREFERENCES.theme));
  assert.ok(SHAPES.includes(DEFAULT_PREFERENCES.shape));
  assert.ok(ANIMATION_STYLES.includes(DEFAULT_PREFERENCES.animationStyle));
  assert.equal(DEFAULT_PREFERENCES.animationSpeed, 1);
  for (const list of [THEMES, SHAPES, ANIMATION_STYLES, EXPAND_ON, OPACITY_LEVELS, ANCHORS, ISLAND_MODES]) {
    assert.ok(Object.isFrozen(list));
  }
  assert.ok(EXPAND_ON.includes(DEFAULT_PREFERENCES.expandOn));
  assert.ok(OPACITY_LEVELS.includes(DEFAULT_PREFERENCES.opacity));
  assert.ok(ANCHORS.includes(DEFAULT_PREFERENCES.anchor));
  assert.ok(ISLAND_MODES.includes(DEFAULT_PREFERENCES.islandMode));
});

test('THEMES tem 9 itens e começa por auto', () => {
  assert.equal(THEMES.length, 9);
  assert.equal(THEMES[0], 'auto');
  assert.deepEqual([...SHAPES], ['pill', 'notch', 'win11']);
  assert.deepEqual([...ANIMATION_STYLES], ['smooth', 'default', 'bouncy', 'snappy']);
});

// Palco da Fase 2, de onde se veio: o deslocamento salvo é relativo à posição padrão, então trocar o
// palco não pode mover a pílula de quem já tem posição salva.
const OLD_WINDOW_SIZE = { width: 440, height: 324 };
const MONITOR_WORK_AREA = { x: 0, y: 0, width: 1920, height: 1040 };

test('positionFromSavedOffset: sem deslocamento válido vale a posição padrão, e nada é mutado', () => {
  const standard = defaultIslandPosition(MONITOR_WORK_AREA, WINDOW_SIZE);
  for (const offset of [undefined, null, { x: 'a', y: 0 }, { x: NaN, y: 0 }, { x: 0 }, { x: Infinity, y: 0 }, 'x', 5, []]) {
    assert.deepEqual(positionFromSavedOffset(MONITOR_WORK_AREA, WINDOW_SIZE, offset), standard, `deslocamento ${JSON.stringify(offset)}`);
  }
  const offset = Object.freeze({ x: 300, y: 120 });
  assert.doesNotThrow(() => positionFromSavedOffset(Object.freeze({ ...MONITOR_WORK_AREA }), WINDOW_SIZE, offset));
  assert.deepEqual({ ...offset }, { x: 300, y: 120 });
});

test('positionFromSavedOffset: trocar o palco preserva o centro horizontal e o topo da pílula', () => {
  const offset = { x: 300, y: 120 };
  const standard = defaultIslandPosition(MONITOR_WORK_AREA, WINDOW_SIZE);
  const position = positionFromSavedOffset(MONITOR_WORK_AREA, WINDOW_SIZE, offset);
  assert.deepEqual(position, { x: standard.x + 300, y: 120 });
  const before = positionFromSavedOffset(MONITOR_WORK_AREA, OLD_WINDOW_SIZE, offset);
  assert.equal(position.x + WINDOW_SIZE.width / 2, before.x + OLD_WINDOW_SIZE.width / 2, 'o centro horizontal andou');
  assert.equal(position.y, before.y, 'o topo andou');
});

test('com o palco novo a pílula expandida ainda encosta nas duas bordas do monitor', () => {
  const clamp = (offset) => clampIslandPosition(
    positionFromSavedOffset(MONITOR_WORK_AREA, WINDOW_SIZE, offset), MONITOR_WORK_AREA, WINDOW_SIZE, HORIZONTAL_SLACK,
  );
  assert.equal(clamp({ x: -5000, y: 0 }).x + HORIZONTAL_SLACK, MONITOR_WORK_AREA.x);
  assert.equal(clamp({ x: 5000, y: 0 }).x + HORIZONTAL_SLACK + 400, MONITOR_WORK_AREA.x + MONITOR_WORK_AREA.width);
});

test('ilha salva na borda de baixo sobe o necessário para a janela caber na área útil (exceção aceita)', () => {
  // 716 = 1040 − 324: o mais baixo que a pílula ia com o palco antigo.
  const saved = positionFromSavedOffset(MONITOR_WORK_AREA, WINDOW_SIZE, { x: 0, y: 716 });
  const clamped = clampIslandPosition(saved, MONITOR_WORK_AREA, WINDOW_SIZE, HORIZONTAL_SLACK);
  assert.equal(clamped.y, MONITOR_WORK_AREA.height - WINDOW_SIZE.height);
  assert.equal(saved.y - clamped.y, WINDOW_SIZE.height - OLD_WINDOW_SIZE.height, 'subiu mais ou menos que o palco cresceu');
  assert.equal(isWithinWorkArea({ ...clamped, ...WINDOW_SIZE }, MONITOR_WORK_AREA, HORIZONTAL_SLACK), true);
});

test('na posição padrão a janela do palco novo está dentro da área útil e a decisão segue aceita', () => {
  const standard = defaultIslandPosition(MONITOR_WORK_AREA, WINDOW_SIZE);
  assert.equal(isWithinWorkArea({ ...standard, ...WINDOW_SIZE }, MONITOR_WORK_AREA, HORIZONTAL_SLACK), true);
});

test('só arquivo de sessão entra na leitura da pasta: o preferences.json nunca vira sessão fantasma', () => {
  assert.equal(isSessionFile('abc-123.json'), true);
  assert.equal(isSessionFile('preferences.json'), false);
  assert.equal(isSessionFile('.heartbeat'), false);
  assert.equal(isSessionFile('abc.json.tmp'), false);
  assert.equal(isSessionFile('preferences.json.bad'), false);
  assert.equal(isSessionFile('preferences.json.tmp'), false);
  assert.equal(isSessionFile('preferences.json.1732200000000.bad'), false);
  assert.equal(isSessionFile(undefined), false);
});

// ---- Âncoras (D-13) ----

// Segundo monitor a 125%, à esquerda do principal, medido na pesquisa da Fase 4.
const SECONDARY_125_WORK_AREA = { x: -1536, y: 0, width: 1536, height: 824 };
const BOTH_WORK_AREAS = [MONITOR_WORK_AREA, SECONDARY_125_WORK_AREA];

test('anchorPosition: topo centro é a posição padrão nos dois monitores e âncora inválida vale topo centro', () => {
  for (const workArea of BOTH_WORK_AREAS) {
    const standard = defaultIslandPosition(workArea, WINDOW_SIZE);
    assert.deepEqual(anchorPosition('top-center', workArea, WINDOW_SIZE), standard);
    for (const anchor of ['meio', undefined, null, 'constructor', '__proto__', 7]) {
      assert.deepEqual(anchorPosition(anchor, workArea, WINDOW_SIZE), standard, String(anchor));
    }
  }
});

test('anchorPosition: a pílula fica a 16 px da lateral e a 40 px da base, com a margem da sombra no palco', () => {
  for (const workArea of BOTH_WORK_AREAS) {
    for (const anchor of ANCHORS) {
      const { x, y } = anchorPosition(anchor, workArea, WINDOW_SIZE);
      if (anchor.endsWith('-left')) assert.equal(x + STAGE_SHADOW_PX, workArea.x + ANCHOR_SIDE_GAP_PX, anchor);
      if (anchor.endsWith('-right')) {
        assert.equal(x + WINDOW_SIZE.width - STAGE_SHADOW_PX, workArea.x + workArea.width - ANCHOR_SIDE_GAP_PX, anchor);
      }
      if (anchor.startsWith('top-')) assert.equal(y, workArea.y, anchor);
      if (anchor.startsWith('bottom-')) {
        assert.equal(y + WINDOW_SIZE.height - STAGE_SHADOW_PX, workArea.y + workArea.height - ANCHOR_BOTTOM_GAP_PX, anchor);
      }
    }
  }
});

test('horizontalSlackFor: centro e inválida 60/60, esquerda 20/100, direita 100/20, e a soma com a expandida é o palco', () => {
  for (const anchor of ['top-center', 'bottom-center', 'meio', undefined, null, 'constructor']) {
    assert.deepEqual({ ...horizontalSlackFor(anchor) }, { left: 60, right: 60 }, String(anchor));
  }
  for (const anchor of ['top-left', 'bottom-left']) assert.deepEqual({ ...horizontalSlackFor(anchor) }, { left: 20, right: 100 });
  for (const anchor of ['top-right', 'bottom-right']) assert.deepEqual({ ...horizontalSlackFor(anchor) }, { left: 100, right: 20 });
  for (const anchor of ANCHORS) {
    const { left, right } = horizontalSlackFor(anchor);
    assert.equal(left + EXPANDED_PILL_WIDTH_PX + right, WINDOW_SIZE.width, anchor);
  }
  assert.notEqual(horizontalSlackFor('top-left'), horizontalSlackFor('top-left'), 'sempre um objeto novo');
});

test('a posição de cada âncora está dentro da área útil e o clamp a devolve intacta, nos dois monitores', () => {
  for (const workArea of BOTH_WORK_AREAS) {
    for (const anchor of ANCHORS) {
      const position = anchorPosition(anchor, workArea, WINDOW_SIZE);
      const slack = horizontalSlackFor(anchor);
      assert.equal(isWithinWorkArea({ ...position, ...WINDOW_SIZE }, workArea, slack), true, anchor);
      assert.deepEqual(clampIslandPosition(position, workArea, WINDOW_SIZE, slack), position, anchor);
    }
  }
});

test('a pílula de canto nunca sai da tela: o clamp a prende e o gate recusa a janela além da folga', () => {
  const workArea = MONITOR_WORK_AREA;
  const right = workArea.x + workArea.width;
  const clampFor = (anchor, x) => clampIslandPosition({ x, y: 0 }, workArea, WINDOW_SIZE, horizontalSlackFor(anchor));
  // A pílula expandida é a janela menos a margem da sombra do lado ancorado.
  assert.equal(clampFor('top-left', -5000).x + STAGE_SHADOW_PX, workArea.x);
  assert.equal(clampFor('top-left', 5000).x + STAGE_SHADOW_PX + EXPANDED_PILL_WIDTH_PX, right);
  assert.equal(clampFor('top-right', -5000).x + WINDOW_SIZE.width - STAGE_SHADOW_PX - EXPANDED_PILL_WIDTH_PX, workArea.x);
  assert.equal(clampFor('top-right', 5000).x + WINDOW_SIZE.width - STAGE_SHADOW_PX, right);

  const left = horizontalSlackFor('top-left');
  assert.equal(isWithinWorkArea({ x: workArea.x - left.left, y: 0, ...WINDOW_SIZE }, workArea, left), true);
  assert.equal(isWithinWorkArea({ x: workArea.x - left.left - 3, y: 0, ...WINDOW_SIZE }, workArea, left), false);
  const mirror = horizontalSlackFor('top-right');
  const edgeX = right - WINDOW_SIZE.width + mirror.right;
  assert.equal(isWithinWorkArea({ x: edgeX, y: 0, ...WINDOW_SIZE }, workArea, mirror), true);
  assert.equal(isWithinWorkArea({ x: edgeX + 3, y: 0, ...WINDOW_SIZE }, workArea, mirror), false);
});

test('positionFromSavedOffset com âncora soma o deslocamento à posição dela; sem âncora segue o topo centro', () => {
  const offset = { x: 30, y: 12 };
  for (const anchor of ANCHORS) {
    const base = anchorPosition(anchor, MONITOR_WORK_AREA, WINDOW_SIZE);
    assert.deepEqual(positionFromSavedOffset(MONITOR_WORK_AREA, WINDOW_SIZE, offset, anchor), { x: base.x + 30, y: base.y + 12 }, anchor);
    assert.deepEqual(positionFromSavedOffset(MONITOR_WORK_AREA, WINDOW_SIZE, undefined, anchor), base, `${anchor} sem deslocamento`);
  }
  assert.deepEqual(
    positionFromSavedOffset(MONITOR_WORK_AREA, WINDOW_SIZE, offset),
    positionFromSavedOffset(MONITOR_WORK_AREA, WINDOW_SIZE, offset, 'top-center'),
  );
});

test('isWithinWorkArea com folga em objeto: lado ausente, NaN ou texto devolve false; número vale nos dois lados', () => {
  const bounds = { ...anchorPosition('top-left', MONITOR_WORK_AREA, WINDOW_SIZE), ...WINDOW_SIZE };
  assert.equal(isWithinWorkArea(bounds, MONITOR_WORK_AREA, { left: 20, right: 100 }), true);
  for (const slack of [{ left: 20 }, { right: 100 }, { left: NaN, right: 100 }, { left: '20', right: 100 }, '20', null, {}]) {
    assert.equal(isWithinWorkArea(bounds, MONITOR_WORK_AREA, slack), false, JSON.stringify(slack));
  }
  assert.equal(isWithinWorkArea({ ...bounds, x: -60 }, MONITOR_WORK_AREA, 60), true, 'número vale para os dois lados, como hoje');
});

// ---- Uma ilha só (D-15) ----

test('islandDisplays: uma por monitor, modo desconhecido ou ausente e entrada inválida', () => {
  const base = { displayIds: [3, 1, 2], primaryId: 1, cursorDisplayId: 2, currentIds: [], hasPermission: false };
  for (const mode of ['perDisplay', 'per-display', 'x', undefined, null, 'constructor']) {
    assert.deepEqual(islandDisplays({ ...base, mode }), [3, 1, 2], String(mode));
  }
  assert.deepEqual(islandDisplays({ ...base, mode: 'perDisplay', displayIds: [1, 'a', 2, NaN, null] }), [1, 2]);
  for (const displayIds of [[], undefined, null, 'ab', 7, {}, ['a', 'b']]) {
    for (const mode of ['perDisplay', 'primary', 'cursor']) assert.deepEqual(islandDisplays({ ...base, mode, displayIds }), [], `${mode} ${JSON.stringify(displayIds)}`);
  }
  assert.deepEqual(islandDisplays(null), []);
  assert.deepEqual(islandDisplays(undefined), []);
});

test("islandDisplays: 'primary' é só o monitor principal, ou o primeiro se ele não está na lista", () => {
  const base = { mode: 'primary', displayIds: [3, 1, 2], cursorDisplayId: 2, currentIds: [2], hasPermission: false };
  assert.deepEqual(islandDisplays({ ...base, primaryId: 1 }), [1]);
  assert.deepEqual(islandDisplays({ ...base, primaryId: 9 }), [3]);
  assert.deepEqual(islandDisplays({ ...base, primaryId: undefined }), [3]);
});

test("islandDisplays: 'cursor' sem pedido na tela segue o cursor, e cursor fora da lista vale o principal", () => {
  const base = { mode: 'cursor', displayIds: [1, 2], primaryId: 1, currentIds: [1], hasPermission: false };
  assert.deepEqual(islandDisplays({ ...base, cursorDisplayId: 2 }), [2]);
  assert.deepEqual(islandDisplays({ ...base, cursorDisplayId: 1 }), [1]);
  assert.deepEqual(islandDisplays({ ...base, cursorDisplayId: 9 }), [1]);
  assert.deepEqual(islandDisplays({ ...base, cursorDisplayId: undefined, primaryId: 2 }), [2]);
});

test("islandDisplays: 'cursor' com pedido na tela, ou sem saber, nunca troca de monitor (T-04-10)", () => {
  const base = { mode: 'cursor', displayIds: [1, 2], primaryId: 1, cursorDisplayId: 1, currentIds: [2] };
  assert.deepEqual(islandDisplays({ ...base, hasPermission: true }), [2], 'com pedido, fica onde está');
  for (const hasPermission of [undefined, null, 'false', 0, 1, 'true']) {
    assert.deepEqual(islandDisplays({ ...base, hasPermission }), [2], `fato desconhecido ${String(hasPermission)}`);
  }
  assert.deepEqual(islandDisplays({ ...base, hasPermission: true, currentIds: [1, 2], cursorDisplayId: 2 }), [2], 'vinda de uma por monitor, fica no do cursor');
  assert.deepEqual(islandDisplays({ ...base, hasPermission: true, currentIds: [1, 2], cursorDisplayId: 9 }), [1], 'cursor fora da lista cai no principal');
  assert.deepEqual(islandDisplays({ ...base, hasPermission: true, currentIds: [9] }), [1], 'o monitor dela saiu: segue o cursor');
  assert.deepEqual(islandDisplays({ ...base, hasPermission: true, currentIds: [] }), [1], 'sem ilha ainda: segue o cursor');
  assert.deepEqual(islandDisplays({ ...base, hasPermission: true, currentIds: undefined }), [1]);
});

test('islandDisplays não muta a entrada e devolve sempre um array novo', () => {
  const input = Object.freeze({
    mode: 'perDisplay', displayIds: Object.freeze([1, 2]), primaryId: 1, cursorDisplayId: 2, currentIds: Object.freeze([1, 2]), hasPermission: false,
  });
  const first = islandDisplays(input);
  assert.notEqual(first, input.displayIds);
  assert.notEqual(first, islandDisplays(input));
  assert.deepEqual(input.displayIds, [1, 2]);
  assert.notEqual(islandDisplays({ mode: 'cursor', displayIds: [1], currentIds: [1], hasPermission: true }), islandDisplays({ mode: 'cursor', displayIds: [1], currentIds: [1], hasPermission: true }));
});

// D-12/D-19: o atalho não vence a tela cheia; entrada inválida esconde (lado seguro).
test('isIslandVisible só mostra com o usuário não escondendo e sem tela cheia', () => {
  assert.equal(isIslandVisible({ userHidden: false, covered: false }), true);
  assert.equal(isIslandVisible({ userHidden: true, covered: false }), false);
  assert.equal(isIslandVisible({ userHidden: false, covered: true }), false);
  assert.equal(isIslandVisible({ userHidden: true, covered: true }), false);
  assert.equal(isIslandVisible({ userHidden: false }), false);
  assert.equal(isIslandVisible({ covered: false }), false);
  assert.equal(isIslandVisible({ userHidden: 'false', covered: 0 }), false);
  assert.equal(isIslandVisible(null), false);
  assert.equal(isIslandVisible(), false);
});

test('nextUserHidden inverte, exceto quando toda ilha está coberta por tela cheia', () => {
  const next = (userHidden, displayIds, coveredDisplayIds) => nextUserHidden({ userHidden, displayIds, coveredDisplayIds });
  assert.equal(next(false, [1, 2], []), true);
  assert.equal(next(true, [1, 2], []), false);
  // uma coberta e outra não: inverte normalmente (a coberta segue escondida pela tela cheia)
  assert.equal(next(false, [1, 2], [1]), true);
  assert.equal(next(true, [1, 2], [1]), false);
  // todas cobertas: o atalho não faz nada
  assert.equal(next(false, [1, 2], [1, 2]), false);
  assert.equal(next(true, [1, 2], [2, 1]), true);
  assert.equal(next(false, [1], [1]), false);
  // entradas fora do contrato
  assert.equal(next(false, [], []), false);
  assert.equal(next(true, [], []), true);
  assert.equal(next('true', [1], []), true);
  assert.equal(next(false, [1], 'x'), true);
  assert.equal(next(false, 'x', [1]), false);
  assert.equal(nextUserHidden(null), false);
  assert.equal(nextUserHidden(), false);
  const ids = [1, 2];
  const covered = [1];
  next(false, ids, covered);
  assert.deepEqual([ids, covered], [[1, 2], [1]]);
});

// D-18: a regra do primeiro plano em tela cheia, pura; o sensor que a alimentaria ainda não existe (D-20).
test('nextFullscreen marca e solta o monitor coberto pelo primeiro plano', () => {
  const A = { id: 1, rect: { left: 0, top: 0, right: 2560, bottom: 1080 } };
  const B = { id: 2, rect: { left: -1920, top: 0, right: 0, bottom: 1080 } };
  const displays = [A, B];
  const base = {
    hwnd: 100, className: 'Chrome_WidgetWin_1', pid: 4321, exStyle: 0,
    visible: true, minimized: false, cloaked: false, clientRect: A.rect, monitorRect: A.rect,
  };
  const run = (foreground, previous = new Map(), gone = [], shown = displays) => (
    [...nextFullscreen({ previous, probe: { foreground, gone }, ownPid: 999, displays: shown })]
  );
  const covered = new Map([[1, 100]]);
  const inset = (px) => ({
    left: px, top: px, right: A.rect.right - px, bottom: A.rect.bottom - px,
  });

  assert.deepEqual(run(base), [[1, 100]]);
  assert.deepEqual(run({ ...base, clientRect: inset(1) }), [[1, 100]]);
  assert.deepEqual(run({ ...base, clientRect: inset(2) }), []);
  const maximized = { left: 18, top: 97, right: 2542, bottom: 1002 };
  assert.deepEqual(run({ ...base, clientRect: maximized }), []);
  assert.deepEqual(run({ ...base, clientRect: maximized }, covered), []);
  // o próprio pid não marca nem solta
  assert.deepEqual(run({ ...base, pid: 999 }), []);
  assert.deepEqual(run({ ...base, pid: 999 }, covered), [[1, 100]]);
  // área de trabalho e barras de tarefas cobrem o monitor sem ser app em tela cheia
  for (const className of ['Progman', 'WorkerW', 'Shell_TrayWnd', 'Shell_SecondaryTrayWnd']) {
    assert.deepEqual(run({ ...base, className }), [], className);
    assert.deepEqual(run({ ...base, className }, covered), [], className);
  }
  // janela que não conta como primeiro plano: o mapa não muda
  for (const odd of [{ visible: false }, { minimized: true }, { cloaked: true }, { cloaked: null }, { exStyle: 0x20 }, { exStyle: 0x80020 }]) {
    assert.deepEqual(run({ ...base, ...odd }, covered), [[1, 100]], JSON.stringify(odd));
    assert.deepEqual(run({ ...base, ...odd }), [], JSON.stringify(odd));
  }
  // primeiro plano comum em outro monitor: A continua lembrado
  const onB = { ...base, hwnd: 200, clientRect: maximized, monitorRect: B.rect };
  assert.deepEqual(run(onB, covered), [[1, 100]]);
  // tela cheia em B soma-se a A
  assert.deepEqual(run({ ...base, hwnd: 200, clientRect: B.rect, monitorRect: B.rect }, covered), [[1, 100], [2, 200]]);
  // o HWND sumiu
  assert.deepEqual(run(null, covered, [100]), []);
  assert.deepEqual(run(null, covered, [999]), [[1, 100]]);
  // monitorRect que não bate com nenhum monitor; monitor que saiu
  assert.deepEqual(run({ ...base, monitorRect: { left: 5, top: 0, right: 2565, bottom: 1080 } }, covered), [[1, 100]]);
  assert.deepEqual(run(null, covered, [], [B]), []);
  // entradas fora do contrato: nunca lança nem muta
  assert.deepEqual([...nextFullscreen({ previous: covered, probe: null, ownPid: 999, displays })], [[1, 100]]);
  assert.deepEqual([...nextFullscreen({ previous: 'x', probe: { foreground: base, gone: [] }, ownPid: 999, displays })], [[1, 100]]);
  assert.deepEqual(run({ ...base, hwnd: '100' }, covered), [[1, 100]]);
  assert.deepEqual([...nextFullscreen(null)], []);
  assert.deepEqual([...nextFullscreen()], []);
  assert.deepEqual([...covered], [[1, 100]]);
  assert.notEqual(nextFullscreen({ previous: covered, probe: null, ownPid: 999, displays }), covered);
});

// --- Fase 5: várias sessões ---

const PEDIDO_A = '11111111-1111-4111-8111-111111111111';
const PEDIDO_B = '22222222-2222-4222-8222-222222222222';
const pedidoValido = (id) => ({ id, tool: 'Bash', text: 'ls -la' });

test('sessionList devolve as vivas na ordem de primeira aparição, com a forma exata', () => {
  const now = 1_000_000_000;
  const list = sessionList([
    { key: 'b', firstSeenAt: 200, state: 'running', updatedAt: now, windowPid: 4242, project: 'x' },
    { key: 'a', firstSeenAt: 100, state: 'done', updatedAt: now - 1_000 },
    { key: 'c', firstSeenAt: 100, state: 'waiting', updatedAt: now - 60_000, permission: pedidoValido(PEDIDO_A) },
  ], now);
  // empate de primeira aparição: a chave desempata; a ordem nunca segue urgência nem recência
  assert.deepEqual(list, [
    { key: 'a', state: 'done', updatedAt: now - 1_000, permissionId: null },
    { key: 'c', state: 'waiting', updatedAt: now - 60_000, permissionId: PEDIDO_A },
    { key: 'b', state: 'running', updatedAt: now, permissionId: null },
  ]);
  // sem firstSeenAt válido a sessão vai para o fim
  assert.deepEqual(sessionList([
    { key: 'z', state: 'running', updatedAt: now },
    { key: 'y', firstSeenAt: 5, state: 'running', updatedAt: now },
  ], now).map((entry) => entry.key), ['y', 'z']);
});

test('sessionList filtra as expiradas e só dá permissionId a um pedido válido em waiting', () => {
  const now = 1_000_000_000;
  const alive = (extra) => ({ key: 'k', firstSeenAt: 1, updatedAt: now, ...extra });
  assert.deepEqual(sessionList([
    alive({ key: 'd', state: 'done', updatedAt: now - 10_000 }),
    alive({ key: 'r', state: 'running', updatedAt: now - 3 * 60 * 60_000 }),
    alive({ key: 'w', state: 'waiting', updatedAt: now - 13 * 60 * 60_000 }),
    alive({ key: 'u', state: 'desconhecido' }),
  ], now), []);
  const invalid = [
    { id: 'ABCDEF12-1111-4111-8111-111111111111', tool: 'Bash', text: 'ls' },
    { id: PEDIDO_A, tool: 'Bash', text: 'ls‮' },
    { id: PEDIDO_A, tool: 'Bash', text: '' },
  ];
  for (const permission of invalid) {
    assert.equal(sessionList([alive({ state: 'waiting', permission })], now)[0].permissionId, null, JSON.stringify(permission));
  }
  assert.equal(sessionList([alive({ state: 'running', permission: pedidoValido(PEDIDO_A) })], now)[0].permissionId, null);
  for (const notArray of [undefined, null, 'x', {}, 3]) assert.deepEqual(sessionList(notArray, now), []);
});

test('nextSelection select aceita só um índice inteiro dentro da lista', () => {
  const list = [{ key: 'a', state: 'running', updatedAt: 1 }, { key: 'b', state: 'done', updatedAt: 1 }, { key: 'c', state: 'waiting', updatedAt: 1 }];
  const selection = { key: 'a', requests: [{ id: PEDIDO_A, seenAt: 1, handled: false }] };
  const chosen = nextSelection(selection, list, { type: 'select', index: 2 });
  assert.equal(chosen.key, 'c');
  assert.equal(chosen.snapped, false);
  assert.deepEqual(chosen.requests, selection.requests);
  assert.notEqual(chosen.requests, selection.requests);
  assert.notEqual(chosen.requests[0], selection.requests[0]);
  for (const index of [3, -1, 1.5, '1', NaN, undefined, null, Infinity]) {
    assert.equal(nextSelection(selection, list, { type: 'select', index }).key, 'a', String(index));
  }
  // evento ausente ou desconhecido mantém tudo
  for (const event of [undefined, null, {}, { type: 'outro' }, 'poll']) {
    assert.equal(nextSelection(selection, list, event).key, 'a');
  }
  assert.equal(nextSelection(selection, [], { type: 'select', index: 0 }).key, 'a');
});

test('nextSelection poll mantém a sessão exibida e só vai à vizinha quando ela sai (SESS-06)', () => {
  const entry = (key, state, updatedAt = 1) => ({ key, state, updatedAt });
  const poll = (key, list, previousKeys) => nextSelection({ key, requests: [] }, list, { type: 'poll', previousKeys });
  // a exibida fica mesmo com outra mais recente, concluída ou esperando
  assert.equal(poll('a', [entry('a', 'running', 1), entry('b', 'running', 99)], ['a', 'b']).key, 'a');
  assert.equal(poll('a', [entry('a', 'running'), entry('b', 'waiting')], ['a', 'b']).key, 'a');
  assert.equal(poll('a', [entry('a', 'done'), entry('b', 'running')], ['a', 'b']).key, 'a');
  // saiu de fato: a anterior na ordem estável, nunca a mais urgente
  assert.equal(poll('a', [entry('x', 'running'), entry('b', 'waiting')], ['x', 'a', 'b']).key, 'x');
  // era a primeira: a seguinte
  assert.equal(poll('a', [entry('b', 'running'), entry('c', 'waiting')], ['a', 'b', 'c']).key, 'b');
  // a anterior também saiu: a mais próxima que sobrou
  assert.equal(poll('a', [entry('b', 'running')], ['x', 'a', 'b']).key, 'b');
  // previousKeys sem a chave: a primeira da lista
  assert.equal(poll('a', [entry('p', 'done'), entry('q', 'waiting')], ['p', 'q']).key, 'p');
  assert.equal(poll('a', [entry('p', 'done'), entry('q', 'waiting')], undefined).key, 'p');
  // lista vazia
  assert.equal(poll('a', [], ['a']).key, null);
  // sem sessão exibida: urgência, depois a mais recente
  const list = [entry('a', 'done', 9), entry('b', 'running', 5), entry('c', 'running', 8), entry('d', 'waiting', 1)];
  assert.equal(poll(null, list, []).key, 'd');
  assert.equal(poll(null, list.slice(0, 3), []).key, 'c');
  assert.equal(nextSelection(null, list, { type: 'poll', previousKeys: [] }).key, 'd');
  assert.equal(nextSelection({ requests: [] }, list, { type: 'poll', previousKeys: [] }).key, 'd');
  assert.deepEqual(nextSelection('lixo', [], { type: 'poll' }), { key: null, requests: [], snapped: false });
  // nunca muta a entrada
  const selection = { key: 'a', requests: [{ id: PEDIDO_A, seenAt: 1, handled: false }] };
  const copy = JSON.parse(JSON.stringify(selection));
  const listCopy = JSON.parse(JSON.stringify(list));
  nextSelection(selection, list, { type: 'poll', previousKeys: ['a'] });
  assert.deepEqual(selection, copy);
  assert.deepEqual(list, listCopy);
});

test('pickState com seleção exibe a sessão escolhida e descreve os pontos', () => {
  const now = 1_000_000_000;
  const sessions = [
    { key: 'a', firstSeenAt: 1, state: 'waiting', project: 'pa', updatedAt: now, permission: pedidoValido(PEDIDO_A) },
    { key: 'b', firstSeenAt: 2, state: 'running', project: 'pb', updatedAt: now - 5_000 },
    { key: 'c', firstSeenAt: 3, state: 'done', project: 'pc', updatedAt: now - 1_000 },
  ];
  const picked = pickState(sessions, now, { key: 'b', requests: [] });
  assert.equal(picked.project, 'pb');
  assert.equal(picked.state, 'running');
  assert.equal(picked.count, 3);
  assert.deepEqual(picked.sessions, [
    { state: 'waiting', pending: true, current: false },
    { state: 'running', pending: false, current: true },
    { state: 'done', pending: false, current: false },
  ]);
  assert.equal(picked.queue, null);
  // sem seleção ou com chave desconhecida: urgência, como antes
  assert.equal(pickState(sessions, now).project, 'pa');
  assert.equal(pickState(sessions, now, { key: 'nao-existe', requests: [] }).project, 'pa');
  assert.equal(pickState(sessions, now, null).project, 'pa');
  // a ordem dos pontos não segue a urgência: sessão sem firstSeenAt vai para o fim
  assert.deepEqual(
    pickState([{ state: 'done', updatedAt: now }, { key: 'k', firstSeenAt: 1, state: 'running', updatedAt: now }], now).sessions.map((s) => s.state),
    ['running', 'done'],
  );
  // pedido pendente que não é válido não pulsa
  const invalid = pickState([{ key: 'k', firstSeenAt: 1, state: 'waiting', updatedAt: now, permission: { id: 'x', tool: 'Bash', text: 'ls' } }], now);
  assert.equal(invalid.sessions[0].pending, false);
  // fila: pedido exibido entre os que a seleção conhece
  const requests = [{ id: PEDIDO_B, seenAt: 2, handled: true }, { id: PEDIDO_A, seenAt: 1, handled: true }];
  assert.deepEqual(pickState(sessions, now, { key: 'a', requests }).queue, { position: 1, total: 2 });
  assert.deepEqual(pickState(
    [{ ...sessions[0], permission: pedidoValido(PEDIDO_B) }], now, { key: 'a', requests },
  ).queue, { position: 2, total: 2 });
  assert.equal(pickState(sessions, now, { key: 'a', requests: [requests[1]] }).queue, null);
  assert.equal(pickState(sessions, now, { key: 'b', requests }).queue, null);
});

test('o payload do estado não leva chave, PID nem texto de outra sessão (D-09)', () => {
  const now = 1_000_000_000;
  const sessions = [
    { key: 'sessao-exibida', firstSeenAt: 1, state: 'running', project: 'p', windowPid: 111, updatedAt: now },
    {
      key: 'sessao-oculta', firstSeenAt: 2, state: 'waiting', project: 'q', windowPid: 4242, updatedAt: now,
      permission: { id: PEDIDO_B, tool: 'Bash', text: 'segredo-da-outra' },
    },
  ];
  const json = JSON.stringify(pickState(sessions, now, { key: 'sessao-exibida', requests: [] }));
  for (const forbidden of ['sessao-oculta', 'sessao-exibida', '4242', 'segredo-da-outra', PEDIDO_B]) {
    assert.ok(!json.includes(forbidden), forbidden);
  }
});

test('a sessão exibida não troca sozinha, e quando sai a ilha vai à vizinha (SESS-06)', () => {
  const now = 1_000_000_000;
  const base = (key, firstSeenAt, state, updatedAt) => ({ key, firstSeenAt, state, updatedAt, project: key });
  let selection = { key: null, requests: [] };
  let previousKeys = [];
  const step = (sessions) => {
    const list = sessionList(sessions, now);
    selection = nextSelection(selection, list, { type: 'poll', previousKeys });
    previousKeys = list.map((entry) => entry.key);
    return pickState(sessions, now, selection).project;
  };
  const a = base('A', 1, 'running', now - 3_000);
  assert.equal(step([a]), 'A');
  // B conclui: A continua
  assert.equal(step([a, base('B', 2, 'done', now)]), 'A');
  // B volta a trabalhar, mais recente
  assert.equal(step([a, base('B', 2, 'running', now)]), 'A');
  // C aparece em waiting, a mais urgente
  assert.equal(step([a, base('B', 2, 'running', now), base('C', 3, 'waiting', now)]), 'A');
  // A sai: a vizinha na ordem estável (A era a primeira, vai a B), não a C que é mais urgente
  assert.equal(step([base('B', 2, 'running', now), base('C', 3, 'waiting', now)]), 'B');
  // a exibida (B) sai de novo: a anterior que sobrou não existe, vai à seguinte
  assert.equal(step([base('C', 3, 'waiting', now)]), 'C');
});

test('hook.js e permission-hook.js seguem gravando o projeto pela pasta da sessão (D-01)', () => {
  const hook = fs.readFileSync(path.join(__dirname, 'hook.js'), 'utf8');
  const permissionHook = fs.readFileSync(path.join(__dirname, 'permission-hook.js'), 'utf8');
  assert.ok(hook.includes("path.basename(input.cwd || '') || 'Claude'"));
  assert.ok(permissionHook.includes("previous.project || path.basename(input.cwd || '') || 'Claude'"));
});
