# Architecture Research

**Domain:** Overlay desktop (Electron hoje, Tauri possível) que projeta o estado de sessões do Claude Code e relaya uma decisão de permissão
**Researched:** 2026-11-21
**Confidence:** MEDIUM-HIGH (arquitetura interna: HIGH, porque vem do código lido; APIs de Electron/Tauri: MEDIUM, ver "Itens a verificar")

> Este documento descreve **o delta** sobre `.planning/codebase/ARCHITECTURE.md`. Não repete o mapa existente.
> Fonte da verdade lida: `main.js`, `state.js`, `index.html`, `.planning/codebase/*`, `.planning/research/WINDHAWK-MOD.md`.

## Resumo das decisões (respostas diretas)

| # | Pergunta | Decisão |
|---|----------|---------|
| 1a | Onde mora a "sessão selecionada"? | **Em `main`, global (todas as ilhas espelham a mesma seleção).** Um único `shownPermissionId`/`shownPermissionSince`, como hoje. Seleção por monitor fica registrada como extensão futura, não como v1. |
| 1b | Como o decide continua amarrado ao que o usuário VÊ? | `main` segue sendo o único dono do alvo. Acrescenta-se um **eco do id exibido** em `island:decide(behavior, displayedId)`: o `main` só **descarta** se divergir do `shownPermissionId`; nunca usa o eco como alvo. Mais "primeiro clique vence" por id. |
| 1c | Fluxo do scroll | Renderer encaminha `deltaY` bruto (só quando o cursor está sobre a pílula e fora do texto da permissão) → `main` acumula (`wheelStep`, puro) → `nextSelection` (puro) → `refresh()` → broadcast a todas as janelas. |
| 1d | Preferências | `preferences.json` em `userData`, **escrita só pelo `main`** (o menu nativo é do `main`; o renderer não tem canal de escrita), validada por `sanitizePreferences` (puro, `state.js`), broadcast por `island:prefs`. |
| 1e | Hover por cursor | `main` faz polling de `screen.getCursorScreenPoint()` e **envia o cursor em coordenadas locais** a cada renderer; o **renderer** faz o hit-test contra o retângulo vivo da pílula e responde com `island:capture(bool)` (substitui `island:hover`). Arraste, botões e armamento de 0,8 s não dependem do hover. |
| 2 | Palco fixo ou janela redimensionada? | **Palco fixo.** A `BrowserWindow` nunca muda de tamanho durante animação; a pílula anima dentro dela (já é assim hoje, com 440×324). O palco só cresce uma vez, para caber overshoot, escala de hover, nudge e sombra. |
| 3 | O que fica puro? | Tudo que decide: mola, ordenação/seleção, wheel, gate de decisão, preferências, visibilidade, cobertura de monitor, posição de âncora/dock. `main.js` só faz I/O e cola. |
| 4 | Se Tauri vencer | O **barramento de arquivos é a costura**: hooks, `install.js`, `window.js` e `state.js`-dos-hooks seguem Node. Renderer segue web (atrás de um shim `window.island`). `main.js` vira Rust, e **o gate de permissão tem de ir para Rust** (não para o webview). |
| 5 | Ordem de build | Spike de medição → núcleo portável (lógica pura + mola + palco + temas) → decisão → features dependentes de runtime (hover por cursor, prefs/menu, atalho, scroll, fullscreen, dock). Detalhe na seção "Ordem de build sugerida". |

## Standard Architecture

### System Overview (alvo)

```
 Claude Code ─► hook.js / permission-hook.js  (Node, INALTERADOS)
                      │ JSON atômico
                      ▼
          ~/.claude/island/<id>.json  .heartbeat  decisions/<uuid>.json
                      │ poll 400 ms (readSessions: + id, + firstSeenAt, + contextPercent)
 ┌────────────────────▼───────────────────────────────── main.js (confiável) ─────────────┐
 │  refresh({reason})  ◄── ÚNICO funil: poll | wheel | prefs | display | visibilidade     │
 │    ├─ aliveSessions → nextSelection → pickState(…, selection)        [state.js, puro]   │
 │    ├─ gate: shownPermissionId / shownPermissionSince (muda só aqui)                     │
 │    └─ broadcast island:state  ──────────────────────────────┐                           │
 │  cursorTick 30 Hz (só se visível)  ─ island:cursor ─────────┤   entradas só do main:   │
 │  prefs: load/save/broadcast  ─────── island:prefs ──────────┤   globalShortcut,        │
 │  menu nativo (Menu.popup)            wheelStep (puro)        │   display-*, platform-   │
 │  platform-probe (fullscreen, rect de janela alheia) ─ 2 Hz   │   probe, preferences.json│
 └──────▲───────────────────────────────────────────────────────┼─────────────────────────┘
        │ capture(bool) · wheel(deltaY) · decide(b, echoId)     │ N janelas (1 por display, palco fixo)
        │ context-menu · drag · focus · reset                   ▼
 ┌──────┴──────────────── renderer (index.html + spring.js, sem Node) ───────────────────┐
 │  spring.js (puro, UMD)  ─ rAF só enquanto não assentou (CPU ≈ 0 parado)               │
 │  hit-test da pílula (cursor local vs getBoundingClientRect) · nudge · temas/forma CSS  │
 │  trava dos botões (armado + lido + não respondido) · texto/ID trocados atomicamente    │
 └────────────────────────────────────────────────────────────────────────────────────────┘
```

### Component Boundaries

| Componente | Responsabilidade | Fala com | Muda neste milestone |
|------------|------------------|----------|----------------------|
| `hook.js`, `permission-hook.js`, `install.js` | Produzir estado e retransmitir decisão | Só o barramento de arquivos | **Não** (nenhuma feature pede mudança de contrato) |
| `state.js` (puro) | Toda decisão: seleção, wheel, gate, prefs, visibilidade, geometria | Importado por `main.js`, hooks, testes | **Cresce** (ver Q3) |
| `spring.js` (novo, puro, UMD) | Passo de mola, estilos, nudge, `pointInRect` | Carregado pelo renderer e pelos testes | Novo |
| `preferences.js` (novo, I/O) | Ler/gravar `preferences.json` (temp+rename, debounce) | `main.js`, `state.js` | Novo |
| `platform-probe.js` (novo, I/O, Windows) | Sensor nativo: janela em foco + monitor; rect de janela por classe | `main.js` | Novo, **depende do spike** |
| `main.js` | Funil `refresh()`, IPC, janelas, cursorTick, atalho, menu, persistência | Tudo acima | Cresce; cuidado para não virar monólito |
| `preload.js` | `window.island` fino; **sem `require` local** (preload em sandbox só enxerga `electron`) | Renderer ↔ main | Novos canais |
| `index.html` + `renderer.js`/`island.css` | Apresentação, mola, hit-test, temas | `window.island`, `spring.js` | Reescrita parcial |
| `window.js` | Focar terminal | `main.js` | Não |

### Recommended Project Structure

O repositório é plano de propósito (`STRUCTURE.md`). Manter assim; só arquivos novos na raiz:

```
claude-island/
├── state.js            # + aliveSessions, nextSelection, wheelStep, acceptDecision,
│                       #   sanitizePreferences, islandVisibility, isCoveringMonitor, anchorPosition, dockPosition
├── spring.js           # NOVO puro, UMD (module.exports no Node, window.IslandSpring no renderer)
├── preferences.js      # NOVO I/O pequeno
├── platform-probe.js   # NOVO I/O nativo (só depois do spike)
├── island.css          # extraído de index.html (opcional, ver "Itens a verificar" sobre CSP)
├── renderer.js         # extraído do <script> inline (idem)
└── island.test.js      # + spring.test.js se island.test.js passar de ~500 linhas
```

**Por que `spring.js` separado de `state.js`:** o renderer **não consegue** `require('./state')` (contextIsolation + sandbox; o preload em sandbox só tem `require` de módulos do Electron). O código de mola precisa ser testável por `node:test` **e** carregável pelo renderer. Um arquivo UMD sem dependências resolve os dois e é reaproveitado sem mudança num webview Tauri.

## Q1. Fronteiras e fluxo de dados

### 1.1 Seleção: global, em `main`

**Decisão:** `selection = { sessionId: string | null, snappedPermissionId: string | null }` mora em `main`, é **uma só** para todas as janelas. `null` = automático (a ordem de urgência atual do `pickState`).

**Por que global e não por janela:**

1. A invariante de segurança fica trivial: "o pedido que o usuário vê em **qualquer** ilha é o `shownPermissionId`". Seleção por janela exigiria `Map<window, {id, since}>`, armamento por janela e acumulador de wheel por janela, ou seja, três lugares onde um desvio vira "aprovei o que não vi".
2. Já é o desenho atual: `lastPickedState`, `shownPermissionId`, `shownWindowPid` e o dono do aviso sonoro são globais. As ilhas são espelhos.
3. Menor diff. O custo real é só funcional: não dá para mostrar sessões diferentes em monitores diferentes.

**Risco residual do espelho e por que é coberto:** rolar no monitor A troca o que o monitor B mostra. Se o usuário estava com o mouse sobre "Permitir" em B (impossível ao mesmo tempo que rolar em A com um mouse, mas possível por toque ou por troca automática de snap-back), o `shownPermissionId` muda → o armamento reinicia → o clique em voo é descartado no `main`, e o eco de id também o descartaria.

**Extensão futura (não construir agora):** se o usuário pedir sessões independentes por monitor, a unidade passa a ser `Map<BrowserWindow, {selection, shownPermissionId, shownPermissionSince}>`. `island:decide` e `island:focus` já resolvem a janela por `islandOf(event)`, então a mudança é mecânica. O aviso sonoro continua só na primeira ilha.

**Ordem de rolagem tem de ser estável.** Não usar a ordem de urgência/recência do `pickState`: ela embaralha quando uma sessão muda de estado, e o usuário perderia a posição no meio do gesto. Usar `firstSeenAt` (ordem de primeira aparição), com `id` como desempate. `readSessions` já anexa `contextPercent` a cada sessão (precedente); passa a anexar também `id` (basename do arquivo) e `firstSeenAt` (um `Map` em memória no `main`). **Sem mudança no hook nem no contrato de disco.** Sem dar a volta nas pontas (igual ao mod).

### 1.2 Máquina de seleção (pura)

```
nextSelection(prev, alive, event) → selection
  event = { type: 'poll' } | { type: 'scroll', step: -1 | +1 }

poll:
  - prev.sessionId sumiu de `alive` (SessionEnd, expirou, morreu)  → sessionId = null (auto)
  - existe sessão com permissão válida cujo id ≠ prev.snappedPermissionId
        → sessionId = essa sessão; snappedPermissionId = id do pedido   (snap-back por BORDA)
  - senão mantém prev
scroll:
  - parte da sessão EXIBIDA (a manual, ou a que o modo auto escolheria agora)
  - anda `step` na ordem estável, sem dar a volta; sessionId = vizinha
```

**Snap-back por borda, não por nível.** Se fosse por nível (sempre volta enquanto houver permissão pendente), o usuário nunca conseguiria rolar para outra sessão com um pedido aberto. Por borda: um pedido **novo** puxa a seleção; depois o usuário pode sair. Consequência de UX obrigatória: o indicador que substitui o contador precisa mostrar "há pedido pendente em outra sessão" (`waitingElsewhere: boolean` no payload). Sem isso, rolar para longe esconde um pedido sem aviso.

**Payload de `island:state`** (compatível com o atual; campos novos): `{ …picked, sessionId, index, count, waitingElsewhere, armMs }`. `armMs` leva `PERMISSION_ARM_MS` ao renderer e elimina a constante duplicada (item de `CONCERNS.md`).

### 1.3 Fluxo do scroll (renderer → main → todas as janelas)

```
wheel (renderer, só chega com capture ligado)
  └─ ignora se event.target está dentro de #permission       ← regra de segurança, ver abaixo
  └─ island.wheel(deltaY)                  [IPC, só o delta, validado com Number.isFinite]
main: island:wheel
  ├─ confere que o sender é uma ilha conhecida
  ├─ {acc, step} = wheelStep(acc, deltaY, now)               [puro, constantes do mod: 120 / 220 ms / 85 ms]
  ├─ step ≠ 0 → selection = nextSelection(selection, alive, {type:'scroll', step})
  └─ refresh({reason:'wheel'}) ─► pickState ─► gate ─► sendState a TODAS as janelas
```

Regras:

- **Rolar dentro do texto da permissão nunca troca de sessão.** Esse texto rola para o usuário ler até o fim (é o que libera "Permitir"). Se o scroll encadeado no fim do texto trocasse de sessão, o usuário perderia o pedido que estava lendo. Só vale scroll sobre a barra/cabeçalho.
- `refresh()` é o **único** caminho que atualiza `shownPermissionId`. Poll, wheel, prefs e display passam por ele. Qualquer mudança de id reinicia `shownPermissionSince`, **seja qual for a causa**, inclusive rolagem.
- Troca de sessão **substitui texto e id de forma atômica** no renderer. Nada de crossfade com duas camadas DOM: a camada antiga seria um alvo de clique já descartado pelo `main`. Anima-se só o contêiner (deslocamento + fade), com os botões desabilitados até o novo id ser armado.
- Inércia de touchpad: `wheelStep` ignora passos a menos de 85 ms (200 ms em touchpad) do anterior; o gesto novo exige pausa de 220 ms ou inversão de direção.

### 1.4 Preferências

| Etapa | Onde | Detalhe |
|-------|------|---------|
| Esquema + defaults | `state.js` | `PREFERENCE_SCHEMA`: `theme` (enum de 8 + `auto`), `shape` (`pill`/`notch`/`win11`), `animationStyle` (4), `animationSpeed` (0,5 a 2), `expandOn` (`hover`/`click`), `pinExpanded`, `opacity` (100/85/70/55), `anchor` (6) |
| Validação | `state.js` | `sanitizePreferences(raw)` devolve **sempre** um objeto completo e válido: chave desconhecida some, valor inválido vira o default. `applyPreferenceChange(prefs, key, value)` rejeita chave/valor fora do esquema |
| Persistência | `preferences.js` | `userData/preferences.json`, gravação debounced com temp+rename (mesmo padrão de `writeDecision`). **Arquivo separado de `positions.json`**: as posições são chaveadas por `display.id` e têm risco de migração próprio (`CONCERNS.md`) |
| Origem da mudança | `main.js` | Só o menu nativo (`Menu.buildFromTemplate` com valores vindos de constantes). **Não existe `island:set-pref`**: o renderer não escreve preferência, então não há superfície de entrada não confiável |
| Broadcast | `main.js` | `island:prefs` a todas as janelas, no `did-finish-load` e a cada mudança |
| Consumo | renderer | `data-theme`, `data-shape`, `data-anchor` no `#pill`; CSS por tokens (`[data-theme="nord"] { --surface: … }`) |
| Efeitos no main | `main.js` | âncora → reposiciona janelas; atalho → (re)registra; `hidden` **não é preferência** |

**Não persistir `hidden`.** É estado de execução: reiniciar o app escondido e esquecer disso é pior do que reaparecer.

**Posição:** `posição = anchorPosition(anchor, workArea, stage) + offsetPorDisplay`. O deslocamento é o que o **arraste já produz** (`positions.json`, relativo à âncora). Não criar um segundo deslocamento numérico global nas preferências: duas fontes de offset se contradizem. "Âncora e deslocamento configuráveis" = menu de âncora + arrastar + "Redefinir posição".

**Transparência não vale com pedido na tela.** `effectiveOpacity(prefs, hasPermission)` (puro) força 100% enquanto houver permissão. Fundo translúcido sobre a janela de trás prejudica a leitura do comando que o usuário vai aprovar.

### 1.5 Hover por posição do cursor

**Quem faz o quê:**

```
main  cursorTick (33 ms, ligado só se a ilha não está idle ou há pin)
  └─ p = screen.getCursorScreenPoint()           # já em DIP; mesma unidade de getBounds() e do CSS px
  └─ para cada janela: local = p − bounds.origin
        dentro de bounds (± margem)  → island:cursor {x, y}   (só se mudou)
        saiu                          → island:cursor null     (uma vez)
  └─ durante arraste: não envia; o main afirma hover=true (como hoje, "dragStartPositions.has")
renderer
  └─ hover = pointInRect(cursorLocal, pill.getBoundingClientRect(), margem)   # rect VIVO, com transform
  └─ capture = hover || dragging;  se mudou → island.capture(capture)
main: island:capture → island.setIgnoreMouseEvents(!capture)    # SEM { forward: true }
```

**Por que o hit-test fica no renderer e o cursor no main:** o renderer é o único que conhece a geometria animada (mola, escala, nudge). Reportar o retângulo ao `main` por IPC a cada quadro seria ruído. O `main` entrega só a verdade que o renderer não tem (a posição global do cursor, confiável mesmo com a janela click-through).

**Por que isso substitui o `mouseenter` e o `forward`:**

- `forward` só existe em macOS e Windows, e no Windows **para de funcionar quando uma janela elevada (Gerenciador de Tarefas, instalador) assume o foco** (UIPI) — documentado pelo Electron. Polling de cursor não sofre disso.
- Remove o gate `CAN_CLICK_THROUGH` em Linux/X11 (sem `forward`, `setIgnoreMouseEvents(true)` simples funciona; `getCursorScreenPoint` **não** funciona em Wayland, então lá o hover segue indisponível).
- É o mesmo desenho que o Tauri exige (ver Q4: não há `forward` lá), então a decisão é neutra ao resultado do spike.

**O que não pode quebrar, e como se garante:**

| Item | Garantia |
|------|----------|
| Arraste | `pointerdown/move` com `setPointerCapture` continuam DOM (precisam de eventos reais, `capture` está ligado). O `main` já sabe que há arraste (`dragStartPositions`) e mantém `capture=true` e ignora `island:capture(false)` até `drag-end`. Idêntico à regra atual |
| Botões | Precisam de eventos reais: só funcionam com `capture` ligado. O hit-test usa o retângulo da pílula **inflado em ~6 px** (histerese) para o `setIgnoreMouseEvents` não oscilar na borda, nem com arredondamento ±1 px de DPI fracionário |
| Armamento de 0,8 s | **Independente de hover.** É função de `(shownPermissionId, shownPermissionSince)` no `main`. Hover, escala, nudge e expansão não tocam nisso. A pílula crescendo sob o cursor liga o `capture` em ≤ 1 tick (33 ms); o clique que já estava a caminho de outra janela cai dentro dos 0,8 s e é descartado |
| Perda do evento | O renderer trava (hung): `capture` fica no último valor; o padrão seguro é `ignore=true` na criação. Pior caso: não clica; o terminal decide em paralelo |
| Custo | `getCursorScreenPoint` é uma chamada Win32 trivial. Ligado só enquanto há algo para ter hover; em `idle` o timer de 400 ms já é o único acordar. Medir no spike antes de adaptar a taxa |

`expandOn: 'click'` é só lógica de renderer: o clique em área não interativa alterna `expandedByClick`; sair do retângulo (via `island:cursor`) recolhe.

## Q2. Arquitetura de animação

### Palco fixo, janela nunca redimensiona

**Recomendação firme:** palco fixo. A pílula anima dentro de uma `BrowserWindow` de tamanho constante.

| Critério | Palco fixo (recomendado) | Redimensionar a `BrowserWindow` |
|----------|--------------------------|---------------------------------|
| Sincronia | Mola e pixels no mesmo processo, no mesmo `requestAnimationFrame` | `setBounds` por IPC a cada quadro: latência main↔renderer = tearing visível |
| DPI fracionário | Zero `setBounds` durante animação. O bug já conhecido do projeto (janela transparente muda de tamanho a cada `setPosition` com escala fracionária) só pode acontecer em criação, drag, âncora e mudança de display | Dispara o bug a 60 Hz no monitor a 125% |
| Janela transparente | Sem redimensionar não há flicker de superfície | Flicker conhecido em janelas transparentes no Windows |
| Hit-test | Toggle de `capture` guiado pelo cursor (Q1.5); sem região por pixel | Janela já coincide com a pílula, mas só em repouso |
| Custo | Palco maior = mais área transparente; irrelevante, porque ela é click-through | Baixo |

Mesma escolha do mod (palco 880×320 fixo, `HTTRANSPARENT` fora da pílula) — leitura de código em `WINDHAWK-MOD.md`, não medido.

**O projeto já é palco fixo** (440×324 com a pílula centrada e CSS transitions). Então a mudança é: (a) trocar CSS `transition` de `width/height` por mola em JS, (b) ampliar o palco **uma vez**.

**Dimensionamento do palco** (função pura, `stageSize(maxPill, maxOvershoot, shadowPad)`). Ordem de grandeza **derivada, não medida**: pílula máxima 400 de largura; overshoot do estilo Bouncy ≈ 21% do delta de crescimento (≈ 48 px em largura, ≈ 24 px por lado); escala de hover 1,025; sombra ≈ 14 a 18 px de espalhamento. Resulta em algo como **520 × 410**; validar visualmente com o estilo Bouncy e permissão máxima. O `horizontalSlack` do `clampIslandPosition` passa a ser `(stage.width − maxPill.width) / 2`.

### Mola no renderer

- `spring.js` expõe `springStep(state, target, params, dt) → state` com `state = {x, v}`. Interrompível por construção: retarget troca só o alvo e preserva `v`.
- **Direção por eixo:** crescendo (`target > x`): k=380, c=26 (ζ≈0,67, overshoot ≈ 6%). Encolhendo: k=200, c=28 (ζ≈1,0, sem overshoot). Neutro: k=280, c=24 (nudge). Estilos multiplicam k e c (Smooth ×1/×1,35; Bouncy ×1,1/×0,7; Snappy ×1,5/×1,25); velocidade multiplica o `dt`. **Constantes portadas do mod: manter `THIRD_PARTY_NOTICES.md` e o comentário MIT nesses trechos.**
- Integração semi-implícita de Euler em subpassos fixos (0,5 ms, igual ao mod; `dt` do quadro limitado a 50 ms).
- O laço `rAF` roda **só enquanto algum eixo não assentou** (`|x−alvo|` e `|v|` abaixo do limiar). Parado = CPU zero. O mod acorda a cada 16 ms enquanto visível; aqui não é necessário e conflita com o objetivo de reduzir consumo.
- **Conteúdo na largura final, pílula só recorta.** `#pill` anima `width`/`height`/`border-radius` com `overflow: hidden`; o conteúdo interno fica fixo no tamanho-alvo. Sem reflow do texto a cada quadro. O alvo de altura com permissão é medido (`offsetHeight` do contêiner na largura-alvo) antes de iniciar o movimento. Isso substitui o truque `interpolate-size: allow-keywords`.
- **Nudge:** `shouldNudge(prev, next, lastNudgeAt, now)`: no máximo 1× a cada 0,45 s, em mudança de `state` ou de sessão. Salto de −6 px por mola neutra.
- `prefers-reduced-motion`: pular a mola, atribuir o alvo direto (comportamento atual preservado).
- Material (reflexo de acento, profundidade, contorno) é CSS em camadas (`::before`/`::after`, `radial-gradient` ancorado no topo); `--accent` muda com a cor do estado. Animar a transição do acento exige `@property --accent { syntax: '<color>' }` (verificar o suporte do motor).

### Multi-monitor e DPI

- Mola e layout em **px CSS (DIP)**: independentes de DPI. Cada janela tem seu próprio `devicePixelRatio`.
- `getCursorScreenPoint()` e `getBounds()` são ambos DIP no Windows. `local = cursor − bounds.origin` fica em px CSS sem conversão manual (com zoom de página = 1).
- Cada ilha é presa ao seu display (`clampIslandPosition` na `workArea`); não cruza monitor, então a conversão entre escalas não entra no caminho.
- **A verificar no monitor a 125%:** o arredondamento de `getBounds()` em escala fracionária (±1 px). A histerese de ~6 px do hit-test absorve; o importante é que `moveIsland` continue chamando `setBounds` com o tamanho explícito.

## Q3. O que fica puro (testável) e o que é I/O

### `state.js` (puro, `node:test`)

| Função | Entra / sai | Teste mínimo |
|--------|-------------|--------------|
| `aliveSessions(sessions, now)` | extraído do `pickState` | idade por estado (já coberto) |
| `nextSelection(prev, alive, event)` | → `{sessionId, snappedPermissionId}` | snap por borda; sessão sumida volta ao auto; scroll sem dar a volta; ordem estável sob mudança de estado |
| `pickState(sessions, now, selection?)` | formato atual + `sessionId`, `index`, `waitingElsewhere` | sem `selection` = comportamento de hoje (testes atuais passam) |
| `wheelStep(acc, deltaY, now)` | → `{acc, step}` | limiar 120, gesto novo após 220 ms, passo a cada 85 ms, inversão |
| **`acceptDecision({behavior, displayedId, shownId, shownSince, decidedId, now})`** | → `boolean` | recusa: behavior inválido, `shownId` nulo, eco divergente, dentro de 800 ms, id já decidido. **Fecha o gap de teste do `island:decide`** apontado em `CONCERNS.md` |
| `sanitizePreferences`, `applyPreferenceChange`, `effectiveOpacity` | prefs | lixo em disco → defaults; chave desconhecida some; opacidade 100 com permissão |
| `islandVisibility({userHidden, fullscreen, pinned})` | → `boolean` | tabela de verdade |
| `isCoveringMonitor(windowRect, monitorRect, tolerance)` | → `boolean` | janela maximizada **não** cobre (a barra de tarefas sobra); tela cheia cobre; tolerância de 1 px |
| `anchorPosition(anchor, workArea, stage)`, `dockPosition(anchorRect, ownSize, workArea, side, gap)` | → `{x, y}` | cabe à direita; senão à esquerda; clamp na `workArea` |

### `spring.js` (puro, UMD)

`springStep`, `springParams(direction, style, speed)`, `shouldNudge`, `pointInRect(point, rect, margin)`. Testes obrigatórios por propriedade, não por snapshot: crescer em Default tem overshoot entre 4% e 8%; encolher tem overshoot < 0,5%; retarget no meio mantém a continuidade de velocidade; assenta em < 1 s para todo estilo.

### `main.js` (I/O e cola, sem decisão)

`readSessions` (+ `id`, `firstSeenAt`), `refresh()`, `writeDecision`, `cursorTick`, `globalShortcut`, `Menu`, criação/reposicionamento de janelas, `persist*`, heartbeat, chamadas ao `platform-probe`. Regra: se uma linha de `main.js` contém um `if` com regra de negócio, ela pertence a `state.js`.

### Fica sem teste automatizado (aceito)

Apresentação (CSS), `window.js`, comportamento nativo (click-through, topmost, menu em janela `focusable:false`). Cobrir com checklist manual no Windows, que é a única plataforma validada.

## Q4. Se o spike escolher Tauri

### O que migra para Rust e o que fica

| Parte | Destino | Motivo |
|-------|---------|--------|
| Renderer (`index.html`, `spring.js`, CSS) | **Fica web**, atrás de um shim `window.island` que implementa a mesma superfície com `invoke`/`listen` | O renderer só conhece `window.island.*`: essa é a costura |
| `main.js` inteiro | **Rust** (janelas por display, `notify`/poll do diretório, cursor tick, `set_ignore_cursor_events`, drag, heartbeat, prefs, atalho, menu, instância única) | É o processo confiável |
| **Gate de permissão** (`validPermission`, `acceptDecision`, armamento, escrita da decisão) | **Rust, obrigatoriamente** | Não pode morar no webview: é o que o webview não é confiável para decidir |
| Seleção, wheel, ordenação, prefs | Rust **ou** webview (lógica de exibição) | Só o gate é fronteira de segurança |
| `hook.js`, `permission-hook.js`, `install.js`, `window.js` | **Ficam Node** | São processos próprios, lançados pelo Claude Code com o Node do usuário (`process.execPath` gravado pelo `install.js`). Não dependem do Electron, exceto o *spawn* da ilha em `SessionStart` |
| `state.js` | **Divide-se**: o lado dos hooks (`eventToState`, `permissionRequest`, `decisionOutput`) fica Node; o lado do `main` (`pickState`, `validPermission`, `acceptDecision`, prefs) é reimplementado em Rust | Manter Node como sidecar anularia o ganho de memória (binário do Node embutido) |

**Resposta direta: hooks e a parte de `state.js` usada por eles podem ficar Node.** O barramento de arquivos JSON é o seam que torna isso possível. A única mudança nos hooks é o comando de *spawn* da ilha (hoje `require('electron')`).

### Riscos específicos do port

1. **Lógica de segurança duplicada em duas linguagens** (`permissionRequest` no hook Node, `validPermission` no Rust): risco de divergência no `DECEPTIVE_CHARACTERS` (`\p{Cc}\p{Cf}\p{Zl}\p{Zp}`), no padrão de UUID, nos limites de 600 caracteres/20 linhas. **Mitigação:** vetores dourados em JSON (`fixtures/permission-vectors.json`) executados por `node:test` **e** `cargo test`. Criar os vetores ainda em Electron, já como spec de port.
2. **Motores de renderização diferentes.** WebView2 (Windows) é Chromium; WKWebView (macOS) e WebKitGTK (Linux) não são. O CSS atual usa `oklch()`, `color-mix()`, `:has()` e `interpolate-size`; o suporte varia entre motores e versões. Hoje macOS/Linux nunca foram testados, então o peso é baixo, mas o requisito "multiplataforma" fica mais caro.
3. **DPI move para o Rust.** `cursor_position()` e posições de janela vêm em pixels físicos; a divisão pelo `scale_factor` do monitor certo passa a ser código seu.
4. **Click-through:** `setIgnoreCursorEvents` existe, mas **não há `forward`** documentado; o mesmo padrão de polling de cursor em Rust é o contorno da comunidade (issues #11461 e #9250 do Tauri). Reforça a escolha de Q1.5.
5. **Transparência no macOS** exige a flag de API privada no Tauri (de memória, não verificado nesta pesquisa).
6. **Plugin de atalho global** exige capability explícita e Rust ≥ 1.90 (documentação do plugin).

### Caminho incremental

| Passo | O que muda | Risco |
|-------|-----------|-------|
| 0 (Electron, já) | `main.js` fino; decisões em funções puras com formato JSON-in/JSON-out; vetores dourados | Baixo, é o que o milestone já pede |
| 1 | Casca Tauri mínima: carrega o **mesmo** renderer, lê o diretório (somente leitura), sem permissão. Mede memória e CPU | Cabe no spike |
| 2 | Rust assume o gate e a escrita de decisão; renderer fala por `invoke`. Electron e Tauri coexistem lendo o mesmo barramento | Médio, é a fronteira de segurança |
| 3 | Rust assume cursor tick, drag, prefs, menu, atalho, probe nativo | Médio |
| 4 | `hook.js` passa a lançar o executável Tauri; remover Electron | Baixo (troca de comando) |

**Armadilha de metodologia do spike:** o WebView2 roda em processos `msedgewebview2.exe` **fora** do processo do app. Comparar só `tauri.exe` com o total do Electron favorece o Tauri de forma enganosa. Somar o *private working set* da árvore de processos inteira. Incluir um **controle "Electron enxuto"** (uma só janela, ou janelas secundárias criadas sob demanda, `backgroundThrottling`) antes de concluir que 426 MB exige reescrita. Não afirmar números nesta pesquisa: nenhum foi medido por mim.

## Architectural Patterns

### Pattern 1: Funil único `refresh({reason})`

**What:** poll, wheel, prefs, display e visibilidade chamam a mesma função; ela recomputa `picked`, atualiza o gate (`shownPermissionId`/`shownPermissionSince`) e faz broadcast.
**When to use:** sempre que uma nova fonte de entrada pode mudar o que a ilha exibe.
**Trade-offs:** uma indireção a mais; em troca, o armamento não depende de qual caminho trocou o pedido.

```js
function refresh() {
  selection = nextSelection(selection, aliveSessions(readSessions(), Date.now()), pendingEvent);
  const picked = pickState(sessions, Date.now(), selection);
  const permissionId = picked.permission ? picked.permission.id : null;
  if (permissionId !== shownPermissionId) { shownPermissionId = permissionId; shownPermissionSince = Date.now(); }
  // compara serializado e só então transmite, como hoje
}
```

### Pattern 2: Eco que só pode estreitar

**What:** o renderer ecoa o id que **está exibindo**; o `main` só descarta quando diverge e, em caso algum, usa o eco como alvo.
**When to use:** em toda ação cujo efeito depende do que o usuário viu.
**Trade-offs:** defesa em profundidade contra renderer atrasado (se o renderer demorar > 800 ms para pintar a troca, o armamento por tempo sozinho deixaria passar um clique no conteúdo antigo; o eco não). Não contradiz o anti-padrão "renderer-supplied identifiers": ali o id era o **alvo**; aqui é só uma conferência.

```js
function acceptDecision({ behavior, displayedId, shownId, shownSince, decidedId, now }) {
  if (!decisionOutput(behavior) || !shownId) return false;
  if (displayedId !== shownId) return false;          // o usuário olhava para outro pedido
  if (decidedId === shownId) return false;            // primeiro clique vence (duas ilhas)
  return now - shownSince >= PERMISSION_ARM_MS;
}
```

### Pattern 3: Sensor nativo atrás de uma função com dados puros

**What:** `platform-probe.js` só devolve retângulos e nomes de classe; a **decisão** ("isto é tela cheia?", "onde encaixar?") é `isCoveringMonitor`/`dockPosition`, puras.
**When to use:** fullscreen e dock. No Electron não existe API para janela alheia, então há um sensor nativo; se o runtime mudar para Tauri, só o sensor é reescrito (crate `windows`); a lógica de decisão e seus testes ficam.
**Trade-offs:** o sensor em Electron pede **FFI (`koffi`, MIT, binário pré-compilado) ou um helper PowerShell persistente** (RAM extra, contra o objetivo do milestone). Dependência nova justificada somente se o spike mantiver Electron.

### Pattern 4: Preferência como esquema + `sanitize`

**What:** um único esquema declarativo; toda leitura de disco e toda mudança passam por ele. Mesma regra de `validPermission`: dado em disco nunca é confiável.

## Data Flow

### Fluxo de estado (sem mudar o contrato)

```
hooks → ~/.claude/island/*.json → readSessions(+id,+firstSeenAt,+ctx) → refresh()
      → island:state (todas as janelas) → render() → alvo de mola → rAF até assentar
```

### Fluxo de decisão (fronteira de confiança preservada)

```
usuário clica "Permitir" (botão habilitado: armado + lido + não respondido)
 → renderer: island.decide('allow', displayedPermissionId)
 → main: sender é ilha? → acceptDecision(...) → writeDecision(shownPermissionId)   # alvo = o do main
 → permission-hook lê decisions/<id>.json → imprime decisionOutput → withdrawRequest
```

### Invariantes de segurança (checklist de revisão para toda PR)

| # | Invariante | Onde se verifica |
|---|------------|------------------|
| I1 | O alvo de uma decisão é sempre `shownPermissionId` do `main`; o renderer só envia intenção + eco que pode apenas recusar | `acceptDecision` + teste |
| I2 | `shownPermissionId`/`shownPermissionSince` só mudam dentro de `refresh()` | revisão de código |
| I3 | **Qualquer** troca de id (poll, snap-back, scroll) reinicia o armamento de 800 ms | teste: scroll muda id → `acceptDecision` recusa por 800 ms |
| I4 | Primeiro clique vence por id (duas ilhas) | `decidedId` |
| I5 | Hover, scroll, nudge, tema e opacidade não habilitam nem disparam decisão; com pedido na tela a opacidade é 100% | `effectiveOpacity` + teste |
| I6 | Preferências só entram pelo menu do `main`; arquivo é sanitizado na leitura | ausência de canal `set-pref` |
| I7 | Sem DOM obsoleto: texto e id trocam atomicamente | revisão de `render()` |
| I8 | Scroll sobre `#permission` nunca troca de sessão | teste manual + revisão |
| I9 | Janela escondida/tela cheia não decide (não há UI); o terminal segue valendo em paralelo | desenho do hook (já existente) |
| I10 | Se houver Rust: o gate é Rust, com vetores dourados compartilhados | CI |

## Anti-Patterns

### Anti-Pattern 1: Redimensionar a janela para animar
**What people do:** `setBounds` por quadro seguindo a pílula.
**Why it's wrong:** tearing por latência de IPC; reabre o bug de DPI fracionário que o projeto já conhece.
**Do this instead:** palco fixo, mola no renderer.

### Anti-Pattern 2: Ordenar o scroll pela urgência
**What people do:** reaproveitar a ordem do `pickState` como lista de abas.
**Why it's wrong:** a lista se reordena sozinha e o usuário perde a posição no meio do gesto.
**Do this instead:** `firstSeenAt` estável; a urgência só decide a seleção automática e o snap-back.

### Anti-Pattern 3: Snap-back por nível
**What people do:** voltar à sessão com permissão a cada poll.
**Why it's wrong:** impede de rolar para longe de um pedido aberto.
**Do this instead:** snap por borda (pedido novo) + indicador `waitingElsewhere`.

### Anti-Pattern 4: Hover pelo DOM sob click-through com `forward`
**What people do:** confiar em `mouseenter`/`mouseleave` encaminhados.
**Why it's wrong:** quebra com janela elevada em foco (UIPI), não existe em Linux, e não existe no Tauri.
**Do this instead:** cursor do `main`, hit-test no renderer.

### Anti-Pattern 5: Preferência escrita pelo renderer
**What people do:** `island:set-pref` genérico.
**Why it's wrong:** cria uma superfície de entrada não confiável sem necessidade.
**Do this instead:** menu nativo no `main`.

### Anti-Pattern 6: Validação de segurança duplicada sem vetores comuns
**What people do:** reescrever `validPermission` em Rust "equivalente".
**Why it's wrong:** divergência silenciosa em Unicode e limites.
**Do this instead:** vetores dourados em CI nas duas linguagens.

## Scalability Considerations

O que escala aqui é sessões e monitores, não usuários.

| Preocupação | 1 sessão, 1 monitor | ~5 sessões, 2 monitores (hoje) | 20+ sessões, 4 monitores |
|-------------|---------------------|-------------------------------|--------------------------|
| Lista do scroll | trivial | indicador de página basta | **sessões-fantasma:** `RUNNING_STALE_MS` = 2 h mantém sessão morta na lista. Antes do scroll sair, filtrar por vivacidade (`windowPid` ainda existe via `process.kill(pid, 0)`; sem PID, só idade) e podar arquivos velhos |
| Polling | 400 ms de `readdir` | idem | podar arquivos (já em `CONCERNS.md`); `fs.watch` só se medir |
| Memória | 1 renderer | 2 renderers (medido: 426 MB no total) | criar janela só onde há ilha visível; ponto de decisão do spike |
| Cursor tick | desligado em idle | 30 Hz só se visível | medir; adaptar taxa só se o custo aparecer |

## Integration Points

### Contrato IPC (`island:*`)

| Direção | Canal | Argumentos | Mudança |
|---------|-------|------------|---------|
| main→renderer | `island:state` | `picked + sessionId, index, count, waitingElsewhere, armMs`, `shouldChime` | estendido |
| main→renderer | `island:prefs` | objeto sanitizado | novo |
| main→renderer | `island:cursor` | `{x, y}` ou `null` | novo |
| renderer→main | `island:capture` | `boolean` | **substitui** `island:hover` |
| renderer→main | `island:wheel` | `deltaY` finito | novo |
| renderer→main | `island:context-menu` | nenhum | novo |
| renderer→main | `island:decide` | `behavior, displayedPermissionId` | eco adicionado |
| renderer→main | `island:drag`, `drag-end`, `reset-position`, `focus` | inalterados | — |

Regra existente mantida: novas mensagens carregam **intenção**, nunca alvo.

### Serviços/sistema externos

| Integração | Padrão | Notas |
|------------|--------|-------|
| Ilha do Windhawk (dock) | Sensor nativo de rect por classe de janela + `dockPosition` | **Problema de fundo:** o retângulo da janela do mod é o **palco fixo** (880×320 + padding), não a pílula. A largura visível da pílula do mod muda por estado e não é observável de fora. Sem um sinal melhor, o encaixe só pode usar um deslocamento fixo a partir do centro (a maior largura possível ± folga), o que deixa vão com a ilha dele ociosa. Classe `Windhawk.DynamicIslandForWindows` ainda **não confirmada**. Tratar como fase de pesquisa própria |
| Atalho global | `globalShortcut.register` (Electron) | `register` devolve `false` se o atalho estiver ocupado: mostrar isso no menu; `unregisterAll` no `will-quit` |
| Fullscreen (Windows) | `GetForegroundWindow` + rect + monitor, a cada 0,5 s | Em Electron exige FFI ou helper; em Tauri é a crate `windows` |
| Menu de clique direito | `Menu.popup({window})` no `main` | **Verificar** em janela `focusable:false` no Windows |

### Fronteiras internas

| Fronteira | Comunicação | Notas |
|-----------|-------------|-------|
| hooks ↔ ilha | arquivos JSON atômicos | inalterado; **é o seam do possível port** |
| `main` ↔ renderer | IPC `island:*` | única superfície do renderer: `window.island` |
| `state.js`/`spring.js` ↔ resto | `require` / UMD | sem I/O, sem `electron` |
| `main` ↔ `platform-probe` | chamada direta, 2 Hz | só retângulos e strings validadas |

## Ordem de build sugerida

**Princípio:** o que é portável (renderer + lógica pura) vem antes da decisão de runtime; o que é de runtime (cursor tick, menu, atalho, probe, janelas) vem depois. Se o spike escolher Tauri, as features de `main` seriam escritas duas vezes.

| # | Fase | Depende de | Entrega | Pesquisa própria? |
|---|------|-----------|---------|-------------------|
| 1 | **Spike de medição** | nada | Memória e CPU: Electron atual vs. **Electron enxuto** vs. casca Tauri, mesma UI, 2 monitores, ociosa, árvore de processos inteira | Sim (método) |
| 2 | **Fundação segura e portável** | nada (paralelo a 1) | `refresh()` funil; `acceptDecision` + eco + testes; `webPreferences` explícitas (`sandbox`, `contextIsolation`, `nodeIntegration`); `armMs` no payload; vetores dourados de permissão; `sanitizePreferences` | Não |
| 3 | **Palco fixo + mola + nudge + hover scale** | 2 | `spring.js` + testes por propriedade; conteúdo na largura final; palco ampliado; estilos e velocidade; `reduced-motion`. Hover ainda pelo DOM atual | Parcial (CSP/carga do `spring.js`) |
| 4 | **Temas, formas e material** | 3 (precisa do palco e de `data-*`) | 8 temas por tokens, 3 formas, camadas de material, acento por estado; `THIRD_PARTY_NOTICES.md` | Não |
| 5 | **Decisão de runtime** | 1 | Registrar em `PROJECT.md`. Se Tauri: fase de casca + gate em Rust antes da 6 | Gate |
| 6 | **Hover por cursor + `capture`** | 3, 5 | `cursorTick`, `island:cursor`/`capture`, histerese, `expandOn: click`; fim do `forward` | Sim (DPI 125%) |
| 7 | **Preferências + menu + atalho + âncora** | 2, 4, 5 | `preferences.js`, menu nativo, `Ctrl+Alt+C`, `anchorPosition`, `effectiveOpacity` | Sim (menu em `focusable:false`) |
| 8 | **Seleção + scroll** | 2, 3, 6 | `nextSelection`, `wheelStep`, `waitingElsewhere`, filtro de vivacidade, poda | Não, mas exige a regra do texto de permissão |
| 9 | **Esconder em tela cheia** | 5, 7 (`islandVisibility`) | `platform-probe` + `isCoveringMonitor` | Sim (FFI vs helper vs Rust) |
| 10 | **Dock com a ilha do Windhawk** | 7, 9 | `dockPosition` | **Sim, grande** (rect da pílula não observável) |
| 11 | **Port Tauri** (se escolhido) | 5; vale cortar a sequência 6–10 em Rust | casca → gate → resto, ver Q4 | Sim |

**Por que o scroll fica depois do hover por cursor:** o scroll só chega ao renderer com `capture` ligado e depende de a troca animar sem sobrar DOM antigo (fase 3). **Por que o `refresh()` vem na 2:** é o ponto único onde o armamento é reiniciado; sem ele o scroll criaria um segundo caminho de troca de pedido.

## Itens a verificar (honestidade sobre lacunas)

| Item | Confiança | Como resolver |
|------|-----------|---------------|
| `script-src 'self'` carrega `spring.js` via `loadFile` (`file://`)? Alternativa: `protocol.handle` com esquema próprio | LOW | Teste de 10 minutos na fase 3. Não afrouxar o CSP além de `'self'` |
| `Menu.popup` abre a partir de janela `focusable:false` no Windows | LOW | Teste na fase 7. Fallback: menu em HTML dentro do palco (o hit-test passa a incluí-lo) |
| Evento `wheel` chega a janela não focável (depende de "Rolar janelas inativas" do Windows) | LOW | Teste na fase 8. Fallback: captura de roda no `main` via polling não existe; documentar a exigência |
| Arredondamento de `getBounds()` a 125% | MEDIUM | Observar na fase 6; a histerese cobre ±1 px |
| `koffi` funciona dentro do Electron 45 e custo de memória | MEDIUM | O pacote `notification-state-ffi` já o usa; medir no spike se a fase 9 ficar em Electron |
| `@property` para animar o acento; `oklch`/`color-mix` em outros motores | MEDIUM | Só importa se Tauri em macOS/Linux |
| Flag de API privada para transparência no macOS (Tauri) | LOW | Verificar apenas se o port for escolhido |
| Se a lista de scroll inclui sessões `done` (hoje somem em 10 s) ou só as vivas | decisão de produto | Levar ao `/gsd-discuss-phase` da fase 8; a mudança é um filtro em `aliveSessions` |
| Se pedido de permissão deve reexibir uma ilha escondida pelo usuário | decisão de produto | Padrão proposto: **não** reexibir (intenção explícita; o terminal decide e o aviso sonoro toca). Levar à fase 7 |

## Sources

- Código local lido: `main.js`, `state.js`, `index.html`, `.planning/PROJECT.md`, `.planning/codebase/{ARCHITECTURE,STRUCTURE,CONCERNS}.md`, `.planning/research/WINDHAWK-MOD.md` (HIGH)
- Electron, `screen`: `getCursorScreenPoint()` devolve ponto em DIP e não é suportado em Wayland. https://www.electronjs.org/docs/latest/api/screen (MEDIUM)
- Electron, `BrowserWindow`: `setIgnoreMouseEvents` com `forward` (macOS e Windows; para temporariamente quando uma janela elevada assume o foco, por UIPI); `setShape` é experimental (Windows e Linux). https://www.electronjs.org/docs/latest/api/browser-window (MEDIUM)
- Tauri 2, API de janela: `setIgnoreCursorEvents`, `cursorPosition`, `setAlwaysOnTop` listados; `forward` não documentado. https://v2.tauri.app/reference/javascript/api/namespacewindow/ (MEDIUM)
- Tauri, click-through com leitura de cursor: https://github.com/tauri-apps/tauri/issues/11461 e https://github.com/tauri-apps/tauri/issues/9250 (LOW-MEDIUM, discussão de comunidade)
- Tauri, plugin de atalho global (capability explícita; Rust 1.90): https://v2.tauri.app/plugin/global-shortcut/ (MEDIUM)
- Tauri, sidecar (`externalBin`, sufixo de target triple): https://v2.tauri.app/develop/sidecar/ (MEDIUM)
- `koffi` (FFI para Node, binários pré-compilados, MIT): https://koffi.dev/ ; `notification-state-ffi` como precedente de uso: https://npmjs.com/package/notification-state-ffi (MEDIUM)
- Detecção de tela cheia por geometria da janela em foco contra o monitor: https://www.npmjs.com/package/detect-fullscreen e https://www.richard-banks.org/2007/09/how-to-detect-if-another-application-is.html (LOW-MEDIUM)

---
*Architecture research for: Claude Island (próximo milestone)*
*Researched: 2026-11-21*
