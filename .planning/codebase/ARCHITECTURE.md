---
last_mapped_commit: 75d1a08eaa84174fda8d1cb27a0d18392b854fd1
last_mapped_at: 2026-11-20
---
<!-- refreshed: 2026-11-20 -->
# Architecture

**Analysis Date:** 2026-11-20

## System Overview

```text
 Claude Code (terminal)                                   ~/.claude/settings.json
 ├─ SessionStart / UserPromptSubmit / PreToolUse /  ──►  hook.js  (short-lived, one run per event)
 │  PostToolUse / Notification / Stop / SessionEnd           │ writes ~/.claude/island/<session_id>.json
 │                                                          │ spawns electron on SessionStart if no heartbeat
 └─ PermissionRequest ───────────────────────────────►  permission-hook.js (waits up to 5 min)
                                                            │ writes state (waiting + permission id)
                                                            │ polls decisions/<id>.json every 250 ms
                                                            ▼
 ┌──────────────────────────── shared state dir ────────────────────────────┐
 │ ~/.claude/island/<session_id>.json   .heartbeat   decisions/<uuid>.json  │
 └──────────────────────────────────────────────────────────────────────────┘
        ▲ polled every 400 ms                 ▲ writes decision on click
        │                                     │
 ┌──────┴──────────── Electron app (main.js) ──┴──────────────────────────┐
 │ main process: one BrowserWindow per display, IPC handlers, heartbeat  │
 │   │ preload.js (contextBridge → window.island)                        │
 │   ▼                                                                   │
 │ renderer: index.html (pill UI, inline script, no framework)           │
 └───────────────────────────────────────────────────────────────────────┘
        │ focus request (island:focus)
        ▼
 window.js → PowerShell / osascript / xdotool (brings terminal window forward)
```

Shared pure logic lives in `state.js`, required by every process above.

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

**Overall:** Event-driven desktop widget. Two out-of-process producers (Claude Code hook scripts) and one consumer (Electron app) communicate only through JSON files in `~/.claude/island/`. No server, no database, no network.

**Key Characteristics:**
- Filesystem is the message bus. Writers use plain `writeFileSync`; the one place needing atomicity uses write-temp-then-rename (`writeDecision` in `main.js`).
- Producers are fail-silent by design: every hook wraps its work in `try/catch` and exits 0, because a broken hook would break the Claude Code session (`hook.js`, `permission-hook.js`).
- Pure logic is isolated in `state.js` with no I/O, so it is testable without Electron (`island.test.js` imports it directly).
- Platform-specific code is confined to `window.js` and a few `process.platform` branches in `main.js`.
- No build step, no bundler, no TypeScript, no framework. Plain CommonJS (`require`) everywhere; `package.json` has only `electron` as dev dependency.
- Security boundary is the renderer→main IPC: the renderer only sends `'allow'` or `'deny'`; the main process decides which request that refers to (`shownPermissionId`), so the renderer never supplies a permission id.

## Layers

**Hook layer (out-of-process, per Claude Code event):**
- Purpose: turn hook payloads into session files and gate permission prompts.
- Location: `hook.js`, `permission-hook.js`
- Contains: stdin JSON parsing, file reads/writes under `~/.claude/island/`, PID discovery via `findWindowPid`.
- Depends on: `state.js`, `window.js`
- Used by: Claude Code itself, via the hooks registered by `install.js`.

**Domain layer (pure):**
- Purpose: all decisions about what the island shows and what a hook output looks like.
- Location: `state.js`
- Contains: `eventToState`, `keepsPermission`, `permissionRequest`, `validPermission`, `decisionOutput`, `pickState`, `contextUsage`, `isHeartbeatFresh`, `defaultIslandPosition`, `clampIslandPosition`, and the constants (timeouts, limits, paths).
- Depends on: `node:os`, `node:path` only.
- Used by: `hook.js`, `permission-hook.js`, `main.js`, `install.js`, `island.test.js`.

**Presentation/shell layer (Electron):**
- Purpose: show the island on every display and relay user clicks back to the file system.
- Location: `main.js` (main process), `preload.js` (bridge), `index.html` (renderer)
- Contains: `BrowserWindow` creation per display, 400 ms polling loop, IPC listeners, `writeDecision`.
- Depends on: `state.js`, `window.js`, `electron`.
- Used by: launched by `electron .` (`package.json` `start`) or by `hook.js` on `SessionStart`.

**Installation layer:**
- Purpose: register and unregister the hooks in Claude Code settings.
- Location: `install.js`
- Contains: `applyHooks` (pure, exported), CLI entry guarded by `require.main === module`.
- Depends on: `state.js` (`PERMISSION_WAIT_MS` for the permission hook timeout).
- Used by: `pnpm hooks:install` / `pnpm hooks:uninstall`.

## Data Flow

### Session state (hook → island)

1. Claude Code runs `hook.js` with the event JSON on stdin (`hook.js` top-level `process.stdin.on('end')`).
2. `eventToState` (`state.js`) maps the event to `{ state, detail }`, `'remove'`, or `null`.
3. `hook.js` reads the previous session file to reuse `windowPid` (cached, costs ~0.4 s on Windows) and a pending `permission`, then writes `~/.claude/island/<session_id>.json` with `project` and `updatedAt`.
4. `main.js` `readSessions()` reads all `*.json` in that directory every 400 ms, attaches `contextPercent` from `os.tmpdir()/claude-ctx-<id>.json`, and calls `pickState` (`state.js`) to choose one session to display.
5. If the picked result changed (string comparison against `lastSent`), `sendState` pushes `island:state` to every renderer. Only the first island window passes `shouldChime = true`.
6. `index.html` `render()` updates the pill.

### Permission request (terminal ↔ island)

1. Claude Code fires `PermissionRequest`; `permission-hook.js` checks `isIslandAlive()` (heartbeat). If the island is down it exits silently, leaving the terminal dialog.
2. `permissionRequest(input)` (`state.js`) returns `{ tool, text }` only if the request is readable, short, and free of deceptive characters, and for Bash only if no extra fields exist; otherwise null and the terminal decides.
3. The hook writes the session file with `state: 'waiting'` and `permission: { id, tool, text }`, then polls `decisions/<id>.json` every 250 ms and also checks that the session file still carries its `id` (another event overwriting it means it was answered in the terminal).
4. In the island, `pickState` only surfaces `permission` when `state === 'waiting'`, and `validPermission` re-validates it (it came from disk).
5. The user clicks Allow/Deny. The renderer waits `PERMISSION_ARM_MS` (800 ms) after the box appears, then calls `window.island.decide(behavior)`.
6. `main.js` `island:decide` handler checks sender window, `shownPermissionId`, `decisionOutput`, and the arm delay, then `writeDecision` writes `decisions/<id>.json` via temp file + rename.
7. The hook reads the decision, prints `decisionOutput(behavior)` JSON to stdout (the only stdout it ever writes), and calls `withdrawRequest` to flip the session back to `running`.
8. Timeouts (`PERMISSION_WAIT_MS`, 5 min) and island death end the wait without output, so Claude Code falls back to its own dialog.

### Focus the terminal

1. Renderer calls `window.island.focusSession()` on a click on the "Abrir" button.
2. `main.js` `island:focus` handler calls `focusWindow(shownWindowPid)`; the PID comes from the session file, found earlier by `findWindowPid` (`window.js`).
3. `window.js` runs the platform command (PowerShell with user32 calls on Windows, `osascript` on macOS, `xdotool` on Linux).

### Drag and position

1. Renderer pointer events send cumulative deltas via `island:drag`; main adds them to the start bounds captured in `dragStartPositions`.
2. `island:drag-end` stores the offset from the default position in `savedOffsets` and persists `positions.json` in Electron's `userData`.
3. `syncIslands` (on display add/remove/metrics change) recreates or repositions windows; it skips windows currently being dragged.

**State Management:**
- Session state: files in `~/.claude/island/`, one per session; stale entries are ignored by age in `pickState` (`DONE_VISIBLE_MS`, `RUNNING_STALE_MS`, `WAITING_STALE_MS`) rather than deleted.
- In-memory in main: `islands` (Map keyed by `display.id`), `savedOffsets`, `lastPickedState`, `shownWindowPid`, `shownPermissionId`, `shownPermissionSince`, `dragStartPositions`.
- Renderer: `current`, `hovering`, `armedPermissionId`, `answeredPermissionId`, `readPermissionId` in `index.html`.

## Key Abstractions

**Session file:**
- Purpose: the per-session record that every process reads and writes.
- Examples: `hook.js` (write), `permission-hook.js` (write `waiting` + permission), `main.js` `readSessions` (read).
- Pattern: plain JSON `{ state, detail, project, windowPid, permission?, updatedAt }`, file name is the sanitized `session_id`.

**Permission request:**
- Purpose: a pending approval, identified by a UUID that is the only thing a decision refers to.
- Examples: `permissionRequest` and `validPermission` in `state.js`; `writeDecision` in `main.js`.
- Pattern: create → publish → poll → consume (decision file removed by the reader).

**Decision output:**
- Purpose: the exact JSON Claude Code expects from a PermissionRequest hook; intentionally no `updatedPermissions`, so approvals never persist.
- Examples: `decisionOutput` in `state.js`.

**Display island:**
- Purpose: one transparent always-on-top window per monitor.
- Examples: `createIsland`, `syncIslands`, `islands` Map in `main.js`.

## Entry Points

**Electron app:**
- Location: `main.js` (declared as `"main"` in `package.json`)
- Triggers: `pnpm start` (`electron .`), or `hook.js` spawning `electron` with the repo dir on `SessionStart` when the heartbeat is stale.
- Responsibilities: single-instance lock, heartbeat, window creation, polling loop, IPC.

**Event hook:**
- Location: `hook.js`
- Triggers: Claude Code events `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Notification`, `Stop`, `SessionEnd` (list in `install.js` `EVENTS`).
- Responsibilities: write session state; start the island.

**Permission hook:**
- Location: `permission-hook.js`
- Triggers: Claude Code `PermissionRequest` event (registered with a timeout of `PERMISSION_WAIT_MS / 1000 + 30` seconds).
- Responsibilities: publish a permission request and return the user's decision.

**Installer CLI:**
- Location: `install.js`
- Triggers: `pnpm hooks:install`, `pnpm hooks:uninstall` (`--uninstall` flag).
- Responsibilities: edit `~/.claude/settings.json` safely (parse first, backup, then write).

**Tests:**
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

**What happens:** Hook scripts swallow errors in `catch {}` and exit 0. Only `permission-hook.js` writes to stdout, and only with a decision.
**Why it's wrong:** Any stray `console.log` in `hook.js` or `permission-hook.js` corrupts Claude Code's hook protocol; any uncaught exception can break the user's session.
**Do this instead:** Keep stdout silent in `hook.js`; in `permission-hook.js` write only `decisionOutput(...)` output. Follow the existing `try { ... } catch { // comment explaining why silent }` shape (`hook.js`, `permission-hook.js`).

### Trusting data read from disk

**What happens:** Session and permission files are re-validated on read (`validPermission`, `windowPid` `isPid` check, `contextUsage` clamping, numeric check on saved offsets in `savedPosition` (`main.js`)).
**Why it's wrong:** The files are writable by any local process and hand-editable.
**Do this instead:** Validate at the point of use, as `pickState` and `validPermission` in `state.js` do. Do not add a new field from disk without a check.

### Renderer-supplied identifiers

**What happens:** The renderer never sends a permission id or a PID; `island:decide` and `island:focus` act on main-process state (`shownPermissionId`, `shownWindowPid`).
**Why it's wrong:** A renderer-supplied id would let a stale or crafted message approve a different command.
**Do this instead:** Keep new IPC messages argument-light: pass intent (`'allow'`, `'deny'`) and resolve the target in `main.js`.

### Writing decisions non-atomically

**What happens:** `writeDecision` writes a `.tmp` file and renames it. `hook.js` and `permission-hook.js` also rewrite session files in place.
**Why it's wrong:** A reader can see a half-written file; `readSessionState` returns `undefined` for that case and the next poll retries.
**Do this instead:** For any file the other process polls for, use temp-then-rename. Treat `undefined` as "try again", not as an error.

## Error Handling

**Strategy:** Fail silent in the hooks; log and continue in Electron. Errors that matter to the user (e.g., a failed focus) go to `console.error` with a Portuguese message.

**Patterns:**
- Hooks: outer `try/catch` on the whole stdin handler; inner `catch` with a comment on each expected failure (missing file, `ENOENT`).
- Permission hook: any error inside the poll interval calls `clearInterval` and ends the wait without output (`permission-hook.js`).
- Main process: failures writing `positions.json`, heartbeat, or decisions are logged with `console.error` and the app keeps running.
- Focus: `focusWindow` takes a callback `onDone(error)`; `findWindowPid` never throws and returns `null`.

## Cross-Cutting Concerns

**Logging:** `console.error` only, in `main.js` and `window.js`. Hooks do not log.
**Validation:** Input validation sits in `state.js` (`isReadablePermissionText`, `isPermissionTool`, `isHeartbeatFresh`, `contextUsage`). Keep new validation there so tests in `island.test.js` cover it.
**Authentication:** Not applicable. The trust boundary is local: the user's own Claude Code session and the island window, both on the same OS account.
**Localisation:** UI strings, comments, and user-facing messages are in Portuguese (pt-BR). Code identifiers are in English.

---

*Architecture analysis: 2026-11-20*
