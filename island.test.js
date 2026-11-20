const test = require('node:test');
const assert = require('node:assert/strict');
const { eventToState, pickState } = require('./state');
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
