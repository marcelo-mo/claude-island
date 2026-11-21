---
phase: 06-conviv-ncia-com-a-ilha-do-sistema
plan: 01
subsystem: posição da ilha e z-order
tags: [conv-01, conv-02, ancora, windhawk]
requires: [fase 4: ANCHORS, anchorPosition, horizontalSlackFor, data-anchor]
provides: [âncoras right-of-island e left-of-island, BESIDE_GAP_PX, BESIDE_TOP_OFFSET_PX, trava de CONV-02]
affects: [state.js, index.html, main.js (comentário), prefs.test.js, coexistence.test.js]
key-files:
  created: [coexistence.test.js]
  modified: [state.js, index.html, main.js, prefs.test.js]
key-decisions: [D-02 nomes sem sufixo de lado, D-03 210 px e +17 px, D-04 arraste como ajuste fino, D-05 todos os monitores, D-08 trava em arquivo próprio]
metrics:
  tests_before: 348
  tests_after: 362
---

# 06-01: âncoras ao lado da ilha do sistema e trava do topo

## O que foi feito

- `state.js`: `ANCHORS` ganhou `right-of-island` e `left-of-island` (ao fim, as seis da Fase 4 intactas);
  `besidePosition` (privada) põe a borda interna da pílula a `BESIDE_GAP_PX = 210` do centro da área útil, com a
  janela começando 20 px antes (margem da sombra) e o topo `BESIDE_TOP_OFFSET_PX = 17` abaixo da área útil;
  `anchorPosition` e `horizontalSlackFor` tratam o caso antes das regras de sufixo; rótulos "Ao lado da ilha do
  sistema, à direita/à esquerda". Dois `ponytail:` (distância fixa e todos os monitores).
- `index.html`: quatro regras CSS que alinham a pílula pela borda interna, com `transform-origin` nela.
- `main.js`: só o comentário do `setAlwaysOnTop` em `createIsland` (CONV-02).
- `coexistence.test.js` (13 testes): posição e espelho nos dois monitores do autor, invasão máxima de 5 px na
  pílula expandida do mod, alinhamento vertical, folga, clamp, arraste, `normalizePreferences`, menu, CSS e a
  trava de CONV-02 (um `setAlwaysOnTop` em `createIsland`, nenhum `moveTop(`, nenhum timer mexendo no z).
- `prefs.test.js`: o teste do submenu de âncora passou a listar as oito âncoras (mesma asserção, lista maior).

## Desvios

- Nomes `right-of-island`/`left-of-island` em vez de `beside-right`/`beside-left` da pesquisa (D-02): o sufixo
  `-right` faria o CSS e o teste da Fase 4 alinharem a pílula do lado errado.
- O CSS repete as regras de lado em vez de agrupar os seletores (D-06 dizia "entra no grupo"): agrupar quebra a
  trava de `visual.test.js`, que exige uma regra só por seletor da Fase 4.
- Depois da revisão (06-REVIEW-FIX.md): centro arredondado uma vez, limite de 1220 DIP registrado e travado, trava
  de CONV-02 mais robusta.
- A trava de CONV-02 pegou o primeiro rascunho do comentário (que citava `moveTop()` com parêntese); o texto foi
  reescrito. Prova de que a trava morde.

## Verificação

- `node --test`: 362/362 (348 de antes + 14 novos).
- Na tela, pelo CDP, com a ilha do worktree a 100% e a 125%: borda interna em 1490 (= 1280 + 210) e em 1070 (=
  1280 − 210) no principal, −558 e −978 no de 125%; topo da janela em `workArea.y + 17`; em 1.142 e 557 quadros
  de transições no Elástico a borda interna não se mexeu (20 px do palco, ±0,00002) e a externa chegou a 429,75
  (direita) e 90,6 (esquerda), dentro do palco.

## Self-Check: PASSED
