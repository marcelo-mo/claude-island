---
phase: 05-sess-es
reviewed: 2026-11-21T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - state.js
  - main.js
  - preload.js
  - index.html
  - spike/tauri/src-tauri/src/shim.js
  - island.test.js
  - gate.test.js
  - fixtures/permission-vectors.json
  - README.md
findings:
  critical: 0
  warning: 4
  info: 7
  total: 11
  necessity: 1
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-11-21
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Reviewed the changes since `ca1438c` (`git diff ca1438c..HEAD`) in the nine files in scope. `node --test` passes (493/493). I also ran a probe script against `nextSelection` for the scenarios below.

**Trust boundary ("never approve what the user wasn't looking at"): no bypass found.** Traced end to end:

- Every `shown` change goes through `refresh()` -> `nextShownPermission`. All three paths (wheel, `island:select`, snap/queue/exit via `nextSelection`) end in `refresh()`. The only assignments to `selection` are `nextSelection(...)` results (also pinned by a text test).
- The renderer sends only a finite number (`island:wheel`) or an integer (`island:select`). Neither carries a key or a permission id. Both handlers use `islandOf(event)`, validate input, and return on idle. `island:decide` still only uses the echo to refuse.
- `refresh()`'s early return compares `serialized` (which includes `sessions[].current`, `queue` and the permission id) and the epoch. Selection and list are updated before the return, so a change in `sessions` or `queue` is not swallowed.
- Wheel over `#permission` stops at `permissionBox` (`stopPropagation`), and the pill handler also checks `closest('#permission')`.
- `springs.tab` is in `springs`, so `allSpringsAtRest()` holds `canArm` until it stops. `--tab-*` is read only by `#lead`, `#detail` and `#permission`, none of which contain a button (`#sessions` and `#open-compact` live in `#side`; Permitir/Negar are in `#actions`).
- Dead-session cleanup is safe. The name comes from `readdir` plus `isSessionFile` (`preferences.json` and `.bad`/`.tmp` excluded; `positions.json` lives in `userData`; `decisions/` is a subdirectory). `windowPid` is validated as an integer > 0, so `process.kill(0, 0)` and the process-group case are excluded. Only `ESRCH` means dead: a pid > 2^31 throws `ERR_INVALID_ARG_TYPE` (checked) and counts as alive. EPERM counts as alive.
- No CRLF in any reviewed file. No `D-xx`/`T-05-xx` label was added to production comments. Only `SESS-02`/`SESS-06` were added, which matches the project's existing `SEG-xx` style.

The findings below are robustness and correctness defects in the selection machinery. None lets a request be approved unseen, because every resulting switch still re-arms.

## Warnings

### WR-01: A transient unreadable session file is treated as the session "exiting", and the island switches away on its own

**File:** `main.js:384-400` (consumed by `state.js:405-430`, `exited` branch of `pollSelection`)
**Issue:** `hook.js:60` and `permission-hook.js:56,72` write the session file with an in-place `writeFileSync` (open-truncate-write, not tmp+rename). `readSessions` catches the resulting empty or partial JSON and simply omits the session from that cycle's array (`// arquivo pela metade`). Before Phase 5 that omission cost one cycle of flicker. Now `sessionList` lacks the key, so `pollSelection` sees `exited = true` for the shown session.

The island then moves to the "never shown" request or to a neighbour, and stays there when the file is readable again on the next cycle. That is exactly the self-initiated switch SESS-06 forbids. If the shown session is the one holding the request being read, the user is bounced off it mid-read.

Probability per poll is small (write rate x write duration, polled every 400 ms plus once per wheel step or click). The hook writes on every tool event, so over a long busy session it will happen, and slow disks or antivirus widen the window.
**Fix:** Keep the last good parse per key and reuse it when the file exists but cannot be parsed this cycle.
```js
const lastGoodByKey = new Map(); // junto de firstSeenAtByKey
// ...dentro do try, depois de montar a sessão:
lastGoodByKey.set(key, session);
// ...no catch:
const previous = lastGoodByKey.get(key);
if (previous) sessions.push(previous); // arquivo pela metade: vale o último estado lido
// e podar lastGoodByKey junto com firstSeenAtByKey
```
Add a test in `island.test.js` that models the unreadable cycle.

### WR-02: A scroll or click away is overridden when the shown request exits in the same refresh

**File:** `main.js:468-474, 685-715`; `state.js` branch 2 of `pollSelection` (`hasShownRequest && !shownIsPending`)
**Issue:** The wheel and select handlers call `nextSelection(scroll|select)` and then `refresh()`. Inside `refresh`, `shown.id` is still the id from before the user's gesture. If that request exited between the previous poll and now (answered in the terminal within roughly 400 ms), the poll sees "shown request gone, session alive" and runs the queue advance. That discards the user's choice.

Confirmed with the probe: selection `C` (just scrolled to, no request), `shownPermissionId: 'X'` no longer pending, `Y` pending on `B` -> result `B`, `snapped: true`. This contradicts D-14/README ("se você estava numa sessão sem pedido, nada se move") for the case where the user left the request in the same instant. The switch re-arms, so it is not a gate breach, but it is a manual selection thrown away and the wheel is locked for 400 ms afterwards.
**Fix:** Pass the shown request's own session key, or make the handlers clear the shown id before polling. Simplest: in the wheel and select handlers, after `nextSelection`, apply the "left the shown session" fact by passing `shownPermissionId: null` for that refresh (for example `refresh(reason, { userSwitched: true })`, which sets `shownPermissionId` to `null` in the poll event).

### WR-03: The project name, which identifies what is being approved, is tail-truncated at 140 px

**File:** `index.html:288` (`#permission-project`), `index.html:211` (`#pill.multi-session #title`)
**Issue:** With two or more sessions, D-08 makes the project name the way to tell which session a request belongs to ("regra de segurança"). The CSS cuts it with `text-overflow: ellipsis` at the end. Two projects sharing a long prefix (`cliente-acme-backend-api` and `cliente-acme-backend-web`) render identically in the request header and the compact title. The only remaining discriminator is dot position, which is not in the request block. README documents only the identical-last-folder case, not this one.
**Fix:** Truncate the head or the middle, which keeps the distinguishing suffix:
```css
#permission-project { direction: rtl; text-align: left; } /* reticências no início */
/* ou ao menos expor o nome completo: title no elemento, ou data-* + aria-label */
```
Alternatively raise `max-width` and shorten the "N de M" slot. At minimum set `permissionProject.title = name` and record the ceiling in a `ponytail:` comment.

### WR-04: A user-initiated switch onto a "waiting" session replays the "needs you" chime

**File:** `index.html:1148-1154`
**Issue:** The comment says "só a chegada a um 'precisa de você' avisa", but `switchDirection !== 0 || next.state === 'waiting'` cannot tell a snap (wanted) from a wheel step or dot click (user already knows). Scrolling across `[waiting, running, waiting, ...]` chimes on every waiting dot passed, and each chime builds a new `AudioContext`. `chime()` runs before `current = next` and `restartArming()`, so any exception from it would abort the rest of the handler and leave the renderer showing the previous request while the main already moved `shown` (the gate would still refuse the stale echo, but the display would be stale).
**Fix:** Have the main tell the renderer whether the change was user-initiated (a `reason` field in the payload, or reuse `shouldChime` per island: chime only when `selection.snapped` or the shown session's own state changed). In the renderer, move `chime()` after the state is applied, or wrap it in `try/catch`.

## Info

### IN-01: Simultaneous pending requests at startup are ordered by UUID

**File:** `state.js:371` (`byRequestOrder`), `state.js:286`
**Issue:** On the first poll every request gets the same `seenAt: now`, so "FIFO by arrival" falls back to lexicographic id, which is random. Probe: sessions `A` (id `z...`) and `B` (id `a...`) at startup -> snaps to `B`. Harmless for safety, but the "1 de N" order and the first snap are arbitrary after an island restart.
**Fix:** Use the file's `updatedAt` as the tie-breaker for requests first seen in the same cycle, or accept it and note it in a `ponytail:` comment.

### IN-02: Queue advance can pull the user back to a request they already saw and left

**File:** `state.js` branch 2 of `pollSelection` (`chosen = sessionOf.get(requests[0].id)`)
**Issue:** `requests[0]` is the oldest remaining request regardless of `shown`. Probe: `Y` already shown and left, `Z` never shown, shown `X` answered -> goes to `Y`, skipping `Z`. D-14 literally says "mais antigo restante", so this follows the spec. But it contradicts the README line "se você rolar ou clicar para longe, ela não puxa de novo", and D-21 prefers never-shown requests on exit.
**Fix:** Prefer `requests.find((r) => !r.shown) ?? requests[0]`. If the current behaviour is intended, say so in the README.

### IN-03: `wheelDeltaY || -deltaY * 1.2` fallback is unreachable in this stack

**File:** `index.html:1296-1299`
**Category:** necessity
**Issue:** Subtype: impossible-state guard (judgment, hence Info). The app runs only on the Chromium bundled with Electron 45.4.1 (`package.json`). It always populates `WheelEvent.wheelDeltaY` (legacy property, still present), and `wheelDeltaY` is `-deltaY * 1.2` for a notch. When `wheelDeltaY` is falsy, `deltaY` is also 0 and the fallback produces 0, so it never changes the result. The comment itself calls it a hedge for a missing property.
**Fix:** Drop `WHEEL_PIXELS_TO_DELTA` and use `event.wheelDeltaY` alone. If Electron later removes the property, the `gate.test.js` text lock will not notice, so keep a one-line note.

### IN-04: Phase-scoped `D-xx` labels in new tests collide with earlier phases

**File:** `island.test.js:762,802,941`, `gate.test.js:1613`
**Issue:** `D-09`, `D-01`, `D-14` and `D-17` here refer to Phase 5 decisions. Existing comments use the same numbers for Phase 4 (`state.js:552` "D-14", `gate.test.js:523` "D-07", `island.test.js:377` "D-13"). A reader cannot tell which phase's decision is meant. Production code is clean: only `SESS-02` and `SESS-06` were added, which are global requirement ids.
**Fix:** Replace the Phase 5 `D-xx` labels in tests with the rule in words, or `Fase 5 D-xx`.

### IN-05: Over-long `require` line and a duplicated request comparator

**File:** `main.js:8`, `state.js:286` vs `state.js:371`
**Issue:** The `./state` destructuring grew to a single line of about 250 characters. The project style asks for multi-line `require` destructuring and lines near 120 characters. `queuePosition` has an inline comparator that duplicates `byRequestOrder` (declared later in the file). The two differ on equal ids (`1` in both directions versus `0`). They are the same rule in two places, so they can drift.
**Fix:** Wrap the destructuring one name group per line. Hoist `byRequestOrder` above `queuePosition` and use it in both.

### IN-06: Session-file deletion can race a hook write

**File:** `main.js:373-380`
**Issue:** `isSessionDead` is decided from a snapshot, then `rmSync` runs. If the hook rewrites the file in between (a more than 12 h old session resuming at that moment), the fresh state is deleted and, for a `permission-hook`, its next `readSessionState` sees `ENOENT`. The window is tiny and the age path is already a documented `ponytail`.
**Fix:** Optional: re-`statSync` the `mtimeMs` right before `rmSync` and skip if it changed since the read.

### IN-07: The dot strip is rebuilt on any `sessions` change, which can cancel an in-flight click

**File:** `index.html:894-909`
**Issue:** `renderSessions` does `replaceChildren` whenever the JSON signature changes (including `pending` toggles). A click is `pointerdown` + `pointerup` on the same element. If a state update lands between them, the button is replaced and the click is lost silently. The consequence is only a missed dot click.
**Fix:** Update `dataset` and attributes in place when the length is unchanged, and rebuild only when the number of sessions changes.

---

_Reviewed: 2026-11-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
