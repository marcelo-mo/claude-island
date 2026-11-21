---
phase: 01-spike-de-medi-o-e-decis-o-de-base
reviewed: 2026-11-21T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - .gitignore
  - animation.test.js
  - index.html
  - scripts/measure-footprint.ps1
  - scripts/spike-verdict.js
  - scripts/spike-verdict.test.js
  - spike/compare-captures.ps1
  - spike/prepare-variants.ps1
  - spike/tauri/build.ps1
  - spike/tauri/src-tauri/Cargo.toml
  - spike/tauri/src-tauri/build.rs
  - spike/tauri/src-tauri/capabilities/default.json
  - spike/tauri/src-tauri/src/main.rs
  - spike/tauri/src-tauri/src/shim.js
  - spike/tauri/src-tauri/tauri.conf.json
findings:
  critical: 0
  warning: 5
  info: 7
  total: 12
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-11-21
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

The spike code is mostly sound. The verdict arithmetic matches `spike/REGRA-DE-DECISAO.md`. I checked these points against the rule text and the committed results:

- N1 compares integers in tenths of a MB (`tenths(c) * 100 <= tenths(ref) * 60`).
- N2 is strict at 4 decimals.
- A tie keeps E3.
- The first valid attempt wins, and an invalid line only appears after 3 attempts.
- E2 eligibility is read from `eligibility.json` and re-checked in the files.
- `node --test` passes (38 tests), and `node scripts/spike-verdict.js spike/results` reproduces "Etapa 1: REPROVOU".

The measurement method is also sound on the points you asked about:

- The process-tree walk is correct (fixed point over `ParentProcessId`).
- Private WS comes from `Win32_PerfFormattedData_PerfProc_Process.WorkingSetPrivate`, which is locale-independent.
- CPU is summed as per-PID deltas.
- The median is correct.
- `USERPROFILE` is disposable, and `--user-data-dir` sits inside it.
- No debug port is opened and `install.js` is never run.

`index.html`: the diff only touches the glow CSS and the `visibilitychange` line. `--running`, `#30d158`/`#248a3d` and `#ff9f0a`/`#f08c00` are untouched (checked with `git diff 2530f30`). Every `@keyframes` (breathe, hop, glow) changes only `opacity` and `transform`. `#pill` has no base `animation`. Only `#pill:not([data-state="idle"])::before` animates the glow. `#dots` is `display:none` outside `running`.

Tauri shell: the default build has no auto-approve. `Cargo.toml` has no `[features]` section, so `spike-autodecide` does not exist, which satisfies D-14. `decide` is a no-op in `shim.js`.

The findings below are mostly robustness and hardening issues in the tooling.

Known item (`$PSScriptRoot`): confirmed and classified as IN-01. It does not affect the documented `-File` usage.

## Warnings

### WR-01: `taskkill` in `finally` aborts the script when the root already exited, and can hit a recycled PID

**File:** `scripts/measure-footprint.ps1:339`
**Issue:** The script sets `$ErrorActionPreference = 'Stop'`. Windows PowerShell 5.1 turns native stderr into a terminating `NativeCommandError` when the call is written `& taskkill.exe ... 2>&1 | Out-Null`. I reproduced this in PS 5.1: with a PID that no longer exists, execution stops at that line and the rest of the `finally` never runs (`after taskkill` was not printed).

This matters in the crash path (`$failure` set because the root exited):
- `Start-Sleep` and `Remove-Item $home1` are skipped, so the temp dir leaks.
- The script throws instead of reaching `Save-Attempt` with `status='crashed'` and the error message. The attempt file stays `started`. It still counts as an attempt under D-12a, but the diagnosis is lost and `exit 2` is never reached.
- Separately, calling `taskkill /PID` on a root that has already exited can hit an unrelated process if Windows reused the PID. It is unlikely but possible, and it breaks the "kill only what I launched" guarantee.

**Fix:**
```powershell
} finally {
  if (-not $proc.HasExited) {
    $previousPreference = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    & taskkill.exe /PID $proc.Id /T /F 2>&1 | Out-Null   # por PID, nunca por nome
    $ErrorActionPreference = $previousPreference
  }
  Start-Sleep -Seconds 2
  Remove-Item $home1 -Recurse -Force -ErrorAction SilentlyContinue
}
```

### WR-02: The `-CleanDirs` guard accepts the safe root itself when given a trailing backslash

**File:** `scripts/measure-footprint.ps1:63-72` (deletion at line 298)
**Issue:** `Get-FullPath` keeps a trailing `\`. `[IO.Path]::GetFullPath("$env:LOCALAPPDATA\")` returns `C:\Users\x\AppData\Local\`, and the safe root is `...\Local\`, so `StartsWith` is true. I reproduced `allowed=True`. `Remove-Item -Recurse -Force` then runs on all of `%LOCALAPPDATA%` (or `%TEMP%`) three times per attempt. The guard exists so that "um caminho errado aqui não pode levar uma pasta de verdade", and this typo bypasses it. Even without the trailing slash, any subfolder of `%LOCALAPPDATA%` (for example `...\Microsoft`) is accepted, which is very broad.

**Fix:** Trim the trailing slash before comparing, and require a strict child:
```powershell
$full = (Get-FullPath $_).TrimEnd('\')
if (-not ($safeRoots | Where-Object { $full.StartsWith($_, [StringComparison]::OrdinalIgnoreCase) -and $full.Length -gt $_.Length })) { throw ... }
```
Also consider requiring the folder name to contain `WebView2`, `claude-island` or `island-measure`. The same pattern is in `spike/prepare-variants.ps1:28`, where the impact is smaller because only the `e0`, `e1` and `e3` subfolders are deleted.

### WR-03: The Tauri shell writes `.heartbeat` into the real `~/.claude/island` when launched outside the meter, and it can never answer a permission request

**File:** `spike/tauri/src-tauri/src/main.rs:37-40, 119-139`; `spike/tauri/src-tauri/src/shim.js:15`
**Issue:** The "never touches the real `~/.claude`" guarantee lives only in `measure-footprint.ps1` (disposable `USERPROFILE`). The `.exe` itself has no guard. If it is started by hand (double click, the planned `check-permission.ps1`, a stray `pnpm`-style run) it:
- reads the real sessions;
- writes a fresh `.heartbeat` into the real `~/.claude/island`, every 2 s.

Consequences:
- `hook.js` sees a fresh heartbeat and no longer starts the real island on `SessionStart`.
- `permission-hook.js:46` goes into its poll loop (up to `PERMISSION_WAIT_MS` = 5 min). The shell's `decide` is `noop`, so no decision ever arrives. A real Claude Code session blocks on permission for up to 5 minutes, which violates "hooks nunca podem atrasar a sessão".

It also falls back to a relative `.claude/island` in the current directory when neither `USERPROFILE` nor `HOME` is set (`unwrap_or_default`).

**Fix:** Make the shell opt in to isolation. For example, require an env var that only the meter sets, and exit otherwise:
```rust
let isolated = std::env::var("ISLAND_SPIKE_ISOLATED").is_ok();
if !isolated { eprintln!("spike: recusa rodar sem USERPROFILE descartável"); std::process::exit(1); }
```
Alternatively skip the heartbeat write unless `USERPROFILE` contains `island-measure-`. Have the meter pass the variable through `-ExtraEnv`. Make `state_dir()` return `Option` instead of falling back to `""`.

### WR-04: The Tauri capability is wider than the shell needs, with `withGlobalTauri` and no CSP

**File:** `spike/tauri/src-tauri/capabilities/default.json:4`; `spike/tauri/src-tauri/tauri.conf.json:6`
**Issue:** `core:default` grants the whole default core set to every `island-*` window: app, event (listen/emit), image, menu, path, resources, tray and window/webview queries. `shim.js` uses only `event.listen`. `withGlobalTauri: true` exposes `window.__TAURI__` to the page and `csp: null` removes the only content restriction. Today `index.html` has no `innerHTML`, `eval` or external content, so nothing is exploitable. However, session files (`permission.text`, `detail`) are untrusted data, and this config is the likely template for the phase 3.1 port. The surface should be least-privilege from the start.

**Fix:**
```json
{ "identifier": "default", "windows": ["island-*"], "permissions": ["core:event:allow-listen", "core:event:allow-unlisten"] }
```
Set a CSP such as `"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'"` (the page uses inline script and style). Add a one-line `ponytail:` comment saying the CSP gets tightened in the port.

### WR-05: N2 compares CPU at 4 decimals with zero tolerance, below the measurement noise floor

**File:** `scripts/spike-verdict.js:176-182` (rule: `spike/REGRA-DE-DECISAO.md`, N2/D-02)
**Issue:** The verdict implements the committed rule faithfully, so this is a rule/method limit and not a coding bug. `KernelModeTime` and `UserModeTime` come from `Win32_Process`, which is scheduler-tick accounting (about 15.6 ms). Over a 60 s window the 4th decimal of "% do total" is far below that granularity. The data shows it: idle e3 spans 0,0023 to 0,0176 across its 3 runs and t0 spans 0,0059 to 0,0235. The ranges overlap fully, and the medians (0,0105 vs 0,0082) differ by 0,0023. The N2 outcome in the report is therefore noise. Short-lived helper processes that start and die between two 5 s samples also contribute 0 to the sum, which undercounts both variants unequally. The final decision is not affected, because N1 fails by a wide margin in all 3 scenarios (T0 is 137% of E3 at idle). Do not present N2 as evidence in `PROJECT.md`.
**Fix:** In `RESULTADOS.md` and `PROJECT.md`, record N2 as "inconclusive within noise; the decision rests on N1". For any future re-measurement, use the per-process cycle counter (`QueryProcessCycleTime`), or compare with a tolerance that is justified by the observed per-run range.

## Info

### IN-01: Known item, `$PSScriptRoot` empty on PS 5.1 (confirmed, low impact)

**File:** `scripts/measure-footprint.ps1:29, 52`
**Issue:** I reproduced it. The default `-OutDir (Join-Path $PSScriptRoot ...)` throws `ParameterArgumentValidationErrorEmptyStringNotAllowed` only when the script text is not run from a file. This includes piping it to `powershell -Command -`, an ISE selection run, and `[scriptblock]::Create(...)`. With `-File`, `& '.\x.ps1'` and `. '.\x.ps1'`, `$PSScriptRoot` is populated. The documented usage is `-File` and every committed measurement used it, so the real impact is nil today. Passing `-OutDir` does not help, because line 52 (`Join-Path $PSScriptRoot '..'`) fails the same way.
**Fix:** Compute the root once at the top of the script body: `$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path $MyInvocation.MyCommand.Path }`. Make `-OutDir` default to `''` and resolve it after that line.

### IN-02: The verdict does not check that the window count matches the variant definition

**File:** `scripts/spike-verdict.js:34-42`
**Issue:** `hasValidWindows` requires at least 1 window and every window to be valid. It does not require 2 windows for E0 and E1, or 1 for E3 and T0. If the E3 patch silently failed or T0 opened one window per monitor, the comparison would still be "valid" and N1 would compare unequal setups. The committed data is correct (E0 and E1 have 2 windows, E3 and T0 have 1), so this is latent. Note that `e0-idle-a1` showed 3 windows and 27 processes in run 1. It was caught only because window validity happened to fail, not because of an explicit check.
**Fix:** Add an expected count per label (`{ e0: 2, e1: 2, e3: 1, e2: 1, t0: 1 }`) as an extra `invalidReason`. This would change the rule, so do it only before a new spike. Otherwise document the gap in `RESULTADOS.md`.

### IN-03: The verdict trusts the `median` field and does not enforce the attempt cap on valid late attempts

**File:** `scripts/spike-verdict.js:80-94, 117`
**Issue:**
- `median(row, field)` reads `attempt.median[field]` from the file and does not recompute it from `runs`. A hand-edited `median` goes unnoticed. A valid file with `median: null` throws `TypeError` in `evaluateRule`, although the module style is "never throws on bad input".
- `rowFor` accepts a valid `a4` (or later). The cap of 3 (D-12a) is enforced only by the meter and only when it writes to `spike/results`.
- `formatReport(results, verdict)` never uses `results` (the tests pass `{}`).

**Fix:** Add `median` consistency to `invalidReason` (recompute from `runs` and compare), and ignore `attempt > MAX_ATTEMPTS`. Drop the unused parameter.

### IN-04: Misleading or brittle defaults in the tooling

**File:** `scripts/measure-footprint.ps1:10, 79`; `spike/prepare-variants.ps1:21`
**Issue:**
- The usage comment passes `-ExtraEnv 'ISLAND_WINDOWS=1'`. `main.rs:71` only reads `ISLAND_WINDOWS == "all"`, so the variable is a no-op. The single window comes from the default, not from the variable.
- The Electron exe path hard-codes `electron@45.4.1`. A version bump fails with a clear message, but it is brittle.
- `prepare-variants.ps1` defaults `-OptimizedCommit` to "last commit touching `index.html`" (the HEAD blob check then fails loudly if anything changed). The header says E1 is the pinned BASE-05 commit, so the sha should always be passed explicitly. Consider making it mandatory.

**Fix:** Drop the no-op variable from the usage text. Resolve the Electron folder by glob. Make `-OptimizedCommit` mandatory.

### IN-05: `index.html` details (BASE-05 checks pass)

**File:** `index.html:78-88, 195, 237`
**Issue:**
- `visibilitychange` only fires on a change. If a page loads while already hidden, `data-hidden` is never set until the first change. This is harmless today, because a new window is idle and the glow does not animate in idle, but it is easy to close.
- `animation-play-state: paused` keeps the animation (and its layer) alive. It does not remove it. That is acceptable, and Chromium throttles hidden pages anyway.
- The glow is now an inset ring inside the pill. The old outer halo (`0 2px 16px`) is gone. The comment explains why (the `overflow: hidden` clips an outer halo). It is a visible design change worth noting in the PR.
- `animation.test.js` test 2 only matches a `#pill {` rule that starts at the beginning of a line. It would miss `#pill` rules written on a shared line or with attribute selectors. This is acceptable because test 3 asserts the single glow selector.

**Fix:** Add `document.documentElement.dataset.hidden = document.hidden;` once, after registering the listener.

### IN-06: Minor issues in `compare-captures.ps1` and `build.ps1`

**File:** `spike/compare-captures.ps1:11`; `spike/tauri/build.ps1:26-28`
**Issue:**
- With `$ErrorActionPreference = 'Stop'`, `Write-Error` is terminating, so the following `exit 1` is unreachable (the error still ends the script with a non-zero code).
- Pixels with `A=0` but different RGB count as different, which can inflate the diff on transparent areas. This is conservative for E2 eligibility.
- `git hash-object --path=index.html` in `build.ps1` depends on the current directory being inside the repo. The usage says to run it from the root, but nothing enforces that.

**Fix:** Use `throw "arquivo nao encontrado: $path"`. Ignore RGB when `A=0` on both sides. Run `git -C $repoRoot hash-object ...`.

### IN-07: `read_state` in the Tauri shell forwards raw file content as JSON without validation

**File:** `spike/tauri/src-tauri/src/main.rs:43-64`; `spike/tauri/src-tauri/src/shim.js:3`
**Issue:** The raw content of the first `.json` file (in unspecified `read_dir` order) is interpolated into `{"count":N,"session":<raw>}`. A half-written or invalid file produces an invalid payload, and `JSON.parse` in `shim.js` throws inside the listener. The previous state stays on screen, so this does not crash. There is also no staleness filter (`updatedAt`) as in `pickState`, so the shell can differ from Electron when old session files exist. This only matters if the shell is reused for the port. In the spike, the meter writes exactly one fake session, so the comparison is fair.
**Fix:** Parse with `serde_json`, or at least validate it before sending. Port `pickState` and its staleness rules in the port, not in the spike.

---

_Reviewed: 2026-11-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
