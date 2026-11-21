---
phase: 01-spike-de-medi-o-e-decis-o-de-base
plan: 01
subsystem: infra
tags: [spike, medicao, electron, tauri, powershell, node-test, css-animation]

requires: []
provides:
  - "spike/REGRA-DE-DECISAO.md: regra Electron x Tauri commitada antes de qualquer numero (BASE-02)"
  - "scripts/measure-footprint.ps1: medidor de private WS e CPU da arvore inteira, com janelas em pixels fisicos (BASE-01)"
  - "scripts/spike-verdict.js: veredito puro da Etapa 1 + relatorio em markdown"
  - "index.html: brilho do contorno so por opacity num pseudo-elemento, pausado com a pagina escondida (BASE-05)"
affects: [01-02, 01-03, 01-04, fase-3.1]

actuals:
  tokens: 14600
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "Regra pre-registrada em commit proprio antes de spike/results existir; o medidor recusa gravar la sem ela"
    - "Uma tentativa numerada por variante x cenario ({label}-{cenario}-a{N}.json), nunca sobrescrita, com teto de 3"
    - "Veredito puro (evaluateRule) separado do I/O (loadResults), igual ao pure/OS split do state.js"

key-files:
  created:
    - spike/REGRA-DE-DECISAO.md
    - scripts/measure-footprint.ps1
    - scripts/spike-verdict.js
    - scripts/spike-verdict.test.js
    - animation.test.js
  modified:
    - index.html

key-decisions:
  - "Validade de janela (D-10) com tolerancia de 2% no tamanho: o Electron abre a janela a 125% com 550x410, nao 550x405 (errata commitada antes de qualquer medicao)"
  - "Sondagem de estilo da ilha viva nao feita: nao havia electron.exe rodando; estilo 0x8280028 e geometria vieram da pesquisa e foram reconfirmados pelo proprio medidor numa instancia descartavel"

requirements-completed: [BASE-01, BASE-02, BASE-05]

coverage:
  - id: D1
    description: "Regra de decisao commitada sozinha e antes de qualquer spike/results"
    requirement: BASE-02
    verification:
      - kind: other
        ref: "RULE=$(git log --format=%H -- spike/REGRA-DE-DECISAO.md) && test -z \"$(git log --format=%H -- spike/results)\" && test ! -e spike/results  -> REGRA-PRIMEIRO"
        status: pass
    human_judgment: false
  - id: D2
    description: "Medidor gera um JSON por tentativa e cenario com memoria, CPU e janelas fisicas de uma instancia isolada"
    requirement: BASE-01
    verification:
      - kind: integration
        ref: "measure-footprint.ps1 -Label e1 -App . -Scenarios running -Runs 1 ... + node scripts/spike-verdict.js | grep -cF '| e1 | running |' -> 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "Veredito da Etapa 1 com os vetores de D-01, D-02, D-10, D-12 e D-12a"
    requirement: BASE-02
    verification:
      - kind: unit
        ref: "scripts/spike-verdict.test.js (20 testes)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Ilha parada nao anima, escondida pausa tudo, so opacity/transform"
    requirement: BASE-05
    verification:
      - kind: unit
        ref: "animation.test.js (5 testes)"
        status: pass
      - kind: other
        ref: "CDP em instancia descartavel: 0 animacoes ociosa, glow:running em running, tudo paused com hidden"
        status: pass
    human_judgment: false
  - id: D5
    description: "Aparencia do halo interno (D-03)"
    requirement: BASE-05
    verification: []
    human_judgment: true
    rationale: "Julgamento visual do autor; coletado no checkpoint humano unico do fim do plano 04, nao bloqueia este plano"

duration: 25min
completed: 2026-11-21
status: complete
story_points_realized: 8
plan_head_before: 2161cef52c5c75b785a1b8ca27602a5aa7e81364
plan_head_after: 6a893bdde60fcf90468049376f4118d5a197d593
commits: 7
---

# Phase 1 Plan 01: Regra, medidor e veredito do spike Summary

**Regra Electron x Tauri commitada antes de qualquer numero, medidor PowerShell da arvore de processos inteira com janelas em pixels fisicos, veredito puro testado e brilho da ilha reescrito para animar so opacity (ilha parada com 0 animacoes).**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-11-21
- **Tasks:** 3
- **Files modified:** 6 (5 criados, `index.html` alterado)

## Accomplishments

- `spike/REGRA-DE-DECISAO.md` foi o primeiro commit da execucao (`68db4e5`), sozinho, com N1 nos 3 cenarios, N2 estrito sem tolerancia, validade por TOPMOST/APPWINDOW/tamanho, teto de remedicoes, elegibilidade de E2 e Etapa 2 pela D-09. `spike/results/` nao existe no disco nem no historico.
- `scripts/measure-footprint.ps1` mede private working set (classe CIM de nomes fixos) e CPU somados na arvore, em instancia isolada (`USERPROFILE` descartavel, `--user-data-dir` proprio), grava uma tentativa por cenario com `status` started/ok/crashed e relata cada janela em pixels fisicos (DPI por monitor). Encerra so pelo PID raiz.
- `scripts/spike-verdict.js` (`evaluateRule`, `loadResults`, `formatReport`, `hasValidWindows`) aplica a regra com aritmetica inteira (60% exato passa; 3,0 x 0,6 sem erro de ponto flutuante) e cobre D-01, D-02, D-10, D-12 e D-12a em 20 testes `node:test`.
- BASE-05: `#pill::before` com sombra interna estatica, so `opacity` pulsa; `animation` fora do estado base de `#pill`; `html[data-hidden="true"]` pausa; `visibilitychange` grava `dataset.hidden`; reduced-motion inclui o pseudo-elemento.

## Task Commits

1. **Task 1: regra de decisao** - `68db4e5` (docs); errata de tamanho de janela, ainda sem nenhum resultado - `37568c5` (docs)
2. **Task 2: medidor + veredito** - `a42483b` (feat, .ps1), `aecc597` (feat, .js e teste), `12eb3a6` (fix, captura sem `-CaptureDir`)
3. **Task 3: brilho so por opacity** - `e0c28f6` (test, RED: 5 falhas), `6a893bd` (perf, GREEN: 5 passes)

**Plan metadata:** commit docs final (SUMMARY, STATE, ROADMAP, REQUIREMENTS).

## Verificacao

- `node --test scripts/spike-verdict.test.js`: 20 passam. Mutacao em `<=` do N1 derrubou 7 testes.
- `node --test animation.test.js`: falhou 5/5 no commit RED, passa 5/5 no GREEN.
- `pnpm test`: 38 testes, 0 falhas (inclui `island.test.js` intocado).
- Smoke do medidor (`-Label e1 -App . -Scenarios running -Runs 1 -WarmupSeconds 8 -Seconds 10 -OutDir $TEMP/island-smoke`): gravou `e1-running-a1.json`, `status: ok`, `rootAlive: true`; o veredito imprimiu a linha `| e1 | running |` (contagem 1). Saida do smoke fica fora do repositorio e foi apagada; nenhum valor de memoria ou CPU dele foi registrado.
- Janelas do smoke (pixels fisicos, `exStyle 0x8280028`, `topmost: true`, `appWindow: false`, `toolWindow: false`): monitor principal 440x324 a 96 dpi (x 1060, y 30); segundo monitor 550x410 a 120 dpi (x -1235, y 36). Repetivel em mais 2 execucoes.
- `test ! -e ~/.claude/island/spike-fake.json`: passa (HOME real intocado). `git ls-files spike/results` vazio e pasta inexistente.
- `git diff --quiet 1f69f77 -- main.js state.js island.test.js`: sai 0.
- Greps de aceite do `.ps1`: sem `taskkill /IM` nem `Stop-Process -Name` (0), sem `remote-debugging` (0), `REGRA-DE-DECISAO` 2, `WorkingSetPrivate`, `SetThreadDpiAwarenessContext` e `taskkill` presentes. `-CleanDirs C:\Windows\foo` lanca erro sem apagar nada; `-ArgumentList '--in-process-gpu'` chega inteiro ao parametro.
- Nenhum `electron.exe` das execucoes ficou vivo; a porta 9333 so tem TIME_WAIT.

### Evidencia CDP de BASE-05 (instancia descartavel, repositorio como app, `USERPROFILE` e `--user-data-dir` em %TEMP%, `--remote-debugging-port=9333` so nesta verificacao, encerrada por PID raiz `taskkill /PID 33912 /T /F`)

```
visibilityState: ["visible","visible"]
(a) sem sessao, getAnimations().length: [0,0]
(b) running: glow:running, breathe:running, hop:running x3   (nas 2 paginas)
(c) hidden forcado, data-hidden: ["true","true"]
(c) animacoes: glow:paused, breathe:paused, hop:paused x3     (nas 2 paginas)
(c) todas paused: [true,true]
```

Ociosa: 0 animacoes. Em `running`: o `glow` roda no pseudo-elemento. Escondida: tudo `paused`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Tamanho esperado da janela a 125% estava errado na regra pre-registrada**
- **Found during:** Task 2, smoke do medidor
- **Issue:** a regra (e o plano) esperavam 550x405 no monitor a 125%. O Electron abre a janela com 550x410 (328 DIP), de forma repetivel, por causa do arredondamento de escala fracionaria (o `main.js` ja comenta essa instabilidade). Com a conta exata, toda execucao de E0 e E1 (2 janelas) ficaria INVALIDA.
- **Fix:** errata na propria regra, em commit separado e ainda sem nenhum arquivo em `spike/results/`: validade aceita diferenca de ate 2% (arredondada para cima) em largura e altura; TOPMOST e APPWINDOW seguem exatos; N1, N2, tentativas e elegibilidade de E2 nao mudaram. `hasValidWindows` ganhou `SIZE_TOLERANCE_PERCENT = 2` e um vetor de teste (550x410 vale, 550x420 e 1091x466 nao). A errata declara que o smoke imprimiu valores de memoria/CPU de E1 e que nenhum foi usado.
- **Files modified:** `spike/REGRA-DE-DECISAO.md`, `scripts/spike-verdict.js`, `scripts/spike-verdict.test.js`
- **Commits:** `37568c5`, `aecc597`
- **Para o autor:** a regra e pre-registro de mao unica; esta correcao foi feita sem consulta porque nao havia numero algum e o criterio e filtro de execucao, nao limiar de decisao. Vale conferir a errata antes de o plano 02 medir. Se preferir outro criterio (por exemplo exigir 405 exato e aceitar E0/E1 invalidas), e so reverter `37568c5` e o trecho correspondente do veredito antes de qualquer `spike/results/`.

**2. [Rule 1 - Bug] Sem `-CaptureDir` o medidor gravava `-0.png` e `-1.png` na pasta atual**
- **Found during:** Task 2, segundo smoke (apareceram no `git status`)
- **Issue:** o PowerShell converte `$null` em texto vazio ao chamar o metodo .NET; o C# testava `!= null`.
- **Fix:** `string.IsNullOrEmpty(captureBase)`; os dois PNG gerados foram apagados.
- **Files modified:** `scripts/measure-footprint.ps1`
- **Commit:** `12eb3a6`

### Ajustes de execucao (sem mudar o plano)

- Teste 4 de `animation.test.js` tinha regex que parava no `)` de `() =>`; corrigida antes do GREEN (entrou no commit `6a893bd`, o RED continua vermelho pelas 5 falhas).
- O `.ps1` tem BOM UTF-8: o Windows PowerShell 5.1 le arquivo sem BOM como ANSI e estragaria os acentos das mensagens.
- A sondagem opcional de estilo da ilha viva da Task 1 nao foi feita: nao havia nenhum `electron.exe` rodando na hora. Por isso a regra nao declara sondagem; estilo e geometria foram conferidos depois pelo proprio medidor numa instancia descartavel (e geraram a errata acima).
- `gsd_run` nao existe como funcao no shell deste agente; as consultas de estado usaram `node ~/.claude/gsd-core/bin/gsd-tools.cjs`.

## Auth gates

Nenhum.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum. A porta de depuracao 9333 existiu so na verificacao CDP (loopback, instancia descartavel, encerrada por PID) e o medidor nunca a abre (grep negativo).

## Self-Check

PASSED: os 5 arquivos criados existem e os 7 commits (`68db4e5`, `37568c5`, `a42483b`, `aecc597`, `12eb3a6`, `e0c28f6`, `6a893bd`) sao ancestrais do HEAD.
