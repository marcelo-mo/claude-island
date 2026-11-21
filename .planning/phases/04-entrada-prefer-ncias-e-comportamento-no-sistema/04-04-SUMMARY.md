---
phase: 04-entrada-prefer-ncias-e-comportamento-no-sistema
plan: 04
subsystem: atalho-e-transparencia
tags: [electron, globalShortcut, esconder, transparencia, setOpacity, gate]

requires:
  - phase: 04
    provides: menuTemplate e toMenuItem (04-01); evento 'hide' que solta a captura e reavalia o timer do cursor (04-02); folga por âncora e syncIslands (04-03); effectiveOpacity e o esquema com shortcut e opacity (fases anteriores e 04-01)
provides:
  - registerShortcut(register, accelerator, onPress) em state.js, com status 'ok', 'unavailable' ou 'invalid'
  - menuTemplate(preferences, shortcutStatus) com 'Transparência', separador, informação do atalho (desabilitada) e 'Esconder'
  - userHidden, shortcutStatus, setUserHidden, show: !userHidden, globalShortcut.unregisterAll() em will-quit
  - applyOpacity(island) no laço do refresh e em createIsland
affects: [04-05, 04-06]

actuals:
  tokens: 9000
  tasks: 2
  commits: 4

plan_head_before: b8696a90f41affe49ec1b70b2b217059802fd783
plan_head_after: 3a239ff54f3e0e84613c587e7c6060e29c57bdc4

tech-stack:
  added: []
  patterns:
    - "regra do status do atalho em função pura que recebe o register por parâmetro, testada com função falsa"
    - "esconder por hide() e reexibir só por showInactive() dentro de um único setUserHidden, para o evento 'show' sempre rearmar"
    - "um único setOpacity no main, no mesmo passo do refresh que decide o pedido exibido"

key-files:
  created: []
  modified: [state.js, main.js, prefs.test.js, gate.test.js]

key-decisions:
  - "O atalho é registrado uma vez em start, sem nova tentativa, e liberado em will-quit; a ilha sobe com qualquer status"
  - "Sem atalho registrado, 'Esconder' fica desabilitado: esconder deixaria a ilha inalcançável até reiniciar"
  - "A opacidade é aplicada dentro do laço do refresh, antes de sendState; nenhum outro caminho chama setOpacity"

patterns-established:
  - "Travas de texto sobre o main.js ignoram linhas de comentário, para o comentário poder citar showInactive e setOpacity sem quebrar a contagem"

requirements-completed: [PREF-03, PREF-06, TELA-02, PREF-01]

coverage:
  - id: D1
    description: "Atalho global esconde e mostra todas as ilhas; reexibir passa pelo 'show' e rearma; esconder nunca decide"
    requirement: PREF-03
    verification:
      - kind: unit
        ref: "gate.test.js#esconder nunca decide, reexibir passa pelo rearme e o atalho é registrado uma vez"
        status: pass
      - kind: unit
        ref: "prefs.test.js#registerShortcut chama register uma única vez e devolve ok, unavailable ou invalid"
        status: pass
    human_judgment: true
    rationale: "O registro real do atalho e o showInactive sem roubar o foco só se confirmam com o Electron rodando (plano 06)"
  - id: D2
    description: "Falha de registro do atalho aparece no menu e desabilita 'Esconder'"
    requirement: PREF-03
    verification:
      - kind: unit
        ref: "prefs.test.js#o menu termina em separador, informação do atalho desabilitada e Esconder, que só vale com o atalho registrado"
        status: pass
    human_judgment: false
  - id: D3
    description: "Pedido com a ilha escondida só toca o som: nada reexibe a ilha por causa de pedido e o gate recusa por janela escondida"
    requirement: TELA-02
    verification:
      - kind: unit
        ref: "gate.test.js#esconder nunca decide, reexibir passa pelo rearme e o atalho é registrado uma vez"
        status: pass
      - kind: unit
        ref: "gate.test.js#island:decide: o eco vem do renderer, o alvo e o relógio do main, os fatos da janela real"
        status: pass
    human_judgment: true
    rationale: "O som numa janela escondida por hide() foi medido na pesquisa; a audição real fica para o plano 06"
  - id: D4
    description: "Transparência de 100/85/70/55% pelo menu, nunca com pedido na tela, aplicada antes do estado chegar ao renderer"
    requirement: PREF-06
    verification:
      - kind: unit
        ref: "gate.test.js#a transparência sai do mesmo passo do refresh e nunca vale com pedido na tela"
        status: pass
      - kind: unit
        ref: "prefs.test.js#'Transparência' oferece 100, 85, 70 e 55%, com 100% marcado por padrão, entre 'Fixar aberta' e 'Âncora'"
        status: pass
      - kind: unit
        ref: "gate.test.js#effectiveOpacity: (um teste por vetor do fixture)"
        status: pass
    human_judgment: true
    rationale: "A mistura real com o fundo e o Linux sem efeito só se veem na tela (plano 06)"
  - id: D5
    description: "Menu completo da fase, na ordem final"
    requirement: PREF-01
    verification:
      - kind: unit
        ref: "prefs.test.js#o menu padrão tem os itens, na ordem"
        status: pass
    human_judgment: true
    rationale: "O menu nativo sobre janela focusable: false só se confirma numa pessoa na tela (CHK-03)"

duration: 4min
completed: 2026-11-21
status: complete
story_points_realized: 3
---

# Phase 4 Plan 04: Atalho global e transparência Summary

**Atalho global `Control+Alt+Shift+C` (ou o do `preferences.json`) que esconde e mostra todas as ilhas por `hide()` e `showInactive()`, com aviso e 'Esconder' desabilitado no menu quando o registro falha, e transparência de 100/85/70/55% por `setOpacity` aplicada no laço do `refresh`, sempre a 100% com pedido de permissão na tela.**

## Performance

- **Duration:** 4 min (14:04 a 14:08, horário local)
- **Tasks:** 2 (1 traçador, 1 auto/TDD)
- **Files modified:** 4 (nenhum novo)
- **Testes:** 335 na base (fim do 04-03), 340 ao final, `fail 0`

## Accomplishments

- Traçador ponta a ponta: `registerShortcut` (pura, recebe o `register` por parâmetro) devolve `'ok'`, `'unavailable'` ou `'invalid'` e chama `register` uma única vez; `start()` o liga a `globalShortcut.register` e a `setUserHidden(!userHidden)`; `will-quit` libera o atalho antes de apagar o batimento.
- `setUserHidden` é o único ponto que esconde e reexibe: `hide()` emite `'hide'` (04-02: solta a captura e reavalia o timer do cursor) e `showInactive()` emite `'show'`, que chama `refresh('rearm')`. Não toca em decisão e não destrói a janela. `createIsland` nasce com `show: !userHidden`.
- Menu final da fase: Tema, Forma, Estilo da animação, Velocidade da animação, Expandir, Fixar aberta, Transparência, Âncora, Ilhas, separador, informação do atalho (desabilitada) e 'Esconder' (`action: 'hide'`, desabilitado sem atalho registrado).
- `applyOpacity(island)` com a linha exata `island.setOpacity(effectiveOpacity(preferences.opacity, Boolean(lastPickedState.permission)));`, chamada no laço do `refresh` antes de `sendState` e em `createIsland`. Reexibir e trocar preferência já passam pelo laço por `refresh('rearm')`. Os vetores de `effectiveOpacity` não mudaram.

## Task Commits

1. **Task 1 (traçador), RED:** `8c719f3` test(atalho): cobre o registro do atalho e o esconder pelo menu
2. **Task 1 (traçador), GREEN:** `60279d6` feat(atalho): esconde e mostra a ilha por atalho global
3. **Task 2, RED:** `37eb3ef` test(transparencia): trava a transparência no passo do refresh
4. **Task 2, GREEN:** `3a239ff` feat(transparencia): aplica a transparência escolhida no menu, nunca com pedido na tela

Tracer gate: `<verify>` só tem `<automated>`; re-executado de ponta a ponta (suíte inteira, 338 testes, mais `registerShortcut` imprimindo `ok,unavailable,invalid`) e passou antes da Task 2. Tracer verified end-to-end, expandiu.

## Decisions Made

- **Travas de texto ignoram linhas de comentário** (padrão já usado nas travas de `setPosition`): o comentário de `setUserHidden` e o de `applyOpacity` citam `showInactive` e `setOpacity` sem inflar a contagem de ocorrências.
- **`shortcutStatus` começa em `'unavailable'`**, não `'ok'`: se o menu abrisse antes do registro por qualquer motivo, 'Esconder' ficaria desabilitado (lado seguro).
- **Item 'Esconder' desabilitado mantém `action: 'hide'`**: o main só liga o clique, e o Electron não dispara clique de item desabilitado.

## Travas alteradas de propósito (gate.test.js)

Nenhuma trava existente mudou. Travas novas: "esconder nunca decide, reexibir passa pelo rearme e o atalho é registrado uma vez" e "a transparência sai do mesmo passo do refresh e nunca vale com pedido na tela". Em `prefs.test.js`, o teste da ordem dos itens e o mapa `VALUES_BY_KEY` ganharam 'Transparência' e `opacity`, como o plano previa.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comentário desatualizado em `createIsland`**
- **Found during:** Task 1
- **Issue:** o comentário dizia que nada esconde nem minimiza a ilha de propósito antes da Fase 4 (Assumption A9), o que deixou de ser verdade com `setUserHidden`.
- **Fix:** o comentário passou a dizer que o atalho e o menu escondem por `hide()` e reexibem por `showInactive()`.
- **Files modified:** main.js
- **Commit:** `60279d6`

**2. [Rule 3 - Blocking] Registro de base do plano fora do git-dir**
- **Found during:** início da Task 1
- **Issue:** o ledger `gsd-plan-head-before-04-04` ficaria em `.git/worktrees/...` dentro do checkout do autor, proibido pelas regras desta execução.
- **Fix:** a base foi registrada no frontmatter (`plan_head_before: b8696a9...`) e `commits:` medido com `git rev-list --count b8696a9..HEAD` (= 4).
- **Commit:** n/a

**3. [Rule 3 - Blocking] Edição com fim de linha CRLF**
- **Found during:** início da Task 1
- **Issue:** `state.js`, `main.js` e `gate.test.js` estão em CRLF na cópia de trabalho (índice em LF, `core.autocrlf`).
- **Fix:** convertidos para LF durante a edição e de volta para CRLF no fim, com `git add`; `git status` limpo (só `.planning/state.json`, que não entra no commit).
- **Commit:** n/a

**Total deviations:** 3 (1 comentário, 2 de processo). **Impact:** nenhum no desenho do plano.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None. Os limites de confiança novos são os do `<threat_model>`: T-04-14 (reexibir só por `showInactive` em `setUserHidden`, com trava de que não há `show()` nem outro caminho), T-04-15 (`setUserHidden` sem `writeDecision`, `acceptDecision` ou `decidedPermissionId`; o gate recusa por janela escondida), T-04-16 (um único `setOpacity`, no laço do `refresh`, antes de `sendState`), T-04-17 (`registerShortcut` em `try/catch`, uma chamada só) e T-04-18 ('Esconder' desabilitado sem atalho; esconder não é persistido).

## Testar manualmente (não coberto por teste, vai para o plano 06 e o checklist do PR)

- `Control+Alt+Shift+C` esconde todas as ilhas e, apertado de novo, as reexibe sem tirar o foco do terminal; com o terminal em foco, o foco continua nele.
- Com a ilha escondida, um pedido de permissão toca o som, a ilha não reaparece e o terminal segue valendo; ao reexibir, Permitir e Negar recomeçam desarmados.
- Atalho tomado por outro programa, ou string inválida no `preferences.json`: a ilha sobe, o menu avisa e 'Esconder' fica desabilitado.
- Menu 'Esconder' (com atalho ok) esconde a ilha; reiniciar a mostra.
- Transparência a 85, 70 e 55%: a ilha mistura com o fundo; com um pedido de permissão na tela volta a 100% e, ao fim dele, à escolhida.
- Linux: `setOpacity` sem efeito (aceito, A6).

## Next Phase Readiness

Pronto para o plano 05: `setUserHidden` e o callback do atalho existem como o plano 05 espera (troca do corpo por `applyVisibility()` e do callback por `nextUserHidden`), e todo caminho que esconde passa pelo evento `'hide'`.

## Self-Check: PASSED
