# Phase 5: Sessões - Pattern Map

**Mapped:** 2026-11-21
**Files analyzed:** 10 (8 modified, 2 optional/new)
**Analogs found:** 10 / 10 (all analogs are git-tracked; verified with `git ls-files`)

Line numbers refer to branch `feat/fase-5-sessoes` at 4743147. Code comments in the project are pt-BR; keep that.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `state.js` (`nextSelection`, `wheelStep`, `isSessionDead`, extended `pickState`, `SNAP_*` consts) | utility (pure logic) | transform | `pickState`, `nextShownPermission`, `contextUsage` in the same file | exact |
| `main.js` (selection state, `firstSeen`/`seenAt` Maps, dead-session sweep, `island:wheel`, `island:select`, refresh funnel) | controller/glue | event-driven + file-I/O | `refresh`, `readSessions`, `island:capture`, `island:drag` | exact |
| `preload.js` (`wheel`, `selectSession`) | bridge | request-response | existing `setCapture`/`drag` lines | exact |
| `index.html` (dots, title=project, `projeto · ferramenta`, "1 de N", wheel listener, dot click, tab-switch spring, accent transition) | component (renderer) | event-driven | `permissionText` wheel listener, `#count`, spring block, `#dots`, `pill pointerdown` | exact |
| `gate.test.js` (new locks + vectors loop) | test | transform | its own `RENDERER_CHANNELS` / `loadInlineBlock` / vector loops | exact |
| `island.test.js` (selection, queue, wheelStep, isSessionDead) | test | transform | `pickState` tests lines 30-55, 119-140 | exact |
| `fixtures/permission-vectors.json` (new vector groups; old ones untouched) | fixture | transform | groups `nextShownPermission` (l.1254), `isWheelSettled` (l.1908) | exact |
| `animation.test.js` (optional: pulse keyframes) | test | transform | its own keyframe test lines 36-43 | role-match |
| `visual.test.js` (optional: dot contrast, 10 theme cases) | test | transform | contrast tests l.264, 282, 366 | role-match |
| `README.md` ("Rolar janelas inativas" line + sessions section) | doc | n/a | "Permitir ou negar pela ilha" section l.67-85 | role-match |

`hook.js` and `permission-hook.js` stay untouched (D-01). A text lock on `path.basename(input.cwd)` in `hook.js` is a test only.

## Pattern Assignments

### `main.js` — validated single-value IPC (`island:wheel`, `island:select`)

**Analog:** `island:capture` handler, `main.js` 511-532. Copy the `islandOf` guard, the type check, the idle ignore.

```javascript
const islandOf = (event) => {
  const frame = event.senderFrame;
  const isMainFrame = Boolean(frame) && frame === event.sender.mainFrame;
  if (!isIslandSender({ isMainFrame, url: frame?.url, islandUrl: ISLAND_URL })) return null;
  return BrowserWindow.fromWebContents(event.sender);
};

ipcMain.on('island:capture', (event, capture) => {
  const island = islandOf(event);
  if (!island || typeof capture !== 'boolean') return;
  if (capture && lastPickedState.state === 'idle') return;
  ...
});
```

Numeric validation precedent (`island:drag`, l.543-546): `if (!display || !Number.isFinite(deltaX) ...) return;`. For `island:select` use `Number.isInteger(index)` and a range check against the current list. Each new handler body MUST contain `islandOf(event)` (lock at gate.test.js 262-268) and must be written as `ipcMain.on('island:wheel', (event, delta) => {` ... closed by `\n  });` at two-space indent (the lock slices the body at `'\n  });'`). Handler order: `islandOf` -> type check -> ignore if `lastPickedState.state === 'idle'` -> mutate selection -> `refresh('wheel')` / `refresh('select')`. Never apply selection inside the handler body itself.

### `main.js` — single funnel (`refresh`, `shown`)

**Analog:** `refresh(reason)`, `main.js` 380-397, and `shown` decl l.42-45.

```javascript
function refresh(reason) {
  const picked = pickState(readSessions(), Date.now());
  const serialized = JSON.stringify(picked);
  const permissionId = picked.permission ? picked.permission.id : null;
  const nextShown = nextShownPermission(shown, permissionId, performance.now(), reason === 'rearm');
  if (serialized === lastSent && nextShown.epoch === shown.epoch) return;
  lastSent = serialized;
  lastPickedState = picked;
  shownWindowPid = picked.windowPid ?? null;
  shown = nextShown;
  for (const island of islands.values()) { applyOpacity(island); sendState(island); }
  updateCursorTick();
}
```

Assignment for the plan:
- Selection (`selection: null | key`), `firstSeenAt` Map, `seenPermissionIds`/`seenAt` Map, `lastWheelAt`, `snapLockUntil` become module-level `let`/`const` next to `shown` with the same style of explanatory comment (see l.36-47).
- `pickState(sessions, now, selection)` (or a sibling) is called here; `nextSelection` runs here per event (`poll`, `scroll`, `select`, `answered`). `shown` stays assigned only here (invariant I2). A selection change that alters `permission.id` is already rearmed by `nextShownPermission` (id differs -> new `since`, `epoch + 1`). A switch between two sessions without a request sets `permissionId` to null -> also new epoch; nothing extra needed.
- `serialized` must include the new `sessions`/`queue` fields, or the early return swallows dot-only changes. Keep `answeredId`, `armEpoch`, `preferences`, `fitsWorkArea` added in `sendState` (l.368-372), not in `picked`.
- The payload must carry NO session key, PID or other-session text (D-09). `shownWindowPid` is still the only PID, kept in main.
- In `island:decide` (l.589-621), after `decidedPermissionId = verdict.permissionId`, the "go to next in queue" step is done by `refresh('answered')`; the handler already calls `sendState` for every island and must keep recusa path `sendState(island); return;` (locked by gate.test.js 273-280 regexes at l.275-276).
- Snap rule: skip when `now - lastWheelAt < SNAP_GESTURE_GAP_MS`; leave it for the next poll (`setInterval(() => refresh('poll'), POLL_MS)`, main.js l.649).

### `main.js` — `readSessions` (attach per-file facts)

**Analog:** `readSessions`, `main.js` 318-337 (the `contextPercent` precedent).

```javascript
const session = JSON.parse(fs.readFileSync(path.join(STATE_DIR, file), 'utf8'));
session.contextPercent = readContextPercent(path.basename(file, '.json'));
sessions.push(session);
```

Add `session.key = path.basename(file, '.json')` and `session.firstSeenAt` the same way (`statSync().birthtimeMs` only when the key is new, `Date.now()` on failure, in a silent `catch` with a pt-BR fallback comment, per CLAUDE.md error-handling rule). `key` is main-only; `pickState` strips it from the renderer payload. Use `isSessionFile(file)` (state.js 530) as the existing gate so `preferences.json` never becomes a session. Dead-session removal: `fs.unlinkSync` inside try/catch, pt-BR comment; liveness via `process.kill(pid, 0)` injected as `isPidAlive` (ESRCH = dead; EPERM or success = alive).

### `state.js` — pure session functions

**Analog:** `pickState`, `state.js` 243-271, and `nextShownPermission` l.302-310.

```javascript
const PRIORITY = { waiting: 3, running: 2, done: 1 };
function pickState(sessions, now) {
  const alive = sessions.filter((session) => {
    const age = now - session.updatedAt;
    if (session.state === 'done') return age < DONE_VISIBLE_MS;
    if (session.state === 'running') return age < RUNNING_STALE_MS;
    if (session.state === 'waiting') return age < WAITING_STALE_MS;
    return false;
  });
  if (alive.length === 0) return { state: 'idle', count: 0 };
  alive.sort((a, b) => PRIORITY[b.state] - PRIORITY[a.state] || b.updatedAt - a.updatedAt);
  const { state, detail, project, windowPid, contextPercent, permission } = alive[0];
  const hasWindow = Number.isInteger(windowPid) && windowPid > 0;
  return {
    state, detail, project, count: alive.length,
    windowPid: hasWindow ? windowPid : null,
    context: contextUsage(contextPercent),
    permission: state === 'waiting' ? validPermission(permission) : null,
  };
}
```

Rules to keep:
- Idle shape `{ state: 'idle', count: 0 }` is asserted by island.test.js l.32; the existing 2-arg `pickState(sessions, now)` tests (l.30-55, 83, 123-140) must still pass, so selection is an optional third argument defaulting to automatic mode.
- Reuse the filter as the "alive" list; keep `validPermission(permission)` as the only source of a pending request (also for dot `pending`).
- New order is by `firstSeenAt` then key, never `PRIORITY` (anti-pattern 2). `PRIORITY` still picks the automatic session.
- Time is a parameter (`now`); no globals. Return `null` for invalid input and say so in the `/** */` pt-BR block, no `@param` tags. Sentinel returns are documented in prose.
- `nextSelection`, `wheelStep`, `isSessionDead(session, now, isPidAlive)` go right after `pickState` (l.271), with their own `module.exports` line (D-19): add a new line in the block at l.666-680 instead of editing existing lines (merge-conflict avoidance with Phase 6, which edits `ANCHORS`/`anchorPosition`/`horizontalSlackFor`/`menuTemplate`).
- Constants carry units: `SNAP_GESTURE_GAP_MS = 400`, `SNAP_WHEEL_LOCK_MS = 400`, `WHEEL_NOTCH = 120`, `WHEEL_GESTURE_PAUSE_MS = 220`, `WHEEL_STEP_MS = 85`, `WHEEL_TOUCHPAD_STEP_MS = 200`, `MAX_SESSION_DOTS = 8` (with a `ponytail:` comment naming the ceiling). Put the mod's MIT notice above the wheel constants using the exact wording below.
- Constant block style, state.js l.26-30:

```javascript
const DONE_VISIBLE_MS = 10_000;
const RUNNING_STALE_MS = 2 * 60 * 60_000;
const WAITING_STALE_MS = 12 * 60 * 60_000;
```

**MIT notice format** (index.html l.432-433, reuse verbatim; for state.js also point to THIRD_PARTY_NOTICES.md):

```javascript
// Constantes de mola portadas do mod Dynamic Island for Windows (MIT, Copyright (c) 2026 devcode90;
// ver THIRD_PARTY_NOTICES.md). ...
```

### `preload.js`

**Analog:** `preload.js` lines 6-12. Add two lines in the same shape; the main side validates:

```javascript
setCapture: (capture) => ipcRenderer.send('island:capture', capture),
drag: (deltaX, deltaY) => ipcRenderer.send('island:drag', deltaX, deltaY),
```

New: `wheel: (delta) => ipcRenderer.send('island:wheel', delta)`, `selectSession: (index) => ipcRenderer.send('island:select', index)`. Only `send` and `on` are allowed methods (gate.test.js l.243-247) and the channel string must be a literal in the call (collected by `collectChannels`).

### `index.html` — wheel listener on the pill (outside `#permission`)

**Analog:** `permissionText` wheel listener, `index.html` 853-859.

```javascript
permissionText.addEventListener('wheel', (event) => {
  event.stopPropagation();
  if (!isWheelSettled(contentChangedAt, performance.now())) event.preventDefault();
}, { passive: false });
```

D-11: attach this to `permissionBox` (`#permission`, l.310-314) instead of only the text, keeping `{ passive: false }` and `isWheelSettled`. The comment at l.854-855 already says Phase 5 will use the wheel on the island; update it. New pill listener: `pill.addEventListener('wheel', (event) => { window.island.wheel(event.wheelDeltaY); ... }, { passive: false })`; the bubbling stop on `#permission` is what makes scrolling to the end never chain into a switch (I8). Send a bare number only. Per D-10 verify `wheelDeltaY` is +-120 per notch; fallback is `-deltaY * 1.2` (sign: wheel up = previous session).

### `index.html` — dots replace `#count`

**Analog:** `#count` and `#dots`, `index.html` 194-198, 209-213, 224, 297, 305, 787.

```css
#dots { display: none; gap: 3px; }
#pill[data-state="running"] #dots { display: inline-flex; }
#dots i { width: 4px; height: 4px; border-radius: 50%; background: var(--accent); animation: hop 1.2s ease-in-out infinite; }
#count { font-size: 12px; color: var(--button-text); background: var(--button); border-radius: 11px; padding: 2px 9px; font-weight: 600; }
#count:empty { display: none; }
```

```javascript
count.textContent = current.count > 1 ? current.count : '';   // l.787
```

Notes:
- `#dots` is the "thinking" animation; the session dots need a new id (`#sessions`) inside `#side` (l.296-307). `#side` hides itself when it has no visible non-empty child (l.193), so keep `#sessions:empty` / `[hidden]` semantics.
- State colors: `--running`, `--waiting`, `--done` (l.10-12; light pair l.54-55, 86-87). Dot colors use these tokens directly, never `--accent` (which is not fixed per state).
- Pulse: any new `@keyframes` may declare only `opacity` and `transform` (animation.test.js l.36-43 fails otherwise). Add the dot selector to the reduced-motion rule at l.283 (animation.test.js l.60-64 checks that rule's first selector list), and give reduced-motion a static ring.
- Touch target >= 16 px even if the dot is smaller (D-12): use padding or a pseudo-free wrapper; there is a lock "nenhum pseudo-elemento além do brilho da Fase 1" (visual.test.js l.360), so do not use `::before/::after` for the hit area.
- Dot `pointerdown` must not start a drag: the existing guard is `event.target.closest('button, #permission')` (l.1069). Either make dots `<button>` elements (already excluded; also keyboard-reachable and accessible) or extend the selector. The `lostpointercapture` click path (l.1097-1101) is skipped for excluded targets.
- Dot click calls `window.island.selectSession(index)` with an integer; clicking the current dot is a no-op in the renderer too (main re-validates).
- Title uses project when `current.sessions.length >= 2` (l.786, `title.textContent = TITLES[...]`); permission header becomes `` `${current.project} · ${permission.tool}` `` (l.804). Ellipsis via CSS (`overflow: hidden; text-overflow: ellipsis; min-width: 0`) on `#title`/`#permission-tool`; note `#permission-tool` currently uses `overflow-wrap: anywhere` and no ellipsis, and `#permission-text` must stay un-truncated (comment l.234-235).
- `#count` returns only when more than 8 sessions (ponytail).

### `index.html` — pure renderer predicates and the tab-switch spring

**Analog:** the `// mola:inicio` ... `// mola:fim` block (l.420-568) and `// regras-do-gate:inicio/fim` (l.323-418). Rules for anything new:
- Put new pure constants and functions inside an existing marked block (extend the `mola` block for the tab spring, so `loadSpringRules` just gains names) or add a new marker pair, with the comment style of l.321-328/l.420-424 (inline because the CSP rejects external scripts; the test executes the text in an empty `vm` context; only constants and functions that never throw, no DOM, no clock).
- New marker pairs must appear exactly once each (`loadInlineBlock` asserts `split(marker).length - 1 === 1`, gate.test.js l.96-103).
- Spring definition shape to copy (l.439-441, 661-674):

```javascript
const SPRING_GROW = { stiffness: 380, damping: 26 };
const SPRING_SHRINK = { stiffness: 200, damping: 28 };
const SPRING_NEUTRAL = { stiffness: 280, damping: 24 };
...
const springs = {
  nudge: { position: 0, velocity: 0, target: 0, direction: 'neutral',
           restDistance: REST_DISTANCE_PX, restSpeed: REST_SPEED_PX_S },
  scale: { position: 1, velocity: 0, target: 1, direction: 'neutral',
           restDistance: SCALE_REST_DISTANCE, restSpeed: SCALE_REST_SPEED },
};
const allSpringsAtRest = () => Object.values(springs).every(isSpringAtRest);
```

- Tab spring: `springParams` returns neutral `SPRING_NEUTRAL` for any `direction !== 'grow' | 'shrink'`, and the `springs` map is stepped as a whole in `springFrame` (l.761-763), so a new neutral entry `tab` (offset in px, rest 0, from +-34 px; scale 0.965 -> 1 can be a second entry or derived) automatically joins `allSpringsAtRest()` and therefore `canArm` (l.414-417, call site l.902). Needs its own stiffness/damping (k=250, c=31): either add a `direction: 'tab'` branch in `springParams` (extend the block, keep the "unknown direction -> neutral" contract and its test) or a dedicated constant with `springStep` reading it. Put the MIT notice above these constants (copy l.432-433 wording).
- Kick-off pattern: the nudge is started by writing position with `target: 0` and then `render()` -> `startSpringLoop()` (l.1013). Do the same for the tab spring when `current.sessions` index changes.
- Apply the offset in `applySprings()` (l.704-710), which is the only writer of `pill.style.transform` (SEG-03: no CSS hover/button transforms). Animate the content container only; swap text and request id atomically (D-17), do not clone DOM layers.
- Reduced motion: `startSpringLoop` already snaps all springs (l.744-748); with `reducedMotion.matches` set the tab offset to 0 at switch.
- Contenta marks: `contentChangedAt = performance.now()` plus `setTimeout(render, WHEEL_SETTLE_MS)` and `restartArming()` happen in `onState` when id/epoch/text change (l.1019-1033); a session switch changes the id or epoch, so this already fires. A switch between two request-less sessions does not change the id; the plan must also reset `contentChangedAt`, the read flag and `press` on the session change (D-15) by extending that condition.
- Accent lerp: a plain CSS `transition: background-color .2s` (or on the accent-dependent property) on the pill accent, not on `#permission` (opaque own colors, `--perm-bg`).

### `gate.test.js` — locks and vectors

**Analog:** same file.

- Channel lists (l.236-247, 295-302): raise `RENDERER_CHANNELS` with `'island:wheel', 'island:select'`; rename the tests ("nos nove canais", "nos sete canais") to the new counts (11 total, 9 handled by ipcMain).
- `handlers.length` lock (l.263-268): `assert.equal(handlers.length, 7)` -> 9. Each handler body must match `/islandOf\(event\)/`.
- Block loaders: reuse `loadInlineBlock(startMarker, endMarker, exportedNames)` (l.96-103); `loadSpringRules` (l.586-593) gains the new exported names.
- Vector loops (l.24-28, 37-42, 130-166): one `for (const vector of vectors.<group>)` + `test(\`name: ${vector.name}\`, () => assert.deepEqual(fn(input), vector.expect))`. Add groups for `nextSelection`, `wheelStep`, `isSessionDead` and a `sessionSwitch` group that drives `nextShownPermission` + `acceptDecision` together (after a switch by wheel/dot/snap/queue: `acceptDecision` -> `not-armed` at 799 ms, accept at 800 ms; echo of the old id -> `echo-mismatch`).
- Constant-equality test (l.121-128): mirror each renderer/state constant against a fixture key (`snapGestureGapMs`, `snapWheelLockMs`, ...).
- Text locks (style of l.273-280, 284-293): assert the strings in `main.js`/`index.html` (the `island:wheel` body includes `Number.isFinite`; `island:select` includes `Number.isInteger`; the renderer never sends a session key; `window.island.decide(` still appears exactly once, l.279).

### `fixtures/permission-vectors.json`

**Analog:** groups `nextShownPermission` (l.1254-1417) and `isWheelSettled` (l.1908-1950); scalar constants at top level (`"armMs": 800`, `"wheelSettleMs": 400`).

```json
{
  "name": "pedido novo A a partir do vazio reinicia o instante e sobe a época",
  "input": { "shown": { "id": null, "since": 0, "epoch": 0 }, "permissionId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "now": 1000, "rearm": false },
  "expect": { "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "since": 1000, "epoch": 1 }
}
```

Add new top-level groups only (append at the end, after `canArm`); leave existing groups byte-identical (D-15). Pattern: `name` in pt-BR, `input`, `expect`; ids are `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`, `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb` style v4 UUIDs. `acceptReasons` (l.4-13) must stay in sync: gate.test.js l.19-21 requires every listed reason to have a vector and vice versa.

### `island.test.js`

**Analog:** tests at l.30-55 and l.119-140 (`pickState` with inline session objects and a fixed `now`):

```javascript
assert.deepEqual(pickState([], now), { state: 'idle', count: 0 });
assert.equal(pickState([{ state: 'running', windowPid, updatedAt: now }], now).windowPid, null);
```

Append new tests at the end of the file (D-19), pt-BR names, `node:test` + `assert/strict`, injected `isPidAlive` and `now`, no clock. Include the explicit SESS-06 test: "concluído" and "voltou a trabalhar" never change the selection; only a new valid permission id does, once.

### `README.md`

**Analog:** section "Permitir ou negar pela ilha", l.67-85: a bold-lead bullet list in pt-BR. Add a "Várias sessões" section with the wheel/dot/queue behavior and one line about Windows' "Rolar janelas inativas ao passar o mouse sobre elas" (D-02).

## Shared Patterns

### Trust boundary on IPC
**Source:** `main.js` 511-532, 589-621; CLAUDE.md "Error Handling". Renderer sends only a number or integer; main decides the target; the renderer never supplies a key or id. Permitir/Negar always targets `shown.id`.

### Single funnel
**Source:** `refresh` (main.js 380-397). All selection changes call `refresh(reason)`; `shown` is assigned nowhere else. Reasons in use: `'poll'`, `'rearm'`; add `'wheel'`, `'select'`, `'answered'`.

### Pure logic with time as a parameter
**Source:** state.js `pickState(sessions, now)`, `nextShownPermission(shown, permissionId, now, rearm)`. Never reads the clock; main passes `Date.now()` for session ages and `performance.now()` for arming (main.js l.384-386 comment).

### Silent catch with fallback comment
**Source:** `readSessions` (l.320-334). Every empty `catch {}` carries a pt-BR comment stating the fallback.

### Cross-process file writes
**Source:** `writeDecision` (main.js l.169): write `<file>.tmp` then rename. Dead-session cleanup only deletes; no new cross-process file is introduced.

### Text locks as the regression net
**Source:** gate.test.js l.252-302. New handlers and renderer paths get literal-string assertions in the same style.

## No Analog Found

| File/Piece | Role | Data Flow | Reason |
|---|---|---|---|
| `wheelStep` (gesture accumulator, 120/220/85/200 ms) | utility | transform | Nothing accumulates input over time in this repo. Use the mod's logic (`dynamic-island-for-windows.wh.cpp` l.22541) and `isWheelSettled` (index.html l.393-396) for pure/never-throw style. |
| `process.kill(pid, 0)` liveness | utility | file-I/O | No PID liveness check exists yet; `permission-hook.js` `isIslandAlive` is the closest "optional external fact falls back" precedent. |
| Session dots (`#sessions`) | component | event-driven | No clickable per-item list in the renderer; the buttons (`#open`, `#actions button`, l.925 `pointerdown`) are the nearest interactive pattern. |

## Metadata

**Analog search scope:** `main.js`, `state.js`, `preload.js`, `index.html`, `gate.test.js`, `island.test.js`, `animation.test.js`, `visual.test.js`, `fixtures/permission-vectors.json`, `README.md`
**Files scanned:** 10
**Pattern extraction date:** 2026-11-21
