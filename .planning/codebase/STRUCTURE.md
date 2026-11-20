---
last_mapped_commit: 75d1a08eaa84174fda8d1cb27a0d18392b854fd1
last_mapped_at: 2026-11-20
---
# Codebase Structure

**Analysis Date:** 2026-11-20

## Directory Layout

```
claude-island/
├── main.js              # Electron main process: windows, polling, IPC, decisions
├── preload.js           # contextBridge: exposes window.island to the renderer
├── index.html           # Renderer: pill UI, styles and inline script (single file)
├── state.js             # Pure shared logic and constants (no I/O)
├── window.js            # OS-specific terminal window discovery and focus
├── hook.js              # Claude Code event hook (session state writer, island starter)
├── permission-hook.js   # Claude Code PermissionRequest hook (allow/deny relay)
├── install.js           # Registers/removes hooks in ~/.claude/settings.json
├── island.test.js       # node:test unit tests
├── package.json         # Scripts, electron devDependency, pnpm packageManager
├── pnpm-lock.yaml       # Lockfile (pnpm 11)
├── pnpm-workspace.yaml  # pnpm workspace file (no workspace packages)
├── README.md            # User-facing guide
├── CONTRIBUTING.md      # Contribution guide (issue-first)
├── LICENSE              # MIT
└── .gitignore           # Ignore rules
```

The repo is flat: there is no `src/`, `lib/`, `test/` or `scripts/` directory. Every source file sits at the root.

## Directory Purposes

**Repository root (`./`):**
- Purpose: all application code, tests, and docs.
- Contains: `.js` modules (CommonJS), one `.html` renderer, one `.test.js` file, project metadata.
- Key files: `main.js`, `state.js`, `hook.js`, `permission-hook.js`, `window.js`

**`.planning/` (generated, not application code):**
- Purpose: GSD planning and codebase-map documents.
- Contains: `codebase/` (this document set).
- Generated: Yes (by GSD mapper agents).
- Committed: Not determined from this scan; check `.gitignore` before committing.

**Runtime directories (outside the repo, not created by this repo's files):**
- `~/.claude/island/`: session files `<session_id>.json`, `.heartbeat`, and `decisions/` (created by `state.js` constants and written by hooks and `main.js`).
- `~/.claude/settings.json` and `~/.claude/settings.json.island-backup`: written by `install.js`.
- Electron `userData` directory: `positions.json` (saved drag offsets), written by `main.js`.
- OS temp dir: `claude-ctx-<session_id>.json`, read-only from this repo, written by the GSD statusline.

## Key File Locations

**Entry Points:**
- `main.js`: Electron app entry (`"main"` in `package.json`), started by `pnpm start`.
- `hook.js`: Claude Code event hook entry, run by Claude Code (path baked into `settings.json` by `install.js`).
- `permission-hook.js`: Claude Code PermissionRequest hook entry.
- `install.js`: CLI entry for `pnpm hooks:install` and `pnpm hooks:uninstall`.

**Configuration:**
- `package.json`: scripts (`start`, `test`, `hooks:install`, `hooks:uninstall`), `electron` version, pnpm version.
- `pnpm-workspace.yaml`: workspace settings; no packages listed.
- Constants: `state.js` (timeouts such as `PERMISSION_WAIT_MS`, `DONE_VISIBLE_MS`; limits such as `PERMISSION_TEXT_LIMIT`; context bands `CONTEXT_WARN_PERCENT`, `CONTEXT_CRITICAL_PERCENT`). Window geometry and polling intervals: `main.js` (`WINDOW_SIZE`, `POLL_MS`, `HORIZONTAL_SLACK`).

**Core Logic:**
- `state.js`: all decision logic (event mapping, session selection, permission validation, positioning math).
- `main.js`: orchestration and the only code that writes decision files for the island.
- `window.js`: terminal discovery and focus.

**Renderer:**
- `index.html`: markup (`#pill`, `#bar`, `#permission`, `#actions`), CSS in `<style>` (starts line 7), behaviour in the inline `<script>` (starts line 224).
- `preload.js`: the only bridge; add renderer-callable methods here.

**Testing:**
- `island.test.js`: all tests, grouped by `test('...')` blocks covering event mapping, session priority, clamping, context bands, permission readability and validation, decision output, heartbeat, and installer merge.

## Naming Conventions

**Files:**
- Lowercase, hyphen-separated for multi-word names: `permission-hook.js`.
- Single-word modules named by role: `state.js`, `window.js`, `hook.js`, `install.js`, `preload.js`, `main.js`.
- Tests: `<subject>.test.js` (the only test file is `island.test.js`).
- Docs: UPPERCASE for top-level project docs (`README.md`, `CONTRIBUTING.md`, `LICENSE`).

**Directories:**
- None besides `.planning/` and `.git/`. Do not introduce subfolders without a reason; the project is intentionally flat.

**Code identifiers:**
- Constants: `UPPER_SNAKE_CASE` (`PERMISSION_WAIT_MS`, `HEARTBEAT_FILE`, `WINDOW_SIZE`).
- Functions: `camelCase` verbs (`eventToState`, `pickState`, `findWindowPid`, `writeDecision`).
- Predicates: `is`/`has`/`keeps` prefixes (`isHeartbeatFresh`, `isReadablePermissionText`, `keepsPermission`).
- Module exports: `module.exports = { ... }` listing names at the bottom of each module.
- IPC channel names: `island:<action>` (`island:state`, `island:decide`, `island:drag-end`).
- Comments and user-facing strings: Portuguese (pt-BR). Identifiers: English.

## Where to Add New Code

**New domain rule or state mapping (e.g., a new hook event's effect):**
- Primary code: `state.js` (add to `eventToState` or a new exported helper).
- Register the event in `install.js` `EVENTS` if Claude Code must send it.
- Tests: `island.test.js`, add a `test('...')` block next to the closest existing one.

**New permission behaviour:**
- Readability and validation: `state.js` (`permissionRequest`, `validPermission`).
- Waiting/relay logic: `permission-hook.js`.
- Button handling in the UI: `index.html` (`allowButton`/`denyButton` listeners) and `main.js` `island:decide`.

**New hook (new Claude Code event that must be handled):**
- Simple state change: add the event name to `EVENTS` in `install.js` and a `case` in `eventToState` in `state.js`.
- Needs its own process: create `<name>-hook.js` at the root, follow the fail-silent pattern of `hook.js`, and add a `HOOKS_BY_EVENT` entry in `install.js`, as `PermissionRequest` does.

**New IPC message (renderer → main):**
- Expose on `window.island` in `preload.js`.
- Handle with `ipcMain.on('island:<name>', ...)` inside `registerIpcHandlers()` in `main.js`.
- Keep the renderer argument-light; resolve targets in main (see ARCHITECTURE.md, anti-patterns).

**New UI element or visual state:**
- Markup and styles: `index.html` (inline `<style>` and markup).
- State driver: `render()` in the inline `<script>`.

**New platform behaviour (window focus, discovery):**
- `window.js`, in the `process.platform` branch of `findWindowPid` or `focusWindow`.

**New installer behaviour:**
- `install.js`, keep `applyHooks` pure and exported so `island.test.js` can cover it.

**New utility shared by hooks and app:**
- Put it in `state.js` only if it is pure. OS-touching helpers belong in `window.js` or a new root module; the hooks must not load `electron`, except via the `require('electron')` path trick in `hook.js` for spawning.

**Tests:**
- Add to `island.test.js`. Do not create a second test directory; `pnpm test` runs `node --test`, which finds `*.test.js` at the root.

## Special Directories

**`.planning/`:**
- Purpose: GSD planning artifacts, including `.planning/codebase/`.
- Generated: Yes.
- Committed: Check `.gitignore` (not verified here).

**`node_modules/`:**
- Purpose: pnpm-installed dependencies (Electron).
- Generated: Yes.
- Committed: No (ignored; excluded from this analysis).

**`.git/`:**
- Purpose: git metadata.
- Generated: Yes.
- Committed: N/A.

---

*Structure analysis: 2026-11-20*
