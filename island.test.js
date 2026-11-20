const test = require('node:test');
const assert = require('node:assert/strict');
const { eventToState, pickState, defaultIslandPosition, clampIslandPosition } = require('./state');
const { applyHooks, COMMAND } = require('./install');

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
  assert.deepEqual(picked, { state: 'waiting', detail: 'Permissão', project: 'b', count: 3, windowPid: 4242 });

  // PID ausente ou adulterado no arquivo de estado: a ilha fica sem botão, não com PID inválido
  for (const windowPid of [undefined, null, '4242; calc', 1.5, -3]) {
    assert.equal(pickState([{ state: 'running', windowPid, updatedAt: now }], now).windowPid, null);
  }

  // empate de prioridade: vence a mais recente
  assert.equal(pickState([
    { state: 'running', project: 'velha', updatedAt: now - 5_000 },
    { state: 'running', project: 'nova', updatedAt: now },
  ], now).project, 'nova');

  assert.equal(pickState([{ state: 'done', updatedAt: now - 7_000 }], now).state, 'idle');
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

test('instalar preserva hooks alheios, é idempotente e desinstalar limpa', () => {
  const foreign = { matcher: '', hooks: [{ type: 'command', command: 'node notify.js' }] };
  const original = { model: 'x', hooks: { Stop: [foreign], SessionStart: [foreign] } };

  const installed = applyHooks(applyHooks(original, true), true);
  assert.equal(installed.model, 'x');
  assert.deepEqual(installed.hooks.SessionStart, [foreign]);
  assert.deepEqual(installed.hooks.Stop, [foreign, { matcher: '', hooks: [{ type: 'command', command: COMMAND }] }]);
  assert.equal(installed.hooks.PreToolUse.length, 1);

  assert.deepEqual(applyHooks(installed, false), original);
});
