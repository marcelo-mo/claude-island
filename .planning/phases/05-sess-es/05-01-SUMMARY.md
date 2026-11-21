---
phase: 05-sess-es
plan: 01
subsystem: gate
tags: [permissao, ancora-ao-lado, area-visivel, seg-06, merge]

requires:
  - phase: 06-convivencia
    provides: âncoras ao lado da ilha do sistema (right-of-island, left-of-island), BESIDE_GAP_PX e coexistence.test.js, já na main (PR #9)
provides:
  - BESIDE_MIN_WORK_AREA_WIDTH_PX (1220) e besideFits(anchor, workArea) em state.js
  - fitsVisibleArea(island, display) no main.js, a única expressão de "janela à vista" para o renderer e para o gate
  - grupos besideDecision e besideFits e a chave besideMinWorkAreaWidthPx no fixture de vetores
affects: [05-02, 05-03, 05-04, 05-05, 05-06, 05-07]

plan_head_before: 4baf61aa05a3b7fc8ff3bd5c01d5f83f9ea5cfe6
plan_head_after: 5abe50c
story_points_realized: 3

actuals:
  tokens: 3900
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "um fato de geometria, uma função no main, chamada pelo renderer e pelo gate"

key-files:
  created: []
  modified: [state.js, main.js, gate.test.js, fixtures/permission-vectors.json, README.md]

key-decisions:
  - "A recusa vale para a âncora ao lado em qualquer monitor abaixo de 1220 DIP, mesmo sem o mod aberto nele: a ilha não enxerga o mod, e esse é o lado seguro"
  - "acceptDecision não mudou; a regra entra só no fato withinVisibleArea, que sai de fitsVisibleArea"

requirements-completed: [SEG-06]

coverage:
  - id: D1
    description: "A main com a Fase 6 entra na branch por merge, sem reescrever a história"
    verification:
      - kind: other
        ref: "git merge-base --is-ancestor 6741b25 HEAD (sai 0); node --test com coexistence.test.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "Com a âncora ao lado em 1093 ou 1066 DIP o gate recusa com outside-visible-area; a 1220 aceita"
    requirement: SEG-06
    verification:
      - kind: unit
        ref: "gate.test.js#besideDecision (3 vetores)"
        status: pass
    human_judgment: false
  - id: D3
    description: "besideFits devolve true para toda âncora que não é ao lado e false para dado que não confere nas duas ao lado"
    requirement: SEG-06
    verification:
      - kind: unit
        ref: "gate.test.js#besideFits (15 vetores) e a constante espelhada no fixture"
        status: pass
    human_judgment: false
  - id: D4
    description: "O renderer mostra 'Responda no terminal' com os botões desabilitados na âncora ao lado em tela estreita"
    requirement: SEG-06
    verification:
      - kind: unit
        ref: "gate.test.js#o renderer e o gate conferem a área visível pela mesma função, com a âncora ao lado"
        status: pass
    human_judgment: true
    rationale: "A trava prova que sendState e island:decide usam a mesma função; só uma pessoa na tela vê os botões desabilitados a 1366x768 a 125%"

duration: 14min
completed: 2026-11-21
status: complete
---

# Phase 5 Plan 01: Âncora ao lado em tela estreita Summary

**A decisão passa a ser recusada com a âncora "ao lado da ilha do sistema" numa área útil abaixo de 1220 DIP: `besideFits` entra em `fitsVisibleArea`, a função do main que alimenta o `fitsWorkArea` do renderer e o `withinVisibleArea` do gate.**

## Performance

- **Duration:** 14 min
- **Tasks:** 2
- **Files modified:** 5
- **Commits:** 3 (o merge da main, `ca1438c`, já tinha sido feito pelo orquestrador e fica fora da contagem)

## Accomplishments

- Passo 0 (merge) detectado como já feito: `git merge-base --is-ancestor 6741b25 HEAD` sai 0 e `ca1438c` é o último merge da branch. A base B de testes depois do merge é **362** (348 da Fase 4 mais 14 de `coexistence.test.js`), `fail 0`.
- `state.js`: `BESIDE_MIN_WORK_AREA_WIDTH_PX = 2 * (BESIDE_GAP_PX + EXPANDED_PILL_WIDTH_PX)` (1220) e `besideFits(anchor, workArea)`, logo depois de `horizontalSlackFor`, exportados numa linha própria. Sem tocar nas funções de âncora da Fase 6.
- `main.js`: `fitsVisibleArea(island, display)` logo depois de `displayOf`. `sendState` e `island:decide` a chamam, então o fato do renderer e o do gate nunca divergem. `acceptDecision` e a ordem das checagens não mudaram.
- Fixture: grupo `besideDecision` (1093 e 1066 recusam, 1220 aceita), grupo `besideFits` com 15 vetores e a chave `besideMinWorkAreaWidthPx`, todos no fim; nenhum grupo antigo mudou (comparado com `c461158`).
- README: o limite de 1220 DIP agora diz que os botões ficam desabilitados com "Responda no terminal" e por que a regra vale mesmo sem o mod aberto no monitor.

## Commits

| Hash | Tipo | Assunto |
|------|------|---------|
| `01b2f0b` | RED | test(gate): cobre a recusa da âncora ao lado em tela estreita |
| `2dfa03a` | GREEN | fix(gate): recusa a decisão com a âncora ao lado abaixo de 1220 DIP |
| `5abe50c` | test | test(gate): cobre besideFits em toda âncora e documenta o limite de 1220 DIP |

## Testes

Base B (depois do merge): 362. Final: **382**, `fail 0` (362 + 3 `besideDecision` + 1 trava de `fitsVisibleArea` + 15 `besideFits` + 1 de constante).

Travas de `gate.test.js` que mudaram de propósito, no mesmo commit do código (`2dfa03a`): o par `withinVisibleArea` do teste "island:decide: o eco vem do renderer…" e a linha do `fitsWorkArea` do teste "refresh não engole o rearme…". Ambas agora apontam para `fitsVisibleArea(island, display)`.

## Deviations from Plan

None - plan executed exactly as written.

Observações sem impacto:

- O registro do ponto de partida do plano em `.git` (ledger) foi recusado pelo guarda do worktree; o `commits:` foi medido a partir de `4baf61a`, o HEAD no início da execução (`git rev-list --count 4baf61a..HEAD` = 3).
- O plano manda importar `BESIDE_MIN_WORK_AREA_WIDTH_PX` já na Task 1; entrou na Task 2, onde o teste de constante o usa, para não deixar importação sem uso.
- A ponte com o Boards não está em uso neste repositório (sem `.planning/boards/`), então o shim não foi chamado.

## Testar manualmente

Fica para o checklist do PR (o plano 07 consolida):

- A 1366x768 a 125% (área útil abaixo de 1220 DIP), com a âncora *Ao lado da ilha do sistema* e um pedido de permissão na tela, os botões Permitir e Negar aparecem desabilitados com "Responda no terminal". Em área útil de 1220 DIP ou mais, os botões funcionam como antes.

## Known Stubs

None.

## Threat Flags

None. A superfície nova é só a conferência de geometria já coberta pelo T-05-01 do plano.

## Next Phase Readiness

Pronto para o 05-02. O plano parte do código com a Fase 6 e não depende de nada deste além do `fitsVisibleArea`, que fica como está.

## Self-Check: PASSED

- `state.js`, `main.js`, `gate.test.js`, `fixtures/permission-vectors.json`, `README.md` existem e foram commitados.
- Commits `01b2f0b`, `2dfa03a` e `5abe50c` são ancestrais de HEAD.
- `node --test`: 382 testes, `fail 0`. Critérios de aceite das duas tasks reexecutados e passando; `hook.js` e `permission-hook.js` intocados; fim de linha CRLF mantido em `state.js`, `main.js`, `gate.test.js` e `README.md`, LF no fixture.
