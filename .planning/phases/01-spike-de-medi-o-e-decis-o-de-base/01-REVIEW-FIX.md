---
phase: 01-spike-de-medi-o-e-decis-o-de-base
fixed_at: 2026-11-21T00:00:00Z
review_path: D:/Desenvolvimentos/Pessoal/claude-island/.planning/phases/01-spike-de-medi-o-e-decis-o-de-base/01-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 1: Code Review Fix Report

**Fixed at:** 2026-11-21
**Source review:** D:/Desenvolvimentos/Pessoal/claude-island/.planning/phases/01-spike-de-medi-o-e-decis-o-de-base/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (WR-01 a WR-05; Info fora do escopo)
- Fixed: 5
- Skipped: 0

**Where the work ran:** no checkout principal, na branch `feat/fase-1-medicao` (sem worktree isolado, sem trocar de
branch, sem push nem merge). O orquestrador pediu para não trocar de branch nem fazer merge, e o worktree exigiria
fast-forward na branch no fim. `pnpm test` rodou no checkout principal: 38 testes passando.

## Fixed Issues

### WR-01: `taskkill` no `finally` aborta o script quando a raiz já saiu

**Files modified:** `scripts/measure-footprint.ps1`
**Commit:** 5ef5b04
**Applied fix:** o `taskkill /PID` só roda se `$proc.HasExited` for falso, com `ErrorActionPreference = 'Continue'` ao
redor da chamada (restaurado em seguida). Nada é morto por nome, e uma raiz já encerrada (PID possivelmente
reaproveitado) não é tocada. O `finally` agora chega ao `Remove-Item` e a tentativa `crashed` é gravada. Reproduzido em
PowerShell 5.1 com um PID inexistente: a linha seguinte ao `taskkill` executa.

### WR-02: guarda de `-CleanDirs` aceitava a raiz segura com barra final

**Files modified:** `scripts/measure-footprint.ps1`, `spike/prepare-variants.ps1`
**Commit:** 88341b7
**Applied fix:** em `measure-footprint.ps1`, o caminho é normalizado com `TrimEnd('\')` antes do `StartsWith` contra a
raiz terminada em `\`, o que só aceita subpastas estritas. Em `prepare-variants.ps1` o mesmo defeito existia de outra
forma (`$OutRoot + '\'` igualava a raiz); agora o `StartsWith` usa `$OutRoot` sem barra final. Auto-verificação em
script descartável: `%LOCALAPPDATA%`, `%LOCALAPPDATA%\` e `%LOCALAPPDATA%\x\..\` são recusados; `%LOCALAPPDATA%\x\` é
aceito. Não foi adicionada a exigência de nome de pasta (`WebView2`, `island-measure`) que a revisão citava como
opcional.

### WR-03: casca Tauri gravava o batimento no `~/.claude` real fora do medidor

**Files modified:** `spike/tauri/src-tauri/src/main.rs`, `scripts/measure-footprint.ps1`
**Commit:** 359cd24
**Applied fix:** `main()` encerra com código 1 se `ISLAND_SPIKE_ISOLATED` não estiver definida, então um lançamento
avulso nunca grava `.heartbeat` nem faz o permission-hook real esperar. O medidor define a variável (junto com o
`USERPROFILE` descartável) em todo lançamento e a restaura depois. `state_dir()` agora devolve `Option<PathBuf>` e o
poller sai quando não há `USERPROFILE` nem `HOME`, em vez de cair numa pasta relativa.
**O binário não foi recompilado e o `cargo` não foi executado**; o código foi escrito para compilar (let-else, edição
2021), mas isso não foi verificado por compilador. Os resultados medidos não são afetados: o `.exe` usado nas medições
é o anterior, e o medidor sempre definiu um `USERPROFILE` descartável. A guarda só vale para um binário reconstruído.

### WR-04: capability mais larga que o necessário

**Files modified:** `spike/tauri/src-tauri/capabilities/default.json`
**Commit:** 000b8b1
**Applied fix:** `core:default` trocado por `core:event:allow-listen` e `core:event:allow-unlisten` (o `shim.js` só usa
`event.listen`; os `emit` vêm do lado Rust e não precisam de permissão). O JSON foi validado e os nomes das permissões
conferem com o registro do crate `tauri` 2. **CSP não foi alterado** (`csp: null` e `withGlobalTauri` seguem como
estavam): sem recompilar e testar não dá para garantir que a `index.html` com script e estilo inline continua
renderizando, já que o Tauri injeta hashes/nonces ao montar o CSP. Fica para a portagem da fase 3.1, se houver.
Também não recompilado; a restrição só vale num binário reconstruído.

### WR-05: N2 abaixo do piso de ruído

**Files modified:** `spike/RESULTADOS.md`
**Commit:** 2c12910
**Applied fix:** nota na seção "Leitura" dizendo que o N2 está dentro do ruído (faixas de CPU ociosa de T0 e E3 se
sobrepõem por completo; medianas 0,0105% e 0,0082%) e que a decisão se apoia no N1, que reprova por larga margem nos
três cenários. A regra congelada, os limiares, `spike/results/*` e o veredito não foram tocados; `node
scripts/spike-verdict.js spike/results` continua dando "Etapa 1: REPROVOU". Não foi editado nenhum `PROJECT.md`.

## Skipped Issues

Nenhum finding de Warning foi pulado.

**IN-01 (`$PSScriptRoot` vazio) não foi aplicado.** A correção sugerida (`Split-Path $MyInvocation.MyCommand.Path`)
cai no mesmo valor nulo nos casos em que `$PSScriptRoot` está vazio (script que não vem de um arquivo), então não
resolve e não é trivial. O uso documentado (`-File`) e todas as medições commitadas não são afetados.

## Verification

- `pnpm test` no checkout principal: 38 testes, 38 passando.
- Scripts PowerShell: verificação de sintaxe com o parser do PowerShell (`parse ok`) após cada edição.
- Rust: sem compilação, por instrução; revisão por leitura apenas.
- Não foi escrito nada no `~/.claude` real. Nenhum arquivo proibido foi alterado (`spike/results/*`,
  `spike/REGRA-DE-DECISAO.md`, `main.js`, `state.js`, `preload.js`, `island.test.js`, `index.html`).

---

_Fixed: 2026-11-21_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
