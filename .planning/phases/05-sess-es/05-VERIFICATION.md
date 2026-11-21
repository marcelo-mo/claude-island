---
phase: 05-sess-es
verified: 2026-11-21T18:00:00Z
status: human_needed
score: 14/16 must-haves verified
covered_files:
  - .planning/phases/05-sess-es/05-01-PLAN.md
  - .planning/phases/05-sess-es/05-01-SUMMARY.md
  - .planning/phases/05-sess-es/05-02-PLAN.md
  - .planning/phases/05-sess-es/05-02-SUMMARY.md
  - .planning/phases/05-sess-es/05-03-PLAN.md
  - .planning/phases/05-sess-es/05-03-SUMMARY.md
  - .planning/phases/05-sess-es/05-04-PLAN.md
  - .planning/phases/05-sess-es/05-04-SUMMARY.md
  - .planning/phases/05-sess-es/05-05-PLAN.md
  - .planning/phases/05-sess-es/05-05-SUMMARY.md
  - .planning/phases/05-sess-es/05-06-PLAN.md
  - .planning/phases/05-sess-es/05-06-SUMMARY.md
  - .planning/phases/05-sess-es/05-07-PLAN.md
  - .planning/phases/05-sess-es/05-07-SUMMARY.md
  - README.md
  - THIRD_PARTY_NOTICES.md
  - fixtures/permission-vectors.json
  - gate.test.js
  - index.html
  - island.test.js
  - main.js
  - preload.js
  - state.js
covered_digest: "v4:sha256:667d4fadd6affc05c7f68c912b8b8afbe93f30d88a7e1c7e40254129decc5fa8"
behavior_unverified: 2
overrides_applied: 0
behavior_unverified_items:
  - truth: "A cola do main.js (refresh) encadeia nextSelection, pickState e nextShownPermission na ordem real, e a roda, o clique no ponto, o snap e o avanço da fila passam por ela antes de qualquer decisão"
    test: "Com a ilha desta branch e duas sessões, girar a roda sobre a pílula, clicar num ponto, provocar um snap (pedido na outra sessão) e responder o pedido exibido pelo terminal; em cada caso tentar Permitir antes e depois dos 0,8 s."
    expected: "Toda troca desabilita Permitir/Negar por 0,8 s e exige rolar o texto até o fim; o eco do pedido anterior nunca aprova nada; a ilha só vai ao pedido pendente quando deve."
    why_human: "Os vetores e o `nextSelection` provam as funções puras na ordem do main, mas a ordem real das chamadas dentro de `refresh()` só é coberta por travas de texto e por duas execuções em `node:vm` (`readSessions`, `sendState`). Nenhum teste executa o `refresh` de ponta a ponta (o próprio 05-07-SUMMARY admite)."
  - truth: "Dado uma troca de sessão para um pedido, Permitir e Negar ficam desabilitados enquanto o conteúdo desliza (a mola de troca entra em allSpringsAtRest e canArm espera por ela)"
    test: "Trocar para uma sessão com pedido pela roda, pelo ponto, pelo snap e pela fila, e tentar clicar em Permitir durante o deslize e logo depois."
    expected: "Os botões seguem desabilitados até o conteúdo parar e até os 0,8 s; um clique no meio da animação não aprova nada."
    why_human: "`springs.tab` está em `springs` e `canArm` é puro e testado, mas o laço de quadros do renderer nunca foi executado nesta fase (sem Electron e sem DOM falso); só travas de texto cobrem a cola, como na Fase 3."
human_verification:
  - test: "A roda chega à janela da ilha, que nunca recebe o foco. Com duas ou mais sessões, girar um entalhe sobre a pílula, com e sem 'Rolar janelas inativas ao passar o mouse sobre elas' ligado, e com um terminal elevado em foco."
    expected: "Com a opção ligada, um entalhe anda uma sessão (para baixo a seguinte, para cima a anterior, sem dar a volta); sem a opção a roda não chega e o clique no ponto continua trocando; o touchpad é mais lento e a inércia não dispara várias sessões."
    why_human: "A entrega da roda pelo SO a uma janela não focável só se vê na tela (D-02); nenhuma roda sintética é permitida pelo projeto."
  - test: "Sensação e aparência: mola de troca (assenta em menos de 1 s, sem balanço, conteúdo de baixo ao rolar para baixo), pontos (tamanho, anel da exibida, pulso de quem pede, anel parado com 'reduzir movimento'), transição de cor do acento."
    expected: "Como o mod; durante a troca os pontos, 'Abrir', Permitir e Negar não se movem; com 'reduzir movimento' a troca é seca e a cor do acento troca sem transição."
    why_human: "Aparência e sensação de movimento são julgamento visual."
  - test: "Aviso sonoro: um snap ou pedido novo na sessão exibida toca o 'precisa de você'; rolar ou clicar até uma sessão que já espera (e até uma 'concluído') não toca."
    expected: "Som só na chegada do pedido (correção WR-04)."
    why_human: "Áudio só se ouve."
  - test: "Palco a 125% e 150% de escala (monitores mistos do autor), com 2 a 8 pontos, projeto longo no título e pedido com 'N de M' no pico do Elástico a 2x."
    expected: "Nada recortado e nenhuma linha de 1 px na borda do palco; o cabeçalho 'projeto · ferramenta' e o 'N de M' não passam do pico."
    why_human: "DPI fracionária e recorte de janela transparente só aparecem em monitor real; a conta do palco é por simulação em pixels CSS."
  - test: "Âncora 'Ao lado da ilha do sistema' a 1366x768 em 125% (área útil abaixo de 1220 DIP) com um pedido na tela."
    expected: "Permitir e Negar desabilitados com 'Responda no terminal'; com área útil de 1220 DIP ou mais, funcionam como antes."
    why_human: "Resolução e escala reais do monitor (D-20); o gate recusa por teste, mas o que o renderer mostra só se vê na tela."
  - test: "Correções do code review que mudaram lógica (WR-01 arquivo de sessão pela metade, WR-02 roda ou clique no mesmo ciclo em que o pedido exibido sai), marcadas 'requires human verification' no 05-REVIEW-FIX.md."
    expected: "Num uso real de várias sessões a ilha nunca troca sozinha por causa de um arquivo lido pela metade, e a escolha de quem rolou ou clicou não é desfeita pelo pedido que saiu no mesmo instante."
    why_human: "Os testes cobrem a lista e o `pollSelection`, não a ilha rodando; o problema de WR-01 aparece só ao longo de uma sessão ocupada."
  - test: "Resíduo de layout aceito (T-05-28, D-17) e exceção registrada da D-21: com o cursor sobre a pílula, clicar nos pontos de uma sessão 'trabalhando' e de uma 'concluído'; e, com todas as sessões restantes com pedido já deixado, encerrar a exibida."
    expected: "Anotar quanto a pílula e os pontos andam; Permitir e Negar, se armados, voltam a desabilitar e só rearmam no lugar novo; na exceção da D-21 o pedido reaparece com rearme."
    why_human: "Movimento de layout sob o cursor só se mede na tela."
  - test: "Os demais itens da lista consolidada 'Testar manualmente (checklist do PR)' do 05-07-SUMMARY.md: sessão morta (fechar a janela do terminal), 'concluído' exibido além dos 10 s, saída da sessão exibida, pedido nunca exibido, pedido novo no meio do gesto de roda, ilha escondida pelo atalho."
    expected: "Como descrito em cada item da lista."
    why_human: "Exigem processos de terminal reais, janelas reais e o relógio."
---

# Fase 5: Verificação das sessões

**Objetivo da fase:** Com várias sessões abertas o usuário vê uma por vez, troca com a roda do mouse ou clicando num ponto, e a ilha o leva sozinha, uma vez, à sessão que pede permissão, sem nunca mover um botão sob o cursor
**Verificado:** 2026-11-21
**Status:** human_needed
**Re-verificação:** Não, verificação inicial

## Resumo do veredito

Nenhum gap bloqueante. Verifiquei por evidência própria, e não pelo SUMMARY: a suíte inteira passa (500 testes, 0 falhas; `coexistence.test.js` com 14 de 14), o fixture antigo é idêntico ao de `c461158` por grupo, a ordem e o corpo de `acceptDecision`, `nextShownPermission` e `isWithinWorkArea` são idênticos aos de `c461158`, `anchorPosition`, `horizontalSlackFor` e `menuTemplate` são idênticos aos de `6741b25` (Fase 6), `hook.js` e `permission-hook.js` não mudaram, a CSP é a mesma, e só `island:wheel` e `island:select` são canais novos. Rodei também um script próprio de 19 cenários contra `state.js` (sem Electron) e todos bateram com as regras da CONTEXT.

O status é `human_needed` por dois motivos: nada rodou no Electron real (a entrega da roda a uma janela sem foco, a mola, os pontos, o som e o palco a 125% e 150% só se veem na tela), e duas truths dependem de cola (`refresh()` do main e o laço de molas do renderer) que só tem travas de texto. Essas duas ficam como `PRESENT_BEHAVIOR_UNVERIFIED`: presentes e ligadas, sem teste que execute a transição.

A leitura da D-17 sobre "sem nunca mover um botão sob o cursor" foi respeitada: Permitir e Negar estão cobertos pelo rearme por retângulo (`isSameRect(armedRect, buttonsRect())`, linhas 981 e 1084 do `index.html`, herdado das Fases 2 e 3) e a mola de troca só alcança `#lead`, `#detail` e `#permission`, que não contêm botão. Os botões que não aprovam (pontos, 'Abrir', 'Abrir sessão') podem andar com layout, hover e nudge, como a D-17 aceita; o resíduo vai para o checklist.

Observação sobre o modo MVP: o ROADMAP marca a fase como `mode: mvp`, mas o objetivo não está no formato "Como um..., quero..., para que...". Segui a mesma conduta da verificação da Fase 3 (também `mvp`, com objetivo no mesmo formato): verificação goal-backward pelo objetivo e pelos 5 critérios de sucesso do ROADMAP, sem a tabela de User Flow Coverage.

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidência |
|----|-------|--------|-----------|
| 1 | SC1 (SESS-01): um ponto por sessão no lugar do contador (cor = estado, pulso = pede permissão), ordem estável da mais antiga para a mais nova, nome do projeto da exibida sempre visível | ✓ VERIFIED | `pickState` devolve `sessions` ordenado por `byFirstSeen` (primeira aparição, empate pela chave), nunca por urgência; `renderSessions` cria um `button` por sessão em `#sessions`, escondido com menos de 2 ou mais de 8 (`MAX_SESSION_DOTS`, volta o `#count`); `button` de 16 px com `i` de 6 px e 9 px na atual; cor por `--running/--waiting/--done` (definições dessas variáveis não mudaram desde `c461158`); `data-pending` pulsa e vira anel com `prefers-reduced-motion`; `title.textContent` é o projeto com 2 ou mais sessões e o cabeçalho do pedido é `projeto · ferramenta`. Meu script: `firstSeen` fixa a ordem A,B,C mesmo com estados trocados. Tooltip nativo com o nome inteiro (WR-03). Aparência fica em `human_verification` |
| 2 | SC2 (SESS-02): a roda sobre a pílula troca a sessão sem dar a volta, com acúmulo, pausa entre passos e touchpad mais lento | ✓ VERIFIED (lógica pura) | `wheelStep` com 120, 220 ms, 85 ms e 200 ms (aviso MIT acima das constantes, `state.js` linhas 512 a 522); meu script: `wheelDeltaY` -120 vira `step 1` (próxima) e +120 vira `step -1` (anterior), `nextSelection` no fim da lista mantém a chave e no começo também; 14 vetores de `wheelStep` e 31 de `nextSelection` no fixture, todos passando. O caminho `island:wheel` no main é a truth 15; a chegada da roda ao SO é humana |
| 3 | SC2 (SESS-03): clicar num ponto leva àquela sessão | ✓ VERIFIED (lógica pura) | O renderer manda só `Number(button.dataset.index)` por `island:select`; o main exige `Number.isInteger(index)`, ilha não ociosa e troca por `nextSelection({type:'select'})` sobre a `lastSessionList` que os pontos mostram; índice inválido ou clique no ponto da exibida mantém. O `pointerdown` da pílula ignora `button`, então o clique no ponto não arrasta nem abre. Vetor `sessionSwitch` do clique passa |
| 4 | SC2: sobre o texto de um pedido a roda só rola o texto | ✓ VERIFIED | `permissionBox` (o `#permission` inteiro: ferramenta, texto e dica) chama `stopPropagation()` no `wheel` e o ouvinte da pílula ainda confere `event.target.closest('#permission')`; o `overscroll-behavior: contain` do texto segura o encadeamento. Dupla trava confirmada no `index.html` linhas 1012 a 1015 e 1310 a 1314 |
| 5 | SC3 (SESS-04): pedido novo leva a ilha à sessão uma vez, nunca no meio de um gesto; rolar para longe não puxa de novo; o ponto segue pulsando | ✓ VERIFIED (lógica pura) | Meu script: snap para C com `snapped true` e o pedido `handled`/`shown`; depois de `select` para B e de ciclos seguintes a seleção fica em B (`snapped false`); com roda a 200 ms o pedido fica `handled false` e só faz snap no ciclo depois dos 400 ms; `wheelLockedUntil` ignora a roda por 400 ms depois do snap (`main.js` linha 494); `userSwitched` evita desfazer a escolha do usuário (WR-02). O ponto de quem pede segue com `pending` |
| 6 | SC3 (SESS-06): "concluído" e "voltou a trabalhar" nunca trocam a sessão sozinhos | ✓ VERIFIED | `keyAfterPoll` mantém a chave enquanto ela está na lista (meu script: A segue exibida com B concluída e C esperando sem pedido, `snapped false`); a escolha por urgência só vale com `key === null`. D-21: o "concluído" exibido fica além dos 10 s com outra sessão viva (`aliveSessions` com `keptKey`) e, sozinho, vence e a ilha fica ociosa (meu script: `["A","B"]`, `["B"]` fora da exibição, `idle` sozinho) |
| 7 | SC4 (SESS-05): fila por chegada "N de M", o novo não substitui o que está sendo lido, ao responder vai ao próximo pendente | ✓ VERIFIED (lógica pura) | Meu script: com o pedido de C exibido, um novo em A entra na fila sem snap e `queue` vira `{position:1,total:2}`; respondido o de C, a seleção vai a A (`snapped true`); numa sessão sem pedido, nada se move. `#permission-queue` mostra "N de M". Ordem pelo primeiro instante visto no main (monotônico), empate pelo id |
| 8 | SC4: toda troca (roda, ponto, snap, fila, saída de fato) reinicia o armamento e Permitir/Negar atinge só o pedido na tela | ✓ VERIFIED | Sete vetores `sessionSwitch` (fixture) encadeiam `nextSelection`, `nextShownPermission` e `acceptDecision`: recusa `not-armed` aos 799 ms, aceita aos 800 ms e recusa `echo-mismatch` o eco do pedido anterior; troca para sessão sem pedido dá `nothing-shown`. A seleção só é atribuída a partir de `nextSelection` (trava de texto) e o pedido exibido só muda em `refresh`. `island:decide` continua usando só `shown.id` do main e o eco só recusa |
| 9 | SC5 (SESS-07): sessão morta sai da lista e o arquivo é apagado | ✓ VERIFIED | `isSessionDead` pura (meu script: `windowPid` com `isPidAlive false` morta; `true` viva, o caso EPERM; sem PID e recente viva; 13 h morta); `isPidAlive` só usa `process.kill(pid, 0)` e só `ESRCH` conta como morto; `readSessions` apaga o arquivo (`fs.rmSync`, nome vindo de `readdir` e `isSessionFile`) e segue; concluído recente de terminal vivo fica. Testes de `readSessions` em `vm` com disco falso passam |
| 10 | D-21: a saída de fato da sessão exibida vai ao pedido nunca exibido mais antigo, senão à vizinha na ordem estável (nunca à mais urgente), pulando pedido já deixado | ✓ VERIFIED | Meu script: B saindo vai à vizinha anterior A; A (a primeira) saindo vai à seguinte B; vetores de `nextSelection` cobrem o pedido nunca exibido, o pulo do já deixado e a exceção de todas deixadas; vetor `sessionSwitch` da saída de fato passa |
| 11 | D-09: o payload não leva chave de sessão, PID nem texto de pedido de outra sessão | ✓ VERIFIED | `pickState` devolve `sessions: [{state, pending, current}]` e `queue`; meu script com duas sessões esperando e PIDs 4321 e 8765: o PID e o id da outra não aparecem em lugar nenhum do payload; só o `windowPid` e o pedido da exibida (como antes da fase). `sendState` espalha `lastPickedState` sem as listas internas (`selection`, `lastSessionList` ficam no main) |
| 12 | D-20 (plano 05-01): âncora ao lado abaixo de 1220 DIP recusa a decisão e o renderer mostra "Responda no terminal" | ✓ VERIFIED | `fitsVisibleArea(island, display)` combina `isWithinWorkArea` e `besideFits` e alimenta os dois fatos (`fitsWorkArea` no `sendState` e `withinVisibleArea` no `island:decide`); vetores `besideDecision` (1093 e 1066 recusam, 1220 aceita) e `besideFits` passam; `BESIDE_MIN_WORK_AREA_WIDTH_PX = 2 × (210 + 400) = 1220`. O que o renderer mostra a 125% fica em `human_verification` |
| 13 | D-17 (estrutura): a mola de troca só move invólucros sem botão (`#lead`, `#detail`, `#permission`); pontos, 'Abrir', 'Abrir sessão', Permitir e Negar nunca recebem a transformação | ✓ VERIFIED | A regra CSS `#lead, #detail, #permission { translate; scale }` (linhas 274 e 275) é a única que lê `--tab-*`; no DOM (linhas 341 a 375) `#lead` contém só ícone e título, `#permission` só texto, `#sessions` e `#open-compact` ficam em `#side`, e `#allow`, `#deny` e `#open` em `#actions`; nenhum `button` está dentro dos três. Constantes da mola (250, 31, 34 px, 0,965) com aviso MIT acima; conteúdo trocado de forma atômica (sem segunda camada) |
| 14 | D-17 (comportamento): Permitir/Negar ficam desabilitados enquanto o conteúdo desliza | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `springs.tab` existe (linha 768), `allSpringsAtRest = Object.values(springs).every(isSpringAtRest)` (linha 849) e `waitUntilSettled` só arma com `canArm({settled, springsAtRest: allSpringsAtRest()})`; `canArm` puro tem vetores. Mas nenhum teste executa o laço do renderer com a mola de troca em movimento (só travas de texto). Ver `behavior_unverified_items` |
| 15 | Cola do `main.js`: `refresh()` encadeia `nextSelection`, `pickState`, `nextShownPermission`; `island:wheel` e `island:select` chegam a ele | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Li o código: ordem correta (`sessionList`, `nextSelection` com `userSwitched`, `lastSessionList`, `pickState`, `nextShownPermission`, comparação do payload inteiro antes do retorno antecipado), handlers validam (`Number.isInteger`, `Number.isFinite` e teto de 1200, `islandOf`, ociosa) e a revisão de código a rastreou de ponta a ponta sem achar caminho de bypass. Mas só travas de texto e duas execuções em `vm` (`readSessions`, `sendState`) cobrem a cola; nenhum teste roda `refresh` |
| 16 | Restrições vinculantes (CONTEXT e plano 05-07) | ✓ VERIFIED | Ver a tabela abaixo |

**Pontuação:** 14/16 truths verificadas; 2 present-but-behavior-unverified (truths 14 e 15); nenhuma falhou.

### Restrições vinculantes (truth 16)

| Restrição | Status | Evidência própria |
|-----------|--------|-------------------|
| Gate da Fase 2 inteiro: ordem de `acceptDecision` intacta | ✓ | Corpo de `acceptDecision`, `nextShownPermission` e `isWithinWorkArea` idênticos aos de `c461158` (extração por função e comparação de texto sem CR) |
| Fixture antigo byte a byte igual a `c461158` | ✓ | Os 17 grupos e chaves de `c461158` têm `JSON.stringify` idêntico no HEAD e a ordem das chaves antigas é prefixo da atual; 13 chaves novas só no fim (`besideDecision`, `besideMinWorkAreaWidthPx`, `besideFits`, `sessionSwitch`, `wheelStep`, `nextSelection` e as sete constantes) |
| CSP inalterada | ✓ | A `<meta>` de CSP é idêntica em `c461158`, `6741b25` e no HEAD (`default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'`) |
| Só `island:wheel` e `island:select` são canais novos | ✓ | `ipcMain.on` passou de 7 (`c461158`) para 9; `preload.js` ganhou só `selectSession` e `wheel` (diff conferido) |
| Cores de estado fixas | ✓ | Nenhuma definição de `--running`, `--waiting` ou `--done` aparece no diff do `index.html`; só usos nos pontos; `visual.test.js` passa |
| Aviso MIT sobre as constantes portadas | ✓ | `state.js` linhas 512 a 515 (gesto da roda), `index.html` linhas 504 a 506 (mola de troca) e 71 a 74 (lerp do acento) com `Copyright (c) 2026 devcode90` e referência ao `THIRD_PARTY_NOTICES.md` |
| `hook.js` e `permission-hook.js` intocados desde `c461158` | ✓ | `git diff c461158..HEAD` vazio para os dois; D-01: `hook.js:59` e `permission-hook.js:59` já gravavam o projeto, com trava de texto em `island.test.js:806` |
| Assinaturas de `anchorPosition` e `horizontalSlackFor` da Fase 6 | ✓ | Corpo idêntico ao de `6741b25` para `anchorPosition`, `horizontalSlackFor` e `menuTemplate` |
| `coexistence.test.js` passa | ✓ | 14 de 14 rodando o arquivo sozinho; também dentro da suíte de 500 |

### Prohibitions (ADR-550)

Os planos listam as proibições como texto, sem campo `verification`; trato todas como nível `test` e confiro o enforcement.

| Proibição | Status | Enforcement |
|-----------|--------|-------------|
| Troca de sessão fazer Permitir/Negar atingir pedido não visto (05-02, 03, 04, 06, 07) | resolvida | Sete vetores `sessionSwitch` (799 ms recusa, 800 aceita, eco antigo recusa); `shown` só muda em `refresh`; rearme por id, época e texto |
| Mandar ao renderer chave, PID ou texto de pedido de outra sessão | resolvida | Meu script (truth 11) e teste do payload sem chave |
| Aceitar do renderer outro dado que índice inteiro (select) ou número finito e limitado (wheel) | resolvida | `Number.isInteger`, `Number.isFinite` e `WHEEL_DELTA_MAX`; trava de texto dos dois handlers |
| Trocar sozinha por "concluído", "voltou a trabalhar" ou recência | resolvida | Truth 6 e vetores de SESS-06 |
| Cortar o nome da ferramenta do pedido | resolvida | CSS só corta `#permission-project`; `#permission-tool-name` não tem corte |
| Mover, escalar ou esmaecer botão na troca de sessão; manter camada antiga; animar com movimento reduzido | resolvida (estrutura) | Truth 13; troca atômica; `reducedMotion` leva as molas ao alvo. O laço em execução está na truth 14 |
| Puxar o mesmo pedido mais de uma vez; substituir o que se lê; reexibir ilha escondida | resolvida | `handled`/`shown` por pedido; ramo da fila só com pedido exibido saído; `refresh` não chama `show` (trava de texto) |
| Apagar arquivo de sessão viva; sinal que afete outro processo | resolvida | Só `ESRCH` ou mais de 12 h; `process.kill(pid, 0)`; EPERM e erro desconhecido contam como vivo |
| Mudar ordem de `acceptDecision` ou vetor antigo; reescrever história no merge; aceitar decisão com âncora ao lado abaixo de 1220 | resolvida | Comparações com `c461158`; merge `ca1438c` sem rebase; vetores `besideDecision` |
| Roda, clique ou tecla sintética para janela de outro app | resolvida | Nenhum `sendInputEvent` nem `SendInput` no código novo; nada foi enviado nesta verificação |

### Required Artifacts

| Artefato | Esperado | Status | Detalhes |
|----------|----------|--------|----------|
| `state.js` | `sessionList`, `nextSelection`, `pickState` com seleção, `wheelStep`, `isSessionDead`, `besideFits`, constantes de gesto e snap | ✓ VERIFIED | Substantivo, exportado e usado por `main.js` e pelos testes |
| `main.js` | `selection`, `lastSessionList`, `firstSeenAtByKey`, `lastGoodSessionByKey`, `isPidAlive`, `fitsVisibleArea`, handlers `island:select` e `island:wheel` | ✓ VERIFIED | Ligados em `refresh` e `registerIpcHandlers` |
| `preload.js` | `selectSession`, `wheel` | ✓ VERIFIED | Duas linhas novas, nada mais |
| `index.html` | `#sessions`, `renderSessions`, `sessionSwitchDirection`, `#permission-queue`, mola `SPRING_TAB`, `@property --accent` | ✓ VERIFIED | Presentes e ligados (`onState`, `applySprings`) |
| `fixtures/permission-vectors.json` | grupos `sessionSwitch` (7), `wheelStep` (14), `nextSelection` (31), `besideDecision`, `besideFits` e constantes | ✓ VERIFIED | Percorridos por `gate.test.js` |
| `island.test.js`, `gate.test.js` | testes e travas das regras novas | ✓ VERIFIED | 500 testes passam |
| `README.md` | seção "Várias sessões" com "Rolar janelas inativas" | ✓ VERIFIED | Linhas 87 a 129 |
| `THIRD_PARTY_NOTICES.md` | crédito do mod | ✓ VERIFIED | Texto MIT, versão e titular existem; a lista "o que o Claude Island toma do mod" agora nomeia as regras de gesto da roda, a mola de troca de sessão e a transição da cor do acento (commit `265fc56`, conferido no arquivo) |

### Key Link Verification

| De | Para | Via | Status | Detalhes |
|----|------|-----|--------|----------|
| `index.html` | `main.js` | clique no ponto → `window.island.selectSession` → `island:select` → `nextSelection` → `refresh('select')` | WIRED | Linhas 1222, `preload.js:8`, `main.js:710` a `715` |
| `index.html` | `main.js` | roda → `window.island.wheel` → `island:wheel` → `wheelStep` → `nextSelection` → `refresh('wheel')` | WIRED | `index.html:1310` a `1314`, `preload.js:9`, `main.js:721` a `733` |
| `main.js` | `state.js` | `refresh` → `sessionList` → `nextSelection(poll)` → `pickState(sessions, now, selection)` | WIRED | `main.js:477` a `498` |
| `state.js` | `index.html` | `pickState` → `queue` → `#permission-queue` | WIRED | `index.html:951` a `952` |
| `index.html` | `index.html` | `onState` → `sessionSwitchDirection` → `springs.tab` → `allSpringsAtRest` → `canArm` | WIRED (execução não provada) | Truth 14 |
| `main.js` | `state.js` | `readSessions` → `isSessionDead(session, now, isPidAlive)` → `fs.rmSync` | WIRED | `main.js:379` a `386` |
| `main.js` | `index.html` | `sendState` → `fitsWorkArea` (de `fitsVisibleArea`) → "Responda no terminal" | WIRED | `main.js:464` a `467` |

### Data-Flow Trace (Level 4)

| Artefato | Variável | Fonte | Dados reais | Status |
|----------|----------|-------|-------------|--------|
| `renderSessions` | `current.sessions` | `pickState` sobre `readSessions` (arquivos de `~/.claude/island/`) | Sim | ✓ FLOWING |
| `permissionQueue` | `current.queue` | `queuePosition` sobre `selection.requests` do poll | Sim | ✓ FLOWING |
| `title` e `permissionProject` | `current.project` | `hook.js` grava `path.basename(cwd)` em todo evento | Sim | ✓ FLOWING |
| `springs.tab` | direção da troca | `sessionSwitchDirection(current.sessions, next.sessions)` | Sim | ✓ FLOWING |

### Behavioral Spot-Checks

| Comportamento | Comando | Resultado | Status |
|---------------|---------|-----------|--------|
| Suíte completa | `node --test` (uma vez) | 500 passam, 0 falham | ✓ PASS |
| Convivência | `node --test coexistence.test.js` | 14 de 14 | ✓ PASS |
| Seleção, roda, snap, fila, saída, D-21, payload e sessão morta | script próprio de 19 cenários sobre `state.js` | Todos conforme a CONTEXT (ver truths 2 a 11) | ✓ PASS |
| Fixture antigo e funções do gate | extração por função e comparação com `c461158` e `6741b25` | Idênticos | ✓ PASS |

### Probe Execution

SKIPPED: a fase não declara probes (`scripts/*/tests/probe-*.sh`).

### Requirements Coverage

| Requisito | Plano de origem | Descrição | Status | Evidência |
|-----------|-----------------|-----------|--------|-----------|
| SESS-01 | 05-02 | Pontos por sessão, cor, pulso, ordem estável, projeto visível | ✓ SATISFIED (aparência humana) | Truth 1 |
| SESS-02 | 05-03, 05-06, 05-07 | Roda sobre a pílula troca a sessão, sem volta, regras do mod | ✓ SATISFIED (entrega da roda ao SO humana) | Truths 2, 4 e 13 |
| SESS-03 | 05-02, 05-06, 05-07 | Clicar num ponto leva à sessão | ✓ SATISFIED | Truth 3 |
| SESS-04 | 05-04, 05-07 | Snap uma vez por pedido, nunca no meio do gesto | ✓ SATISFIED (cola em `human_verification`) | Truth 5 |
| SESS-05 | 05-04, 05-07 | Fila "1 de N", o novo não substitui, avança ao responder | ✓ SATISFIED (cola em `human_verification`) | Truths 7 e 8 |
| SESS-06 | 05-02, 05-04, 05-05 | Troca automática só por pedido de permissão | ✓ SATISFIED | Truths 6 e 10 |
| SESS-07 | 05-05 | Sessão morta sai e o arquivo é apagado | ✓ SATISFIED | Truth 9 |
| SEG-06 (plano 05-01) | 05-01 | Fora da área visível não aceita decisão (âncora ao lado em tela estreita) | ✓ SATISFIED | Truth 12 |

Os 7 IDs SESS-01 a SESS-07 aparecem no frontmatter dos planos (05-02: 01, 03, 06; 05-03: 02; 05-04: 04, 05, 06; 05-05: 07, 06; 05-06: 02, 03; 05-07: 02 a 05) e o `REQUIREMENTS.md` mapeia exatamente esses 7 para a Fase 5. Nenhum requisito órfão. Observação de rastreabilidade: o `REQUIREMENTS.md` ainda mostra SESS-01 a SESS-07 como `[ ]`/`Pending` e a linha da Fase 5 do `ROADMAP.md` está como `In Progress`; o orquestrador atualiza isso ao fechar a fase, como na Fase 3.

### Anti-Patterns Found

| Arquivo | Linha | Padrão | Severidade | Impacto |
|---------|-------|--------|------------|---------|
| (nenhum) | - | `TBD`, `FIXME`, `XXX` em `state.js`, `main.js`, `index.html` e `preload.js` | - | Nenhum marcador de dívida |
| `THIRD_PARTY_NOTICES.md` | 12 | A lista do que se toma do mod não nomeava as regras de gesto da roda nem o lerp do acento | ✅ Resolvido | Corrigido em `265fc56`: a linha 12 agora cita "regras de gesto da roda, mola de troca de sessão e transição da cor do acento"; reconferido no arquivo e fingerprint recalculado |
| `state.js` | 424 | IN-02 do review (aberto): o avanço da fila vai ao mais antigo restante mesmo que já tenha sido exibido e deixado | ℹ️ Info | Segue a D-14 ao pé da letra; rearma como toda troca; o README diz "mais antigo restante" |
| `state.js` | 286, 371 | IN-01 e IN-05 do review (abertos): ordem arbitrária por UUID de pedidos simultâneos na subida e comparador duplicado | ℹ️ Info | Só afeta a ordem do "N de M" e do primeiro snap depois de reiniciar a ilha |
| `index.html` | 894 a 911 | IN-07 do review (aberto): `replaceChildren` dos pontos pode perder um clique se o estado mudar entre `pointerdown` e `pointerup` | ℹ️ Info | Só um clique de ponto perdido; sem efeito no gate |
| `index.html` | 1312 | IN-03 do review (aberto): a reserva `wheelDeltaY \|\| -deltaY × 1,2` é inalcançável no Chromium do Electron | ℹ️ Info | Inofensiva (delta 0 não gera passo) |
| `island.test.js`, `gate.test.js` | vários | IN-04 do review (aberto): rótulos `D-xx` de testes colidem com os de fases anteriores | ℹ️ Info | Só legibilidade |

Sem stubs: os retornos vazios e valores iniciais (`selection`, `lastSessionList`, `current`) são estado inicial sobrescrito por dados reais, como o Data-Flow Trace mostra.

### Achados do code review

Os 4 WR do `05-REVIEW.md` foram corrigidos e conferidos no código atual: WR-01 (`lastGoodSessionByKey` em `readSessions`, `a823c8e`), WR-02 (`userSwitched` em `refresh` e `pollSelection`, `dafcbe4`), WR-03 (`title` nativo no título e no projeto do pedido, README e `ponytail:`, `60d6f27`) e WR-04 (`shouldChime = isFirstIsland && !userSwitched` e `chime()` em `try/catch`, `c023d69`). O WR-03 não resolve o corte no fim com dois projetos de prefixo comprido igual: mitigado por tooltip, que numa janela sem foco só aparece se o sistema o desenhar. Está registrado em `ponytail:` e no README, então é limite aceito, não gap. WR-01 e WR-02 mudaram lógica e pedem olhada humana (itens da lista).

### Human Verification Required

Os 8 itens estão no frontmatter (`human_verification`), mais os 2 de `behavior_unverified_items`. Nenhum é bloqueante para o merge além do que o autor já tratou no checklist do 05-07-SUMMARY.md; o mais sensível é a chegada da roda à janela sem foco ("Rolar janelas inativas"), porque dele depende a metade do SESS-02, embora o clique no ponto continue trocando a sessão sem ela.

### Gaps Summary

Nenhum gap bloqueante: nenhuma truth falhou, nenhum artefato é stub ou está desligado, nenhum link está quebrado, as proibições têm enforcement e as restrições vinculantes foram conferidas por comparação com `c461158` e `6741b25`.

Um aviso (WARNING, não gap): a cola do processo principal (`refresh()` e os dois handlers novos) e o laço de molas do renderer com a mola de troca só têm travas de texto, mais as execuções em `vm` de `readSessions` e `sendState`. Os vetores provam as funções puras na ordem do main, não a ordem real das chamadas. Eu executei as funções puras com cenários próprios e li a cola, e ela está certa, mas uma mutação na cola que preserve o texto travado ainda sobreviveria à suíte, o mesmo ponto registrado nas verificações das Fases 2 e 3. Vale um teste `node:vm` do `refresh` com disco, relógio e `BrowserWindow` falsos numa fase futura.

---

_Verificado: 2026-11-21_
_Verificador: Claude (gsd-verifier)_
