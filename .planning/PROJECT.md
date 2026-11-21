# Claude Island

## What This Is

Uma "Dynamic Island" de desktop para o Claude Code: uma pílula no topo de cada monitor que mostra,
sem precisar olhar o terminal, quando uma sessão está trabalhando, quando precisa de resposta e
quando terminou, e que deixa responder a um pedido de permissão direto na ilha. É um projeto pessoal
do autor (Marcelo), publicado como código aberto (MIT) em `marcelo-mo/claude-island`.

## Core Value

Saber de relance o que cada sessão do Claude Code está fazendo e responder ao que ela pede sem
trocar de janela — sem nunca aprovar algo que o usuário não viu.

## Requirements

### Validated

<!-- Entregue até a v1.0.1 (2026-11-20). -->

- ✓ Estados da sessão a partir dos hooks do Claude Code: trabalhando, precisa de você, concluído (10 s), ocioso — v0.1.0
- ✓ Aviso sonoro ao precisar de resposta e ao concluir, com notas diferentes — v0.2.0
- ✓ Tema claro/escuro acompanhando o sistema — v0.2.0
- ✓ Botão para trazer o terminal da sessão para frente (Windows, macOS, Linux com xdotool) — v0.2.0
- ✓ Uma ilha por monitor, arrastável, com posição salva por monitor e duplo clique para recentralizar — v0.3.0
- ✓ Botão "Abrir" no estado concluído, sem expandir no hover — v0.4.0
- ✓ Contorno pulsando na cor do estado e reticências animadas em "Trabalhando" — v0.5.0
- ✓ Ícones de estado (check e exclamação), anel com o percentual de contexto lido do statusline do GSD — v0.6.0
- ✓ Resposta de permissão pela ilha (hook `PermissionRequest`), só para aquela chamada, com proteções (texto legível ≤600 caracteres e ≤20 linhas, sem caracteres invisíveis, Bash só com campos exibidos, atraso de 0,8 s, rolar até o fim) — v1.0.0
- ✓ Início automático pelo hook `SessionStart` quando o batimento da ilha está parado — v1.0.0
- ✓ Instalador de hooks que preserva hooks alheios e mantém backup — v1.0.1

### Active

<!-- Milestone atual: reformular a ilha com o comportamento e o visual do mod "Dynamic Island for Windows". -->

- [ ] Decidir a base tecnológica (Electron atual vs. Tauri) por medição de memória e CPU com a interface atual, antes de reescrever comportamento
- [ ] Animação por molas assimétricas (crescer com leve overshoot, encolher sem balanço), interrompível sem perder velocidade, com 4 estilos e controle de velocidade
- [ ] "Nudge" curto quando a sessão muda de estado e leve ampliação no hover
- [ ] Hover pela posição do cursor (expandir no hover ou no clique), mantendo as proteções dos botões de permissão
- [ ] 8 temas (Obsidian, Graphite, Slate, Nord, Evergreen, Espresso, Plum, Porcelain) além do automático claro/escuro
- [ ] Formas pílula, notch e Windows 11
- [ ] Material: reflexo de acento no topo tingido pela cor do estado do Claude, profundidade e sombra
- [ ] Menu de clique direito (tema, forma, estilo de animação, fixar aberta, transparência, esconder) com preferências persistidas
- [ ] Atalho global para esconder/mostrar (Ctrl+Alt+C)
- [ ] Esconder quando um app ocupa o monitor em tela cheia (Windows)
- [ ] Âncora e deslocamento de posição configuráveis
- [ ] Scroll para trocar entre as sessões abertas, no lugar do contador; volta sozinho para a sessão que pedir permissão
- [ ] Atribuição MIT ao autor do mod (THIRD_PARTY_NOTICES.md)
- [ ] Convivência com a ilha do sistema: encaixar como segunda bolha ao lado da ilha do Windhawk quando ela estiver presente
- [ ] Avaliar outros caminhos de integração com ilhas do sistema (toast do Windows, proposta de API ao autor do mod, apps de notch no macOS)

### Out of Scope

- Módulos de sistema do mod (mídia, letras, clima, monitor de hardware, game overlay, notificações, calendário, área de transferência, bandeja de arquivos, pomodoro, câmera/microfone, Bluetooth, volume, brilho) — a ilha só existe enquanto o Claude roda; não é uma ilha de sistema
- Reescrever em C# ou C++ — perde macOS e Linux, que motivaram o uso de Node
- Virar módulo dentro do mod do Windhawk (fork em C++) — só Windows, dependente do Windhawk, e a aprovação de permissões passaria a rodar em código de terceiros
- "Permitir sempre" pela ilha — aprovação vale só para a chamada exibida; regras permanentes ficam no terminal
- Engenharia reversa (REA/Ghidra) — o mod é código aberto; ler a fonte é mais preciso

## Context

- **Código atual:** Electron 45 + Node, sem framework de UI. Hooks do Claude Code (`hook.js`, `permission-hook.js`) escrevem JSON em `~/.claude/island/`; o processo principal (`main.js`) faz polling a cada 400 ms e envia o estado às janelas (uma por monitor). Lógica pura em `state.js`, testada com `node:test` (`island.test.js`). Mapa detalhado em `.planning/codebase/`.
- **Consumo medido (2026-11-21):** 426 MB de memória e ~1,5% de CPU com a ilha parada e 2 monitores — caro para uma pílula; é o motivo do experimento de tecnologia.
- **Referência de comportamento:** mod do Windhawk "Dynamic Island for Windows" v1.4.0 (MIT, autor Himanshu / github devcode90), fonte em `C:\ProgramData\Windhawk\ModsSource\dynamic-island-for-windows.wh.cpp` (~24 mil linhas de C++/Direct2D). Análise com constantes de mola, temas, camadas do material e inventário de módulos em `.planning/research/WINDHAWK-MOD.md`.
- **Convivência:** o usuário roda esse mod também. As duas ilhas ocupam o topo central e se sobrepõem; o mod não aceita conteúdo de outros programas (sem pipe, arquivo ou API) e reafirma o topmost a cada 1 s.
- **Ambiente do autor:** Windows 11, dois monitores (2560×1080 a 100% e 1920 a 125%), PowerShell como shell principal, Windows Terminal. macOS e Linux têm código mas nunca foram testados.
- **Percentual de contexto** vem do arquivo `claude-ctx-<sessão>.json` que o statusline do GSD grava na pasta temporária; sem o GSD o anel não aparece.

## Constraints

- **Plataformas:** Windows, macOS e Linux — motivo de usar Node; recurso só de Windows é aceitável como opcional, nunca como base
- **Segurança:** a aprovação de permissões é fronteira de confiança — nenhuma mudança de interação (hover, scroll, troca de sessão) pode permitir aprovar um pedido que o usuário não estava vendo
- **Robustez dos hooks:** hooks nunca podem quebrar nem atrasar a sessão do Claude Code (falha silenciosa, saída 0)
- **Dependências:** menor diff correto; sem dependência nova sem necessidade; gerenciador pnpm
- **Testes:** `node:test`, lógica pura em `state.js`
- **Processo:** commits semânticos em pt-br, sem `Co-Authored-By`; branch protegida (`main`) — tudo por PR, merge pelo admin com bypass; release com descrição do que foi entregue
- **Licença:** MIT; portar valores ou lógica do mod exige manter o aviso de copyright do autor

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Electron + Node em vez de PowerShell/WPF | Rodar em Windows, macOS e Linux | ⚠️ Revisit — 426 MB; experimento Electron vs. Tauri |
| Arquivos JSON em `~/.claude/island/` como barramento | Sem servidor, sem rede; hooks curtos e à prova de falha | ✓ Good |
| Resposta de permissão por hook `PermissionRequest`, com o terminal valendo em paralelo | Experimento mostrou que quem responde primeiro decide e o terminal nunca trava | ✓ Good |
| Portar comportamento e visual do mod, não os módulos | A ilha só existe enquanto o Claude roda; módulos exigem código nativo e quebram multiplataforma | — Pending |
| Scroll entre sessões no lugar do contador, voltando à sessão que pede permissão | Mostrar uma sessão por vez sem esconder pedidos pendentes | — Pending |
| Integração com a ilha do sistema por encaixe lateral, não por fork | Única forma sob nosso controle; o mod não aceita conteúdo externo | — Pending |
| `.planning/` versionado no repositório público | Processo aberto junto com o código | ✓ Good |
| Cores de estado fixas, nunca substituídas pelas do mod (2026-11-21, pedido do autor). Laranja de trabalhando e do botão, herdado do quaint-money: escuro `oklch(0.705 0.213 47.604)`, claro `oklch(0.646 0.222 41.116)`. Verde de concluído: `#30d158` / `#248a3d`. Âmbar de precisa de você: `#ff9f0a` / `#f08c00` | Identidade da ilha. Vale para a cor de destaque dos estados, o brilho tingido e o botão; os 8 temas do mod podem mudar só o fundo e a superfície da pílula, nunca a cor do estado. A Fase 3 herda | ✓ Locked |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-11-21 after initialization*
