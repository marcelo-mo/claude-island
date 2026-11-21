---
phase: 02-funda-o-segura-do-gate-de-permiss-o
plan: 01
subsystem: seguranca
tags: [electron, ipc, node-test, permissao, fixtures]
status: complete

requires:
  - phase: 01
    provides: ilha em execução e o bloco CSS @keyframes glow (intocado)
provides:
  - acceptDecision, regra pura de aceite da decisão, com a ordem das checagens fixada por vetores JSON
  - isWithinWorkArea, regra pura de área visível com folga lateral e tolerância de 2 px
  - eco do id do pedido ponta a ponta (index.html, preload.js, main.js, state.js)
  - primeiro clique vence entre ilhas (decidedPermissionId + answeredId no payload de island:state)
  - fixtures/permission-vectors.json e gate.test.js, reaproveitáveis pelos planos 02-02 a 02-04
affects: [02-02, 02-03, 02-04, fase-4-tela-cheia]

story_points_realized: 5
estimate:
  tokens: 60000
actuals:
  tokens: 8400
  tasks: 2
  commits: 4
plan_head_before: 3e4126fca85f050975b651d4d5dfc80a09187314
plan_head_after: 8c20073534d985f7b76a579a565436272c21bc36

tech-stack:
  added: []
  patterns:
    - "vetores dourados em JSON puro + um test() por vetor (gate.test.js)"
    - "regra de fronteira de confiança como função pura em state.js; handler do main fino"

key-files:
  created: [fixtures/permission-vectors.json, gate.test.js]
  modified: [state.js, main.js, preload.js, index.html]

key-decisions:
  - "O alvo da decisão é sempre shownId do main; o eco do renderer só pode recusar"
  - "Só o valor exato aceita nos fatos da janela (windowVisible true, coveredByFullscreen false, withinVisibleArea true); fato ausente recusa"
  - "decidedPermissionId só é marcado depois de writeDecision retornar, para permitir nova tentativa se a gravação falhar"
  - "Instante do pedido exibido em performance.now() (monotônico); pickState segue com Date.now() porque updatedAt é relógio de parede"
  - "coveredByFullscreen é a constante false até a Fase 4 (TELA-01), com comentário ponytail"

patterns-established:
  - "Contrato do gate fixado pelo fixture: ordem dos motivos de recusa é testada pelos vetores de precedência"

requirements-completed: [SEG-01, SEG-04, SEG-06, SEG-07]

duration: 3min
completed: 2026-11-21
---

# Phase 2 Plan 01: Eco do id e gate puro de decisão Summary

**O main só grava uma decisão se `acceptDecision` (função pura, 39 vetores JSON) aceitar: eco do id estrito, 800 ms em relógio monotônico, primeiro clique vence entre ilhas, e janela invisível, fora da área ou coberta recusa.**

## Accomplishments

- Tracer (Task 1): renderer envia `decide(behavior, pressedId)`, o preload repassa, o main chama `acceptDecision` e grava `verdict.permissionId` (sempre `shownId`). Main, preload e renderer entraram no mesmo commit, então não houve janela em que toda decisão fosse recusada.
- Expansão (Task 2): `already-decided`, `window-hidden`, `covered-by-fullscreen`, `outside-visible-area` no contrato; `isWithinWorkArea` com 18 vetores (monitor primário, secundário em x negativo, folga e tolerância); `answeredId` trava os botões da outra ilha.
- `hook.js` e `permission-hook.js` não foram alterados; o bloco `@keyframes glow` também não.

## Task Commits

1. Task 1 RED: `b87aa8e` test(permissao): adiciona vetores dourados e a suíte do gate de decisão
2. Task 1 GREEN: `70934af` feat(permissao): exige o eco do id do pedido na decisão da ilha
3. Task 2 RED: `767e334` test(permissao): cobre primeiro clique vence e janela fora da área
4. Task 2 GREEN: `8c20073` feat(permissao): primeiro clique vence e janela invisível ou fora da área não decide

## Verification

- `node --test gate.test.js`: 59 testes, 0 falhas. `node --test` (= `pnpm test`): 72 testes, 0 falhas (13 antigos + 59 novos).
- RED observado antes de cada GREEN (TypeError `acceptDecision is not a function`; depois 29 falhas).
- Critérios de aceite por grep conferidos (`performance.now()` 2x em main.js, `decidedPermissionId` 4x, `TELA-01` 1x, `@keyframes glow` 1x, `hook.js`/`permission-hook.js` sem diff).
- O Electron não foi iniciado (restrição da fase). UAT-4 (corrida real entre duas ilhas em dois monitores) fica para o fim de fase, colhida pelo verificador.

## Deviations from Plan

None - plan executed exactly as written. Detalhes menores sem mudança de comportamento: `decisionOutput` saiu do `require` de `main.js` por ficar sem uso (o plano só citava `PERMISSION_ARM_MS`); `fixtures/permission-vectors.json` foi gerado por script descartável fora do repo (saída com 2 espaços).

## Known Stubs

- `main.js`, handler `island:decide`: `coveredByFullscreen: false` é constante intencional (T-02-03, risco residual aceito). Sonda e prova ponta a ponta são TELA-01/TELA-02 da Fase 4; a regra e o contrato já estão prontos e cobertos pelos vetores.

## Issues Encountered

- O ledger de commits do plano ficou fora de `.git` (o sandbox do worktree recusou comandos git com o caminho do git-dir); `commits: 4` foi medido com `git rev-list --count` a partir de `plan_head_before`.

## Threat Flags

None. Nenhuma superfície nova além das cobertas por T-02-01 a T-02-05.

## Self-Check: PASSED

- Arquivos: `fixtures/permission-vectors.json`, `gate.test.js`, `state.js`, `main.js`, `preload.js`, `index.html` presentes.
- Commits `b87aa8e`, `70934af`, `767e334`, `8c20073` presentes no histórico da branch.
