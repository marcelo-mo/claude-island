---
phase: 04-entrada-prefer-ncias-e-comportamento-no-sistema
plan: 05
subsystem: tela-cheia-e-visibilidade
tags: [electron, esconder, tela-cheia, gate, ponytail]

requires:
  - phase: 04
    provides: setUserHidden, atalho global e registerShortcut (04-04); evento 'hide' que solta a captura e reavalia o timer (04-02); syncIslands com updateCursorTick (04-03); acceptDecision com coveredByFullscreen (fases anteriores)
provides:
  - isIslandVisible({ userHidden, covered }) e nextUserHidden({ userHidden, displayIds, coveredDisplayIds }) em state.js
  - nextFullscreen({ previous, probe, ownPid, displays }) com FULLSCREEN_TOLERANCE_PX, SHELL_WINDOW_CLASSES e WS_EX_TRANSPARENT em state.js (contrato do sensor futuro, sem consumidor)
  - fullscreenByDisplay (Map vazio até haver sensor), applyVisibility (único ponto que esconde e mostra) e fato coveredByFullscreen por monitor em main.js
  - comentário ponytail: do ponto de entrada do sensor, com as duas opções de D-20
affects: [04-06]

actuals:
  tokens: 14000
  tasks: 2
  commits: 4

plan_head_before: 88470562bc731ca643c5da6e2a2d73f8c9f0ca61
plan_head_after: c00b5874cfd4d47af325b068976864efd299eee7

tech-stack:
  added: []
  patterns:
    - "visibilidade da ilha como função pura de fatos (usuário + tela cheia por monitor), aplicada num único lugar do main"
    - "fato de janela para o gate calculado só no main, por monitor, com monitor desconhecido tratado como coberto"
    - "regra de sensor entregue como função pura com tabela, antes do sensor"

key-files:
  created: []
  modified: [state.js, main.js, island.test.js, gate.test.js]

key-decisions:
  - "applyVisibility é o único lugar que chama hide() e showInactive(); setUserHidden só grava userHidden e delega"
  - "coveredByFullscreen vem de fullscreenByDisplay.has(display.id); monitor desconhecido conta como coberto (fail-safe)"
  - "O atalho passa por nextUserHidden: com toda ilha coberta por tela cheia, nada muda; com ao menos uma não coberta, inverte"
  - "Sem sensor por D-20 (autorização do autor NÃO CONCEDIDA): regra pura pronta e ponto de entrada marcado, sem fullscreen.js nem pacote nativo"

requirements-completed: [TELA-02]
requirements-partial: [TELA-01]

coverage:
  - id: D1
    description: "Esconder e mostrar a ilha passam só por applyVisibility, que combina o usuário com a tela cheia por monitor; o atalho não reexibe ilha coberta e não inverte com todas cobertas"
    requirement: TELA-02
    verification:
      - kind: unit
        ref: "island.test.js#isIslandVisible só mostra com o usuário não escondendo e sem tela cheia"
        status: pass
      - kind: unit
        ref: "island.test.js#nextUserHidden inverte, exceto quando toda ilha está coberta por tela cheia"
        status: pass
      - kind: unit
        ref: "gate.test.js#esconder combina o usuário e a tela cheia, só no main, e o atalho respeita a tela cheia"
        status: pass
    human_judgment: true
    rationale: "O som com a ilha escondida por hide() e o showInactive sem roubar foco só se confirmam com o Electron rodando (plano 06)"
  - id: D2
    description: "O gate recebe coveredByFullscreen por monitor, calculado só no main; monitor desconhecido recusa"
    requirement: TELA-02
    verification:
      - kind: unit
        ref: "gate.test.js#island:decide: o eco vem do renderer, o alvo e o relógio do main, os fatos da janela real"
        status: pass
    human_judgment: false
  - id: D3
    description: "Regra de D-18 como função pura (área cliente cobrindo o monitor com 1 px de tolerância; ignora pid próprio, shell, janela invisível, minimizada, cloaked ou transparente; lembra o HWND por monitor e solta)"
    requirement: TELA-01
    verification:
      - kind: unit
        ref: "island.test.js#nextFullscreen marca e solta o monitor coberto pelo primeiro plano"
        status: pass
    human_judgment: true
    rationale: "TELA-01 fica PARCIAL: sem sensor do primeiro plano a ilha NÃO esconde quando um app ocupa o monitor; depende da escolha do autor (D-20)"
  - id: D4
    description: "Sem dependência nativa: nenhum require, fullscreen.js ausente, package.json e hooks sem o pacote"
    requirement: TELA-01
    verification:
      - kind: unit
        ref: "gate.test.js#sem sensor nem dependência nativa, e os hooks continuam leves"
        status: pass
      - kind: integration
        ref: "git diff --quiet ddda2e4 -- package.json pnpm-workspace.yaml pnpm-lock.yaml (saiu 0)"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-11-21
status: complete
story_points_realized: 3
---

# Phase 4 Plan 05: Tela cheia por monitor, sem sensor Summary

**`applyVisibility` como único ponto que esconde e mostra a ilha (usuário + mapa de tela cheia por monitor), `coveredByFullscreen` por monitor no gate, atalho por `nextUserHidden` e a regra pura `nextFullscreen` com tabela, tudo sem sensor e sem dependência nova (D-20).**

## Aviso de cobertura: TELA-01 e TELA-02

- **TELA-02 (pedido com a ilha escondida só toca o som):** coberto, vale sem o sensor. A ilha escondida não reaparece por causa de pedido, o gate recusa por janela escondida e reexibir rearma. A confirmação com o Electron rodando fica para o plano 06.
- **TELA-01 (esconder quando um app ocupa o monitor): PARCIAL.** Esta fase **não esconde** a ilha quando um app em tela cheia ocupa o monitor. Está pronto o que não depende de sensor (regra pura, mapa por monitor, visibilidade combinada, fato no gate). Falta o sensor do primeiro plano do Windows, que depende da escolha do autor entre (1) `koffi@3.3.8` com `allowBuilds: { koffi: false }` e (2) um processo PowerShell filho persistente com P/Invoke em `user32`, sem dependência nova. O plano 06 leva as duas opções, com os números medidos, às notas do PR.
- O mesmo vale para o ramo de tela cheia de TELA-02 (ilha não reaparecer sobre a tela cheia com botão armado): a proteção existe (`isIslandVisible` exige `covered === false`; `nextUserHidden` não inverte com todas cobertas), mas, sem sensor, o mapa fica vazio e nenhum monitor conta como coberto, então só vale de fato quando o sensor existir.

## Performance

- **Duration:** cerca de 8 min
- **Tasks:** 2 (1 traçador, 1 auto/TDD)
- **Files modified:** 4 (nenhum novo)
- **Testes:** 340 na base (fim do 04-04), 345 ao final, `fail 0`

## Accomplishments

- Traçador ponta a ponta: atalho, `nextUserHidden`, `setUserHidden`, `applyVisibility`, `isIslandVisible`, `hide()` ou `showInactive()`. `createIsland` nasce com `show: isIslandVisible({ userHidden, covered: fullscreenByDisplay.has(display.id) })` e `syncIslands` chama `applyVisibility()` antes do `updateCursorTick()` (uma ilha reaproveitada pode ir para um monitor coberto). `applyVisibility` não chama `updateCursorTick`: o evento `'hide'` (04-02) e o `'show'` → `refresh('rearm')` cuidam do timer.
- `island:decide` passa `coveredByFullscreen: display ? fullscreenByDisplay.has(display.id) : true,`; a trava de `objectArgument` foi atualizada. Os vetores do gate não mudaram.
- `nextFullscreen` pura (D-18): começa de cópia do mapa anterior, solta HWND em `gone` e monitores que saíram, ignora o próprio pid e janelas invisíveis, minimizadas, cloaked (inclusive `null`) ou com `WS_EX_TRANSPARENT`, casa o monitor por igualdade exata de `monitorRect`, solta se a classe é do shell ou a área cliente não cobre o monitor (tolerância de 1 px), senão marca. Tabela com 1 px sim e 2 px não, terminal maximizado, classes do shell, bits de estilo, dois monitores, HWND sumido, monitor removido e entradas fora do contrato (sem lançar nem mutar).
- Comentário `ponytail:` logo acima de `const fullscreenByDisplay` com o ponto de entrada do sensor e as duas opções de D-20 com os números medidos na pesquisa.
- Trava nova "sem sensor nem dependência nativa, e os hooks continuam leves": nenhum arquivo de hook, `window.js`, `state.js` ou `install.js` cita o pacote nativo; nenhum arquivo carrega o pacote; `fullscreen.js` não existe; `package.json` não o tem; o comentário do ponto de entrada cita `ponytail:`, `nextFullscreen`, `applyVisibility` e `PowerShell`.

## Task Commits

1. **Task 1 (traçador), RED:** `87a92b6` test(tela-cheia): cobre a visibilidade combinada e o atalho
2. **Task 1 (traçador), GREEN:** `7b2debd` feat(tela-cheia): leva a tela cheia por monitor ao gate e à visibilidade, sem sensor
3. **Task 2, RED:** `c9005d8` test(tela-cheia): cobre a regra pura de tela cheia por monitor
4. **Task 2, GREEN:** `c00b587` feat(tela-cheia): acrescenta a regra pura de tela cheia, à espera do sensor

Tracer gate: `<verify>` só tem `<automated>`; re-executado de ponta a ponta antes da Task 2 (`node --test` com 343 testes verdes, `nextUserHidden` imprimindo `false,true`, `git diff --quiet` das dependências saindo 0). Tracer verified end-to-end, expandiu.

## Decisions Made

- **`applyVisibility` percorre `islands` por `[displayId, island]`** e só age quando o estado desejado difere do real (`isVisible()`), então chamá-la a mais (em `syncIslands`, a cada troca) é inofensivo.
- **`nextFullscreen` casa monitor por igualdade exata de `monitorRect` com `rect`**, sem conta de escala; o chamador do sensor futuro é quem converte para pixels físicos (`screen.dipToScreenRect`), como o ponytail do main descreve.

## Travas alteradas de propósito (gate.test.js)

Mudaram no mesmo commit do código (`7b2debd`), como o plano previa:

- `acceptDecision({`: a entrada `coveredByFullscreen` passou de `'false'` para `'display ? fullscreenByDisplay.has(display.id) : true'`.
- `showInactive(` aparece uma vez, agora dentro de `applyVisibility` (antes, `setUserHidden`); `setUserHidden` deve chamar `applyVisibility();`.
- `createIsland` deve conter `show: isIslandVisible({ userHidden, covered: fullscreenByDisplay.has(display.id) }),` (antes `show: !userHidden,`).

Travas novas: "esconder combina o usuário e a tela cheia, só no main, e o atalho respeita a tela cheia" e "sem sensor nem dependência nativa, e os hooks continuam leves".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Registro de base do plano fora do git-dir**
- **Found during:** início da Task 1
- **Issue:** o ledger `gsd-plan-head-before-04-05` ficaria em `.git/worktrees/...`, dentro do checkout do autor, proibido pelas regras desta execução.
- **Fix:** a base ficou no frontmatter (`plan_head_before: 8847056...`) e `commits:` foi medido com `git rev-list --count 8847056..HEAD` (= 4).
- **Commit:** n/a

**2. [Rule 3 - Blocking] Edição com fim de linha CRLF e barras invertidas**
- **Found during:** Task 1 e Task 2
- **Issue:** os arquivos estão em CRLF; a primeira versão de um teste novo saiu do script de edição com uma quebra de linha real dentro de um literal JS (erro de sintaxe, suíte vermelha por alguns minutos, nunca commitada).
- **Fix:** o teste foi regravado por arquivo literal e anexado com CRLF; `node --test` verde e `git status` limpo (só `.planning/state.json`, que não entra).
- **Commit:** `7b2debd`, `c00b587`

**3. [Plano × base] Linhas de âncora do plano**
- **Issue:** o plano dava linhas de base (`acceptDecision` 128-153, trava 312-327); os planos anteriores as deslocaram. As âncoras foram achadas por conteúdo, sem efeito no resultado. O verify `git diff --quiet ddda2e4` valeu como escrito.

**Total deviations:** 3 (todas de processo). **Impact:** nenhum no desenho do plano.

## Issues Encountered

None.

## Known Stubs

- `fullscreenByDisplay` em `main.js` fica sempre vazio (sem sensor de tela cheia, D-20: autorização do autor NÃO CONCEDIDA). É intencional e documentado no comentário `ponytail:` acima dele; `nextFullscreen` não tem consumidor. O que resolve é a escolha do autor entre `koffi` e o processo PowerShell persistente, a registrar no PR pelo 04-06.

## Threat Flags

None. T-04-19 e T-04-20: nenhuma dependência nativa, `git diff --quiet` das dependências saindo 0 e trava de texto nos hooks. T-04-21: `coveredByFullscreen` calculado só no main, por monitor, desconhecido = coberto, trava de `objectArgument`. T-04-22: `isIslandVisible` exige `covered === false` e `nextUserHidden` não inverte com todas cobertas. T-04-23: TELA-01 listado como parcial acima e em `requirements-partial`.

## Testar manualmente (não coberto por teste, vai para o plano 06 e o checklist do PR)

- Com a ilha escondida pelo atalho, um pedido de permissão toca o som, a ilha não reaparece e o terminal segue valendo; ao reexibir, Permitir e Negar recomeçam desarmados.
- Com dois monitores, o atalho esconde e mostra as duas ilhas; trocar de modo de ilha com a ilha escondida mantém a nova escondida.
- Esconder a ilha quando um app ocupa o monitor (TELA-01) NÃO funciona nesta fase: depende do sensor.

## Next Phase Readiness

Pronto para o plano 06: PR com TELA-01 como pendente da escolha do autor (as duas opções do sensor com os números medidos), checklist manual e fechamento da fase.

## Self-Check: PASSED
