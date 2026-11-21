const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  eventToState, pickState, contextUsage, defaultIslandPosition, clampIslandPosition,
  keepsPermission, permissionRequest, validPermission, decisionOutput, isHeartbeatFresh, PERMISSION_TEXT_LIMIT,
  normalizePreferences, DEFAULT_PREFERENCES, THEMES, SHAPES, ANIMATION_STYLES, isSessionFile,
  WINDOW_SIZE, HORIZONTAL_SLACK, isWithinWorkArea, positionFromSavedOffset,
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
  assert.deepEqual(picked, { state: 'waiting', detail: 'Permissão', project: 'b', count: 3, windowPid: 4242, context: null, permission: null });

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
  assert.deepEqual(normalizePreferences(valid), valid);
});

test('normalizePreferences: cada chave inválida cai sozinha no padrão', () => {
  const valid = { theme: 'nord', shape: 'notch', animationStyle: 'bouncy', animationSpeed: 2 };
  assert.deepEqual(normalizePreferences({ ...valid, theme: 'NORD' }), { ...valid, theme: 'auto' });
  assert.deepEqual(normalizePreferences({ ...valid, shape: 3 }), { ...valid, shape: 'pill' });
  assert.deepEqual(normalizePreferences({ ...valid, animationStyle: 'elastico' }), { ...valid, animationStyle: 'default' });
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
  const input = { theme: 'slate', opacity: 0.5 };
  const snapshot = JSON.stringify(input);
  const result = normalizePreferences(input);
  assert.deepEqual(Object.keys(result).sort(), ['animationSpeed', 'animationStyle', 'shape', 'theme']);
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
  for (const list of [THEMES, SHAPES, ANIMATION_STYLES]) assert.ok(Object.isFrozen(list));
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
  assert.equal(isSessionFile(undefined), false);
});
