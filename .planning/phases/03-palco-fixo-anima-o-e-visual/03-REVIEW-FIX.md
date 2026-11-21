---
phase: 03-palco-fixo-anima-o-e-visual
fixed_at: 2026-11-21T00:00:00Z
review_path: D:/Desenvolvimentos/Pessoal/claude-island-fase2/.planning/phases/03-palco-fixo-anima-o-e-visual/03-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 3
skipped: 1
status: partial
---

# Fase 3: Relatório de correção do code review

**Corrigido em:** 2026-11-21
**Revisão de origem:** `.planning/phases/03-palco-fixo-anima-o-e-visual/03-REVIEW.md`
**Iteração:** 1

**Resumo:**
- Achados no escopo: 4 (CR e WR; os 5 IN ficam fora de `critical_warning`)
- Corrigidos: 3
- Pulados: 1

**Onde a verificação rodou:** na própria checkout da branch `feat/fase-3-visual`, que já era um worktree
isolado da sessão. Não foi criado um segundo worktree, e por isso não houve fast-forward nem sentinela de
recuperação. `node --test` passa com 263 testes (261 de antes, mais 1 do WR-01 e 1 do WR-02). O fim de linha de
cada arquivo foi conferido com `git ls-files --eol` (CRLF em `index.html`, `main.js`, `state.js` e
`island.test.js`; LF em `gate.test.js` e `visual.test.js`).

## Fixed Issues

### WR-01: `preferences.json` fica na pasta de sessões e é lido como se fosse uma sessão

**Files modified:** `state.js`, `main.js`, `island.test.js`
**Commit:** b8a7d57
**Applied fix:** novo helper puro `isSessionFile(fileName)` em `state.js`, que recusa o `preferences.json`
(comparando com `path.basename(PREFERENCES_FILE)`, sem repetir o nome) e tudo que não termina em `.json`.
`readSessions` passou a usar o helper no lugar de `file.endsWith('.json')`. O arquivo não foi movido.
Teste novo em `island.test.js` cobre sessão, preferências, `.heartbeat`, `.json.tmp` e entrada inválida.
Também deixa de existir a leitura inútil de `claude-ctx-preferences.json` a cada ciclo.

### WR-04: O modelo de altura do palco não cobre o rótulo da ferramenta

**Files modified:** `index.html`, `state.js`, `gate.test.js`
**Commit:** b01d03f
**Applied fix:** `#permission-tool` ganhou `overflow-wrap: anywhere`, então um nome sem ponto de quebra
(`mcp__servidor__ferramenta`) quebra em vez de ser cortado. `PERMISSION_TOOL_LIMIT` passou a ser exportado.
Em `gate.test.js`, `pillMaxHeight` agora soma as linhas do rótulo no pior caso: o limite de 100 caracteres
vezes uma largura média de 0,6 em, sobre a largura útil derivada do CSS (400 − 34 − 18 = 348 px), que dá 2
linhas. O teste também falha se o `overflow-wrap` sair do CSS. Com 2 linhas o palco de 520×410 segue
suficiente, então `WINDOW_SIZE` não mudou.
**Ressalva:** a largura de 0,6 em é uma suposição documentada no teste. Um nome de 100 caracteres largos
(por exemplo todos em `W`) ocuparia uma linha a mais e não seria coberto. A sugestão do review de repetir
`worstPeak` com `frameMs` de 8 e de 33 ms não foi aplicada (ver observação abaixo).
**Status:** fixed: requires human verification (o modelo de linhas é uma estimativa de largura de fonte).

### WR-02: Com o palco de 410 px, monitor de área útil baixa recusa toda decisão, sem aviso

**Files modified:** `main.js`, `index.html`, `state.js`, `gate.test.js`
**Commit:** 746b75f
**Applied fix:** `isWithinWorkArea` e o gate não foram tocados, e a janela não é redimensionada. O `sendState`
do main agora envia `fitsWorkArea`, calculado com a mesma conferência do gate (`isWithinWorkArea` com
`HORIZONTAL_SLACK`) sobre os limites reais da janela daquela ilha. Quando o gate recusa, `island:decide` já
reenvia o estado, então o fato se corrige sozinho. No renderer, `fitsWorkArea === false` desabilita Permitir
e Negar e troca a dica por "Responda no terminal". A trava só desabilita: nenhuma linha dela atribui
`disabled = false`, e o teste novo confere isso. Sem canal IPC novo, CSP igual. O texto do `ponytail` de
`WINDOW_SIZE` registra o limite. A trava de texto do payload em `gate.test.js` mudou no mesmo commit, junto
com o texto que ela guarda.
**Status:** fixed: requires human verification (muda o que o renderer oferece ao usuário numa tela com pedido
de permissão; vale uma passada em um monitor de área útil baixa).

## Skipped Issues

### WR-03: Em Linux o palco maior vira um retângulo invisível de 520×410 que bloqueia cliques

**File:** `main.js:20`, `main.js:223`; `state.js:243`
**Reason:** skipped: limitação documentada, vai para o checklist do PR. Linux é melhor esforço, e o
`click-through` não existe lá (`CAN_CLICK_THROUGH` é `false`). As saídas do review contradizem o palco fixo
ou exigem esconder a janela no estado ocioso, o que passa pelo gancho `show` e merece teste em Linux real.
Nenhuma mudança de código, por orientação do orquestrador.
**Original issue:** a janela transparente captura todo clique na sua área, e a fase aumentou essa área em
cerca de 50% sobre o topo central de cada monitor.

## Observações

- Os 5 achados IN (IN-01 a IN-05) estão fora do escopo `critical_warning` e continuam abertos no REVIEW.md.
- A repetição de `worstPeak` com `frameMs` de 8 e 33 ms (parte do fix do WR-04) ficou de fora: o pico varia
  cerca de 1,5 px com o quadro, bem abaixo da folga que o review mediu para 2 linhas (~18 px sobre 410 px).

---

_Fixed: 2026-11-21_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
