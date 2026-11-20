const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  eventToState, pickState, contextUsage, defaultIslandPosition, clampIslandPosition,
  keepsPermission, permissionRequest, validPermission, decisionOutput, isHeartbeatFresh, PERMISSION_TEXT_LIMIT,
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
