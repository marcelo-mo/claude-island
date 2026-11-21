---
phase: 02-funda-o-segura-do-gate-de-permiss-o
reviewed: 2026-11-21T05:15:43Z
depth: deep
files_reviewed: 7
files_reviewed_list:
  - state.js
  - main.js
  - preload.js
  - index.html
  - gate.test.js
  - fixtures/permission-vectors.json
  - THIRD_PARTY_NOTICES.md
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
  necessity: 0
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-11-21T05:15:43Z
**Depth:** deep
**Files Reviewed:** 7
**Status:** issues_found

## Summary

I reviewed the diff `2530f30..HEAD` for the 7 files in scope. For cross-file context I also read `permission-hook.js` and `hook.js`, which this phase did not change. `node --test` passes: 143 tests, 0 failures.

The main-process gate holds up when the renderer is the real `index.html`:
- `acceptDecision` always targets `shown.id`, and the echo can only refuse.
- `shown` changes only inside `refresh`.
- Arming uses `performance.now()` in both processes.
- `decidedPermissionId` is set only after a successful `writeDecision`, inside one synchronous handler turn.
- `armToken` generations correctly invalidate presses that started under an older arming.

I found no race in which a click approves a request other than the one the user saw.

The blocker is one level down: the gate assumes the sender is the trusted `index.html`, and nothing enforces that. An island window can be navigated to arbitrary content, and that content gets the full `window.island` bridge. The warnings cover:
- a silent main-side refusal that permanently locks the buttons for that request;
- a settle detector that watches the container instead of the buttons;
- holes in the source-lock tests;
- no test that compiles the whole renderer script.

`hook.js` and `permission-hook.js` are unchanged. The `state.js` additions have no top-level side effects that could break the hooks.

## Critical Issues

### CR-01: The island window can be navigated (drag-and-drop of a link or file), and the new page inherits `window.island` and can approve any request

**File:** `main.js:186-216` (createIsland), `main.js:290-316` (island:decide)
**Issue:** Nothing stops the island's `webContents` from navigating:
- there is no `will-navigate` handler and no `setWindowOpenHandler`;
- the `island:decide` handler checks only that the sender is one of the island windows, never which page is loaded in it.

By default, Chromium navigates a window when a file or link is dropped onto the page. The preload runs on every navigation of that `webContents`, so the new page (a local HTML file, or a remote `https://` page if a link was dragged) gets the whole bridge:
1. `window.island.onState` delivers `permission.id` and `permission.text`.
2. It calls `window.island.decide('allow', id)` after 800 ms.
3. The main accepts: the echo matches, the request is armed, the window is visible and inside its work area.

The result is automatic approval of every later Claude Code permission request, which is effectively command execution. The new page also runs under its own CSP, not the `default-src 'none'` of `index.html`.

How reachable this is depends on the platform:
- **Linux:** `CAN_CLICK_THROUGH` is false (`main.js:22`), so the whole transparent 440x324 rectangle at the top center of the screen accepts drops.
- **Windows and macOS:** drops land when the cursor is over the pill.

The summary for 02-04 left `will-navigate` and `setWindowOpenHandler` out of scope because "o renderer não tem links". Drag-and-drop navigation needs no link inside the page. This is the one path where the renderer side of the trust boundary becomes attacker-controlled, and every check in `acceptDecision` (echo, arming, first click wins) assumes the sender is the real `index.html`.

**Fix:** Block navigation and new windows, and bind `island:decide` to the expected page:
```js
// main.js, createIsland, after new BrowserWindow(...)
const ISLAND_URL = require('node:url').pathToFileURL(path.join(__dirname, 'index.html')).href;
island.webContents.on('will-navigate', (event) => event.preventDefault());
island.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

// main.js, island:decide (and ideally every ipcMain.on): refuse a frame that is not the island page
ipcMain.on('island:decide', (event, behavior, pressedId) => {
  if (event.senderFrame !== event.sender.mainFrame || event.senderFrame.url !== ISLAND_URL) return;
  ...
});
```
Add a source-lock test for `will-navigate` and `setWindowOpenHandler`, in the same style as the `webPreferences` lock.

## Warnings

### WR-01: A silent refusal in the main locks Permitir/Negar for that request until it leaves the screen

**File:** `index.html:471-474`, `index.html:389`; `main.js:306`
**Issue:** The renderer sets `answeredPermissionId = pressed.id` before it knows whether the main accepted. Nothing ever clears it, and `locked` includes `permission.id === answeredPermissionId`. When the main refuses, it returns without sending anything (`if (!verdict.accept) return;`). So any refusal leaves both buttons disabled for that request for good. The user gets no feedback and has to answer in the terminal, which undermines the core value of the feature.

This phase added refusal paths that are reachable while the renderer is legitimately armed:
- **Rearm race:** `display-metrics-changed`, `show` or `restore` makes the main bump `epoch` and reset `since`. A click already in flight from the still-armed renderer reaches the main within 800 ms of the new `since` and is refused `not-armed`. The renderer then receives the new `armEpoch` and rearms, but the buttons stay locked.
- `outside-visible-area` when DPI rounding exceeds the 2 px tolerance, and `window-hidden`.

This fails safe (no wrong approval), but it is a real defect in how the gate behaves.
**Fix:** Let the main own the lock. On refusal, push state back so the renderer can unlock, and keep the local lock only until the next state message:
```js
// main.js
if (!verdict.accept) { sendState(island); return; }

// index.html, onState (before render)
answeredPermissionId = null; // the main's answeredId is the authority; the local lock only covers the IPC round-trip
```
The double-click protection stays: `decidedPermissionId` in the main still refuses a second decision.

### WR-02: The settle detector and the ResizeObserver watch `#actions` and `#pill`, not the buttons, so a shift inside the container does not rearm

**File:** `index.html:418-419`, `index.html:443-445`; CSS `index.html:72,74,176,179`
**Issue:** `waitUntilSettled` measures `actions.getBoundingClientRect()`, and the ResizeObserver only fires when an element's size changes. Toggling `has-window` while a request is shown moves Negar and Permitir horizontally but changes neither box:
- `#pill.has-permission:not(.has-window) #open { display: none }`, otherwise `#open` takes `margin-right: auto` and pushes both buttons to the right edge;
- `#actions` keeps the same width (`min-width: 100%`) and height;
- `#pill` height does not change either: `#pill.expanded.has-permission { height: auto }` (line 74) has the same specificity as `.has-window { height: 148px }` (line 72) and comes later, so it wins.

The buttons therefore jump under a stationary cursor with no rearm. This is the exact threat the settle rule exists for. Today it needs `windowPid` to change for the same session while a request is shown, which is narrow (state file missing before the `PermissionRequest`). But any future layout change inside `#actions` hits the same blind spot: Phase 3 springs, Phase 5 session switching, a new button.
**Fix:** Track the buttons themselves:
- in `frame()`, compare the union of `allowButton.getBoundingClientRect()` and `denyButton.getBoundingClientRect()` instead of `#actions`;
- store that rect when arming;
- in `pointerdown`, call `restartArming()` and refuse when the pressed button's current rect differs from the stored one.

As a cheaper interim fix, rearm in `onState` when `Boolean(next.windowPid) !== Boolean(previous.windowPid)` while a request is shown.

### WR-03: The source-lock tests for I2 and I9 have holes that let the guarded regression through

**File:** `gate.test.js:47-51`, `gate.test.js:177-196`
**Issue:**
- **I2:** `/(?<![\w.])shown\s*=(?!=)/` counts only whole-binding assignments. A mutation such as `shown.since = performance.now()` or `shown.id = null` in the decide handler, or `Object.assign(shown, …)`, would change the decision target or the arming clock outside `refresh` and still pass. The test also never checks that the second assignment is inside `refresh`.
- **I9:** `collectChannels` matches only single-quoted literals (`'([^']+)'`). It misses:
  - double-quoted or template channels (`ipcMain.handle("island:set-pref")`, `` ipcRenderer.invoke(`x`) ``);
  - variable channel names;
  - the per-webContents IPC API (`island.webContents.ipc.on(...)`), which never mentions `ipcMain`.

A new preference channel added in any of these forms passes the "closed list" test that is supposed to force a deliberate edit.

**Fix:**
- I2: make `shown` immutable outside `refresh`, either by freezing the object `nextShownPermission` returns (`Object.freeze`) or by matching `shown\s*\.\s*\w+\s*=` and `Object.assign\(\s*shown` with an expected count of 0.
- I9: match `['"\`]`, and assert that the number of `ipcMain.`/`ipcRenderer.` occurrences equals the number of literal-channel matches, so non-literal channels fail. Also assert `!/\.ipc\.(on|handle|once)/.test(mainSource)`.

### WR-04: No test compiles the full inline renderer script; the vm harness only covers the marked block

**File:** `gate.test.js:74-85`; `index.html:226-590`
**Issue:** `loadRendererRules` evaluates only the text between `regras-do-gate:inicio` and `:fim`, so the predicates themselves are tested faithfully. The glue below them is never parsed by any test. Two examples that would pass all 143 tests while making the renderer script throw at load:
- a `SyntaxError` in the glue;
- an early-error redeclaration (another `const WHEEL_SETTLE_MS` added outside the block; it would compile fine in the isolated vm block).

The 02-03 summary says the whole script was compiled once by hand with `new vm.Script`, but that check was not kept as a test. A broken renderer shows no buttons, yet the main keeps writing the heartbeat, so `permission-hook.js` (`isIslandAlive`) still publishes requests and waits up to `PERMISSION_WAIT_MS` for a click that cannot happen.
**Fix:** Add one cheap test:
```js
test('o script inline do index.html compila inteiro', () => {
  const scripts = [...rendererSource.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new vm.Script(scripts[0]));
});
```

## Info

### IN-01: A text change under the same request id does not rearm, in either the main or the renderer

**File:** `index.html:512-523`; `state.js:230-233`
**Issue:**
- The renderer treats a text change as a content change only for the wheel window (`contentChangedAt`). `restartArming` runs only on an `armEpoch` change or a new id.
- `nextShownPermission` keys only on `id`.

If the displayed `text` changes while the id stays the same, Permitir stays armed with the new text. The decision then reaches the hook, which holds the original text. Today this needs an external write to the state file (`hook.js` copies the `permission` object as-is on `Notification`), which is outside the same-user threat model. Still, the comment at `index.html:344` says text is part of "o pedido exibido mudou".
**Fix:** Add `nextText !== previousText` to the rearm condition at `index.html:520`. Optionally, have the main key `shown` on `id` plus a hash of the text.

### IN-02: The "scroll to the end before Permitir" rule depends only on the DOM `disabled` attribute

**File:** `index.html:391`, `index.html:459-470`
**Issue:**
- Every other click rule is in a vector-tested predicate.
- `wasRead` is not part of `isValidRelease`, and the main never sees it.

The rule holds only because Chromium does not dispatch `click` on disabled buttons. That is correct today, but it is an implicit dependency outside the tested contract.
**Fix:** Pass `wasRead: behavior === 'deny' || readPermissionId === pressed?.id` into `isValidRelease` and add vectors for it.

### IN-03: `withinVisibleArea` compares the window with the display it was created for, so it is almost always true

**File:** `main.js:293`, `main.js:304`, `main.js:133-138`
**Issue:**
- `displayOf(island)` returns the display used as the `islands` map key.
- `moveIsland` and `createIsland` always clamp the window to that display's `workArea`.

So `isWithinWorkArea` can only be false in rare cases: DPI rounding over 2 px, or a `display-metrics-changed` event during a drag (`syncIslands` skips dragged islands). It does not detect the island being occluded, or being on a different display than the one it is keyed to. This is fine as defense in depth, but the `outside-visible-area` reason should not be read as real visibility coverage when the Phase 4 probe is designed.
**Fix:** None needed now. Note in the TELA-01 plan that real visibility must come from the occlusion/fullscreen probe, not from work-area containment.

---

_Reviewed: 2026-11-21T05:15:43Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
