# Project Research Summary

**Project:** Claude Island (milestone: reformular a ilha com o comportamento e o visual do mod Windhawk)
**Domain:** overlay desktop transparente, sempre no topo, sem foco, uma janela por monitor, que mostra o estado de sessões do Claude Code e relaya decisões de permissão
**Researched:** 2026-11-21
**Confidence:** MEDIUM (arquitetura interna HIGH, vem do código lido; Electron HIGH; ganho de memória do Tauri LOW, nunca medido; macOS/Linux nada testado)

## Executive Summary

O Claude Island é uma ilha de status de agente com um diferencial claro: Windows e Linux de primeira classe e proteções contra aprovação por engano. No macOS o nicho está lotado (Vibe Island, AgentPeek, ClaudeNotch, NotchNook etc.); no Windows não há concorrente direto para Claude Code. Nenhum app de notch expõe API para terceiros empurrarem conteúdo, e o mod do Windhawk também não. Portanto a convivência é por posicionamento (âncora, deslocamento, encaixe lateral), nunca por integração. O padrão de multi-sessão do gênero é "mostrar a mais urgente, listar as outras", compatível com a decisão do projeto (scroll + volta sozinho para quem pede permissão), desde que haja regras explícitas contra surpresa.

A abordagem recomendada: **manter o Electron 45.4.1 como baseline** e tratar o Tauri 2.12.7 como candidato a provar, não como favorito. No Windows o WebView2 é o mesmo Chromium, então o ganho de memória do Tauri provavelmente é de 15% a 40%, não de 80%, e a evidência externa (um benchmark, LOW) aponta ~5%. Dois confundidores precisam sair do Electron antes de comparar: os 426 MB são *working set* somado (infla com páginas compartilhadas) e o `@keyframes glow` anima `box-shadow` em loop infinito, inclusive em `idle` (provável dono da maior parte dos ~1,5% de CPU, e idêntico no Tauri). Toda a arquitetura converge para: `main` como único dono da verdade (seleção global, funil `refresh()`, gate de permissão), renderer com palco fixo e mola própria (`spring.js`, ~25 linhas, zero dependência), hover por polling do cursor no `main` com hit-test no renderer (necessário nas duas bases, pois o Tauri não tem `forward`), e lógica de decisão em funções puras testadas por `node:test`.

O risco dominante é de segurança, não de tecnologia: scroll, auto-snap, mola, esconder e temas criam caminhos novos para o usuário clicar em algo que não viu. A mitigação é um conjunto de invariantes (abaixo) implementado **antes** de qualquer feature que mude o que está na tela, com testes primeiro. Riscos secundários: spike mal medido (árvore de processos inteira, *private working set*, critério escrito antes), DPI misto (100% e 125%), custo do "esconder em tela cheia" no Electron (sem API; exige FFI ou helper) e o encaixe com o Windhawk (a pílula dele não é observável de fora).

## Invariantes de segurança de permissão (NÃO NEGOCIÁVEIS)

Toda fase e toda PR devem preservar estes pontos. Viram requisitos e critérios de verificação, não recomendações.

| # | Invariante |
|---|------------|
| I1 | O alvo de uma decisão é sempre o `shownPermissionId` do `main`. O renderer envia só intenção (`allow`/`deny`) mais um **eco** do id exibido, que pode apenas **recusar**, nunca definir alvo |
| I2 | `shownPermissionId`/`shownPermissionSince` só mudam dentro de `refresh()` (funil único: poll, wheel, prefs, display, visibilidade) |
| I3 | **Qualquer** troca do que está na tela (poll, snap, scroll, tema/forma que mova botões, reexpansão) reinicia o armamento. O armamento exige 0,8 s no `main` **e** molas assentadas + permanência do cursor (150 a 300 ms) no renderer |
| I4 | Allow/Deny só vale se `pointerdown` e `pointerup` caírem no mesmo botão; clique que atravessa pedidos diferentes é descartado. Primeiro clique vence por id (duas ilhas) |
| I5 | Hover, scroll, nudge, tema, opacidade e esconder nunca habilitam nem disparam decisão. Com pedido na tela a opacidade é 100% e Ctrl+hover translúcido fica desligado. Botões não sofrem escala de hover nem nudge |
| I6 | Scroll sobre `#permission` (texto) só rola o texto; nunca troca de sessão. Eventos `wheel` são ignorados por ~300 a 400 ms depois de qualquer troca de conteúdo (inércia de touchpad não pode marcar "lido") e o estado "lido até o fim" zera a cada novo pedido |
| I7 | DOM sem camada obsoleta: texto e id trocam atomicamente; sem crossfade de duas camadas |
| I8 | Janela escondida, em tela cheia ou fora da área de trabalho **não aceita decisão**. Esconder nunca aprova; o terminal segue valendo em paralelo. Reexibir rearma |
| I9 | Preferências só entram pelo menu nativo do `main` (sem canal `island:set-pref`); arquivo é sanitizado na leitura (valor inválido vira default por chave) |
| I10 | Se o Tauri vencer, o gate (`validPermission`, `acceptDecision`, armamento, escrita da decisão) roda em **Rust**, nunca no webview, com vetores JSON dourados rodados por `node:test` **e** `cargo test` |

O gate hoje não tem teste (`island:decide`, `CONCERNS.md`): fechar esse gap é a primeira entrega de código do milestone.

## Key Findings

### Recommended Stack

Escopo do milestone sem dependência nova, com uma exceção condicional. Detalhes em `STACK.md`.

**Core technologies:**
- **Electron 45.4.1** (Chromium 156, Node 24.22.3): baseline; já entrega `setIgnoreMouseEvents`, `setAlwaysOnTop('screen-saver')`, `focusable:false`, `globalShortcut`, `Menu.popup`, `screen.getCursorScreenPoint`. Trocar só com ganho medido
- **Tauri 2.12.7**: só no spike, em `spike/tauri/` separado do `package.json`; Rust 1.99.1 e MSVC já instalados na máquina do autor
- **`spring.js` próprio** (semi-implícito, passo 0,5 ms, `dt` limitado a 50 ms, rAF só enquanto alguma mola não assentou): medido 5,9% de overshoot ao crescer, 0 ao encolher, ~0,6 µs por quadro. Nenhuma biblioteca de animação entrega as constantes assimétricas
- **`preferences.json`** em `userData` (escrita atômica temp+rename, `version`, validação por lista fechada em `state.js`); `globalShortcut` e `Menu.popup` embutidos
- **`koffi` 3.3.8** (único candidato a dependência, só Windows, `require` dentro de `if (process.platform === 'win32')`): detecção de tela cheia e localização da janela do Windhawk sem PowerShell residente (~40 MB). Só entra se o Electron for mantido; no Tauri vira a crate `windows`
- **Node/pnpm/`node:test`**: sem mudança; hooks seguem Node mesmo se o `main` virar Rust

### Expected Features

Detalhes em `FEATURES.md`.

**Must have (table stakes):**
- Pontos por sessão (cor = estado, pulso = pede permissão) no lugar do contador, com ordem estável e rótulo do projeto sempre visível
- Scroll entre sessões (constantes do mod: acumula 120, gesto novo após 220 ms ou inversão, 85 ms entre passos, 200 ms no touchpad, sem wrap)
- Snap para a sessão que pede permissão, com fila FIFO "1 de N" e Allow/Deny amarrados ao `requestId` (requisito de segurança)
- Hover por posição do cursor + click-through dinâmico (base do scroll)
- Molas assimétricas, nudge, hover com ampliação, 4 estilos, controle de velocidade
- Menu de clique direito com preferências persistidas, atalho global, esconder em tela cheia, âncora e deslocamento
- `THIRD_PARTY_NOTICES.md` (MIT do mod)

**Should have (competitive):**
- 8 temas + automático, formas pílula/notch/Windows 11, reflexo de acento por estado (com contraste testado)
- Clique no ponto para ir à sessão (acessibilidade do scroll) e pré-visualização somente leitura no hover do ponto
- Dock lateral ao lado da ilha do Windhawk (HIGH de custo, só Windows, opcional)
- Venda explícita das proteções de aprovação no release (diferencial real; só ClaudeNotch cita guarda extra)

**Defer (v2+) / anti-features:**
- "Aprovar todos (N)", atalho global de Allow/Deny, "Permitir sempre", auto-troca por qualquer mudança de estado, carrossel automático, wrap, reordenar por urgência, split de duas sessões, outros agentes, sistema de plugins, módulos de sistema, gambiarras no Windhawk (`ProgressPercent`, SMTC falso)
- Resumo/diff e `AskUserQuestion` por opções, histórico/custo, adaptadores SuperIsland/WinLand, convivência ativa no macOS

### Architecture Approach

`main` é o único processo confiável e o único dono do estado de exibição. Hooks, `install.js` e o barramento de arquivos JSON não mudam. Detalhes em `ARCHITECTURE.md`.

**Major components:**
1. `main.js` — funil `refresh({reason})`, IPC, janelas, `cursorTick`, atalho, menu, persistência; sem regra de negócio (todo `if` de regra vai para `state.js`)
2. `state.js` (puro) — cresce com `aliveSessions`, `nextSelection`, `wheelStep`, `acceptDecision`, `sanitizePreferences`, `effectiveOpacity`, `islandVisibility`, `isCoveringMonitor`, `anchorPosition`, `dockPosition`
3. `spring.js` (novo, UMD, puro) — mola, estilos, nudge, `pointInRect`; carregável pelo renderer e pelos testes (e reaproveitável num webview Tauri)
4. `preferences.js` (novo, I/O) e `platform-probe.js` (novo, I/O nativo Windows, só depois do spike) — sensor devolve só retângulos e strings; a decisão é pura
5. Renderer (`index.html` + `spring.js`) — palco **fixo** (janela nunca redimensiona; ~520×410 a validar com Bouncy), mola, hit-test contra o retângulo vivo da pílula, trava dos botões

Padrões: funil único, eco que só estreita, sensor nativo atrás de dados puros, preferência como esquema + `sanitize`. Anti-padrões: redimensionar janela para animar, ordenar scroll por urgência, snap por nível, hover por `forward`, preferência escrita pelo renderer, validação duplicada sem vetores comuns.

### Critical Pitfalls

1. **Botão em movimento sob o cursor** (P1) — armar por estado assentado (molas em repouso + permanência do cursor), não só por tempo; qualquer mudança de layout rearma; botões sem escala/nudge; `acceptDecision` puro e testado
2. **Decisão aplicada à sessão errada por scroll/snap/IPC** (P2, P3) — uma só fonte da verdade em `main`, seleção global entre monitores, eco de id, fila FIFO, snap rearma
3. **Roda: texto × sessão, e inércia do touchpad "lendo" o pedido novo** (P4) — scroll no texto só rola o texto, janela de 300 a 400 ms de silêncio após troca, "lido" zera
4. **Spike mal medido** (P14) — script commitado (`scripts/measure-footprint.ps1`), *private working set* da árvore inteira, três braços (Electron atual, Electron enxuto, Tauri), regra de decisão escrita antes, caminho de permissão incluído antes de adotar
5. **Janela invisível mas clicável / animação cara / DPI misto** (P5, P8, P9) — esconder rejeita decisão, rAF sob demanda e sombra estática, palco fixo com arraste preso ao próprio monitor
6. Também relevantes: guerra de topmost com o Windhawk (P11, nunca reafirmar por timer), encaixe sem saber a pílula do mod (P12), atalho Ctrl+Alt+C colidindo com AltGr no ABNT2 (P16), menu em janela `focusable:false` (P15), licença MIT com titular não confirmado (P20)

## Decisões padrão recomendadas (para escrever requisitos sem perguntar)

Onde os pesquisadores divergem ou deixam pergunta de produto aberta, estes são os defaults.

| Tema | Default recomendado | Origem / divergência resolvida |
|------|---------------------|-------------------------------|
| Base tecnológica | **Electron permanece**, salvo se o Tauri passar a regra de decisão inteira (abaixo) | Usuário: spike mede; STACK: Tauri é candidato, não favorito |
| Regra de decisão do spike | Tauri só se: (1) gates funcionais no Windows com os 2 monitores passam (transparência sem borda/flash, hover por `cursor_position` sem perder clique, clicar na pílula não tira o foco do Windows Terminal, acima de vídeo F11, posição certa nos dois monitores, atalho sem roubar foco); (2) *private working set* em S0 ≤ 60% do melhor Electron entre E1/E2/E3; (3) CPU em S1 ≤ a do E1; (4) plano para lógica de segurança duplicada, distribuição por binário e NSPanel no macOS | STACK (escrever antes de medir) + PITFALLS P14 |
| Spike em dois estágios | Estágio A: medição barata (UI idêntica, `onState` real, demais no-op, 1 a 2 dias). Estágio B, **só se A passar**: caminho de permissão ponta a ponta e gates funcionais antes de adotar | STACK (shim mínimo) × PITFALLS (permissão obrigatória): reconciliados por estágio |
| Otimizações independentes de base | Entregar E1 (trocar `glow` por pseudo-elemento animando só `opacity`/`transform`, `animation:none` em `idle`/escondida) como produto, e oferecer modo "uma ilha" (principal/seguir cursor) como preferência, **sem** trocar o padrão de uma ilha por monitor | STACK |
| Seleção de sessão | **Global** em `main`; todas as ilhas espelham | Unânime (ARCH, PITFALLS) |
| Ordem e lista | Ordem estável por `firstSeenAt` (mais antiga à esquerda, desempate por `id`), sem wrap; só sessões **vivas** (filtro por `windowPid`/idade e poda de arquivos); sessão `done` sai como hoje | ARCH (decisão de produto em aberto) |
| Snap-back | Por **borda** (uma vez por `requestId`); se o usuário rolar para longe, não puxa de novo e o ponto segue pulsando (`waitingElsewhere`). "Volta sozinho" = pedido **novo** puxa a seleção | FEATURES decisão 1 + ARCH |
| Pedido já em exibição | Pedido novo de outra sessão **enfileira** (FIFO, "1 de N"), não atropela o que está em leitura; ao resolver, vai para o próximo pendente, senão volta ao modo automático | PITFALLS P2 + FEATURES |
| Quando o snap acontece | Nunca durante gesto de scroll ativo (<400 ms do último `wheel`); trava de scroll de 300 a 500 ms após snap; todo snap rearma | FEATURES + PITFALLS |
| Scroll com permissão na tela | Só sobre cabeçalho/pontos troca de sessão (preciso para o usuário poder sair); sobre o texto, só rola o texto; toda troca rearma | ARCH (permite) × PITFALLS (desliga): meio-termo seguro, ver I6 |
| Auto-troca | Só para permissão; nunca para "concluído" ou "voltou a trabalhar"; sem som novo na troca | FEATURES |
| Permissão com ilha escondida ou tela cheia | Só o som; **não** reexibe (terminal decide em paralelo) | Unânime nas três fontes |
| Atalho de aprovação, aprovar em lote, "Permitir sempre" | Fora do milestone | FEATURES |
| Hover | `main` faz polling de `screen.getCursorScreenPoint()` (~30 a 60 Hz só com pílula visível e cursor na janela+margem, ~10 Hz fora, zero em `idle`); renderer faz o hit-test no retângulo vivo e responde `island:capture(bool)`; histerese (~6 px entra, ~8 px sai); `forward` abandonado; `expandOn: hover` padrão, `click` opcional | ARCH + STACK + PITFALLS, faixas reconciliadas |
| Preferências | `preferences.json` separado de `positions.json`, com `version`; `hidden` **não** persiste; deslocamento = o que o arraste já produz (relativo à âncora), sem segundo offset numérico; arraste preso ao monitor da própria ilha | ARCH + PITFALLS |
| Atalho global | Padrão Ctrl+Alt+C **somente se** um teste no ABNT2 mostrar que não rouba AltGr+C; senão padrão `Ctrl+Shift+Alt+F12`. Sempre configurável, tratar `register()==false` visível no menu, `unregisterAll` em `will-quit` | PITFALLS P16 + STACK |
| Tela cheia (Windows) | Polling de 2 Hz de `GetForegroundWindow` vs monitor, ignorando janela própria e `Progman`/`WorkerW`, esconde **só a ilha do monitor coberto**; `koffi` se o Electron ficar; sem PowerShell em loop | STACK + PITFALLS P13 |
| Linux | Forçar X11/XWayland (`--ozone-platform=x11` na linha de comando do spawn); Wayland nativo fora de escopo | STACK + PITFALLS |
| macOS/Linux | "Melhor esforço, não testado" declarado no README; `app.dock.hide()` no macOS; recurso novo atrás de checagem de plataforma | PITFALLS P21 |
| Convivência com o Windhawk | Dock lateral por **deslocamento fixo configurável** a partir do centro (não tenta medir a pílula dele), expansão **para fora**, detecção opcional por classe; nunca reafirmar topmost por timer; plano B é âncora/deslocamento manual | PITFALLS P11/P12 + ARCH |
| Outros caminhos de integração | Abrir uma issue/proposta de API ao autor do mod (custo zero de código, única solução de raiz); toast, SuperIsland, WinLand, API de tarefas da barra do Windows: só registrar, sem implementar | FEATURES |
| NotchNook com aprovação de Claude Code | Testar antes de prometer convivência (como o Claude Code combina dois hooks `PermissionRequest` não foi verificado); prioridade baixa | FEATURES |
| Tema e legibilidade | Bloco de permissão com tokens próprios de contraste (≥4,5:1 texto, ≥3:1 controles), teste puro de contraste dos 8 temas, acento nunca pinta o comando; sem blur/acrílico no milestone (recorte arredondado exigiria código nativo) | PITFALLS P6 + FEATURES |
| Fontes | `font-family` do sistema, nada embarcado; larguras não fixas em pixels do Windows | PITFALLS P20 |
| Licença | `THIRD_PARTY_NOTICES.md` com texto MIT completo, versão 1.4.0 do mod, URLs e titular conferido no `LICENSE` do repositório do autor, antes do primeiro commit de constantes portadas; aviso curto no arquivo com as constantes | PITFALLS P20 |
| Mola | Constantes do mod (crescer k=380/c=26; encolher k=200/c=28; neutro k=280/c=24; troca de aba k=250/c=31, 34 px, escala 0,965); palco dimensionado para Bouncy a 2× (~520×410) e validado visualmente; `prefers-reduced-motion` pula a mola | STACK + ARCH + PITFALLS |

## Implications for Roadmap

Fases sugeridas, em ordem. A decisão de runtime (Fase 1) é portão: se o Tauri vencer, insere-se uma fase de port antes das fases dependentes de runtime (5 a 9). As fases 2 a 4 são portáveis nas duas bases e não são desperdiçadas em nenhum resultado.

### Fase 1: Spike de medição e decisão de base
**Rationale:** Decisão do usuário; bloqueia só o trabalho de `main`. Barato (1 a 2 dias, time-box) e conclusivo se o método for fixado antes.
**Delivers:** `scripts/measure-footprint.ps1` commitado; medição de E0 (atual), E1 (sem animações CSS), E3 (uma janela) e T0 (casca Tauri) em S0/S1/S2, 3 execuções, mediana; registro da decisão em `PROJECT.md`. Estágio B (gates funcionais + permissão ponta a ponta) só se T0 passar no estágio A.
**Uses:** Rust/MSVC já instalados; WebView2 157; `userDataFolder` exclusiva.
**Avoids:** P14 (número errado, comparação injusta, custo afundado), P7 (provar hover por polling nas duas bases), P8 (CPU como critério).

### Fase 2: Fundação segura e portável
**Rationale:** O gate precisa existir e estar testado **antes** de qualquer feature que mude o que está na tela; `refresh()` é o ponto único que rearma. Paralelizável com a Fase 1, não depende dela.
**Delivers:** funil `refresh()`; `acceptDecision` puro com eco de id, 800 ms, primeiro clique vence; testes (fecha o gap de `island:decide`); `webPreferences` explícitas (`sandbox`, `contextIsolation`, `nodeIntegration`); `armMs` no payload (elimina constante duplicada); `readSessions` com `id` e `firstSeenAt`; filtro de vivacidade e poda; `sanitizePreferences` com testes de arquivo truncado/antigo; vetores dourados de permissão (`fixtures/permission-vectors.json`); `THIRD_PARTY_NOTICES.md`; troca do `glow` (E1 como produto).
**Addresses:** requestId amarrado às ações (P1 de FEATURES).
**Avoids:** P1, P2 (desenho do gate), P17, P20.

### Fase 3: Palco fixo, mola, nudge e hover scale
**Rationale:** Base visual e de interação de tudo o mais; portável.
**Delivers:** `spring.js` + testes por propriedade (overshoot 4% a 8% ao crescer, <0,5% ao encolher, `retarget` preserva velocidade, assenta <1 s, sem NaN com `dt` de 1 a 200 ms); conteúdo na largura final com pílula recortando; palco ampliado uma vez; 4 estilos e velocidade; `reduced-motion`; armamento por estado assentado no renderer; hover ainda pelo DOM atual.
**Uses:** `spring.js`, rAF sob demanda.
**Avoids:** P1, P9, P10, P18.

### Fase 4: Temas, formas e material
**Rationale:** Depende do palco e de `data-*`; baixa complexidade.
**Delivers:** 8 temas por tokens + automático, 3 formas, camadas de material, acento por estado, tokens de contraste do bloco de permissão, teste de contraste.
**Avoids:** P6, P23, P24.

### Fase 5: Hover por cursor e click-through dinâmico
**Rationale:** Base do scroll. Depende da decisão de runtime (é código de `main`).
**Delivers:** `cursorTick`, `island:cursor`/`island:capture`, histerese, `expandOn: click`, fim do `forward` e do gate `CAN_CLICK_THROUGH`; teste com terminal elevado (UIPI) e monitor a 125%.
**Avoids:** P7, P8, P19.

### Fase 6: Preferências, menu, atalho, âncora
**Rationale:** Menu depende de persistência; atalho e esconder alimentam a Fase 8.
**Delivers:** `preferences.js`, menu nativo (`Menu.popup({window})`), atalho global com tratamento de falha, `anchorPosition`, `effectiveOpacity`, esconder que rejeita decisão e rearma ao reexibir, modo "uma ilha" opcional.
**Avoids:** P5, P15, P16, P17, P22.

### Fase 7: Sessões — seleção, scroll, pontos, snap e fila
**Rationale:** Entrega central do milestone; precisa do gate (2), do palco/mola (3) e do hover/capture (5).
**Delivers:** `nextSelection`, `wheelStep`, `waitingElsewhere`, pontos por sessão com rótulo, fila FIFO "1 de N", snap por borda, regras de inércia (I6), transição direcional; P2: clique e pré-visualização no ponto.
**Avoids:** P2, P3, P4.

### Fase 8: Esconder em tela cheia (Windows)
**Rationale:** Depende de `islandVisibility` (Fase 6) e da decisão de FFI/helper/Rust (Fase 1).
**Delivers:** `platform-probe.js` + `isCoveringMonitor`; esconde por monitor; ignora `Progman`/`WorkerW`.
**Avoids:** P13, P5.

### Fase 9: Convivência com ilha do sistema (Windhawk)
**Rationale:** Maior incerteza e menor ganho (só o autor, só Windows); por último e cortável.
**Delivers:** `dockPosition` por deslocamento fixo configurável, expansão para fora, detecção opcional por classe; medição de z-order por 5 min; issue de proposta de API ao autor do mod; registro dos demais caminhos de integração.
**Avoids:** P11, P12.

### Fase condicional: Port Tauri (somente se a Fase 1 decidir Tauri)
**Delivers:** casca → gate em Rust com vetores dourados → cursor tick, drag, prefs, menu, atalho, probe → `hook.js` lança o `.exe`; NSPanel no macOS; distribuição por binário. Entra antes da Fase 5.

### Phase Ordering Rationale

- Portável antes de runtime: renderer + lógica pura (2 a 4) valem nas duas bases; `main` (5 a 9) seria escrito duas vezes se o Tauri vencesse depois.
- Gate antes de features: `refresh()` e `acceptDecision` (2) precedem scroll (7), senão o scroll cria um segundo caminho de troca de pedido.
- Hover antes de scroll: o scroll só chega ao renderer com `capture` ligado.
- Integração por último: maior custo, só Windows, plano B manual já existe (âncora/deslocamento).

### Research Flags

Precisam de pesquisa na planificação (`/gsd-plan-phase --research-phase <N>`):
- **Fase 1:** método e scaffold Tauri nunca compilados; `in-process-gpu` no Electron 45, `focusable`/`shadow` do Tauri 2.12, foco do tao 0.37.1
- **Fase 5:** DPI a 125%, arredondamento de `getBounds()`, hover com terminal elevado
- **Fase 6:** `Menu.popup` em janela `focusable:false`, AltGr+C no ABNT2
- **Fase 8:** `koffi` dentro do Electron 45 e com `allowBuilds` do pnpm 11; ou crate `windows` se Tauri
- **Fase 9:** classe real da janela do mod, geometria nas duas ilhas, se o Electron reafirma topmost (pesquisa grande)
- **Fase condicional (Tauri):** NSPanel, transparência no macOS, WebKitGTK

Padrões conhecidos (pular research-phase):
- **Fase 2:** código do próprio repo; só exige testes primeiro
- **Fase 3:** mola já validada em Node; só confirmar carga de `spring.js` sob CSP (`script-src 'self'` via `file://`, teste de 10 min)
- **Fase 4:** tabela de cores pronta
- **Fase 7:** padrões conhecidos, mas exige teste de que `wheel` chega a janela não focável ("Rolar janelas inativas") e o plano próprio dos testes do gate

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Electron e APIs de janela: documentação oficial lida (HIGH). Nenhum número de Tauri existe neste projeto (LOW); evidência externa (um benchmark, método parcial) sugere ganho pequeno no Windows |
| Features | MEDIUM | Panorama de concorrentes vem de README e páginas de produto, não de uso; regras de multi-sessão são julgamento próprio apoiado na HIG |
| Architecture | MEDIUM-HIGH | Delta sobre código lido (HIGH); APIs de Electron/Tauri MEDIUM; vários itens listados como "a verificar" por teste curto |
| Pitfalls | MEDIUM | P1 a P6 vêm do código atual (HIGH); os de plataforma vêm de documentação e issues (MEDIUM), com vários marcados "não verificado" |

**Overall confidence:** MEDIUM. Suficiente para escrever requisitos e roadmap; as incertezas são todas resolvíveis por teste curto dentro das fases indicadas.

### Gaps to Address

- **Nenhum número de Tauri neste projeto:** Fase 1 resolve. Não decidir por números de terceiros nem pelo "14 MB" (mede só o processo do app, sem os `msedgewebview2.exe`)
- **Os 426 MB têm método não registrado:** re-medir o Electron atual com o mesmo script (E0); não comparar com o número antigo
- **`wheel` sob click-through e em janela não focável:** teste de 10 linhas na Fase 5/7; fallback é documentar a exigência
- **`Menu.popup` com `focusable:false`:** Fase 6; fallback é menu em HTML dentro do palco (hit-test passa a incluí-lo)
- **AltGr+C no ABNT2 e `register()==false`:** Fase 6, regra de default já definida acima
- **Classe da janela do Windhawk e se o Electron reafirma topmost:** Fase 9; confirmar na tela antes de qualquer promessa de encaixe
- **Como o Claude Code combina dois hooks `PermissionRequest` concorrentes** (relevante com NotchNook): testar antes de prometer convivência no macOS
- **Titular exato do copyright do mod e origem da paleta Nord:** ler o `LICENSE` do repositório do autor antes de portar constantes
- **`koffi` em Electron 45 e com pnpm 11 (`allowBuilds`):** verificar na primeira chamada de `user32.dll`
- **Se o hook já grava `cwd`/nome do projeto** para o rótulo da sessão: conferir na Fase 2; se não, é mudança de contrato no hook (única exceção prevista ao "hooks inalterados")
- **macOS e Linux:** nada medido nem testado; qualquer decisão de base declara que vale para o Windows

## Sources

### Primary (HIGH confidence)
- Código local: `main.js`, `state.js`, `index.html`, `window.js`, `preload.js`, `package.json`, `.planning/codebase/*`, `.planning/PROJECT.md`
- `.planning/research/WINDHAWK-MOD.md` (fonte do mod lida diretamente)
- Electron docs: BrowserWindow, screen, globalShortcut, process model, timelines (releases.electronjs.org: 45.4.1)
- Tauri 2.12.7: docs.rs e v2.tauri.app (janela, config, global-shortcut), changelog do tao 0.37.1
- Microsoft Learn: WebView2 (processos, desempenho), `SHQueryUserNotificationState`
- Medições nesta máquina: Rust 1.99.1, MSVC, WebView2 157, script de medição contra a árvore do Edge, `spring.js` em Node 26

### Secondary (MEDIUM confidence)
- Issues do Tauri #9250, #11461 (click-through sem `forward`), Electron #41602, PR #52365 (oclusão), DPI misto (Electron #7145, #18622)
- README/páginas de concorrentes: Vibe Island, ClaudeNotch, ClaudeDot, Claude Status Bar, code-island, Open Island, NotchNook, Alcove, boring.notch, Atoll, SuperIsland, WinLand, Lumen
- Apple HIG, Live Activities (lida na íntegra)
- `koffi` (registro npm e koffi.dev)

### Tertiary (LOW confidence)
- Benchmarks de terceiros de memória Tauri × Electron (método parcial): 142 MB × 149 MB
- Relato de overlay Tauri (dev.to): NSPanel, roubo de foco; o "14 MB" foi descartado
- Inferências marcadas como não verificadas: `in-process-gpu` no Electron 45, `GetCursorPos` entre níveis de integridade, `getCursorScreenPoint` em XWayland, API de tarefas da barra do Windows, `macOSPrivateApi`

Detalhes completos em `STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md` e `WINDHAWK-MOD.md` (mesmo diretório).

---
*Research completed: 2026-11-21*
*Ready for roadmap: yes*
