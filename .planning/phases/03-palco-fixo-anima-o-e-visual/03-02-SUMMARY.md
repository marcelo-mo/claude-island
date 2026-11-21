---
phase: 03-palco-fixo-anima-o-e-visual
plan: 02
subsystem: ui
tags: [electron, spring-physics, nudge, hover, shapes, stage, renderer, node-test]

requires:
  - phase: 03-palco-fixo-anima-o-e-visual
    provides: "bloco mola, springs, startSpringLoop, canArm, applyPreferences com data-shape, loadInlineBlock"
provides:
  - "shouldNudge e hoverScaleTarget puras no bloco mola; molas neutras nudge e scale compostas num transform da pílula inteira"
  - "formas pílula, notch e Windows 11 por data-shape, com --stage-top e --radius"
  - "WINDOW_SIZE (520x410, congelado), HORIZONTAL_SLACK (60) e positionFromSavedOffset em state.js"
  - "simulação do palco (4 estilos x 3 velocidades, com retarget) em gate.test.js e visual.test.js novo"
affects: [03-03-temas-material, fase-4-menu-preferencias]

actuals:
  tokens: 9800
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "decisão de movimento como predicado puro no bloco inline (hasPermission === false estrito), com tabela de casos em node:vm"
    - "tamanho do palco provado por simulação com medidas lidas do CSS do próprio index.html"

key-files:
  created:
    - visual.test.js
    - .planning/phases/03-palco-fixo-anima-o-e-visual/03-02-SUMMARY.md
  modified:
    - index.html
    - state.js
    - main.js
    - gate.test.js
    - island.test.js

key-decisions:
  - "HORIZONTAL_SLACK subiu de 20 para 60 de propósito: mantém (largura do palco - 400) / 2, a borda da pílula no mesmo lugar de antes; a semântica de isWithinWorkArea não mudou"
  - "Palco 520x410 bastou: o teste não pediu mais. Pior caso com margem de cerca de 10 px na largura e 18 px na altura (Elástico a 0,5x)"
  - "Tabela de nudge e hover exige hasPermission === false: pedido na tela ou fato ausente nunca anima"
  - "No notch --stage-top vale 0px; o nudge sai pelo topo e é recortado pela borda da janela (aceito)"

patterns-established:
  - "escala e deslocamento só por JS na pílula inteira (style.transform); nenhuma regra CSS de hover ou de botão com transform"

requirements-completed: [ANIM-03, ANIM-04, ANIM-05, VIS-02]

coverage:
  - id: D1
    description: "Nudge de -6 px na troca de estado, no máximo a cada 450 ms, nunca vindo de idle, indo para idle, com pedido na tela ou movimento reduzido"
    requirement: "ANIM-03"
    verification:
      - kind: unit
        ref: "gate.test.js#shouldNudge (tabela) e #a cola liga o nudge e o hover às molas neutras"
        status: pass
    human_judgment: false
  - id: D2
    description: "Ampliação de 2,5% no hover em Trabalhando e Precisa de você, nunca em Concluído, com pedido na tela ou movimento reduzido"
    requirement: "ANIM-05"
    verification:
      - kind: unit
        ref: "gate.test.js#hoverScaleTarget (tabela) e #botões e hover sem transform, scale, translate, rotate ou zoom"
        status: pass
    human_judgment: false
  - id: D3
    description: "Formas pílula, notch e Windows 11 aplicadas por valor de preferência, raio da pílula limitado a 44 px"
    requirement: "VIS-02"
    verification:
      - kind: unit
        ref: "visual.test.js (6 testes)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Palco fixo cobre o pico das molas com hover, nudge e sombra; WINDOW_SIZE congelado e único tamanho em setBounds"
    requirement: "ANIM-04"
    verification:
      - kind: unit
        ref: "gate.test.js#o palco cobre o pico das molas e #a folga horizontal é o que sobra"
        status: pass
    human_judgment: false
  - id: D5
    description: "Posição salva preservada ao trocar o palco; borda de baixo sobe o necessário e a janela fica na área útil"
    verification:
      - kind: unit
        ref: "island.test.js#positionFromSavedOffset (5 testes)"
        status: pass
    human_judgment: false
  - id: D6
    description: "A aparência do nudge, da ampliação e das formas é a do mod, e em 125% e 150% de escala o palco e o pico do Elástico a 2x não são recortados"
    verification: []
    human_judgment: true
    rationale: "Só se avalia olhando a ilha em monitores reais; o executor não sobe o Electron. Vai no checklist do PR (item bloqueante)."

duration: 35min
completed: 2026-11-21
story_points_realized: 5
status: complete
plan_head_before: 9e96cd9c4330da29fe4268b74341429da86e66ec
plan_head_after: 9c51ae8d7f86eda2b1506b758ac03ff6d8e47125
commits: 6
---

# Phase 3 Plan 02: Palco fixo, nudge, hover e formas Summary

**Pílula que dá um nudge de -6 px na troca de estado e amplia 2,5% no hover por molas neutras (nunca com pedido na tela), ganha as formas pílula, notch e Windows 11, e vive num palco fixo de 520x410 provado por simulação das molas.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-11-21
- **Tasks:** 3
- **Files modified:** 6 (`index.html`, `state.js`, `main.js`, `gate.test.js`, `island.test.js` e o novo `visual.test.js`)
- **Suíte:** 226 testes na base, 245 ao final, 0 falhas

## Accomplishments

- **Nudge e hover:** `shouldNudge` e `hoverScaleTarget` são puras e vivem no bloco `mola` (valores do mod, com origem MIT). Só valem com `hasPermission === false` e movimento reduzido desligado; o hover também não vale em Concluído, para o Abrir compacto ficar parado sob o mouse. As duas molas são neutras (k=280, c=24), existem desde a declaração de `springs`, entram no `canArm` pelo `allSpringsAtRest` e se compõem num único `pill.style.transform` (`translateY` e `scale`), com `transform-origin: 50% 0`. Nenhuma regra CSS de hover ou de botão ganhou transform.
- **Formas:** `:root[data-shape="win11"] #pill` (8px), `:root[data-shape="notch"] #pill` (0 0 16px 16px) e `--stage-top` (8px no `:root`, 0px no notch, usado como `padding-top` do `body`). A pílula usa `--radius` = metade da altura-alvo, no máximo 44px; a expandida perdeu o raio fixo de 30px. O `applyPreferences` do 03-01 não mudou: já grava `data-shape` e rearma a troca de forma com pedido na tela.
- **Palco fixo:** `WINDOW_SIZE` (520x410, congelado) e `HORIZONTAL_SLACK` (60) saíram do `main.js` para o `state.js`. O teste simula a menor pílula (120x36) até a maior (largura e altura derivadas do CSS: pior pedido de cerca de 299,7px) em 4 estilos x 3 velocidades, com retarget a cada quadro de 16 ms do encolhimento, somando hover, rebote do nudge e 20px de sombra. O pior caso (Elástico a 0,5x) precisa de 509,8 x 391,8: 520x410 passa, e uma mutação para 510x380 faz o teste falhar com a mensagem do pico.
- **Posição salva:** `positionFromSavedOffset(workArea, windowSize, offset)` concentra a conta que estava em `savedPosition`; o main só delega. Centro horizontal e topo da pílula são preservados; testes cobrem padrão, deslocamento, bordas esquerda e direita (a pílula encosta) e a borda de baixo.

## Task Commits

1. **Task 1: nudge e hover**
   - `b191ab4` test: cobre o nudge e a ampliação no hover
   - `1171aa1` feat: dá o nudge na troca de estado e amplia a pílula no hover
2. **Task 2: formas**
   - `de4da5a` test: trava as formas da pílula
   - `9f8351e` feat: aplica as formas pílula, notch e Windows 11 por preferência
3. **Task 3: palco fixo**
   - `04a7feb` test: dimensiona o palco pela simulação das molas
   - `9c51ae8` feat: fixa o palco em 520x410 para caber o pico das molas

## Decisions Made

- **`HORIZONTAL_SLACK` 20 para 60 é valor deliberado**, não mudança de semântica: preserva a invariante `(largura do palco - 400) / 2`, a borda da pílula expandida encostando na borda do monitor. `isWithinWorkArea` não mudou.
- A simulação aplica a escala do hover e o rebote do nudge também à altura do pior pedido, embora na prática não haja hover nem nudge com pedido na tela: é conservador de propósito e ainda cabe em 410px.
- Cada constante portada do mod (nudge, escala, raios, `PILL_MAX_RADIUS_PX`) tem comentário de origem MIT apontando para `THIRD_PARTY_NOTICES.md`.

## Deviations from Plan

### Auto-fixed Issues

Nenhuma alteração de comportamento além do previsto. Notas de processo:

**1. [Processo] Ledger de commits do plano não gravado em disco**
- O comando composto que gravaria `gsd-plan-head-before-03-02` foi recusado pelo guarda do worktree (como no 03-01). `plan_head_before` e `commits` foram medidos com o HEAD anotado antes do primeiro commit (`9e96cd9`) e `git rev-list --count 9e96cd9..HEAD` (= 6).

**2. [Processo] Fim de linha do `state.js`**
- Uma troca com `sed -i` (mutação temporária do `WINDOW_SIZE` para provar que o teste falha) converteu o `state.js` para LF; o CRLF foi restaurado antes do commit (`git ls-files --eol` mostra `w/crlf`).

---

**Total deviations:** 2 (ambas de processo)
**Impact on plan:** nenhum. O palco não precisou crescer além de 520x410.

## Issues Encountered

None. Os commits de teste (RED) falham de propósito; os de feature deixaram a suíte inteira verde (232, 238 e 245 testes).

## Known Stubs

Nenhum.

## Threat Flags

Nenhum. T-03-07 a T-03-09 mitigados pelas tabelas, travas e simulação acima; T-03-10 (janela de 410px em monitor baixo) aceito, com teste de que a posição padrão de um monitor 1920x1040 continua dentro.

## Itens de backstop (checklist do PR, o executor não rodou)

- **BLOQUEANTE** (os monitores do autor misturam 100% e 125%): em 125% e 150% de escala, o palco de 520x410 e a pílula no pico do Elástico a 2x não são recortados e não há linha de 1px na borda do palco. O PR não segue para merge sem este item.
- Com `preferences.json` em cada `shape` (pill, notch, win11): raio e topo como o mod, compacta, expandida e com pedido; notch colado no topo da tela.
- Ver o nudge em running para done; ver a ampliação em Trabalhando; em Concluído o hover não amplia e o Abrir fica parado; com pedido na tela não há nudge nem ampliação e os botões não se mexem.
- Em Trabalhando, o botão Abrir sessão da pílula expandida escala junto com ela no hover (2,5%; aparece junto com a expansão e não é botão de permissão): aceito e registrado.
- Quem tinha posição salva vê a pílula no mesmo lugar depois de atualizar; ilha arrastada para os últimos ~86px de baixo do monitor sobe até caber (o gate exige a janela inteira na área útil).
- Registro de plataforma (anotado, não corrigido): no Linux `CAN_CLICK_THROUGH` é falso, então a área transparente de 520x410 que captura cliques é maior que a de 440x324.
- Notch: o nudge de -6px sai pelo topo do palco e é recortado pela borda da janela (lê como a pílula recolhendo na borda); aceito.

## Next Phase Readiness

O 03-03 (temas e material) usa o mesmo `index.html` e `visual.test.js`: o helper `declarations`, a lista `rules` e a leitura do `<style>` sem comentários já estão no arquivo. O `--stage-top` e o `--radius` ficam fora dos temas.

## Self-Check: PASSED

Arquivos conferidos (`visual.test.js`, `index.html`, `state.js`, `main.js`, `gate.test.js`, `island.test.js`) e os seis commits (`b191ab4`, `1171aa1`, `de4da5a`, `9f8351e`, `04a7feb`, `9c51ae8`) presentes no histórico da branch `feat/fase-3-visual`; `node --test` com 245 testes, 0 falhas.
