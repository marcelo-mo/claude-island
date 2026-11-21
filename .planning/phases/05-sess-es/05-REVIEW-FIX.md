---
phase: 05-sess-es
fixed_at: 2026-11-21T00:00:00Z
review_path: D:/Desenvolvimentos/Pessoal/claude-island-fase2/.planning/phases/05-sess-es/05-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 5: Code Review Fix Report

**Fixed at:** 2026-11-21
**Source review:** .planning/phases/05-sess-es/05-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (WR-01 to WR-04; Info items out of scope)
- Fixed: 4
- Skipped: 0

**Verification:** `pnpm test` ran after each fix, in the feature worktree itself (`D:/Desenvolvimentos/Pessoal/claude-island-fase2`, branch `feat/fase-5-sessoes`), which was already an isolated git worktree. No nested worktree was created, so there is no fast-forward or sentinel to clean up. The suite went from 493 to 500 tests, 0 failures. Electron was not started and no synthetic input was sent. CRLF line endings were preserved (every edited file has CR on every line).

## Fixed Issues

### WR-01: A transient unreadable session file is treated as the session "exiting"

**Files modified:** `main.js`, `gate.test.js`
**Commit:** a823c8e
**Applied fix:** `readSessions` keeps the last good parse per key (`lastGoodSessionByKey`). When a file exists but fails to parse, that parse is reused, but only if `isSessionDead` still says the session is alive. A file that is gone is pruned from the cache (the same prune pass as `firstSeenAtByKey`), and a dead or expired session still leaves the list through the normal path. Tests run the real `readSessions` body in a `vm` with a stubbed disk: a half-written or empty file keeps the session across cycles, and a deleted file, a closed terminal and an expired session all leave.
**Status note:** logic change, so `fixed: requires human verification` of the selection behaviour in the real app (the tests cover the list, not the island).

### WR-02: A scroll or click away is overridden when the shown request exits in the same refresh

**Files modified:** `main.js`, `state.js`, `fixtures/permission-vectors.json`, `gate.test.js`
**Commit:** dafcbe4
**Applied fix:** `refresh` passes `userSwitched: true` in the poll event when `reason` is `wheel` or `select`. In `pollSelection`, that flag skips the queue-advance branch and the new-request snap for that cycle only. The exit-of-the-shown-session branch is untouched, and the next poll decides from the display the user chose. The switch still re-arms, because it still goes through `nextShownPermission`. The `acceptDecision` order is unchanged. Three vectors were appended to the `nextSelection` group, covering wheel, click, and a control without the flag, plus a text lock for the `refresh` wiring.
**Status note:** logic change, `fixed: requires human verification`.

### WR-03: The project name is tail-truncated at 140 px

**Files modified:** `index.html`, `README.md`, `gate.test.js`
**Commit:** 60d6f27
**Applied fix:** the full name goes into the native `title` attribute of `#permission-project` and of `#title` (only while it shows the project). CSS width and stage budget are untouched. A middle ellipsis was not done, because it needs text measurement in JS. The tail truncation is recorded as a limit in a `ponytail:` comment and in the README: two projects with a long shared prefix can still look the same inline, and the tooltip shows the full name only if the OS draws it for the unfocused window.

### WR-04: A user-initiated switch onto a "waiting" session replays the chime

**Files modified:** `main.js`, `index.html`, `gate.test.js`
**Commit:** c023d69
**Applied fix:** `sendState(island, userSwitched)` sends `shouldChime = isFirstIsland && !userSwitched`, and `refresh` passes the flag from `reason`. The main is the source of truth, so a snap or a new request on the shown session still chimes, while a wheel step or dot click does not. In the renderer, `chime()` is now inside `try/catch` with a commented silent fallback, so an audio exception cannot skip `current = next`. Two existing text locks were adjusted: the `sendState(island)` regex for `refresh` and the `userSwitched` wiring lock added in WR-02. Tests: a `vm` run of the real `sendState` checks the flag per island, plus a text lock for the `try/catch` placement.

---

_Fixed: 2026-11-21_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
