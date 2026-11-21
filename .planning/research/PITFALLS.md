# Pitfalls Research

**Domain:** Overlay de desktop transparente, sem foco, sempre no topo, que também é fronteira de confiança (aprova permissões do Claude Code). Milestone de reformulação: spike Electron × Tauri, molas, hover por cursor, temas/formas, menu nativo, atalho global, esconder em tela cheia, âncora/DPI misto, scroll entre sessões, encaixe ao lado de overlay C++ (Windhawk).
**Researched:** 2026-11-21
**Confidence:** MEDIUM. Os riscos de segurança e de arquitetura (P1 a P6) vêm da leitura do código atual (`CONCERNS.md`, `main.js`) e são HIGH. Os de plataforma vêm da documentação do Electron e da Microsoft (HIGH onde há link) e de relatos de issues (MEDIUM). O que é inferência ou não foi verificado está marcado como **[não verificado]**.

Convenção de fases usada em "Fase": **Spike** (decisão tecnológica) · **Port** (comportamento + visual, incluindo scroll entre sessões) · **Integração** (ilha do sistema).

---

## Critical Pitfalls

### Pitfall 1: O botão se move sob o cursor (mola, hover e expansão) e o clique cai em "Permitir"

**What goes wrong:**
Hoje a ilha expande e o usuário pode clicar. Com hover pela posição do cursor (sem atraso), mola com overshoot, "nudge" de -6 px e escala 1,025 no hover, a geometria dos botões muda durante ~0,3 s (mais com o estilo Bouncy: ~21% de overshoot sobre a diferença de tamanho). O usuário mira em "Negar", a pílula ainda está crescendo, e o clique acerta "Permitir". Também ocorre o inverso: o usuário clica no terminal por trás da ilha no instante em que ela expande sob o cursor e o clique é entregue a um botão.

**Why it happens:**
O atraso de 0,8 s (`PERMISSION_ARM_MS`) conta tempo de relógio desde a troca do pedido. Não sabe nada sobre a animação: o pedido pode estar armado enquanto a pílula ainda se mexe, ou a ilha pode reexpandir (hover saiu e voltou, troca de forma, troca de tema que muda o tamanho) sem que o relógio reinicie. O mod de referência não tem esse problema porque não aprova nada.

**How to avoid:**
- Armar por **estado assentado**, não só por tempo: botões só aceitam clique quando (a) a mola de largura e a de altura estão em repouso (|x-alvo| e |v| abaixo de um epsilon por N quadros) E (b) passou o atraso mínimo desde o último evento que mudou o que está na tela (pedido, sessão exibida, forma, tema, expansão).
- Qualquer mudança de layout dos botões (hover que reexpande, `pin`, mudança de forma/tema/escala, troca de monitor) **reinicia o armamento**. Nada de "armado uma vez, armado para sempre".
- Exigir permanência do cursor sobre o botão (ex.: 150 a 300 ms de `pointerenter` antes do `pointerdown`) e `pointerdown` + `pointerup` dentro do mesmo botão. É o mesmo princípio dos atrasos de proteção de entrada em diálogos de permissão de navegador **[prática geral, sem fonte própria]**.
- Os botões não devem sofrer a escala de hover nem o nudge: aplicar `transform` só ao contêiner da pílula, nunca ao bloco de ação; ou desligar a escala enquanto houver permissão em exibição.
- Mover a regra para uma função pura em `state.js` (`canDecide({...})`) com teste `node:test`: o gate de `island:decide` hoje não tem teste algum (`CONCERNS.md`, "Process entry points and IPC", prioridade alta).

**Warning signs:**
Teste manual: forçar um pedido, mover o cursor para o botão antes da pílula terminar de crescer e clicar o mais cedo possível; o clique tem de ser descartado. Clique rápido logo depois de passar o mouse numa ilha já recolhida. Com estilo Bouncy e velocidade 2×.

**Phase to address:** Port (o desenho do gate); verificar de novo no Spike se o protótipo Tauri reproduz o mesmo gate.

---

### Pitfall 2: A decisão é aplicada a uma sessão diferente da que estava visível (scroll, auto-snap, corrida de IPC)

**What goes wrong:**
Hoje a proteção é boa: o renderer só manda `allow`/`deny`, nunca o id; `main.js` usa `shownPermissionId` e descarta cliques nos 0,8 s após a troca. Com scroll entre sessões e "volta sozinho para a sessão que pedir permissão", surge um estado novo: **qual sessão o usuário está olhando** (índice de aba). Se esse estado vive no renderer e `main.js` continua decidindo pelo `shownPermissionId` global, o usuário vê a sessão A (sem permissão, ou com outro pedido), o auto-snap troca para B no meio do clique, e o IPC chega depois da troca: o "Permitir" vale para B, que o usuário nunca leu.

**Why it happens:**
Duas fontes da verdade ("o que `main` acha que está em exibição" × "o que o renderer pintou"), e latência entre elas (poll de 400 ms em `main`, mola de ~0,3 s, IPC). O auto-snap é, por construção, uma mudança de conteúdo que ocorre sem ação do usuário, o caso clássico de clickjacking por troca de conteúdo.

**How to avoid:**
- **Uma só fonte da verdade, em `main`**: o índice da sessão exibida e o pedido exibido por janela vivem em `main`; o renderer só manda intenções ("scroll +1", "allow", "deny").
- **Token de geração**: `main` incrementa um contador a cada mudança do que é renderizado (pedido, sessão, forma, tema). O renderer devolve, no clique, a geração que ele pintou por último; `main` rejeita se for diferente da atual. O id continua sem ser enviado pelo renderer; a geração é só um token anti-corrida, não autoridade.
- Auto-snap **reinicia o armamento** (Pitfall 1) e a troca de sessão por scroll também reinicia, mesmo que a nova sessão não tenha permissão (ida e volta rápida A→B→A).
- Enquanto houver permissão em exibição, **o scroll não troca de sessão** (ver Pitfall 4); o auto-snap só entra se não houver pedido já em exibição. Pedidos simultâneos de duas sessões entram numa **fila**, um por vez, na ordem de chegada, com rearme a cada passo. Nunca "o mais recente atropela o que o usuário está lendo".
- Decisão de produto a registrar: depois de decidir, a ilha volta para a sessão que o usuário estava vendo ou fica na seguinte da fila? Escolher uma regra e testá-la.

**Warning signs:**
Teste automatizado com `main` simulado: sequência `snap(B)` entre o `pointerdown` e o `island:decide` deve descartar. Qualquer lugar em que o renderer calcula sozinho "qual pedido é este".

**Phase to address:** Port (scroll entre sessões). Bloqueante para o fechamento da fase.

---

### Pitfall 3: Janelas por monitor mostrando sessões ou pedidos diferentes

**What goes wrong:**
Hoje todas as janelas recebem o mesmo estado e `island:decide` só confere que o remetente é uma das janelas. Se o scroll passar a ser por janela (cada monitor numa sessão), ou se uma janela estiver escondida/em tela cheia e a outra não, o usuário pode ver "Permitir ls" no monitor 1 enquanto o monitor 2 mostra outro pedido; `shownPermissionId` é um só e vale para qualquer clique de qualquer janela.

**Why it happens:**
`shownPermissionId`/`shownPermissionSince` são globais; o novo estado de visualização é naturalmente "por janela" porque cada janela tem seu hover e seu scroll.

**How to avoid:**
- Regra simples e opinativa: **a sessão exibida é global** (mesmo índice em todas as ilhas); o hover e o tamanho é que são por janela. Um pedido de permissão aparece **igual em todos os monitores** (ou só no monitor do cursor, mas nunca pedidos diferentes ao mesmo tempo).
- Se um dia houver visualização por monitor, o estado `{ sessionId, permissionId, since, generation }` passa a ser por janela e `island:decide` consulta o da janela remetente (`islandOf(event)`), nunca o global.
- Decisões só valem de janelas **visíveis e não ocultas** (Pitfall 5). Uma janela escondida por tela cheia não pode ser fonte de clique válido.

**Warning signs:**
Qualquer variável nova de visualização declarada fora do `Map` de janelas; teste com dois monitores onde um está escondido.

**Phase to address:** Port.

---

### Pitfall 4: A roda do mouse serve a duas coisas (rolar o texto do pedido × trocar de sessão) e a inércia do touchpad "lê" o pedido novo

**What goes wrong:**
A regra de segurança atual exige rolar o texto até o fim para liberar "Permitir". Se a roda passar a trocar de sessão, o usuário que rola o texto pode trocar de sessão sem querer; pior, a **inércia do touchpad** continua emitindo `wheel` por centenas de ms depois do auto-snap, e essas rolagens caem no texto do pedido novo e o marcam como "lido até o fim" sem que o usuário tenha visto nada.

**Why it happens:**
O mod acumula delta até 120 e usa 220 ms de gesto novo, 85 ms entre passos (200 ms no touchpad) (`WINDHAWK-MOD.md`, §1). Copiar esses números sem a camada de permissão cria o conflito. Além disso, a checagem de "fim" usa `scrollHeight`/`clientHeight` (`index.html:285-286`), que já é frágil com DPI fracionário (`CONCERNS.md`, "Fragile Areas").

**How to avoid:**
- Com permissão em exibição, `wheel` **só** rola o texto; troca de sessão fica desligada (e o contador de abas mostra um aviso, não permite trocar). Ver Pitfall 2.
- "Leu até o fim" precisa ser **zerado a cada mudança de pedido ou de geração** e só contar rolagem posterior ao fim do armamento (Pitfall 1); ignorar eventos de roda dentro de uma janela de ~300 ms após qualquer troca de conteúdo (cobre a inércia).
- Tolerância na checagem do fim (`scrollTop + clientHeight >= scrollHeight - 2`) por causa de DPI 125%, e **nenhuma** transformação `scale` no elemento rolável.
- Não dar a volta no fim da lista de sessões (o mod também não dá); evita que um gesto longo gire e pouse num pedido.

**Warning signs:**
Rolar rápido com touchpad ao chegar um pedido: o botão "Permitir" não pode liberar sozinho.

**Phase to address:** Port.

---

### Pitfall 5: Ilha invisível, quase invisível ou fora da tela, mas ainda clicável

**What goes wrong:**
Esconder (atalho, menu, tela cheia, auto-hide), transparência de 55% e Ctrl+hover translúcido (opções do mod) criam estados em que o usuário **não vê** o pedido, mas a janela continua recebendo clique. Um "esconder" feito com `setOpacity(0)` ou só com CSS deixa botões vivos. Pior: o usuário vê 55% de opacidade com tema claro e lê mal o comando.

**Why it happens:**
Reimplementar "esconder" como visual em vez de estado. No mod, esconder estaciona a thread de render; aqui o renderer segue de pé.

**How to avoid:**
- "Esconder" = `island.hide()` (ou desligar o ignore + sem hit-test) **e** `island:decide` rejeita se a janela não estiver visível; checar `island.isVisible()` e um flag de `hidden` em `main`.
- **Com permissão em exibição, a opacidade vira 100%** (ou piso ≥ 85%), independentemente da preferência; Ctrl+hover translúcido desligado.
- Reexibir (atalho ou hover estacionado) **rearma** (Pitfall 1); o mod força exibição pelo hotkey, e aqui isso pode mostrar um botão armado atrás de um jogo.
- Se a janela está fora da área de trabalho (monitor removido, âncora + offset fora), não aceitar decisão; o `clamp` atual cobre posição, mas não o caso "escondida".
- Falha segura: esconder nunca aprova; o terminal segue valendo em paralelo (decisão de projeto existente).

**Warning signs:**
Pedido pendente + atalho de esconder + clique na posição onde ficava o botão.

**Phase to address:** Port (esconder/menu/atalho), Integração (tela cheia).

---

### Pitfall 6: Temas e material (reflexo de acento) reduzem a legibilidade do texto da permissão

**What goes wrong:**
O mod tem 8 temas com secundário ≈4,5:1 e uma "lavagem de acento" radial tingida pela cor do estado (laranja em "precisa de você"). Sobre o claro Porcelain ou sobre Nord, o texto do comando e o rótulo dos botões podem cair abaixo do contraste legível, e botões Permitir/Negar com cores de acento deixam de ser distinguíveis (daltonismo; Negar em vermelho sobre fundo ameixa).

**Why it happens:**
Temas são tratados como paleta, mas a regra "usuário só aprova o que viu" depende de legibilidade, que o tema não pode degradar.

**How to avoid:**
- O bloco de permissão usa **tokens próprios de contraste garantido** (≥ 4,5:1 para texto, ≥ 3:1 para controles) calculados por tema; o acento nunca pinta o texto nem o fundo do comando.
- Teste puro em `node:test` que calcula contraste de todos os pares (tema × texto/secundário/botão) e falha abaixo do limite. As cores do mod são constantes conhecidas (`WINDHAWK-MOD.md`, §2), então o teste é barato.
- "Permitir" e "Negar" diferem por rótulo e posição fixa, não só por cor; mesma ordem em todos os temas e formas (nada de formas que movam um para fora da vista, ex.: notch com cantos cortando).

**Warning signs:**
Revisar cada tema com um pedido de 600 caracteres e 20 linhas (limite atual).

**Phase to address:** Port.

---

### Pitfall 7: Click-through "forward" não é portátil nem completo (UIPI no Windows, Linux/Wayland, flip-flop de borda)

**What goes wrong:**
- Windows: o `forward` do `setIgnoreMouseEvents` **para temporariamente quando uma janela elevada (admin) ganha foco** (UIPI), segundo a documentação do Electron. Se o terminal com o Claude Code estiver elevado, o hover pela mensagem do renderer deixa de funcionar.
- Linux: `forward` não existe (por isso `CAN_CLICK_THROUGH = false` hoje; a janela de 440×324 vira um retângulo que engole cliques). Wayland: `screen.getCursorScreenPoint()` **não é suportado**, e `setBounds`/`setPosition` têm as mesmas limitações do `setSize`/`setPosition` do Wayland; `setAlwaysOnTop` com nível **não é suportado no Wayland**.
- Todas: se a janela alterna `ignore` por causa do hover na borda da pílula, o cursor oscila entre "dentro" e "fora" (flip-flop) e o conteúdo pisca ou expande/recolhe em loop.
- Em transparência, o clique que cai em área ignorada vai para a janela de baixo (por design); se o hit-test do renderer e o de `main` divergirem, o clique "some".

**Why it happens:**
O `forward` dá hover "de graça" em Windows/macOS e leva a crer que é o mecanismo portátil; o mod do Windhawk usa `GetCursorPos` a cada quadro, não evento do compositor.

**How to avoid:**
- **Hover por polling de `screen.getCursorScreenPoint()` em `main`** como mecanismo único em Windows e macOS (mais robusto que `forward` sob UIPI; `GetCursorPos` entre níveis de integridade **[não verificado]**), e `forward` só como complemento.
- Hit-test com **histerese**: margem de entrada menor que a margem de saída (ex.: 2 px para entrar, 8 px para sair) e atraso mínimo para recolher; evita o flip-flop.
- Um só dono da geometria: se o renderer anima a pílula, `main` não pode adivinhar o retângulo. Opções: `main` envia o cursor relativo à janela e o renderer responde `interactive: true/false` (2 saltos de IPC, aceitável); ou o renderer publica o retângulo assentado a cada mudança de estado, não por quadro.
- **Linux/macOS: não prometer.** O autor nunca testou nenhum dos dois. Em Wayland, degradar explicitamente (sem hover, expandir por clique, janela do tamanho da pílula, sem âncora global) ou documentar como não suportado; rodar via XWayland pode ou não resolver (`getCursorScreenPoint` em XWayland **[não verificado]**).
- Testar o caso elevado: abrir um terminal "Executar como administrador" e conferir hover e clique.

**Warning signs:**
Hover que morre ao focar um terminal admin; ilha que "vibra" com o cursor parado na borda; reclamações de cliques perdidos nas áreas transparentes.

**Phase to address:** Spike (provar o mecanismo em Electron e em Tauri, que no Windows usa `WS_EX_TRANSPARENT` sem forward, ver Pitfall 14) e Port.

---

### Pitfall 8: Polling de cursor e animação fazendo a ilha custar mais que a pílula vale

**What goes wrong:**
O objetivo do milestone começa em "426 MB e ~1,5% de CPU parado". Trocar o poll de 400 ms por 60 Hz permanente, rodar `requestAnimationFrame` sempre, ou animar `width`/`height` por quadro com `box-shadow` grande em janela 440×324 (×2 monitores) pode piorar o CPU e o uso de GPU, o contrário da meta.

**Why it happens:**
O mod consegue "CPU ~0" só estacionado e acorda a cada 16 ms visível (`WINDHAWK-MOD.md`, §5); copiar o loop contínuo traz o custo. E animar `width`/`height` gera layout por quadro; sombra concêntrica e gradientes redesenham toda a superfície transparente.

**How to avoid:**
- Polling **em duas taxas**: ~60 Hz só quando o cursor está dentro do retângulo da janela (inclusive a margem), ~5 a 10 Hz fora; zero com a ilha escondida.
- Loop de mola sob demanda: `requestAnimationFrame` só enquanto a mola não está em repouso; parar ao assentar. Nada de rAF ocioso. A animação CSS de pulso (já existente) é suspeita da baseline de 1,5%: **medir o que consome o 1,5% antes de acusar o poll** (o poll de 400 ms em `main` é barato; **[hipótese]** o contorno pulsando pode ser o dono).
- Sombra e reflexo de acento como **camada estática** (pré-renderizada), animando só `transform`/`opacity`; `contain: layout paint` e `will-change` no contêiner; medir com e sem a sombra.
- Adicionar essa leitura (CPU/GPU em repouso e durante animação) aos critérios do Spike, não só memória.

**Warning signs:**
CPU acima da baseline parado; processo GPU do Electron sempre ativo; ventoinha do notebook.

**Phase to address:** Spike (critérios) e Port (implementação).

---

### Pitfall 9: Redimensionar a janela durante a animação, e DPI misto (100% e 125%)

**What goes wrong:**
No Windows com escala fracionária a janela transparente muda de tamanho a cada `setPosition` (já descoberto: o código usa `setBounds` explícito). Há relatos de a janela crescer ~25% ao arrastar de um monitor escalado para um sem escala e de um DIP arredondar de 401 para 402 a 125% (OpenFin; issues do Electron). Redimensionar a janela a cada quadro de mola causa flicker e erros de arredondamento. O arraste manual atravessando o limite entre monitores de DPI diferentes dispara o problema.

**Why it happens:**
Conversão DIP ↔ pixel físico com arredondamento por monitor; `getBounds`/`setBounds` em coordenadas DIP do espaço virtual, com escala relativa ao monitor que contém o ponto (documentação de `screen.dipToScreenPoint`).

**How to avoid:**
- **Palco fixo**: a janela mantém tamanho constante e a pílula anima dentro dela (como o mod, que usa 880×320 + padding e nunca redimensiona). Nunca `setBounds` por quadro. Este projeto já tem janela fixa 440×324; o novo requisito é dimensionar o palco para o **maior overshoot** (Bouncy ≈ 0,21 × a variação de largura ≈ 50 px, mais a sombra e o nudge) para não cortar a pílula na borda da janela. Hoje a folga horizontal é 20 px, insuficiente para Bouncy.
- **Cada ilha fica no seu monitor**: restringir o arraste (e a âncora/offset) à área de trabalho do próprio monitor. Elimina o cruzamento de DPI e é mais simples que corrigir.
- Reafirmar o tamanho com `setBounds` depois de `show` e após `display-metrics-changed` (a solução citada em issues do VS Code, **[MEDIUM]**), e logar `getBounds()` no teste.
- Guardar offsets em **DIP relativos à âncora**, não em pixels absolutos, e migrar o `positions.json` junto com a troca de referência (`CONCERNS.md`, "Multi-display identity").
- Bordas de 0,8 px do mod são arredondadas pelo Chromium para pixel físico inteiro: ficam diferentes a 100% e 125%; usar 1 px ou desenhar a linha por `box-shadow inset` e aceitar a diferença **[MEDIUM]**.
- Testar nos dois monitores do autor (2560×1080@100% e 1920@125%), que é o pior caso real.

**Warning signs:**
Janela com tamanho diferente após arrastar, pílula cortada na borda, linhas de 1 px com espessura diferente entre monitores.

**Phase to address:** Port.

---

### Pitfall 10: Mola instável com `dt` variável e overshoot cortado

**What goes wrong:**
As constantes do mod (k=380, c=26 ao crescer; ×1,5 no Snappy; velocidade até 2× multiplicando `dt`) foram feitas para passos fixos de 0,5 ms. Em `requestAnimationFrame` o `dt` é 16,7 ms e pode saltar para 100 ms ou mais (janela voltando de oculta, aba "throttled", GC). Com integração explícita, a mola **explode** (valores crescem sem limite) ou treme. Conta própria: mola massa 1 com k=380 tem ω≈19,5 rad/s; Snappy (k×1,5) tem ω≈24; a integração semi-implícita só é estável abaixo de `dt` ≈ 2/ω ≈ 0,08 s, e a 2× o `dt` efetivo de um quadro de 50 ms já é 0,1 s. Além disso, a primeira animação depois de `show()` recebe um `dt` gigante.

**Why it happens:**
Portar as constantes sem portar o integrador, ou usar `dt = now - last` direto.

**How to avoid:**
- **Passo fixo com acumulador** (ex.: 1/240 s, no máximo 4 a 8 passos por quadro) e teto de `dt` por quadro (≤ 50 ms), ou solução analítica da mola amortecida (estável para qualquer `dt`).
- Resetar `last` ao exibir/voltar a visibilidade (`visibilitychange`), para não integrar o tempo em que a janela esteve oculta.
- Lógica da mola em módulo puro testado com `node:test`: assentar sem NaN com `dt` aleatório de 1 a 200 ms, todos os 4 estilos e velocidades 0,5×/2×; overshoot máximo dentro da folga do palco; interrompível preservando velocidade.
- Desligar a animação com `prefers-reduced-motion` e oferecer "sem molas" (aprendizado de acessibilidade, barato).
- Se for o caso, **o tempo de armamento (Pitfall 1) usa o mesmo estado de repouso**, não um timer paralelo.

**Warning signs:**
Pílula que "pula" depois de esconder/mostrar; NaN no estilo; tamanho que oscila sem parar.

**Phase to address:** Port (e é uma comparação justa no Spike: rodar a mesma mola nos dois).

---

### Pitfall 11: Guerra de topmost com o Windhawk (dois apps reafirmando `HWND_TOPMOST`)

**What goes wrong:**
O mod reafirma o topmost a cada 1 s quando uma janela topmost cobre ≥ 1/8 da pílula dele (`EnsureTopmost`, `WINDHAWK-MOD.md`, §3). Nossa janela 440×324 cobre a pílula dele inteira. Entre janelas topmost vale a última `SetWindowPos`; se também reafirmarmos, as duas se alternam à frente (flicker, uma ilha que some por 1 s, pulsos de redesenho).

**Why it happens:**
A tentação de "garantir que a nossa fique por cima" com `setAlwaysOnTop` periódico, `moveTop()` ou `showInactive()` em timer. O Electron também pode reafirmar o z-order em chamadas como `show`/`setAlwaysOnTop`/`setBounds` **[não verificado: se o Electron reafirma o topmost; item já listado como "não confirmado" na pesquisa do mod]**.

**How to avoid:**
- **Não reafirmar topmost por timer.** Chamar `setAlwaysOnTop(true, 'screen-saver')` uma vez na criação; não chamar `show`/`showInactive`/`moveTop` periodicamente; só reaplicar depois de `display-added`/retorno de suspensão.
- A solução real é **geométrica, não de z-order**: encaixe lateral sem sobreposição (Pitfall 12) faz o critério de 1/8 do mod ser falso, e ele para de subir a janela dele.
- Medir antes de decidir: gravar o z-order (via PowerShell temporário no teste, não no produto) por 2 min com as duas ilhas e contar trocas.
- Nível `'screen-saver'` fica acima da barra de tarefas (a documentação separa `floating`..`status` abaixo e `pop-up-menu` em diante acima no Windows); manter, mas saber que cobre Iniciar/menu do sistema se o usuário abrir sob ela.

**Warning signs:**
Flicker periódico de 1 s; a ilha do mod piscando quando a nossa fica visível; CPU do `windhawk.exe` subindo.

**Phase to address:** Integração (com medição no Spike se o protótipo for Windows).

---

### Pitfall 12: Encaixar "ao lado" sem saber onde está a pílula do mod

**What goes wrong:**
A janela do mod é um **palco fixo de 880×320 (+ padding)**, e a pílula é desenhada dentro dela, com largura medida pelo conteúdo e que muda (ociosa, mídia 150×44, expandida 380×184, alertas de 180 a 360). `GetWindowRect` da janela dele dá o palco, não a pílula. Encaixar "ao lado" a partir desse retângulo coloca a nossa bolha 440 px afastada ou, ao contrário, sobreposta. Também: o hover do mod é pela posição do cursor, então se a nossa pílula expandida invadir o retângulo da dele, passar o mouse na nossa **expande a dele junto**, e as duas se cobrem.

**Why it happens:**
Assumir que a janela do app coincide com a forma visível; em overlays desenhados com layered window a janela é maior que a forma. O mod não expõe API nem arquivo (`WINDHAWK-MOD.md`, §3), e a classe `Windhawk.DynamicIslandForWindows` ainda está **a confirmar**.

**How to avoid:**
- **Não tentar medir a pílula dele.** Encaixar por **deslocamento fixo configurável** (lado e distância a partir do centro do palco/monitor) e ajuste manual pelo usuário, em vez de automático. Detectar apenas a presença (`FindWindow` por classe, ou nada) para ligar o modo.
- Nossa expansão cresce **para fora** (para o lado oposto ao dele), com a âncora na borda externa; a pílula expandida nunca cobre o retângulo da dele.
- Como o detector exige chamada nativa (Pitfall 13), a decisão de detecção só vale a pena se o mesmo helper já existir.
- Registrar o resultado como pesquisa de integração, junto da avaliação das alternativas (toast do Windows, proposta de API ao autor, apps de notch no macOS); a alternativa "proposta de API ao autor" é a única que resolve o problema de raiz e não custa código.

**Warning signs:**
Duas pílulas sobrepostas quando a do mod muda de largura; as duas expandindo juntas no hover.

**Phase to address:** Integração.

---

### Pitfall 13: Esconder em tela cheia no Windows: o Electron não tem API, e o remédio óbvio custa mais que o ganho

**What goes wrong:**
O mod checa a cada 0,5 s se o retângulo cliente da janela em foco cobre o monitor (`WINDHAWK-MOD.md`, §1). O Electron **não consulta janelas de outros processos**. As saídas todas têm custo:
- PowerShell a cada 0,5 s: o repositório mede ~0,45 s por chamada (`CONCERNS.md`, "Synchronous PowerShell"), ou seja, CPU constante e inviável.
- Helper persistente (PowerShell residente ou binário próprio): funciona, mas consome memória e vira mais um processo para ficar órfão quando o app morre.
- Dependência nativa (ex.: `koffi`/ffi): contraria "sem dependência nova" e entra em CI.
- `SHQueryUserNotificationState` resolve parte (tela cheia D3D, modo apresentação, ocupado), mas a documentação da Microsoft diz **não haver notificação quando um app em tela cheia começa ou termina**: é preciso poll; e responde pelo usuário, não por monitor.
Falsos positivos clássicos: o próprio desktop (`Progman`/`WorkerW`) cobre o monitor; vídeo em F11 ou apresentação; janela em **outro monitor** (a ilha do monitor 1 não deveria sumir porque um jogo ocupa o monitor 2); janela maximizada sem moldura que cobre a área de trabalho mas não o monitor inteiro.

**Why it happens:**
Subestimar o custo do "esconde em tela cheia" por parecer pequeno; é a funcionalidade com maior pressão para trazer código nativo.

**How to avoid:**
- No Spike, **incluir "esconder em tela cheia" como critério de comparação**: em Rust (Tauri) a chamada Win32 é nativa e barata; em Electron exige helper ou addon. É o argumento mais concreto a favor de um dos lados.
- Se ficar em Electron: **um único helper persistente**, com a vida atrelada ao pai (encerrar ao fechar o stdin), poll de 0,5 a 1 s dentro do helper (não do Node), emitindo só mudanças; ignorar `Progman`/`WorkerW`/janelas do shell; comparar com o retângulo do **monitor** (`MonitorFromWindow`) e esconder **só a ilha desse monitor**; medir a memória do helper dentro do orçamento.
- Opcional e barato: escondida por tela cheia deve **permanecer visível se houver pedido de permissão pendente?** Decisão de produto: o pedido não aprovado só afeta o terminal, e um botão sobre um jogo é risco (Pitfall 5); a recomendação é esconder e deixar o terminal valer.
- Recurso só de Windows, como opcional, nunca como base (restrição do projeto): atrás de um *feature detect*.

**Warning signs:**
`powershell.exe` aparecendo em loop; ilha somindo no monitor errado; ilha sumindo sobre a área de trabalho.

**Phase to address:** Spike (medir o custo) e Integração (implementar).

---

### Pitfall 14: Spike Electron × Tauri medindo errado, comparando injustamente ou virando reescrita por inércia

**What goes wrong:**
1. **Memória contada errada.** No Tauri em Windows o WebView2 roda como processo(s) `msedgewebview2.exe` (browser, renderer(s), GPU, utility), filhos do app; ao medir só o `.exe` principal o Tauri parece 10× menor. No Electron o inverso pode ocorrer ao somar tudo. A coluna "Memória" do Gerenciador de Tarefas é conjunto de trabalho privado; a aba Detalhes pode mostrar o conjunto de trabalho completo, que inclui páginas compartilhadas. Blogs com 109 MB × 128 MB ou 172 MB × 409 MB mostram metodologia desconhecida; **tratar como não confiáveis**. Uma issue do próprio benchmark do Tauri aponta que o `mprof` usava `psutil` por padrão, não PSS/USS.
2. **Mesmo motor.** O Tauri no Windows usa Chromium (WebView2): a memória fica **na mesma ordem de grandeza** do Electron; o ganho vem de compartilhar um processo entre janelas e de não carregar o runtime do Node. Dois monitores = duas janelas WebView2 sob o mesmo grupo de processos (se a pasta de dados for a mesma), então a comparação por janela favorece o Tauri de modo estrutural, o que é um **ganho real**, mas é preciso medir, não presumir.
3. **Comparação injusta.** Electron "pelado" × Tauri "otimizado"; interface diferente; sem transparência; 1 monitor × 2; medindo no segundo 10 em vez do regime estável; WebView2 compartilhando pasta de dados com outro app (ex.: Teams) e herdando processos.
4. **O pior: o Spike só testa a pílula e não a fronteira de confiança.** Um protótipo bonito sem o caminho `PermissionRequest` → `decide` não prova que a reescrita é viável. A lógica pura (`state.js`, testada em `node:test`) e o instalador precisam ser portados ou executados via Node (sidecar), e o sidecar do Node anula a economia de memória.
5. **Click-through sem forward.** Em Tauri, `set_ignore_cursor_events` no Windows ignora o evento todo; relatos de issues (tauri#9250, #11461) mostram que o hover **deixa de chegar** à página enquanto ignorado, e o contorno comum é checar a posição do cursor por polling (como faz o plugin `tauri-plugin-polygon`). É compatível com o plano de hover por polling, mas precisa de Rust.
6. **Transparência e bordas.** Janela sem moldura no Windows pode receber contorno/sombra do DWM (comportamento de `shadow` em tao/Tauri **[não verificado nesta versão]**); em macOS a transparência do Tauri exige `macOSPrivateApi` **[conhecimento prévio, não verificado agora]**; WebKitGTK no Linux tem suporte irregular a transparência e a always-on-top.

**Why it happens:**
Medir é fácil de fazer errado e a conclusão é emocionalmente carregada (426 MB incomoda). E o autor só valida em Windows, de modo que os custos em macOS/Linux ficam invisíveis.

**How to avoid:**
- **Fixar o método antes de medir** e commitar o script de medição: soma de **conjunto de trabalho privado** de **toda a árvore** de processos (`ParentProcessId` até o app raiz) para os dois, por um mesmo script PowerShell, mesma métrica nos dois; pasta de dados do WebView2 **exclusiva** (`userDataFolder`); amostrar 3 a 5 min depois de estabilizar, ocioso e durante uma sequência fixa de animações, com 2 monitores, transparência ligada, **mesma `index.html`**.
- **Re-medir o Electron atual com o mesmo script.** Não comparar o Tauri novo com o número de 426 MB anotado em 2026-11-21 (método não registrado).
- **Três braços, não dois**: Electron atual, **Electron ajustado** (ex.: desligar o que não é usado, uma só janela, flags de memória; ganhos **[não verificados]**), e Tauri. Se o Electron ajustado chega perto, a reescrita não se justifica.
- **Critério de decisão escrito antes**: p. ex., "só migra se (a) redução ≥ X% na soma da árvore, (b) todos os comportamentos do Spike funcionam em Windows (transparência, topmost, sem foco, hover por polling, 2 DPIs, fullscreen-hide) e (c) o gate de permissão foi portado com os mesmos testes". Qualquer item falho = ficar no Electron.
- O protótipo **inclui o caminho de permissão ponta a ponta** (hook → arquivo → ilha → decisão → hook) mesmo que mínimo.
- Limitar o tempo (ex.: 1 a 2 dias) e registrar a decisão em `PROJECT.md` (Key Decisions). Armadilha do custo afundado: sair do Spike com "já está quase pronto" é o sinal de alerta.
- Nota de licença/dependência: WebView2 no Windows 10 antigo pode não existir; no Windows 11 vem instalado. Para macOS/Linux, só documentação, nada medido: não decidir por números que não existem.

**Warning signs:**
Número de memória sem script reproduzível; protótipo sem botões de permissão; comparação feita em um monitor; conclusão antes do critério.

**Phase to address:** Spike.

---

## Moderate Pitfalls

### Pitfall 15: Menu de clique direito nativo numa janela sem foco

**What goes wrong:**
`Menu.popup()` assume a janela focada por padrão (documentação: "Default is the focused window"), e a ilha nunca tem foco (`focusable: false`). Sem `{ window: island }`, o menu pode abrir sem dono ou no lugar errado. No Windows, menus nativos pedem que a janela dona seja a de primeiro plano para fechar ao clicar fora (comportamento clássico do `TrackPopupMenu`) **[conhecimento do Win32, não verificado no Electron com `focusable: false`]**; o menu pode **roubar o foco do terminal** e não devolver ao fechar (issue electron#41602 descreve o pai que não recupera o foco ao fechar um popup). Enquanto o menu está aberto, o polling de hover continua e a pílula recolhe/expande por baixo do menu.

**Prevention:**
Passar `window` explicitamente; abrir só a partir do `contextmenu` do renderer via IPC; pausar o hover e fixar a pílula enquanto o menu está aberto (evento `menu-will-close`/callback); reentregar o foco ao terminal ao fechar (guardar a janela em primeiro plano antes de abrir **[mais uma chamada nativa]**) ou aceitar e documentar. Testar: clicar fora fecha? O terminal continua com o cursor de texto? Com permissão pendente: o menu **não** deve conter ação que aprove, e `esconder` é seguro (Pitfall 5).

**Phase to address:** Port.

### Pitfall 16: `globalShortcut` (Ctrl+Alt+C): falha silenciosa e conflito com AltGr

**What goes wrong:**
`register` retorna `false` e **falha em silêncio** quando outro app já tem o atalho (documentação); `isRegistered` também dá `false` nesse caso. No Windows Ctrl+Alt é o que o sistema envia para **AltGr**: em teclados ABNT2/europeus, Ctrl+Alt+letra pode coincidir com caracteres digitados (ex.: AltGr+Q, W, E no ABNT2) **[conhecimento geral, não verificado]**; um atalho assim engole digitação. Wayland: usa o portal GlobalShortcuts e exige identidade válida (`desktopName`); GNOME pode negar sem erro para o app e mostra diálogo de consentimento na primeira vez (documentação). macOS: teclas de mídia exigem autorização de acessibilidade. O módulo não pode ser usado antes de `ready`.

**Prevention:**
Checar o retorno de `register`; se `false`, mostrar no menu ("atalho indisponível") e oferecer alternativa configurável, **sem tentar de novo em laço**; escolher um padrão sem Ctrl+Alt+letra (ex.: Ctrl+Shift+Alt+ tecla de função ou outro) ou testar com ABNT2; `unregister`/`unregisterAll` em `will-quit`; validar o acelerador salvo antes de registrar (`try/catch`, valor inválido → padrão); o atalho de mostrar **rearma** (Pitfall 5); não registrar no momento em que o segundo processo da trava de instância sai.

**Phase to address:** Port.

### Pitfall 17: Preferências persistidas corrompidas ou migradas errado

**What goes wrong:**
`positions.json` hoje é gravado com `writeFileSync` direto (sem rename atômico) e lido com `catch` que descarta tudo. Com tema, forma, estilo, velocidade, transparência, `pin`, âncora, offset e atalho no mesmo arquivo, uma queda no meio da escrita zera **todas** as preferências, e valores editados à mão (velocidade 0, transparência 0, enum inexistente, offset gigante) quebram a ilha ou a tornam invisível. A chave `display.id` já é instável (`CONCERNS.md`).

**Prevention:**
Escrita atômica (temp + rename, padrão que já existe para decisões); `version` no arquivo e migração do `positions.json` antigo; validação **por chave** com padrão por chave (não descartar o arquivo todo); `clamp` numérico (velocidade 0,5 a 2; transparência com piso, ver Pitfall 5); enum desconhecido → padrão; ignorar chaves extras e `__proto__`; backup do último bom ao carregar corrompido (renomear para `.bad`, não apagar). Teste puro com arquivos truncados, vazios, com tipos errados e do formato antigo. Offsets em DIP relativos à âncora (Pitfall 9).

**Phase to address:** Port.

### Pitfall 18: `requestAnimationFrame` e timers em janela escondida, ocluída ou sem foco

**What goes wrong:**
Chromium suspende o render e limita timers de janelas ocluídas/escondidas; a documentação do Electron diz que com `backgroundThrottling` desligado a visibilidade permanece "visible" mesmo minimizada ou ocluída. No macOS, o heurístico de oclusão do Chromium ignorava a opacidade e **marcava janelas cobertas por overlay transparente/click-through como escondidas** (Electron PR #52365, de julho de 2026, backports ainda abertos para 42 a 44 na data consultada), então nossa ilha pode estar entre as janelas afetadas e, inversamente, pode "congelar" outras janelas de Electron sob ela. No Windows o Chromium também trata janela ocluída como em segundo plano (documentação de oclusão nativa).

**Prevention:**
Não depender de timers do renderer para regras de segurança: o armamento e os prazos continuam em `main` (como já é). Mola e nudge pausam sozinhos ao ocultar e retomam com `dt` zerado (Pitfall 10). Não ligar `backgroundThrottling: false` globalmente para "consertar": faz a ilha animar escondida. Conferir em Windows se a ilha, com o terminal em tela cheia por cima, para o rAF e volta certo. macOS: **[não testado]**.

**Phase to address:** Port.

### Pitfall 19: O `forward`, a janela transparente e o arraste manual

**What goes wrong:**
O arraste é manual por IPC (`movable: false`), e uma pílula animando durante o arraste, ou um clique que vira arraste, pode virar clique em "Permitir" (mouseup em cima do botão). Duplo clique fixa aberta (mod) e o duplo clique atual recentraliza: conflito.

**Prevention:**
Arrastar só pela barra/área da pílula fora dos botões; limiar de movimento antes de virar arraste; `pointerup` só dispara decisão se o `pointerdown` começou no mesmo botão (Pitfall 1); escolher um comportamento para duplo clique e documentar.

**Phase to address:** Port.

### Pitfall 20: Licença MIT: portar constantes e lógica sem o aviso certo

**What goes wrong:**
O cabeçalho do mod declara `@license MIT` mas **não traz linha de copyright** (conferido no arquivo local). O repositório do autor (`devcode90/Dynamic-Island-for-Windows`) diz usar MIT, e a seção de contribuição pede aos colaboradores que adicionem o nome nos créditos: **pode haver mais de um titular**; o ano e o titular exato não estão confirmados. A MIT exige manter o aviso de copyright e a permissão em cópias ou "partes substanciais". Além disso, o mod usa **Segoe UI Variable** e **Segoe Fluent Icons**, fontes proprietárias que não podem ser embarcadas, e o tema "Nord" usa a paleta do projeto Nord (também MIT, de outro titular) **[não verificado]**.

**Prevention:**
- `THIRD_PARTY_NOTICES.md` com o texto MIT completo, o título do mod, a versão (1.4.0), os URLs e o titular **como consta** ("Himanshu (devcode90) e colaboradores"), depois de ler o `LICENSE` do repositório do autor para o texto exato (o `.wh.cpp` não basta); comentário curto com o aviso no arquivo que contém as constantes portadas (molas, temas, tamanhos).
- Portar **valores e comportamento reescritos em JS**, não trechos do C++ traduzidos linha a linha; ainda assim manter o aviso (barato) em vez de discutir se são "substanciais".
- Fontes: `font-family` do sistema (`Segoe UI Variable`, `system-ui`), sem arquivo de fonte no repositório; esperar largura de texto diferente em macOS/Linux e não fixar larguras da pílula em pixels do Windows.
- Paleta Nord: citar a origem no aviso. Nome "Dynamic Island" é marca da Apple: usar como descrição ("inspirado em"), manter o nome do produto "Claude Island".
- `.planning/` público inclui a análise do mod com constantes; aceitável sob MIT, mas o aviso precisa estar no repositório, não só no `.planning/`.

**Phase to address:** Port (antes do primeiro commit de constantes portadas); verificar no fechamento do milestone.

---

## Minor Pitfalls

### Pitfall 21: macOS e Linux regredindo sem ninguém notar

**What goes wrong:** O autor só testa Windows. `setVisibleOnAllWorkspaces` é só macOS/Linux e não faz nada no Windows; no macOS tem efeito colateral (some o Dock por instantes, `skipTransformProcessType`). `setAlwaysOnTop` com nível não funciona no Wayland. `focusable` está documentado para Windows/macOS, não para Linux.
**Prevention:** Declarar o suporte: Windows = testado; macOS/Linux = "melhor esforço, não testado" no README; cada recurso novo atrás de checagem de plataforma (`CAN_*`), em `window.js` ou num módulo de capacidades, não espalhado em `main.js`. Se o Tauri vencer, o custo de ficar sem validar macOS/Linux deve entrar no critério.

### Pitfall 22: Chave de decisão por `display.id` e "ilha de cada monitor" com monitor desligado
**What goes wrong:** Monitor escondido em tela cheia ou `display-removed` momentâneo (suspensão: Windows relata zero monitores) apaga a janela e perde a posição.
**Prevention:** Reconciliar como já é feito em `syncIslands`; não destruir janela por esconder (só `hide()`); guardar a chave nova junto com migração.

### Pitfall 23: Sombra desenhada dentro da janela corta na borda
**What goes wrong:** Sombra de 14×escala (6–18 px) com deslocamento y e a folga de 20 px lateral: sombra cortada ou bordas visíveis em fundos claros; `hasShadow: false` remove a do DWM.
**Prevention:** Folga do palco ≥ espalhamento + overshoot; testar em fundo branco e preto.

### Pitfall 24: Nudge de -6 px e âncora de borda
**What goes wrong:** Com âncora "border-merged" (colada no topo do monitor), o nudge para cima é cortado pelo monitor.
**Prevention:** Nudge só para baixo nessa âncora, ou limitar à folga disponível.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Estado de visualização (sessão exibida) no renderer | Scroll rápido de escrever | Corrida de decisão (Pitfall 2), um estado por janela | Nunca |
| `PERMISSION_ARM_MS` duplicado em `index.html` | Já existe | Renderer e `main` discordam (dívida registrada) | Só até o Port; resolver ao introduzir o gate por estado assentado |
| Polling de cursor a 60 Hz sempre | Hover "sem atraso" | CPU parado maior que a baseline | Nunca; usar duas taxas |
| `setBounds` a cada quadro | Evita palco fixo | Flicker e DPI 125% | Nunca |
| Reafirmar topmost por timer | "Fica por cima" | Guerra com o Windhawk | Nunca |
| PowerShell por poll para tela cheia | Zero dependência | ~0,45 s de CPU por chamada | Nunca; só helper persistente |
| Colar constantes do mod sem aviso | Rápido | Descumprimento da MIT | Nunca |
| Preferências em um JSON sem versão | Simples | Migração dolorosa, perda total ao corromper | Só no primeiro commit, antes de haver usuário real; adicionar `version` já |
| Medir memória com um número solto do Gerenciador de Tarefas | Rápido | Decisão de tecnologia errada | Nunca |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Hooks do Claude Code ↔ ilha | Mudar a ordem de eventos esperada ao acrescentar fila de pedidos | Fixtures de payload, fila por sessão, rearmar a cada troca (`CONCERNS.md`, "Coupling to Claude Code hook ordering") |
| Windhawk (mod) | Esperar API/arquivo/pipe | Nenhum canal existe; só encaixe geométrico por deslocamento fixo (Pitfall 12) |
| `screen` do Electron | Misturar DIP de monitores diferentes | Comparar cursor e janela no mesmo monitor (`getDisplayNearest...`), `setBounds` explícito |
| `globalShortcut` | Ignorar o `false` de `register` | Mostrar indisponibilidade e permitir trocar (Pitfall 16) |
| WebView2 (Tauri) | Pasta de dados compartilhada com outro app | `userDataFolder` exclusiva no spike |
| `SHQueryUserNotificationState` | Esperar evento de tela cheia | Não há evento; poll dentro de helper persistente (Pitfall 13) |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| rAF sempre ligado | CPU parado > baseline, GPU ativa | Mola sob demanda (Pitfall 8) | Imediato, 2 monitores |
| Animar `width`/`height` com sombra grande | Quedas de quadro, GPU alta | Camada estática de sombra, `contain` | Notebook com bateria / 125% |
| Poll de cursor sem duas taxas | Ventoinha, 1 a 2% de CPU extra | Taxa por proximidade | Sempre ligado |
| Fila de pedidos sem prune de arquivos de estado | Poll de 400 ms cada vez mais lento | Podar estados antigos (`CONCERNS.md`) | Centenas de arquivos de sessão |
| Helper de tela cheia sem tempo-limite | Processo órfão consumindo memória | Atar à vida do pai | Após crash do app |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Gate baseado só em relógio (800 ms) | Clique no botão em movimento (Alto) | Gate por estado assentado + geração (P1, P2) |
| Renderer decide qual pedido é o atual | Aprovar pedido não visto (Crítico) | Fonte da verdade em `main`; id nunca vem do renderer |
| Aceitar decisão com janela oculta/translúcida | Clique invisível (Alto) | Rejeitar se oculta; 100% de opacidade com pedido (P5) |
| Auto-snap atropelando pedido em leitura | Troca de conteúdo por baixo do cursor (Alto) | Fila, sem snap durante pedido, rearme (P2) |
| Inércia do touchpad marcando "lido" | Liberar "Permitir" sem ler (Alto) | Ignorar roda por ~300 ms após troca; zerar "lido" (P4) |
| Tema reduz contraste do comando | Aprovação mal informada (Médio) | Tokens de contraste fixos testados (P6) |
| Mais IPC (menu, atalho, scroll) sem validação | Superfície de ataque do renderer | Cada canal valida remetente e payload (`islandOf(event)`); definir `contextIsolation`, `sandbox` explícitos (`CONCERNS.md`) |
| Qualquer processo do mesmo usuário escreve decisão/estado | Já aceito como fronteira de confiança | Não alargar; manter a documentação do README |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Hover sem atraso expande ao passar o mouse a caminho de outra coisa | Pílula atravancando o topo da tela | Atraso curto de entrada e histerese; modo "expandir no clique" |
| Auto-snap sem aviso | Perde o que lia | Indicador discreto do pedido pendente em outra sessão; snap só se nada em foco |
| Scroll troca sessão em vez de rolar a janela atrás | Surpresa | Só trocar com o cursor dentro da pílula expandida |
| Menu cheio de opções com nome de opção do mod | Confusão | Só as opções que existem aqui (tema, forma, estilo, fixar, transparência, esconder) |
| Atalho global que falha em silêncio | Usuário acha que quebrou | Estado visível no menu |
| Âncora + offset em monitor 125% que "desloca" diferente | Ilha fora de lugar | Offset em DIP relativo à âncora e validação com clamp |

## "Looks Done But Isn't" Checklist

- [ ] **Hover por cursor:** funciona com terminal elevado (admin)? Confirmar sem depender do `forward`.
- [ ] **Gate de permissão:** descarta clique durante a mola e após qualquer troca (pedido, sessão, forma, tema, reexpansão)? Teste puro.
- [ ] **Scroll entre sessões:** touchpad com inércia não libera "Permitir"; não troca de sessão com pedido em exibição.
- [ ] **Auto-snap:** pedidos simultâneos em fila; rearme; nada atropelado.
- [ ] **Dois monitores, DPI diferente:** tamanho da janela estável após arrastar e após `display-metrics-changed`; arraste preso ao próprio monitor.
- [ ] **Mola:** 4 estilos × velocidades × `dt` de 1 a 200 ms sem NaN; overshoot dentro do palco.
- [ ] **Esconder:** janela oculta não aceita clique; reexibir rearma; pedido pendente força 100% de opacidade.
- [ ] **Tela cheia:** só o monitor ocupado esconde; desktop (`Progman`/`WorkerW`) não conta; sem PowerShell em loop.
- [ ] **Atalho global:** `register` falso tratado; liberado ao sair.
- [ ] **Menu nativo:** abre com `window` explícito, fecha ao clicar fora, o terminal mantém o foco.
- [ ] **Preferências:** arquivo truncado/vazio/antigo não derruba nem zera tudo; escrita atômica.
- [ ] **Topmost:** nenhuma chamada periódica; sem flicker com o Windhawk ligado por 5 min.
- [ ] **Spike:** script de medição commitado, árvore inteira, três braços, critério escrito antes, caminho de permissão incluído.
- [ ] **Licença:** `THIRD_PARTY_NOTICES.md` com titular conferido no `LICENSE` do autor e aviso nos arquivos com constantes.
- [ ] **CPU parado:** medido com e sem pulso/CSS antes de culpar o poll.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Decisão aplicada à sessão errada (P2) | ALTO | Mudar o estado de visualização para `main`, adicionar geração; teste de regressão; versão corretiva com nota de segurança |
| Guerra de topmost (P11) | BAIXO | Remover qualquer reafirmação periódica; encaixe geométrico |
| Spike com número errado (P14) | MÉDIO | Refazer a medição com o script fixo, antes de decidir qualquer coisa |
| Janela com tamanho errado em DPI misto (P9) | MÉDIO | Palco fixo, arraste restrito ao monitor, `setBounds` reafirmado |
| Preferências corrompidas (P17) | BAIXO | Carregar `.bad`, aplicar padrões por chave; migração em versão seguinte |
| Atalho em conflito (P16) | BAIXO | Permitir mudar o atalho no menu, sem reinício |
| Aviso de licença ausente (P20) | BAIXO | Adicionar `THIRD_PARTY_NOTICES.md` e comentário; republicar release |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1 Botão se move sob o cursor | Port | Teste puro do gate (`canDecide`); manual com Bouncy 2× |
| 2 Decisão em sessão errada | Port | Teste com troca entre `pointerdown` e `island:decide`; geração |
| 3 Janelas com sessões diferentes | Port | Dois monitores, um oculto; visualização global |
| 4 Roda: texto × sessão, inércia | Port | Touchpad com inércia; "lido" zera |
| 5 Ilha invisível clicável | Port + Integração | Rejeita se oculta; opacidade 100% com pedido |
| 6 Tema reduz legibilidade | Port | Teste de contraste dos 8 temas |
| 7 Click-through e forward | Spike + Port | Terminal admin; histerese; Linux/Wayland degradado e documentado |
| 8 Custo de poll e animação | Spike + Port | CPU/GPU parado e animando, antes e depois |
| 9 Resize e DPI misto | Port | `getBounds` estável; arraste preso ao monitor |
| 10 Mola instável | Port | Teste de `dt` aleatório; overshoot dentro do palco |
| 11 Guerra de topmost | Integração | 5 min com Windhawk ligado sem flicker |
| 12 Encaixe sem saber a pílula do mod | Integração | Deslocamento fixo configurável; expansão para fora |
| 13 Esconder em tela cheia | Spike (custo) + Integração | Só monitor ocupado; sem PowerShell em loop |
| 14 Spike mal medido | Spike | Script, árvore inteira, três braços, critério prévio |
| 15 Menu nativo sem foco | Port | Fecha ao clicar fora; foco do terminal |
| 16 Atalho global | Port | `register` falso visível; sem AltGr |
| 17 Preferências | Port | Testes com arquivos truncados/antigos |
| 18 rAF e timers ocultos | Port | Pausa ao ocultar e retoma com `dt` zerado |
| 20 Licença | Port (antes de portar) | `THIRD_PARTY_NOTICES.md` revisado |

## Research flags para o roadmap

- **Spike:** precisa de pesquisa mais funda na hora (versão atual do Tauri 2 para `focusable`, `shadow`, `set_ignore_cursor_events`, `cursor_position`; `macOSPrivateApi`); as afirmações sobre Tauri aqui são em parte **[não verificadas]** e de LOW a MEDIUM.
- **Port (scroll e permissão):** padrões conhecidos, mas **o gate de permissão merece plano próprio com testes primeiro**; não deixar para o fim.
- **Integração (fullscreen e encaixe):** precisa de pesquisa de fase: API nativa mínima para estado de tela cheia por monitor, classe real da janela do mod, retângulo da pílula; nada disso foi confirmado em execução.

## Sources

Documentação oficial (HIGH quando citada na documentação):
- Electron, BrowserWindow (forward só Windows/macOS e UIPI; níveis de always-on-top; `setVisibleOnAllWorkspaces` nada faz no Windows; `focusable`; Wayland): https://www.electronjs.org/docs/latest/api/browser-window
- Electron, tutorial de janelas click-through: https://www.electronjs.org/docs/latest/tutorial/custom-window-interactions
- Electron, `globalShortcut` (falha silenciosa, Wayland portal, `isRegistered`): https://www.electronjs.org/docs/latest/api/global-shortcut
- Electron, `screen` (`getCursorScreenPoint` não suportado no Wayland; conversões DIP; `display-metrics-changed`): https://www.electronjs.org/docs/latest/api/screen
- Microsoft, `SHQueryUserNotificationState` (sem notificação ao iniciar/encerrar tela cheia): https://learn.microsoft.com/en-us/windows/win32/api/shellapi/nf-shellapi-shqueryusernotificationstate
- Microsoft, modelo de processos do WebView2 (grupo de processos, pasta de dados, vários renderers): https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/process-model

Issues e discussões (MEDIUM):
- Electron PR #52365, oclusão em macOS por janela transparente/click-through: https://releases.electronjs.org/pr/52365
- Chromium, oclusão nativa no Windows: https://chromium.googlesource.com/chromium/src/+/a74a18c375fc27db8e1b8690a438df9e94de1151/docs/windows_native_window_occlusion_tracking.md
- Electron #41602, popup que rouba foco: https://www.github.com/electron/electron/issues/41602
- Electron #1335, click-through em janela transparente: https://www.github.com/electron/electron/issues/1335
- Electron DPI/`setBounds` em monitores mistos: https://github.com/electron/electron/issues/7145 e https://github.com/electron/electron/issues/18622
- OpenFin, arredondamento de DIP a 125%: https://openfin.zendesk.com/hc/en-us/articles/360037754552-Custom-Scale-Factor-Issues-with-Custom-Scaling
- Tauri #9250 e #11461 (hover durante click-through), plugin de contorno por polling: https://github.com/tauri-apps/tauri/issues/9250 · https://github.com/tauri-apps/tauri/issues/11461 · https://docs.rs/crate/tauri-plugin-polygon/latest/source/src/grab.rs
- Tauri #5889, metodologia de benchmark de memória (`psutil` × PSS/USS): https://github.com/tauri-apps/tauri/issues/5889
- Wayland sem always-on-top por cliente: https://gitlab.freedesktop.org/wayland/wayland/-/issues/305

Código e documentos locais (HIGH):
- `.planning/PROJECT.md`, `.planning/codebase/CONCERNS.md`, `.planning/research/WINDHAWK-MOD.md`, `main.js`
- Cabeçalho do mod (`@license MIT`, sem linha de copyright): `C:\ProgramData\Windhawk\ModsSource\dynamic-island-for-windows.wh.cpp`
- Repositório do autor (MIT, créditos de colaboradores): https://github.com/devcode90/Dynamic-Island-for-Windows

Não verificados (marcados no texto): comportamento de `GetCursorPos` entre níveis de integridade; se o Electron reafirma topmost; `getCursorScreenPoint` em XWayland; `TrackPopupMenu` com `focusable: false`; conflito AltGr no ABNT2; classe da janela do mod; `shadow`/`macOSPrivateApi` do Tauri; ganhos de um "Electron ajustado"; titular exato e ano do copyright; origem da paleta Nord.

---
*Pitfalls research for: overlay de desktop transparente com fronteira de permissão (Claude Island)*
*Researched: 2026-11-21*
