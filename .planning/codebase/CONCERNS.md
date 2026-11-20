---
last_mapped_commit: 75d1a08eaa84174fda8d1cb27a0d18392b854fd1
last_mapped_at: 2026-11-20
---
# Codebase Concerns

**Analysis Date:** 2026-11-20

## Summary

The codebase is small (about 1,700 lines across 9 source files) and the security-sensitive
paths are already handled deliberately: the renderer writes only with `textContent`, the
renderer has a CSP, the permission decision is bound to the id shown on screen, and the
decision file is written atomically. The main risks are in the glue between the three
processes that share `~/.claude/island/` (hook, permission hook, island), in the installer,
and in test coverage, which covers only the pure logic in `state.js` and the installer merge.

Ranked by expected impact:

1. `install.js` overwrites the settings backup on every run, so a second install loses the original `settings.json`.
2. Stale permission buttons: a pending permission whose hook has exited stays clickable, and clicking it is a silent no-op.
3. Non-atomic read-modify-write on the shared session state file can drop updates.
4. Session state files are never pruned, and the 400 ms poll re-reads all of them.
5. Hook errors are swallowed with no log, so failures cannot be diagnosed.
6. Most of `main.js`, `window.js`, `hook.js`, `permission-hook.js` and `index.html` has no test.

## Tech Debt

**Installer backup is overwritten on every run:**
- Issue: `install.js` copies `settings.json` to `settings.json.island-backup` unconditionally on every run (`install.js:47`). Running `pnpm hooks:install` twice, or `hooks:uninstall` after an install, replaces the backup with the already-modified file. The only copy of the user's original settings is then gone.
- Files: `install.js:47`
- Impact: Loss of the user's pre-existing hooks and settings, which the README presents as recoverable.
- Fix approach: Create the backup only when it does not exist yet (`fs.existsSync(backup)` check), or write timestamped backups. Add a test to `island.test.js` that runs the install path twice against a temp home and asserts the backup holds the original content.

**Stale hook entries after the repo moves or Node changes:**
- Issue: `isOurs` identifies island hooks by substring match on the current absolute paths of `hook.js` and `permission-hook.js` (`install.js:25-28`). The command string embeds `process.execPath` (`install.js:12`). If the repository folder is moved or renamed, or Node is upgraded to a different path, entries from the previous install are not recognized as ours and are kept.
- Files: `install.js:12`, `install.js:25-28`
- Impact: Claude Code keeps running hook commands that point to a missing script or a removed Node binary, on every event. `hooks:uninstall` does not clean them up either.
- Fix approach: Match on the script file name (`hook.js`, `permission-hook.js` under a `claude-island` marker), not the full absolute path, so any previous install is recognized and replaced.

**Dual PERMISSION_ARM_MS constant:**
- Issue: The 800 ms arming delay is defined in `state.js:16` and duplicated as a literal in `index.html:244`. The comment at `index.html:242-243` says `main.js` is authoritative, but nothing keeps the two values in sync.
- Files: `state.js:16`, `index.html:244`, `main.js:254`
- Impact: Changing one value silently makes the renderer and the main process disagree about when buttons are enabled.
- Fix approach: Pass the value to the renderer through the existing `island:state` payload, or through a preload-exposed constant, and delete the literal.

**Lockfile history mixes npm and pnpm:**
- Issue: `package-lock.json` appears in git history (2 commits) while `pnpm-lock.yaml` and `packageManager: pnpm@11.10.0` are the current tooling.
- Files: `package.json`, `pnpm-lock.yaml`
- Impact: Low. Contributors may generate a stray `package-lock.json`.
- Fix approach: Add `package-lock.json` to `.gitignore`, or add a `preinstall` guard that rejects npm.

## Known Bugs

**Permission button stays clickable after the hook has exited:**
- Symptoms: The island keeps showing "Permitir" / "Negar" after the terminal answered, or after Claude Code cancelled the request. Clicking the button writes a decision file that no process reads, and the island shows no feedback that nothing happened.
- Files: `permission-hook.js:107-110` (withdraws only when the timer runs and the deadline or heartbeat check trips), `permission-hook.js:102-106` (exits silently when another event overwrote the state), `state.js:169` (`validPermission` keeps the permission while the session is `waiting`), `main.js:250-260` (writes the decision without checking that a reader exists), `state.js:27` (`WAITING_STALE_MS` is 12 h).
- Trigger: Answer the permission in the terminal and then cancel the turn (Esc), or kill the Claude Code process, while the island is up. If Claude Code emits no later event for the session, the state file keeps `permission` until `WAITING_STALE_MS` expires. Not verified: whether Claude Code emits `Stop` after an interrupt, which would clear it sooner.
- Workaround: Any new event in the session clears the stale permission. The README documents the terminal-answered case only (`README.md:86-87`).
- Fix approach: When `permission-hook.js` exits for any reason, withdraw its own request (add a `process.on('exit')` handler that calls `withdrawRequest({})`). Also drop `permission` from state when the file's `updatedAt` is older than the hook's deadline, so a crashed hook cannot leave a button behind for 12 h.

**Electron spawn error is not handled in the hook:**
- Symptoms: If the `electron` package is installed but its binary is missing (for example, a failed download, or pnpm's `allowBuilds` not applied), `spawn` emits an asynchronous `error` event that has no listener. The process crashes with an uncaught exception, which contradicts the "silent" contract the hook promises (`hook.js:27`).
- Files: `hook.js:20-22`, `hook.js:27-28`
- Trigger: Start any Claude Code session on a machine where `node_modules/electron` exists without its binary. Not reproduced.
- Workaround: None needed for the session itself, since the crash happens in a separate process, but the error text may surface in Claude Code.
- Fix approach: `spawn(...).on('error', () => {})` before `.unref()`, with a comment explaining why the error is ignored.

**Single-instance lock lets a hung island block its own restart:**
- Symptoms: If the running island is hung (heartbeat stale), `startIslandIfStopped` spawns a new Electron process. That process hits `requestSingleInstanceLock()` and quits. The hung instance keeps the lock, so the island never comes back until someone kills it by hand.
- Files: `hook.js:8-22`, `main.js:294-296`
- Trigger: A renderer or main-process hang. Not reproduced.
- Workaround: Kill the Electron process manually, or run `pnpm start` after killing it.
- Fix approach: In the second instance, if the heartbeat is stale, ask the first instance to relaunch or exit (for example with a second-instance message), or have the hook terminate a stale instance by PID stored in the heartbeat.

**Windows focus can hit a reused PID:**
- Symptoms: `windowPid` is stored once per session and never refreshed (`hook.js:42-52`). After the terminal closes, its PID can be reused by another process. "Abrir sessão" then focuses whatever window that process owns. Failures in `focusWindow` are only written to `console.error` (`main.js:243-245`), so the user sees nothing.
- Files: `hook.js:42-52`, `main.js:241-246`, `window.js:92-105`
- Trigger: Close a terminal with a session still recorded, then reuse the PID. Low likelihood on Windows; PIDs recycle slowly.
- Workaround: None.
- Fix approach: Store the window's process start time alongside the PID and compare it before focusing.

## Security Considerations

**Any same-user process can approve a permission:**
- Risk: The island trusts files in `~/.claude/island/`. A program running as the user can write a `waiting` state with a `permission` object (which the island displays) or write a decision file for a known id. The shown text is what the user reads before clicking, so a forged display can misrepresent a command.
- Files: `state.js:104-111` (`validPermission` checks shape, not origin), `main.js:250-260`, `permission-hook.js:53-63`
- Current mitigation: Permission ids are random UUIDs (`permission-hook.js:50`), the id is not sent by the renderer (`main.js:250-260`), decisions are limited to `allow` or `deny` (`state.js:117-121`), and only the hook that created an id reads its decision. The README states this boundary (`README.md:90-91`).
- Recommendations: Accept this as the stated trust boundary, since a same-user process can already edit `~/.claude/settings.json`. If it is ever tightened, the permission-hook could pass its own random secret to the island through a 0600 file, and the island would show only requests that carry it.

**Renderer hardening relies on Electron defaults:**
- Risk: `window.js` and `main.js:155-169` do not set `sandbox`, `contextIsolation` or `nodeIntegration` explicitly. The security posture depends on the defaults of the Electron version in use (`package.json`, `^45.4.1`).
- Files: `main.js:155-169`, `preload.js:1-11`
- Current mitigation: CSP in `index.html:5` (`default-src 'none'`, with inline script and style allowed), `textContent` for all dynamic text (`index.html:259-280`), and a narrow preload API.
- Recommendations: Set `webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }` explicitly so a future Electron default change cannot weaken the window. The CSP's `script-src 'unsafe-inline'` could be replaced by a hash or a moved script file.

**Windows Alt keypress to bypass focus restrictions:**
- Risk: `window.js:34-35` sends a synthetic Alt down/up to the system so that `SetForegroundWindow` is allowed. The key event goes to whatever is active, which can open a menu bar in another app.
- Files: `window.js:23-36`
- Current mitigation: Documented in `README.md:98-99`.
- Recommendations: Keep as documented. Re-evaluate if a supported alternative such as `AllowSetForegroundWindow` through a helper process becomes practical.

**PowerShell and xdotool resolved through PATH:**
- Risk: `window.js:59`, `window.js:98` and `window.js:101-103` call `powershell.exe`, `osascript` and `xdotool` by bare name. A planted binary earlier in PATH would run as the user.
- Files: `window.js:59`, `window.js:98-103`
- Current mitigation: The PID is validated as an integer (`window.js:10`, `window.js:94`) and passed through the environment, not interpolated.
- Recommendations: Use the absolute path `%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe` on Windows.

**Session id sanitization can merge distinct sessions:**
- Risk: The id is reduced to `[^\w-]` characters (`hook.js:32`, `permission-hook.js:45`). Two different ids that differ only in removed characters write the same state file.
- Files: `hook.js:31-34`, `permission-hook.js:44-45`
- Current mitigation: Claude Code session ids are UUIDs, so collisions are not expected in practice.
- Recommendations: Reject ids that do not match the UUID pattern instead of rewriting them.

## Performance Bottlenecks

**Full directory read every 400 ms:**
- Problem: `setInterval` in `main.js:278-291` calls `readSessions()` every 400 ms. That reads and parses every `*.json` in `~/.claude/island/` (`main.js:106-125`) and reads one `claude-ctx-*.json` per session from the temp dir (`main.js:65-72`, `main.js:118`).
- Files: `main.js:106-125`, `main.js:278-291`
- Cause: Polling instead of `fs.watch` (acknowledged by the `ponytail:` comment at `main.js:274-276`). Cost grows with the number of session files, and see the next item for why that number never shrinks.
- Improvement path: Prune stale files (below) first, which bounds the work. Then consider `fs.watch` with the polling kept only for expiry.

**Session files are never pruned:**
- Problem: A file is removed only on `SessionEnd` (`hook.js:37`). Sessions that end without that event (crash, kill) leave a `<id>.json` behind forever. `pickState` ignores old files for display (`state.js:151-158`) but nothing deletes them. `removeOrphanDecisions` (`main.js:85-94`) prunes decision files only.
- Files: `hook.js:36-37`, `state.js:151-158`, `main.js:85-94`
- Cause: No cleanup for state files.
- Improvement path: In `removeOrphanDecisions`, also delete state files whose `updatedAt` is older than `WAITING_STALE_MS`. Skip files that are still `waiting`.

**Synchronous PowerShell on the first event of each session:**
- Problem: `findWindowPid` runs `Get-CimInstance Win32_Process` for the whole process table, synchronously, inside the hook (`window.js:13-21`, `window.js:58-63`, `hook.js:52`). The README measures about 0.45 s (`README.md:57-58`).
- Files: `window.js:13-21`, `window.js:54-64`, `hook.js:52`
- Cause: Walking parents needs the process table, and the hook must finish synchronously.
- Improvement path: Limit the query to the needed PIDs, or cache the process table for a short time. A null result is cached for the session (`hook.js:41` comment), so a session started before its terminal window exists never retries; a retry on the next `PreToolUse` after a short delay would fix that.

**Focus recompiles C# on every click:**
- Problem: `WINDOWS_FOCUS` runs `Add-Type` with the full C# definition on each "Abrir sessão" click (`window.js:23-36`, `window.js:98`).
- Files: `window.js:23-36`, `window.js:98`
- Cause: Each click starts a new PowerShell process.
- Improvement path: Not measured. If the click feels slow, move the native calls into a small persistent helper process owned by the island, started once.

## Fragile Areas

**Shared state file with non-atomic read-modify-write:**
- Files: `hook.js:54-56` (writes the state file directly), `permission-hook.js:55-63` (writes directly), `permission-hook.js:68-72` (`withdrawRequest` reads, then writes)
- Why fragile: Three processes write `~/.claude/island/<id>.json`. `hook.js` and `permission-hook.js` can run for the same session at the same time, and `withdrawRequest` reads the file, then writes a merged version. A `PostToolUse` write between those two steps is overwritten by the stale merge. The island tolerates a half-written file (`main.js:116-122`), but not a lost update.
- Safe modification: Use the temp-file-and-rename pattern that already exists for decisions (`main.js:96-104`) for every state write. Keep `withdrawRequest`'s "still ours" check, and make the rename the only write.
- Test coverage: None. `island.test.js` does not exercise concurrent writes.

**Coupling to Claude Code hook ordering and payload shape:**
- Files: `state.js:61-68` (`keepsPermission` assumes `Notification` follows `PermissionRequest`), `state.js:39-59` (event names and `tool_name`, `notification_type`), `state.js:92-101` (`tool_input` shape, Bash-only fields), `install.js:9`
- Why fragile: The island depends on undocumented hook behavior: that `PreToolUse` precedes `PermissionRequest`, that `Notification` with `permission_prompt` follows it, and the exact `tool_input` fields. Any change in Claude Code can silently drop permissions or show the wrong text. The `BASH_DISPLAYED_OR_HARMLESS_FIELDS` allowlist (`state.js:71`) fails closed, which is good, but a new Claude Code Bash field would cause every Bash request to fall back to the terminal.
- Safe modification: Record the Claude Code version the hook contract was checked against in `README.md`. Add fixture-based tests from captured payloads.
- Test coverage: The pure functions are tested (`island.test.js:79-152`); the end-to-end ordering is not.

**Electron single-window renderer carries all UI logic:**
- Files: `index.html` (401 lines, 16 commits; the most-changed file in history)
- Why fragile: Styles, markup, and the permission arming, read-to-end and lock logic live in one inline script (`index.html:224-400`). The read-to-end check depends on layout values (`scrollHeight`, `clientHeight`) at `index.html:285-286`, which change with DPI and font rendering.
- Safe modification: Change the arm/lock logic only with the README's behavior in view (`README.md:72-73`). Verify on Windows with a long permission text.
- Test coverage: None.

**Platform-specific code paths:**
- Files: `window.js` (three branches), `main.js:19-21` (`CAN_CLICK_THROUGH`), `main.js:82-91` (window placement)
- Why fragile: Permission approval, focus, and click-through are only tested on Windows (`README.md:92`, `README.md:95-97`, `README.md:104-106`). macOS focus depends on Automation permission. Linux depends on X11 and `xdotool`, and on a compositor for transparency.
- Safe modification: Keep platform branches in `window.js`, and do not add new platform logic to `main.js`.
- Test coverage: None for `window.js`.

**Multi-display identity:**
- Files: `main.js:140-146`, `main.js:228`
- Why fragile: Dragged offsets are keyed by `display.id` (`main.js:228`). The code comment (`main.js:28-31`) notes the id can change across reboots or docks, which resets the island to the top center.
- Safe modification: Change the key only together with the migration of `positions.json`.
- Test coverage: `island.test.js:49-64` covers clamping only.

**Single-instance race on startup:**
- Files: `hook.js:8-22`, `main.js:294-298`
- Why fragile: Two sessions starting together can both spawn Electron. The second quits because of the lock (`main.js:294-296`). This is intended, but it means the hook has no way to know whether its spawn succeeded.
- Safe modification: Keep the lock as the only guard. Do not add a PID file in the hook.

## Scaling Limits

**Number of concurrent sessions:**
- Current capacity: Not measured. Each session adds one state file and, if the GSD statusline is used, one context bridge file.
- Limit: Each poll reads all of them (see Performance). With hundreds of stale files (see Known Bugs and Performance), the 400 ms poll will get slower.
- Scaling path: Prune stale files, then switch to watching the directory.

**One island per display:**
- Current capacity: One `BrowserWindow` per display (`main.js:154-177`), all receiving the same state.
- Limit: Each window is a separate Chromium renderer, sized 440 x 324 (`main.js:13`). Memory cost per display is not measured.
- Scaling path: Not needed for typical use. Measure before adding more features per window.

## Dependencies at Risk

**Electron (major version pinned loosely):**
- Risk: `package.json` pins `electron` to `^45.4.1`. Electron majors change defaults for security flags and the Windows and macOS window APIs. The app depends on `setIgnoreMouseEvents` with `forward`, `setVisibleOnAllWorkspaces` with `visibleOnFullScreen`, and `screen-saver` always-on-top level (`main.js:170-172`).
- Impact: A major upgrade can break click-through, full-screen visibility, or the renderer sandbox.
- Migration plan: Upgrade in a branch. Verify manually on Windows, since that is the only platform with confirmed behavior (`README.md:104`).

**External executables on the user's machine:**
- Risk: `powershell.exe` (Windows, always present), `osascript` (macOS), `xdotool` (Linux, not bundled). Linux focus silently disappears without `xdotool` (`window.js:70-76`).
- Impact: "Abrir sessão" is missing on those systems; no error is shown.
- Migration plan: Document the requirement in `README.md`, and surface a one-time message when a focus attempt fails with ENOENT.

## Missing Critical Features

**No diagnostic logging for hooks:**
- Problem: Every failure in `hook.js` and `permission-hook.js` is swallowed (`hook.js:57-59`, `permission-hook.js:123-125`) by design, so a broken hook leaves no trace.
- Blocks: Diagnosing why a state never updates, why permission buttons did not appear, or why focus failed on one machine. Only the island's own `console.error` calls (`main.js:55`, `main.js:80`, `main.js:244`, `main.js:258`) are visible, and only when the island is run from a terminal.
- Suggested change: An opt-in log file under `~/.claude/island/` (for example, enabled by an environment variable), writing one line per swallowed error with the event name. It must not log the permission text or the command, since those can contain secrets.

**No uninstall path for stale or moved installs:**
- Problem: `hooks:uninstall` only removes entries that match the current absolute paths (see Tech Debt).
- Blocks: Clean removal after the repo is moved.
- Suggested change: The same fix as the installer item above.

## Test Coverage Gaps

**Process entry points and IPC:**
- What's not tested: `main.js` IPC handlers (`main.js:200-261`), including the arming rule in `island:decide` (`main.js:254`), drag offsets (`main.js:213-230`), and display reconciliation (`main.js:181-198`).
- Files: `main.js`
- Risk: The trust boundary for approving commands is not covered by any test. A regression in `island:decide` would be silent.
- Priority: High

**Stdin-driven hook scripts:**
- What's not tested: `hook.js` (`hook.js:24-60`) and `permission-hook.js` (`permission-hook.js:43-115`), including the wait loop, the decision handoff, and the withdraw paths.
- Files: `hook.js`, `permission-hook.js`
- Risk: The lost-update race and the stale-button bug above would be caught by a test that drives the two scripts with a temp `HOME` and a fake island heartbeat.
- Priority: High

**Platform focus code:**
- What's not tested: `window.js` (`findWindowPid`, `focusWindow`) on all three platforms.
- Files: `window.js`
- Risk: Changes can break focus without a failing test. The README lists this as untested on macOS and Linux (`README.md:95-97`).
- Priority: Medium

**Renderer logic:**
- What's not tested: The arm, read-to-end, and lock rules in `index.html:251-301`, and the pill expansion rules in `index.html:251-257`.
- Files: `index.html`
- Risk: The rule that "Permitir" waits for the text to be read is user-facing safety behavior with no test.
- Priority: Medium

**Existing coverage:** `island.test.js` has 9 passing tests (`node --test`, run during this analysis), covering `eventToState`, state priority and expiry, clamping, context usage bands, permission text validation, decision output, heartbeat freshness, and installer merge/idempotence/uninstall (`island.test.js:9-184`). Extend that file, using `node:test` as it already does, for the high-priority gaps above.

---

*Concerns audit: 2026-11-20*
