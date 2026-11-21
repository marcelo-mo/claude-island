# Roadmap: Claude Island

## Overview

Reformular a ilha com o comportamento e o visual do mod "Dynamic Island for Windows" (código aberto, MIT) sem perder a razão de existir do projeto: nunca aprovar uma permissão que o usuário não viu. O caminho começa com um spike que decide Electron × Tauri por medição, com a regra escrita antes dos números. Segue com a fundação segura do gate de permissão e com o trabalho de renderer que não depende da base (molas, temas, formas, material). Depois entra o trabalho de processo principal (hover pelo cursor, menu, preferências, atalho, tela cheia), que depende da decisão de base. Em seguida vem a peça central do milestone, várias sessões com scroll, pontos e fila de permissão. O roadmap fecha com a convivência com a ilha do Windhawk, a parte de maior incerteza e a única que pode ser cortada sem perder o milestone.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (3.1): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Spike de medição e decisão de base** - Decidir Electron × Tauri por medição reproduzível e tirar da ilha parada o custo de animação contínua
- [ ] **Phase 2: Fundação segura do gate de permissão** - Decisão de Permitir/Negar só atinge o pedido visto, comprovado por testes, antes de qualquer feature mudar a tela
- [ ] **Phase 3: Palco fixo, animação e visual** - Molas assimétricas, nudge, 8 temas, 3 formas e material com reflexo de estado, sem comprometer a leitura do pedido
- [ ] **Phase 4: Entrada, preferências e comportamento no sistema** - Hover pela posição do cursor, menu de clique direito, atalho, âncora e esconder em tela cheia
- [ ] **Phase 5: Sessões** - Scroll entre sessões, pontos, snap para quem pede permissão e fila "1 de N"
- [ ] **Phase 6: Convivência com a ilha do sistema** - Segunda bolha ao lado da ilha do Windhawk e registro dos demais caminhos de integração

## Ordem e regras de execução

**Ordem:** 1 → 2 → 3 → (3.1 condicional) → 4 → 5 → 6

**Por que esta ordem:**
- O spike vem primeiro porque o autor quer a base decidida antes de reescrever comportamento. Só o trabalho de processo principal (Fases 4 a 6) depende dele.
- As Fases 2 e 3 são portáveis (lógica pura e renderer) e valem nas duas bases, então nenhum resultado do spike as desperdiça.
- O gate de permissão (Fase 2) precede tudo que muda o que aparece na tela. Se o scroll chegasse antes, criaria um segundo caminho de troca de pedido.
- O hover por cursor (Fase 4) precede o scroll de sessões (Fase 5): a roda só chega ao renderer com a captura do mouse ligada.
- A convivência com o Windhawk (Fase 6) fica por último: maior incerteza, só Windows, só o autor. O plano B (âncora e deslocamento manuais, Fase 4) já existe se a Fase 6 for cortada.

**Regras que valem para toda fase (critério de verificação, não recomendação):**
- Hover, scroll, nudge, tema, opacidade e esconder nunca habilitam nem disparam uma decisão de permissão. Toda fase que muda o que aparece na tela ou como a ilha recebe entrada roda a suíte do gate (`node:test`, incluindo `fixtures/permission-vectors.json`) antes de fechar.
- Os hooks nunca quebram nem atrasam a sessão do Claude Code (falha silenciosa, saída 0).
- macOS e Linux seguem como "melhor esforço, não testado". A decisão de base e qualquer medição valem para o Windows e declaram isso.

## Fase condicional: Port para Tauri (não numerada)

Esta fase **não existe agora**. Ela só é criada se a Fase 1 decidir por Tauri, e entra como fase decimal 3.1 (`/gsd-phase --insert 3`), antes da Fase 4, porque a Fase 4 em diante é código de processo principal que seria escrito duas vezes. Conteúdo previsto: casca Tauri com a mesma interface; gate de permissão reescrito em Rust, rodando os mesmos vetores de `fixtures/permission-vectors.json` com `node:test` e `cargo test` (SEG-07); depois cursor tick, arraste, preferências, menu, atalho e sonda de tela cheia; `hook.js` passa a lançar o executável; NSPanel no macOS; distribuição por binário. Se o Electron vencer, esta fase nunca é criada.

## Phase Details

### Phase 1: Spike de medição e decisão de base
**Goal:** O autor sabe, por número reproduzível e regra escrita antes da medição, se a base continua Electron ou vira Tauri, e a ilha parada deixa de gastar CPU com animação contínua
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: BASE-01, BASE-02, BASE-03, BASE-04, BASE-05
**Success Criteria** (what must be TRUE):
  1. A regra de decisão Electron × Tauri (gates funcionais no Windows com os 2 monitores, ≤60% do *private working set* do melhor Electron otimizado, CPU ociosa ≤ a do Electron otimizado) está versionada num commit anterior ao primeiro número medido, e o histórico do git mostra essa ordem
  2. O autor roda `scripts/measure-footprint.ps1` e obtém, para os cenários ociosa, trabalhando com animação e precisa de você, a mediana de 3 execuções do *private working set* e da CPU somados sobre a árvore inteira de processos (inclusive `msedgewebview2.exe`)
  3. Existe uma tabela comparando o Electron atual, o Electron otimizado (sem animação contínua de `box-shadow`, uma janela) e uma casca Tauri com a mesma interface, e o caminho de permissão ponta a ponta só foi portado para o Tauri se ele passou a primeira etapa
  4. Com a ilha parada ou escondida nenhuma animação CSS roda (o brilho do contorno anima só `opacity`/`transform`), e o script mostra a CPU ociosa abaixo da medição do Electron atual
  5. `PROJECT.md` (Key Decisions) registra a decisão e os números, e, se o Tauri venceu, este roadmap ganhou a fase de port antes da Fase 4
**Plans**: TBD
**Research flag**: sim. Método e casca Tauri nunca foram compilados; verificar `in-process-gpu` no Electron 45, `focusable`/`shadow` do Tauri 2.12 e foco do tao 0.37.1. Medir o Electron atual de novo com o mesmo script: não comparar com os 426 MB antigos.

### Phase 2: Fundação segura do gate de permissão
**Goal:** Permitir/Negar só pode atingir o pedido que o usuário estava vendo, comprovado por testes, antes de qualquer feature mudar o que aparece na tela, e o repositório está pronto para receber constantes portadas do mod
**Mode:** mvp
**Depends on**: Phase 1 (só ordem de execução; o trabalho independe do resultado da decisão de base)
**Requirements**: SEG-01, SEG-02, SEG-03, SEG-04, SEG-05, SEG-06, SEG-07, SEG-08, CONV-04
**Success Criteria** (what must be TRUE):
  1. Com dois pedidos chegando em sequência, ou o pedido mudando no instante do clique, Permitir/Negar só atinge o pedido que estava na tela; um eco de id divergente recusa a decisão e o renderer nunca escolhe o alvo, e o pedido exibido só muda por um único caminho no processo principal
  2. Depois de qualquer troca do que está na tela (pedido novo, reexibição) os botões ficam desarmados por 0,8 s e só armam com a transição de tamanho assentada e o cursor parado sobre eles; botões não ganham ampliação de hover; clique que começa num botão e termina em outro (ou em outro pedido) é descartado; com duas ilhas só o primeiro clique vale
  3. Com um pedido na tela a ilha está 100% opaca, a roda sobre o texto só rola o texto, "lido até o fim" zera a cada pedido novo e a inércia da roda nos 300–400 ms após uma troca não conta como leitura; ilha escondida, em tela cheia ou fora da área visível não aceita decisão, esconder nunca aprova e reexibir rearma
  4. A regra de aceite da decisão é uma função pura coberta por `node:test` com vetores compartilháveis (`fixtures/permission-vectors.json`), o caminho `island:decide` deixa de ser o único ponto sem teste, as janelas abrem com `contextIsolation` e `sandbox` ligados e sem `nodeIntegration`, e não existe canal do renderer para gravar preferências
  5. `THIRD_PARTY_NOTICES.md` credita o mod com o texto MIT completo, a versão 1.4.0 e o titular conferido no `LICENSE` do repositório do autor, e existe antes do primeiro commit com constantes portadas
**Plans**: 4/4 plans executed (sequenciais: todos a partir do 02-02 editam `gate.test.js` e o fixture)
- [x] 02-01-PLAN.md — eco do id ponta a ponta com `acceptDecision` pura e vetores; primeiro clique vence; janela invisível/fora da área não decide
- [x] 02-02-PLAN.md — funil único `refresh(reason)` com reducer puro; reexibir/restaurar/trocar de monitor rearma o relógio do main
- [x] 02-03-PLAN.md — armamento do renderer (0,8 s, layout assentado, cursor parado, mesma geração), roda e inércia com predicados puros testados
- [x] 02-04-PLAN.md — `THIRD_PARTY_NOTICES.md`, `webPreferences` explícitas com canais travados por teste, `effectiveOpacity`
**Research flag**: não. Código do próprio repositório; exige apenas testes primeiro. O CONV-04 mora aqui, e não na Fase 6, porque a Fase 3 é a primeira a portar constantes (molas) e o aviso de licença precisa existir antes.

### Phase 3: Palco fixo, animação e visual
**Goal:** A ilha se move e se parece com a do mod, com molas assimétricas num palco fixo, 8 temas, 3 formas e material com reflexo da cor do estado, sem comprometer a leitura do bloco de permissão
**Mode:** mvp
**Depends on**: Phase 2 (gate testado antes de mudar a tela; `THIRD_PARTY_NOTICES.md` antes de portar as constantes de mola)
**Requirements**: ANIM-01, ANIM-02, ANIM-03, ANIM-04, ANIM-05, VIS-01, VIS-02, VIS-03, VIS-04, VIS-05
**Success Criteria** (what must be TRUE):
  1. Ao crescer, a pílula passa levemente do ponto (≈4–8%); ao encolher, não balança; uma mudança de estado no meio da animação continua do ponto e da velocidade atuais, sem salto; com "reduzir movimento" do sistema ativo as transições acontecem sem mola nem nudge
  2. Cada um dos 4 estilos (Suave, Padrão, Elástico, Rápido) e a velocidade de 0,5× a 2× produzem um movimento distinguível quando aplicados por valor de preferência (o seletor no menu chega na Fase 4); quando a sessão exibida muda de estado a pílula dá um nudge no máximo uma vez a cada 0,45 s e amplia ≈2,5% no hover, e os botões de permissão não sofrem nenhum dos dois
  3. A janela não muda de tamanho durante a animação, nenhum quadro de animação roda com a ilha em repouso, e os botões de permissão seguem desarmados enquanto qualquer mola estiver em movimento (invariante da Fase 2 preservada)
  4. Os 8 temas (Obsidian, Graphite, Slate, Nord, Evergreen, Espresso, Plum, Porcelain) e o automático claro/escuro, e as formas pílula, notch e Windows 11, estão disponíveis quando aplicados por valor de preferência
  5. A superfície tem profundidade, sombra e um reflexo no topo tingido pela cor do estado (laranja trabalhando, âmbar precisa de você, verde concluído); o bloco de permissão passa no teste de contraste (texto ≥4,5:1, controles ≥3:1) nos 9 temas, o reflexo nunca pinta o comando exibido, e as fontes são as do sistema, sem larguras presas a uma fonte específica
**Plans**: TBD
**UI hint**: yes
**Research flag**: não. A mola já foi validada em Node. Confirmar só a carga de `spring.js` sob a CSP (`script-src 'self'` via `file://`, teste de 10 min) e validar visualmente o palco ampliado para o estilo Elástico a 2× (~520×410).

### Phase 4: Entrada, preferências e comportamento no sistema
**Goal:** A ilha reage ao cursor onde ele realmente está, é configurada pelo menu de clique direito e some por atalho ou quando um app ocupa a tela, sem nunca aceitar uma decisão estando escondida
**Mode:** mvp
**Depends on**: Phase 1 (decisão de base: se for Tauri, a fase de port 3.1 entra antes desta), Phase 2 (gate), Phase 3 (palco fixo e retângulo vivo da pílula)
**Requirements**: HOV-01, HOV-02, HOV-03, HOV-04, PREF-01, PREF-02, PREF-03, PREF-04, PREF-05, PREF-06, TELA-01, TELA-02
**Success Criteria** (what must be TRUE):
  1. Passar o cursor sobre a pílula a expande (ou o clique, conforme a preferência), sem piscar na borda; fora dela cliques e rolagem atravessam para as janelas de baixo; dentro dela a ilha recebe clique e roda do mouse, inclusive com um terminal elevado em foco e no monitor a 125%
  2. Arrastar, o duplo clique para recentralizar e os botões de permissão continuam funcionando com o novo hover
  3. O clique direito abre um menu com tema, forma, estilo e velocidade da animação, expandir no hover/clique, fixar aberta, transparência, âncora e esconder; as escolhas voltam iguais após reiniciar, e um arquivo de preferências corrompido ou antigo não impede a ilha de subir (cada valor inválido volta ao padrão)
  4. Um atalho global esconde e mostra a ilha (Ctrl+Alt+C se não conflitar com AltGr+C no ABNT2, senão outro padrão sem conflito; se não registrar, o menu avisa); esconder nunca aprova nada e reexibir rearma os botões; a âncora (topo central, cantos, base) e o arraste preso ao monitor da própria ilha funcionam; o modo "uma ilha só" é opcional e a transparência de 100/85/70/55% nunca vale com pedido na tela
  5. No Windows, quando um app ocupa o monitor inteiro a ilha daquele monitor some e volta quando ele sai (desktop e a própria ilha não contam); um pedido de permissão nessa hora só toca o som, a ilha não reaparece por cima e o terminal segue valendo
**Plans**: TBD
**UI hint**: yes
**Research flag**: sim. DPI a 125% e arredondamento de `getBounds()`; hover com terminal elevado (UIPI); `Menu.popup` em janela `focusable:false` (fallback: menu em HTML dentro do palco); AltGr+C no ABNT2 e `register()==false`; `koffi` no Electron 45 e com `allowBuilds` do pnpm 11 (ou a crate `windows` se o Tauri vencer).

### Phase 5: Sessões
**Goal:** Com várias sessões abertas o usuário vê uma por vez, troca com a roda do mouse ou clicando num ponto, e a ilha o leva sozinha, uma vez, à sessão que pede permissão, sem nunca mover um botão sob o cursor
**Mode:** mvp
**Depends on**: Phase 2 (gate), Phase 3 (palco e mola), Phase 4 (hover e captura do mouse)
**Requirements**: SESS-01, SESS-02, SESS-03, SESS-04, SESS-05, SESS-06, SESS-07
**Success Criteria** (what must be TRUE):
  1. Com várias sessões abertas a ilha mostra um ponto por sessão no lugar do contador (cor = estado, pulso = pede permissão), em ordem estável da mais antiga para a mais nova, com o nome do projeto da sessão exibida sempre visível
  2. A roda do mouse sobre a pílula troca a sessão exibida sem dar a volta no fim, com acúmulo, pausa entre passos e touchpad mais lento; clicar num ponto leva àquela sessão; sobre o texto de um pedido a roda só rola o texto
  3. Um pedido de permissão novo leva a ilha até a sessão uma vez por pedido, nunca no meio de um gesto de rolagem; se o usuário rolar para longe ela não puxa de novo e o ponto segue pulsando; "concluído" e "voltou a trabalhar" nunca trocam a sessão sozinhos
  4. Pedidos simultâneos entram numa fila na ordem de chegada ("1 de N"), um pedido novo não substitui o que está sendo lido e, ao responder, a ilha vai para o próximo pendente; toda troca (scroll, snap, fila) reinicia o armamento, e Permitir/Negar atinge só o pedido que está na tela
  5. Uma sessão morta (terminal fechado sem `SessionEnd`) sai da lista de pontos e seus arquivos antigos são removidos
**Plans**: TBD
**UI hint**: yes
**Research flag**: não, mas exige um teste curto de que `wheel` chega à janela não focável ("Rolar janelas inativas") e um plano próprio de testes do gate. Conferir se o hook já grava `cwd`/nome do projeto: se não, é mudança de contrato no hook (única exceção prevista a "hooks inalterados").

### Phase 6: Convivência com a ilha do sistema
**Goal:** Ao lado da ilha do Windhawk a nossa se encaixa como segunda bolha, sem cobri-la e sem disputar o topo, e os demais caminhos de integração ficam registrados com o que foi verificado
**Mode:** mvp
**Depends on**: Phase 4 (âncora, deslocamento e esconder). Última fase e cortável: se for cortada, âncora e deslocamento manuais da Fase 4 são o plano B.
**Requirements**: CONV-01, CONV-02, CONV-03
**Success Criteria** (what must be TRUE):
  1. Com a ilha do Windhawk ativa o usuário define um deslocamento e a nossa fica como segunda bolha ao lado dela, expandindo para fora sem cobrir a do mod
  2. Em 5 minutos de convivência medidos, nenhuma das duas ilhas some atrás da outra, e a nossa nunca reafirma o "sempre no topo" por timer
  3. Uma proposta de API para conteúdo externo está aberta como issue no repositório do autor do mod, e o toast do Windows e os apps de notch no macOS estão registrados em documento com o que foi verificado de cada um
**Plans**: TBD
**Research flag**: sim (pesquisa grande). Classe real da janela do mod, geometria nas duas ilhas, se o Electron reafirma o topo sozinho; confirmar na tela antes de qualquer promessa de encaixe.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 3.1 (condicional) → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Spike de medição e decisão de base | 0/TBD | Not started | - |
| 2. Fundação segura do gate de permissão | 4/4 | In Progress | - |
| 3. Palco fixo, animação e visual | 0/TBD | Not started | - |
| 4. Entrada, preferências e comportamento no sistema | 0/TBD | Not started | - |
| 5. Sessões | 0/TBD | Not started | - |
| 6. Convivência com a ilha do sistema | 0/TBD | Not started | - |
