---
phase: 02-funda-o-segura-do-gate-de-permiss-o
fixed_at: 2026-11-21T05:25:50Z
review_path: .planning/phases/02-funda-o-segura-do-gate-de-permiss-o/02-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-11-21T05:25:50Z
**Source review:** .planning/phases/02-funda-o-segura-do-gate-de-permiss-o/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (CR-01, WR-01..WR-04; IN-01..IN-03 out of scope)
- Fixed: 5
- Skipped: 0

**Verification:** run directly in the worktree checkout `claude-island-fase2` (branch `feat/fase-2-seguranca`), the same tree these commits are on. No nested worktree was created: the orchestrator handed over this worktree. `pnpm test` gives 162/162 passing (143 before). Electron was not started, as required (another session measures the running island). So CR-01, WR-01 and WR-02 are verified only by tests and source locks, not at runtime.

A scratch mutation harness (not committed) copied the test inputs and normalized them to LF, the line endings of a CI or Linux checkout. It then applied 16 regressions one at a time: each of the guards below removed or bypassed, the `shown.since`/`shown.id`/`Object.assign(shown)` writes, channels in double quotes, backticks or a variable, `webContents.ipc`, a SyntaxError in the glue, and a repeated `const`. `gate.test.js` failed on all 16, and the unmutated baseline passed.

## Fixed Issues

### CR-01: The island window can be navigated and the new page inherits `window.island`

**Files modified:** `main.js`, `state.js`, `gate.test.js`, `fixtures/permission-vectors.json`
**Commit:** 4c0efdd
**Status:** fixed: requires human verification (runtime behavior in Electron)
**Applied fix:**
- **Navigation:** every island window now handles `will-navigate` and `will-redirect` with `preventDefault`, and `setWindowOpenHandler` returns `deny`. The window loads with `loadURL(ISLAND_URL)` (`pathToFileURL` of `index.html`) instead of `loadFile`, so the URL it loads from and the URL it checks against are the same string.
- **Sender check:** the new pure predicate `isIslandSender({ isMainFrame, url, islandUrl })` in `state.js` has 14 vectors in the fixture. It accepts only the main frame (`isMainFrame === true`) whose URL matches the island URL exactly, with no query or fragment. Before comparing, it normalizes drive-letter case and percent-encoding, so Chromium's and Node's spellings of the same file still match. Malformed encoding is refused.
- **Every handler:** `islandOf(event)` now returns `null` for an untrusted sender (`event.senderFrame === event.sender.mainFrame` plus the URL check). All six `ipcMain.on` handlers route through it; `island:focus` used not to call it and now does.
- **Outgoing state:** `sendState` sends only to a window whose `getURL()` is the island page, because the state carries the permission text.
- **Tests:** a source lock checks the three navigation guards, `loadURL(ISLAND_URL)`, that no `loadFile` remains, and that every handler calls `islandOf(event)`.

**Human check:**
- In the running island, Permitir and Negar must still work. If the URL comparison were wrong for this path, every click would be refused (fail-safe).
- Dropping a link or file onto the pill must not navigate the window.

### WR-01: A silent refusal in the main locks Permitir/Negar

**Files modified:** `main.js`, `index.html`, `gate.test.js`
**Commit:** 956197b
**Status:** fixed: requires human verification (state-handling logic)
**Applied fix:**
- **Main:** in `island:decide`, a refusal now calls `sendState(island)` before returning. A failed `writeDecision` does the same, so the user can retry. The reply goes only to the trusted sender, through the existing `island:state` channel. No new channel was added, so the closed-list test is unchanged.
- **Renderer:** `onState` clears `answeredPermissionId` on every state message. The local lock now covers only the IPC round-trip; after that, the main's `answeredId` keeps the lock.
- **No automatic resend:** the renderer never resends a decision on its own. The test asserts `window.island.decide(` appears exactly once (in the click handler). The main's `decidedPermissionId` still refuses a second decision.

### WR-02: The settle detector watches `#actions`, not the buttons

**Files modified:** `index.html`, `gate.test.js`
**Commit:** a65d290
**Status:** fixed: requires human verification (renderer layout logic, not runnable without Electron)
**Applied fix:**
- **What is measured:** a new `buttonsRect()` returns the union of the Negar and Permitir boxes. `waitUntilSettled` now measures that instead of `#actions`.
- **Where the buttons armed:** that rectangle is stored as `armedRect` at the moment of arming.
- **Rearm on movement:** `render()` (after the `has-window` toggle) and the button `pointerdown` (before `canPress`) both call `restartArming()` when the buttons are no longer at `armedRect`. On `pointerdown` this also voids that click, because `armed` drops to false.
- **Untouched:** the ResizeObserver stays for size changes. The CSS (including `@keyframes glow`) and the CSP were not changed.

### WR-03: Holes in the I2 and I9 source-lock tests

**Files modified:** `gate.test.js`
**Commit:** 2bd9069
**Applied fix:**
- **I2:** besides the 2 whole-binding assignments, the test now checks:
  - the declaration is `let shown = {`;
  - `shown = nextShown;` sits inside the body of `refresh`;
  - there are no field writes: `shown.x =`, compound operators, `shown[...] =`, `++`/`--`, `delete shown.x`, or `Object.assign`/`defineProperty`/`setPrototypeOf(shown`.
- **I9:** `collectChannels` now accepts `'`, `"` and backtick channels. It asserts that every mention of `ipcMain`/`ipcRenderer` other than the `require` one is a call with a literal channel, which catches variable channels, aliases and bracket access. It also refuses renaming in the destructured `require`.
- **Per-webContents IPC:** a new test refuses `.ipc` and `ipc-message` in `main.js` and `preload.js`.

### WR-04: No test compiles the full inline renderer script

**Files modified:** `gate.test.js`
**Commit:** d325ffd
**Applied fix:** the new test `o script inline do index.html compila inteiro` asserts there is exactly one `<script>` and compiles its whole body with `new vm.Script`. It catches SyntaxErrors in the glue and early-error redeclarations; both were confirmed by mutation.

## Out of scope (not attempted)

IN-01, IN-02 and IN-03 remain open in 02-REVIEW.md (fix scope was Critical + Warning).

## Travas da cola (pós-verificação)

**Commit:** 48ef5cf (`gate.test.js`, só testes; nenhuma mudança de comportamento em tempo de execução)

A verificação mostrou que a suíte provava as regras puras, mas não a cola que as chama. Foram acrescentadas sete travas de fonte em `gate.test.js`. Elas leem o texto e aceitam CRLF ou LF e espaços em volta:

- **Mapeamento de `island:decide`:** o objeto passado a `acceptDecision` é comparado chave por chave, na ordem. O eco vem de `pressedId` (renderer); `shownId`, `shownSince` e `now: performance.now()` vêm do main; `windowVisible` e `withinVisibleArea` vêm de `isVisible`/`isMinimized`/`getBounds`. Também ficam travadas a assinatura do handler e o eco no `preload`. Uma chave duplicada também quebra o teste.
- **Gravar e só depois marcar:** `writeDecision(verdict.permissionId, verdict.behavior)` precede `decidedPermissionId = verdict.permissionId`, e `decidedPermissionId` só é atribuído na declaração e ali.
- **`refresh` e payload:** ficam travados o retorno antecipado que olha estado e época, o `reason === 'rearm'` repassado ao reducer e `answeredId`/`armEpoch` no `island:state`.
- **Renderer:**
  - nenhuma regra de botão ou de `:hover` com `transform`/`scale`/`translate`/`rotate`/`zoom`;
  - a roda chama `stopPropagation` e `preventDefault` na janela de assentamento, com `passive: false`;
  - a chamada a `canPress` no pointerdown e os argumentos de `isValidRelease` no clique estão travados;
  - o eco enviado é o `pressed.id` capturado no pointerdown;
  - as travas de `render` (`wasRead`, `answeredId`) e o rearme por época ou id estão travados.

Avaliei extrair a cola para uma função pura em `state.js` e não fiz: um construtor puro ainda deixaria no `main.js` a chamada com os mesmos argumentos, que precisaria da mesma trava. Por isso ficou só a trava de fonte, o menor diff.

**Mutações:** a bateria do verificador foi aplicada a uma cópia completa do repositório, com o `gate.test.js` atual, mais 9 mutações extras. Exemplos de extras: gravar o `behavior` cru ou o id do eco, chave duplicada que fixa um fato, hover que escala a pílula, `zoom` em Negar, roda passiva.

| Bateria | Antes | Depois |
|---------|-------|--------|
| Verificador (26) | 3 mortas, 23 sobreviveram | 26 mortas, 0 sobreviveram |
| Extras (9) | 1 morta, 8 sobreviveram | 9 mortas, 0 sobreviveram |

Nos dois casos a linha de base, sem mutação, passou. A suíte tem 169 testes verdes e passa também com `index.html` em CRLF e `main.js` em LF. As travas fixam a ligação, mas não provam o comportamento real de DOM, que continua com os UAT.

---

_Fixed: 2026-11-21T05:25:50Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
