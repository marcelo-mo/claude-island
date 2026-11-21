---
phase: 04-entrada-prefer-ncias-e-comportamento-no-sistema
plan: 06
subsystem: verificacao-humana-e-documentacao
tags: [electron, verificacao-manual, readme, validacao, pr]

requires:
  - phase: 04
    provides: menu, hover por cursor, âncoras, atalho e tela cheia sem sensor (04-01 a 04-05); HEARTBEAT_FILE e isHeartbeatFresh em state.js
provides:
  - scripts/human-checks.js (parseArgs, summarizeHover, summarizeHotkey com verdict por acelerador, islandIsRunning; --mode=hover, --mode=hotkey e --selftest)
  - seção "Menu, atalho e tela cheia" no README
  - tabela "Manual-Only Verifications" do 04-VALIDATION.md com uma linha por item da lista do PR
  - lista "Testar manualmente" consolidada e "Notas para o PR" (neste arquivo)
affects: []

actuals:
  tokens: 4200
  tasks: 2
  commits: 3

plan_head_before: 478686e8a238c64efb9cdc20822d9edf74e3ea9e
plan_head_after: f3549f7d07ffe368b80756d0f6d3824d528f8585

tech-stack:
  added: []
  patterns:
    - "ferramenta de verificação humana em scripts/, só escuta, com --selftest em Node puro e recusa de rodar com a ilha no ar"
    - "veredito por acelerador separando atalho tomado de atalho sem disparo"

key-files:
  created: [scripts/human-checks.js]
  modified: [README.md, .planning/phases/04-entrada-prefer-ncias-e-comportamento-no-sistema/04-VALIDATION.md, .planning/REQUIREMENTS.md]

key-decisions:
  - "human-checks.js exporta as quatro funções puras e só executa com require.main === module; nenhum módulo da ilha o carrega (critério com grep)"
  - "Entrada inválida por acelerador é ignorada em summarizeHotkey, em vez de virar 'tomado-por-outro-processo', para não acusar um conflito que não houve"
  - "TELA-02 volta a parcial no REQUIREMENTS.md: o ramo 'em tela cheia' espera o sensor do TELA-01"

requirements-completed: [HOV-02, PREF-01, PREF-03]

coverage:
  - id: D1
    description: "scripts/human-checks.js: argumentos, resumo do hover, veredito por acelerador e detecção da ilha no ar, conferidos pelo --selftest em Node puro; fora do Electron e sem --selftest sai 1 com o uso no stderr"
    requirement: HOV-02
    verification:
      - kind: command
        ref: "node scripts/human-checks.js --selftest (selftest ok, saída 0)"
        status: pass
      - kind: command
        ref: "node scripts/human-checks.js sem argumentos (saída 1 e uso no stderr)"
        status: pass
    human_judgment: true
    rationale: "Os modos --mode=hover e --mode=hotkey abrem janela e registram atalho no Electron e esperam uma pessoa; o executor só roda o selftest. CHK-01 e CHK-02 são o insumo humano de HOV-02 e PREF-03"
  - id: D2
    description: "README documenta o menu, o arquivo de preferências com quarentena, o atalho Ctrl+Alt+Shift+C, a transparência, a pílula ociosa sem pointer-events e o estado da tela cheia"
    requirement: PREF-01
    verification:
      - kind: command
        ref: "node -e (README cita Shift+C, pointer-events e human-checks) saída 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Tabela manual do 04-VALIDATION.md e lista 'Testar manualmente' deste SUMMARY com CHK-01 a CHK-08, respiro da expandida (ddda2e4) e os itens visuais; notas do PR com TELA-01 pendente"
    requirement: PREF-03
    verification:
      - kind: command
        ref: "grep -c 'CHK-0' 04-VALIDATION.md (10, >= 8); grep -c 'human-checks.js --mode=' (2); grep -c ddda2e4 (1)"
        status: pass
    human_judgment: true
    rationale: "A lista é o que o autor confere na tela; nenhum teste automático a substitui"

duration: 4min
completed: 2026-11-21
status: complete
story_points_realized: 3
---

# Phase 4 Plan 06: Verificações humanas e documentação Summary

**Ferramenta `scripts/human-checks.js` (CHK-01 hover com terminal elevado e CHK-02 AltGr+C, só escuta, recusa rodar com a ilha no ar, conferida por `--selftest`), README com menu, atalho e estado da tela cheia, e a lista "Testar manualmente" consolidada da fase, com TELA-01 registrado como pendente da escolha do autor.**

## Accomplishments

- `scripts/human-checks.js` recriado (a versão da pesquisa ficou na pasta temporária): `parseArgs`, `summarizeHover`, `summarizeHotkey` (veredito `tomado-por-outro-processo`, `disparou` ou `sem-disparos` por acelerador) e `islandIsRunning` (via `isHeartbeatFresh` do `state.js`). No Electron, recusa rodar com batimento recente ("Pare a ilha antes: o batimento está recente", saída 1), usa pasta de dados descartável (`mkdtempSync`) e grava `human-hover-out.json` ou `human-hotkey-out.json`. Nada de entrada sintética, nada de janela de outro app.
- README: frase do hover atualizada (hover ou clique, conforme o menu) e seção "Menu, atalho e tela cheia".
- `04-VALIDATION.md`: tabela "Manual-Only Verifications" reescrita com 14 linhas (CHK-01 a CHK-08, respiro da expandida, menu e reinício, âncoras, transparência, notch na base, modo cursor); o mapa por requisito aponta os arquivos de teste reais e marca TELA-01 e TELA-02 como parciais.
- `REQUIREMENTS.md`: TELA-02 de volta a parcial (caixa e tabela de rastreio), com nota.

## Tasks

| Task | Commit | O que entrou |
|------|--------|--------------|
| 1 (traçador) | `a442c79` | `scripts/human-checks.js` com `--selftest` |
| 2 | `4b8dada`, `f3549f7` | README; tabela manual do VALIDATION |

O gate do traçador (auto-modo desligado, `human_verify_mode` = `end-of-phase`, `<verify>` só automatizado): o `--selftest`, o uso no stderr sem argumentos e `node --test` (345 passam, 0 falham) foram reexecutados antes da Task 2 e passaram.

## Testar manualmente

Lista para o PR. As caixas são do autor; o executor não rodou nenhum item (só o `--selftest`).

**Antes de CHK-01 e CHK-02: pare a ilha** (encerre o `electron.exe` da pasta do repositório e espere cerca de 6 s). Com ela no ar a ferramenta recusa rodar, porque a ilha segura `Control+Alt+Shift+C` e ocupa o topo central. Uma sessão do Claude Code que comece no meio do teste pode subir a ilha de novo.

- [ ] **CHK-01, hover com terminal elevado** (ilha parada): `node_modules\electron\dist\electron.exe scripts\human-checks.js --mode=hover`. Rode com um terminal comum em foco e outra vez com o Gerenciador de Tarefas (elevado) em foco, passando o cursor sobre a pílula laranja do topo central, nos monitores a 100% e a 125%. Esperado: com o elevado o contador do DOM (`domMovesForward`) para e o do polling (`pollHitsAccumulated`) segue (`polling-viu-o-cursor`). Saída: `human-hover-out.json` em `%TEMP%` (ou em `--out=<pasta>`). Depois, com a ilha no ar e o Gerenciador de Tarefas em foco, passar o cursor sobre a pílula real: ela deve expandir e capturar o clique.
- [ ] **CHK-02, AltGr+C** (ilha parada): `node_modules\electron\dist\electron.exe scripts\human-checks.js --mode=hotkey`; digite AltGr+C e depois Ctrl+Alt+Shift+C. Se o JSON disser `tomado-por-outro-processo` em algum acelerador, a rodada não vale (a ilha ou outro programa segura o atalho). `disparou` em `Control+Alt+C` com AltGr confirma o conflito que fez o padrão ser Ctrl+Alt+Shift+C.
- [ ] **CHK-03, menu**: clique direito na pílula abre o menu perto do cursor, com Tema, Forma, Estilo e Velocidade da animação, Expandir, Fixar aberta, Transparência, Âncora, Ilhas e Esconder, e o valor atual marcado. Clicar fora fecha; o clique que fecha não aprova (com um pedido na tela, fechá-lo sobre Permitir ou Negar não decide, e os botões voltam desarmados e armam após 0,8 s); escolher um item não tira o foco do terminal. Se o menu nativo reprovar, o fallback é um menu em HTML no palco (D-08), fora desta fase.
- [ ] **CHK-04, 125%**: a pílula captura a 2 px para dentro da borda e só solta a 8 px para fora, sem piscar; arraste, duplo clique (volta ao topo central e a pílula recolhe em até 33 ms), Permitir e Negar, e âncora de baixo sem recusa. A ilha nasce em 520 x 412 depois do `setBounds`; a âncora de canto não deixa a pílula passar da borda. Arrastar a pílula para fora do próprio retângulo e soltar reavalia o hover sem a janela de trás receber o clique.
- [ ] **CHK-05, tela cheia: pendente do sensor (TELA-01, ver notas).** Hoje a ilha continua por cima do app em tela cheia, como antes da fase. Não há o que conferir até o autor escolher o sensor.
- [ ] **CHK-06, som com a ilha escondida**: esconder pelo atalho por cerca de 10 minutos, disparar um pedido de permissão e ouvir. A ilha não reaparece, o terminal segue valendo e, ao reexibir, Permitir e Negar recomeçam desarmados.
- [ ] **CHK-07, roda sobre a pílula** com o Gerenciador de Tarefas (elevado) em foco (insumo da Fase 5).
- [ ] **CHK-08, komorebi**: esconder e mostrar várias vezes pelo atalho sem o komorebi retilar a ilha.
- [ ] **Respiro da pílula expandida** (commit `ddda2e4`, pedido do autor depois de olhar a Fase 3): com hover em "Trabalhando", a linha de cima (ponto e título à esquerda; pontos, anel e "28%" à direita) não encosta nos cantos curvos, nos temas claro e escuro e na forma pílula. Respiro lateral de 24 px e teto de raio de 36 px (12 + 24, concêntrico com o bloco de pedido); a pílula recolhida não muda. Há uma captura antes e depois, renderizada sem janela, que vai no artefato de resumo do PR.
- [ ] **Cada item do menu muda a ilha e volta igual depois de reiniciar.** `preferences.json` com JSON inválido gera `preferences.json.<carimbo>.bad` ao lado, e a ilha sobe com os padrões.
- [ ] **As 6 âncoras**: a compacta encosta a 16 px da lateral e a 40 px da base, a sombra não é recortada e a ampliação do hover cresce a partir da borda ancorada; o Elástico a 2× não recorta; trocar a âncora zera a posição arrastada. Caso conhecido: na âncora de baixo, no Elástico a 0,5× e com um pedido chegando com o cursor em cima da pílula, o topo da sombra pode perder cerca de 6 px da borda fraca (a pílula nunca é recortada; 04-03).
- [ ] **Transparência** a 85, 70 e 55%: a ilha mistura com o fundo e o texto continua legível (se não, a troca para "só o preenchimento" é a ideia adiada de D-16); com um pedido na tela volta a 100% e, ao fim dele, à escolhida. Linux: `setOpacity` sem efeito (aceito, A6).
- [ ] **Notch com âncora de baixo**: o notch (topo reto) fica flutuando 40 px acima da base; aparência aceita ou não.
- [ ] **"Ilhas" no modo cursor**: troca de monitor sem pedido na tela e fica parada com pedido. Com dois monitores de DPI diferente a ilha mantém o tamanho físico (se a janela crescer cerca de 25%, recriar em vez de mover) e os botões rearmam. "Só no monitor principal" deixa uma ilha só e "Uma por monitor" volta ao padrão.
- [ ] **Esconder**: o atalho esconde e mostra todas as ilhas sem tirar o foco do terminal; com dois monitores esconde as duas; trocar de modo de ilha com a ilha escondida mantém a nova escondida. Atalho tomado por outro programa ou texto inválido no `preferences.json`: a ilha sobe, o menu avisa e "Esconder" fica desabilitado. O item "Esconder" do menu esconde e reiniciar a mostra.
- [ ] **Hover e clique**: fora da pílula, clicar e rolar sobre a janela de baixo, na área transparente da ilha, atravessa. Em "Ao clicar", um clique na pílula compacta a expande e o cursor saindo a recolhe; em "Fixar aberta", Trabalhando fica expandida e Concluído nunca. Permitir, Negar e Abrir seguem funcionando, e os botões não armam nem decidem por hover.

## Notas para o PR

- **TELA-01 está coberto só em parte.** Prontos: a regra pura (`nextFullscreen`, com tabela), o mapa por monitor, a visibilidade combinada e o fato `coveredByFullscreen` por monitor no gate. Falta o sensor: a ilha ainda não some quando um app ocupa a tela. Pendente da escolha do autor (D-20, autorização NÃO CONCEDIDA para o koffi) entre: (1) `koffi@3.3.8` com `allowBuilds: { koffi: false }`, +5,0 a 5,1 MB de private working set e 7,8 µs por sondagem, medidos; (2) sem dependência nova, um processo PowerShell filho único e persistente com P/Invoke em `user32`, no padrão do `window.js`, consultado por stdin, 28,3 MB numa amostra, CPU a 2 Hz não medida (um spawn por sondagem custaria cerca de 0,45 s e está descartado). O ponto de entrada está marcado com `ponytail:` no `main.js`. **TELA-02 também fica parcial**: vale sem o sensor só no ramo "ilha escondida pelo usuário"; o ramo "em tela cheia" espera a mesma decisão. (O 04-05 tinha marcado TELA-02 como completo no `REQUIREMENTS.md`; este plano o corrigiu.)
- **Afirmações que só têm trava de texto no `gate.test.js`** (sem teste de comportamento, porque exigem o Electron rodando): o timer do cursor só roda com ilha visível e fora de ociosa (`updateCursorTick`); a ilha escondida solta a captura no evento `'hide'`; abrir e fechar o menu rearmam (`menu-will-show`, `menu-will-close`); a janela é reposicionada por `setBounds` logo depois de criada; o atalho é registrado uma única vez e liberado em `will-quit`; a opacidade é aplicada antes de `sendState` no laço do `refresh`. Conferir na tela pelas linhas correspondentes da lista acima.
- **Achado aceito D-21**: o `--stage-top` de 8 px é menor que o alcance da sombra para cima, 9 px; o corte só aparece com a ilha arrastada para baixo (1 px na cauda em repouso e até 7 px durante o nudge de −6 px, alfa de cerca de 0,05 por 0,45 s). A correção de uma linha é `--stage-top: 15px`, **não aplicada** porque desce a pílula 7 px e mexe no respiro decidido na Fase 3, que é do autor.
- **Menu e arraste só existem com uma sessão na tela**: ociosa, a pílula fica invisível e sem `pointer-events`.
- **Exceção registrada**: `hoverStep` e `shouldExpand` ficam inline no `index.html` (CSP e preload em sandbox; precedentes `regras-do-gate` e mola), testadas por `node:vm` (04-02).
- **Respiro da pílula expandida** (`ddda2e4`, pedido do autor): padding lateral de 24 px e teto de raio de 36 px na expandida; a recolhida não muda. Captura antes e depois no artefato de resumo do PR (não está no repositório).
- **Limite da sombra na âncora de baixo** (04-03): Elástico a 0,5× com pedido chegando e cursor em cima pode perder cerca de 6 px da borda fraca da sombra de cima. Aumentar o palco mexeria em `WINDOW_SIZE`, congelado.
- O GitHub `Koromix/koffi` é só fachada, sem tags; o código está no Codeberg (`Koromix/rygel`), registrado para quando o autor decidir o sensor.
- A ferramenta `scripts/human-checks.js` não termina em `.test.js`, então o `node --test` não a executa; o selftest roda direto.
- macOS e Linux seguem sem teste.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Registro de base do plano fora do git-dir**
- **Found during:** início da Task 1
- **Issue:** o ledger `gsd-plan-head-before-04-06` ficaria em `.git/worktrees/...`, dentro do checkout do autor, proibido pelas regras desta execução (mesmo caminho dos planos 04-01 a 04-05).
- **Fix:** a base foi registrada no frontmatter (`plan_head_before: 478686e...`) e `commits:` medido com `git rev-list --count 478686e..HEAD` (= 3, antes do commit de fechamento).
- **Files modified:** nenhum
- **Commit:** n/a

**2. [Rule 1 - Bug de registro] TELA-02 marcado como completo no REQUIREMENTS.md**
- **Found during:** leitura do 04-05-SUMMARY e do `REQUIREMENTS.md`
- **Issue:** o 04-05 marcou TELA-02 como concluído, mas o ramo "em tela cheia" depende do sensor pendente.
- **Fix:** caixa e tabela de rastreio voltam a parcial, com nota (pedido do orquestrador).
- **Files modified:** `.planning/REQUIREMENTS.md`
- **Commit:** o commit de fechamento deste plano

**3. [Escopo] Itens extras na lista do PR**
- Além do que o plano listava, a lista e as notas incluem o respiro da expandida (`ddda2e4`), o limite de 6 px da sombra do 04-03 e os itens "Testar manualmente" dos SUMMARYs 04-01 a 04-05 (pedido do orquestrador).

**Total deviations:** 3 (1 de processo, 1 de registro, 1 de escopo da lista). **Impact:** nenhum no código da ilha; `main.js`, `state.js`, `index.html`, `preload.js`, hooks e testes não mudaram.

## Issues Encountered

None.

## Known Stubs

Nenhum novo. O `fullscreenByDisplay` vazio do `main.js` (sem sensor) é o do 04-05 e está nas notas do PR.

## Threat Flags

None. T-04-24: a ferramenta só escuta (contador de DOM, polling do cursor, `globalShortcut`), usa pasta descartável, recusa rodar com a ilha no ar e nenhum módulo da ilha a carrega (`grep -rl "human-checks"` fora de `scripts/` imprime 0); só o `--selftest` foi rodado. T-04-25: TELA-01 e TELA-02 parciais nas notas do PR, no `REQUIREMENTS.md` e no VALIDATION, e a lista manual está neste arquivo e na tabela do VALIDATION.

## Next Phase Readiness

Fase 4 pronta para verificação (`/gsd-verify-work 4`) e PR. Pendências humanas: a lista "Testar manualmente" e a escolha do sensor de tela cheia (D-20), que fecha TELA-01 e o ramo de tela cheia de TELA-02.

## Self-Check: PASSED

- `scripts/human-checks.js`, `README.md`, `04-VALIDATION.md` existem; commits `a442c79`, `4b8dada` e `f3549f7` são ancestrais de HEAD.
- `node scripts/human-checks.js --selftest`: `selftest ok`. `node --test`: 345 passam, 0 falham.
- Critérios: `tomado-por-outro-processo` (4), `isHeartbeatFresh` (2), `mkdtempSync` (1), módulos da ilha que carregam a ferramenta (0), `Shift+C` e `pointer-events` no README (1 e 1), `CHK-0` no VALIDATION (10), `human-checks.js --mode=` (2), `ddda2e4` (1).
