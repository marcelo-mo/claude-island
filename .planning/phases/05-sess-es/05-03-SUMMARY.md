---
phase: 05-sess-es
plan: 03
subsystem: sessoes
tags: [sessoes, roda, island-wheel, wheelstep, sess-02, gate]

requires:
  - phase: 05-sess-es
    provides: nextSelection, lastSessionList, refresh, island:select e os pontos (plano 02), suíte de 400 testes
provides:
  - wheelStep(gesture, delta, now) e as constantes WHEEL_NOTCH_DELTA, WHEEL_GESTURE_PAUSE_MS, WHEEL_STEP_MS, WHEEL_PRECISE_STEP_MS e WHEEL_DELTA_MAX em state.js, com o evento scroll em nextSelection
  - wheelGesture e o canal island:wheel no main.js; wheel no preload.js e no shim da casca Tauri
  - ouvinte de roda passivo na pílula (WHEEL_PIXELS_TO_DELTA) e ouvinte único de roda no bloco #permission inteiro
affects: [05-04, 05-05, 05-06, 05-07]

plan_head_before: 1eca94842e546b2461c09ef4d638505625b2c583
plan_head_after: e28ddaee938e6cb7674994a3c4e2718f2630dcb8
story_points_realized: 5

actuals:
  tokens: 9000
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "o renderer manda só o número bruto da roda; o main valida (finito e até 1200), acumula com wheelStep e traduz em nextSelection({ type: 'scroll', step }) seguido de refresh"
    - "a roda sobre o bloco do pedido é do texto: o #permission segura o evento e a pílula confere closest('#permission') como segunda trava"

key-files:
  created: []
  modified: [state.js, main.js, preload.js, index.html, gate.test.js, README.md, spike/tauri/src-tauri/src/shim.js]

key-decisions:
  - "wheelStep devolve sempre uma cópia do gesto e nunca lança; gesto inválido conta como o inicial, e delta ou now não finitos, e delta 0, não mexem no gesto"
  - "O teto de 1200 (WHEEL_DELTA_MAX) é escolha do projeto, separada das constantes portadas do mod"
  - "O ouvinte de roda do texto do pedido passou para o bloco #permission inteiro, mantendo corpo e { passive: false }"

requirements-completed: [SESS-02]

coverage:
  - id: D1
    description: "A roda sobre a pílula, fora do bloco do pedido, troca para a sessão anterior ou a próxima na ordem dos pontos, sem dar a volta no fim"
    requirement: SESS-02
    verification:
      - kind: unit
        ref: "gate.test.js#nextSelection scroll anda um vizinho na lista, sem dar a volta; wheelStep: um entalhe anda uma sessão"
        status: pass
    human_judgment: true
    rationale: "Um entalhe real do mouse e o wheelDeltaY do Chromium só se confirmam na tela"
  - id: D2
    description: "Acumulador do mod: 120 por entalhe, gesto novo após 220 ms ou na inversão, 85 ms entre passos com roda e 200 ms com touchpad, um entalhe pendente"
    requirement: SESS-02
    verification:
      - kind: unit
        ref: "gate.test.js#wheelStep: o touchpad soma deltas menores...; ...recomeçam o gesto; ...o intervalo entre passos é 85 ms...; wheelStep nunca lança nem muta"
        status: pass
    human_judgment: true
    rationale: "A sensação do touchpad com inércia só se avalia com o aparelho"
  - id: D3
    description: "island:wheel só aceita um número finito de até 1200 em módulo, ignora a ilha ociosa e termina em refresh('wheel')"
    verification:
      - kind: unit
        ref: "gate.test.js#o canal island:wheel só leva um número finito e limitado, acumula no main e passa por refresh; o preload usa só send e on, nos onze canais conhecidos"
        status: pass
    human_judgment: false
  - id: D4
    description: "Sobre ferramenta, texto ou dica do pedido a roda só rola o texto e nunca troca de sessão"
    verification:
      - kind: unit
        ref: "gate.test.js#a roda sobre o bloco do pedido não vaza e não rola na janela depois da troca; só o bloco do pedido e a pílula ouvem a roda..."
        status: pass
    human_judgment: true
    rationale: "A trava prova o ouvinte e a ausência de outro; rolar até o fim do texto com a roda real só se vê na tela"
  - id: D5
    description: "O README e o comentário da pílula dizem que a roda depende da captura pelo hover e, no Windows, de Rolar janelas inativas"
    verification:
      - kind: unit
        ref: "gate.test.js#o README explica que a roda chega pela rolagem de janelas inativas do Windows"
        status: pass
    human_judgment: true
    rationale: "A entrega da roda pelo sistema à janela não focável só se confirma com o Windows"

duration: 25min
completed: 2026-11-21
status: complete
---

# Phase 5 Plan 03: Roda do mouse troca a sessão Summary

**A roda sobre a pílula troca a sessão exibida com o acumulador de gesto do mod do Windhawk (120 por entalhe, pausa de 220 ms, 85/200 ms entre passos, um entalhe pendente, sem dar a volta), por um canal `island:wheel` que só leva um número finito e limitado; sobre o bloco do pedido a roda só rola o texto.**

## Performance

- **Duration:** 25 min
- **Tasks:** 2
- **Files modified:** 7
- **Commits:** 4 de código (RED e GREEN de cada task), medido de `1eca948` até `e28ddae`

## Accomplishments

- `state.js`: `wheelStep` (pura, devolve `{ gesture, step }`, nunca lança nem muta), as quatro constantes do mod com o aviso MIT, `WHEEL_DELTA_MAX` à parte como escolha do projeto, e o `case 'scroll'` de `nextSelection` (só `step` exatamente -1 ou 1, sem dar a volta, chave fora da lista mantém).
- `main.js`: `wheelGesture` e o handler `island:wheel` (`islandOf`, `Number.isFinite`, teto de 1200, ilha ociosa ignorada, `performance.now()`), que só chama `refresh('wheel')` quando há passo. Um refresh (leitura do disco) por passo, no máximo a cada 85 ms.
- `preload.js` e o shim da casca Tauri: `wheel`.
- `index.html`: ouvinte passivo de `wheel` na pílula (`WHEEL_PIXELS_TO_DELTA = 1.2`, `wheelDeltaY` com reserva em `deltaY`), que sai se o alvo está em `#permission`; o ouvinte de roda do texto passou para `permissionBox`, então ferramenta, texto e dica seguram a roda. Sobram exatamente dois ouvintes de roda.
- `README.md`: item da roda na seção "Várias sessões" e a linha de "Rolar janelas inativas ao passar o mouse sobre elas".

## Commits

| Hash | Tipo | Assunto |
|------|------|---------|
| `352aa7b` | RED | test(sessoes): cobre o acumulador da roda e o passo na lista |
| `a0264cc` | GREEN | feat(sessoes): troca de sessão pela roda sobre a pílula |
| `3c21d85` | RED | test(sessoes): cobre a roda sobre o pedido e a nota da roda inativa |
| `e28ddae` | GREEN | feat(sessoes): segura a roda no bloco do pedido e documenta a roda na janela inativa |

## Testes

Base: 400. Final: **409**, `fail 0` (`gate.test.js` de 74 para 83 testes: 7 na Task 1 e 2 na Task 2). O script inline do renderer compila em `node:vm`. `node -e` do plano imprime `-1 1 0`. As cinco linhas (mais README) seguem `w/crlf`.

Travas que mudaram de propósito, no mesmo commit do código: `RENDERER_CHANNELS` com `island:wheel` (11 canais), "onze canais conhecidos", "nove canais do renderer" e `handlers.length` 9; o teste do ouvinte de roda do pedido passou de `permissionText` para `permissionBox`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Bloqueio] O shim da casca Tauri precisa do método novo do preload**
- **Found during:** Task 1 (antecipado do plano 02, onde a trava `o shim da casca Tauri expõe os mesmos nomes do preload` falhou)
- **Issue:** `spike/tauri/src-tauri/src/shim.js` espelha o objeto do preload e o plano não o listava em `files_modified`.
- **Fix:** `wheel: noop` e o comentário "Os 11 métodos".
- **Files modified:** `spike/tauri/src-tauri/src/shim.js`
- **Commit:** `a0264cc`

**2. [Rule 1 - Bug no teste] Expectativa errada no teste de pausa**
- **Found during:** Task 1 (primeira rodada do GREEN)
- **Issue:** o teste que escrevi esperava `accumulated: 120` em 220 ms exatos, mas 60 + 60 no mesmo gesto fecha um entalhe e anda (acumulado volta a 0, step -1). O código seguia o mod; a expectativa do teste é que estava errada.
- **Fix:** o teste passou a afirmar `step: -1` nesse caso.
- **Files modified:** `gate.test.js`
- **Commit:** `a0264cc`

Fora isso, o plano foi executado como escrito. A linha de baseline `[HEAD=62 ... @c461158]` do `grep -c "^test("` partia de um HEAD antigo; a meta do plano (81 depois da Task 1, 83 depois da Task 2) bateu exatamente.

Observações sem impacto:

- O ledger do ponto de partida em `.git` não foi usado; o `commits:` foi medido de `1eca948`, o HEAD no início da execução.
- A ponte com o Boards não está em uso neste repositório (sem `.planning/boards/`), então o shim não foi chamado.
- `STATE.md` e `ROADMAP.md` ficam com o orquestrador, como pedido.

## Para a atenção do orquestrador

- O handler da roda lê `lastPickedState.state === 'idle'` e `lastSessionList` do último refresh. Com a ilha em fade ou escondida a roda não chega mesmo (captura desligada), então não há caso extra.
- Cada ilha (monitor) manda a roda para o mesmo `wheelGesture` do main, por haver uma seleção só (D-03). Rolar em dois monitores ao mesmo tempo soma no mesmo gesto, o que é aceitável para um usuário só.
- O plano 04 (snap e `SNAP_WHEEL_LOCK_MS`) vai precisar do instante da última roda: o `performance.now()` do handler fica em `wheelGesture.lastEventAt`, que já está no main.

## Testar manualmente

Fica para o checklist do PR (o plano 07 consolida):

- Com duas ou mais sessões, um entalhe da roda sobre a pílula anda uma sessão: para baixo a seguinte, para cima a anterior, sem dar a volta no começo nem no fim.
- No touchpad a troca é mais lenta e não dispara várias sessões com a inércia.
- Com "Rolar janelas inativas ao passar o mouse sobre elas" desligado a roda não chega à ilha e o clique no ponto continua trocando a sessão.
- Rolar o texto de um pedido, sobre a ferramenta, o texto ou a dica, até o fim nunca troca de sessão.
- A roda chega à ilha com um terminal elevado (Gerenciador de Tarefas) em foco.
- Trocar de sessão pela roda sobre um pedido novo mantém Permitir e Negar desabilitados até rearmar no lugar novo.

## Known Stubs

None.

## Threat Flags

None. O canal `island:wheel`, a rajada de roda, a roda sobre o pedido e a entrada sintética já estão no threat model do plano (T-05-11 a T-05-14). Nenhuma roda, clique ou tecla sintética foi gerada, e o Electron não foi iniciado.

## Self-Check: PASSED

- Arquivos: `state.js`, `main.js`, `preload.js`, `index.html`, `gate.test.js`, `README.md` e o shim existem e estão commitados.
- Commits `352aa7b`, `a0264cc`, `3c21d85` e `e28ddae` estão na branch `feat/fase-5-sessoes`.
- `node --test`: 409 testes, 0 falhas; `grep -c "^test(" gate.test.js` = 83.
