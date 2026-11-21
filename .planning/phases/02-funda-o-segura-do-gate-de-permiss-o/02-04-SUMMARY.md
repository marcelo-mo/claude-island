---
phase: 02-funda-o-segura-do-gate-de-permiss-o
plan: 04
subsystem: seguranca
tags: [electron, webpreferences, ipc, licenca-mit, node-test, opacidade]
status: complete

requires:
  - phase: 02-03
    provides: gate.test.js, fixtures/permission-vectors.json e o canal island:decide com eco
provides:
  - THIRD_PARTY_NOTICES.md com o mod Dynamic Island for Windows 1.4.0 (devcode90, MIT completo) e a paleta Nord
  - SECURE_WEB_PREFERENCES congelado em state.js, espalhado por último em webPreferences de createIsland
  - testes que travam o trio seguro e a lista fechada de canais IPC (sete no preload, seis ipcMain.on no main)
  - effectiveOpacity pura com 11 vetores (com pedido na tela ou fato desconhecido, sempre 1)
affects: [fase-3-spring, fase-4-preferencias, fase-5-troca-de-sessao]

story_points_realized: 3
estimate:
  tokens: 45000
actuals:
  tokens: 2400
  tasks: 3
  commits: 6
plan_head_before: 35290897af6ddc96e4b85ed66bdc64c7a2311157
plan_head_after: 0d920cd9fc790a13f12cb10d1751dbe80e44b6ae

tech-stack:
  added: []
  patterns:
    - "trava de regressão por regex sobre o código-fonte (webPreferences e canais IPC), assumidamente frágil e barata"
    - "fato desconhecido vale o caso seguro: hasPermission diferente de false dá opacidade 1"

key-files:
  created: [THIRD_PARTY_NOTICES.md]
  modified: [state.js, main.js, gate.test.js, fixtures/permission-vectors.json]

key-decisions:
  - "O corpo MIT do aviso é comparado com o LICENSE do repositório (idêntico ao do mod salvo a linha do titular, conferido por diff na pesquisa), o que prova o texto completo sem rede"
  - "Sem trava de process.sandboxed no preload: a Assumption A7 não foi verificada e, sem poder subir o Electron nesta execução, a trava poderia impedir a ilha de subir (T-02-17 aceita; reavaliar na UAT-1)"
  - "Sem setWindowOpenHandler nem will-navigate: fora do escopo estrito, o renderer não tem links"
  - "O comentário do spread seguro fica na linha acima, não ao lado, para a regex do teste enxergar o spread como última entrada"

patterns-established:
  - "Canal IPC novo, inclusive de preferência, exige editar o teste de lista fechada de propósito (invariante I9)"

duration: 10min
completed: 2026-11-21
---

# Phase 2 Plan 04: Aviso de licença, webPreferences seguras e opacidade efetiva Summary

**THIRD_PARTY_NOTICES.md credita o mod (1.4.0, devcode90, MIT completo) e a Nord antes de qualquer constante portada, as janelas abrem com contextIsolation e sandbox explícitos e a lista de canais IPC está travada por teste, e effectiveOpacity garante opacidade 1 com pedido na tela.**

## Accomplishments

- CONV-04: aviso MIT do mod e da paleta Nord na raiz, com prosa em pt-BR e licença verbatim; o teste compara com o corpo MIT do `LICENSE`.
- SEG-08: `SECURE_WEB_PREFERENCES` (`contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`) congelado e espalhado por último em `webPreferences`; testes de igualdade, de congelamento, de regex de fonte e da lista fechada de canais.
- SEG-05 (contrato puro): `effectiveOpacity(preferredOpacity, hasPermission)` com vetores portáveis no fixture. Ainda sem consumidor (PREF-06 da Fase 4).

## Task Commits

1. Task 1 RED: `64d26ce` test(licenca): exige o aviso MIT do mod antes das constantes portadas
2. Task 1 GREEN: `c36ae39` docs(licenca): credita o mod Dynamic Island for Windows e a paleta Nord
3. Task 2 RED: `a558af3` test(seguranca): trava webPreferences e a lista de canais IPC
4. Task 2 GREEN: `4c1718f` feat(seguranca): explicita webPreferences seguras nas janelas da ilha
5. Task 3 RED: `4eb0bd6` test(permissao): cobre a opacidade efetiva com pedido na tela
6. Task 3 GREEN: `0d920cd` feat(permissao): regra pura de opacidade efetiva com pedido na tela

## Ordem de CONV-04 para a Fase 3

O commit que adiciona o aviso é `c36ae39`. A Fase 3 confere que ele é anterior ao primeiro commit com constantes portadas com `git log --diff-filter=A --format=%h -- THIRD_PARTY_NOTICES.md`. Nesta fase nenhuma constante do mod é portada.

## Deviations from Plan

None - plan executed exactly as written.

Os testes de lista de canais do Task 2 já passavam no RED, porque travam o estado atual (sete e seis canais); só os dois testes de `SECURE_WEB_PREFERENCES` falharam, como esperado.

## Verification

- `node --test`: 143 testes, 0 falhas.
- UAT-1 (subir a ilha com as webPreferences explícitas e disparar um `PermissionRequest` pelo `permission-hook.js`) não foi executada: o executor não inicia o Electron. Fica para a verificação de fim de fase.

## Known Stubs

- `effectiveOpacity` em `state.js` não tem consumidor até a Fase 4 (PREF-06). Intencional: é o contrato puro que o vetor leva a um gate futuro; não é stub de UI.

## Threat Flags

None.

## Self-Check: PASSED

- THIRD_PARTY_NOTICES.md, state.js, main.js, gate.test.js, fixtures/permission-vectors.json existem.
- Commits 64d26ce, c36ae39, a558af3, 4c1718f, 4eb0bd6, 0d920cd estão no histórico da branch.
