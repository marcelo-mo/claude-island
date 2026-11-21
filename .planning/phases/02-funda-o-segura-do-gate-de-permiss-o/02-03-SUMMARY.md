---
phase: 02-funda-o-segura-do-gate-de-permiss-o
plan: 03
subsystem: seguranca
tags: [electron, renderer, node-test, node-vm, permissao, armamento, roda]
status: complete

requires:
  - phase: 02-02
    provides: armEpoch no payload de island:state e refresh(reason) no main
  - phase: 02-01
    provides: decide(behavior, pressedId) na ponte, answeredId no payload, PERMISSION_ARM_MS
provides:
  - bloco puro regras-do-gate em index.html (settleStep, canPress, isValidRelease, isWheelSettled, canMarkRead e as constantes do renderer)
  - armamento do renderer por armEpoch, ResizeObserver e visibilitychange, com retângulo assentado, opacidade 1 e dwell de 200 ms
  - clique que só vale começando e terminando no mesmo botão, pedido e geração de armamento, com eco = id do pointerdown
  - roda sobre o texto que nunca se propaga e não rola nos 400 ms após a troca, sem marcar leitura pela inércia
  - vetores dos cinco predicados no fixture e teste que executa o bloco extraído em contexto node:vm vazio
affects: [02-04, fase-3-spring, fase-5-troca-de-sessao]

story_points_realized: 5
estimate:
  tokens: 65000
actuals:
  tokens: 8100
  tasks: 2
  commits: 4
plan_head_before: 63a76cfaceec3971bd990c34280a978f87bcdb29
plan_head_after: f778e080c459e1c16bbd7605dc30cc767a5ef1b1

tech-stack:
  added: []
  patterns:
    - "predicados puros inline no script do renderer, testados por extração entre marcadores e vm.runInNewContext num contexto vazio (prova de pureza)"
    - "geração de armamento (armToken) invalida timers, laços de quadro e press de gerações anteriores"

key-files:
  created: []
  modified: [index.html, gate.test.js, fixtures/permission-vectors.json]

key-decisions:
  - "As regras puras ficam inline entre // regras-do-gate:inicio e :fim: a CSP não ganha 'self' e o teste roda o mesmo texto que o renderer roda"
  - "isValidRelease exige a mesma geração de armamento (armToken) do pointerdown, porque armed sozinho não pega rearme que volta a armar no meio do gesto"
  - "onState também rearma por id de pedido novo, além de armEpoch, para o renderer não depender só do contador do main"
  - "O timer de armamento é cancelado a cada restartArming, para a animação de largura da pílula não empilhar timers"

patterns-established:
  - "O renderer só acrescenta recusas; o main continua a autoridade dos 800 ms, do eco e do primeiro que vence"

requirements-completed: [SEG-02, SEG-03, SEG-04, SEG-05]

duration: 14min
completed: 2026-11-21
---

# Phase 2 Plan 03: Armamento do renderer, clique no mesmo botão e roda Summary

**Permitir e Negar só armam com o pedido parado, opaco e o cursor quieto, o clique só vale no mesmo botão do mesmo pedido, e a inércia da roda logo após a troca não rola nem marca leitura, tudo decidido por cinco predicados puros com 52 vetores.**

## Accomplishments

- Task 1: bloco `regras-do-gate` com `PERMISSION_ARM_MS`, `SETTLE_STABLE_MS` (100), `PRESS_DWELL_MS` (200), `settleStep`, `canPress`, `isValidRelease`. Cola: `restartArming`, `waitUntilSettled` (laço de `requestAnimationFrame` só enquanto arma com pedido), `ResizeObserver` em `#pill` e `#actions`, `visibilitychange`, `pointermove` em `#actions`, press por `pointerdown`, soltar validado em `click`, `pointerup` fora do botão e `pointercancel` anulam. O `armedPermissionId` e o timeout por id saíram.
- Task 2: `WHEEL_SETTLE_MS` (400), `READ_TOLERANCE_PX` (2), `isWheelSettled`, `canMarkRead`. Listener `wheel` em `#permission-text` com `{ passive: false }`: sempre `stopPropagation`, `preventDefault` dentro da janela. `contentChangedAt` muda por id, `armEpoch` ou texto e agenda um `render` ao fim da janela (texto curto também vira lido). `overscroll-behavior: contain` só na regra de `#permission-text`.
- `gate.test.js`: `loadRendererRules()` exige cada marcador uma única vez, executa o bloco num contexto `Object.create(null)` e confere as constantes contra o fixture; um teste por vetor; trava de CSP exata.

## Task Commits

1. Task 1 RED: `daecda8` test(ilha): cobre os predicados de armamento e de clique do renderer
2. Task 1 GREEN: `940340f` feat(ilha): arma os botões só com o pedido assentado e o clique no mesmo botão
3. Task 2 RED: `e5f5986` test(ilha): cobre a janela da roda e a marcação de leitura
4. Task 2 GREEN: `f778e08` feat(ilha): ignora a inércia da roda logo após a troca do pedido

## Verification

- `node --test` (= `pnpm test`): 127 testes, 0 falhas (83 anteriores + 44 novos); `node --test gate.test.js`: 114, 0 falhas.
- RED observado antes de cada GREEN (marcador ausente; depois ReferenceError dos nomes da roda no contexto vazio).
- O script inline compila com `new vm.Script` (saída 0) depois de cada task.
- Critérios de aceite por grep conferidos: marcadores 1x, `function settleStep|canPress|isValidRelease|isWheelSettled|canMarkRead` 1x cada, `armedPermissionId` 0x, `new ResizeObserver` 1x, `window.island.decide(behavior, pressed.id)` 1x, `pointercancel` e `visibilitychange` presentes, `{ passive: false }` 1x, `overscroll-behavior: contain` 1x, `@keyframes glow` 1x, CSP exata 1x, hover dos botões sem transform; vetor do rearme no meio do gesto existe.
- O Electron não foi iniciado (restrição da fase). A cola de DOM (rAF, ResizeObserver, eventos de ponteiro e de roda) só é exercitada na UAT de fim de fase: UAT-2, UAT-5 e UAT-6.

## Deviations from Plan

None - plan executed exactly as written. Duas escolhas dentro do que o plano deixou aberto: `restartArming` guarda e limpa o timer (`armTimer`) e `onState` rearma também quando o id do pedido muda, não só por `armEpoch`; ambas só recusam mais, nunca concedem.

## Known Stubs

None.

## Issues Encountered

- O sandbox do worktree recusa comandos compostos com git; o ledger `gsd-plan-head-before-02-03` foi gravado em `.git/worktrees/claude-island-fase2/` e `commits: 4` foi medido com `git rev-list --count` a partir dele.
- Risco A6 do plano segue aberto até a UAT-5: se o `preventDefault` do `wheel` não valer no Chromium, a alternativa é `overflow: hidden` temporário no texto durante a janela de 400 ms.

## Threat Flags

None. Nenhuma superfície nova além das cobertas por T-02-08 a T-02-12 e T-02-19.

## Self-Check: PASSED

- Arquivos: `index.html`, `gate.test.js`, `fixtures/permission-vectors.json` presentes.
- Commits `daecda8`, `940340f`, `e5f5986`, `f778e08` presentes no histórico da branch.
