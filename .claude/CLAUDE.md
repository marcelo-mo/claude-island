<!-- GSD:project-start source:PROJECT.md -->

## Project

**Claude Island**

Uma "Dynamic Island" de desktop para o Claude Code: uma pílula no topo de cada monitor que mostra,
sem precisar olhar o terminal, quando uma sessão está trabalhando, quando precisa de resposta e
quando terminou, e que deixa responder a um pedido de permissão direto na ilha. É um projeto pessoal
do autor (Marcelo), publicado como código aberto (MIT) em `marcelo-mo/claude-island`.

**Core Value:** Saber de relance o que cada sessão do Claude Code está fazendo e responder ao que ela pede sem
trocar de janela — sem nunca aprovar algo que o usuário não viu.

### Constraints

- **Plataformas:** Windows, macOS e Linux — motivo de usar Node; recurso só de Windows é aceitável como opcional, nunca como base
- **Segurança:** a aprovação de permissões é fronteira de confiança — nenhuma mudança de interação (hover, scroll, troca de sessão) pode permitir aprovar um pedido que o usuário não estava vendo
- **Robustez dos hooks:** hooks nunca podem quebrar nem atrasar a sessão do Claude Code (falha silenciosa, saída 0)
- **Dependências:** menor diff correto; sem dependência nova sem necessidade; gerenciador pnpm
- **Testes:** `node:test`, lógica pura em `state.js`
- **Processo:** commits semânticos em pt-br, sem `Co-Authored-By`; branch protegida (`main`) — tudo por PR, merge pelo admin com bypass; release com descrição do que foi entregue
- **Licença:** MIT; portar valores ou lógica do mod exige manter o aviso de copyright do autor

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- JavaScript (CommonJS, `require`/`module.exports`, no transpilation) - all application code: `main.js`, `window.js`, `state.js`, `hook.js`, `permission-hook.js`, `install.js`, `preload.js`
- HTML/CSS/vanilla JS (inline `<style>` and `<script>`) - renderer UI in `index.html` (about 400 lines, no framework)
- PowerShell (inline `-Command` scripts, embedded as strings in `window.js`) - Windows window discovery and focus via `user32.dll` P/Invoke
- AppleScript (`osascript -e`, string in `window.js`) - macOS window focus
- Shell tools invoked from Node: `ps` and `xdotool` (Linux) - see `window.js`

## Runtime

- Electron 45.4.1 (`devDependencies` in `package.json`, locked in `pnpm-lock.yaml`). Provides the Chromium renderer and the bundled Node runtime for `main.js`.
- Node.js: no `engines` field and no `.nvmrc` / `.node-version` file. Plain `node` is used for hooks (`hook.js`, `permission-hook.js`) and tests (`node --test`), so the system Node must support `node:test` (Node 18+ inferred from `node:test` usage; not pinned).
- Hooks run through the Node binary from `process.execPath` (`install.js` writes that absolute path into `~/.claude/settings.json`). Inside the Electron process `require('electron')` returns the executable path, which `hook.js` uses to spawn the island.
- pnpm 11.10.0 (`packageManager` field in `package.json`)
- Lockfile: present - `pnpm-lock.yaml` (lockfileVersion 9.0). Only two packages resolved: `electron@45.4.1` and `semver@7.8.6` (transitive).
- `pnpm-workspace.yaml` exists only to set `allowBuilds: electron: true`, which lets Electron run its postinstall download.
- `node_modules/` is git-ignored (`.gitignore`).

## Frameworks

- Electron 45.4.1 - desktop shell: frameless, transparent, always-on-top `BrowserWindow` per display (`main.js`, `createIsland`)
- None on the renderer side: no React/Vue/Svelte, no bundler
- Node built-in test runner (`node:test`) with `node:assert` - `island.test.js` (9 tests). Run with `pnpm test` (`node --test`). No Jest/Vitest/Mocha.
- No build step. Electron loads source files directly.
- No linter or formatter config (no ESLint, Prettier, Biome config in the repo).

## Key Dependencies

- `electron` 45.4.1 (devDependency, `^45.4.1`) - the only runtime dependency that matters; required for `pnpm start` and for the island process spawned by `hook.js`. Electron is listed under devDependencies even though the app needs it at runtime.
- Node built-in modules only in application code: `node:fs`, `node:path`, `node:os`, `node:crypto` (`randomUUID`), `node:child_process` (`execFile`, `execFileSync`, `spawn`).
- `semver` 7.8.6 - transitive via Electron tooling; not imported by the repo.

## Configuration

- No `.env` files in the repo. No environment variables are read by application code except the internal `ISLAND_PID` set by `window.js` on the PowerShell child process (`pidEnv`).
- The app reads user configuration from the Claude Code settings file, `~/.claude/settings.json`, which `install.js` edits (backup written to `~/.claude/settings.json.island-backup`).
- Runtime state lives under `~/.claude/island/` (defined in `state.js`: `STATE_DIR`, `DECISIONS_DIR`, `HEARTBEAT_FILE`).
- Tunable constants are hard-coded in `state.js` (for example `PERMISSION_WAIT_MS = 5 * 60_000`, `HEARTBEAT_STALE_MS = 6_000`, `DONE_VISIBLE_MS = 10_000`, `CONTEXT_WARN_PERCENT = 50`, `CONTEXT_CRITICAL_PERCENT = 80`). Config files are not used.
- `.claude/settings.local.json` exists in the repo root (local Claude Code settings). Its contents were not read and it is not part of the app's configuration. Confirm it is git-ignored before committing changes; `.gitignore` only lists `node_modules/`.
- No build configuration. Entry point is `main.js` (`package.json` `"main"`), started with `electron .` (`pnpm start`).
- Scripts (`package.json`): `start`, `test`, `hooks:install`, `hooks:uninstall`.

## Platform Requirements

- pnpm 11.10.0 and a Node.js able to run `node --test`
- Windows is the primary tested platform. macOS requires `osascript` and macOS Automation/Accessibility permission (prompted on first use). Linux requires `xdotool` and X11 for focusing windows, and `/proc` for process ancestry. Click-through is disabled on Linux (`CAN_CLICK_THROUGH` in `main.js`).
- Not a deployed service. Distributed as a source repository run locally. Installed per user with `pnpm hooks:install`, which registers hooks in `~/.claude/settings.json` that point at this checkout's absolute paths (`install.js`). Moving or deleting the checkout breaks the hook commands.
- Target OS: Windows 11 (tested), macOS and Linux (partially tested, per `README.md`).

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- Single-word or kebab-case lowercase names for source modules: `state.js`, `window.js`, `hook.js`, `install.js`, `main.js`, `preload.js`, `permission-hook.js`
- Test file is `island.test.js` at the repo root (the only `*.test.js`; it covers `state.js` and `install.js`)
- Renderer is a single `index.html` with inline `<style>` and `<script>` (no separate asset files)
- Entry points are declared by path in `package.json` (`"main": "main.js"`) and by `require`/`loadFile` calls, not by directory layout
- camelCase verbs for actions: `eventToState`, `pickState`, `permissionRequest`, `validPermission`, `decisionOutput`, `writeDecision`, `readSessions`, `startIslandIfStopped`
- Predicates use `is`/`has`/`keeps` prefixes: `isHeartbeatFresh`, `isIslandAlive`, `isReadablePermissionText`, `isPermissionTool`, `isPid`, `isStillOurs`, `keepsPermission`
- Tiny inline helpers are arrow functions assigned to `const`: `const isOurs = (entry) => ...`, `const clamp = (value, min, max) => ...`, `const isPid = (value) => ...`
- Event handlers in `main.js` are named by channel: `ipcMain.on('island:decide', ...)`
- camelCase for locals and module state: `savedOffsets`, `lastPickedState`, `shownPermissionId`, `dragStartPositions`
- Module-level constants are `UPPER_SNAKE_CASE`: `STATE_DIR`, `HEARTBEAT_STALE_MS`, `PERMISSION_TEXT_LIMIT`, `CONTEXT_WARN_PERCENT`
- Duration and size constants carry their unit as a suffix: `_MS`, `_SECONDS`, `_LIMIT`, `_PERCENT`
- Numeric literals use underscore separators for long values: `1_000_000_000`, `60_000`, `2_000`; unit arithmetic is written out: `5 * 60_000`, `2 * 60 * 60_000`
- Mutable module-level state is declared with `let` and grouped with a comment explaining its meaning (see `main.js` lines 23-38)
- Descriptive, unabbreviated names are the norm (`permissionRequest`, `decisionOutput`, `windowPid`). Accepted short names are limited to loop/callback parameters (`e`, `a`, `b`, `s`, `file`, `entry`) and the `fs`/`os`/`path` module aliases
- No TypeScript and no JSDoc types; shapes are plain object literals
- Session state written to `~/.claude/island/<session_id>.json` has fields `{ state, detail, project, windowPid, permission, updatedAt, contextPercent }`, where `state` is one of `running`, `waiting`, `done`
- Permission objects are `{ id, tool, text }`, with `id` a lowercase UUID validated by `UUID_PATTERN` in `state.js`
- Sentinel string returns are used deliberately: `eventToState` returns `'remove'` for `SessionEnd`, and `null` means "ignore this event"

## Code Style

- No formatter config is tracked (no `.prettierrc`, `.editorconfig`, or `biome.json`). The style below is what the code consistently does and should be followed
- 2-space indentation
- Single quotes for strings; template literals for interpolation (`` `${sessionId}.json` ``)
- Semicolons on every statement
- Trailing commas in multi-line object and array literals and in multi-line argument lists
- Multi-line `require` destructuring is used when the import list is long (see `permission-hook.js` lines 11-14 and `main.js` lines 5-8)
- Lines are generally kept under ~120 characters; long guard conditions in `state.js` run longer and are accepted
- Not configured. No ESLint config, no lint script in `package.json`. The only script-level checks are `pnpm test`
- Do not introduce a linter silently; if one is added, it must match the style above
- Identifiers are in English
- Comments, user-facing strings, and test names are in Brazilian Portuguese (pt-BR). Keep this when adding code: for example `Negado pelo usuário na ilha`, `Precisa da sua resposta`, `Concluído`
- Error messages written to the console are in pt-BR (`'Não foi possível salvar a posição da ilha:'`)

## Import Organization

- None. All local imports are relative (`./state`). No `tsconfig` paths or bundler aliases exist.
- CommonJS everywhere (`require` / `module.exports`). No ESM `import`/`export`.
- Each module ends with a single `module.exports = { ... }` block listing every exported name, one per line or wrapped to a few per line (`state.js` line 192, `install.js` line 52)
- Node built-ins are imported with `node:` prefix; do not drop it.

## Error Handling

- Silent `catch {}` (optional catch binding, no variable) is used only where failure is expected and the fallback is a value the caller already handles (see `readSessions` and `readContextPercent` in `main.js`, `isIslandAlive` in `permission-hook.js`). Each one carries a comment stating the fallback, e.g. `// pasta ainda não existe: nenhuma decisão foi gravada`
- Pure functions in `state.js` never throw on bad input. They return `null` for invalid input and document it in JSDoc: `Devolve null se 'behavior' não for exatamente allow ou deny.`
- Distinguish "missing" from "unreadable now": `readSessionState` in `permission-hook.js` returns `null` for `ENOENT`, `undefined` when the file is half-written, and rethrows anything else
- Rethrow unexpected error codes rather than swallowing them:
- Optional values from external processes fall back to `null` (`findWindowPid` in `window.js` has a top-level `try`/`catch` that returns `null` and "Nunca lança" per its JSDoc)
- User-visible failures in `main.js` are logged with `console.error` in pt-BR and the app keeps running; they are not thrown
- Data read from disk is never trusted. Validate type and range before use: `Number.isInteger(windowPid) && windowPid > 0` in `pickState`, `UUID_PATTERN.test(id)` in `validPermission`, `Number.isFinite` checks in `savedPosition` (`main.js`)
- IPC from the renderer is validated in the main process and never supplies identifiers: `island:decide` only accepts `'allow'` or `'deny'`, and the permission id comes from `shownPermissionId` in `main.js`
- Session ids used in filenames are sanitized: `String(input.session_id || '').replace(/[^\w-]/g, '')` in `hook.js` and `permission-hook.js`
- Cross-process files are written to `<file>.tmp` and then renamed (`writeDecision` in `main.js`), so the reader never sees a partial decision. Reuse this pattern for new cross-process files.

## Logging

- `console.error` in `main.js` and `window.js` for failures the user should be able to diagnose (`'Não foi possível gravar o batimento da ilha:'`)
- Hook processes (`hook.js`, `permission-hook.js`) must stay silent on stdout/stderr: stdout is the Claude Code protocol channel for `permission-hook.js` (JSON decision only), and a hook must not print on normal paths
- No `console.log` in runtime code. `install.js` uses `console.log` only for its CLI confirmation message

## Comments

- Explain **why**, not what. Almost every non-obvious constant or branch has a comment about the reason behind it. Examples: `// Os botões só valem depois que o pedido ficou este tempo na tela`, `// setBounds com o tamanho explícito (e não setPosition): com escala de DPI fracionária...`
- Put the comment directly above the constant or statement it explains
- Platform quirks always get a comment naming the platform and the workaround (`main.js` lines 19-20 on Linux click-through; `window.js` on Windows foreground focus)
- Security-relevant decisions are commented with the threat (`// Fronteira de confiança: isto aprova a execução de um comando.` in `main.js`)
- Used when a shortcut has a known ceiling. Format: `// ponytail: <what is simplified>. <when/how to upgrade>.`
- Present in `main.js` (display id stability, `readContextPercent` statusline dependency, polling vs `fs.watch`) and `window.js` (macOS ancestor heuristic). Keep the same form for new ones.
- Block comments use `/** ... */` above exported functions, describing the return contract in pt-BR. Example from `state.js`:
- No `@param` / `@returns` tags. Describe the return value in prose and the sentinel values explicitly.

## Function Design

- Pass plain data objects and explicit values, not globals. Pure logic takes `now` as a parameter (`pickState(sessions, now)`, `isHeartbeatFresh(heartbeatAt, now)`) so tests do not depend on the clock
- Destructure inside the function body when reading several fields: `const { state, detail, project, windowPid, contextPercent, permission } = alive[0];`
- Position and size are passed as `{ x, y }` and `{ width, height }` objects
- Return objects with named fields for multi-value results: `{ state, detail }`, `{ tool, text }`, `{ percent, level }`
- Return `null` for "not applicable / invalid", and a value of the same shape otherwise
- Mutation is avoided on inputs: `applyHooks` returns a new settings object (`{ ...settings, hooks }`), and `pickState` builds a new object rather than changing the session

## Module Design

- Named exports via one `module.exports` object at the bottom of the file
- Export constants that tests or sibling processes need (`PERMISSION_TEXT_LIMIT`, `PERMISSION_TIMEOUT_SECONDS`, `COMMAND`) alongside functions
- Keep the pure/OS split: `state.js` holds pure logic with no Electron or OS calls; `window.js` holds everything platform-specific (PowerShell, `ps`, `xdotool`, `osascript`); `main.js` holds Electron wiring

## Commit and Pull Request Language

- Commit subjects follow `tipo(escopo): descrição` in pt-BR, matching `git log` (`feat(ilha): ...`, `fix(permissao): ...`, `docs(readme): ...`, `chore(release): ...`)
- Types in use: `feat`, `fix`, `docs`, `chore`
- Pull request titles and descriptions are in pt-BR. Per `CONTRIBUTING.md`, this repository accepts PRs only from the maintainer

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Event hook | Translates each Claude Code hook payload into session state; removes session on `SessionEnd`; starts the island on `SessionStart` if its heartbeat is stale | `hook.js` |
| Permission hook | Handles `PermissionRequest`: publishes the request to the island, waits for allow/deny, prints the decision JSON on stdout | `permission-hook.js` |
| Pure domain logic | Event→state mapping, session prioritisation (`pickState`), permission validation and readability rules, context-percent bands, heartbeat freshness, window clamping, decision output | `state.js` |
| Electron main process | Window lifecycle per display, polling of session files, IPC handlers, saved drag offsets, decision file writes, single-instance lock | `main.js` |
| Preload bridge | Exposes the only renderer-facing API (`window.island`) through `contextBridge` | `preload.js` |
| Renderer UI | Pill rendering (idle/running/waiting/done), permission box, drag and hover handling, sound cue | `index.html` (inline `<script>`) |
| OS window integration | Finds the terminal window owning a session's process tree and focuses it, per platform | `window.js` |
| Installer | Adds/removes the island's hook entries in `~/.claude/settings.json`, keeping foreign hooks and a `.island-backup` copy | `install.js` |
| Tests | `node:test` unit tests for state logic and installer merge behaviour | `island.test.js` |

## Pattern Overview

- Filesystem is the message bus. Writers use plain `writeFileSync`; the one place needing atomicity uses write-temp-then-rename (`writeDecision` in `main.js`).
- Producers are fail-silent by design: every hook wraps its work in `try/catch` and exits 0, because a broken hook would break the Claude Code session (`hook.js`, `permission-hook.js`).
- Pure logic is isolated in `state.js` with no I/O, so it is testable without Electron (`island.test.js` imports it directly).
- Platform-specific code is confined to `window.js` and a few `process.platform` branches in `main.js`.
- No build step, no bundler, no TypeScript, no framework. Plain CommonJS (`require`) everywhere; `package.json` has only `electron` as dev dependency.
- Security boundary is the renderer→main IPC: the renderer only sends `'allow'` or `'deny'`; the main process decides which request that refers to (`shownPermissionId`), so the renderer never supplies a permission id.

## Layers

- Purpose: turn hook payloads into session files and gate permission prompts.
- Location: `hook.js`, `permission-hook.js`
- Contains: stdin JSON parsing, file reads/writes under `~/.claude/island/`, PID discovery via `findWindowPid`.
- Depends on: `state.js`, `window.js`
- Used by: Claude Code itself, via the hooks registered by `install.js`.
- Purpose: all decisions about what the island shows and what a hook output looks like.
- Location: `state.js`
- Contains: `eventToState`, `keepsPermission`, `permissionRequest`, `validPermission`, `decisionOutput`, `pickState`, `contextUsage`, `isHeartbeatFresh`, `defaultIslandPosition`, `clampIslandPosition`, and the constants (timeouts, limits, paths).
- Depends on: `node:os`, `node:path` only.
- Used by: `hook.js`, `permission-hook.js`, `main.js`, `install.js`, `island.test.js`.
- Purpose: show the island on every display and relay user clicks back to the file system.
- Location: `main.js` (main process), `preload.js` (bridge), `index.html` (renderer)
- Contains: `BrowserWindow` creation per display, 400 ms polling loop, IPC listeners, `writeDecision`.
- Depends on: `state.js`, `window.js`, `electron`.
- Used by: launched by `electron .` (`package.json` `start`) or by `hook.js` on `SessionStart`.
- Purpose: register and unregister the hooks in Claude Code settings.
- Location: `install.js`
- Contains: `applyHooks` (pure, exported), CLI entry guarded by `require.main === module`.
- Depends on: `state.js` (`PERMISSION_WAIT_MS` for the permission hook timeout).
- Used by: `pnpm hooks:install` / `pnpm hooks:uninstall`.

## Data Flow

### Session state (hook → island)

### Permission request (terminal ↔ island)

### Focus the terminal

### Drag and position

- Session state: files in `~/.claude/island/`, one per session; stale entries are ignored by age in `pickState` (`DONE_VISIBLE_MS`, `RUNNING_STALE_MS`, `WAITING_STALE_MS`) rather than deleted.
- In-memory in main: `islands` (Map keyed by `display.id`), `savedOffsets`, `lastPickedState`, `shownWindowPid`, `shownPermissionId`, `shownPermissionSince`, `dragStartPositions`.
- Renderer: `current`, `hovering`, `armedPermissionId`, `answeredPermissionId`, `readPermissionId` in `index.html`.

## Key Abstractions

- Purpose: the per-session record that every process reads and writes.
- Examples: `hook.js` (write), `permission-hook.js` (write `waiting` + permission), `main.js` `readSessions` (read).
- Pattern: plain JSON `{ state, detail, project, windowPid, permission?, updatedAt }`, file name is the sanitized `session_id`.
- Purpose: a pending approval, identified by a UUID that is the only thing a decision refers to.
- Examples: `permissionRequest` and `validPermission` in `state.js`; `writeDecision` in `main.js`.
- Pattern: create → publish → poll → consume (decision file removed by the reader).
- Purpose: the exact JSON Claude Code expects from a PermissionRequest hook; intentionally no `updatedPermissions`, so approvals never persist.
- Examples: `decisionOutput` in `state.js`.
- Purpose: one transparent always-on-top window per monitor.
- Examples: `createIsland`, `syncIslands`, `islands` Map in `main.js`.

## Entry Points

- Location: `main.js` (declared as `"main"` in `package.json`)
- Triggers: `pnpm start` (`electron .`), or `hook.js` spawning `electron` with the repo dir on `SessionStart` when the heartbeat is stale.
- Responsibilities: single-instance lock, heartbeat, window creation, polling loop, IPC.
- Location: `hook.js`
- Triggers: Claude Code events `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Notification`, `Stop`, `SessionEnd` (list in `install.js` `EVENTS`).
- Responsibilities: write session state; start the island.
- Location: `permission-hook.js`
- Triggers: Claude Code `PermissionRequest` event (registered with a timeout of `PERMISSION_WAIT_MS / 1000 + 30` seconds).
- Responsibilities: publish a permission request and return the user's decision.
- Location: `install.js`
- Triggers: `pnpm hooks:install`, `pnpm hooks:uninstall` (`--uninstall` flag).
- Responsibilities: edit `~/.claude/settings.json` safely (parse first, backup, then write).
- Location: `island.test.js`, run with `pnpm test` (`node --test`).

## Architectural Constraints

- **Threading:** Single-threaded event loop in every process. Blocking calls are used deliberately in hooks (`execFileSync` for PID discovery, `timeout` 4 s on PowerShell, 1 s on `ps`) because the hook must return before Claude Code proceeds. The Electron main process uses `execFile` (async) for focus.
- **Global state:** Module-level mutable state in `main.js` (`islands`, `dragStartPositions`, `savedOffsets`, `lastPickedState`, `shownWindowPid`, `shownPermissionId`, `shownPermissionSince`). `state.js` holds only constants and pure functions.
- **Single instance:** `app.requestSingleInstanceLock()` in `main.js`; a second launch quits immediately. This is what makes concurrent `SessionStart` spawns harmless.
- **Circular imports:** None detected. Dependency direction is `main.js`/`hook.js`/`permission-hook.js`/`install.js` → `state.js`, and `main.js`/`hook.js`/`permission-hook.js` → `window.js`. `state.js` imports only Node built-ins.
- **Platform gates:** `CAN_CLICK_THROUGH` is false on Linux (no `forward` option for `setIgnoreMouseEvents`), so hover detection is disabled there. `process.platform` branches in `window.js` select the focus mechanism. Linux focus requires `xdotool`.
- **Shared constants across processes:** Timeouts and paths are defined once in `state.js` (e.g., `PERMISSION_WAIT_MS` is used by `main.js`, `permission-hook.js`, and `install.js`). Changing one changes the contract for all three.
- **Coupling to GSD:** Context percentage is read from a file written by the GSD statusline (`claude-ctx-<session_id>.json` in the OS temp dir). Without it the context ring does not appear. The island does not register its own statusLine.

## Anti-Patterns

### Hooks that throw or print

### Trusting data read from disk

### Renderer-supplied identifiers

### Writing decisions non-atomically

## Error Handling

- Hooks: outer `try/catch` on the whole stdin handler; inner `catch` with a comment on each expected failure (missing file, `ENOENT`).
- Permission hook: any error inside the poll interval calls `clearInterval` and ends the wait without output (`permission-hook.js`).
- Main process: failures writing `positions.json`, heartbeat, or decisions are logged with `console.error` and the app keeps running.
- Focus: `focusWindow` takes a callback `onDone(error)`; `findWindowPid` never throws and returns `null`.

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-fast` for a trivial task inline, with no subagents and no PLAN.md
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
