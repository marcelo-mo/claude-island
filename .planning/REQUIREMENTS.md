# Requirements: Claude Island

**Defined:** 2026-11-21
**Core Value:** Saber de relance o que cada sessão do Claude Code está fazendo e responder ao que ela pede sem trocar de janela — sem nunca aprovar algo que o usuário não viu.

Escopo deste milestone: reformular a ilha com o comportamento e o visual do mod "Dynamic Island for Windows" (ver `research/WINDHAWK-MOD.md`), trocar o contador por scroll entre sessões e conviver com a ilha do sistema. Defaults de produto vêm de `research/SUMMARY.md` § "Decisões padrão recomendadas" (o usuário pediu modo automático).

## v1 Requirements

### Base tecnológica (BASE)

- [x] **BASE-01**: O autor consegue reproduzir a medição de consumo com um script versionado (`scripts/measure-footprint.ps1`) que soma o *private working set* e a CPU de toda a árvore de processos da ilha (incluindo `msedgewebview2.exe`), em cenários fixos (ociosa, trabalhando com animação, precisa de você), 3 execuções com mediana
- [x] **BASE-02**: A regra de decisão Electron × Tauri está escrita e versionada **antes** da medição: Tauri só vence se passar os gates funcionais no Windows com os 2 monitores (transparência sem borda/flash, hover sem perder clique, clicar na pílula não tira o foco do terminal, acima de vídeo em tela cheia, posição certa nos dois monitores) **e** usar ≤60% do *private working set* do melhor Electron otimizado **e** CPU ociosa ≤ a do Electron otimizado
- [x] **BASE-03**: A comparação mede pelo menos o Electron atual, o Electron otimizado (sem animação contínua de `box-shadow`; uma janela só) e uma casca Tauri carregando a mesma interface; o caminho de permissão ponta a ponta só é portado para o Tauri se ele passar a primeira etapa
- [x] **BASE-04**: A decisão e os números ficam registrados em `PROJECT.md` (Key Decisions); se o Tauri vencer, o roadmap ganha uma fase de port antes das fases que mexem no processo principal
- [x] **BASE-05**: A ilha parada deixa de gastar CPU com animação contínua: o brilho do contorno anima só `opacity`/`transform` e nenhuma animação roda com a ilha ociosa ou escondida

### Segurança da permissão (SEG)

- [x] **SEG-01**: Uma decisão (Permitir/Negar) sempre se aplica ao pedido que o processo principal registrou como exibido; o renderer envia só a intenção e um eco do id exibido, que pode apenas recusar a decisão quando diverge, nunca escolher o alvo
- [x] **SEG-02**: O pedido exibido só muda por um caminho único no processo principal (`refresh()`), e qualquer troca do que está na tela (pedido novo, troca de sessão, scroll, snap, mudança de tema/forma que mova botões, reexibição) reinicia o armamento dos botões
- [x] **SEG-03**: Os botões só armam depois de 0,8 s com o pedido na tela **e** com a animação assentada e o cursor parado sobre eles por um instante; botões não sofrem ampliação de hover nem nudge
- [x] **SEG-04**: Permitir/Negar só vale se o clique começa e termina no mesmo botão do mesmo pedido; com duas ilhas, o primeiro clique vence e o segundo é ignorado
- [x] **SEG-05**: Com um pedido na tela, a ilha fica 100% opaca, a rolagem sobre o texto do pedido só rola o texto, e o estado "lido até o fim" zera a cada pedido novo, ignorando a inércia da roda por ~300–400 ms após qualquer troca de conteúdo
- [x] **SEG-06**: Ilha escondida, em tela cheia ou fora da área visível não aceita decisão; esconder nunca aprova, e reexibir rearma
- [x] **SEG-07**: A regra de aceite da decisão é uma função pura testada (`node:test`), com vetores de teste compartilháveis caso a base mude; o caminho `island:decide` deixa de ser o único ponto sem teste
- [x] **SEG-08**: As janelas usam `webPreferences` explícitas e seguras (`contextIsolation`, `sandbox`, sem `nodeIntegration`), e as preferências só podem ser alteradas pelo menu nativo do processo principal, nunca por um canal do renderer

### Animação (ANIM)

- [ ] **ANIM-01**: A pílula muda de tamanho por molas assimétricas — ao crescer, com leve passagem do ponto (≈4–8%); ao encolher, sem balanço — e uma mudança no meio da animação continua do ponto e da velocidade atuais, sem salto
- [ ] **ANIM-02**: O usuário escolhe entre 4 estilos de animação (Suave, Padrão, Elástico, Rápido) e uma velocidade de 0,5× a 2×
- [ ] **ANIM-03**: Quando a sessão exibida muda de estado, a pílula dá um pequeno salto (nudge), no máximo uma vez a cada 0,45 s; no hover ela amplia levemente (≈2,5%)
- [ ] **ANIM-04**: A janela não muda de tamanho durante a animação (palco fixo dimensionado para o estilo mais elástico), e o laço de animação só roda enquanto há mola em movimento
- [ ] **ANIM-05**: Com "reduzir movimento" do sistema ativo, as transições acontecem sem mola nem nudge

### Visual (VIS)

- [ ] **VIS-01**: O usuário escolhe entre 8 temas (Obsidian, Graphite, Slate, Nord, Evergreen, Espresso, Plum, Porcelain) ou o automático, que segue o claro/escuro do sistema como hoje
- [ ] **VIS-02**: O usuário escolhe a forma da ilha entre pílula, notch (topo reto colado na borda) e Windows 11 (cantos menores)
- [ ] **VIS-03**: A superfície tem profundidade, sombra e um reflexo de cor no topo tingido pela cor do estado da sessão (laranja trabalhando, âmbar precisa de você, verde concluído)
- [ ] **VIS-04**: O bloco de permissão mantém contraste mínimo (texto ≥4,5:1, controles ≥3:1) em todos os temas, verificado por teste, e o reflexo de cor nunca pinta o comando exibido
- [ ] **VIS-05**: As fontes são as do sistema (nada embarcado) e as larguras não dependem de medidas fixas de uma fonte específica

### Hover e entrada (HOV)

- [ ] **HOV-01**: A ilha detecta o cursor pela posição de tela (polling no processo principal só enquanto a pílula está visível) e decide pelo retângulo real da pílula se captura o mouse, com histerese para não piscar na borda
- [ ] **HOV-02**: Fora da pílula, cliques e rolagem atravessam para as janelas de baixo; dentro dela, a ilha recebe clique e roda do mouse — inclusive com um terminal elevado em foco e no monitor a 125%
- [ ] **HOV-03**: O usuário escolhe se a ilha expande ao passar o mouse (padrão) ou ao clicar
- [ ] **HOV-04**: Arrastar, duplo clique para recentralizar e os botões continuam funcionando com o novo hover

### Preferências e controles (PREF)

- [ ] **PREF-01**: Clique direito na ilha abre um menu com tema, forma, estilo e velocidade da animação, expandir no hover/clique, fixar aberta, transparência, âncora e esconder
- [ ] **PREF-02**: As escolhas ficam salvas e voltam iguais após reiniciar; um arquivo de preferências corrompido ou antigo não impede a ilha de subir (cada valor inválido volta ao padrão)
- [ ] **PREF-03**: Um atalho global esconde e mostra a ilha; o padrão é Ctrl+Alt+C se não conflitar com AltGr+C no teclado ABNT2, senão outro padrão sem conflito; se o atalho não puder ser registrado, o menu avisa
- [ ] **PREF-04**: O usuário escolhe a âncora da ilha (topo central, cantos e base) e o arraste ajusta o deslocamento a partir dela, preso ao monitor da própria ilha
- [ ] **PREF-05**: O usuário pode optar por uma ilha só (monitor principal ou o monitor do cursor) em vez de uma por monitor, que continua sendo o padrão
- [ ] **PREF-06**: Transparência configurável (100/85/70/55%), nunca aplicada enquanto houver pedido de permissão na tela

### Sessões (SESS)

- [ ] **SESS-01**: Com várias sessões abertas, a ilha mostra pontos (um por sessão, cor = estado, pulso = pede permissão) no lugar do contador, em ordem estável (da mais antiga para a mais nova), com o nome do projeto da sessão exibida sempre visível
- [ ] **SESS-02**: A roda do mouse sobre a pílula (fora do texto de um pedido) troca a sessão exibida, sem dar a volta no fim, com as regras de gesto do mod (acumular, pausa entre passos, touchpad mais lento)
- [ ] **SESS-03**: Clicar num ponto leva àquela sessão
- [ ] **SESS-04**: Quando uma sessão faz um pedido de permissão novo, a ilha vai sozinha até ela uma vez por pedido — nunca no meio de um gesto de rolagem —, e se o usuário rolar para longe ela não puxa de novo; o ponto segue pulsando
- [ ] **SESS-05**: Pedidos simultâneos entram numa fila na ordem de chegada ("1 de N"); um pedido novo não substitui o que está sendo lido, e ao responder a ilha vai para o próximo pendente
- [ ] **SESS-06**: A troca automática acontece só por pedido de permissão, nunca por "concluído" ou "voltou a trabalhar"
- [ ] **SESS-07**: Sessões mortas (terminal fechado sem `SessionEnd`) saem da lista e seus arquivos antigos são removidos

### Tela cheia (TELA)

- [ ] **TELA-01**: No Windows, quando um app ocupa o monitor inteiro, a ilha daquele monitor some, e volta quando ele sai; a área de trabalho e a própria ilha não contam como tela cheia
- [ ] **TELA-02**: Um pedido de permissão com a ilha escondida ou em tela cheia só toca o som; a ilha não reaparece por cima e o terminal segue valendo

### Convivência com a ilha do sistema (CONV)

- [ ] **CONV-01**: Com a ilha do Windhawk ativa, a nossa pode se encaixar como uma segunda bolha ao lado dela, por um deslocamento configurável, expandindo para fora sem cobri-la
- [ ] **CONV-02**: A ilha nunca disputa o "sempre no topo" com outros overlays por timer
- [ ] **CONV-03**: Uma proposta de API para conteúdo externo é enviada ao autor do mod (issue no repositório dele), e os demais caminhos de integração (toast do Windows, apps de notch no macOS) ficam registrados com o que foi verificado
- [x] **CONV-04**: `THIRD_PARTY_NOTICES.md` credita o mod com o texto MIT completo, versão e titular conferido, antes do primeiro commit com constantes portadas

## v2 Requirements

### Integração

- **INTG-01**: Integração real com a ilha do Windhawk, se o autor do mod aceitar uma API de conteúdo externo
- **INTG-02**: Convivência ativa com apps de notch no macOS (NotchNook, Alcove, boring.notch), se algum expuser API
- **INTG-03**: Teste de convivência com o NotchNook aprovando o mesmo `PermissionRequest`

### Interação

- **INTR-01**: Pré-visualização somente leitura ao passar o mouse sobre um ponto
- **INTR-02**: Blur/acrílico de fundo (exige recorte arredondado nativo)
- **INTR-03**: Validação em macOS e Linux (hoje "melhor esforço, não testado")

## Out of Scope

| Feature | Reason |
|---------|--------|
| Módulos de sistema do mod (mídia, letras, clima, hardware, game overlay, notificações, calendário, área de transferência, bandeja, pomodoro, câmera/microfone, Bluetooth, volume, brilho) | A ilha só existe enquanto o Claude roda; a maioria exige código nativo e quebra multiplataforma |
| Reescrever em C# ou C++ | Perde macOS e Linux |
| Virar módulo dentro do mod do Windhawk (fork em C++) | Só Windows, dependente do Windhawk; a aprovação de permissões rodaria em código de terceiros |
| "Permitir sempre", aprovar em lote, atalho global de Permitir/Negar | Aumentam o risco de aprovar sem ver; regras permanentes ficam no terminal |
| Auto-troca por qualquer mudança de estado, carrossel automático, dar a volta no scroll, ordenar por urgência, duas sessões lado a lado | Surpreendem o usuário e movem botões sob o cursor |
| Gambiarras de integração (registro `ProgressPercent`, sessão de mídia falsa) | Frágeis e sem valor real |
| Wayland nativo no Linux | Sem posição de janela, topo e cursor; forçar X11/XWayland |
| Engenharia reversa (REA/Ghidra) | O mod é código aberto |
| Embarcar fontes Segoe | Licença não permite |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BASE-01 | Phase 1 | Complete |
| BASE-02 | Phase 1 | Complete |
| BASE-03 | Phase 1 | Complete |
| BASE-04 | Phase 1 | Complete |
| BASE-05 | Phase 1 | Complete |
| SEG-01 | Phase 2 | Complete |
| SEG-02 | Phase 2 | Complete |
| SEG-03 | Phase 2 | Complete |
| SEG-04 | Phase 2 | Complete |
| SEG-05 | Phase 2 | Complete |
| SEG-06 | Phase 2 | Complete |
| SEG-07 | Phase 2 | Complete |
| SEG-08 | Phase 2 | Complete |
| CONV-04 | Phase 2 | Complete |
| ANIM-01 | Phase 3 | Pending |
| ANIM-02 | Phase 3 | Pending |
| ANIM-03 | Phase 3 | Pending |
| ANIM-04 | Phase 3 | Pending |
| ANIM-05 | Phase 3 | Pending |
| VIS-01 | Phase 3 | Pending |
| VIS-02 | Phase 3 | Pending |
| VIS-03 | Phase 3 | Pending |
| VIS-04 | Phase 3 | Pending |
| VIS-05 | Phase 3 | Pending |
| HOV-01 | Phase 4 | Pending |
| HOV-02 | Phase 4 | Pending |
| HOV-03 | Phase 4 | Pending |
| HOV-04 | Phase 4 | Pending |
| PREF-01 | Phase 4 | Pending |
| PREF-02 | Phase 4 | Pending |
| PREF-03 | Phase 4 | Pending |
| PREF-04 | Phase 4 | Pending |
| PREF-05 | Phase 4 | Pending |
| PREF-06 | Phase 4 | Pending |
| TELA-01 | Phase 4 | Pending |
| TELA-02 | Phase 4 | Pending |
| SESS-01 | Phase 5 | Pending |
| SESS-02 | Phase 5 | Pending |
| SESS-03 | Phase 5 | Pending |
| SESS-04 | Phase 5 | Pending |
| SESS-05 | Phase 5 | Pending |
| SESS-06 | Phase 5 | Pending |
| SESS-07 | Phase 5 | Pending |
| CONV-01 | Phase 6 | Pending |
| CONV-02 | Phase 6 | Pending |
| CONV-03 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 46 total
- Mapped to phases: 46 ✓
- Unmapped: 0

---
*Requirements defined: 2026-11-21*
*Last updated: 2026-11-21 after initial definition*
