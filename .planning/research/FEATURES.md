# Feature Research

**Domain:** ilha/notch de desktop que mostra o status de sessões de agentes de código (Claude Code), com várias sessões simultâneas, interação (permissão) e convivência com ilhas de sistema
**Pesquisado em:** 2026-11-21
**Confiança geral:** MEDIUM — o panorama de concorrentes é bem coberto, mas quase tudo vem de README e páginas de produto (não de uso real); as conclusões de UX de multi-sessão são julgamento próprio apoiado em padrões observados e na HIG da Apple, e estão marcadas como tal

> Escopo: milestone que porta comportamento e visual do mod do Windhawk (já analisado em `WINDHAWK-MOD.md`, não refeito aqui), sem módulos de sistema, mais scroll entre sessões e convivência com ilha de sistema. O que a v1.0.1 já entrega (estados, som, tema automático, foco no terminal, uma ilha por monitor, resposta de permissão com proteções, início automático) não é reavaliado.

## Achado principal

1. **No macOS o nicho "agente de IA no notch" já está lotado**: Vibe Island/Vibe Notch, AgentPeek, ClaudeNotch, Open Island, code-island, coder-island, ClaudeDot, Claude Status Bar e até o NotchNook (que lista "aprovar Claude Code e Codex pelo notch" como recurso). **No Windows não encontrei nenhum concorrente direto** para Claude Code (só ilhas genéricas: Notchify, Lumen, WinLand, o próprio mod do Windhawk). A vantagem real do Claude Island é Windows + Linux + proteções contra aprovação por engano, não "ter uma ilha".
2. **Nenhum app de notch do macOS expõe API, URL scheme ou ponto de extensão documentado para um app de terceiros empurrar conteúdo ao vivo.** A única exceção é o SuperIsland (SDK de extensões em JavaScript, dentro do app, sem empurrão externo documentado). No Windows o único com canal de entrada que achei é o WinLand (82 estrelas), por HTTP em loopback. Detalhes na seção "APIs de terceiros".
3. **O padrão dominante de multi-sessão é "mostrar a mais urgente, listar as outras"**, não "carrossel". A decisão do projeto (scroll + volta sozinho para quem pede permissão) é compatível com isso, mas precisa de regras explícitas contra surpresa (seção "Multi-sessão").

## Feature Landscape

### Table Stakes (usuários esperam isto)

Para este escopo (status de sessões, multi-sessão, interação, personalização, convivência). Sem isso a ilha parece incompleta ou perigosa.

| Feature | Por que é esperada | Complexidade | Notas |
|---------|--------------------|--------------|-------|
| Indicador de sessões por pontos (um ponto por sessão, cor = estado), no lugar do contador | Todo concorrente mostra o estado de todas as sessões de relance: ClaudeDot ("o ponto reflete o status mais urgente, o painel lista cada sessão"), Claude Status Bar (ícone agregado), code-island (cartões por sessão). Contador não diz *qual* sessão precisa de você | LOW–MEDIUM | Ponto pulsando = pede permissão. Substitui o contador; é também o que impede o pedido pendente de ficar escondido numa sessão que não está à vista. Depende de ordem estável (ver abaixo) |
| Identificação da sessão visível (nome do projeto/pasta) em toda visão, em especial no pedido de permissão | Vibe Island enfileira pedidos "cada um rotulado com o agente e a sessão". Com troca por scroll, sem rótulo o usuário não sabe qual sessão está aprovando | LOW | Segurança: aprovar "Bash rm ..." sem saber de qual projeto é o mesmo problema de aprovar sem ver. Verificar se o hook já grava `cwd`/nome do projeto em `~/.claude/island/` |
| Scroll da roda entre sessões, sem dar a volta no fim, com acúmulo e trava de gesto | Pedido explícito do milestone; mod já tem as constantes: acumula delta até 120, gesto novo após 220 ms ou inversão de direção, 85 ms entre passos (200 ms no touchpad), sem wrap (l.22541 do mod) | MEDIUM | Reaproveitar as constantes do mod (MIT, manter aviso). Dependência técnica forte: a janela só recebe `wheel` se não estiver em click-through naquele instante (ver "Dependências") |
| Volta sozinha para a sessão que pede permissão | Padrão "uma sessão esperando permissão nunca fica escondida atrás de uma que está pensando" (Claude Status Bar, README) | MEDIUM | Com guardas contra surpresa (seção "Multi-sessão"): só para permissão, uma vez por pedido, nunca no meio de um gesto de scroll |
| Reiniciar as proteções do botão a cada troca de sessão/pedido | Fronteira de confiança do projeto (atraso 0,8 s, rolar até o fim). Auto-troca é exatamente o caso em que o usuário pode clicar em algo que acabou de aparecer | MEDIUM | Ação Allow/Deny deve carregar o `requestId` exibido; processo principal confere que é o pedido atualmente visível há ≥0,8 s; clique que começa num pedido e termina em outro é descartado. É requisito, não enfeite |
| Clique atravessa a janela fora da pílula e quando ociosa | Todos os concorrentes de Windows e o mod fazem (Lumen: "clickthrough quando ociosa"; mod: `HTTRANSPARENT`/`WS_EX_TRANSPARENT`) | MEDIUM | Já parcialmente existente (janela quase toda transparente). Interage com scroll e hover por posição |
| Hover por posição do cursor (expandir no hover ou no clique), com as proteções de permissão intactas | Padrão do gênero (code-island: "hover para expandir, sair para recolher"; mod lê `GetCursorPos` por quadro) | MEDIUM | Já em Active. Precisa ser a base do scroll e do click-through dinâmico |
| Esconder por atalho global e em tela cheia | Lumen ("esconde com app em tela cheia"), mod (hotkey + detecção a cada 0,5 s). Ilha sobre jogo/apresentação é motivo clássico de desinstalar | MEDIUM | Já em Active. Decidir o que fazer com pedido de permissão enquanto escondida (ver "Decisões em aberto") |
| Menu de clique direito com preferências persistidas (tema, forma, estilo de animação, fixar aberta, transparência, esconder) | Quem tem 8 temas e 3 formas precisa de onde escolher; mod e code-island ("cinco looks") têm | LOW–MEDIUM | Persistir por monitor onde fizer sentido (posição já é por monitor) |
| Convivência mínima: âncora e deslocamento configuráveis | Único recurso universal que funciona com *qualquer* ilha/notch sem API: o usuário move a nossa para fora do caminho | LOW | Já em Active. É o plano B de toda a convivência, inclusive no macOS |
| Som e animação distintos para "precisa de você" × "concluído" | Padrão (code-island: pacotes de som; ClaudeDot: som por estado; HIG: "alerte só por atualizações essenciais") | LOW | Já entregue; só garantir que troca automática de sessão **não** adiciona som próprio |

### Differentiators (vantagem competitiva)

Alinhados ao Core Value: "saber de relance o que cada sessão faz e responder sem trocar de janela, sem nunca aprovar algo que o usuário não viu".

| Feature | Proposta de valor | Complexidade | Notas |
|---------|-------------------|--------------|-------|
| Aprovação com proteção contra clique por engano (já existe) estendida à troca de sessão | Dos concorrentes lidos, Vibe Island não documenta proteção ("Allow e Deny a um clique", ⌘Y/⌘N); só ClaudeNotch cita guarda extra (Touch ID ou segurar para confirmar em comando destrutivo). Segurança visível é diferencial real e combina com o Core Value | LOW (extensão do que existe) | Vender isso na descrição do release. Continua valendo mesmo com troca automática |
| Windows e Linux de primeira classe | Nenhum concorrente de Claude Code encontrado para Windows; no macOS há uns 8 | já entregue | A tecnologia (Electron vs. Tauri) precisa preservar isso |
| Dock lateral ao lado da ilha do Windhawk ("segunda bolha") | Ninguém faz: o mod não aceita conteúdo externo, então o encaixe é a única integração possível. Resolve a sobreposição real do autor | HIGH | Depende de detectar a janela do mod (classe `Windhawk.DynamicIslandForWindows`, **a confirmar**) e de ler a geometria dela; ela muda de tamanho ao expandir. Reafirmação de topmost pelo mod a cada 1 s pode cobrir a nossa. Só Windows; opcional |
| Animação por molas assimétricas, nudge, hover com ampliação, 4 estilos | É o que faz a ilha parecer "viva" e é o motivo do milestone; concorrentes de agente usam animação simples | MEDIUM | Constantes já extraídas em `WINDHAWK-MOD.md`. Respeitar HIG: animações de conteúdo ≤2 s; encolher sem balanço |
| Reflexo de acento no topo tingido pela cor do estado + contorno na cor do estado | Estado legível sem ler texto (cor + movimento), consistente entre temas | MEDIUM | No Electron o blur recortado em pílula exige código nativo (`backgroundMaterial` é retangular); aceitar sem acrílico no v1 do milestone |
| 8 temas + automático claro/escuro | Personalização barata (tabela de cores pronta) com visual que o autor já usa | LOW | Atenção: cores de estado (laranja/verde/vermelho) precisam de contraste ≥3:1 em *cada* tema, inclusive Porcelain (claro). Testar |
| Formas pílula, notch e Windows 11 | Notch "colado" na borda combina com monitor sem notch físico; competidores só têm pílula/barra | LOW–MEDIUM | Raios: pílula = altura/2, W11 = 8, notch = 16 com topo reto |
| Pré-visualização ao passar o mouse num ponto (nome do projeto + estado) | Evita rolar às cegas; alternativa ao painel-lista dos concorrentes sem abrir outra superfície | LOW–MEDIUM | Só leitura; nunca mostra botões de permissão (para não criar caminho de aprovação fora da vista cheia) |
| Clique no ponto para ir direto à sessão | Equivalente de mouse do scroll; necessário para acessibilidade (scroll puro não serve a quem não tem roda/touchpad) e para descobribilidade | LOW | Mesma trava de proteções da troca por scroll |

### Anti-Features (frequentemente pedidos, problemáticos)

| Feature | Por que é pedida | Por que é problemática | Alternativa |
|---------|------------------|------------------------|-------------|
| "Aprovar todos (N)" em lote (ClaudeNotch) | Reduz cliques com muitas sessões | Aprova chamadas que o usuário não viu; quebra a fronteira de confiança e o "só aquela chamada" | Fila: resolver um por vez, nos moldes do Vibe Island (pedidos enfileirados e rotulados) |
| Atalho global de Allow/Deny com a ilha fora da vista (Vibe Island: ⌘Y/⌘N; ClaudeNotch: uma tecla) | Rapidez sem tirar a mão do teclado | Permite aprovar sem ver; atalho dispara na sessão errada após auto-troca | Se vier, só com a ilha expandida, o pedido visível há ≥0,8 s e o atalho amarrado ao `requestId` mostrado. **Adiar**; fora deste milestone |
| "Permitir sempre" (AgentPeek, Vibe Island) | Menos prompts | Já está em Out of Scope: regra permanente é decisão de terminal | Manter fora |
| Auto-trocar de sessão em *qualquer* mudança de estado (concluído, voltou a trabalhar) | Parece "ao vivo" | Muda o conteúdo sob o cursor; usuário perde a leitura. Só o pedido de permissão justifica interromper | Só ponto muda de cor/pulsa + nudge + som; a sessão à vista não muda |
| Carrossel que gira sozinho entre sessões | A HIG sugere um Live Activity único que "rotaciona entre eventos" | Vale para informação passiva; aqui rouba a leitura de um pedido de permissão | Troca só por ação do usuário, ou por snap de permissão |
| Dar a volta no fim da lista (wrap) | Parece contínuo | Mod não faz; atrapalha o modelo mental "primeira/última sessão" e dispara troca acidental com inércia | Parar nas pontas, com leve "resistência" visual opcional |
| Reordenar sessões por estado/urgência | ClaudeDot/Claude Status Bar agregam por urgência no *ícone* | Se a posição dos pontos muda sozinha, o usuário rola para a posição errada | Ordem estável por início da sessão; urgência vai por cor/pulso, nunca por posição |
| Mostrar duas sessões lado a lado ("split" do mod) | O mod faz split para as 2 atividades de maior prioridade | Dobra a superfície de aprovação e o texto a ler; ambiguidade sobre qual botão vale para qual sessão | Uma sessão por vez |
| Suportar outros agentes (Codex, Cursor, Gemini… como Open Island com 15 agentes) | Mercado maior | Fora do Core Value deste milestone; multiplica hooks e formatos | Reavaliar depois de multi-sessão estável |
| Gambiarras para empurrar conteúdo à ilha do Windhawk (registro `ProgressPercent`, sessão de mídia falsa) | "Integração" sem fork | `ProgressPercent` mostra só anel "Progress N%"; SMTC falso polui o controle de mídia real; frágeis a qualquer atualização do mod | Encaixe lateral (nossa ilha ao lado), como já decidido |
| Sistema próprio de plugins/extensões | Parece extensível (boring.notch e SuperIsland planejam/têm) | Superfície de segurança enorme numa ilha que aprova permissões; WinLand avisa que plugins rodam "sem sandbox" | Nenhum. Hooks + arquivos JSON já são a interface |
| Módulos de sistema (mídia, clima, hardware, notificações…) | Concorrentes (NotchNook, boring.notch, Alcove) vivem disso | Já em Out of Scope: a ilha só existe com o Claude rodando | Manter fora |

## Multi-sessão: como evitar surpresa

Esta seção responde à pergunta 2. Fontes de evidência: concorrentes (Claude Status Bar, ClaudeDot, Vibe Island, code-island) e a HIG de Live Activities. **As regras abaixo são recomendação própria** (confiança MEDIUM–LOW), derivadas do Core Value e da restrição de segurança; nenhum concorrente documenta uma política completa de auto-troca.

### O que os outros fazem (evidência)

- **Agregação pela mais urgente:** Claude Status Bar: "a barra de menu mostra a de maior prioridade: uma sessão esperando permissão nunca fica escondida atrás de uma que está pensando"; ClaudeDot: "o ponto reflete o status mais urgente, o painel lista cada sessão".
- **Lista/painel das demais, com clique para saltar ao terminal da sessão:** ClaudeDot, code-island (cartões agrupados por agente), Open Island.
- **Pedidos enfileirados e rotulados por agente e sessão:** Vibe Island.
- **Pop-out automático para permissão e para concluído** (code-island: o notch "salta" para pedido de permissão e para tarefa concluída; concluído recolhe sozinho em 3 s).
- **HIG (Apple):** no máximo 3 minimais ao mesmo tempo; alertar "só por atualizações essenciais"; atualizar "só quando houver conteúdo novo"; preferir pouca interatividade, "limitar a um único elemento para evitar toques errados"; animações de conteúdo com no máximo 2 s; encerrar a atividade assim que a tarefa acaba. Nenhuma fonte encontrada define regra de troca por scroll entre atividades (relatos de usuário citam deslizar para alternar entre duas, não documentado pela Apple).

### Regras recomendadas

| Regra | Motivo |
|-------|--------|
| **Ordem estável** dos pontos (por início da sessão, mais antiga à esquerda). Sessão nova entra no fim | Posição previsível; rolar nunca cai na sessão errada |
| **Auto-troca só para permissão**; nunca para "concluído" ou "voltou a trabalhar" | Só o que bloqueia o Claude justifica tomar a tela |
| **Uma vez por pedido** (`requestId`): se o usuário rolar para longe de um pedido pendente, não puxar de novo. O ponto continua pulsando | Evita "brigar" com o usuário; urgência persiste sem sequestrar |
| **Não trocar durante gesto de scroll ativo** (<~400 ms depois do último `wheel`) nem com o cursor em interação com botão. Adiar o snap até o gesto acabar | Inércia de touchpad empurra vários passos; snap no meio dela troca de novo logo em seguida |
| **Trava de scroll de ~300–500 ms após um snap** | Inércia não deve afastar o usuário do pedido que acabou de aparecer |
| **Vários pedidos pendentes:** fila FIFO (o mais antigo primeiro, é o que bloqueia há mais tempo); mostrar "1 de N"; ao resolver, ir para o próximo pendente, não voltar à sessão anterior | Evita aprovar o pedido errado depois de resolver o primeiro |
| **Todo snap reinicia o atraso de 0,8 s e a exigência de rolar até o fim**; Allow/Deny amarrados ao `requestId` visível; clique cujo `mousedown` e `mouseup` caem em pedidos diferentes é ignorado | Fronteira de confiança do projeto |
| **Transição direcional** na troca (mola k=250, c=31, deslocamento vertical 34 px, fade — constantes do mod) e **rótulo da sessão** sempre visível | Dá o contexto de "mudei de sessão" sem som extra |
| **Nudge + pulso do ponto** quando algo muda numa sessão fora de vista | Avisa sem mudar o conteúdo à vista |
| **Respeitar "escondida"/tela cheia:** pedido de permissão toca o som, mas não desfaz o esconder do usuário | Terminal continua valendo em paralelo (decisão existente); ver "Decisões em aberto" |

## APIs de terceiros: onde empurrar conteúdo? (perguntas 3 e 4)

**Resposta curta: no macOS, nada documentado; no Windows, praticamente nada.** O único caminho universal, funcional e sob nosso controle é o encaixe lateral + âncora/deslocamento.

### macOS

| App | Licença/Tipo | API, URL scheme ou extensão para terceiros? | Evidência | Confiança |
|-----|--------------|---------------------------------------------|-----------|-----------|
| **NotchNook** | Comercial | **Nenhuma documentada.** A página lista mídia, calendário, bandeja de arquivos, clipboard, AirDrop e "aprovar Claude Code e Codex pelo notch"; sem menção a API/URL scheme/extensões | Página oficial lo.cafe/notchnook (lida 2026-11-21) | MEDIUM (ausência na página; não verifiquei o bundle `lo.cafe.NotchNook` por URL scheme) |
| **Alcove** | Comercial | **Nenhuma documentada.** Página lista Live Activities, HUDs e gestos sem dizer quais apps fornecem as atividades | tryalcove.com (lida 2026-11-21) | MEDIUM |
| **boring.notch** | GPL-3.0, Swift | **Não.** "Extension system 🧩" aparece como *planejado* (item não marcado do roadmap); README tem dois itens ocultos marcados como extensões (histórico de clipboard, indicador de download) e diz que extensões estão em desenvolvimento. Existe uma pasta `BoringNotchXPCHelper` no repo cuja finalidade o README não explica | README oficial TheBoredTeam/boring.notch | HIGH para "não documentado hoje"; XPC helper: não verificado |
| **Atoll** | open source | **Não.** Live Activities são embutidas (mídia, Focus, gravação, privacidade, downloads, bateria). Único canal programático: `open -a Atoll /caminho/arquivo` para a bandeja de arquivos | README oficial | MEDIUM |
| **SuperIsland** (shobhit99/SuperIsland) | open source | **Sim, mas só extensões internas:** pacotes JavaScript em contexto JavaScriptCore isolado (`manifest.json` + `index.js`), com `setCompactView`/`setExpandedView`, `onRefresh()` periódico, `store`, `http.fetch()` (só saída), `notifications.send()`. **Não documenta** servidor local, URL scheme, CLI ou notificação distribuída para entrada externa | README e `EXTENSIONS.md` do repo; docs completas em dynamicisland.app/docs (não lidas) | MEDIUM |
| DynamicLake | comercial | Sem informação encontrada de API; não confirmei sequer se existe versão Windows | Listagens de produto | LOW |

**Possibilidade, não verificada:** uma extensão SuperIsland poderia, em tese, consultar via `http.fetch()` um endpoint HTTP em loopback exposto pelo Claude Island. Isso exigiria (a) servidor HTTP local novo no Claude Island, (b) confirmar que o sandbox permite loopback e (c) manter um segundo produto de pequeno alcance. **Não recomendo para este milestone.**

**Implicação:** no macOS, a convivência com NotchNook/Alcove/boring.notch é por posicionamento (âncora/deslocamento), não por integração. Ressalva importante: **o NotchNook já lista aprovação de Claude Code pelo notch.** Se o usuário ligar isso *e* o Claude Island, haverá duas interfaces para o mesmo `PermissionRequest`. Como o Claude Code combina decisões de dois hooks de permissão em paralelo **não foi verificado**; testar antes de prometer convivência. E o macOS nunca foi testado pelo autor (PROJECT.md), então o esforço de convivência no macOS deve ficar abaixo da prioridade.

### Windows

| App | API para terceiros? | Evidência | Confiança |
|-----|---------------------|-----------|-----------|
| Mod do Windhawk | **Não** (já confirmado em `WINDHAWK-MOD.md`) | Fonte do mod | HIGH |
| **WinLand** (luolangaga/WinLand, WinUI 3/.NET, 82 estrelas) | **Sim, dois caminhos:** (1) plugins .NET em-processo (`IslandPluginBase`, pacote `.lwp`), sem sandbox; (2) um listener HTTP em `127.0.0.1:47321` que recebe JSON `{type: task_start/task_end/task_progress/task_error, sessionId, message, detail, toolName, progress}`. O (2) **não está no README**, só aparece no código do `opencode-plugin/winland-monitor.ts` | README e código do plugin do repo | MEDIUM (porta/payload lidos no código, não testados rodando) |
| Lumen (Rust/Slint, MIT, 34 estrelas) | Não: barramento de eventos é interno | README | MEDIUM |
| Notchify, DynamicWin, WinIsland-X | Nenhuma encontrada (WinIsland-X e DynamicWin: página 404/repo sem fonte) | Busca e artigos | LOW |
| **Superfície do próprio Windows 11: agentes na barra de tarefas** | Existe uma API de tarefas de app (`Windows.UI.Shell.Tasks`, `AppTaskState`/`AppTaskContent`) que exibe uma tarefa longa na barra e mostra "concluído" (check verde) e "precisa de entrada" (alerta amarelo), ou seja, o mesmo trio de estados do Claude Island. Exige app **publicado/empacotado** com extensão `com.microsoft.apptaskprovider` no manifesto e está marcada experimental; sem efeito em Windows sem o recurso | Microsoft Learn (namespace) e Pureinfotech 2025-11-19 (Ignite) | LOW–MEDIUM; disponibilidade em releases estáveis não verificada |

**Implicação:** só vale monitorar a API de tarefas da barra do Windows; empacotar o app em MSIX só para isso está fora do escopo. O WinLand é nicho demais para justificar um adaptador agora; fica como nota.

## Feature Dependencies

```
Decisão de tecnologia (Electron vs Tauri)
    └──condiciona──> hover por posição + click-through dinâmico + wheel
                         ├──requires──> Scroll entre sessões
                         │                  ├──requires──> Ordem estável + identificação da sessão
                         │                  └──enhances──> Pontos por sessão (cor = estado)
                         └──requires──> Esconder em tela cheia / atalho global

Pontos por sessão ──requires──> estado por sessão já exposto (state.js)
Snap para sessão com permissão
    ├──requires──> Scroll entre sessões (trava de inércia, uma vez por pedido)
    ├──requires──> requestId amarrado a Allow/Deny + proteções reiniciadas a cada troca
    └──requires──> fila de pedidos pendentes (FIFO, "1 de N")

Molas assimétricas + nudge ──enhances──> troca de sessão (transição direcional)
Menu de clique direito ──requires──> persistência de preferências
Temas / formas / material ──enhances──> menu de clique direito
Âncora + deslocamento ──requires──> persistência por monitor (já existe)
    └──enables──> Dock lateral ao lado da ilha do Windhawk (HIGH, só Windows, opcional)
Atalho global de aprovação ──conflicts──> Core Value (aprovar sem ver); adiar
Auto-troca por qualquer estado ──conflicts──> leitura de pedido de permissão
```

### Notas de dependência

- **Scroll requires hover por posição + click-through dinâmico:** em Electron, a janela com `setIgnoreMouseEvents(true, { forward: true })` encaminha só movimentos do mouse, não a roda (conhecimento próprio do comportamento documentado do Electron; **verificar com um teste de 10 linhas**). Logo, o scroll só funciona se o hover por posição desligar o click-through quando o cursor estiver sobre a pílula. É a razão de a decisão de tecnologia vir antes e de hover/click-through virem antes do scroll.
- **Snap requires requestId + proteções:** sem isso, a auto-troca cria o cenário exato que o Core Value proíbe (clicar num pedido que acabou de aparecer).
- **Dock com o Windhawk requires âncora/deslocamento:** o encaixe é âncora calculada a partir da geometria da janela do mod; a configuração manual é o plano B se a detecção falhar.
- **Pontos por sessão enhance scroll:** sem indicador a rolagem é cega; com ele o scroll deixa de ser a única forma de descobrir sessões.
- **Temas enhance menu:** 8 temas sem menu não são acessíveis; menu sem persistência é frustrante.

## MVP Definition

### Launch With (este milestone, primeira entrega)

- [ ] Decisão de tecnologia por medição (Electron vs Tauri) — bloqueia o resto; já em Active
- [ ] Hover por posição + click-through dinâmico + proteções de permissão preservadas — base de scroll e de esconder
- [ ] Molas assimétricas, nudge, hover com ampliação (4 estilos, velocidade) — identidade do milestone
- [ ] Pontos por sessão (cor/pulso por estado), rótulo da sessão, ordem estável
- [ ] Scroll entre sessões com constantes do mod, sem wrap, com trava de inércia
- [ ] Snap para sessão com permissão + fila FIFO "1 de N" + `requestId` amarrado às ações — **requisito de segurança**, não opcional
- [ ] Menu de clique direito com preferências persistidas; atalho global de esconder; esconder em tela cheia
- [ ] Âncora e deslocamento configuráveis (convivência básica)
- [ ] Atribuição MIT ao autor do mod (`THIRD_PARTY_NOTICES.md`)

### Add After Validation (v1.x do milestone)

- [ ] 8 temas + formas (pílula/notch/W11) + reflexo de acento por estado — visual; baixa complexidade, pode vir logo após a base
- [ ] Clique no ponto para ir à sessão + pré-visualização no hover do ponto — acessibilidade e descobribilidade, assim que scroll estiver validado em uso
- [ ] Dock lateral ao lado do Windhawk — só depois de conferir na tela a geometria real das duas ilhas e a classe da janela

### Future Consideration (v2+)

- [ ] Atalho de aprovação com a ilha visível (condições acima) — só com política de segurança fechada
- [ ] Exibir resumo/diff de edição no pedido (ClaudeNotch) e responder `AskUserQuestion` por opções (ClaudeNotch, Vibe Island ⌘1–3) — valor alto, mas é outra feature (interação), não "port do mod"
- [ ] Histórico de aprovações e custo por sessão (ClaudeNotch) — fora do escopo
- [ ] Adaptador para SuperIsland/WinLand ou API de tarefas da barra do Windows — monitorar, sem demanda
- [ ] Convivência ativa no macOS (detecção de janelas de NotchNook/Alcove via lista de janelas do sistema) — depende de o autor testar o macOS primeiro

## Feature Prioritization Matrix

| Feature | Valor | Custo | Prioridade |
|---------|-------|-------|------------|
| requestId + proteções reiniciadas na troca | HIGH | MEDIUM | P1 |
| Hover por posição + click-through dinâmico | HIGH | MEDIUM | P1 |
| Scroll entre sessões | HIGH | MEDIUM | P1 |
| Snap para permissão + fila | HIGH | MEDIUM | P1 |
| Pontos por sessão + rótulo + ordem estável | HIGH | LOW–MEDIUM | P1 |
| Molas + nudge + hover | MEDIUM | MEDIUM | P1 |
| Menu direito + persistência | MEDIUM | LOW–MEDIUM | P1 |
| Esconder (atalho + tela cheia) | MEDIUM | MEDIUM | P1 |
| Âncora + deslocamento | MEDIUM | LOW | P1 |
| 8 temas, formas, reflexo de acento | MEDIUM | LOW–MEDIUM | P2 |
| Clique/preview no ponto | MEDIUM | LOW–MEDIUM | P2 |
| Dock ao lado do Windhawk | MEDIUM (só o autor, por ora) | HIGH | P2 |
| Atalho de aprovação | MEDIUM | MEDIUM | P3 (risco de segurança) |
| Adaptadores de terceiros / macOS ativo | LOW | HIGH | P3 |

**Chave:** P1 = necessário para o milestone; P2 = quando possível; P3 = futuro.

## Competitor Feature Analysis

| Recurso | Vibe Island / Vibe Notch | AgentPeek / ClaudeNotch | Claude Status Bar / ClaudeDot | code-island / Open Island | Nossa abordagem |
|---------|--------------------------|--------------------------|--------------------------------|---------------------------|-----------------|
| Plataforma | macOS | macOS | macOS (barra de menu) | macOS | Windows, macOS, Linux |
| Multi-sessão | Várias sessões; pedidos em fila rotulados por agente e sessão | Sessões em tempo real; ClaudeNotch: custo/contexto por sessão (como as sessões são roteadas não está documentado) | Ícone agregado pela mais urgente; lista no menu/painel | Painel com cartões agrupados por agente, filtros | Uma sessão por vez, scroll + pontos, snap para permissão |
| Troca | Clique salta ao terminal (agentes sem aprovação bidirecional) | Não documentado | Clique na sessão salta ao terminal (ClaudeDot) | Clique no cartão salta ao terminal/IDE | Scroll e clique no ponto; botão "foco no terminal" já existe |
| Aprovação | Notch com Allow/Deny, ⌘Y/⌘N | One-key; "Allow All (N)"; Always Allow (AgentPeek); Touch ID em destrutivo (ClaudeNotch) | Só indicador (ponto amarelo parado) | Pop-out com detalhes e botões | Allow/Deny só da chamada exibida, com atraso, scroll até o fim, bind ao `requestId` |
| Expansão | No pedido | No pedido | Dropdown | Pop-out em permissão; concluído recolhe em 3 s; hover em tela sem notch | Hover por posição ou clique; nudge em mudança de estado |
| Personalização | Sons | Não documentado | Estilos de animação, cor do ícone, timer/texto | 5 temas, pacotes de som | 8 temas, formas, 4 estilos de mola, transparência |
| Convivência com outros notch | Não documentado | Não documentado | n/a (barra de menu) | Não documentado | Âncora/deslocamento; dock com Windhawk (Windows) |

## Decisões em aberto (precisam do autor)

1. **Snap-back quando o usuário rolou para longe de um pedido pendente:** recomendo "uma vez por pedido + ponto pulsando" para não brigar com o usuário. A formulação do milestone ("volta sozinho") pode ser lida como snap sempre. Confirmar.
2. **Pedido de permissão com a ilha escondida ou em tela cheia:** recomendo só som, sem desfazer o esconder (o terminal continua valendo). Alternativa: furar o esconder só para permissão. Confirmar.
3. **Atalho de aprovação:** manter fora deste milestone (recomendado) ou aceitar com as condições da seção de anti-features.
4. **Convivência no macOS:** aceitar que fique só em âncora/deslocamento enquanto o macOS não for testado.

## Sources

- Panorama de concorrentes de agente (README/páginas, lidos em 2026-11-21; confiança MEDIUM por serem páginas de produto):
  - Open Island: https://raw.githubusercontent.com/Octane0411/open-vibe-island/main/README.md
  - Claude Status Bar: https://github.com/m1ckc3s/claude-status-bar
  - ClaudeDot: https://github.com/poorfish/ClaudeDot
  - code-island: https://rifqiakrm.github.io/code-island/
  - ClaudeNotch (comparativo): https://rawsun007.github.io/claude-notch/compare/
  - Vibe Island (guia de aprovação): https://vibeisland.app/guides/approve-ai-agent-permissions-from-notch/
  - Vibe Notch (docs indexadas): https://docsearch.algolia.com/mcp/docs/repo/farouqaldori/vibe-notch (relação entre Vibe Notch e Vibe Island não confirmada)
  - AgentPeek (Product Hunt): https://www.producthunt.com/posts/agentpeek-2
- Apps de notch/ilha (API para terceiros):
  - NotchNook: https://lo.cafe/notchnook
  - Alcove: https://tryalcove.com
  - boring.notch: https://raw.githubusercontent.com/TheBoredTeam/boring.notch/main/README.md e https://github.com/TheBoredTeam/boring.notch
  - Atoll: https://github.com/Ebullioscopic/Atoll
  - SuperIsland: https://github.com/shobhit99/SuperIsland e https://raw.githubusercontent.com/shobhit99/SuperIsland/main/EXTENSIONS.md
- Windows:
  - WinLand: https://github.com/luolangaga/WinLand e https://raw.githubusercontent.com/luolangaga/WinLand/main/opencode-plugin/winland-monitor.ts
  - Lumen: https://github.com/Risuleia/Lumen
  - Notchify (Windows Central): https://www.windowscentral.com/software-apps/notchify-brings-macos-style-dynamic-island-flair-to-windows-11
  - Agentes na barra de tarefas do Windows 11: https://pureinfotech.com/windows-11-ai-agent-taskbar/ (2025-11-19) e https://learn.microsoft.com/windows/apps/api-reference/compliance/windows-ui-shell-tasks (via busca; página não aberta, marcada experimental)
- Guia de design: Apple HIG, Live Activities (lida na íntegra, copyright 2026): https://developer.apple.com/design/human-interface-guidelines/live-activities
- Referência interna: `.planning/research/WINDHAWK-MOD.md` (constantes de scroll, mola, temas, convivência), `.planning/PROJECT.md`

**Não verificado:** classe da janela do mod; geometria real das duas ilhas na tela; comportamento do Electron com `wheel` sob click-through; como o Claude Code combina decisões de dois hooks `PermissionRequest` concorrentes (relevante se o usuário usar NotchNook com aprovação de agentes); conteúdo de dynamicisland.app/docs; se o sandbox do SuperIsland permite loopback; disponibilidade estável da API de tarefas da barra do Windows.

---
*Feature research for: ilha de desktop para status de sessões de agentes de código*
*Pesquisado em: 2026-11-21*
