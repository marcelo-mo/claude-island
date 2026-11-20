---
last_mapped_commit: 75d1a08eaa84174fda8d1cb27a0d18392b854fd1
last_mapped_at: 2026-11-20
---
# Coding Conventions

**Analysis Date:** 2026-11-20

## Naming Patterns

**Files:**
- Single-word or kebab-case lowercase names for source modules: `state.js`, `window.js`, `hook.js`, `install.js`, `main.js`, `preload.js`, `permission-hook.js`
- Test file is `island.test.js` at the repo root (the only `*.test.js`; it covers `state.js` and `install.js`)
- Renderer is a single `index.html` with inline `<style>` and `<script>` (no separate asset files)
- Entry points are declared by path in `package.json` (`"main": "main.js"`) and by `require`/`loadFile` calls, not by directory layout

**Functions:**
- camelCase verbs for actions: `eventToState`, `pickState`, `permissionRequest`, `validPermission`, `decisionOutput`, `writeDecision`, `readSessions`, `startIslandIfStopped`
- Predicates use `is`/`has`/`keeps` prefixes: `isHeartbeatFresh`, `isIslandAlive`, `isReadablePermissionText`, `isPermissionTool`, `isPid`, `isStillOurs`, `keepsPermission`
- Tiny inline helpers are arrow functions assigned to `const`: `const isOurs = (entry) => ...`, `const clamp = (value, min, max) => ...`, `const isPid = (value) => ...`
- Event handlers in `main.js` are named by channel: `ipcMain.on('island:decide', ...)`

**Variables:**
- camelCase for locals and module state: `savedOffsets`, `lastPickedState`, `shownPermissionId`, `dragStartPositions`
- Module-level constants are `UPPER_SNAKE_CASE`: `STATE_DIR`, `HEARTBEAT_STALE_MS`, `PERMISSION_TEXT_LIMIT`, `CONTEXT_WARN_PERCENT`
- Duration and size constants carry their unit as a suffix: `_MS`, `_SECONDS`, `_LIMIT`, `_PERCENT`
- Numeric literals use underscore separators for long values: `1_000_000_000`, `60_000`, `2_000`; unit arithmetic is written out: `5 * 60_000`, `2 * 60 * 60_000`
- Mutable module-level state is declared with `let` and grouped with a comment explaining its meaning (see `main.js` lines 23-38)
- Descriptive, unabbreviated names are the norm (`permissionRequest`, `decisionOutput`, `windowPid`). Accepted short names are limited to loop/callback parameters (`e`, `a`, `b`, `s`, `file`, `entry`) and the `fs`/`os`/`path` module aliases

**Types and data shapes:**
- No TypeScript and no JSDoc types; shapes are plain object literals
- Session state written to `~/.claude/island/<session_id>.json` has fields `{ state, detail, project, windowPid, permission, updatedAt, contextPercent }`, where `state` is one of `running`, `waiting`, `done`
- Permission objects are `{ id, tool, text }`, with `id` a lowercase UUID validated by `UUID_PATTERN` in `state.js`
- Sentinel string returns are used deliberately: `eventToState` returns `'remove'` for `SessionEnd`, and `null` means "ignore this event"

## Code Style

**Formatting:**
- No formatter config is tracked (no `.prettierrc`, `.editorconfig`, or `biome.json`). The style below is what the code consistently does and should be followed
- 2-space indentation
- Single quotes for strings; template literals for interpolation (`` `${sessionId}.json` ``)
- Semicolons on every statement
- Trailing commas in multi-line object and array literals and in multi-line argument lists
- Multi-line `require` destructuring is used when the import list is long (see `permission-hook.js` lines 11-14 and `main.js` lines 5-8)
- Lines are generally kept under ~120 characters; long guard conditions in `state.js` run longer and are accepted

**Linting:**
- Not configured. No ESLint config, no lint script in `package.json`. The only script-level checks are `pnpm test`
- Do not introduce a linter silently; if one is added, it must match the style above

**Language:**
- Identifiers are in English
- Comments, user-facing strings, and test names are in Brazilian Portuguese (pt-BR). Keep this when adding code: for example `Negado pelo usuário na ilha`, `Precisa da sua resposta`, `Concluído`
- Error messages written to the console are in pt-BR (`'Não foi possível salvar a posição da ilha:'`)

## Import Organization

**Order (observed):**
1. Electron (only in `main.js`, `preload.js`, `hook.js` via `require('electron')` inside a spawn call)
2. Node built-ins, always with the `node:` prefix: `require('node:fs')`, `require('node:path')`, `require('node:os')`, `require('node:crypto')`, `require('node:child_process')`
3. Local modules by relative path: `require('./state')`, `require('./window')`, `require('./install')`

Example from `hook.js`:
```js
const fs = require('node:fs');
const path = require('node:path');
const { STATE_DIR, HEARTBEAT_FILE, eventToState, keepsPermission, isHeartbeatFresh } = require('./state');
const { findWindowPid } = require('./window');
```

**Path Aliases:**
- None. All local imports are relative (`./state`). No `tsconfig` paths or bundler aliases exist.

**Module system:**
- CommonJS everywhere (`require` / `module.exports`). No ESM `import`/`export`.
- Each module ends with a single `module.exports = { ... }` block listing every exported name, one per line or wrapped to a few per line (`state.js` line 192, `install.js` line 52)
- Node built-ins are imported with `node:` prefix; do not drop it.

## Error Handling

**Core rule: hooks never break the Claude Code session.** `hook.js`, `permission-hook.js`, and `install.js` treat failures as non-events. The top-level handler is wrapped in `try`/`catch` with a silent catch and a comment saying why:

```js
process.stdin.on('end', () => {
  // Um hook que falha atrapalha a sessão do Claude; a ilha nunca pode custar isso.
  try {
    const input = JSON.parse(raw);
    // ...
  } catch {
    // silencioso de propósito (ver comentário acima)
  }
});
```

**Patterns:**
- Silent `catch {}` (optional catch binding, no variable) is used only where failure is expected and the fallback is a value the caller already handles (see `readSessions` and `readContextPercent` in `main.js`, `isIslandAlive` in `permission-hook.js`). Each one carries a comment stating the fallback, e.g. `// pasta ainda não existe: nenhuma decisão foi gravada`
- Pure functions in `state.js` never throw on bad input. They return `null` for invalid input and document it in JSDoc: `Devolve null se 'behavior' não for exatamente allow ou deny.`
- Distinguish "missing" from "unreadable now": `readSessionState` in `permission-hook.js` returns `null` for `ENOENT`, `undefined` when the file is half-written, and rethrows anything else
- Rethrow unexpected error codes rather than swallowing them:
```js
} catch (error) {
  if (error.code === 'ENOENT') return null;
  throw error;
}
```
- Optional values from external processes fall back to `null` (`findWindowPid` in `window.js` has a top-level `try`/`catch` that returns `null` and "Nunca lança" per its JSDoc)
- User-visible failures in `main.js` are logged with `console.error` in pt-BR and the app keeps running; they are not thrown

**Validation at trust boundaries:**
- Data read from disk is never trusted. Validate type and range before use: `Number.isInteger(windowPid) && windowPid > 0` in `pickState`, `UUID_PATTERN.test(id)` in `validPermission`, `Number.isFinite` checks in `savedPosition` (`main.js`)
- IPC from the renderer is validated in the main process and never supplies identifiers: `island:decide` only accepts `'allow'` or `'deny'`, and the permission id comes from `shownPermissionId` in `main.js`
- Session ids used in filenames are sanitized: `String(input.session_id || '').replace(/[^\w-]/g, '')` in `hook.js` and `permission-hook.js`

**Atomic writes:**
- Cross-process files are written to `<file>.tmp` and then renamed (`writeDecision` in `main.js`), so the reader never sees a partial decision. Reuse this pattern for new cross-process files.

## Logging

**Framework:** `console` only. No logging library.

**Patterns:**
- `console.error` in `main.js` and `window.js` for failures the user should be able to diagnose (`'Não foi possível gravar o batimento da ilha:'`)
- Hook processes (`hook.js`, `permission-hook.js`) must stay silent on stdout/stderr: stdout is the Claude Code protocol channel for `permission-hook.js` (JSON decision only), and a hook must not print on normal paths
- No `console.log` in runtime code. `install.js` uses `console.log` only for its CLI confirmation message

## Comments

**When to Comment:**
- Explain **why**, not what. Almost every non-obvious constant or branch has a comment about the reason behind it. Examples: `// Os botões só valem depois que o pedido ficou este tempo na tela`, `// setBounds com o tamanho explícito (e não setPosition): com escala de DPI fracionária...`
- Put the comment directly above the constant or statement it explains
- Platform quirks always get a comment naming the platform and the workaround (`main.js` lines 19-20 on Linux click-through; `window.js` on Windows foreground focus)
- Security-relevant decisions are commented with the threat (`// Fronteira de confiança: isto aprova a execução de um comando.` in `main.js`)

**Deliberate simplifications (`ponytail:` marker):**
- Used when a shortcut has a known ceiling. Format: `// ponytail: <what is simplified>. <when/how to upgrade>.`
- Present in `main.js` (display id stability, `readContextPercent` statusline dependency, polling vs `fs.watch`) and `window.js` (macOS ancestor heuristic). Keep the same form for new ones.

**JSDoc/TSDoc:**
- Block comments use `/** ... */` above exported functions, describing the return contract in pt-BR. Example from `state.js`:
```js
/**
 * Traduz o payload de um hook do Claude Code no que fazer com o estado da sessão.
 * Retorna { state, detail }, 'remove' (apagar a sessão) ou null (ignorar o evento).
 */
```
- No `@param` / `@returns` tags. Describe the return value in prose and the sentinel values explicitly.

## Function Design

**Size:** Small pure helpers in `state.js` (typically 3-15 lines). Larger orchestration functions exist in `main.js` (`start`, `registerIpcHandlers`) and `permission-hook.js` (`waitForDecision`, ~50 lines) but are split by responsibility with inline helpers.

**Parameters:**
- Pass plain data objects and explicit values, not globals. Pure logic takes `now` as a parameter (`pickState(sessions, now)`, `isHeartbeatFresh(heartbeatAt, now)`) so tests do not depend on the clock
- Destructure inside the function body when reading several fields: `const { state, detail, project, windowPid, contextPercent, permission } = alive[0];`
- Position and size are passed as `{ x, y }` and `{ width, height }` objects

**Return Values:**
- Return objects with named fields for multi-value results: `{ state, detail }`, `{ tool, text }`, `{ percent, level }`
- Return `null` for "not applicable / invalid", and a value of the same shape otherwise
- Mutation is avoided on inputs: `applyHooks` returns a new settings object (`{ ...settings, hooks }`), and `pickState` builds a new object rather than changing the session

## Module Design

**Exports:**
- Named exports via one `module.exports` object at the bottom of the file
- Export constants that tests or sibling processes need (`PERMISSION_TEXT_LIMIT`, `PERMISSION_TIMEOUT_SECONDS`, `COMMAND`) alongside functions
- Keep the pure/OS split: `state.js` holds pure logic with no Electron or OS calls; `window.js` holds everything platform-specific (PowerShell, `ps`, `xdotool`, `osascript`); `main.js` holds Electron wiring

**Barrel Files:** Not used. Modules are required directly by path.

**CLI guard:** Scripts that are both importable and runnable guard the entry point with `if (require.main === module) { ... }` (`install.js` line 42).

**Process boundaries:** Hook scripts are separate Node processes launched by Claude Code with `"${process.execPath}" "<script>"`. Keep hook entry code small; `hook.js` is designed to run on every event and stay fast, so heavy work goes in `permission-hook.js` or the Electron app.

## Commit and Pull Request Language

- Commit subjects follow `tipo(escopo): descrição` in pt-BR, matching `git log` (`feat(ilha): ...`, `fix(permissao): ...`, `docs(readme): ...`, `chore(release): ...`)
- Types in use: `feat`, `fix`, `docs`, `chore`
- Pull request titles and descriptions are in pt-BR. Per `CONTRIBUTING.md`, this repository accepts PRs only from the maintainer

---

*Convention analysis: 2026-11-20*
