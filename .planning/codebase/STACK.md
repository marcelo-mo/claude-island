---
last_mapped_commit: 75d1a08eaa84174fda8d1cb27a0d18392b854fd1
last_mapped_at: 2026-11-20
---
# Technology Stack

**Analysis Date:** 2026-11-20

## Languages

**Primary:**
- JavaScript (CommonJS, `require`/`module.exports`, no transpilation) - all application code: `main.js`, `window.js`, `state.js`, `hook.js`, `permission-hook.js`, `install.js`, `preload.js`
- HTML/CSS/vanilla JS (inline `<style>` and `<script>`) - renderer UI in `index.html` (about 400 lines, no framework)

**Secondary:**
- PowerShell (inline `-Command` scripts, embedded as strings in `window.js`) - Windows window discovery and focus via `user32.dll` P/Invoke
- AppleScript (`osascript -e`, string in `window.js`) - macOS window focus
- Shell tools invoked from Node: `ps` and `xdotool` (Linux) - see `window.js`

## Runtime

**Environment:**
- Electron 45.4.1 (`devDependencies` in `package.json`, locked in `pnpm-lock.yaml`). Provides the Chromium renderer and the bundled Node runtime for `main.js`.
- Node.js: no `engines` field and no `.nvmrc` / `.node-version` file. Plain `node` is used for hooks (`hook.js`, `permission-hook.js`) and tests (`node --test`), so the system Node must support `node:test` (Node 18+ inferred from `node:test` usage; not pinned).
- Hooks run through the Node binary from `process.execPath` (`install.js` writes that absolute path into `~/.claude/settings.json`). Inside the Electron process `require('electron')` returns the executable path, which `hook.js` uses to spawn the island.

**Package Manager:**
- pnpm 11.10.0 (`packageManager` field in `package.json`)
- Lockfile: present - `pnpm-lock.yaml` (lockfileVersion 9.0). Only two packages resolved: `electron@45.4.1` and `semver@7.8.6` (transitive).
- `pnpm-workspace.yaml` exists only to set `allowBuilds: electron: true`, which lets Electron run its postinstall download.
- `node_modules/` is git-ignored (`.gitignore`).

## Frameworks

**Core:**
- Electron 45.4.1 - desktop shell: frameless, transparent, always-on-top `BrowserWindow` per display (`main.js`, `createIsland`)
- None on the renderer side: no React/Vue/Svelte, no bundler

**Testing:**
- Node built-in test runner (`node:test`) with `node:assert` - `island.test.js` (9 tests). Run with `pnpm test` (`node --test`). No Jest/Vitest/Mocha.

**Build/Dev:**
- No build step. Electron loads source files directly.
- No linter or formatter config (no ESLint, Prettier, Biome config in the repo).

## Key Dependencies

**Critical:**
- `electron` 45.4.1 (devDependency, `^45.4.1`) - the only runtime dependency that matters; required for `pnpm start` and for the island process spawned by `hook.js`. Electron is listed under devDependencies even though the app needs it at runtime.

**Infrastructure:**
- Node built-in modules only in application code: `node:fs`, `node:path`, `node:os`, `node:crypto` (`randomUUID`), `node:child_process` (`execFile`, `execFileSync`, `spawn`).
- `semver` 7.8.6 - transitive via Electron tooling; not imported by the repo.

No third-party npm libraries are imported by the application. The repo deliberately avoids additional dependencies.

## Configuration

**Environment:**
- No `.env` files in the repo. No environment variables are read by application code except the internal `ISLAND_PID` set by `window.js` on the PowerShell child process (`pidEnv`).
- The app reads user configuration from the Claude Code settings file, `~/.claude/settings.json`, which `install.js` edits (backup written to `~/.claude/settings.json.island-backup`).
- Runtime state lives under `~/.claude/island/` (defined in `state.js`: `STATE_DIR`, `DECISIONS_DIR`, `HEARTBEAT_FILE`).
- Tunable constants are hard-coded in `state.js` (for example `PERMISSION_WAIT_MS = 5 * 60_000`, `HEARTBEAT_STALE_MS = 6_000`, `DONE_VISIBLE_MS = 10_000`, `CONTEXT_WARN_PERCENT = 50`, `CONTEXT_CRITICAL_PERCENT = 80`). Config files are not used.
- `.claude/settings.local.json` exists in the repo root (local Claude Code settings). Its contents were not read and it is not part of the app's configuration. Confirm it is git-ignored before committing changes; `.gitignore` only lists `node_modules/`.

**Build:**
- No build configuration. Entry point is `main.js` (`package.json` `"main"`), started with `electron .` (`pnpm start`).
- Scripts (`package.json`): `start`, `test`, `hooks:install`, `hooks:uninstall`.

## Platform Requirements

**Development:**
- pnpm 11.10.0 and a Node.js able to run `node --test`
- Windows is the primary tested platform. macOS requires `osascript` and macOS Automation/Accessibility permission (prompted on first use). Linux requires `xdotool` and X11 for focusing windows, and `/proc` for process ancestry. Click-through is disabled on Linux (`CAN_CLICK_THROUGH` in `main.js`).

**Production:**
- Not a deployed service. Distributed as a source repository run locally. Installed per user with `pnpm hooks:install`, which registers hooks in `~/.claude/settings.json` that point at this checkout's absolute paths (`install.js`). Moving or deleting the checkout breaks the hook commands.
- Target OS: Windows 11 (tested), macOS and Linux (partially tested, per `README.md`).

---

*Stack analysis: 2026-11-20*
