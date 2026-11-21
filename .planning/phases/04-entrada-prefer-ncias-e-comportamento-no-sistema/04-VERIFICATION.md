---
phase: 04-entrada-prefer-ncias-e-comportamento-no-sistema
verified: 2026-11-21T00:00:00Z
status: gaps_found
score: 1/5 must-haves verified
covered_files:
  - ".planning/phases/04-entrada-prefer-ncias-e-comportamento-no-sistema/04-01-PLAN.md"
  - ".planning/phases/04-entrada-prefer-ncias-e-comportamento-no-sistema/04-01-SUMMARY.md"
  - ".planning/phases/04-entrada-prefer-ncias-e-comportamento-no-sistema/04-02-PLAN.md"
  - ".planning/phases/04-entrada-prefer-ncias-e-comportamento-no-sistema/04-02-SUMMARY.md"
  - ".planning/phases/04-entrada-prefer-ncias-e-comportamento-no-sistema/04-03-PLAN.md"
  - ".planning/phases/04-entrada-prefer-ncias-e-comportamento-no-sistema/04-03-SUMMARY.md"
  - ".planning/phases/04-entrada-prefer-ncias-e-comportamento-no-sistema/04-04-PLAN.md"
  - ".planning/phases/04-entrada-prefer-ncias-e-comportamento-no-sistema/04-04-SUMMARY.md"
  - ".planning/phases/04-entrada-prefer-ncias-e-comportamento-no-sistema/04-05-PLAN.md"
  - ".planning/phases/04-entrada-prefer-ncias-e-comportamento-no-sistema/04-05-SUMMARY.md"
  - ".planning/phases/04-entrada-prefer-ncias-e-comportamento-no-sistema/04-06-PLAN.md"
  - ".planning/phases/04-entrada-prefer-ncias-e-comportamento-no-sistema/04-06-SUMMARY.md"
  - "README.md"
  - "gate.test.js"
  - "hover.test.js"
  - "index.html"
  - "island.test.js"
  - "main.js"
  - "prefs.test.js"
  - "preload.js"
  - "scripts/human-checks.js"
  - "state.js"
covered_digest: "v4:sha256:f08b6d13dbf2d23f592aef5f18edd3d25976bb140fcc87baee7127a7e23fcc34"
behavior_unverified: 3
overrides_applied: 0
gaps:
  - truth: "No Windows, quando um app ocupa o monitor inteiro a ilha daquele monitor some e volta quando ele sai; um pedido nessa hora só toca o som (ROADMAP SC5, TELA-01, ramo 'em tela cheia' de TELA-02)"
    status: partial
    reason: "Decisão de escopo registrada (D-20 em 04-CONTEXT.md, 'Autorização do autor: NÃO CONCEDIDA' para o koffi), não falha não explicada. Existem a regra pura nextFullscreen (state.js), o mapa por monitor fullscreenByDisplay, a visibilidade combinada (isIslandVisible/applyVisibility) e o fato coveredByFullscreen por display no gate. Falta o sensor: fullscreenByDisplay nunca é escrito, então em runtime nenhum monitor é marcado coberto e a ilha continua por cima do app em tela cheia."
    artifacts:
      - path: "main.js"
        issue: "const fullscreenByDisplay = new Map() sem produtor (comentário ponytail: marca o ponto de entrada)"
      - path: "fullscreen.js"
        issue: "não existe (nenhum sensor; nenhum pacote nativo adicionado, package.json e pnpm-workspace.yaml inalterados)"
    missing:
      - "Escolha do autor entre (1) koffi@3.3.8 com allowBuilds: { koffi: false } e (2) um processo PowerShell filho persistente com P/Invoke em user32 (padrão do window.js)"
      - "Sensor a 2 Hz que alimente nextFullscreen e chame applyVisibility() quando o mapa mudar"
    closable_without_author: false
behavior_unverified_items:
  - truth: "Esconder nunca aprova e reexibir rearma os botões (SC4, SEG-06): showInactive() emite 'show', que chama refresh('rearm')"
    test: "Esconder pelo atalho Control+Alt+Shift+C com um pedido na tela, reexibir e olhar Permitir e Negar"
    expected: "Os botões voltam desarmados e só armam após 0,8 s; a ilha escondida nunca grava decisão"
    why_human: "O rearme depende do evento 'show' do Electron; a suíte só trava o texto do listener em gate.test.js. A recusa por janela escondida (window-hidden) tem vetor de comportamento em acceptDecision, mas o encadeamento hide -> show -> rearm não roda sem Electron"
  - truth: "Arraste, duplo clique e menu seguram a captura e rearmam (SC2, SC3): applyCapture (arraste e menu), refresh('rearm') em island:drag-end, island:reset-position, menu-will-show e menu-will-close"
    test: "Arrastar a pílula e soltar sobre um botão de pedido; duplo clique para recentralizar; abrir e fechar o menu com o cursor sobre Permitir/Negar"
    expected: "Nenhum clique cai na janela de baixo durante o arraste; depois de soltar, recentralizar ou fechar o menu os botões estão desarmados e armam após 0,8 s; o clique que fecha o menu não decide"
    why_human: "Invariante de ordem e limpeza em cola de Electron (BrowserWindow, Menu); só há trava de texto em gate.test.js (04-06-SUMMARY, 'Afirmações que só têm trava de texto')"
  - truth: "O timer do cursor só roda com ilha visível e fora de ociosa, e a ilha escondida solta a captura (SC1): updateCursorTick e o listener 'hide'"
    test: "Deixar a sessão ociosa, depois esconder a ilha; clicar e rolar sobre a área onde ela ficava"
    expected: "Cliques atravessam para a janela de baixo; nenhum timer de 30 Hz ativo (CPU ociosa)"
    why_human: "Estado de timer e janela que só existe com Electron; trava de texto apenas"
coincidental_reliance_items: []
human_verification:
  - test: "CHK-01, hover com terminal elevado (ilha parada): node_modules\\electron\\dist\\electron.exe scripts\\human-checks.js --mode=hover, com terminal comum e depois com o Gerenciador de Tarefas elevado em foco, nos monitores a 100% e 125%; depois, com a ilha no ar e o elevado em foco, passar o cursor na pílula real"
    expected: "Com o elevado o contador do DOM (domMovesForward) para e o do polling segue (polling-viu-o-cursor); a pílula real expande e captura o clique"
    why_human: "UIPI e entrada real do mouse; nada pode ser lançado na tela nesta verificação (HOV-02, SC1)"
  - test: "CHK-02, AltGr+C: --mode=hotkey; digitar AltGr+C e Ctrl+Alt+Shift+C no ABNT2"
    expected: "Control+Alt+C com AltGr marca 'disparou' (confirma o conflito que fez o padrão ser Ctrl+Alt+Shift+C); nenhum acelerador 'tomado-por-outro-processo'"
    why_human: "Teclado físico ABNT2 (PREF-03; requisito permite padrão alternativo sem conflito, o que o D-10 fez)"
  - test: "CHK-03, menu nativo: clique direito na pílula; clicar fora para fechar; com pedido na tela fechar o menu sobre Permitir/Negar; escolher um item"
    expected: "Menu perto do cursor com Tema, Forma, Estilo e Velocidade da animação, Expandir, Fixar aberta, Transparência, Âncora, Ilhas e Esconder, valor atual marcado; o clique que fecha não decide e os botões voltam desarmados; escolher item não tira o foco do terminal; 'Esconder' do menu esconde a ilha (correção CR-01 só exercitada por teste de comportamento de toMenuItem, não pelo clique real)"
    why_human: "Descarte nativo do menu e foco são do sistema operacional"
  - test: "CHK-04, 125% de DPI: histerese 2 px/8 px sem piscar, arraste, duplo clique (recolhe em até 33 ms), Permitir/Negar, âncora de baixo sem recusa do gate"
    expected: "Janela nasce 520x412 após o setBounds; âncora de canto não deixa a pílula passar da borda; soltar o arraste fora do retângulo reavalia o hover sem o clique cair atrás"
    why_human: "Deriva de DIP e getBounds() só se vê com monitor real a 125%"
  - test: "CHK-06, som com a ilha escondida (cerca de 10 min) e pedido de permissão"
    expected: "O aviso sonoro toca, a ilha não reaparece, o terminal segue valendo e, ao reexibir, Permitir/Negar recomeçam desarmados"
    why_human: "Áudio e janela escondida reais (TELA-02, ramo 'escondida pelo usuário')"
  - test: "CHK-07 (roda sobre a pílula com o elevado em foco, insumo da Fase 5) e CHK-08 (esconder/mostrar várias vezes com o komorebi sem retilar a ilha)"
    expected: "A roda chega à pílula; o komorebi não retila a ilha"
    why_human: "Programas de terceiros em execução"
  - test: "Respiro da pílula expandida (commit ddda2e4): hover em 'Trabalhando', temas claro e escuro, forma pílula"
    expected: "Ponto, título, pontos, anel e percentual não encostam nos cantos curvos (respiro lateral 24 px, raio máximo 36 px); a recolhida não muda"
    why_human: "Julgamento visual; a captura antes/depois fica no artefato do PR, fora do repositório"
  - test: "As 6 âncoras e o alinhamento: 16 px da lateral e 40 px da base, sombra não recortada, ampliação do hover a partir da borda ancorada, Elástico a 2x sem recorte, trocar a âncora zera a posição arrastada; âncora de base com Elástico a 0,5x e pedido chegando pode perder cerca de 6 px da sombra superior (limite conhecido do 04-03)"
    expected: "Alinhamento e sombra como descritos; pílula nunca recortada"
    why_human: "Alinhamento do CSS data-anchor só se confere na tela"
  - test: "Transparência 85/70/55%: mistura real com o fundo, texto legível; com pedido na tela volta a 100% e depois à escolhida"
    expected: "setOpacity mistura de fato; opacidade 1 enquanto houver pedido (a regra effectiveOpacity e a ordem 'applyOpacity antes de sendState' estão no código, mas o efeito de janela é visual)"
    why_human: "Mistura de janela transparente e legibilidade (se reprovar, a ideia adiada de D-16 vira 'só o preenchimento')"
  - test: "Modo 'No monitor do cursor' e 'Só no monitor principal' com dois monitores de DPI diferente"
    expected: "A ilha só troca de monitor sem pedido na tela, mantém o tamanho físico (se a janela crescer cerca de 25%, recriar em vez de mover) e rearma"
    why_human: "Hardware de dois monitores"
  - test: "Notch com âncora de baixo e menu 'Expandir > Ao clicar' / 'Fixar aberta'"
    expected: "Notch flutua 40 px acima da base (aparência aceita ou não); clique expande, cursor saindo recolhe; Concluído nunca expande; Permitir/Negar/Abrir funcionam e não armam por hover"
    why_human: "Aparência e interação real"
  - test: "Reiniciar após usar cada item do menu e com preferences.json inválido"
    expected: "Cada escolha volta igual; JSON inválido gera preferences.json.<carimbo>.bad e a ilha sobe com os padrões"
    why_human: "Ciclo de processo real (a função normalizePreferences e quarantinePath têm teste de comportamento)"
  - test: "CHK-05, tela cheia: pendente do sensor (TELA-01)"
    expected: "Sem o que conferir até o autor escolher o sensor; hoje a ilha continua por cima do app em tela cheia"
    why_human: "Depende da decisão D-20"
---

# Fase 4: Entrada, preferências e comportamento no sistema — Relatório de verificação

**Objetivo da fase:** A ilha reage ao cursor onde ele realmente está, é configurada pelo menu de clique direito e some por atalho ou quando um app ocupa a tela, sem nunca aceitar uma decisão estando escondida
**Verificado em:** 2026-11-21
**Status:** gaps_found (um gap, de escopo já decidido: TELA-01/SC5; o restante cai em verificação humana)
**Re-verificação:** Não, verificação inicial

## Leitura rápida

- O que o código prova: a regra do hover, o esquema de preferências, o menu, as âncoras, o modo de ilhas, a opacidade e o gate por monitor têm teste de comportamento e passam (`node --test`: 348 testes, 0 falhas, conferido nesta verificação).
- O que não está no código: o sensor de tela cheia. É a decisão D-20 (autor não autorizou o `koffi`), então o SC5 e o requisito TELA-01 estão parciais por escolha registrada, à espera da decisão do autor. Classifiquei como `gaps_found` porque a verdade do roadmap não é observável hoje; se o orquestrador aceitar D-20 como decisão de escopo, o status efetivo é `human_needed`.
- O que depende de olhos e mãos: a lista consolidada de "Testar manualmente" (CHK-01 a CHK-08 e itens visuais), mais as três verdades de comportamento (rearme ao reexibir, captura no arraste/menu, timer do cursor) que só têm trava de texto.
- Os achados da revisão de código (CR-01, WR-01, WR-02, WR-03) estão presentes no código.

## Resultado por critério de sucesso

### Verdades observáveis

| # | Verdade (ROADMAP) | Status | Evidência |
|---|-------------------|--------|-----------|
| 1 | Cursor sobre a pílula expande (ou clique, conforme a preferência), sem piscar; fora dela cliques e roda atravessam; dentro recebe clique e roda, inclusive com terminal elevado e a 125% | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `hoverStep` (`index.html:587`, histerese 2/8 px, `HOVER_ENTER_PX`/`HOVER_LEAVE_PX`) e `shouldExpand` (`:604`) rodam em `node:vm` em `hover.test.js` e passam. `main.js` lê `screen.getCursorScreenPoint()` a 33 ms (`cursorTick`), envia `island:cursor`; o renderer responde só um booleano em `island:capture`; `applyCapture` aplica `setIgnoreMouseEvents(!capture)` sem `forward` (grep: `forward` só aparece em comentário). A parte "terminal elevado" e "125%" é UIPI e DPI reais: CHK-01 e CHK-04 |
| 2 | Arrastar, duplo clique e botões de permissão seguem funcionando com o novo hover | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Fiação lida: `pointerdown`/`pointermove`/`lostpointercapture` (`index.html:1067-1103`), `applyCapture` segura a captura com `dragStartPositions.has(island)`, `island:drag-end` e `island:reset-position` chamam `refresh('rearm')` (WR-01 corrigido, `main.js:566`, `:577`), `updateHover` não chama `restartArming`. Só trava de texto, sem teste de comportamento (cola de Electron) |
| 3 | Menu de clique direito com tema, forma, estilo, velocidade, expandir, fixar aberta, transparência, âncora e esconder; escolhas voltam iguais após reiniciar; arquivo corrompido ou antigo não impede a ilha de subir | ✓ VERIFIED | `menuTemplate` e `toMenuItem` (`state.js`) com testes de comportamento em `prefs.test.js` (6 testes do menu passam, incluindo o clique de Esconder e dos rádios). `normalizePreferences` percorre só as chaves do esquema, devolve objeto completo, nunca lança, valor inválido volta ao padrão. Gravação por `.tmp` + `renameSync` (`writeFileAtomic`, `main.js:187`, também em `positions.json`). `loadPreferences` põe JSON inválido ou acima de 64 KB em `preferences.json.<carimbo>.bad` (`quarantinePath`). Menu aberto por `contextmenu` → `island:menu` sem argumentos; nenhum canal do renderer grava preferência (preload expõe só `onCursor`, `setCapture`, `openMenu`, etc.). O aspecto nativo do menu é CHK-03 |
| 4 | Atalho global esconde/mostra (Ctrl+Alt+C se não conflitar, senão outro padrão; menu avisa se não registrar); esconder nunca aprova e reexibir rearma; âncora e arraste preso ao monitor; modo "uma ilha só" opcional; transparência 100/85/70/55% nunca vale com pedido na tela | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Parte verificada por teste de comportamento: padrão `Control+Alt+Shift+C` com `SHORTCUT_PATTERN`, `registerShortcut` (`ok`/`unavailable`/`invalid`), aviso no menu e "Esconder" desabilitado sem atalho; `anchorPosition`, `horizontalSlackFor`, `clampIslandPosition` (arraste preso a `display.workArea` em `moveIsland`); `islandDisplays` (`perDisplay`/`primary`/`cursor`, cursor só sem pedido); `effectiveOpacity` devolve 1 com pedido ou fato desconhecido e `applyOpacity` roda no laço do `refresh` antes de `sendState` (lido em `main.js:397-400`); `acceptDecision` recusa `window-hidden`, vetores em `fixtures/permission-vectors.json`. Parte não observável sem Electron: "reexibir rearma" (`island.on('show', () => refresh('rearm'))`, `main.js:437`). O padrão do atalho difere do texto do requisito por medição documentada (AltGr+C produz ¢ no ABNT2, D-10), o que o PREF-03 permite; CHK-02 confirma |
| 5 | No Windows, app em tela cheia faz a ilha daquele monitor sumir e voltar; pedido nessa hora só toca o som | ✗ FAILED (parcial, decisão D-20) | Não há sensor. `fullscreen.js` não existe, `package.json` e `pnpm-workspace.yaml` não mudaram, `fullscreenByDisplay` (`main.js:80`) nunca é escrito. Existem e passam nos testes: `nextFullscreen` (regra D-18, tabela em `island.test.js:558`), `isIslandVisible`, `nextUserHidden`, `applyVisibility` e o fato `coveredByFullscreen: display ? fullscreenByDisplay.has(display.id) : true` no gate (fail-safe para monitor desconhecido). Ramo "escondida pelo usuário" de TELA-02 está pronto; o ramo "em tela cheia" espera o sensor |

**Pontuação:** 1/5 verdades verificadas (3 presentes e ligadas, comportamento não exercitado; 1 parcial por decisão de escopo)

### Invariantes do gate (regras que valem para toda fase)

| Invariante | Status | Evidência |
|------------|--------|-----------|
| Hover, scroll, nudge, tema, opacidade e esconder nunca habilitam nem disparam decisão | ✓ | O único emissor de decisão é `island:decide`; `updateHover`, `applyPreferences`, `applyOpacity` e `setUserHidden` não chamam `decide` nem armam. `restartArming` só desarma |
| Esconder nunca aprova | ✓ | `island:decide` passa `windowVisible: island.isVisible() && !island.isMinimized()`; a ilha escondida usa `hide()`, nunca destrói. Vetor `window-hidden` no fixture |
| Reexibir rearma | ⚠️ | Listeners `'show'` e `'restore'` chamam `refresh('rearm')`; só trava de texto (item de comportamento não verificado acima) |
| Transparência nunca com pedido na tela | ✓ | `effectiveOpacity(preferences.opacity, Boolean(lastPickedState.permission))`, aplicada no mesmo passo do `refresh` antes de `sendState`, na criação, no `'show'` e na troca de preferência (todas passam por `refresh('rearm')`, que sobe a época e não é engolido pelo retorno antecipado) |
| Renderer nunca fornece ids nem preferências | ✓ | `island:capture` aceita só booleano; `island:menu` não recebe argumentos; `island:decide` recebe eco que só recusa; o `shown.id` é do main; todo handler passa por `islandOf` (`isIslandSender`) |
| Hooks inalterados | ✓ | `hook.js`, `permission-hook.js`, `window.js` e `install.js` fora do diff da fase; a única dependência nativa citada (`koffi`) não entrou |

### Correções da revisão de código

| Achado | Status | Evidência |
|--------|--------|-----------|
| CR-01, item "Esconder" inerte | Presente | `toMenuItem` em `state.js` testa `action: 'hide'` antes de `key`, item desabilitado nunca ganha `click`; `openMenu` monta `effects = { onHide: () => setUserHidden(true), onPreference: applyPreference }` (`main.js:245`); teste de comportamento em `prefs.test.js` passa |
| WR-01, rearme ao soltar o arraste e ao recentralizar | Presente | `refresh('rearm')` ao fim de `island:drag-end` e `island:reset-position` (`main.js:566`, `:577`) |
| WR-02, menu fechando sobre janela destruída | Presente | `applyCapture` retorna cedo com `island.isDestroyed()` (`main.js:273`); `syncIslands` zera `menuIsland` antes de `island.destroy()` (`:507`) |
| WR-03, testes só de texto | Parcial por escolha | Teste de comportamento de `toMenuItem` adicionado; rearme e janela destruída ficam em trava de texto (cola de Electron), registrado em `04-REVIEW-FIX.md` |
| IN-01 (atalho de tecla sozinha), IN-02 (JSON válido porém inútil não vai à quarentena), IN-04 (`island:cursor` sem conferir remetente) | Não corrigidos (fora do escopo da correção) | Informativos da revisão; ver Avisos |

### Artefatos obrigatórios

| Artefato | Esperado | Status | Detalhes |
|----------|----------|--------|----------|
| `state.js` | Funções puras da fase (preferências, menu, âncora, ilhas, opacidade, tela cheia, visibilidade) | ✓ VERIFIED | Existe, substantivo, ligado em `main.js`/`hook`-free; 348 testes |
| `main.js` | Cursor, captura, menu, atalho, âncora, modos, opacidade, visibilidade | ✓ VERIFIED (parte tela cheia sem produtor) | Fiação lida de ponta a ponta |
| `index.html` | `hoverStep`, `shouldExpand`, `contextmenu`, `data-anchor` | ✓ VERIFIED | Blocos entre marcadores extraídos por `hover.test.js` |
| `preload.js` | `onCursor`, `setCapture`, `openMenu`; sem `setHover` | ✓ VERIFIED | Canais conferem com os handlers do main |
| `scripts/human-checks.js` | Ferramenta CHK-01/CHK-02 só de escuta | ✓ VERIFIED | `--selftest` imprime `selftest ok` (saída 0); nenhum módulo da ilha a carrega (grep) |
| `fullscreen.js` | Sensor de tela cheia | ✗ MISSING (por D-20) | Ver gap |

### Ligações principais

| De | Para | Via | Status |
|----|------|-----|--------|
| `main.js` `cursorTick` | `index.html` `updateHover` | `island:cursor` → `onCursor` → `hoverStep` | WIRED |
| `index.html` `updateHover` | `main.js` `applyCapture` | `setCapture` → `island:capture` (booleano) | WIRED |
| `index.html` `contextmenu` | `main.js` `openMenu` | `openMenu` → `island:menu` | WIRED |
| `openMenu` | `applyPreference` / `setUserHidden` | `toMenuItem` com efeitos | WIRED |
| `applyPreference` | `refresh('rearm')` | `syncIslands()` + rearme | WIRED |
| atalho | `setUserHidden` | `registerShortcut` + `nextUserHidden` | WIRED |
| `setUserHidden`/`applyVisibility` | `island.hide()`/`showInactive()` → `'show'` → rearme | WIRED (rearme só por trava de texto) |
| `fullscreenByDisplay` | `applyVisibility`/gate | mapa lido em 3 pontos, **sem produtor** | NOT_WIRED na origem (D-20) |

### Fluxo de dados (nível 4)

| Artefato | Variável | Fonte | Dados reais | Status |
|----------|----------|-------|-------------|--------|
| Hover | `lastCursorPoint` | `screen.getCursorScreenPoint()` via main | Sim | ✓ FLOWING |
| Menu | `preferences` | `loadPreferences()` + `applyPreference` | Sim | ✓ FLOWING |
| Visibilidade | `covered` | `fullscreenByDisplay.has(displayId)` | Não, mapa sempre vazio | ✗ DISCONNECTED (D-20, documentado em comentário `ponytail:` e testado por `gate.test.js:1224`) |

### Verificações comportamentais

| Comportamento | Comando | Resultado | Status |
|---------------|---------|-----------|--------|
| Suíte inteira (inclui `fixtures/permission-vectors.json`) | `node --test` | 348 testes, 0 falhas | ✓ PASS |
| Menu, `toMenuItem`, clique de Esconder | `node --test --test-name-pattern="Esconder\|menu\|toMenuItem" prefs.test.js` | 6 passam | ✓ PASS |
| Ferramenta de verificação humana | `node scripts/human-checks.js --selftest` | `selftest ok`, saída 0 | ✓ PASS |
| Marcadores de dívida (`TBD`, `FIXME`, `XXX`) em `main.js`, `state.js`, `index.html`, `preload.js`, `scripts/human-checks.js` | grep | nenhum | ✓ PASS |
| Electron, entrada real, DPI, UIPI | não executados (regra: nada na tela) | — | ? SKIP, vai para verificação humana |

### Execução de probes

Passo 7c: não executado (nenhum `scripts/*/tests/probe-*.sh` existe nem é declarado pelos planos). `scripts/human-checks.js` não é probe: só `--selftest` roda sem Electron.

### Cobertura de requisitos

| Requisito | Plano de origem | Status | Evidência |
|-----------|-----------------|--------|-----------|
| HOV-01 | 04-02 | ✓ SATISFIED (código) | `cursorTick`, `hoverStep`, histerese; `hover.test.js` |
| HOV-02 | 04-02, 04-06 | ⚠️ NEEDS HUMAN | Sem `forward`, polling do cursor; elevado e 125% só em CHK-01/CHK-04 |
| HOV-03 | 04-02 | ✓ SATISFIED | `expandOn`, `shouldExpand`, clique expande e cursor saindo recolhe |
| HOV-04 | 04-02 | ⚠️ NEEDS HUMAN | Fiação lida; captura no arraste só por trava de texto |
| PREF-01 | 04-01, 04-02, 04-03, 04-04, 04-06 | ✓ SATISFIED | Menu completo, testado em `prefs.test.js` |
| PREF-02 | 04-01 | ✓ SATISFIED | Esquema completo, quarentena, gravação atômica |
| PREF-03 | 04-04, 04-06 | ✓ SATISFIED (código); CHK-02 humano | Padrão `Control+Alt+Shift+C` por medição (D-10); aviso no menu |
| PREF-04 | 04-03 | ✓ SATISFIED (código); alinhamento visual humano | `anchorPosition`, `clampIslandPosition`, `data-anchor` |
| PREF-05 | 04-03 | ✓ SATISFIED (código); dois monitores humano | `islandDisplays` |
| PREF-06 | 04-04 | ✓ SATISFIED (código); mistura visual humana | `effectiveOpacity`, `applyOpacity` |
| TELA-01 | 04-05 | ✗ PARTIAL (D-20) | Sem sensor |
| TELA-02 | 04-04, 04-05 | ✗ PARTIAL (D-20) | Ramo "escondida pelo usuário" pronto; ramo "em tela cheia" espera o sensor |

Requisitos órfãos: nenhum. Os 12 IDs (HOV-01..04, PREF-01..06, TELA-01..02) aparecem nos `requirements:` dos planos (04-01: PREF-01/02; 04-02: HOV-01..04, PREF-01; 04-03: PREF-04/05/01; 04-04: PREF-03/06, TELA-02, PREF-01; 04-05: TELA-01/02; 04-06: HOV-02, PREF-01, PREF-03) e no `REQUIREMENTS.md` (Traceability marca HOV/PREF como Complete, TELA-01 como Pending e TELA-02 como Partial, consistente com o código).

### Anti-padrões encontrados

| Arquivo | Linha | Padrão | Severidade | Impacto |
|---------|-------|--------|-----------|---------|
| `main.js` | 80 | `fullscreenByDisplay` sem produtor (stub de sensor) | 🛑 Blocker apenas para SC5; já registrado | Decisão D-20; marcado com `ponytail:` |
| `state.js` | 479 | `SHORTCUT_PATTERN` aceita tecla sozinha (IN-01) | ⚠️ Aviso | `"shortcut": "A"` no JSON registraria uma letra pura no sistema inteiro; risco de autoengano, o campo é editado à mão |
| `main.js` | 121-125 | JSON válido porém não objeto, ou com valores inválidos, não vai à quarentena e é sobrescrito na primeira escolha (IN-02) | ⚠️ Aviso | O README promete quarentena só para arquivo "corrompido"; não impede a ilha de subir |
| `main.js` | 303, 305 | `island:cursor` enviado sem `isIslandSender` (IN-04) | ℹ️ Info | Só vaza a posição do cursor, navegação já bloqueada |
| `04-VALIDATION.md` | frontmatter | `status: draft`, `nyquist_compliant: false` | ℹ️ Info | Fechar com `/gsd-validate-phase` |

### Itens para verificação humana

Lista completa no frontmatter (`human_verification`), derivada da lista "Testar manualmente" de `04-06-SUMMARY.md` e da tabela "Manual-Only Verifications" de `04-VALIDATION.md`. Antes de CHK-01 e CHK-02, parar a ilha (a ferramenta recusa rodar com batimento recente). Resumo: CHK-01 (elevado), CHK-02 (AltGr+C), CHK-03 (menu nativo), CHK-04 (125%), CHK-06 (som escondida), CHK-07/08 (roda e komorebi), respiro da expandida (`ddda2e4`), seis âncoras, transparência, modo cursor, reinício com `.bad`, notch na base. CHK-05 (tela cheia) fica pendente de D-20.

### Resumo dos gaps

Há um único gap, e é de escopo decidido: o sensor de tela cheia (TELA-01 e o ramo "em tela cheia" de TELA-02, SC5). O autor não autorizou o pacote `koffi` (D-20); o plano 04-05 entregou a regra pura, o mapa por monitor, a visibilidade combinada e o fato por monitor no gate, sem produtor. O que falta para fechar depende só da escolha do autor entre `koffi@3.3.8` (+5,0 a 5,1 MB, 7,8 µs por sondagem) e um PowerShell filho persistente (28,3 MB numa amostra, CPU a 2 Hz não medida); não há plano de fechamento que o planejador possa escrever sem essa escolha. Os demais critérios (SC1 a SC4) estão presentes e ligados, com a lógica pura coberta por testes de comportamento; o que resta neles é comportamento de Electron, UIPI, DPI e aparência, que só uma pessoa com a ilha na tela confirma.

---

_Verificado: 2026-11-21_
_Verificador: Claude (gsd-verifier)_
