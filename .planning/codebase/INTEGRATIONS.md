---
last_mapped_commit: 75d1a08eaa84174fda8d1cb27a0d18392b854fd1
last_mapped_at: 2026-11-20
---
# External Integrations

**Analysis Date:** 2026-11-20

## APIs & External Services

**Claude Code (host integration, via hooks):**
- Claude Code calls this repo's scripts as command hooks. Registration is written by `install.js` into `~/.claude/settings.json` under `hooks`.
- Events registered (`EVENTS` in `install.js`): `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Notification`, `Stop`, `SessionEnd` -> `hook.js`
- Event registered separately: `PermissionRequest` -> `permission-hook.js` (timeout = `PERMISSION_WAIT_MS / 1000 + 30`, i.e. 330 s)
- Payload contract: JSON on stdin with `hook_event_name`, `session_id`, `cwd`, `tool_name`, `tool_input`, and notification fields. Parsed in `hook.js` and `state.js` (`eventToState`, `permissionRequest`).
- Output contract for `PermissionRequest`: JSON decision on stdout only when the user clicks Allow or Deny in the island (`decisionOutput` in `state.js`). Any other outcome exits 0 with no output, so the terminal prompt remains authoritative.
- SDK/Client: none. Plain stdin/stdout JSON.
- Auth: none (local process invocation).

**Operating system services (called as child processes):**
- Windows: `powershell.exe` with `-NoProfile -NonInteractive -Command` (`window.js`). Used to:
  - Walk process ancestors and find the terminal window (`WINDOWS_FIND`)
  - Bring that window to the foreground (`WINDOWS_FOCUS`), via `user32.dll` `SetForegroundWindow`, `ShowWindowAsync`, `IsIconic`, `keybd_event` (Alt key tap to satisfy foreground rules)
  - PID passed via environment variable `ISLAND_PID`, never interpolated into the script
- macOS: `osascript -e <script>` (`window.js`) for focusing the session window. The OS prompts for Automation/Accessibility permission on first use (per `README.md`).
- Linux: `ps -o ppid= -p <pid>` (`window.js`, `execFileSync`), `/proc/<pid>/stat` for ancestry, and `xdotool search --onlyvisible --pid` / `xdotool ... windowactivate` for X11 window focus. Missing `xdotool` makes discovery return `null` without throwing.

## Data Storage

**Databases:**
- None. No database client, ORM, or schema.

**File Storage (local filesystem IPC, `state.js`):**
- `~/.claude/island/` (`STATE_DIR`): one JSON file per Claude Code session, named by sanitized `session_id` (`hook.js`, `permission-hook.js`). Written by hooks, read by the Electron app's poll loop (`main.js`, every `POLL_MS` = 250 ms).
- `~/.claude/island/.heartbeat` (`HEARTBEAT_FILE`): millisecond timestamp written by the app every `HEARTBEAT_INTERVAL_MS` (2 s). Hooks treat the app as alive when the heartbeat is at most `HEARTBEAT_STALE_MS` (6 s) old. The app deletes it on `will-quit`.
- `~/.claude/island/decisions/` (`DECISIONS_DIR`): one JSON file per pending permission request. The island writes the user's `allow`/`deny` decision here (`main.js`, `island:decide`), and `permission-hook.js` polls for it.
- `~/.claude/settings.json` and `~/.claude/settings.json.island-backup`: read and rewritten by `install.js`.

**Caching:**
- None. Window handle lookups are cached per session as `windowPid` inside the session state file (`hook.js`).

## Authentication & Identity

**Auth Provider:**
- Not applicable. No user accounts, tokens, or network authentication. Trust boundary is the local user account.
- Input hardening relevant to trust: `session_id` is stripped to `[\w-]` before use as a filename (`hook.js`, `permission-hook.js`). The permission text is checked for deceptive control/format characters (`DECEPTIVE_CHARACTERS` in `state.js`) and a short arming delay (`PERMISSION_ARM_MS` = 800 ms) guards against accidental clicks.

## Electron IPC (internal, but externally visible surface)

Renderer to main, exposed by `preload.js` through `contextBridge` as `window.island`:
- `island:hover`, `island:drag`, `island:drag-end`, `island:reset-position`, `island:focus`, `island:decide`
- Main to renderer: `island:state` (state payload and chime flag)

The renderer is loaded with the default `contextIsolation` setting and a preload script; `nodeIntegration` is not enabled in `main.js`.

## Monitoring & Observability

**Error Tracking:**
- None.

**Logs:**
- No logging framework. Hooks fail silently by design (`try/catch` with empty catch in `hook.js` and `permission-hook.js`) so a broken island never breaks a Claude Code session. Use `console.log` output from `install.js` only.

## CI/CD & Deployment

**Hosting:**
- Not hosted. Local desktop app launched with `pnpm start`.
- Single-instance lock via `app.requestSingleInstanceLock()` in `main.js`.

**CI Pipeline:**
- None detected. No `.github/workflows`, no CI config in the repo. Tests run only locally with `pnpm test`.

## Environment Configuration

**Required env vars:**
- None required by the app.
- `ISLAND_PID` is set internally by `window.js` for the PowerShell child process only.

**Secrets location:**
- No secrets are used or stored by this repo. Do not add any; the app has no network calls.

## Network Access

- No outbound network calls in application code (no `fetch`, `http`, `https`, WebSocket, or remote `<script>`/`<link>` in `index.html`). Fonts use the system stack (`system-ui`, `Segoe UI`, `Cascadia Mono`, `Consolas`).
- Audio cue in the renderer (`index.html`) uses `new Audio` and Web Audio oscillators, generated in-process with no audio files fetched from the network.

## Webhooks & Callbacks

**Incoming:**
- None. The app does not listen on any port. Communication with Claude Code is one-shot process invocation via hooks, plus the file-based state and decision files above.

**Outgoing:**
- None.

---

*Integration audit: 2026-11-20*
