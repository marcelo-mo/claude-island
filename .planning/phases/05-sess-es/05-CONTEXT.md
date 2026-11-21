# Phase 5: Sessões - Context

**Gathered:** 2026-11-21
**Status:** Ready for planning
**Modo:** `--auto`. O autor está fora, e o orquestrador `desenvolvimentos-81` pediu a escolha recomendada em cada zona cinzenta. As escolhas ficam registradas aqui e no DISCUSSION-LOG.

<domain>
## Phase Boundary

Com várias sessões do Claude Code abertas, a ilha mostra uma por vez. Um ponto por sessão substitui o contador. O usuário troca de sessão pela roda do mouse sobre a pílula, com as regras de gesto do mod, ou clicando num ponto.

A ilha vai sozinha, uma vez por pedido, até a sessão que pede permissão. Pedidos simultâneos entram numa fila "1 de N". Sessões mortas saem da lista e seus arquivos são removidos.

Tudo sem nunca permitir aprovar um pedido que o usuário não estava vendo. Toda troca, seja por roda, ponto, snap ou fila, reinicia o armamento, e Permitir/Negar atinge só o pedido na tela.

Requisitos: SESS-01..07.

Fica de fora:
- convivência com o Windhawk (Fase 6, em paralelo na `claude-island-c8`);
- pré-visualização ao passar o mouse num ponto;
- sessões independentes por monitor.

</domain>

<decisions>
## Implementation Decisions

### Pré-voo: as duas checagens que o ROADMAP pede (tarefas do plano, não pesquisa)
- **D-01:** O hook já grava o projeto, conferido no código da `main` 78a1893:
  - `hook.js` grava `project = path.basename(input.cwd) || 'Claude'` em todo evento.
  - `permission-hook.js` mantém `previous.project` ou cai no `basename(cwd)`.
  - Portanto **não há mudança de contrato no hook**: a exceção prevista no ROADMAP não é usada, e `hook.js` e `permission-hook.js` ficam intocados.
  - O plano só fixa isso num teste que lê o payload do hook (ou uma trava de texto sobre a linha).
  - Limitação aceita: dois projetos com a mesma pasta final mostram o mesmo nome. A posição do ponto desambigua.
- **D-02:** Se `wheel` chega à janela não focável é uma tarefa do plano.
  - Ela confere no código e na documentação que a roda só chega com a captura ligada (`setIgnoreMouseEvents(false)`, Fase 4) e que, no Windows, depende de "Rolar janelas inativas ao passar o mouse sobre elas" (ligado por padrão).
  - A entrega da roda pelo SO só se vê na tela. Vai para o checklist "Testar manualmente" do PR, e o README ganha uma linha sobre a configuração.
  - **Nenhuma roda, clique ou tecla sintética por `SendInput`** (regra do projeto). Um teste que injete `webContents.sendInputEvent` na própria ilha pode cobrir o caminho do renderer, mas não substitui o item de tela.
  - Sem a roda, clicar no ponto continua trocando a sessão.

### Seleção e ordem (SESS-01, SESS-02, SESS-03)
- **D-03:** **Uma seleção só, no main, espelhada em todas as ilhas** (ARCHITECTURE.md §1.1).
  - `shown` continua único, e a invariante "o pedido em qualquer ilha é o `shown.id`" se mantém.
  - Rolar no monitor A troca o que o B mostra, e o rearme vale para as duas.
  - Sessões independentes por monitor ficam como extensão futura.
- **D-04:** **Ordem estável por primeira aparição**, nunca por urgência ou recência.
  - O main guarda em memória um `Map` de chave da sessão (o nome do arquivo sem `.json`) para `firstSeenAt`.
  - Na primeira vez que vê uma chave, usa o `birthtimeMs` do arquivo (um `statSync` por sessão nova, não por ciclo) e cai em `Date.now()` se falhar. Assim a ordem sobrevive a reiniciar a ilha.
  - Desempate pela chave. Sessão nova entra no fim, e a mais antiga fica à esquerda.
  - O `Map` perde as chaves que saíram da lista.
- **D-05:** **A lista é a das sessões vivas pelo filtro de hoje do `pickState`**: `done` por 10 s, `running` por 2 h, `waiting` por 12 h, mais o filtro de sessão morta (D-14). O "concluído" some em 10 s como hoje, e a ilha continua existindo só enquanto o Claude roda.
- **D-06:** **Modo automático e modo manual.**
  - A seleção é `null` (automático: mostra a sessão que o `pickState` escolheria, a mais urgente e depois a mais recente) ou a chave de uma sessão (manual).
  - Roda e clique num ponto põem em manual. Snap e fila também gravam a chave da sessão do pedido.
  - A seleção manual vale até a sessão sair da lista; aí volta ao automático.
  - Sem tempo de expiração: a ilha nunca troca sozinha por "concluído" nem por "voltou a trabalhar" (SESS-06).
  - Uma função pura em `state.js`, `nextSelection`, decide a seleção a cada evento (`poll`, `scroll`, `select`, `answered`). O `pickState` passa a receber a seleção e devolve a sessão exibida, mais a lista de pontos e a fila.
  - **Conciliação com o SESS-06, ajustada na revisão do plano:**
    - O "automático" não acompanha o `pickState` ao vivo. A escolha por urgência acontece só na subida, quando a lista sai de vazia, ou quando a sessão exibida sai de fato da lista (`SessionEnd`, sessão morta ou prazo de `running`/`waiting`), e então fica fixa como chave.
    - Acompanhar ao vivo trocaria a sessão exibida quando outra terminasse ou ficasse mais urgente, e isso o SESS-06 proíbe.
- **D-21:** **O "concluído" exibido não expira enquanto houver outra sessão viva na lista.**
  - A sessão em `done` que está na tela fica na lista e na tela além dos 10 s de `DONE_VISIBLE_MS`, até o usuário trocar (roda ou ponto) ou um pedido novo fazer o snap. Ao deixar de ser exibida, ela expira na hora, se já passou do prazo.
  - Se ela for a única sessão, o prazo de 10 s vale como hoje e a ilha fica ociosa. Isso não é troca de sessão, e a ilha continua existindo só enquanto o Claude roda.
  - Assim, "concluído" e "voltou a trabalhar" nunca trocam a sessão sozinhos (ROADMAP SC3, SESS-06), nem pela expiração.
  - Sair de fato da lista (`SessionEnd`, sessão morta, prazo de `running`/`waiting`) não é troca por estado. Ajustado na terceira revisão do plano, para não contrariar a D-13 ("uma vez por pedido"):
    - a ilha vai à sessão do pedido pendente **nunca exibido** mais antigo, se houver;
    - senão, à **vizinha na ordem estável** (a anterior, ou a seguinte se a que saiu era a primeira), nunca à "mais urgente".
    - Um pedido que já foi exibido e que o usuário deixou nunca é alvo de troca automática, nem por essa saída.
    - O estado dos pedidos no main distingue "nunca exibido" (entrou na fila sem snap) de "já exibido".
    - Se a vizinha calhar de ter um pedido já deixado, ele reaparece por posição, não por urgência, e com rearme.

### Pontos e rótulo (SESS-01)
- **D-07:** **Um ponto por sessão viva, no lugar de `#count`, só com 2 ou mais sessões.**
  - Cor = cor fixa do estado (laranja trabalhando, âmbar precisa de você, verde concluído, cada uma com o par escuro/claro da Key Decision; os temas não mudam as cores de estado).
  - Pulso = a sessão tem pedido de permissão válido pendente, inclusive a sessão exibida.
  - O ponto da sessão exibida é maior (ou tem anel), sem mudar de cor.
  - `#dots` já existe e é a animação de "pensando": os pontos de sessão ganham um elemento novo, por exemplo `#sessions`.
  - Teto: até 8 pontos. Com mais de 8 sessões volta o contador numérico (`ponytail`, com o teto anotado).
  - Com "reduzir movimento", o pulso vira cor estática com anel.
- **D-08:** **O nome do projeto da sessão exibida fica sempre visível com 2 ou mais sessões:**
  - Na pílula compacta, o título passa a ser o nome do projeto, e o estado segue pela cor e pelos pontos. Com uma sessão só, nada muda.
  - Na expandida, `#detail` já começa por `projeto ·`.
  - No bloco de pedido, o cabeçalho passa a ser `projeto · ferramenta`. É a regra de segurança de saber de qual projeto é o pedido que se aprova.
  - Nome longo é cortado com reticências, sem empurrar os botões. A conta de palco da Fase 3 continua cobrindo o pico.
- **D-09:** **Payload de `island:state`** ganha:
  - `sessions: [{ state, pending, current }]`, na ordem estável;
  - `queue: { position, total }`, ou `null`.
  - **Nenhuma chave de sessão, PID nem texto de pedido de outra sessão vai ao renderer.** Só o pedido exibido segue como hoje.

### Roda do mouse (SESS-02)
- **D-10:** **O renderer manda a roda bruta, e o main acumula.**
  - A roda sobre a pílula, fora de `#permission` inteiro (ferramenta, texto e dica), vai por um canal novo `island:wheel` com um número só.
  - O valor é o `wheelDeltaY` do Chromium: ±120 por entalhe, como o `WM_MOUSEWHEEL`, e menor no touchpad.
  - O main valida o número (`Number.isFinite`, faixa limitada) e roda uma função pura `wheelStep` com as constantes do mod (MIT, aviso mantido; mod l.22541):
    - acumula até 120;
    - um gesto novo começa após 220 ms de pausa ou com inversão de direção;
    - o intervalo entre passos é de 85 ms com roda e 200 ms quando `|delta| < 120` (touchpad);
    - no máximo um entalhe fica pendente.
  - Roda para cima = sessão anterior. Sem dar a volta no fim.
  - Se o `wheelDeltaY` não se comportar como o esperado, a tarefa da D-02 converte `deltaY` × 1,2. O planejador decide com o código, e o critério é o mesmo limiar de 120.
- **D-11:** **Sobre `#permission` a roda só rola o texto.** O `stopPropagation` que já existe em `#permission-text` passa a valer para o bloco inteiro. Rolar até o fim do texto nunca encadeia uma troca de sessão (ARCHITECTURE.md I8).
- **D-12:** **Clicar num ponto** manda pelo canal novo `island:select` só um índice inteiro.
  - O main valida que o índice existe na lista atual e mapeia para a chave. Se a lista mudou entre ver e clicar, a pior consequência é ir a outra sessão, e isso rearma do mesmo jeito.
  - O `pointerdown` no ponto não inicia arraste nem abre a pílula no modo clique.
  - A área de toque do ponto tem pelo menos 16 px, mesmo que o ponto desenhado seja menor.
  - Clicar no ponto da sessão exibida não faz nada.

### Snap e fila (SESS-04, SESS-05, SESS-06)
- **D-13:** **Snap por borda, uma vez por pedido.**
  - O main guarda o conjunto de ids de pedido já vistos. Um id novo e válido leva a seleção à sessão dele, uma vez só.
  - Se o usuário sair, a ilha não puxa de novo, e o ponto segue pulsando.
  - **Nunca no meio de um gesto:** com roda há menos de 400 ms (`SNAP_GESTURE_GAP_MS`), o snap fica para o próximo ciclo de poll.
  - Depois de um snap, a roda é ignorada por 400 ms (`SNAP_WHEEL_LOCK_MS`), para a inércia não afastar o usuário do pedido que acabou de aparecer.
  - **Pedido novo não substitui o que está sendo lido:** se a sessão exibida tem pedido na tela, o novo entra na fila sem snap e marca o id como visto.
  - Snap com a ilha escondida ou em tela cheia muda a seleção, mas não reexibe a ilha.
- **D-14 (fila):** **FIFO por chegada.**
  - A chegada é o primeiro instante em que o main viu o id (`Map` id → `seenAt`), com desempate pelo id.
  - Com 2 ou mais pedidos pendentes, o bloco de pedido mostra "1 de N", em que o número é a posição do pedido exibido na fila.
  - **Ao sair o pedido exibido** (respondido na ilha ou no terminal), com outros pendentes, a ilha vai ao mais antigo restante, sem voltar à sessão anterior.
  - Se o usuário estava numa sessão sem pedido (rolou para longe), a saída de um pedido não o move.
  - **Exceção registrada (terceira revisão do plano):** o avanço da fila ao sair o pedido exibido **não espera** os 400 ms do gesto de roda, ao contrário do snap.
    - Adiar perderia o fato "o pedido exibido saiu": no ciclo seguinte o `shown.id` já é outro.
    - Quem responde na ilha acabou de clicar, não de rolar.
    - O avanço rearma como toda troca.
    - Vai como item de "Testar manualmente": rolar a roda enquanto o terminal responde o pedido exibido; a ilha vai ao próximo pendente e Permitir/Negar só armam depois dos 800 ms.
  - Só um pedido de permissão troca a sessão sozinho: "concluído" e "voltou a trabalhar" nunca trocam (SESS-06, teste explícito).
- **D-15:** **Toda troca passa por `refresh()`**, que segue sendo o único lugar que muda `shown`.
  - Troca para uma sessão com outro pedido muda o id e reinicia o armamento por `nextShownPermission`, com época nova.
  - Troca para uma sessão sem pedido zera o id.
  - O renderer já rearma por id, época e texto. A troca de sessão ainda reinicia a janela da roda (`contentChangedAt`), a exigência de rolar até o fim e o `press`, porque o clique cujo `pointerdown` e `pointerup` caem em pedidos diferentes é descartado (já é assim pelo `armToken`).
  - Plano próprio de testes do gate:
    - vetores novos para troca por roda, por ponto, por snap e por fila;
    - em cada vetor, `acceptDecision` recusa por 800 ms depois da troca e o eco do id antigo recusa;
    - o fixture antigo fica intacto.

### Sessões mortas (SESS-07)
- **D-16:** **Sessão morta = `windowPid` válido cujo processo não existe mais.**
  - O main testa com `process.kill(pid, 0)`: `ESRCH` conta como morto, e `EPERM` ou sucesso contam como vivo.
  - Sem `windowPid`, vale só a idade (os prazos de hoje).
  - O predicado é puro em `state.js` (`isSessionDead(session, now, isPidAlive)`), com o teste do PID injetado.
  - O main remove o arquivo de sessão morta e o de qualquer sessão mais velha que `WAITING_STALE_MS`.
  - Arquivos de `done` recentes ficam, porque o hook reaproveita o `windowPid` guardado neles e evita 0,4 s de `findWindowPid`.
  - Limites aceitos (`ponytail`):
    - o `windowPid` é o dono da janela do terminal; fechar uma aba do Windows Terminal sem fechar a janela não mata o processo, e a sessão sai pela idade;
    - um PID reaproveitado faz a sessão ficar até o prazo, que é o lado seguro, porque nunca remove uma sessão viva.

### Animação da troca
- **D-17:** **Mola de troca de aba do mod**, adiada da Fase 3 para cá: k=250, c=31, deslocamento vertical de 34 px e escala 0,965, com fade. O aviso MIT fica sobre as constantes.
  - Direcional: rolar para baixo traz o conteúdo de baixo.
  - **Só se move um invólucro sem nenhum botão** (título, detalhe e texto do pedido; ajustado na revisão do plano). Pontos, "Abrir", "Abrir sessão", Permitir e Negar nunca recebem a transformação da mola de troca. Uma trava de teste cobre todo `button` da pílula, não só `#actions`.
  - Largura: com 2 ou mais sessões, o título com o nome do projeto tem largura fixa e corta com reticências, para a troca não mexer a largura da pílula nem empurrar "Abrir".
  - Mudança no número de sessões ainda pode alterar a largura. Isso é aceito e registrado: não é causado pelo gesto, é raro, e Permitir/Negar seguem cobertos pelo rearme por retângulo.
  - **Como ler "sem nunca mover um botão sob o cursor"** (objetivo da fase), na segunda revisão do plano:
    - A garantia é sobre os botões que aprovam: Permitir e Negar nunca ficam armados num lugar diferente do que armaram, pelo rearme por retângulo das Fases 2 e 3. A mola de troca de sessão não move nenhum botão.
    - Os botões que não aprovam (pontos, "Abrir", "Abrir sessão") podem mudar de lugar com o layout, o hover e o nudge, como já acontece desde as Fases 3 e 4 (precedente: "Abrir sessão" escala no hover, aceito na Fase 3). O pior caso é trocar de sessão, o que rearma, ou focar um terminal.
    - Portanto **não** se fixa a pílula compacta na largura da expandida, e **não** se desliga o zoom do hover nem o nudge com 2 ou mais sessões. O comportamento visual das Fases 3 e 4 fica como está.
    - O resíduo (a largura muda com o número de sessões, ou entre "concluído" compacto e sessão expandida no hover, e os pontos andam junto) fica registrado no modelo de ameaças e no PR.
  - O conteúdo é trocado **de forma atômica**: texto e id juntos, sem crossfade com duas camadas DOM. A camada antiga seria um alvo de clique que o main já descartou. Anima-se só o contêiner.
  - A mola nova entra em `allSpringsAtRest()`, então `canArm` não arma Permitir/Negar enquanto ela se move.
  - Com "reduzir movimento", a troca é sem deslocamento.
  - O lerp do acento (adiado da Fase 3) entra como transição curta de cor no acento da pílula. Fica fora do bloco de pedido, que tem cores próprias e opacas.

### IPC e travas
- **D-18:** **Dois canais novos, renderer → main:**
  - `island:wheel(delta: number)`;
  - `island:select(index: integer)`.
  - Os dois passam por `islandOf(event)`, aceitam só um número e são ignorados com a ilha ociosa.
  - O preload ganha `wheel` e `selectSession`.
  - As travas de `gate.test.js` (`RENDERER_CHANNELS`, `handlers.length` = 7) sobem com os dois nomes, e nenhum outro canal muda.
  - **O renderer nunca envia chave de sessão nem id de pedido para escolher alvo**; o eco do `decide` continua só recusando.

### Coordenação com a Fase 6
- **D-19:** Combinado com a `claude-island-c8`:
  - Do lado da Fase 6:
    - em `state.js`, só `ANCHORS`, `anchorPosition`, `horizontalSlackFor` e o submenu de âncora do `menuTemplate`;
    - em `index.html`, só o CSS `:root[data-anchor…]`;
    - `main.js` quase intocado;
    - testes num arquivo novo, `coexistence.test.js`.
  - Do lado da Fase 5:
    - funções de sessão logo depois de `pickState`, com uma linha própria no `module.exports`;
    - testes no fim de `island.test.js` e `gate.test.js`.
  - Não alterar a assinatura de `anchorPosition` nem de `horizontalSlackFor`.
  - Quem terminar por último faz `merge` da `main`, sem force-push.

### Integração com a Fase 6 já na `main` (PR #9) e o CR-01 dela
- **D-20:** A `origin/main` (6741b25, com a Fase 6) entra na `feat/fase-5-sessoes` por `merge`, sem force-push, antes de executar os planos. `coexistence.test.js` passa junto com a suíte.
  - Decisão do CR-01 da revisão da Fase 6: com área útil abaixo de 1220 DIP, a âncora "ao lado" (`right-of-island`/`left-of-island`) é puxada pelo clamp para cima da pílula do mod. O `EnsureTopmost` do mod passa então a cobrir o começo das linhas do pedido.
  - **O gate recusa nesse caso**, com o fail-safe que a revisão propôs:
    - `BESIDE_MIN_WORK_AREA_WIDTH_PX = 2 × (BESIDE_GAP_PX + EXPANDED_PILL_WIDTH_PX)`, que dá 1220;
    - uma função pura `besideFits(anchor, workArea)` em `state.js`, que vale `true` para as âncoras que não são "ao lado";
    - o resultado entra junto de `isWithinWorkArea` nos dois fatos que o main já calcula: `fitsWorkArea` no `sendState` (o renderer desabilita os botões e mostra "Responda no terminal") e `withinVisibleArea` no `island:decide` (o gate recusa).
  - A ordem de `acceptDecision` e o fixture antigo ficam intactos. Os vetores de 1093 e 1066 DIP recusam, e 1220 aceita.
  - A função mora fora das funções de âncora da Fase 6 e não muda a assinatura de `anchorPosition` nem de `horizontalSlackFor`.
  - Limite que continua registrado no PR: o gate não enxerga oclusão por outra janela topmost em nenhuma âncora (já aceito no `06-SECURITY.md`).

### Claude's Discretion
- Desenho exato dos pontos: tamanho, espaçamento, anel e pulso. Segue o UI-SPEC, se o plano pedir um, ou a linguagem visual da Fase 3.
- Onde fica o "1 de N" dentro do bloco de pedido, sem passar o pico do palco.
- Nomes finais das funções puras e constantes (`nextSelection`, `wheelStep`, `isSessionDead`, `SNAP_*`).
- Se o lerp do acento vira só uma `transition` CSS.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Escopo e requisitos
- `.planning/ROADMAP.md` §Phase 5: objetivo, 5 critérios de sucesso, research flag "não" e as duas checagens.
- `.planning/REQUIREMENTS.md`: SESS-01..07.
- `.planning/PROJECT.md` §Key Decisions: cores de estado fixas (par escuro/claro), scroll no lugar do contador, núcleo "nunca aprovar o que não viu".

### Desenho já pesquisado (milestone)
- `.planning/research/ARCHITECTURE.md` §1.1–1.3: seleção única, ordem estável, `nextSelection`, `wheelStep`, regra do texto de permissão, `refresh()` como funil único.
- `.planning/research/ARCHITECTURE.md` §Invariantes I2, I3, I5, I8: toda troca rearma; scroll sobre `#permission` nunca troca.
- `.planning/research/ARCHITECTURE.md` §Anti-Pattern 2: não ordenar por urgência.
- `.planning/research/FEATURES.md` §Multi-sessão / Regras recomendadas: snap uma vez por pedido, sem snap no meio do gesto, trava após snap, fila FIFO, mola de troca direcional.
- `.planning/research/PITFALLS.md`: armadilhas de troca de conteúdo sob o cursor.
- `.planning/research/WINDHAWK-MOD.md` e o fonte do mod `C:\ProgramData\Windhawk\ModsSource\dynamic-island-for-windows.wh.cpp` l.22541 (`WM_MOUSEWHEEL`: 120, 220 ms, 85/200 ms) e a mola de troca de aba (k=250, c=31, 34 px, 0,965).

### Fases anteriores
- `.planning/phases/02-funda-o-segura-do-gate-de-permiss-o/`: gate, `acceptDecision`, fixture `fixtures/permission-vectors.json`.
- `.planning/phases/03-palco-fixo-anima-o-e-visual/03-CONTEXT.md`: molas, `canArm`, palco 520×410, mola de troca adiada para cá.
- `.planning/phases/04-entrada-prefer-ncias-e-comportamento-no-sistema/04-CONTEXT.md`: hover por cursor, captura do mouse (a roda só chega com captura), "Rolar janelas inativas" no README.
- `THIRD_PARTY_NOTICES.md`: aviso MIT do mod, que deve ficar sobre toda constante portada.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `pickState(sessions, now)` em `state.js`: filtro de vivas e escolha automática. A fase o estende com seleção, pontos e fila.
- `nextShownPermission` em `state.js` e `shown` em `main.js`: o rearme por id e época já existe; a troca de sessão só precisa mudar o id.
- `acceptDecision` com o fixture de vetores: a ordem das checagens é contrato.
- `readSessions()` em `main.js`: já anexa `contextPercent` por arquivo (precedente para anexar a chave e o `firstSeenAt`).
- Bloco inline `index.html` com marcadores e `node:vm` (Fases 2 e 3): lugar dos predicados do renderer (`isWheelSettled`, `canArm`, molas).
- `permissionText` já tem um ouvinte de `wheel` com `stopPropagation` e `WHEEL_SETTLE_MS` = 400.
- `islandOf(event)` e o padrão de handler validado de `island:capture`.

### Established Patterns
- `refresh(reason)` é o funil único; `sendState` é o único caminho do estado ao renderer.
- Lógica pura em `state.js`, com o tempo como parâmetro; I/O e cola no `main.js`.
- O main decide e o renderer só pede (SEG-08): o renderer nunca escolhe alvo de decisão.
- Testes: `node:test`, travas de texto sobre `main.js` e `index.html` em `gate.test.js`.

### Integration Points
- `main.js`: `readSessions`, `refresh`, `sendState`, `island:decide` (depois de aceitar, a seleção vai para o próximo da fila) e `registerIpcHandlers` (2 canais).
- `preload.js`: 2 métodos.
- `index.html`: `#count` → pontos, título com o projeto, cabeçalho do pedido, "1 de N", ouvinte de `wheel` na pílula, clique no ponto, mola de troca.
- `README.md`: "Rolar janelas inativas".

</code_context>

<specifics>
## Specific Ideas

- Pedido original do autor: "o scroll troca entre as sessões abertas, no lugar do contador, com a mesma regra de scroll do mod do Windhawk, e volta sozinho para a sessão que pedir permissão."
- O orquestrador destacou que a troca de sessão é o maior risco para a regra "nunca aprovar o que o usuário não viu". Por isso a fase tem um plano próprio de testes do gate.

</specifics>

<deferred>
## Deferred Ideas

- Pré-visualização do projeto e do estado ao passar o mouse num ponto (FEATURES.md, diferencial). Fica para depois.
- Sessões independentes por monitor (`Map<BrowserWindow, selection>`). Extensão futura do ARCHITECTURE.md.
- Aviso sonoro para cada pedido novo da fila: hoje o som toca só na troca de estado da sessão exibida. O pulso do ponto e o "1 de N" cobrem o aviso.
- Identificar a sessão morta pelo PID do próprio Claude, e não da janela. Exigiria mudar o contrato do hook, fora do previsto.

</deferred>

---

*Phase: 05-sess-es*
*Context gathered: 2026-11-21*
