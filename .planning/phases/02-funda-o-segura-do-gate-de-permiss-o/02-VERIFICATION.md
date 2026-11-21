---
phase: 02-funda-o-segura-do-gate-de-permiss-o
verified: 2026-11-21T06:10:00Z
status: human_needed
score: 7/11 must-haves verified
covered_files:
  - .planning/phases/02-funda-o-segura-do-gate-de-permiss-o/02-01-PLAN.md
  - .planning/phases/02-funda-o-segura-do-gate-de-permiss-o/02-01-SUMMARY.md
  - .planning/phases/02-funda-o-segura-do-gate-de-permiss-o/02-02-PLAN.md
  - .planning/phases/02-funda-o-segura-do-gate-de-permiss-o/02-02-SUMMARY.md
  - .planning/phases/02-funda-o-segura-do-gate-de-permiss-o/02-03-PLAN.md
  - .planning/phases/02-funda-o-segura-do-gate-de-permiss-o/02-03-SUMMARY.md
  - .planning/phases/02-funda-o-segura-do-gate-de-permiss-o/02-04-PLAN.md
  - .planning/phases/02-funda-o-segura-do-gate-de-permiss-o/02-04-SUMMARY.md
  - THIRD_PARTY_NOTICES.md
  - fixtures/permission-vectors.json
  - gate.test.js
  - index.html
  - main.js
  - preload.js
  - state.js
covered_digest: "v4:sha256:e4d36edb97615e9912e34550c6b3520ea4d39f2a5fc46081b29f544fca3fd0a0"
behavior_unverified: 4
overrides_applied: 0
deferred:
  - truth: "Ilha em tela cheia não aceita decisão (sonda real de tela cheia; hoje coveredByFullscreen é a constante false)"
    addressed_in: "Phase 4"
    evidence: "ROADMAP Phase 4, critério 5 e requisito TELA-01/TELA-02: 'No Windows, quando um app ocupa o monitor inteiro a ilha daquele monitor some e volta quando ele sai ... um pedido de permissão nessa hora só toca o som'"
  - truth: "Prova ponta a ponta de que esconder nunca aprova e de que reexibir de verdade rearma (não há UI de esconder nesta fase)"
    addressed_in: "Phase 4"
    evidence: "ROADMAP Phase 4, critério 4: 'esconder nunca aprova nada e reexibir rearma os botões'"
  - truth: "effectiveOpacity sem consumidor em tempo de execução (transparência 100/85/70/55% nunca vale com pedido na tela)"
    addressed_in: "Phase 4"
    evidence: "ROADMAP Phase 4, critério 4 e PREF-06: 'a transparência de 100/85/70/55% nunca vale com pedido na tela'"
behavior_unverified_items:
  - truth: "SC2 — armamento do renderer: botões desarmados por 0,8 s, só armam com a caixa dos botões assentada e cursor parado, sem ampliação de hover, clique no mesmo botão, duas ilhas com primeiro clique vencendo"
    test: "UAT-2 e UAT-4 (ver human_verification)"
    expected: "Clique antes de 0,8 s ou com o cursor recém-movido é descartado; clique que arrasta de um botão para outro é descartado; só uma decisão sai com duas ilhas"
    why_human: "A cola de DOM (requestAnimationFrame, ResizeObserver, eventos de ponteiro) e o handler island:decide do main só rodam dentro do Electron; os predicados puros têm vetores, a cola que os chama não tem teste (mutações nela sobrevivem à suíte)"
  - truth: "SC3 — roda só rola o texto, inércia dos 400 ms não conta como leitura, 'lido' zera por pedido, pilula 100% opaca com pedido"
    test: "UAT-5 e UAT-6 (ver human_verification)"
    expected: "Permitir não libera sozinho por inércia; texto longo exige rolar até o fim; pedido novo volta a exigir; pílula opaca"
    why_human: "Eventos de roda reais e aparência só existem no Electron; canMarkRead e isWheelSettled têm vetores, o listener de roda e o layout não têm teste"
  - truth: "02-02 — refresh('rearm') reenvia o estado às ilhas com armEpoch novo mesmo sem mudança nas sessões, e reexibir/restaurar/mudar de monitor faz o main recusar decisão nos 800 ms seguintes"
    test: "UAT-3 (pedido B logo após A) e, na Fase 4, esconder e reexibir de verdade"
    expected: "Decisão chegando nos 800 ms após a troca ou o rearme é recusada pelo main"
    why_human: "O retorno antecipado de refresh e o armEpoch no payload são cola do main sem teste (a mutação que engole o rearme sobrevive à suíte); só o reducer nextShownPermission e a existência dos ganchos têm teste"
  - truth: "CR-01 — a janela da ilha não navega ao soltar link ou arquivo e todo canal IPC recusa remetente que não é o index.html no frame principal"
    test: "Ver human_verification: botões continuam funcionando sob a conferência de URL; soltar um link ou arquivo na pílula não faz nada"
    expected: "Permitir e Negar funcionam (URL confere); soltar um link ou arquivo não navega a janela"
    why_human: "will-navigate, setWindowOpenHandler e event.senderFrame.url só existem em tempo de execução do Electron; a URL conferida (pathToFileURL) contra a que o Chromium reporta só se prova rodando (falha segura: se divergir, todo clique é recusado)"
human_verification:
  - test: "UAT-1 (sandbox e preload): subir a ilha (pnpm start) e, com ela no ar, disparar `echo '{\"session_id\":\"uat-a\",\"hook_event_name\":\"PermissionRequest\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"echo A\"},\"cwd\":\".\"}' | node permission-hook.js`. Combinar horário com a sessão da Fase 1, que mede a ilha em execução."
    expected: "A ilha sobe sob contextIsolation, sandbox e nodeIntegration=false explícitos, mostra o pedido e responde: após armar e clicar Permitir, o stdout do hook imprime a decisão allow (nada se imprimir antes de clicar; se ninguém clicar em 5 min, o hook sai calado)"
    why_human: "Precisa do Electron rodando; o executor e este verificador não o iniciam"
  - test: "UAT-2 (armamento): com um pedido na tela, mover o cursor para o botão antes de 0,8 s e clicar o mais cedo possível; depois mover o cursor para o botão e clicar em menos de 200 ms; depois parar 0,3 s sobre o botão e clicar; por fim passar o mouse sobre Permitir e Negar sem clicar"
    expected: "Os dois primeiros cliques são descartados (nada no stdout do hook); o terceiro vale; os botões não ganham ampliação ao passar o mouse (só um leve brilho)"
    why_human: "Timing e layout reais do renderer; não há teste da cola de DOM"
  - test: "UAT-3 (pedido muda no clique): com o pedido A armado, disparar o pedido B (session_id uat-b, command echo B) e clicar logo em seguida"
    expected: "Nada vale para A nem para B; depois do rearme de B (0,8 s), clicar responde só B (o stdout de uat-b mostra a decisão; o de uat-a não)"
    why_human: "Corrida real entre troca de pedido e clique"
  - test: "UAT-4 (duas ilhas, exige 2 monitores): com a ilha em dois monitores mostrando o mesmo pedido, clicar Permitir numa e Negar na outra em sequência rápida"
    expected: "O stdout do hook mostra uma única decisão, a do primeiro clique; a outra ilha trava os botões logo depois"
    why_human: "Corrida real entre duas janelas Electron em dois monitores"
  - test: "UAT-5 (roda): chegar um pedido com texto longo (várias linhas) e rolar rápido no touchpad no instante em que ele aparece; repetir com texto curto"
    expected: "Permitir não libera sozinho pela inércia; texto longo só libera após rolar até o fim depois de ~0,4 s; um pedido novo volta a exigir a leitura; a roda sobre o texto nunca desloca outra coisa; texto curto vira lido sozinho depois da janela"
    why_human: "Eventos de roda reais e inércia de touchpad"
  - test: "UAT-6 (opacidade): com um pedido de permissão na tela, olhar a pílula sobre um fundo claro e um escuro"
    expected: "A pílula está 100% opaca (a transparência configurável só chega na Fase 4)"
    why_human: "Verificação visual"
  - test: "Revisão CR-01 — botões sob a conferência de URL: repetir o UAT-1 e confirmar que Permitir e Negar funcionam de fato (clicar e ver a decisão no stdout)"
    expected: "A decisão chega ao hook. Se a URL que o Chromium reporta divergisse da conferida, todo clique seria recusado em silêncio e o botão voltaria a destravar (falha segura)"
    why_human: "event.senderFrame.url só existe em tempo de execução"
  - test: "Revisão CR-01 — navegação: arrastar um link do navegador e um arquivo .html do Explorer para cima da pílula (e, no Linux, para qualquer ponto da janela transparente)"
    expected: "Nada acontece: a janela continua na ilha, sem nova página nem nova janela"
    why_human: "Arrastar e soltar real; will-navigate só dispara em tempo de execução"
  - test: "Revisão WR-01 — recusa destrava: pedir Permitir durante o rearme (por exemplo, clicar no instante em que um segundo pedido chega ou em que a ilha muda de monitor) e observar os botões"
    expected: "Se o main recusou, os botões voltam a destravar depois do próximo island:state e rearmam (não ficam travados para sempre); o renderer nunca reenvia sozinho"
    why_human: "Depende do ciclo real main/renderer"
  - test: "Revisão WR-02 — botões que se movem: com um pedido na tela, fazer o botão 'Abrir sessão' aparecer ou sumir (ex.: sessão que ganha windowPid) ou rolar o texto até o fim (a dica 'Role até o fim' some e o layout muda)"
    expected: "Os botões voltam a desarmar e só rearmam 0,8 s depois, com o layout assentado; um clique no pointerdown com os botões fora do lugar em que armaram é descartado"
    why_human: "Layout real do renderer"
  - test: "Aviso de licença (informativo, opcional): conferir se `Copyright (c) 2026 devcode90` ainda é a linha do LICENSE em github.com/devcode90/Dynamic-Island-for-Windows"
    expected: "Linha igual à de THIRD_PARTY_NOTICES.md. A pesquisa registrou a conferência por gh api (blob 30ee69c1...); este verificador não chamou API de terceiros"
    why_human: "Fonte externa; reconferência independente da pesquisa"
---

# Fase 2: Verificação da fundação segura do gate de permissão

**Objetivo da fase:** Permitir/Negar só pode atingir o pedido que o usuário estava vendo, comprovado por testes, antes de qualquer feature mudar o que aparece na tela, e o repositório está pronto para receber constantes portadas do mod
**Verificado em:** 2026-11-21T06:10:00Z
**Status:** human_needed
**Re-verificação:** Não, verificação inicial

## Resumo

Nenhuma verdade da fase falhou: a regra de aceite, o caminho único do pedido exibido, o aviso de licença, as `webPreferences` e a lista fechada de canais existem, estão ligados e passam em `node --test` (162/162, 149 em `gate.test.js`). O status é `human_needed` por dois motivos independentes. Primeiro, os UAT-1..6 e os checks das correções da revisão exigem o Electron rodando e cliques reais, e nem o executor nem este verificador o iniciam. Segundo, e mais importante para a leitura do objetivo "comprovado por testes", a prova automática cobre as **regras puras** e travas de fonte, mas **não a cola** que as chama no `main.js` e no renderer: uma bateria de mutações que apliquei numa cópia isolada mostrou que 23 de 26 regressões nessa cola sobrevivem à suíte (detalhes em "Buraco de cobertura").

## Conquista do objetivo

### Verdades observáveis

Contrato do roadmap (critérios 1 a 5), mais as verdades dos planos que o roadmap não cobre sozinho.

| # | Verdade | Status | Evidência |
|---|---------|--------|-----------|
| 1 | SC1: com dois pedidos em sequência ou o pedido mudando no clique, Permitir/Negar só atinge o pedido na tela; eco divergente recusa; o renderer nunca escolhe o alvo; o pedido exibido só muda por um caminho no main | ✓ VERIFIED | `state.js:132-150` `acceptDecision` devolve `permissionId: shownId` e recusa `echoedId !== shownId` (igualdade estrita); 39 vetores incluindo "pedido mudou no instante do clique" (eco A, shown B, 10 000 ms) e "pedido novo logo após o clique" (100 ms). `main.js:309-341` monta o veredito com `shownId: shown.id` e `echoedId: pressedId`; `shown =` só em `main.js:42` (declaração) e `main.js:187` (dentro de `refresh`), travado por teste de fonte. A passagem dos argumentos no handler foi lida por mim e não tem trava de teste (ver buraco de cobertura) |
| 2 | SC2: botões desarmados por 0,8 s após qualquer troca, só armam com a transição assentada e o cursor parado; sem ampliação de hover; clique que começa num botão e termina noutro (ou noutro pedido) é descartado; com duas ilhas só o primeiro clique vale | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Presente e ligado: `index.html:257-289` (`settleStep`, `canPress`, `isValidRelease`, 36 vetores no vm), `restartArming`/`waitUntilSettled` (`:407-454`), `pointerdown`/`click` com `armToken` (`:466-493`), `buttonsRect()` (WR-02); CSS dos botões só com `filter`, sem `transform` (`:163-170`); main recusa `already-decided` (`main.js:47,335`). Nenhum teste exercita a cola de DOM nem o handler do main: mutações como `echoedId: shown.id`, remover `isValidRelease`, `transform: scale` no hover e `decidedId: null` sobrevivem à suíte. Vai a UAT-2/3/4 |
| 3 | SC3: pedido na tela = ilha 100% opaca; roda sobre o texto só rola o texto; 'lido' zera por pedido; inércia dos 300-400 ms não conta; ilha escondida, em tela cheia ou fora da área não aceita decisão; esconder nunca aprova; reexibir rearma | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Regras puras com vetores: `isWheelSettled`, `canMarkRead`, `effectiveOpacity` (11 vetores), recusas `window-hidden`/`covered-by-fullscreen`/`outside-visible-area` com fato ausente recusando. Cola presente: listener `wheel` `{ passive: false }` (`index.html:400-403`), `overscroll-behavior: contain` (`:153`), `readPermissionId === permission.id` (`:387`), `main.js:212-213` `show`/`restore` rearmam. Sem teste da cola (mutações `wheel nao bloqueia`, `wheel propaga`, `lido nao zera por pedido` sobrevivem). Partes adiadas por decisão dos planos estão em "Itens adiados". UAT-5/6 |
| 4 | SC4: a regra de aceite é função pura com vetores em `fixtures/permission-vectors.json`; `island:decide` deixa de ser o único ponto sem teste; janelas com `contextIsolation` e `sandbox` e sem `nodeIntegration`; sem canal do renderer para gravar preferências | ✓ VERIFIED | Fixture JSON puro com 10 grupos de vetores (`acceptDecision` 39, `isWithinWorkArea` 18, `nextShownPermission` 9, `isIslandSender` 14, predicados do renderer, `effectiveOpacity` 11); `gate.test.js` roda cada vetor. `SECURE_WEB_PREFERENCES` congelado em `state.js:288`, espalhado por último em `main.js:206`. Lista fechada: 7 canais no `preload.js`, 6 `ipcMain.on` no `main.js` (conferidos por grep), travada por teste que também recusa `.ipc`/`ipc-message`, aliases e canais em variável. Mutação `webPreferences sem sandbox spread` morta pelo teste |
| 5 | SC5: `THIRD_PARTY_NOTICES.md` credita o mod com MIT completo, versão 1.4.0 e titular conferido; existe antes do primeiro commit com constantes portadas | ✓ VERIFIED | Arquivo na raiz com `Copyright (c) 2026 devcode90`, `1.4.0`, URL do repositório, corpo MIT idêntico ao do `LICENSE` (o teste compara) e a paleta Nord. Commit `c36ae39` (2026-11-21); nenhum commit anterior ou posterior porta constante do mod (só `cubic-bezier` preexistente do projeto). O titular foi conferido pela pesquisa por `gh api` (blob `30ee69c1...`); eu não repeti a chamada (API de terceiros) e deixo a reconferência como item informativo |
| 6 | 02-01: regra pura de aceite — alvo é `shown.id`; eco ausente/outro tipo/outra caixa recusa; 799 ms recusa, 800 ms aceita, relógio para trás recusa; `already-decided`; janela invisível, fora da área (folga de 2 px) ou coberta recusa; fato ausente recusa | ✓ VERIFIED | `node --test gate.test.js`: 149 testes, 0 falhas. Ordem das checagens fixada pelos vetores e por teste de integridade (todo motivo de `acceptReasons` tem vetor). `PERMISSION_ARM_MS === armMs` testado |
| 7 | 02-02: reducer `nextShownPermission` (só id novo ou `rearm === true` reinicia `since` e sobe `epoch`); atribuição única de `shown` dentro de `refresh`; ganchos `show`, `restore` e `display-*` ligados a `refresh('rearm')` | ✓ VERIFIED | 9 vetores do reducer; teste de fonte I2 (declaração `let shown = {`, uma atribuição `shown = nextShown;` dentro de `refresh`, sem escrita de campo, `Object.assign` etc.); `main.js:212,213,356`. Mutação `show nao rearma` morta |
| 8 | 02-02: `refresh('rearm')` reenvia o estado com `armEpoch` novo mesmo sem mudança nas sessões (o retorno antecipado não engole o rearme) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `main.js:183` (`serialized === lastSent && nextShown.epoch === shown.epoch`) e `main.js:166` (`armEpoch: shown.epoch`) corretos na leitura, mas é invariante de ordem/estado sem teste: trocar a condição para só olhar o estado, ou zerar `armEpoch`, sobrevive à suíte |
| 9 | 02-03: predicados do renderer (`settleStep`, `canPress`, `isValidRelease`, `isWheelSettled`, `canMarkRead`) são funções puras cobertas por vetores num contexto `node:vm` vazio; o script inline inteiro compila | ✓ VERIFIED | `loadRendererRules()` exige cada marcador uma vez e executa o bloco em `Object.create(null)`; 42 vetores dos cinco predicados; teste `o script inline do index.html compila inteiro` (WR-04); trava de CSP exata |
| 10 | 02-04: aviso de licença antes das constantes portadas; `SECURE_WEB_PREFERENCES` e lista de canais travados; `effectiveOpacity` devolve 1 com pedido na tela ou fato desconhecido | ✓ VERIFIED | `THIRD_PARTY_NOTICES.md` (53 linhas); `state.js:260-264` (`hasPermission !== false` devolve 1); 11 vetores; testes de `webPreferences` e canais. Consumidor da opacidade adiado à Fase 4 |
| 11 | CR-01 (revisão): a janela da ilha não navega (`will-navigate`, `will-redirect`, `setWindowOpenHandler` negam), carrega por `loadURL(ISLAND_URL)` e todo `ipcMain.on` confere o remetente por `islandOf(event)`/`isIslandSender` | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `main.js:216-218,225,253-258`; `isIslandSender` com 14 vetores; teste de fonte confere os três guards, ausência de `loadFile(` e que os 6 handlers chamam `islandOf(event)`. A conferência da URL que o Chromium reporta contra `pathToFileURL` e o bloqueio de arrastar e soltar só se provam em execução (falha segura: URL divergente recusa todo clique) |

**Placar:** 7/11 verdades verificadas (1, 4, 5, 6, 7, 9 e 10); as 4 restantes (2, 3, 8 e 11) estão PRESENT_BEHAVIOR_UNVERIFIED. `behavior_unverified: 4`. As verdades 6 e 10 agrupam os itens do plano 02-01 e do plano 02-04, respectivamente.

### Itens adiados

Deliberados nos planos e confirmados no roadmap das fases seguintes. Não contam como lacuna desta fase e não estão marcados como satisfeitos.

| # | Item | Tratado em | Evidência |
|---|------|------------|-----------|
| 1 | Sonda real de tela cheia (`coveredByFullscreen` é a constante `false`, com comentário `ponytail:` citando TELA-01, `main.js:321-322`); o contrato e os vetores já existem | Phase 4 | Critério 5: 'quando um app ocupa o monitor inteiro a ilha daquele monitor some ... um pedido nessa hora só toca o som' |
| 2 | Prova ponta a ponta de que esconder nunca aprova e reexibir de fato rearma (não existe UI de esconder) | Phase 4 | Critério 4: 'esconder nunca aprova nada e reexibir rearma os botões' |
| 3 | `effectiveOpacity` sem consumidor em tempo de execução | Phase 4 | Critério 4 e PREF-06: 'a transparência de 100/85/70/55% nunca vale com pedido na tela' |

### Artefatos exigidos

| Artefato | Esperado | Status | Detalhes |
|----------|----------|--------|----------|
| `fixtures/permission-vectors.json` | Vetores JSON puros reaproveitáveis | ✓ VERIFIED | 1833 linhas; `version`, `armMs`, `acceptReasons` (8) e 10 grupos de vetores; sem `undefined` (caso "ausente" = chave omitida) |
| `gate.test.js` | Suíte do gate guiada pelos vetores | ✓ VERIFIED | 284 linhas, 149 testes verdes |
| `state.js` | `acceptDecision`, `isWithinWorkArea`, `nextShownPermission`, `effectiveOpacity`, `isIslandSender`, `SECURE_WEB_PREFERENCES` | ✓ VERIFIED | Funções puras, sem lançar, todas no único `module.exports` |
| `main.js` | Handler fino, `decidedPermissionId`, funil `refresh`, `webPreferences` seguras, travas de navegação | ✓ VERIFIED (cola sem teste, ver abaixo) | Wired: importa e usa `acceptDecision`, `isWithinWorkArea`, `nextShownPermission`, `SECURE_WEB_PREFERENCES`, `isIslandSender` |
| `preload.js` | `decide(behavior, pressedId)` repassando o eco | ✓ VERIFIED | `preload.js:7`; 7 canais |
| `index.html` | Bloco `regras-do-gate` e cola de armamento, press/release e roda | ✓ VERIFIED | Marcadores 1x cada; `@keyframes glow` da Fase 1 intacto (1 ocorrência) |
| `THIRD_PARTY_NOTICES.md` | Aviso MIT do mod e da Nord | ✓ VERIFIED | Existe, comparado ao `LICENSE` pelo teste |

### Verificação de ligações

| De | Para | Via | Status | Detalhes |
|----|------|-----|--------|----------|
| `index.html` | `preload.js` | `window.island.decide(behavior, pressed.id)` | ✓ WIRED | `index.html:490`, único ponto de saída da decisão |
| `preload.js` | `main.js` | `ipcRenderer.send('island:decide', behavior, pressedId)` | ✓ WIRED | `preload.js:7` → `main.js:309` |
| `main.js` | `state.js` | `acceptDecision(...)`, `isWithinWorkArea(...)`, `nextShownPermission(...)` | ✓ WIRED | `main.js:313,323,182` |
| `main.js` | `index.html` | `armEpoch` e `answeredId` em `island:state` | ✓ WIRED | `main.js:166` consumido em `index.html:521-545` |
| `gate.test.js` | fixture, `main.js`, `index.html`, `preload.js`, `THIRD_PARTY_NOTICES.md`, `LICENSE` | `require` e leituras de fonte | ✓ WIRED | Cada grupo do fixture tem um `test()` por vetor |

### Trace de fluxo de dados (Nível 4)

| Artefato | Variável | Fonte | Dados reais | Status |
|----------|----------|-------|-------------|--------|
| `index.html` `render` | `current.permission`, `armEpoch`, `answeredId` | `island:state` ← `refresh` ← `readSessions()` (arquivos em `~/.claude/island/`) + `shown`/`decidedPermissionId` | Sim | ✓ FLOWING |
| `main.js` handler | `shown.id`, `shown.since` | `refresh` ← `pickState(readSessions())` | Sim | ✓ FLOWING |
| decisão gravada | `decisions/<id>.json` | `writeDecision(verdict.permissionId, ...)` com id do main | Sim (nunca o id do renderer) | ✓ FLOWING |

### Verificações de comportamento (spot-checks)

| Comportamento | Comando | Resultado | Status |
|---------------|---------|-----------|--------|
| Suíte completa passa | `node --test` | 162 testes, 0 falhas | ✓ PASS |
| Suíte do gate passa | `node --test gate.test.js` | 149 testes, 0 falhas | ✓ PASS |
| Fixture bate com a regra (`armMs`, motivos) | testes `o tempo de armamento...` e `o fixture não tem motivo...` | verdes | ✓ PASS |
| Hooks inalterados | `git diff --name-only 2530f30..HEAD -- hook.js permission-hook.js install.js` | sem saída | ✓ PASS |
| Cola de `main.js` e `index.html` travada por testes | bateria de 26 mutações numa cópia isolada (ver abaixo) | 3 mortas, 23 sobreviveram (com a linha de base passando) | ✗ buraco de cobertura (advisory) |
| Tela cheia, hover, roda, cliques reais | requer Electron | não executado | ? SKIP → verificação humana |

**Buraco de cobertura (advisory, não vira lacuna).** Copiei os arquivos para o scratchpad e apliquei uma mutação por vez, rodando `node --test` em cada. A linha de base (sem mutação) passou. Mortas: `show nao rearma`, remover o spread seguro de `webPreferences` e `PERMISSION_ARM_MS = 0`. Sobreviveram, entre outras: `echoedId: shown.id` (anula o eco), `shownId: pressedId` (alvo vem do eco), `decidedId: null`, não marcar `decidedPermissionId`, marcá-lo antes de gravar, `windowVisible: true` fixo, `withinVisibleArea: true` fixo, relógio de parede no armamento, o retorno antecipado de `refresh` engolindo o rearme, `armEpoch: 0`, `answeredId: null`, o eco do renderer vindo de `current` em vez do `pressed`, remover `isValidRelease`, `transform: scale` no hover dos botões, remover `preventDefault`/`stopPropagation` da roda, `readPermissionId` que não zera, travar sem `answeredId`, Permitir sem `wasRead`, sem rearme por `armEpoch`, e `preload` sem o eco. As regras puras que o main e o renderer chamam estão provadas; **a ligação dos argumentos** e a cola de DOM estão sustentadas só por leitura de código (minha, e a da revisão profunda 02-REVIEW) e pelos UAT. O plano aceitou isso de propósito (RESEARCH: trava de fonte onde é barato, UAT onde não é), então não reprovo a fase; registro para decisão humana. Uma trava de fonte barata para o mapeamento de argumentos de `island:decide` e para a ausência de `transform` no hover dos botões fecharia os casos mais sensíveis, mas isso é escolha do mantenedor.

### Execução de probes

Passo 7c: não aplicável. O plano declara apenas `node --test`; não há `scripts/*/tests/probe-*.sh` nem probe citada nos PLAN/SUMMARY.

### Cobertura de requisitos

Todos os IDs dos frontmatters dos planos (01: SEG-01, 04, 06, 07; 02: SEG-02, 06; 03: SEG-02, 03, 04, 05; 04: SEG-08, CONV-04, SEG-05) estão em `REQUIREMENTS.md`, e `REQUIREMENTS.md` mapeia exatamente esses 9 IDs à Fase 2. Nenhum requisito órfão.

| Requisito | Plano de origem | Descrição | Status | Evidência |
|-----------|-----------------|-----------|--------|-----------|
| SEG-01 | 02-01 | Decisão se aplica ao pedido exibido pelo main; renderer só envia intenção e eco, que só recusa | ✓ SATISFIED | `acceptDecision` + vetores; `shown.id` como alvo (`main.js:316,332`) |
| SEG-02 | 02-02, 02-03 | Pedido exibido muda por um caminho (`refresh`); toda troca reinicia o armamento | ✓ SATISFIED (rearme ponta a ponta: ⚠ ver #8) | Atribuição única travada por teste; reducer com 9 vetores; renderer rearma por `armEpoch`/id |
| SEG-03 | 02-03 | Armar após 0,8 s com animação assentada e cursor parado; sem hover/nudge | ? NEEDS HUMAN | Predicados com vetores; cola sem teste; UAT-2 |
| SEG-04 | 02-01, 02-03 | Clique começa e termina no mesmo botão do mesmo pedido; primeiro clique vence | ? NEEDS HUMAN (regra pura ✓) | `isValidRelease` (13 vetores), `already-decided`; UAT-3/UAT-4 |
| SEG-05 | 02-03, 02-04 | 100% opaca com pedido; roda só no texto; 'lido' zera; inércia ignorada | ? NEEDS HUMAN (contrato puro ✓; consumidor de opacidade → Fase 4) | `effectiveOpacity`, `isWheelSettled`, `canMarkRead` com vetores; UAT-5/6 |
| SEG-06 | 02-01, 02-02 | Escondida, em tela cheia ou fora da área não decide; esconder nunca aprova; reexibir rearma | ✓ SATISFIED na regra e no contrato; sonda e prova e2e adiadas à Fase 4 | `window-hidden`, `outside-visible-area`, `covered-by-fullscreen`; ganchos `show`/`restore`/`display-*` |
| SEG-07 | 02-01 | Regra pura com vetores compartilháveis; `island:decide` deixa de ser o único ponto sem teste | ✓ SATISFIED | Fixture JSON puro + `gate.test.js` |
| SEG-08 | 02-04 | `webPreferences` seguras; sem canal do renderer para preferências | ✓ SATISFIED (subida sob sandbox: UAT-1) | `SECURE_WEB_PREFERENCES` + lista fechada de canais |
| CONV-04 | 02-04 | `THIRD_PARTY_NOTICES.md` com MIT completo, versão e titular conferido, antes de constantes portadas | ✓ SATISFIED | Arquivo, teste de conteúdo, ordem do commit |

### Prohibitions (ADR-550)

Prohibitions de nível `test` sem trava dedicada ficam sinalizadas, nunca verdes em silêncio. As de nível `judgment` levam o veredito não autoritativo e a bandeira `unverified-prohibition — human review recommended`.

| Plano | Prohibition | Nível | Situação | Evidência / bandeira |
|-------|-------------|-------|----------|----------------------|
| 02-01 | Renderer não escolhe o alvo | test | Parcial | Regra pura travada por vetores (`permissionId === shownId`); o argumento `shownId: shown.id` no handler não tem trava (mutação sobrevive). **Flag: unverified-prohibition — human review recommended** |
| 02-01 | Sem decisão sem eco | test | Parcial | Vetores cobrem eco ausente; `preload` sem eco sobrevive (efeito seria recusar tudo, falha segura) |
| 02-01 | Fato ausente nunca vira aceite | test | Aplicada | Vetores com chave omitida e `"true"` string recusam |
| 02-01 | Marcar decidido só após gravar | judgment | Código lido: respeita (`main.js:332-335`) | **Flag: unverified-prohibition — human review recommended** (mutação sobrevive) |
| 02-01 | Não alterar `hook.js`/`permission-hook.js` | test | Verificado agora por `git diff` vazio; não há teste na suíte | Aplicada na verificação |
| 02-02 | `shown` só atribuído em `refresh` | test | Aplicada | Teste de fonte I2 |
| 02-02 | Reexibir/restaurar/monitor/trocar só rearma, nunca aprova | judgment | Código lido: respeita | **Flag: unverified-prohibition — human review recommended** |
| 02-03 | Não armar com pílula/botões translúcidos ou em movimento | test | Aplicada | Vetores `settleStep` (opacidade `'1'` exata) |
| 02-03 | Sem escala ou transform de hover nos botões | test | Sem trava de teste; o CSS atual respeita (só `filter`) | **Flag: unverified-prohibition — human review recommended** (mutação sobrevive) |
| 02-03 | Sem clique sem pointerdown válido no mesmo botão | test | Parcial | `isValidRelease` com 13 vetores; a chamada na cola não tem trava |
| 02-03 | Roda no texto não vira outra ação nem marca leitura pela inércia | test | Parcial | Predicados com vetores; listener de roda sem trava. **Flag** |
| 02-03 | Não afrouxar a CSP | test | Aplicada | Teste de CSP exata |
| 02-04 | `webPreferences` sempre seguras | test | Aplicada | Teste de igualdade, congelamento e regex de fonte |
| 02-04 | Sem canal de preferência do renderer | test | Aplicada | Lista fechada de canais |
| 02-04 | Sem titular inventado nem MIT de memória | test | Aplicada | Teste compara o corpo com o `LICENSE` |
| 02-04 | Sem translucidez com pedido | test | Aplicada no contrato | `effectiveOpacity`; sem consumidor ainda |

### Anti-padrões encontrados

| Arquivo | Linha | Padrão | Severidade | Impacto |
|---------|-------|--------|------------|---------|
| (arquivos da fase) | n/a | `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` | ✓ nenhum | Sem marcadores de dívida |
| `index.html` | 512-545 | Texto do pedido muda sob o mesmo id sem rearmar (IN-01 da revisão, em aberto) | ℹ️ Info | Exige gravação externa no arquivo de estado (fora do modelo de ameaça de mesmo usuário) |
| `index.html` | 387-395 | Regra "rolar até o fim" depende do atributo `disabled` do DOM, fora do contrato testado (IN-02, em aberto) | ℹ️ Info | Correto hoje; dependência implícita do Chromium |
| `main.js` | 323 | `withinVisibleArea` compara a janela com o monitor da própria chave (IN-03, em aberto) | ℹ️ Info | Defesa em profundidade; a Fase 4 não deve ler `outside-visible-area` como cobertura real |

### Verificação humana necessária

A lista completa, com passos e resultado esperado, está no frontmatter (`human_verification`): UAT-1 a UAT-6, os checks das correções CR-01, WR-01 e WR-02, e a reconferência informativa do titular da licença. O harness é o `permission-hook.js` real alimentado por `stdin`, com a ilha no ar (`pnpm start`), sem tocar em `~/.claude/settings.json`, combinando horário com a sessão da Fase 1.

### Resumo das lacunas

Nenhuma lacuna bloqueante. O que impede `passed`:

1. **Prova humana pendente** dos UAT-1..6 e das correções da revisão (4 verdades `PRESENT_BEHAVIOR_UNVERIFIED`: armamento e roda do renderer, rearme sem mudança de estado no main, e as travas de navegação e de remetente).
2. **Decisão do mantenedor (aviso, não bloqueio):** a prova automática da fase é forte nas regras puras e fraca na cola que as chama. Se quiser que "comprovado por testes" alcance também o mapeamento dos argumentos de `island:decide` e a ausência de `transform` no hover dos botões, vale acrescentar travas de fonte antes de a Fase 3 mudar a tela; se aceitar o risco como planejado (UAT cobre a cola), nada a fazer.

---

_Verificado: 2026-11-21T06:10:00Z_
_Verificador: Claude (gsd-verifier)_
