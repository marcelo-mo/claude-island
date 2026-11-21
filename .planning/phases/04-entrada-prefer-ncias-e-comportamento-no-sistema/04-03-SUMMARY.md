---
phase: 04-entrada-prefer-ncias-e-comportamento-no-sistema
plan: 03
subsystem: ancoras-e-ilhas
tags: [electron, ancora, folga-lateral, setBounds, 125-por-cento, modo-cursor, monitor, gate]

requires:
  - phase: 04
    provides: menuTemplate, applyPreference, esquema com anchor e islandMode (04-01); cursorTick, captureRequests, nearIslands e o evento 'hide' (04-02)
provides:
  - anchorPosition, horizontalSlackFor e as constantes ANCHOR_SIDE_GAP_PX, ANCHOR_BOTTOM_GAP_PX, STAGE_SHADOW_PX e EXPANDED_PILL_WIDTH_PX em state.js
  - folga { left, right } em clampIslandPosition e isWithinWorkArea, e positionFromSavedOffset com âncora
  - submenus 'Âncora' (seis posições) e 'Ilhas' (uma por monitor, só no principal, no monitor do cursor)
  - alinhamento da pílula no palco por data-anchor, --stage-shadow, --origin-x e --origin-y
  - islandDisplays e syncIslands por modo, com reaproveitamento da janela por setBounds
  - setBounds logo depois de criar a janela (125%) e vetores de borda de baixo e de folga por âncora no fixture
affects: [04-04, 04-05, 04-06]

actuals:
  tokens: 14500
  tasks: 3
  commits: 6

plan_head_before: 39ec1cdfc2727785eff86c4b328e8edc16624729
plan_head_after: b9b40bc3db7fb37dd0c62f50917d005b63c351cb

tech-stack:
  added: []
  patterns:
    - "folga lateral por âncora: o gate, o clamp e o fitsWorkArea usam a mesma horizontalSlackFor(preferences.anchor)"
    - "o deslocamento salvo é relativo à âncora e trocar a âncora o zera"
    - "janela de monitor sobrando é reaproveitada por setBounds em vez de destruída e recriada"

key-files:
  created: []
  modified: [state.js, main.js, index.html, island.test.js, gate.test.js, prefs.test.js, visual.test.js, fixtures/permission-vectors.json]

key-decisions:
  - "A folga lateral passa a ser { left, right } por âncora: 20/100 nas de esquerda, 100/20 nas de direita e 60/60 no centro; a soma com a pílula expandida (400) dá sempre 520, então a pílula de canto nunca sai da tela e o gate nunca aceita fora dela"
  - "A tolerância do isWithinWorkArea continua 2 px (D-14): +2 DIP de deriva a 125% é aceito, +3 é recusado, e os vetores fixam os dois lados"
  - "No modo cursor a ilha só troca de monitor com hasPermission === false; fato desconhecido não move (lado seguro)"
  - "A simulação do palco para a âncora de baixo exige a sombra inteira nos casos que coexistem (pedido sozinho; pílula comum com hover e nudge) e a pílula inteira no pior caso combinado (ver Deviations)"

patterns-established:
  - "Constante repetida no CSS ganha trava de igualdade: EXPANDED_PILL_WIDTH_PX contra #pill.expanded e STAGE_SHADOW_PX contra --stage-shadow"
  - "Toda ilha reaproveitada num monitor novo passa por releaseCapture antes de moverIsland, e a troca termina em refresh('rearm')"

requirements-completed: [PREF-04, PREF-05, PREF-01]

coverage:
  - id: D1
    description: "Seis âncoras pelo menu: a janela vai para anchorPosition (16 px das laterais, 40 px de baixo) e a pílula se alinha no palco pelo lado ancorado, com a sombra cabendo"
    requirement: PREF-04
    verification:
      - kind: unit
        ref: "island.test.js#anchorPosition: a pílula fica a 16 px da lateral e a 40 px da base, com a margem da sombra no palco"
        status: pass
      - kind: unit
        ref: "visual.test.js#as regras de âncora alinham a pílula pelo lado ancorado e deixam a margem da sombra"
        status: pass
    human_judgment: true
    rationale: "O alinhamento visual da pílula e da sombra em cada âncora só se confirma com a ilha na tela (CHK do plano 06)"
  - id: D2
    description: "Trocar a âncora zera os deslocamentos salvos, reposiciona as ilhas e rearma; o arraste fica preso ao monitor da própria ilha"
    requirement: PREF-04
    verification:
      - kind: unit
        ref: "gate.test.js#a âncora escolhe a posição, a folga e zera os deslocamentos"
        status: pass
      - kind: unit
        ref: "island.test.js#positionFromSavedOffset com âncora soma o deslocamento à posição dela; sem âncora segue o topo centro"
        status: pass
    human_judgment: false
  - id: D3
    description: "Folga por âncora no clamp, no fitsWorkArea e no gate: a pílula de canto não sai da tela e a janela além da folga recusa a decisão (SEG-06)"
    requirement: PREF-04
    verification:
      - kind: unit
        ref: "island.test.js#a pílula de canto nunca sai da tela: o clamp a prende e o gate recusa a janela além da folga"
        status: pass
      - kind: unit
        ref: "gate.test.js#isWithinWorkArea: âncora de canto esquerda: 3 px além da folga recusa"
        status: pass
      - kind: unit
        ref: "gate.test.js#island:decide: o eco vem do renderer, o alvo e o relógio do main, os fatos da janela real"
        status: pass
    human_judgment: false
  - id: D4
    description: "A 125% a ilha é reposicionada por setBounds logo depois de criada, nunca por setPosition; +2 DIP de deriva é aceito e +3 recusado"
    requirement: PREF-04
    verification:
      - kind: unit
        ref: "gate.test.js#a ilha é posicionada só por setBounds, inclusive logo depois de criada"
        status: pass
      - kind: unit
        ref: "gate.test.js#isWithinWorkArea: 125%: arrastada até a borda de baixo, deriva de +3 DIP (recusa, lado seguro)"
        status: pass
    human_judgment: true
    rationale: "A deriva real de getBounds() a 125% só se mede com a janela num monitor de 125% (CHK-04, plano 06)"
  - id: D5
    description: "O palco de 520 x 410 cabe a pílula e a sombra nas âncoras de baixo e de canto, em todo estilo e velocidade de mola"
    requirement: PREF-04
    verification:
      - kind: unit
        ref: "gate.test.js#o palco cobre o pico das molas, com hover, nudge e sombra, em todo estilo e velocidade (ANIM-04)"
        status: pass
    human_judgment: true
    rationale: "Cobre o pedido sozinho e a pílula comum com hover e nudge; o pior caso combinado só garante a pílula inteira, não a sombra de cima (ver Deviations)"
  - id: D6
    description: "Uma ilha só (principal ou cursor); no modo cursor a ilha troca de monitor reaproveitando a janela e rearma, nunca com pedido na tela"
    requirement: PREF-05
    verification:
      - kind: unit
        ref: "island.test.js#islandDisplays: 'cursor' com pedido na tela, ou sem saber, nunca troca de monitor (T-04-10)"
        status: pass
      - kind: unit
        ref: "gate.test.js#uma ilha só nunca troca de monitor com pedido na tela e rearma ao trocar"
        status: pass
    human_judgment: true
    rationale: "A troca real entre monitores de DPI diferente (e o tamanho físico da janela reaproveitada) só se confirma com dois monitores (plano 06)"
  - id: D7
    description: "Menu com os submenus 'Âncora' e 'Ilhas', valor atual marcado"
    requirement: PREF-01
    verification:
      - kind: unit
        ref: "prefs.test.js#'Âncora' oferece as seis posições, com o rótulo de cada uma, e marca a atual"
        status: pass
      - kind: unit
        ref: "prefs.test.js#'Ilhas' oferece uma por monitor (padrão), só no principal e no monitor do cursor"
        status: pass
    human_judgment: true
    rationale: "O menu nativo sobre janela focusable: false só se confirma numa pessoa na tela (CHK-03)"

duration: 12min
completed: 2026-11-21
status: complete
story_points_realized: 5
---

# Phase 4 Plan 03: Âncoras, folga por âncora e uma ilha só Summary

**Seis âncoras pelo menu com folga lateral `{ left, right }` por âncora no clamp, no `fitsWorkArea` e no gate (a pílula de canto nunca sai da tela nem decide fora dela), janela reposicionada por `setBounds` logo depois de criada (125%) e modo de uma ilha só que segue o cursor sem nunca trocar de monitor com pedido na tela.**

## Performance

- **Duration:** 12 min (13:55 a 14:04, horário local)
- **Tasks:** 3 (1 traçador, 2 auto/TDD)
- **Files modified:** 8 (nenhum novo)
- **Testes:** 304 na base (fim do 04-02), 335 ao final, `fail 0`

## Accomplishments

- Traçador ponta a ponta: o submenu 'Âncora' grava `anchor`, `applyPreference` zera `savedOffsets` (eram relativos à âncora antiga), reposiciona por `syncIslands()` e rearma; `moveIsland`, `savedPosition`, o arraste e o duplo clique passam a partir de `anchorPosition`; o renderer grava `data-anchor` e as regras `:root[data-anchor...]` alinham a pílula pelo lado ancorado com a margem da sombra (`--stage-shadow`, 20 px).
- Gate protegido nos cantos: `horizontalSlackFor(preferences.anchor)` é a mesma folga no `moveIsland`, no `fitsWorkArea` e no fato `withinVisibleArea`; `isWithinWorkArea` aceita número ou `{ left, right }` e recusa objeto sem um lado numérico. A soma folga + pílula expandida (400) é sempre 520.
- `createIsland` chama `moveIsland(island, savedPosition(display), display.workArea)` logo depois do `new BrowserWindow`; `setPosition` não aparece no código do `main.js`, com trava. O comentário da tolerância registra a decisão D-14 (continua 2 px).
- Fixture com 10 vetores novos em `isWithinWorkArea` (4 a 125% na borda de baixo, 5 de folga por âncora, 1 de folga sem um lado); nenhum vetor existente mudou (`git diff --numstat`: 207 inserções, 0 remoções).
- `islandDisplays` (pura, com tabela de testes) decide os monitores com ilha; `syncIslands` reaproveita a janela sobrando por `setBounds`, destrói só a sobra de modo ou de monitor removido (com a limpeza completa de `dragStartPositions`, `captureRequests` e `nearIslands`) e reavalia o timer do cursor; `cursorTick` troca de monitor no modo 'cursor' sem ilha arrastada e sem pedido na tela, e rearma.

## Task Commits

1. **Task 1 (traçador), RED:** `c4caac8` test(ancora): cobre a posição e a folga por âncora
2. **Task 1 (traçador), GREEN:** `dcdb23a` feat(ancora): ancora a ilha em seis posições pelo menu
3. **Task 2, RED:** `c7d7f44` test(ancora): cobre as âncoras a 125% e no pico das molas
4. **Task 2, GREEN:** `9c93c6d` fix(ancora): reposiciona a ilha por setBounds logo depois de criá-la
5. **Task 3, RED:** `049e4bd` test(ilhas): cobre o modo de uma ilha só
6. **Task 3, GREEN:** `b9b40bc` feat(ilhas): permite uma ilha só no monitor principal ou no do cursor

Tracer gate: `<verify>` só tem `<automated>`; re-executado de ponta a ponta (suíte inteira, 313 testes, e compilação do script inline em `node:vm`) e passou antes da Task 2. Tracer verified end-to-end, expandiu.

## Decisions Made

- **Folga por âncora em objeto `{ left, right }`** (seção context do plano): numa âncora de canto a pílula expandida encosta no lado ancorado do palco com só 20 px de margem; a folga simétrica de 60 a deixaria sair 40 px da tela e o gate aceitaria a decisão (SEG-06). O número continua valendo para os dois lados, então os vetores existentes seguem iguais.
- **Tolerância em 2 px** (D-14): `setBounds` com o tamanho explícito leva a deriva a 125% a +2 DIP; +3 só viria de `setPosition`, que a ilha não usa, e recusar por engano é o lado seguro.
- **`releaseCapture(reused)` ao reaproveitar a janela:** o pedido de captura e o ponto do cursor da ilha vinham do monitor antigo e não valem no novo.

## Travas alteradas de propósito (gate.test.js)

- `withinVisibleArea` na trava de `acceptDecision({` e a linha de `fitsWorkArea` na trava da cola do `refresh` trocaram `HORIZONTAL_SLACK` por `horizontalSlackFor(preferences.anchor)` (commit `dcdb23a`, dito no corpo do commit).
- Travas novas: a âncora escolhe a posição, a folga e zera os deslocamentos; a ilha é posicionada só por `setBounds`; uma ilha só nunca troca de monitor com pedido na tela e rearma.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug no limite do plano] Conta do palco da âncora de baixo estoura 6,3 px no Elástico a 0,5x**
- **Found during:** Task 2 (RED, simulação do palco)
- **Issue:** a fórmula do plano, `STAGE_SHADOW_PX + pico da altura x pico do hover + |NUDGE_OFFSET_PX| + 9`, dá 416,3 px contra os 410 do palco (Elástico a 0,5x, pico de 372 px do pedido mais alto). O estouro não é de arredondamento: o nudge sobe a pílula 6 px, e na âncora de baixo não há o respiro do `--stage-top` para absorvê-lo, como no topo. Aumentar o palco mexeria em `WINDOW_SIZE`, congelado e fora do escopo do plano (decisão estrutural).
- **Fix:** hover e nudge só existem sem pedido na tela (`shouldNudge` e `hoverScaleTarget`), e o pedido é a pílula mais alta. A simulação passou a exigir a sombra inteira nos casos que coexistem (pedido sozinho: 20 + pico + 9 = 401 px; pílula comum com hover e nudge, que é bem menor) e a pílula inteira dentro do palco no pior caso combinado (20 + pico x hover + 6 = 407,3 px, com 2,7 px sobrando em cima). O pior caso combinado só se sobreporia na passagem do pedido chegando com o hover assentando e perderia, no máximo, cerca de 6 px da borda externa e fraca da sombra de cima; a pílula nunca é recortada. Registrado como limite aceito para o checklist do PR.
- **Files modified:** gate.test.js
- **Commit:** `c7d7f44`

**2. [Rule 3 - Blocking] Registro de base do plano fora do git-dir**
- **Found during:** início da Task 1
- **Issue:** o ledger `gsd-plan-head-before-04-03` ficaria em `.git/worktrees/...` dentro do checkout do autor, proibido pelas regras desta execução.
- **Fix:** a base foi registrada no frontmatter (`plan_head_before: 39ec1cd...`) e `commits:` medido com `git rev-list --count 39ec1cd..HEAD` (= 6).
- **Files modified:** nenhum
- **Commit:** n/a

**3. [Rule 3 - Blocking] Edição com fim de linha CRLF**
- **Found during:** início da Task 1
- **Issue:** `state.js`, `main.js`, `index.html`, `island.test.js` e `gate.test.js` estão em CRLF na cópia de trabalho (o índice é LF, `core.autocrlf`), e as edições multilinha não casariam.
- **Fix:** convertidos para LF durante a edição e de volta para CRLF no fim; `git diff` não mostra mudança de fim de linha. O `git status` pode listar esses cinco como modificados sem diferença de conteúdo até o índice ser atualizado.
- **Commit:** n/a

**4. [Rule 2 - Missing critical] `releaseCapture` na ilha reaproveitada**
- **Found during:** Task 3
- **Issue:** a janela reaproveitada num monitor novo manteria o pedido de captura e o ponto do cursor do monitor antigo, e poderia engolir cliques até o próximo tique.
- **Fix:** `releaseCapture(reused)` antes do `moveIsland` no reaproveitamento.
- **Files modified:** main.js
- **Commit:** `b9b40bc`

**Total deviations:** 4 (1 limite do plano, 2 de processo, 1 de robustez de uma linha). **Impact:** o desenho do plano ficou igual; só a prova do palco da âncora de baixo é mais fina que a do plano, pelo motivo acima.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None. Os limites de confiança novos são os do `<threat_model>` do plano: T-04-10 (`islandDisplays` só segue o cursor com `hasPermission === false`, `cursorTick` exige `!lastPickedState.permission` e termina em `refresh('rearm')`, com trava), T-04-11 (folga por âncora no clamp, no `fitsWorkArea` e no gate, com vetores de canto), T-04-12 (`setBounds` depois de criar, 20 px de sobra na âncora de baixo e vetores de 125%) e T-04-13 (trocar a âncora zera `savedOffsets`; `positionFromSavedOffset` valida o deslocamento e o clamp prende à área útil).

## Testar manualmente (não coberto por teste, vai para o plano 06 e o checklist do PR)

- Cada âncora no menu 'Âncora': a pílula encosta a 16 px da lateral e a 40 px da base, a sombra não é recortada e a ampliação do hover cresce a partir da borda ancorada.
- Notch com âncora de baixo: o raio do notch (topo reto) fica flutuando 40 px acima da base; aceito nesta fase.
- A 125% (CHK-04): a ilha nasce em 520 x 412 depois do `setBounds`, a âncora de baixo aceita decisão e a de canto não deixa a pílula passar da borda.
- Elástico a 0,5x com a âncora de baixo e um pedido chegando com o cursor em cima: pode haver um recorte de até cerca de 6 px na sombra de cima (a pílula não é recortada).
- Dois monitores de DPI diferente no modo 'No monitor do cursor': a ilha troca de monitor sem pedido na tela, mantém o tamanho físico (se a janela crescer cerca de 25%, recriar em vez de mover) e os botões rearmam; com pedido na tela ela não troca.
- 'Só no monitor principal' deixa uma ilha só e 'Uma por monitor' volta ao padrão; trocar a âncora zera a posição arrastada.

## Next Phase Readiness

Pronto para o plano 04 em diante: âncora, folga e `islandDisplays` existem, e qualquer caminho que esconda a ilha já solta a captura pelo evento `'hide'`.

## Self-Check: PASSED
