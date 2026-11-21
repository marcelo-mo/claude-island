---
phase: 01-spike-de-medi-o-e-decis-o-de-base
plan: 02
subsystem: infra
tags: [spike, tauri, rust, webview2, windows, medicao]

requires:
  - phase: 01-01
    provides: "medidor measure-footprint.ps1, hasValidWindows e a regra com tolerância de 2% no tamanho"
provides:
  - "spike/tauri/: casca Tauri T0 que carrega a index.html da raiz sem alterá-la"
  - "spike/tauri/build.ps1: build com target fora do repositório, carimbo ui-index.blob e -Features em target separado"
  - "T0 validado pela D-10 em 1 e em 2 monitores, apto a ser medido pelo plano 03"
affects: [01-03, 01-04]

actuals:
  tokens: 30000
  tasks: 3
  commits: 3

tech-stack:
  added: ["tauri 2.12.7 (casca de spike, Cargo.lock com 432 pacotes)", "tauri-build 2"]
  patterns:
    - "Janela de ferramenta aplicada 300 ms depois do show() e geometria reaplicada em pixels físicos do monitor-alvo"
    - "Cópia ui/ da index.html conferida pelo blob do git (imune a CRLF) e carimbada ao lado do .exe"

key-files:
  created:
    - spike/tauri/build.ps1
    - spike/tauri/src-tauri/Cargo.toml
    - spike/tauri/src-tauri/Cargo.lock
    - spike/tauri/src-tauri/build.rs
    - spike/tauri/src-tauri/tauri.conf.json
    - spike/tauri/src-tauri/capabilities/default.json
    - spike/tauri/src-tauri/icons/icon.ico
    - spike/tauri/src-tauri/icons/icon.png
    - spike/tauri/src-tauri/src/main.rs
    - spike/tauri/src-tauri/src/shim.js
  modified:
    - .gitignore
    - scripts/measure-footprint.ps1

key-decisions:
  - "Medidor ignora a janela de mensagens interna do Tao (classe 'Tao Thread Event Target', 16x16): sem isso todo T0 sairia inválido pela D-10"
  - "Task 3 não precisou mexer no main.rs: a geometria e o estilo da pesquisa passaram de primeira nos dois monitores"

# BASE-03 só fecha quando o T0 for medido (plano 03); aqui foi entregue a parte da casca, então não é marcado como concluído.
requirements-completed: []
requirements-progress: [BASE-03]

coverage:
  - id: D1
    description: "T0 com 1 janela no monitor principal, TOPMOST, TOOLWINDOW, sem APPWINDOW, 440x324 a 100%, desenhando 'Trabalhando'"
    requirement: BASE-03
    verification:
      - kind: integration
        ref: "measure-footprint.ps1 -Label t0 -Exe <exe> -Scenarios running -Runs 1 + node hasValidWindows -> rc 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "ISLAND_WINDOWS=all: 2 janelas, uma por monitor, tamanho físico do DPI de cada um, centralizadas e coladas no topo da área útil, primeiro plano intacto"
    requirement: BASE-03
    verification:
      - kind: integration
        ref: "measure-footprint.ps1 ... -ExtraEnv ISLAND_WINDOWS=all -Scenarios waiting + checagem de posição ±2 px -> rc 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "build.ps1 compila fora do repositório e embute a index.html conferida pelo blob"
    requirement: BASE-03
    verification:
      - kind: other
        ref: "ui-index.blob == git rev-parse HEAD:index.html (8593c6038da8194681a5454343ec33d9a89651bb)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Nada de ui/, gen/ ou target/ aparece no git status depois do build"
    requirement: BASE-03
    verification:
      - kind: other
        ref: "git status --porcelain --untracked-files=all spike/tauri -> vazio depois do commit"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-11-21
status: complete
story_points_realized: 3
plan_head_before: 3c67c23a165386baffd4f5dd1302b19b3a5c17fa
plan_head_after: 8848ba176f58ce2ff4bbf79d5b447aab1d7d9b77
commits: 3
---

# Phase 1 Plan 02: Casca Tauri T0 Summary

**Casca Tauri 2.12.7 (T0) com a mesma index.html sem alteração, janela de ferramenta na geometria física certa em um e em dois monitores, build reproduzível fora do repositório com Cargo.lock versionado.**

## Performance

- **Duration:** ~30 min (a maior parte foi a compilação a frio de 432 crates)
- **Completed:** 2026-11-21
- **Tasks:** 3 (a Task 3 não gerou commit, como o plano previa)
- **Files modified:** 12

## Accomplishments

- Andaime sem nenhum plugin (`grep -c tauri-plugin` = 0), capability só com `core:default` para `island-*`, ícones RGBA gerados por script temporário fora do repositório (PNG color type 6).
- `main.rs` e `shim.js` copiados da pesquisa; `build.ps1` limpa só o pacote, compila com `tauri/custom-protocol` e carimba o blob. Com `-Features` o target ganha sufixo (`spike-tauri-target-<features>`), então um build de teste nunca substitui o `.exe` medido.
- O T0 passou nos dois testes de janela na primeira tentativa de geometria; o `main.rs` não foi alterado depois de escrito.

## Task Commits

1. **Task 1: andaime** - `43f161c` (chore)
2. **Task 2: casca + build** - `fab0d8e` (fix do medidor, necessário para medir o T0), `8848ba1` (feat, inclui `Cargo.lock`)
3. **Task 3: dois monitores** - sem commit (nada divergiu)

## Verificação (saídas reais)

- `.exe`: `C:\Users\marce\AppData\Local\claude-island\spike-tauri-target\release\claude-island-spike.exe` (última linha do `build.ps1`, saída 0).
- `ui-index.blob` = `8593c6038da8194681a5454343ec33d9a89651bb` = `git rev-parse HEAD:index.html`. `Cargo.lock` fixa `tauri 2.12.7`, 432 pacotes.
- `git ls-files --error-unmatch spike/tauri/src-tauri/Cargo.lock` sai 0; `git status --porcelain --untracked-files=all spike/tauri` vazio depois do build e do commit.
- `grep -c Features spike/tauri/build.ps1` >= 1; `test ! -e ~/.claude/island/spike-fake.json` passa (HOME real intocado; o `.exe` só foi lançado pelo medidor ou pela sonda descartável, sempre com `USERPROFILE` em %TEMP%).
- `git diff --quiet HEAD -- index.html main.js state.js preload.js` sai 0. `pnpm test`: 38 testes, 0 falhas, 136 ms de teste (1,1 s no total) com `spike/` presente.
- Nenhum `claude-island-spike.exe` ficou vivo no fim (`tasklist`: 0). Nada foi gravado em `spike/results/`; as saídas dos smokes ficaram em `%TEMP%\t0-smoke` e `%TEMP%\t0-all`.

### Smoke 1: T0 em 1 janela, cenário running (`%TEMP%\t0-smoke\t0-running-a1.json`)

```
{"x":1060,"y":30,"width":440,"height":324,"dpi":96,"widthDip":440,"heightDip":324,
 "exStyle":"0x8000198","topmost":true,"toolWindow":true,"appWindow":false,
 "monitorWork":{"x":0,"y":30,"width":2560,"height":990}}
```

Estilo `0x8000198` = TOPMOST + TOOLWINDOW + NOACTIVATE, sem APPWINDOW, e `foregroundInTree: false`. Captura: `%TEMP%\t0-smoke\png\t0-running-a1-1-0.png` mostra a pílula escura com contorno laranja, ponto laranja, "Trabalhando" em branco e as três reticências laranja (fundo transparente sai preto no PrintWindow).

### Smoke 2: `ISLAND_WINDOWS=all`, cenário waiting (`%TEMP%\t0-all\t0-waiting-a1.json`)

| Monitor | Retângulo físico (x, y, w×h) | Em DIP | DPI | exStyle | Área útil física |
| --- | --- | --- | --- | --- | --- |
| Principal 2560×1080 a 100% | 1060, 30, 440×324 | 440×324 | 96 | `0x8080198` | 0, 30, 2560×990 |
| Secundário 1920×1080 a 125% | -1235, 37, 550×405 | 440×324 | 120 | `0x8000198` | -1920, 37, 1920×968 |

Centralização: 1060 = 0 + (2560-440)/2 e -1235 = -1920 + (1920-550)/2 (erro 0 px); `y` = topo da área útil nos dois (30 e 37). `foregroundInTree: false`. Capturas: `%TEMP%\t0-all\png\t0-waiting-a1-1-1.png` (principal) e `...-1-0.png` (secundário): "Precisa de você", "spike · Precisa da sua resposta", rótulo Bash, linhas `step 00` a `step 05` visíveis numa área rolável com a dica "Role até o fim para poder permitir", botões Negar e Permitir (Permitir ainda desabilitado). O contorno laranja fica na borda, sem passar por cima do texto.

Sobre o critério "texto de 20 linhas inteiro": a caixa mostra 6 linhas por vez e as 20 existem para rolagem. É o comportamento da própria `index.html` (a mesma do Electron, que a casca não toca) e a trava "role até o fim" é a regra de segurança do produto; não é cortado por geometria da janela. Ver rolagem até a linha 19 exigiria injetar roda do mouse, que o plano proíbe.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `Start-Process` rejeita `-ArgumentList` vazio no medidor**
- **Found during:** Task 2, primeiro smoke
- **Issue:** o caminho `-Exe` (Tauri) nunca tinha sido exercitado de ponta a ponta no plano 01; com `$ArgumentList = ''` o PowerShell lança `ParameterBindingValidationException` e o JSON fica com `status: started` e `runs: []`.
- **Fix:** o medidor só passa `-ArgumentList` quando há argumento (splat condicional).
- **Files modified:** `scripts/measure-footprint.ps1`
- **Commit:** `fab0d8e`

**2. [Rule 1 - Bug] Janela interna do Tao contava como janela da ilha**
- **Found during:** Task 2, segundo smoke
- **Issue:** o Tauri tem uma janela de mensagens `Tao Thread Event Target` (16×16, em 0,0, estilo `0x80800a0`) com `WS_VISIBLE`. O medidor a listava, o resultado saía com 2 janelas no cenário de 1, e `hasValidWindows` falharia no T0 (não é TOPMOST nem 440×324). Identificada com uma sonda descartável de nomes de classe (`Tauri Window` e `Tao Thread Event Target`).
- **Fix:** o enumerador do medidor pula essa classe. Não muda regra, limiar nem elegibilidade; só impede que lixo do runtime invalide o T0, simétrico ao Electron (que não tem essa janela).
- **Files modified:** `scripts/measure-footprint.ps1` (e `using System.Text`)
- **Commit:** `fab0d8e` (os dois ajustes do medidor estão no mesmo commit)
- **Para o autor:** o medidor é do plano 01 e foi alterado depois de a regra estar commitada, mas antes de qualquer número em `spike/results/`; a regra não mudou.

### Ajustes de execução (sem mudar o plano)

- `build.ps1` tem BOM UTF-8, como o medidor, porque o Windows PowerShell 5.1 lê arquivo sem BOM como ANSI.
- Os arquivos foram criados com a ferramenta Write; um heredoc grande derrubou o parser do shell e nada foi escrito no disco.
- `gsd_run` não existe como função neste shell; as consultas de estado usam `node ~/.claude/gsd-core/bin/gsd-tools.cjs`.
- A janela do Tauri tem o título padrão "Tauri App" (a classe é `Tauri Window`); irrelevante para a medição.

## Auth gates

Nenhum.

## Known Stubs

`decide`, `setHover`, `focusSession`, `drag`, `endDrag` e `resetPosition` do `shim.js` são no-op por desenho: a casca T0 só mede consumo de estado e desenho, não decide permissão (comentado no topo do `main.rs`). Nada a registrar no ledger.

## Threat Flags

Nenhum além do registrado no plano (T-01-06 a T-01-08 e T-01-SC mitigados: só `core:default`, sem plugin, `Cargo.lock` versionado, `.exe` lançado só com `USERPROFILE` descartável).

## Self-Check

PASSED: arquivos criados existem e os commits `43f161c`, `fab0d8e` e `8848ba1` são ancestrais do HEAD.
