---
phase: 02-funda-o-segura-do-gate-de-permiss-o
plan: 02
subsystem: seguranca
tags: [electron, ipc, node-test, permissao, rearme]
status: complete

requires:
  - phase: 02-01
    provides: acceptDecision, relógio performance.now() do gate e answeredId no payload
provides:
  - nextShownPermission, reducer puro do pedido exibido ({ id, since, epoch }), com vetores JSON
  - refresh(reason) em main.js, único lugar que atribui o pedido exibido
  - armEpoch no payload de island:state (consumido pelo renderer no plano 02-03)
  - show, restore e display-* ligados a refresh('rearm'), travados por teste de fonte
affects: [02-03, 02-04, fase-4-tela-cheia]

story_points_realized: 3
estimate:
  tokens: 40000
actuals:
  tokens: 6000
  tasks: 2
  commits: 4
plan_head_before: 4af0ae368908bd2912c46dcf9d83cdc654ee1f8c
plan_head_after: eb95d964aabf1450b6004c9435c2c6cbb2761728

tech-stack:
  added: []
  patterns:
    - "reducer puro com vetores JSON + funil único no main (refresh) em vez de atribuição espalhada"
    - "teste de fonte como trava de regressão barata para invariantes de estrutura"

key-files:
  created: []
  modified: [fixtures/permission-vectors.json, gate.test.js, state.js, main.js]

key-decisions:
  - "O pedido exibido (id, since, epoch) só é atribuído dentro de refresh(reason); a época sobe a cada troca ou rearme"
  - "O retorno antecipado de refresh compara estado serializado E época, para o rearme não ser engolido (Pitfall 2)"
  - "Só rearm === true exato rearma; a string 'true' não rearma"

patterns-established:
  - "Evento que devolve a janela à tela chama refresh('rearm') em vez de tocar em shown"

requirements-completed: [SEG-02, SEG-06]

duration: 4min
completed: 2026-11-21
---

# Phase 2 Plan 02: Funil único refresh e rearme na reexibição Summary

**O pedido exibido passou a mudar só em `refresh(reason)`, guiado pelo reducer puro `nextShownPermission` (9 vetores), e show, restore e mudança de monitor reiniciam os 800 ms do main e sobem `armEpoch`.**

## Accomplishments

- Task 1: `nextShownPermission` em `state.js`; `shown`, `lastSent` e `refresh(reason)` em `main.js`; o poll virou `refresh('poll')`; o handler `island:decide` lê `shown.id` e `shown.since`; `armEpoch: shown.epoch` entra no payload de `sendState`.
- Task 2: `island.on('show' | 'restore')` em `createIsland` e um laço sobre os três eventos de monitor em `start`, depois das linhas de `syncIslands` (intocadas).
- Teste de fonte trava exatamente duas atribuições a `shown` e a presença dos quatro ganchos de rearme.

## Task Commits

1. Task 1 RED: `17700ae` test(permissao): cobre o reducer do pedido exibido e o caminho único
2. Task 1 GREEN: `26cf37c` feat(permissao): funil único refresh para o pedido exibido
3. Task 2 RED: `da317aa` test(permissao): exige rearme em show, restore e mudança de monitor
4. Task 2 GREEN: `eb95d96` feat(permissao): reexibir, restaurar ou mudar de monitor rearma o pedido

## Verification

- `node --test gate.test.js` e `node --test` (= `pnpm test`): 83 testes, 0 falhas (72 do plano 01 + 11 novos).
- RED observado antes de cada GREEN (`nextShownPermission is not a function`; depois falha do gancho `show`).
- Critérios de aceite por grep conferidos: `function refresh(reason)` 1x, `shownPermission(Id|Since)` 0x, `if (serialized === lastSent) return;` 0x, `refresh('poll')` 1x, `armEpoch` 2x, `syncIslands` de `display-metrics-changed` intacto, `hook.js` e `permission-hook.js` sem diff.
- O Electron não foi iniciado (restrição da fase). UAT-3 (corrida real entre pedidos A e B) fica para o fim de fase. A prova ponta a ponta de "reexibir rearma" fica para a Fase 4 (A9).

## Deviations from Plan

None - plan executed exactly as written. Detalhe sem mudança de comportamento: `lastSent` ficou logo depois de `shown` (e não imediatamente após `lastPickedState`), porque o comentário de `shown` fica junto da declaração; `lastPickedState` continua declarado antes, então o inicializador é válido.

## Known Stubs

None.

## Issues Encountered

- O ledger de commits do plano não pôde ser gravado em `.git` (o sandbox do worktree recusa comandos git com o caminho do git-dir); `plan_head_before` é o HEAD no início do plano (`4af0ae3`) e `commits: 4` foi medido com `git rev-list --count`.

## Threat Flags

None. Nenhuma superfície nova além das cobertas por T-02-06 e T-02-18.

## Self-Check: PASSED

- Arquivos: `fixtures/permission-vectors.json`, `gate.test.js`, `state.js`, `main.js` presentes.
- Commits `17700ae`, `26cf37c`, `da317aa`, `eb95d96` presentes no histórico da branch.
