---
phase: 05-sess-es
plan: 04
subsystem: sessoes
tags: [sessoes, snap, fila, permissao, nextselection, sess-04, sess-05, sess-06, gate]

requires:
  - phase: 05-sess-es
    provides: nextSelection (poll, select, scroll), wheelStep, refresh com a seleção, island:wheel e wheelGesture (planos 02 e 03), suíte de 409 testes
provides:
  - SNAP_GESTURE_GAP_MS e SNAP_WHEEL_LOCK_MS (400 ms) em state.js
  - poll de nextSelection com { previousKeys, now, lastWheelAt, shownPermissionId } e requests [{ id, seenAt, handled, shown }]: snap uma vez por pedido, adiamento no gesto, fila sem snap e avanço quando o pedido exibido sai
  - lastWheelAt e wheelLockedUntil no main.js, com a roda travada por 400 ms depois de um snap
  - "#permission-queue com 'N de M' no cabeçalho do pedido"
affects: [05-05, 05-06, 05-07]

plan_head_before: 35e5cfb
plan_head_after: 097888910dc056f88c5b657103eca4d67ab38161
story_points_realized: 8

actuals:
  tokens: 11000
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "pollSelection reconstrói requests a cada poll e decide, nesta ordem: avanço (pedido exibido saiu), adiamento no gesto, fila (pedido na tela) ou snap; shown passa a true no pedido exibido e no da sessão devolvida e nunca volta atrás"
    - "o main passa os fatos (relógio monotônico, última roda, shown.id de antes do refresh) e só reage a selection.snapped travando a roda; nada no refresh mostra, esconde ou reexibe a ilha"

key-files:
  created: []
  modified: [state.js, main.js, index.html, island.test.js, gate.test.js, README.md]

key-decisions:
  - "Todo o poll (snap, adiamento, fila e avanço) ficou numa função pollSelection do state.js, chamada por nextSelection, em vez de crescer o switch"
  - "Pedido novo sem now finito não entra em requests: espera o próximo ciclo em vez de ganhar um seenAt inválido"
  - "O avanço não espera os 400 ms do gesto (exceção da D-14) e devolve snapped true, então a trava da roda vale para ele também"

requirements-completed: [SESS-04, SESS-05, SESS-06]

coverage:
  - id: D1
    description: "Um pedido novo leva a ilha à sessão dele uma vez; quem rolou para longe não é puxado de novo e o ponto segue pulsando"
    requirement: SESS-04
    verification:
      - kind: unit
        ref: "island.test.js#o pedido novo leva a ilha à sessão dele uma vez e não puxa de novo quem rolou para longe (SESS-04)"
        status: pass
    human_judgment: true
    rationale: "A sensação do snap com a roda real e o som de 'precisa de você' só se confirmam na tela"
  - id: D2
    description: "O snap espera 400 ms sem roda e o pedido ainda conta como novo; a roda é ignorada por 400 ms depois do snap"
    requirement: SESS-04
    verification:
      - kind: unit
        ref: "island.test.js#o snap espera o fim do gesto da roda e o pedido ainda conta como novo (SESS-04); gate.test.js#o refresh leva os fatos ao poll, trava a roda depois do snap..."
        status: pass
    human_judgment: true
    rationale: "A inércia do touchpad só se avalia com o aparelho"
  - id: D3
    description: "Com um pedido na tela o novo entra na fila sem snap e sem ter sido exibido; 'N de M' por ordem de chegada ao main"
    requirement: SESS-05
    verification:
      - kind: unit
        ref: "island.test.js#com um pedido na tela o novo entra na fila sem snap...; a fila de ponta a ponta dá 'N de M'...; gate.test.js#o 'N de M' é o primeiro filho do cabeçalho do pedido..."
        status: pass
    human_judgment: true
    rationale: "O cabeçalho com 'N de M' ao lado do projeto só se confirma na tela"
  - id: D4
    description: "Quando o pedido exibido sai, a ilha vai ao mais antigo restante sem esperar o gesto; sem pendentes ou com o usuário numa sessão sem pedido, nada se move"
    requirement: SESS-05
    verification:
      - kind: unit
        ref: "island.test.js#quando o pedido exibido sai a ilha vai ao mais antigo restante...; quem estava numa sessão sem pedido não se move..."
        status: pass
    human_judgment: false
  - id: D5
    description: "Só pedido de permissão troca a sessão sozinho; concluir, voltar a trabalhar e aparecer não"
    requirement: SESS-06
    verification:
      - kind: unit
        ref: "island.test.js#só um pedido de permissão troca a sessão sozinho; concluir, voltar a trabalhar e aparecer não (SESS-06)"
        status: pass
    human_judgment: false
  - id: D6
    description: "O refresh não chama showInactive, applyVisibility nem setUserHidden: um snap com a ilha escondida ou em tela cheia só muda a seleção"
    verification:
      - kind: unit
        ref: "gate.test.js#o refresh leva os fatos ao poll, trava a roda depois do snap e nunca reexibe a ilha..."
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-11-21
status: complete
---

# Phase 5 Plan 04: Snap, fila e avanço Summary

**Um pedido de permissão novo leva a ilha uma vez à sessão que o fez (nunca no meio de um gesto de roda nem por cima do pedido que está na tela), pedidos simultâneos formam uma fila por ordem de chegada com "N de M", e quando o pedido exibido sai a ilha vai ao mais antigo restante.**

## Performance

- **Duration:** 30 min
- **Tasks:** 2
- **Files modified:** 6
- **Commits:** 4 (RED e GREEN de cada task), medido de `35e5cfb` até `0978889`

## Accomplishments

- `state.js`: `SNAP_GESTURE_GAP_MS` e `SNAP_WHEEL_LOCK_MS` (400 ms, escolha do projeto com o motivo da inércia do touchpad), e `pollSelection` (chamada pelo `case 'poll'`): reconstrói `requests` com `seenAt`, `handled` e `shown`, ordena por chegada e depois pelo id, e decide avanço, adiamento, fila ou snap. JSDoc de `nextSelection` atualizado.
- `main.js`: `lastWheelAt` e `wheelLockedUntil`; `refresh` passa `now` monotônico, `lastWheelAt` e `shownPermissionId: shown.id` e trava a roda quando `selection.snapped`; o handler `island:wheel` grava `lastWheelAt` e ignora a roda travada antes de `wheelStep` (a roda ignorada ainda conta como gesto).
- `index.html`: `#permission-queue` (primeiro filho de `#permission-tool`, `float: right`, cor da dica) preenchido com "N de M" quando `current.queue` existe.
- `README.md`: cinco itens na seção "Várias sessões" (snap uma vez, fila, avanço, rearme a cada troca, ilha escondida não reaparece).

## Commits

| Hash | Tipo | Assunto |
|------|------|---------|
| `d84cab2` | RED | test(sessoes): cobre o snap uma vez por pedido |
| `3a56939` | GREEN | feat(sessoes): leva a ilha uma vez à sessão que pede permissão |
| `78d670e` | RED | test(sessoes): cobre a fila de pedidos e o avanço depois da resposta |
| `0978889` | GREEN | feat(sessoes): enfileira pedidos simultâneos e vai ao próximo depois de responder |

## Testes

Base: 409. Final: **421**, `fail 0` (`island.test.js` de 49 para 59 testes, `gate.test.js` de 83 para 85). O script inline do renderer compila em `node:vm`. O `node -e` do plano imprime `b true a false`. Os seis arquivos tocados seguem `w/crlf`.

Travas que mudaram de propósito, no mesmo commit do código:

- A trava "a seleção só muda por nextSelection e o refresh a calcula antes de escolher a sessão" (`gate.test.js`) procurava `nextSelection(selection, list, { type: 'poll'` em uma linha; o evento de poll agora tem cinco campos e fica em várias linhas, então a peça virou `nextSelection(selection, list, {\n    type: 'poll'`.
- A conta do palco: `toolLabelLines()` soma "99 de 99" (8 caracteres) e a margem de `#permission-queue`. O pior caso continua em 3 linhas e o teste do palco passou sem mexer no palco.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Bloqueio] Trava textual do refresh quebrava com o evento de poll em várias linhas**
- **Found during:** Task 1 (primeira rodada do GREEN)
- **Issue:** o teste do plano 02 exige a string `nextSelection(selection, list, { type: 'poll'` numa linha só.
- **Fix:** atualizei a peça da trava para o formato em várias linhas (a ordem das quatro peças do refresh segue verificada).
- **Files modified:** `gate.test.js`
- **Commit:** `3a56939`

**2. [Ordem] O avanço da Task 2 nasceu junto do poll da Task 1**
- O `pollSelection` foi escrito inteiro na Task 1 (snap, adiamento, fila e avanço, como uma função só, pelo mesmo caminho de reconstrução de `requests`). Por isso os quatro testes de `island.test.js` da Task 2 já passaram no RED; o RED real da Task 2 foram os testes do renderer e da conta do palco. O comportamento entregue é o mesmo do plano.

Fora isso, o plano foi executado como escrito. As linhas de baseline `[HEAD=41 ...]` do plano partiam de um HEAD antigo; as metas finais (>= 53 e >= 57 em `island.test.js`, >= 85 em `gate.test.js`, >= 418 testes) foram cumpridas (59, 85, 421).

Observações sem impacto:

- O ledger do ponto de partida em `.git` não foi usado; o `commits:` foi medido de `35e5cfb`, o HEAD no início da execução.
- A ponte com o Boards não está em uso neste repositório (sem `.planning/boards/`), então o shim não foi chamado.
- `STATE.md` e `ROADMAP.md` ficam com o orquestrador, como pedido. `.planning/state.json` continua sem rastreio.
- Nenhum método novo no preload, então o shim da casca Tauri não mudou.

## Para a atenção do orquestrador

- O plano 05 (Task 3 da D-21) parte de `requests` já com `shown`: o pedido nunca exibido mais antigo, na saída de fato da sessão exibida, entra antes da vizinha em `keyAfterPoll`/`pollSelection`. Hoje, com a sessão exibida fora da lista, vale só a vizinha, e um pedido ainda não tratado (`handled` false) pode levar ao snap pela regra normal.
- Caso de borda aceito: se o usuário rola para fora da sessão do pedido exibido no mesmo ciclo em que esse pedido sai (o `shown.id` ainda é o de antes do refresh), o avanço pode puxá-lo ao próximo pendente. É seguro (a troca rearma 0,8 s e zera a leitura) e dura um ciclo de 400 ms.
- Cada snap e cada avanço passam por `refresh`, que muda `shown` só por `nextShownPermission`; a ordem de `acceptDecision` e os grupos antigos do fixture não foram tocados.

## Testar manualmente

Fica para o checklist do PR (o plano 07 consolida):

- Com duas sessões, um pedido na outra leva a ilha até ela uma vez e toca o som de "precisa de você".
- Rolando para longe, a ilha não volta e o ponto da sessão do pedido pulsa.
- Girando a roda quando o pedido chega, a troca espera o gesto parar.
- Com um pedido na tela, um segundo pedido só aparece como "1 de 2" e no ponto.
- Ao responder o primeiro (na ilha e, noutra rodada, no terminal), a ilha vai ao segundo, com Permitir e Negar desabilitados por 0,8 s.
- Com a ilha escondida pelo atalho, um pedido novo não a mostra.
- Girando a roda sobre a pílula enquanto o pedido exibido é respondido no terminal, a ilha vai ao próximo pendente sem esperar o gesto (exceção da D-14) e Permitir/Negar só armam depois dos 800 ms.

## Known Stubs

None.

## Threat Flags

None. O snap, a fila e o avanço estão cobertos pelo threat model do plano (T-05-15 a T-05-18): toda troca muda `shown` dentro de `refresh` (rearma 0,8 s e zera a leitura), o pedido novo nunca toma o lugar do que está na tela, a roda é travada por 400 ms depois do snap e o `refresh` não mostra nem reexibe a ilha. Nenhuma roda, clique ou tecla sintética foi gerada, e o Electron não foi iniciado.

## Self-Check: PASSED

- Arquivos: `state.js`, `main.js`, `index.html`, `island.test.js`, `gate.test.js` e `README.md` existem e estão commitados.
- Commits `d84cab2`, `3a56939`, `78d670e` e `0978889` estão na branch `feat/fase-5-sessoes`.
- `node --test`: 421 testes, 0 falhas; `grep -c "^test(" island.test.js` = 59, `gate.test.js` = 85.
