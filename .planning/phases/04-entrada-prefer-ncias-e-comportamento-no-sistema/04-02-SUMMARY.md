---
phase: 04-entrada-prefer-ncias-e-comportamento-no-sistema
plan: 02
subsystem: hover-e-captura
tags: [electron, hover, setIgnoreMouseEvents, cursor, histerese, ipc, expandir, fixar-aberta]

requires:
  - phase: 04
    provides: menuTemplate, applyPreference, menuIsland e o esquema com expandOn e pinExpanded (plano 04-01)
provides:
  - hover pela posição de tela do cursor (island:cursor, main para renderer) e captura por booleano (island:capture, renderer para main)
  - applyCapture, releaseCapture, cursorTick e updateCursorTick no main, com o ouvinte de 'hide'
  - bloco puro hover:inicio/fim no index.html com hoverStep e shouldExpand
  - expandir no hover ou no clique e fixar aberta, com o submenu 'Expandir' e a caixa 'Fixar aberta'
  - trava de nomes entre o shim do spike Tauri e o preload
affects: [04-03, 04-04, 04-05, 04-06]

actuals:
  tokens: 9700
  tasks: 2
  commits: 4

plan_head_before: fd794890e89d2f7a91a0815803fe556898f24ab8
plan_head_after: 7bdaa9d60c44dcb4432dd01c5dec7fcc1d50ba84

tech-stack:
  added: []
  patterns:
    - "main entrega o ponto do cursor e o renderer decide pelo retângulo vivo; o main só aplica a captura"
    - "captura do mouse sem a opção forward: pedido do renderer (booleano) combinado com arraste e menu no main"
    - "trava de nomes por execução do texto em node:vm (preload e shim com electron e window de mentira)"

key-files:
  created: [hover.test.js]
  modified: [main.js, preload.js, index.html, state.js, gate.test.js, prefs.test.js, spike/tauri/src-tauri/src/shim.js]

key-decisions:
  - "hoverStep e shouldExpand ficam inline no index.html, entre // hover:inicio e // hover:fim, e não no state.js (exceção à regra de lógica pura em state.js, ver Decisions Made)"
  - "island:hover sai; entram island:cursor (main para renderer) e island:capture (renderer para main, só booleano)"
  - "a ilha escondida solta a captura pelo evento 'hide', então os planos 04 e 05 não precisam chamar updateCursorTick"

patterns-established:
  - "Todo caminho que esconde ou ociosa a ilha passa por releaseCapture; a janela transparente nunca fica engolindo cliques"
  - "Novo item de menu entra com o efeito dele: VALUES_BY_KEY de prefs.test.js ganhou expandOn"

requirements-completed: [HOV-01, HOV-02, HOV-03, HOV-04, PREF-01]

coverage:
  - id: D1
    description: "Cursor por posição de tela a cerca de 30 Hz, só com ilha visível e fora de ociosa; hover decidido por hoverStep com histerese de 2 e 8 px contra o retângulo vivo"
    requirement: HOV-01
    verification:
      - kind: unit
        ref: "hover.test.js#hoverStep: histerese contra o retângulo vivo da pílula"
        status: pass
      - kind: unit
        ref: "gate.test.js#a captura vem só de um booleano, sem a opção forward, e o arraste e o menu a seguram"
        status: pass
    human_judgment: true
    rationale: "O timer e o ponto em coordenadas reais de tela só se confirmam com Electron na tela (proibido iniciar a ilha nesta execução); vai para o CHK-04 (125%)"
  - id: D2
    description: "Captura sem a opção forward: fora da pílula cliques atravessam, dentro a ilha os recebe; arraste e menu seguram"
    requirement: HOV-02
    verification:
      - kind: unit
        ref: "gate.test.js#a captura vem só de um booleano, sem a opção forward, e o arraste e o menu a seguram"
        status: pass
    human_judgment: true
    rationale: "A prova com terminal elevado em foco (UIPI) é humana (CHK-01, plano 06)"
  - id: D3
    description: "Expandir no hover (padrão) ou no clique; fixar aberta; Concluído nunca expande"
    requirement: HOV-03
    verification:
      - kind: unit
        ref: "hover.test.js#shouldExpand: Trabalhando segue a preferência"
        status: pass
      - kind: unit
        ref: "hover.test.js#shouldExpand: Concluído e ociosa nunca expandem, nem fixadas"
        status: pass
      - kind: unit
        ref: "hover.test.js#a cola da expansão: uma chamada só em renderContent, o clique expande e sair do hover desfaz o clique"
        status: pass
    human_judgment: false
  - id: D4
    description: "Hover, captura e expansão nunca armam, desarmam nem disparam decisão; arraste, duplo clique e botões seguem"
    requirement: HOV-04
    verification:
      - kind: unit
        ref: "hover.test.js#updateHover não arma, não desarma nem decide: só hover e captura (D-04)"
        status: pass
      - kind: unit
        ref: "hover.test.js#o fim do arraste reavalia o hover pelo último ponto e o armamento dos botões segue"
        status: pass
    human_judgment: false
  - id: D5
    description: "Menu com o submenu 'Expandir' e a caixa 'Fixar aberta', valor atual marcado"
    requirement: PREF-01
    verification:
      - kind: unit
        ref: "prefs.test.js#'Expandir' oferece hover e clique, e 'Fixar aberta' grava o oposto do valor atual"
        status: pass
    human_judgment: true
    rationale: "O menu nativo sobre janela focusable: false só se confirma numa pessoa na tela (CHK-03)"

duration: 30min
completed: 2026-11-21
status: complete
story_points_realized: 5
---

# Phase 4 Plan 02: Hover pelo cursor, captura e expandir Summary

**Hover decidido pelo cursor de tela que o main entrega a cerca de 30 Hz (hoverStep com histerese de 2 e 8 px contra o retângulo vivo da pílula), captura do mouse por `setIgnoreMouseEvents(!captura)` sem a opção forward, e expandir no hover ou no clique com "Fixar aberta" no menu.**

## Performance

- **Duration:** 30 min
- **Tasks:** 2 (1 traçador, 1 auto/TDD)
- **Files modified:** 8 (1 novo)
- **Testes:** 289 na base (fim do 04-01), 304 ao final, `fail 0`

## Accomplishments

- Traçador ponta a ponta: `cursorTick` (33 ms) manda `{ x, y }` em coordenadas da janela só às ilhas visíveis a até 24 px, e `null` uma vez ao se afastar; o renderer decide por `hoverStep` e responde `island:capture` com um booleano; o main aplica `setIgnoreMouseEvents(!captura)` sem a opção forward.
- Arraste e menu aberto seguram a captura; quando terminam (`island:drag-end`, `'menu-will-close'` e o `catch` do `popup`), `applyCapture` reaplica o último pedido do renderer.
- Ociosa, ilha escondida (`'hide'`) ou monitor removido soltam a captura (`releaseCapture`); sem ilha visível ou ociosa, o timer para (`updateCursorTick`, chamado no fim de `refresh` e no `'hide'`).
- Saem `island:hover`, `setHover` e os ouvintes de `mouseenter`/`mouseleave`/`mousemove` da pílula: o cursor do main é a única fonte de hover (Pitfall 9).
- `shouldExpand`: Precisa de você abre sozinha; Concluído e ociosa nunca expandem (nem fixadas); Trabalhando segue `pinExpanded`, depois `expandOn` ('click' expande só após o clique; qualquer outro valor segue o hover).
- Menu ganhou o submenu 'Expandir' (Ao passar o mouse, Ao clicar) e a caixa 'Fixar aberta', que grava o oposto do valor atual sem mudar o main.
- O shim do spike Tauri acompanha o preload (sai `setHover`; entram `onCursor`, `setCapture` e `openMenu` no-op), com trava de que as duas listas de nomes batem.

## Task Commits

1. **Task 1 (traçador), RED:** `b856e21` test(hover): cobre o hover pela posição do cursor
2. **Task 1 (traçador), GREEN:** `283ece4` feat(hover): detecta o cursor pela posição de tela e captura só sobre a pílula
3. **Task 2, RED:** `751d6d8` test(hover): cobre expandir no clique e fixar aberta
4. **Task 2, GREEN:** `7bdaa9d` feat(hover): expande no hover ou no clique e fixa aberta pelo menu

Tracer gate: `<verify>` só tem `<automated>`; re-executado de ponta a ponta (suíte inteira, 298 testes, e compilação do script inline em `node:vm`) e passou antes da Task 2.

## Decisions Made

- **Exceção registrada à regra "lógica pura em `state.js`" do CLAUDE.md:** `hoverStep` e `shouldExpand` ficam inline no `index.html`, entre `// hover:inicio` e `// hover:fim`. O renderer roda em sandbox com a CSP `script-src 'unsafe-inline'` (sem fonte de arquivo, trava T-02-19) e o preload em sandbox não importa arquivo local, então o renderer não carrega o `state.js`; e só o renderer conhece o retângulo vivo da pílula, que muda a cada quadro da mola. Precedentes: o bloco `regras-do-gate` (Fase 2) e o bloco `mola` (Fase 3, D-03). As funções continuam puras (sem DOM, sem relógio global) e são testadas por extração em `node:vm` vazio (`hover.test.js`).
- A trava de nomes do shim executa `preload.js` e `shim.js` em `node:vm` com um `electron` e um `window` de mentira e compara `Object.keys`, em vez de extrair os nomes por regex: não depende do formato do código e continua sendo uma trava barata.
- O gancho do evento `'hide'` em `createIsland` cobre atalho, menu e tela cheia dos planos seguintes sem que eles chamem `updateCursorTick`.

## Travas alteradas de propósito (gate.test.js)

- `RENDERER_CHANNELS` trocou `island:hover` por `island:capture` e ganhou `island:cursor` (9 canais; título do teste do preload: "nove canais conhecidos"). `MAIN_TO_RENDERER_CHANNELS = ['island:state', 'island:cursor']` substitui o filtro que excluía só `'island:state'` no teste dos canais do main; `handlers.length` segue 7 (commit `283ece4`).
- Travas novas: a captura vem só de um booleano, sem forward, com arraste e menu a segurando e o `'hide'` a soltando; o shim do spike expõe os mesmos nomes do preload.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Registro de base do plano fora do git-dir**
- **Found during:** início da Task 1
- **Issue:** o ledger `gsd-plan-head-before-04-02` ficaria em `.git/worktrees/...` dentro do checkout do autor, proibido pelas regras desta execução.
- **Fix:** a base foi registrada no frontmatter (`plan_head_before: fd79489...`) e `commits:` medido com `git rev-list --count fd79489..HEAD` (= 4).
- **Files modified:** nenhum
- **Commit:** n/a

**2. [Rule 3 - Blocking] Edição com fim de linha CRLF**
- **Found during:** início da Task 1
- **Issue:** `index.html`, `main.js`, `preload.js`, `state.js`, `gate.test.js`, `prefs.test.js` e o shim estão em CRLF na cópia de trabalho, e as edições multilinha não casariam.
- **Fix:** convertidos para LF durante a edição e de volta para CRLF antes de cada commit (o repositório usa `core.autocrlf`; `git diff` mostra só as mudanças reais).
- **Commit:** n/a

**3. [Rule 1 - Bug, prevenção] `releaseCapture` com ilha destruída**
- **Found during:** Task 1
- **Issue:** `releaseCapture` envia `island:cursor` ao `webContents`, que lança se a janela já foi destruída.
- **Fix:** `if (island.isDestroyed()) return;` depois das remoções dos mapas e antes do envio.
- **Files modified:** main.js
- **Commit:** `283ece4`

**Total deviations:** 3 (2 de processo, 1 preventiva de uma linha). **Impact:** nenhum no desenho do plano.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None. Os limites de confiança novos (`island:capture`, `island:cursor`) são os do `<threat_model>` do plano: T-04-06 (só booleano, remetente conferido por `islandOf`), T-04-07 (`updateHover` e `shouldExpand` não tocam `armed`, `restartArming` nem `decide`, com trava), T-04-08 (captura reaplicada no fim do arraste e do menu, solta em `'hide'`, ociosa e monitor removido) e T-04-09 (aceito; prova com terminal elevado é humana).

## Testar manualmente (não coberto por teste, vai para o plano 06)

- Com um terminal elevado (Administrador) em foco, passar o mouse sobre a pílula: ela deve expandir e capturar o clique (CHK-01).
- Fora da pílula, clicar e rolar sobre a janela de baixo, na área transparente da ilha: o clique e a roda atravessam.
- A 125% de escala (CHK-04): a pílula captura a 2 px para dentro da borda e só solta a 8 px para fora, sem tremer na borda.
- Arrastar a pílula para fora do próprio retângulo e soltar: o hover se reavalia sem a janela de trás receber o clique.
- Duplo clique restaura a posição e a pílula recolhe em até 33 ms.
- Em 'Ao clicar', um clique na pílula compacta a expande; o cursor saindo a recolhe. Em 'Fixar aberta', Trabalhando fica expandida; Concluído nunca.
- Permitir, Negar e Abrir seguem funcionando, e os botões não armam nem decidem por hover.

## Next Phase Readiness

Pronto para o plano 03 em diante: a captura, o cursor e o evento `'hide'` existem; atalho e menu de esconder só precisam chamar `island.hide()`/`showInactive()`.

## Self-Check: PASSED
