---
last_mapped_commit: 75d1a08eaa84174fda8d1cb27a0d18392b854fd1
last_mapped_at: 2026-11-20
---
# Testing Patterns

**Analysis Date:** 2026-11-20

## Test Framework

**Runner:**
- Node.js built-in test runner (`node:test`), no third-party runner
- Config: none. The runner is invoked with defaults from `package.json` (`"test": "node --test"`)
- Node version is not pinned in the repo (no `.nvmrc`, no `engines` field). `node:test` requires Node 18+

**Assertion Library:**
- `node:assert/strict` (imported as `assert` in `island.test.js` line 2). Strict mode means `assert.equal` is `strictEqual` and `assert.deepEqual` is `deepStrictEqual`
- Used methods in practice: `assert.equal`, `assert.deepEqual`, `assert.notEqual`, `assert.match`

**Run Commands:**
```bash
pnpm test                # Run all tests (runs `node --test`)
node --test              # Same, directly
node --test island.test.js   # Run only the single test file
pnpm hooks:install       # Not a test, but exercises install.js applyHooks on the real settings file
```
- Watch mode: not configured. Node supports `node --test --watch`, which works with this setup but is not documented in the repo
- Coverage: not configured (no `--experimental-test-coverage` flag in the script)

## Test File Organization

**Location:**
- Single test file at the repository root, next to the modules it tests: `island.test.js`
- No `__tests__/` or `test/` directory exists. Do not create one unless the number of test files grows; the current convention is root-level

**Naming:**
- `<name>.test.js`. The file name is the application name, not a module name, so a second test file should be named after the module it covers (for example `window.test.js`) and placed beside it

**Structure:**
```
claude-island/
├── state.js            # pure logic, tested in island.test.js
├── install.js          # applyHooks tested in island.test.js
├── island.test.js      # all tests currently in the repo
├── hook.js             # not directly tested
├── permission-hook.js  # not directly tested
├── window.js           # not tested
├── main.js             # not tested
└── preload.js          # not tested
```

## Test Structure

**Suite Organization:**
- No `describe` blocks. Each behavior is a top-level `test(name, fn)` call
- Test names are full pt-BR sentences that state the behavior, not the function name:
```js
test('eventos do Claude Code viram estados da ilha', () => { ... });
test('a ilha mostra a sessão mais urgente e expira as antigas', () => { ... });
test('a ilha arrastada fica dentro da área útil do monitor dela', () => { ... });
test('o anel de contexto muda de faixa em 50% e 80% e rejeita valores inválidos', () => { ... });
test('instalar preserva hooks alheios, é idempotente e desinstalar limpa', () => { ... });
```
- One test covers one feature area and usually contains many assertions. Each assertion that matters is preceded by a short pt-BR comment when its reason is not obvious

**Patterns:**
- Setup: a `const now = 1_000_000_000;` fixed timestamp at the top of the test, passed into time-dependent functions. No fake timers
- Shared fixtures are declared inside the test that uses them (`const permission = { id: '3f2b8c1e-...', tool: 'Bash', text: 'node escreve.js' };`). There is no shared fixture module
- Local helper closures reduce repetition within a test:
```js
const bash = (command) => permissionRequest({ tool_name: 'Bash', tool_input: { command, description: 'd' } });
const clamp = (position) => clampIslandPosition(position, workArea, windowSize, 20);
```
- Teardown: none needed. Tests are pure; `applyHooks` returns a new object and never touches the disk
- Assertion style: one `assert.*` call per expected output. Multiple calls per test are normal

**Table-driven loops for invalid input (the dominant pattern):**
```js
for (const invalid of [undefined, null, '25', NaN, Infinity]) assert.equal(contextUsage(invalid), null);

for (const deceptive of ['echo ok\r', 'a\x1b[2Kb', 'a‮b', 'a​b', 'a b']) {
  assert.equal(bash(deceptive), null);
}
```
Use this form for "rejects everything in this list" checks. Put the list inline; do not create a separate fixture file.

**Boundary testing:**
- Numeric thresholds are tested on both sides of the boundary: `isHeartbeatFresh(now - 6_000, now)` is `true` and `now - 6_001` is `false`; `contextUsage(49.4)` is `ok` and `contextUsage(50)` is `warn`
- Length limits are tested at `LIMIT` (accepted) and `LIMIT + 1` (rejected): `PERMISSION_TEXT_LIMIT` in `island.test.js`
- Import the limit constant instead of hard-coding it, so the test follows the source of truth

## Mocking

**Framework:** None. No mocking library and no `node:test` `mock` usage.

**Why no mocks are needed:**
- The tested logic is deliberately pure. `state.js` has no I/O (its only effect is reading `os.homedir()` at load time for path constants)
- `install.js` exposes `applyHooks(settings, install)` as a pure function. The CLI part that touches `~/.claude/settings.json` is behind `require.main === module`, so the test imports it without side effects

**Patterns:**
- Inject data instead of stubbing it. For example, pass the `now` value directly, and pass the settings object directly to `applyHooks`
- Round-trip checks verify idempotence without mocking the file system:
```js
const installed = applyHooks(applyHooks(original, true), true);
// ...
assert.deepEqual(applyHooks(installed, false), original);
```

**What to Mock (if a future test needs it):**
- File system reads in `permission-hook.js` (`fs.readFileSync` on the heartbeat and state files) would be the first candidate if that module gets tests. Prefer a temporary directory over mocking `fs`
- Electron APIs (`BrowserWindow`, `screen`, `ipcMain`) would need a stub module for `main.js`, which is currently untested

**What NOT to Mock:**
- Pure functions in `state.js`. Test them with real inputs
- `applyHooks`. Test it against plain objects as the existing test does

## Fixtures and Factories

**Test Data:**
Inline object literals with spread-based variants keep each test self-contained:
```js
const permission = { id: '3f2b8c1e-9d4a-4b6f-8a1c-2e5d7f9b0c3a', tool: 'Bash', text: 'node escreve.js' };
for (const invalid of [
  { ...permission, id: '../../settings' },
  { ...permission, id: permission.id.toUpperCase() },
  { ...permission, text: 'x'.repeat(PERMISSION_TEXT_LIMIT + 1) },
  // ...
]) { /* ... */ }
```

**Deceptive-text fixtures:**
- `island.test.js` deliberately contains invisible and control characters (`\x1b`, U+202E right-to-left override, U+200B zero-width space) inside string literals. These are intentional inputs for the "text that hides the real command" rule in `state.js` (`DECEPTIVE_CHARACTERS`). They look like stray characters in an editor and in some scanners. Do not "clean them up". Keep them as escapes or literal characters with a comment that names the purpose

**Location:**
- Fixtures live inside the test file that uses them. No `fixtures/` directory exists

## Coverage

**Requirements:** None enforced. No coverage threshold, no coverage tool in `package.json`, and no CI config is tracked in the repository

**View Coverage:**
```bash
node --test --experimental-test-coverage island.test.js
```
This is the built-in Node flag; it is not wired into any script.

**Coverage by module (current state):**

| Module | Tested | Notes |
|---|---|---|
| `state.js` | Yes, extensively | All exported functions are exercised except `STATE_DIR`/`HEARTBEAT_FILE` paths |
| `install.js` | Yes | `applyHooks` only; the CLI branch that writes `settings.json` is not tested |
| `hook.js` | No | Runs on every Claude Code hook event; its behavior is verified manually |
| `permission-hook.js` | No | Polling loop with file I/O; verified manually |
| `window.js` | No | OS-specific PowerShell, `ps`, `xdotool`, `osascript` calls |
| `main.js` | No | Electron main process |
| `preload.js` | No | Context bridge only |
| `index.html` | No | Renderer logic (scroll-to-read, arming, render) is untested |

The README states that "Permitir e negar pela ilha não foram testados em macOS nem em Linux" and "Arrastar e várias ilhas foram testados só no Windows". Manual verification is the current practice for everything outside `state.js` and `install.js`.

## Test Types

**Unit Tests:**
- All current tests are unit tests of pure functions and one pure settings transform
- Scope: one exported function or a closely related group per test. Feature-level behavior (for example, "o pedido de permissão só vai para a ilha se couber inteiro e for legível") is covered by a single test with several sub-assertions

**Integration Tests:**
- None automated. The hook-to-island-to-permission round trip (`hook.js` writes state, `permission-hook.js` waits, `main.js` writes the decision) is only verified by hand in a running Electron app

**E2E Tests:**
- Not used. No Electron test driver (e.g., Playwright or Spectron) is installed

**Manual verification:**
- Run `pnpm start` to launch the island; run `pnpm hooks:install` to register hooks in `~/.claude/settings.json` (a backup `settings.json.island-backup` is written first)
- Check that a session shows state changes, that a permission request appears and can be allowed or denied, and that dragging and multi-monitor behavior work. These are the paths a change to `main.js`, `window.js`, `permission-hook.js`, or `index.html` must be checked against

## Common Patterns

**Pure-function behavior test:**
```js
test('a ilha só conta como viva com batimento recente', () => {
  const now = 1_000_000_000;
  assert.equal(isHeartbeatFresh(now, now), true);
  assert.equal(isHeartbeatFresh(now - 6_001, now), false);
  // relógio adiantado no arquivo não vale como "viva para sempre"
  assert.equal(isHeartbeatFresh(now + 60_000, now), false);
  for (const invalid of [NaN, undefined, null, '']) assert.equal(isHeartbeatFresh(invalid, now), false);
});
```

**Round-trip / idempotence test:**
```js
const installed = applyHooks(applyHooks(original, true), true);
assert.deepEqual(installed.hooks.Stop, [foreign, { matcher: '', hooks: [{ type: 'command', command: COMMAND }] }]);
// ...
assert.deepEqual(applyHooks(installed, false), original);
```
Use this shape for any transform that must be reversible or repeatable: apply twice, check there is no duplication, then undo and compare with the original.

**Input-rejection test (table-driven):**
```js
for (const invalid of [undefined, null, 42, '', '   ', ['ls']]) assert.equal(bash(invalid), null);
```
Every validator in `state.js` should get one of these loops for its rejected inputs.

**Priority / ordering test:**
```js
assert.equal(pickState([
  { state: 'running', project: 'velha', updatedAt: now - 5_000 },
  { state: 'running', project: 'nova', updatedAt: now },
], now).project, 'nova');
```
Build the input list in the order the test should prove is irrelevant, so a broken sort shows up.

**Async testing:** Not applicable. No async functions are tested.

**Error testing:** Errors are not expected to throw from pure functions. Test the `null` / sentinel return instead of `assert.throws`. `assert.throws` is not used in the repo.

## Writing New Tests

- Add new cases to `island.test.js` for changes to `state.js` or `install.js`. Keep each `test(...)` name a pt-BR sentence describing behavior
- Use a fixed `now` constant and pass it in; do not call `Date.now()` inside tested logic
- For any new validator or boundary, add both the accepted boundary and the rejected value next to it
- For new cross-process behavior (hook / island / permission hook), prefer extracting a pure function into `state.js` so it can be tested with the existing pattern, rather than adding an integration test harness

---

*Testing analysis: 2026-11-20*
