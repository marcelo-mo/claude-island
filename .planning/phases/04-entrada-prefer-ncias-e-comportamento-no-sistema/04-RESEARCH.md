# Phase 4: Entrada, preferências e comportamento no sistema - Research

**Researched:** 2026-11-21
**Domain:** hover por posição do cursor com click-through dinâmico, menu nativo de preferências, atalho global, âncora/transparência/"uma ilha só" e esconder em tela cheia, num overlay Electron 45.4.1 no Windows 11 com 2 monitores (100% e 125%), sem nunca aceitar uma decisão de permissão estando escondido
**Confidence:** HIGH para os 5 itens do research flag (medidos ou testados nesta máquina, nesta sessão, em Electron 45.4.1); MEDIUM para o contrato da Fase 3 (lido em worktree, ainda não está na `main`); LOW para os itens que exigem uma pessoa na tela (UIPI, AltGr real, dispensa do menu), listados em Open Questions com script pronto

<user_constraints>
## User Constraints (from CONTEXT.md)

Não existe `04-CONTEXT.md` (o autor pulou o discuss-phase). As restrições abaixo vêm do orquestrador e dos documentos do projeto, e são tratadas como travadas.

### Locked Decisions
- Base = Electron 45.4.1 (Fase 1 mediu e decidiu; a ramificação "crate `windows` se o Tauri vencer" é moot). Fonte: `.planning/PROJECT.md` Key Decisions.
- Cores de estado fixas (laranja/âmbar/verde e botão do quaint-money); temas só trocam fundo/superfície.
- Hover pela posição de tela, com histerese, sem piscar na borda (HOV-01); fora da pílula cliques e roda atravessam; dentro, a ilha recebe clique e roda, inclusive com terminal elevado em foco e no monitor a 125% (HOV-02); expandir no hover (padrão) ou no clique (HOV-03); arraste, duplo clique e botões seguem funcionando (HOV-04).
- Menu de clique direito com tema, forma, estilo, velocidade, expandir hover/clique, fixar aberta, transparência, âncora e esconder (PREF-01); persistência com arquivo corrompido/antigo nunca impedindo a subida, cada valor inválido volta ao padrão (PREF-02); atalho global Ctrl+Alt+C só se não conflitar com AltGr+C no ABNT2, senão outro sem conflito, e o menu avisa se `register()` falhar (PREF-03); âncora (topo central, cantos, base) e arraste preso ao monitor da própria ilha (PREF-04); "uma ilha só" opcional (PREF-05); transparência 100/85/70/55% nunca com pedido na tela (PREF-06).
- Windows: ilha do monitor coberto por app em tela cheia some e volta quando ele sai; desktop e a própria ilha não contam (TELA-01); pedido nessa hora só toca o som, a ilha não reaparece, o terminal segue valendo (TELA-02).
- Invariantes do gate (toda fase): hover, scroll, nudge, tema, opacidade e esconder nunca habilitam nem disparam uma decisão; esconder nunca aprova; reexibir rearma; roda a suíte do gate (`node:test`, `fixtures/permission-vectors.json`) antes de fechar.
- Restrições de CLAUDE.md (ver seção própria): menor diff, sem dependência nova sem necessidade, `node:test`, lógica pura em `state.js`, hooks nunca quebram, commits pt-br.

### Claude's Discretion
- Estratégia de hit-test, taxas de polling, histerese, local do arquivo de preferências, forma do menu, padrão do atalho, regra de "tela cheia", modo "monitor do cursor", estrutura de ondas e planos.

### Deferred Ideas (OUT OF SCOPE)
- Troca de sessão por roda, pontos, fila (Fase 5); convivência com o Windhawk (Fase 6); blur/acrílico (INTR-02); validação em macOS/Linux (INTR-03); atalho global de Permitir/Negar e "permitir sempre" (Out of Scope do projeto); qualquer coisa de Tauri.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HOV-01 | Cursor por posição de tela, retângulo real da pílula, histerese | `getCursorScreenPoint` custa 0,69 µs/chamada (§Code Examples, Pattern 1); hit-test no renderer com `hoverStep` puro, margem 2 px entra / 8 px sai, coberta pela deriva medida de `getBounds()` (+1 a +3 DIP a 125%) |
| HOV-02 | Fora atravessa, dentro recebe clique/roda; terminal elevado; 125% | `setIgnoreMouseEvents(!capture)` sem `forward` (o `forward` para sob janela elevada, doc oficial); estilos estendidos medidos; UIPI de verdade = item humano CHK-01 |
| HOV-03 | Expandir no hover (padrão) ou no clique | Lógica só de renderer (Pattern 1); preferência `expandOn` |
| HOV-04 | Arraste, duplo clique, botões intactos | `dragStartPositions` segura o `capture`; DOM `mouseenter/mouseleave` saem, `pointermove` dos botões fica; travas de `gate.test.js` listadas |
| PREF-01 | Menu de clique direito | `Menu.popup({ window })` funciona em janela `focusable:false` (medido); canal `island:menu` sem argumentos |
| PREF-02 | Persistência tolerante | `sanitizePreferences` por chave em `state.js`; temp+rename; `.bad`; conflito de local com D-16 da Fase 3 (Open Question 1) |
| PREF-03 | Atalho global | Ctrl+Alt+C **conflita** com AltGr+C no ABNT2 (`¢`, medido): padrão `Control+Alt+Shift+C`; `register` devolve `true` para Ctrl+Alt+C (não detecta o conflito), `false` se outro processo tem, e **lança** com string inválida (medidos) |
| PREF-04 | Âncora e arraste preso ao monitor | `anchorPosition` pura; o clamp por display já prende; `createIsland` precisa de `setBounds` pós-criação (125% nasce 6 DIP mais alta) |
| PREF-05 | Uma ilha só (principal ou cursor) | `islandDisplays` pura; `setBounds` entre monitores de DPI diferente funcionou (1 tentativa por sentido) |
| PREF-06 | Transparência 100/85/70/55% | `setOpacity` numa janela transparente mistura de fato com o fundo (pixel medido); `effectiveOpacity` já existe e já é fail-safe |
| TELA-01 | Esconder em tela cheia (Windows) | `koffi` 3.3.8 funciona no Electron 45.4.1 com `allowBuilds: koffi: false`; mapeamento HMONITOR→display por igualdade de retângulo físico medido; custo 7,8 µs/sondagem, +5 MB |
| TELA-02 | Pedido com ilha escondida só toca som | Áudio roda em janela escondida por `hide()` (medido); `hide()` emite `hide` e `showInactive()` emite `show`, que já rearma (`main.js:212`) |
</phase_requirements>

## Summary

Os cinco itens do research flag foram resolvidos por medição nesta máquina, com Electron 45.4.1 (Chromium 156, Node 24.22.3) lançado do `node_modules` do repositório, `--user-data-dir` descartável, só em `scratchpad/fase4/` e sem entrada sintética. (1) **125%:** `getBounds()` deriva +1 a +3 DIP em relação ao pedido (520×410 vira 520×412 depois de `setBounds`, e 520×416 logo após a construção), `setPosition` ainda muda o tamanho, e o retângulo nativo está certo (650×513 físicos). A histerese de 2/8 px e a tolerância de 2 px do `isWithinWorkArea` cobrem, mas a âncora de baixo encosta no limite. (2) **UIPI:** a doc oficial diz que `forward: true` para sob janela elevada; o desenho por polling de `getCursorScreenPoint` não usa `forward`, mas a prova com um terminal elevado de verdade precisa de uma pessoa (script pronto). (3) **`Menu.popup`** funciona numa janela `focusable:false`: o menu abre como segunda janela não ativável, o primeiro plano não muda, os timers seguem e ele só fecha por `closePopup`; falta humano para "clicar fora fecha?". (4) **Atalho:** Ctrl+Alt+C produz `¢` (U+00A2) no ABNT2 do autor, então conflita e o padrão tem de ser outro; `register` não enxerga esse conflito. (5) **`koffi`:** carrega no Electron 45.4.1, o pnpm 11 só exige `koffi: false` em `allowBuilds` (sem isso `pnpm install` sai com código 1), e o sensor de tela cheia inteiro custa 7,8 µs e +5 MB.

A Fase 3 está sendo executada em paralelo e **não está na `main`** (nem em `origin`): li o contrato dela no worktree `claude-island-fase2` (`03-CONTEXT.md` commitado no ramo local `feat/fase-3-visual`, `03-UI-SPEC.md` ainda não commitado). Esta pesquisa assume esse contrato (palco 520×410, pílula viva por `getBoundingClientRect()`, preferências visuais normalizadas em `state.js` e enviadas junto do estado). Há **um conflito real a decidir**: a D-16 da Fase 3 põe o `preferences.json` em `~/.claude/island/`, que é a pasta que `readSessions()` varre por `*.json` e que a Fase 5 vai podar.

**Primary recommendation:** hover = main envia o cursor, renderer decide o hit-test com `hoverStep` puro e responde `island:capture`; preferências = esquema + `sanitizePreferences` em `state.js`, gravação só pelo main, menu nativo do main que desarma o gate ao abrir e ao fechar; atalho padrão `Control+Alt+Shift+C`; tela cheia = `fullscreen.js` com `koffi` (lazy, só Windows, 2 Hz), decisão por redutor puro, efeito por `hide()`/`showInactive()` + fato `coveredByFullscreen` por display no `acceptDecision`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Posição do cursor | Main (`screen.getCursorScreenPoint`) | — | Única fonte confiável com a janela em click-through; renderer não recebe `mousemove` fora da pílula |
| Hit-test e histerese | Renderer (retângulo vivo da pílula, escalado) | Main (só entrega o cursor local) | Só o renderer conhece a geometria animada; a Fase 3 expõe `#pill.getBoundingClientRect()` |
| Captura do mouse | Main (`setIgnoreMouseEvents`) | Renderer (decide e pede) | O renderer envia só `boolean`; main segura durante arraste |
| Preferências (valores, validação, escrita) | Main + `state.js` puro | — | SEG-08: nenhum canal do renderer grava preferência |
| Menu | Main (`Menu.popup`) | Renderer (só avisa "abrir") | Menu nativo, itens vindos de constantes |
| Atalho global | Main (`globalShortcut`) | — | Só existe no processo principal |
| Visibilidade (usuário + tela cheia) | `state.js` (redutor puro) | Main (`hide`/`showInactive`) | Regra pura testável; efeito em I/O |
| Sensor de tela cheia | `fullscreen.js` (Win32 via `koffi`) | Main (agenda a 2 Hz) | Só retângulos e strings saem do sensor; a decisão é pura |
| Fato `coveredByFullscreen` / `windowVisible` no gate | Main (`acceptDecision`) | — | O renderer nunca fornece fato de janela |
| Transparência | Main (`setOpacity(effectiveOpacity(...))`) | `state.js` | Dono único do fato "há pedido"; renderer não pode errar |
| Âncora/posição | `state.js` (`anchorPosition`) | Main (`setBounds`), CSS (`data-anchor`) | Matemática pura; alinhamento da pílula dentro do palco é CSS |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Electron | 45.4.1 (já no repo) | `screen`, `Menu`, `globalShortcut`, `BrowserWindow` | Todas as APIs da fase já existem; nada novo [VERIFIED: probes p1–p5, `node_modules/electron/package.json` = 45.4.1] |
| `node:test` | Node 26.4.0 do sistema | Testes puros e travas de texto | Padrão do projeto; baseline 194 testes passando em 147 ms [VERIFIED: `node --test` nesta sessão] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `koffi` | 3.3.8, **exato**, em `dependencies` | FFI para `user32`/`dwmapi` (tela cheia) | Só TELA-01, só Windows, `require` dentro de `if (process.platform === 'win32')` e `try/catch` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `koffi` | PowerShell residente com `Add-Type` | Medido: 28,3 MB de private working set (1 amostra) contra +5,0 a +5,1 MB do `koffi` (3 execuções) [VERIFIED: probe psmem, p6]; mais um processo órfão possível |
| `koffi` | `SHQueryUserNotificationState` sozinha | Responde pelo usuário, não por monitor, e a doc diz que não há notificação ao entrar/sair de tela cheia [CITED: learn.microsoft.com SHQueryUserNotificationState]; também precisaria de FFI |
| `setOpacity` (janela) | Alfa só do preenchimento por CSS | Mais fiel ao mod se a transparência dele for só do fundo (não confirmado); mais código e acopla na camada de material da Fase 3. Ver Open Question 5 |
| Hit-test no renderer | Hit-test no main com retângulo publicado | Exige IPC de retângulo por quadro durante a mola; a Fase 3 já expõe o retângulo vivo no renderer |

**Installation (somente na execução, depois do checkpoint humano abaixo):**
```bash
pnpm add koffi@3.3.8
# pnpm-workspace.yaml: allowBuilds: { electron: true, koffi: false }
```

**Version verification:** `npm view koffi version` = 3.3.8, MIT, repositório `github.com/Koromix/koffi`, criado em 2022-02-23, 6,0 M downloads/semana, última versão publicada em 2026-11-13 [VERIFIED: npm registry + `gsd-tools package-legitimacy`]. Binário vem em `@koromix/koffi-win32-x64@3.3.8` (optionalDependency; só o do SO atual é instalado) [VERIFIED: `node_modules/.pnpm` do projeto de sonda].

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `koffi` | npm | 3,7 anos (versão 3.3.8 com 8 dias) | 6,0 M/semana | github.com/Koromix/koffi | **SUS** (`too-new`: só a versão mais recente) | Flagged: planejador insere `checkpoint:human-verify` antes de instalar |
| `@koromix/koffi-win32-x64` | npm | 6 meses (versão 3.3.8 com 8 dias) | 0,49 M/semana | github.com/Koromix/koffi | **SUS** (`too-new`, mesma razão) | Flagged: vem junto do `koffi`; mesmo checkpoint |

**Packages removed due to SLOP verdict:** nenhum (`koffi@3.2.0` devolveu SLOP porque essa versão não existe; usar só 3.3.8).
**Packages flagged as suspicious [SUS]:** `koffi`, `@koromix/koffi-win32-x64`. `koffi` `[WARNING: flagged as suspicious — verify before using.]` O motivo é só recência da versão (as anteriores 3.3.7 de 2026-11-05 e 3.3.6 de 2026-10-31 existem), sem `postinstall` (`scripts.postinstall` = null; o `install` é `node ./cnoke.cjs -P . -D src/koffi --prebuild --release`). Eu testei **3.3.8** carregando no Electron 45.4.1 do projeto: por isso a recomendação é fixar exato (sem `^`). Origem do nome: `koffi.dev/start` (documentação oficial, `npm install koffi`) [CITED: koffi.dev/start], mas o veredito SUS impede a tag `[VERIFIED: npm registry]`.

Checkpoint sugerido ao autor antes do `pnpm add`: conferir no GitHub `Koromix/koffi` a release 3.3.8 e a ausência de script de rede. Alternativa sem dependência nova (mais cara): helper PowerShell residente (28 MB).

## Contratos lidos no repositório (com citação literal)

Cada linha foi lida com `Read` nesta sessão; os valores abaixo estão copiados verbatim.

| Contrato | Fonte e linhas | Citação |
|----------|----------------|---------|
| Click-through atual | `main.js:25` e `main.js:221` | `const CAN_CLICK_THROUGH = process.platform !== 'linux';` e `if (CAN_CLICK_THROUGH) island.setIgnoreMouseEvents(true, { forward: true });` |
| Topo da janela | `main.js:219` | `island.setAlwaysOnTop(true, 'screen-saver'); // acima de apps em tela cheia` |
| Reexibir rearma | `main.js:212-213` | `island.on('show', () => refresh('rearm'));` e `island.on('restore', () => refresh('rearm'));` |
| Fatos da janela no gate | `main.js:320-323` | `windowVisible: island.isVisible() && !island.isMinimized(),` / `coveredByFullscreen: false,` / `withinVisibleArea: Boolean(display) && isWithinWorkArea(island.getBounds(), display.workArea, HORIZONTAL_SLACK),` |
| `readSessions` varre a pasta | `main.js:124` | `if (!file.endsWith('.json')) continue;` |
| `positions.json` não é atômico | `main.js:62` | `fs.writeFileSync(positionsFile(), JSON.stringify(savedOffsets));` |
| Tolerância de área | `state.js:205` | `const WORK_AREA_TOLERANCE_PX = 2;` |
| `effectiveOpacity` | `state.js:260` e doc `state.js:255-259` | `function effectiveOpacity(preferredOpacity, hasPermission) {` e "Devolve 1 quando há pedido na tela ou o fato é desconhecido (`hasPermission !== false`, fail-safe)" |
| Motivos do gate | `fixtures/permission-vectors.json` (`acceptReasons`) | `["invalid-behavior","nothing-shown","echo-mismatch","already-decided","window-hidden","covered-by-fullscreen","outside-visible-area","not-armed"]` (já existe vetor de `covered-by-fullscreen`; nenhum motivo novo é necessário) |
| Canais travados por teste | `gate.test.js:224-226` | `const RENDERER_CHANNELS = [` / `'island:state', 'island:hover', 'island:focus', 'island:decide', 'island:drag', 'island:drag-end', 'island:reset-position',` / `];` |
| Contagem de handlers travada | `gate.test.js:249` | `assert.equal(handlers.length, 6);` |
| Fato de tela cheia travado | `gate.test.js:310` | `['coveredByFullscreen', 'false'],` |
| CSP travada | `index.html:5` | `default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'` |
| Hover atual por DOM | `index.html:570` e `574` | `pill.addEventListener('mouseenter', () => setHovering(true));` e `pill.addEventListener('mouseleave', () => { if (!drag) setHovering(false); });` |
| `done` não expande no hover | `index.html:365-366` | `// Em "concluído" a pílula não expande no hover: o botão "Abrir" tem de ficar parado sob o mouse.` / `const expandsOnHover = hovering && current.state !== 'done';` |
| Mod: âncoras | `WINDHAWK-MOD.md:49` | `6 âncoras (16 px das laterais, 40 px de baixo)` |
| Mod: transparência | `WINDHAWK-MOD.md:40` | `Transparency (100/85/70/55%)` |

**Contrato assumido da Fase 3** (worktree `D:/Desenvolvimentos/Pessoal/claude-island-fase2`, ramo local `feat/fase-3-visual`, **não está em `origin`**; nada disso está na `main`):
- Palco: "`WINDOW_SIZE` em `main.js` passa de 440×324 para **520×410**" (`03-UI-SPEC.md:237`); `body` "`display: flex; justify-content: center; align-items: flex-start`, com `padding-top: var(--stage-top)`" (`:240`).
- Retângulo vivo: "o retângulo de hit-test é o da pílula viva. Com a escala de hover, o retângulo medido é o escalado" (`03-UI-SPEC.md:202`).
- Preferências: "O main lê um `preferences.json` opcional em `~/.claude/island/` uma vez na subida, só leitura, sem watch" (`03-CONTEXT.md` D-16) e "normalizadas por uma função pura em `state.js` ... enviadas pelo main ao renderer junto do estado" (D-15). Chaves e valores: `theme` (`obsidian`…`porcelain`, `auto`), `shape` (`pill`, `win11`, `notch`), `animationStyle` (`smooth`, `default`, `bouncy`, `snappy`), `animationSpeed` [0,5; 2]; "Aplicar preferência (tema, forma) chama `restartArming()` explicitamente" (`03-UI-SPEC.md:197`).
- Hover escala 1,025 usando "`setHovering`" do renderer; a posição por tela "é da Fase 4" (D-08).

## Architecture Patterns

### System Architecture Diagram

```
                       teclado/OS                         menu nativo (Main)
  Ctrl+Alt+Shift+C ──► globalShortcut ─┐                  Menu.popup({window})
                                       ▼                          ▲ island:menu (sem args)
  fullscreen.js (koffi, 2 Hz) ─► nextFullscreen(prev, probe)       │
        retângulos+classes        [puro, state.js]                 │
                                       │ por display.id            │
                                       ▼                           │
 hooks ─► ~/.claude/island/*.json ─► refresh(reason) ─────────► applyPreference(key, value)
              (poll 400 ms)             │  ▲ 'poll'|'rearm'         │ sanitize ► persist(tmp+rename)
                                        │  └───── 'show'/'restore'/prefs/menu-will-show/-close
   isIslandVisible(userHidden, fs[display]) ──► island.hide() / showInactive()   [eventos 'hide'/'show']
   effectiveOpacity(prefs.opacity, hasPermission) ──► island.setOpacity(...)
   acceptDecision({..., windowVisible, coveredByFullscreen: fs[display], withinVisibleArea})
                                        │ island:state {…picked, prefs, armEpoch, answeredId}
 cursorTick 30 Hz (só com ilha visível e estado ≠ idle)                       ▼
   screen.getCursorScreenPoint() ──► island:cursor {x,y}|null ──► RENDERER (por ilha)
                                                                   hoverStep(inside, point, pill rect vivo)
                                                                   ▼ muda?      │ clique (expandOn:click)
                                          island:capture(bool) ◄────┘            ▼
   main: setIgnoreMouseEvents(!capture)  (sem forward; segura durante arraste/menu)   render()
```

### Recommended Project Structure
```
claude-island/
├── state.js          # + sanitizePreferences, anchorPosition, islandDisplays, nextFullscreen, isIslandVisible, hoverStep*
├── fullscreen.js     # NOVO: sensor Win32 via koffi (lazy); só retângulos/strings; nunca lança
├── main.js           # + cursorTick, capture, menu, atalho, visibilidade, aplicação de preferência
├── preload.js        # + onCursor, setCapture, openMenu; sai setHover
├── index.html        # + bloco // hover:inicio … fim (puro, vm), contextmenu, expandOn
└── gate.test.js / island.test.js / hover.test.js(novo)
```
`*` `hoverStep` mora inline no `index.html` (precedente das `regras-do-gate`/`mola`: a CSP não aceita script externo; teste por extração em `node:vm`). `fullscreen.js` fica fora de `window.js` de propósito: `hook.js` e `permission-hook.js` fazem `require('./window')`, e um `require('koffi')` ali (mesmo preguiçoso) é risco de hook quebrar.

### Pattern 1: Hover = main entrega o cursor, renderer decide, main aplica
**What:** `cursorTick` (30 Hz) em main lê o cursor e manda `island:cursor {x,y}` (coordenadas locais) a cada ilha enquanto ele está dentro de `bounds ± 24 px`, e `null` uma vez ao sair. O renderer roda `hoverStep` contra `pill.getBoundingClientRect()` e, se `capture` mudou, envia `island:capture(bool)`. O main faz `island.setIgnoreMouseEvents(!capture)` sem `forward`, exceto durante arraste (mantém `true`) e com menu aberto (segura).
**When to use:** sempre no Windows e no macOS; no Linux manter o comportamento de hoje (sem click-through, não testado).
**Por que:** `forward` "stops working temporarily when the active window is running at a higher integrity level" (UIPI) [CITED: electronjs.org/docs/latest/api/browser-window]. `getCursorScreenPoint()` custa **0,69 µs** por chamada (20 000 chamadas) [VERIFIED: probe p1], então 30 Hz é ruído; taxa adaptativa não vale (`ponytail: taxa fixa 33 ms; adaptar só se o custo aparecer`). Histerese: entra a 2 px, sai a 8 px do retângulo vivo; os números vêm da deriva medida de `getBounds()` (+1 a +3 DIP a 125%) mais a escala 1,025 do hover; é escolha de projeto [ASSUMED] e vira vetor de teste.
**Example:**
```javascript
// Bloco puro no index.html (marcadores // hover:inicio / hover:fim), testado por node:vm
const HOVER_ENTER_PX = 2;
const HOVER_LEAVE_PX = 8;
/** Devolve true/false; ponto ou retângulo inválidos devolvem false (fail-safe: não captura). */
function hoverStep({ inside, point, rect }) {
  if (!point || !rect || ![point.x, point.y, rect.left, rect.top, rect.right, rect.bottom].every(Number.isFinite)) return false;
  const margin = inside ? HOVER_LEAVE_PX : -HOVER_ENTER_PX; // dentro: fica até sair da borda +8; fora: só entra 2 px para dentro
  return point.x >= rect.left - margin && point.x <= rect.right + margin
    && point.y >= rect.top - margin && point.y <= rect.bottom + margin;
}
```
(`margin` negativo para entrar exige estar 2 px **dentro** do retângulo; o planejador ajusta o sinal se preferir entrar na borda; o teste de vetores fixa o comportamento.)

### Pattern 2: Esconder = estado de janela + fato por display + rearme
**What:** `isIslandVisible({ userHidden, fullscreen })` puro; o main aplica `island.hide()`/`island.showInactive()` por ilha. O gate recebe `windowVisible` (já existe) e `coveredByFullscreen` agora por display: `display ? fullscreenByDisplay.get(display.id) === true : true` (**fail-safe: display desconhecido conta como coberto**). `hide()` emite `'hide'` e `showInactive()` emite `'show'` em Electron 45.4.1/Windows [VERIFIED: probe p1, eventos `["show","hide","show","hide"]`, `isVisible()` = false escondida], e `main.js:212` já reage a `'show'` com `refresh('rearm')`. O atalho **não** reexibe uma ilha escondida por tela cheia (TELA-02). `hidden` não é persistido.
**Áudio:** com `autoplayPolicy: 'no-user-gesture-required'` um `AudioContext` numa janela escondida por `hide()` (`visibilityState: 'hidden'`) fica `running` e o `currentTime` avança [VERIFIED: probe p1]. Logo o `chime()` atual cobre TELA-02 sem mudança, desde que as ilhas sejam escondidas, nunca destruídas. Que o som seja **audível** é item humano (CHK-06).

### Pattern 3: Menu que desarma o gate
**What:** `contextmenu` no renderer (`preventDefault`) → `window.island.openMenu()` → `island:menu` (sem argumentos) → main monta o menu por constantes com os valores atuais marcados (`type: 'radio'`/`'checkbox'`) e chama `menu.popup({ window: island, callback })` **sem x/y** (o padrão é o cursor atual [CITED: electronjs.org/docs/latest/api/menu]). Em `menu-will-show` e em `menu-will-close` o main chama `refresh('rearm')` e segura o hover.
**Por que desarmar:** o menu abre sobre a pílula e pode cobrir Permitir/Negar; o clique que o dispensa pode, dependendo do Chromium, também chegar ao botão de baixo (não verificado, CHK-03). Desarmar ao abrir e ao fechar faz esse clique cair em botão desarmado (0,8 s no main + armamento do renderer).
**Medido:** numa janela `focusable:false`, `popup()` voltou em 9 ms, `menu-will-show` disparou, o menu apareceu como **segunda janela visível do mesmo processo** (`Chrome_WidgetWin_1`, estilos `0x08200088` = não ativável, topmost, tool window), o primeiro plano **não mudou** (continuou o Windows Terminal), o timer de 50 ms seguiu rodando, e `menu-will-close` só disparou no `closePopup` (não houve fechamento prematuro) [VERIFIED: probe p2]. Sem esse teste o fallback seria menu em HTML no palco; **não é necessário** a menos que CHK-03 falhe.

### Pattern 4: Preferência como esquema + sanitize + funil único
**What:** `PREFERENCE_SCHEMA` em `state.js` (chaves: `theme`, `shape`, `animationStyle`, `animationSpeed` da Fase 3, mais `expandOn` `hover|click`, `pinExpanded` bool, `opacity` ∈ {1, 0.85, 0.7, 0.55}, `anchor` ∈ 6 valores, `islandMode` `perDisplay|primary|cursor`, `shortcut` string, `version` int). `sanitizePreferences(raw)` itera **só as chaves do esquema** (imune a `__proto__`/chave extra), devolve sempre objeto completo, valor inválido vira o padrão da chave, nunca lança. `applyPreference(key, value)` no main: sanitiza → grava (`.tmp` + `renameSync`, o padrão de `writeDecision`) → efeitos (reposicionar, `setOpacity`, `syncIslands`, atalho) → `refresh('rearm')` (qualquer mudança que mova botões rearma, SEG-02). Arquivo corrompido: `renameSync` para `.bad` e padrões; teto de tamanho na leitura (ex.: 64 KB).

### Pattern 5: Sensor nativo com dados puros
**What:** `fullscreen.js` expõe `probe()` → `{ foreground: { hwnd, className, pid, exStyle, visible, cloaked, minimized, clientRect, monitorRect } | null }` e nunca lança. `nextFullscreen(prev, probe, ownPid, displaysPhysical)` (puro, em `state.js`) devolve `Map<display.id, hwnd>`. Regras:
1. Mapear monitor→display por **igualdade do retângulo físico**: `rcMonitor` de `GetMonitorInfoW` é igual a `screen.dipToScreenRect(null, display.bounds)` nos dois monitores [VERIFIED: probe p5, `monitorMatchesDisplay: true` ×2]. Sem matemática de escala.
2. Cobre = retângulo **cliente** (não o da janela) cobre o monitor com tolerância 1 px. Uma janela do tamanho do monitor dá cliente = monitor exatamente a 100% e a 125% (`coversMonitorTol0: true` ×2) [VERIFIED: p5]; o Terminal maximizado a 100% **não** cobre (cliente 18..2542 × 97..1002 contra 0..2560 × 0..1080) [VERIFIED: p1].
3. Ignorar: PID próprio, classes `Progman`/`WorkerW`/`Shell_TrayWnd`/`Shell_SecondaryTrayWnd`, invisível, minimizada, *cloaked* (`DwmGetWindowAttribute`, atributo 14), `WS_EX_TRANSPARENT`.
4. Lembrar o HWND coberto por monitor: com o foco em outro monitor, a ilha do monitor coberto continua escondida enquanto aquele HWND continuar visível/cobrindo; solta quando o primeiro plano está naquele monitor e não é tela cheia. (Evita a ilha reaparecer sobre um vídeo quando o usuário clica no terminal do outro monitor. `ponytail: sem EnumWindows; janela em tela cheia totalmente coberta por outra maximizada no mesmo monitor continua "lembrada" até o foco voltar a ela ou o HWND sair`.)

**Custo:** o ciclo completo (`GetForegroundWindow` + `windowInfo`) = **7,8 µs**; carregar o `koffi` = 8,4 ms e **+5,0 a +5,1 MB** de private working set do app inteiro (3 execuções) [VERIFIED: probes p1, p6]. A 2 Hz é desprezível.

### Pattern 6: Âncora e modos de ilha
**What:** `anchorPosition(anchor, workArea, stage, gaps)` pura. Seis âncoras; valores do mod: 16 px das laterais, 40 px de baixo (`WINDHAWK-MOD.md:49`, comentário MIT de origem). O alinhamento horizontal/vertical da pílula **dentro do palco** muda com a âncora (`data-anchor` no `<html>`: `justify-content` start/center/end, `align-items` flex-start/flex-end e `padding-bottom` em vez de `padding-top` embaixo, `transform-origin` pela borda de ancoragem); sem isso uma pílula compacta ancorada no canto ficaria ~160 px longe da borda (palco 520, pílula ~200 centrada). Mudar a âncora **zera** os deslocamentos salvos (`positions.json` é relativo à âncora antiga). O deslocamento continua sendo o que o arraste produz; o arraste já fica preso ao monitor da própria ilha porque `moveIsland` clampa na `workArea` do display dela (`displayOf`) e nenhuma ilha troca de display.
`islandDisplays(mode, displays, primaryId, cursorDisplayId)` pura escolhe os displays com ilha. No modo `cursor` a ilha só muda de monitor com **nenhum pedido na tela** (trocar de monitor com pedido rearma e reposiciona botões). Mover por `setBounds` entre os monitores 100%↔125% manteve o tamanho físico correto (650×513 e 520×410), com 1 `setBounds`, nos dois sentidos [VERIFIED: probe p5, 1 tentativa por sentido]; recriar a janela é o fallback se aparecer o crescimento de ~25% relatado em issues.

### Anti-Patterns to Avoid
- **Manter `forward: true` como "complemento":** adiciona o modo de falha de UIPI sem benefício; polling já cobre. Remover.
- **Hover por `mouseenter`/`mouseleave` do DOM junto do cursor do main:** duas fontes de verdade piscam. Cursor do main é a única; `pointermove` dos botões (`lastPointerMoveAt`) fica porque é do armamento.
- **Canal genérico `island:set-pref`:** viola SEG-08/I9. O renderer só envia `island:menu` sem argumentos.
- **Hotkey que força exibir sobre tela cheia:** contradiz TELA-02.
- **Destruir ilhas para "esconder":** quebra o som (TELA-02) e o `'show'` que rearma.
- **`require('koffi')` no topo de `window.js` ou `state.js`:** hooks e testes (Node puro) não podem depender dele.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Interpretar o atalho | Parser de teclas | `globalShortcut.register(accelerator)` dentro de `try/catch` | Lança com string inválida (`Ctrl+Banana`) e devolve `false` se tomado (medidos) |
| Menu de contexto | Menu em HTML no palco | `Menu.buildFromTemplate` + `popup({ window })` | Funciona em janela não focável (medido); HTML só como fallback |
| Mapear monitor Win32 ↔ `display.id` | Conta de escala/DPI | `screen.dipToScreenRect(null, display.bounds)` e igualdade com `rcMonitor` | Idêntico nos dois monitores (medido); a conta é onde o 125% erra |
| Sensor de tela cheia | PowerShell em loop (~0,45 s/chamada) ou residente (28 MB) | `koffi` em processo | 7,8 µs por sondagem |
| Gravação segura do JSON | `writeFileSync` direto | `.tmp` + `renameSync` (padrão de `writeDecision`) | Queda no meio zera todas as preferências (P17) |
| Transparência | Reimplementar alfa em CSS | `win.setOpacity(effectiveOpacity(...))` | Mistura de verdade (pixel medido) e é main-owned |
| Validação de preferência | `Object.assign` do arquivo | Esquema fechado por chave | `__proto__`, tipos errados, `animationSpeed: 0`, `opacity: 0` (ilha invisível) |

**Key insight:** o risco desta fase é de gate (botão armado que o usuário não viu), não de tecnologia. Menu, esconder, reexibir, mudança de tema/âncora e troca de monitor movem ou revelam botões: todos passam pelo mesmo `refresh('rearm')`.

## Common Pitfalls

### Pitfall 1: Âncora de baixo e a deriva de `getBounds()` a 125%
**What goes wrong:** a janela criada 520×410 no monitor a 125% nasce 520×**416**; depois de `setBounds` fica 520×**412**; `setPosition` a deixa 521×413 ou 441×327 (deriva em largura também) [VERIFIED: probe p1, `afterCreate`/`afterSetBounds`/`afterSetPosition`]. Encostada embaixo, `y + height` passa de `workArea.y + height` em 2 a 3 DIP e `isWithinWorkArea` (tolerância 2) recusa por `outside-visible-area`.
**Why it happens:** conversão DIP→físico com arredondamento por borda; 410×1,25 = 512,5 px.
**How to avoid:** (a) depois de criar, chamar `moveIsland` (`setBounds`) uma vez, e nunca `setPosition`; (b) âncora de baixo com 40 px de folga (valor do mod) deixa a janela dentro da área útil; (c) o arraste que encosta embaixo usa o clamp que existe; (d) acrescentar vetor em `isWithinWorkArea` com altura +2 e +3 na borda de baixo e decidir tolerância 2 ou 4 (recusar por engano é o lado seguro).
**Warning signs:** ilha ancorada embaixo no monitor a 125% recusando todo Permitir.

### Pitfall 2: Menu aberto sobre botão armado
**What goes wrong:** clique que fecha o menu cai em Permitir.
**How to avoid:** Pattern 3 (rearme em `menu-will-show` e `menu-will-close`). Se CHK-03 mostrar que o clique atravessa, acrescentar `!menuOpen` ao fato `windowVisible` (trava de texto de `gate.test.js:309` muda de propósito).

### Pitfall 3: `Ctrl+Alt+C` parece livre mas é AltGr+C
**What goes wrong:** `register('Control+Alt+C')` devolve `true` (ninguém tem) e o atalho passa a engolir o `¢` do ABNT2.
**Why:** no ABNT2 do autor (HKL `0x04160416`), Ctrl+Alt+C produz U+00A2; só C, E, Q, W produzem caractere com Ctrl+Alt (E=°, Q=/, W=?), e **nenhuma** letra produz com Ctrl+Alt+Shift [VERIFIED: probe layout.ps1 via `ToUnicodeEx`, layouts `00010416`, `00000416`, `00000409`].
**How to avoid:** padrão `Control+Alt+Shift+C`. Que o `RegisterHotKey` dispare mesmo com AltGr é conhecimento do Windows, **não verificado aqui** (injetar tecla é proibido): CHK-02 com script pronto.

### Pitfall 4: `register()` devolve `false` em silêncio, `throw` com string ruim
**What goes wrong:** dois processos: o segundo recebe `register: false` e `isRegistered: false`, sem erro [VERIFIED: probe p3 a/b]; `Ctrl+Banana` **lança** `conversion failure` [VERIFIED: p3].
**How to avoid:** validar o acelerador salvo com `try/catch`; guardar `shortcutStatus` (`ok`/`unavailable`/`invalid`) para o menu; **sem retry em laço**; `unregisterAll()` em `will-quit`; só depois de `app.whenReady()` [CITED: electronjs.org/docs/latest/api/global-shortcut].

### Pitfall 5: `pnpm install` falha com exit 1 por causa do `koffi`
**What goes wrong:** sem entrada em `allowBuilds`, `pnpm 11.10.0` termina com `ERR_PNPM_IGNORED_BUILDS` e **exit 1**; o pacote é instalado, mas CI/`pnpm install` quebram [VERIFIED: sonda, `exit=1`]. Com `koffi: false` sai 0 e o binário vem do optionalDependency; com `koffi: true` roda `cnoke --prebuild` e também sai 0 (1,4 s, sem compilar) [VERIFIED].
**How to avoid:** `allowBuilds: { electron: true, koffi: false }` em `pnpm-workspace.yaml` (negar é o mais seguro: o script não é necessário). [CITED: pnpm.io/settings/build: "Packages not listed in `allowBuilds` are disallowed by default and are treated as unreviewed"; `strictDepBuilds` padrão `true`].

### Pitfall 6: Preferências em `~/.claude/island/` viram "sessão"
**What goes wrong:** `readSessions()` lê todo `*.json` da pasta; `preferences.json` entraria como sessão (descartada por `state` indefinido, mas com `contextPercent` lido para o nome `preferences`), e a poda de arquivos velhos da Fase 5 (SESS-07) poderia apagá-lo.
**How to avoid:** ver Open Question 1. Se ficar em `~/.claude/island/`, `readSessions` ignora `preferences.json` (teste) e a Fase 5 recebe a regra. Se for `userData`, a D-16 da Fase 3 é migrada (ler os dois, escrever só no novo).

### Pitfall 7: Mudar a âncora com deslocamentos antigos
**What goes wrong:** `positions.json` guarda `bounds - posiçãoPadrão` relativo ao topo central; trocar para canto inferior aplicaria um deslocamento sem sentido (ilha fora da área, o clamp a joga num canto aleatório).
**How to avoid:** zerar `savedOffsets` ao mudar a âncora; gravar `positions.json` com temp+rename (hoje não é atômico).

### Pitfall 8: Transparência com pedido na tela
**What goes wrong:** pedido chega com a janela a 55%.
**How to avoid:** `refresh` aplica `setOpacity(effectiveOpacity(pref, picked.permission !== null))` no mesmo passo que decide o pedido exibido, para toda ilha, e de novo no `'show'` e ao mudar preferência. Trava de texto no `gate.test.js` (como as de cola existentes). Janela-inteira inclui o texto: ver Open Question 5.

### Pitfall 9: DOM de hover antigo concorrendo com o novo
**What goes wrong:** `setHovering` chamado por `mouseenter` e pelo cursor do main faz a pílula piscar; `lostpointercapture` (`index.html:603-614`) recalcula hover pelo `clientX/Y`.
**How to avoid:** uma única entrada para `hovering`: o resultado de `hoverStep` (e o fim de arraste usa a última posição de `island:cursor`). Rodar e atualizar as travas do gate.

### Pitfall 10: Pílula que expande sob o cursor "arma" por movimento
**What goes wrong:** o `capture` liga em ≤ 1 tick; um clique já em curso para outra janela pode cair na pílula nova.
**How to avoid:** nada novo a fazer: o armamento (0,8 s no main, mola assentada e cursor parado no renderer) é independente de hover; só **não** pode haver caminho em que hover/capture/expandir "arme" ou desarme algo.

## Code Examples

### Sensor de tela cheia (verificado em Electron 45.4.1, `koffi` 3.3.8)
```javascript
// Source: scratchpad/fase4/koffi-probe/win32.js (probes p1, p2, p5)
const koffi = require('koffi'); // só dentro de if (process.platform === 'win32') e try/catch
const user32 = koffi.load('user32.dll');
const dwmapi = koffi.load('dwmapi.dll');
const RECT = koffi.struct('RECT', { left: 'long', top: 'long', right: 'long', bottom: 'long' });
const POINT = koffi.struct('POINT', { x: 'long', y: 'long' });
const MONITORINFO = koffi.struct('MONITORINFO', { cbSize: 'uint32', rcMonitor: RECT, rcWork: RECT, dwFlags: 'uint32' });
const GetForegroundWindow = user32.func('void* __stdcall GetForegroundWindow()');
const GetClientRect = user32.func('bool __stdcall GetClientRect(void* hwnd, _Out_ RECT* rect)');
const ClientToScreen = user32.func('bool __stdcall ClientToScreen(void* hwnd, _Inout_ POINT* point)');
const MonitorFromWindow = user32.func('void* __stdcall MonitorFromWindow(void* hwnd, uint32 flags)');
const GetMonitorInfoW = user32.func('bool __stdcall GetMonitorInfoW(void* monitor, _Inout_ MONITORINFO* info)');
const GetClassNameW = user32.func('int __stdcall GetClassNameW(void* hwnd, _Out_ uint8_t* buffer, int max)');
const GetWindowThreadProcessId = user32.func('uint32 __stdcall GetWindowThreadProcessId(void* hwnd, _Out_ uint32* pid)');
const DwmGetWindowAttribute = dwmapi.func('long __stdcall DwmGetWindowAttribute(void* hwnd, uint32 attribute, _Out_ int32* value, uint32 size)');
// MONITOR_DEFAULTTONEAREST = 2; DWMWA_CLOAKED = 14 (usados nas sondas, resultados coerentes)
const hwnd = GetForegroundWindow();
const client = {}; GetClientRect(hwnd, client);
const origin = { x: 0, y: 0 }; ClientToScreen(hwnd, origin);
const info = { cbSize: 40 }; GetMonitorInfoW(MonitorFromWindow(hwnd, 2), info);
// cobre: origin.x <= info.rcMonitor.left + 1 && origin.x + client.right >= info.rcMonitor.right - 1 && (idem em y)
```

### Atalho e menu (medidos)
```javascript
// Source: probes p2/p3. Padrão: sem retry em laço, status guardado para o menu.
function registerToggleShortcut(accelerator, onToggle) {
  try {
    return globalShortcut.register(accelerator, onToggle) ? 'ok' : 'unavailable'; // false = tomado por outro processo
  } catch {
    return 'invalid'; // string inválida lança (ex.: 'Ctrl+Banana')
  }
}
// menu.popup({ window: island, callback }) sem x/y; em 'menu-will-show' e 'menu-will-close': refresh('rearm')
```

### Fluxo dos fatos da janela no gate (substitui o `false` fixo)
```javascript
// main.js, dentro de island:decide (a trava gate.test.js:310 muda de propósito, no mesmo commit)
coveredByFullscreen: display ? fullscreenByDisplay.has(display.id) : true,
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `setIgnoreMouseEvents(true, { forward: true })` + `mouseenter` | Polling do cursor no main + hit-test no renderer, sem `forward` | Esta fase | Sai o modo de falha de UIPI; some o `CAN_CLICK_THROUGH` para Windows/macOS |
| Janela por monitor sempre visível acima de tela cheia (`screen-saver`) | Escondida por monitor em tela cheia (Windows) | Esta fase | TELA-01/02; o `screen-saver` fica para os demais casos |
| `coveredByFullscreen: false` fixo | Fato por display vindo do sensor | Esta fase | Fecha o `ponytail` de `main.js:321` |
| `positions.json` com `writeFileSync` | temp + rename | Esta fase | Mesmo padrão de `writeDecision` |

**Deprecated/outdated:** `island:hover` (substituído por `island:capture`); `pill.addEventListener('mouseenter'/'mouseleave'…)` como fonte de hover.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `RegisterHotKey` com Ctrl+Alt dispara com AltGr+C e engole `¢` | Pitfall 3 | Se não disparar, Ctrl+Alt+C seria seguro; padrão `Control+Alt+Shift+C` continua válido (CHK-02) |
| A2 | `GetCursorPos`/`getCursorScreenPoint` não sofre UIPI com janela elevada em foco | Pattern 1 | Hover morre com terminal elevado; fallback `forward` não resolve; CHK-01. A doc de `GetCursorPos` só exige acesso à estação de janelas e desktop de entrada [CITED: learn.microsoft.com GetCursorPos], sem citar integridade |
| A3 | `wheel` e clique reais chegam à ilha não ativável com terminal elevado em foco (UIPI barra mensagens sintéticas, não entrada de hardware) | HOV-02 | Roda não funciona sobre a pílula nesse cenário (Fase 5 depende) |
| A4 | `contextmenu` chega ao DOM da janela `focusable:false` com `capture` ligado | Pattern 3 | Sem menu; fallback: detectar botão direito por outro caminho |
| A5 | O clique que dispensa o menu pode atravessar para a janela de baixo | Pitfall 2 | Se não atravessa, o rearme é redundante (inofensivo) |
| A6 | `setOpacity` tem efeito só em Windows/macOS; no Linux é no-op | PREF-06 | Linux sem transparência (aceito: melhor esforço) |
| A7 | A Fase 3 será mesclada com o contrato de `03-CONTEXT.md`/`03-UI-SPEC.md` (palco 520×410, retângulo vivo, prefs no estado) | todo o documento | Os planos da Fase 4 precisam ser revistos contra a `main` pós-Fase 3 (checklist de pré-voo abaixo) |
| A8 | Histerese 2/8 px é adequada | Pattern 1 | Pisca na borda ou tarda a soltar; ajusta-se pelo vetor, constante isolada |
| A9 | `setBounds` entre monitores de DPI diferente é estável além de 1 tentativa por sentido | PREF-05 | Janela cresce/encolhe; fallback recriar a janela |
| A10 | Janela escondida por muito tempo (≥10 min) ainda toca o `chime()` audivelmente | Pattern 2 | TELA-02 sem som; CHK-06 |
| A11 | Regra "lembrar HWND coberto" é o comportamento desejado quando o foco vai para o outro monitor | Pattern 5 | Ilha reaparece sobre o vídeo (se for só foreground) ou fica escondida demais; decisão de produto (Open Question 3) |
| A12 | Menu aberto não deve ficar acessível por teclado (a ilha é só de mouse) | Pattern 3 | Acessibilidade limitada, igual à ilha de hoje |

## Open Questions

1. **Local do `preferences.json` (conflito com a D-16 da Fase 3)**
   - What we know: D-16 manda ler `~/.claude/island/preferences.json`; `readSessions` varre `*.json` dessa pasta; a pesquisa de arquitetura do projeto previa `userData` (ao lado de `positions.json`).
   - What's unclear: se o autor quer o arquivo no mesmo lugar do barramento.
   - Recommendation: **honrar a D-16** (decisão travada de fase anterior, evita migração) e, no mesmo plano, fazer `readSessions` ignorar `preferences.json` com teste e deixar a regra registrada para o SESS-07 (Fase 5). Alternativa aceitável: `userData`, lendo o caminho antigo uma vez. Decidir no início do plan-phase.
2. **Padrão do atalho:** `Control+Alt+Shift+C` (recomendado) ou `Control+Shift+Alt+F12` (nenhuma tecla de função gera caractere; mais difícil de digitar). Só a pessoa escolhe; nos dois casos `shortcut` é editável no JSON (sem UI de captura de tecla).
3. **Regra de tela cheia:** só primeiro plano (simples, como o mod) ou primeiro plano + HWND lembrado (recomendado, Pattern 5). E: o atalho de mostrar deve vencer a tela cheia? Recomendação: não.
4. **Modo "monitor do cursor":** recomendado mover a ilha só sem pedido na tela. Confirmar.
5. **Transparência:** janela inteira (`setOpacity`, medido, texto também translúcido) ou só o preenchimento. O mod lista "Preenchimento: cor de fundo × opacidade (35–100%)" na descrição do material e "Transparency (100/85/70/55%)" no menu; não confirmei se o item do menu age no preenchimento ou na janela. Recomendação: `setOpacity` (menor diff, dono único do fato de pedido); trocar se o autor achar o texto fraco a 55%.
6. **"Fixar aberta" em `done`:** hoje `done` não expande no hover porque o botão "Abrir" precisa ficar parado (`index.html:365-366`). Recomendação: o pin segue a mesma regra (não expande `done`). Confirmar.
7. **Itens que exigem uma pessoa na tela:** CHK-01 a CHK-08 abaixo.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Electron | tudo | ✓ | 45.4.1 (`node_modules`) | — |
| Node (sistema) | testes | ✓ | 26.4.0 | — |
| pnpm | `koffi`, lockfile | ✓ | 11.10.0 | — |
| `koffi` + `@koromix/koffi-win32-x64` | TELA-01 | ✓ (instalado só na sonda, fora do repo) | 3.3.8 | helper PowerShell residente (28 MB) ou omitir TELA-01 |
| Windows PowerShell 5.1 | scripts de apoio/medição | ✓ | 5.1 | — |
| Monitores | verificação 100%/125% | ✓ | principal 2560×1080 a 100%, secundário 1920×1080 a 125% (DIP 1536×864 em x=-1536) | — |
| komorebi, whkd, Windhawk | convivência | ✓ rodando | — | — |
| Terminal elevado / Gerenciador de Tarefas | CHK-01, CHK-07 | ✓ (precisa UAC, por pessoa) | — | — |
| Tela cheia real (vídeo F11, jogo) | CHK-05 | ✓ por pessoa | — | — |

**Missing dependencies with no fallback:** nenhuma.
**Missing dependencies with fallback:** `koffi` ainda não está no repositório (instalar na execução, depois do checkpoint SUS).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` + `node:assert/strict` (Node 26.4.0) |
| Config file | nenhum (`package.json`: `"test": "node --test"`) |
| Quick run command | `node --test gate.test.js` (e o arquivo novo da tarefa) |
| Full suite command | `pnpm test` (baseline: 194 passam, 0 falham) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HOV-01 | `hoverStep`: histerese, borda ±1–3 px, retângulo escalado, entrada inválida | unit (vm sobre o bloco do `index.html`) | `node --test hover.test.js` | ❌ Wave 0 |
| HOV-02 | canais travados: `island:capture`, `island:cursor`, `island:menu`; sem `forward`; `handlers.length`; remetente conferido | texto | `node --test gate.test.js` | ✅ (atualizar travas) |
| HOV-03 | `expandOn` e `pinExpanded` na regra de expansão (função pura) | unit | `node --test island.test.js` | ✅ (acrescentar) |
| HOV-04 | arraste mantém `capture`; `dblclick`/botões não mudam; gate segue verde | texto + suíte do gate | `node --test gate.test.js` | ✅ |
| PREF-01 | itens do menu e valores vêm de constantes; `Menu.popup({ window })`; sem canal de gravação | texto | `node --test gate.test.js` | ✅ |
| PREF-02 | `sanitizePreferences`: arquivo vazio/truncado/tipos errados/formato da Fase 3/`__proto__`/`opacity:0`/`animationSpeed:0`; leitura + temp/rename em pasta temporária | unit | `node --test prefs.test.js` | ❌ Wave 0 |
| PREF-03 | status do atalho (`ok`/`unavailable`/`invalid`), default sem conflito AltGr (lista de letras com caractere) | unit | `node --test prefs.test.js` | ❌ Wave 0 |
| PREF-04 | `anchorPosition` das 6 âncoras, clamp, bottom a 125%, zerar offsets | unit | `node --test island.test.js` | ✅ |
| PREF-05 | `islandDisplays` por modo, cursor só sem pedido | unit | `node --test island.test.js` | ✅ |
| PREF-06 | `effectiveOpacity` (vetores existentes) + trava de que `refresh` aplica no mesmo passo do pedido | unit + texto | `node --test gate.test.js` | ✅ |
| TELA-01 | `nextFullscreen`: cobre/não cobre, desktop/ilha ignoradas, HWND lembrado, soltar | unit | `node --test island.test.js` | ✅ |
| TELA-02 | `acceptDecision` recusa com `window-hidden`/`covered-by-fullscreen`; reexibir rearma (já há vetor/trava) + trava de que o fato vem do main por display | vetores + texto | `node --test gate.test.js` | ✅ |

### Sampling Rate
- **Per task commit:** `node --test gate.test.js` + o arquivo de teste da tarefa
- **Per wave merge:** `pnpm test`
- **Phase gate:** `pnpm test` verde (≥194 + novos) antes de `/gsd-verify-work`; checklist humano CHK-01..08 no PR

### Wave 0 Gaps
- [ ] `hover.test.js`: extração do bloco `hover:inicio/fim` (padrão de `gate.test.js`, `vm` vazio)
- [ ] `prefs.test.js`: `sanitizePreferences`, persistência em `os.tmpdir()`, status do atalho
- [ ] vetores novos em `fixtures/permission-vectors.json` só para o que toca o gate (`isWithinWorkArea` 125% embaixo); não mudar vetores existentes
- [ ] atualizar de propósito, no mesmo commit de cada mudança: `RENDERER_CHANNELS` e a mensagem "sete canais" (`gate.test.js:224-232`), contagem de handlers (`:249`), `['coveredByFullscreen', 'false']` (`:310`), trava do hover/`mouseenter` se houver
- [ ] sem instalar framework novo

**Verificação manual (checklist de PR, humano):**
- **CHK-01 UIPI/hover:** `node_modules\electron\dist\electron.exe <scratch>\koffi-probe\human-checks.js --mode=hover --user-data-dir=<tmp>` (pílula de teste laranja, 40 s): foque um terminal comum e passe o cursor; depois o Gerenciador de Tarefas (elevado) e repita. O JSON `human-hover-out.json` compara `domMovesForward` (caminho atual) com `pollHitsAcumulados` (caminho novo). Esperado: o segundo continua contando com o elevado em foco.
- **CHK-02 AltGr+C:** `--mode=hotkey` (20 s): digite AltGr+C (e Ctrl+Alt+C com a mão esquerda). `hits > 0` confirma A1.
- **CHK-03 menu:** botão direito na pílula: abre perto do cursor? clicar fora fecha? o clique que fecha atravessa para a janela de baixo? o Terminal mantém o cursor de texto? escolher um item funciona sem tirar o foco?
- **CHK-04 125%:** pílula no monitor secundário: sem piscar na borda, arrastar, duplo clique, botões, âncora de baixo sem recusa.
- **CHK-05 tela cheia:** F11 em vídeo no monitor A: ilha de A some, a de B não; focar o terminal de B mantém A escondida; sair volta; com pedido pendente só toca o som.
- **CHK-06 som escondido:** esconder pelo atalho por ~10 min, disparar pedido, ouvir.
- **CHK-07 roda:** roda sobre a pílula com o Gerenciador de Tarefas em foco (insumo da Fase 5).
- **CHK-08 komorebi:** esconder/mostrar várias vezes: a ilha não é retilada (automatizado: 4 ciclos, retângulo físico idêntico nos dois monitores).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | não | — |
| V3 Session Management | não | — |
| V4 Access Control | sim | `islandOf(event)` confere remetente em todo `ipcMain.on`; canais travados por teste; decisão só pelo `acceptDecision` |
| V5 Input Validation | sim | `sanitizePreferences` por chave; acelerador validado com `try/catch`; IPC `capture` só `boolean`, `menu` sem argumentos; tamanho máximo do arquivo |
| V6 Cryptography | não | — |
| V10 Malicious Code / dependências | sim | `koffi` fixo exato, SUS com checkpoint humano, `allowBuilds: koffi: false`, `require` só no Windows e em `try/catch` |
| V12 Files | sim | `.tmp` + `renameSync`; caminhos só de constantes; `.bad` ao corromper |
| V14 Configuration | sim | `SECURE_WEB_PREFERENCES` e CSP inalterados; `contextIsolation`/`sandbox`; renderer sem `require` |

### Known Threat Patterns for Electron overlay com gate de permissão

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Aprovar sem ver por botão armado sob menu/ilha reexibida | Spoofing/Tampering | `refresh('rearm')` em show/restore/menu-will-show/menu-will-close/prefs/monitor; `windowVisible` e `coveredByFullscreen` do main |
| `preferences.json` editado (`opacity: 0`, `animationSpeed: 0`, `shortcut` hostil, `__proto__`) | Tampering | esquema fechado, padrão por chave, nada de `Object.assign` |
| Renderer comprometido liga `capture` para engolir cliques | Denial of Service | efeito limitado à área da janela; não toca o gate; `capture(false)` ignorado só no arraste |
| Renderer pede "menu" em loop | DoS | um menu por vez (`menuOpen`), descartar pedidos enquanto aberto |
| Fato "tela cheia" vindo do renderer | Tampering | só o main calcula, por display; display desconhecido = coberto (fail-safe) |
| Hotkey exibe ilha sobre jogo com botão armado | Spoofing | reexibir rearma; hotkey não vence tela cheia |
| Dependência nativa maliciosa (`koffi`) | Supply chain | checkpoint humano, versão exata, sem scripts de build (`false`), carga só no Windows, binário vem de optionalDependency oficial do mesmo repositório |
| Hook quebrando por `require` novo | DoS da sessão | `fullscreen.js` separado; `window.js`/`state.js` sem `koffi` |

## Project Constraints (from CLAUDE.md)

Fonte: `.claude/CLAUDE.md` do projeto e `~/.claude/CLAUDE.md` (SDD-WORKFLOW). Tratadas com a mesma autoridade das decisões travadas.
- Plataformas: Windows, macOS, Linux; recurso só de Windows é aceitável como opcional, **nunca como base** (TELA-01 atrás de `process.platform === 'win32'`).
- Segurança: aprovação é fronteira de confiança; nenhuma interação (hover, scroll, troca) pode permitir aprovar o que não foi visto.
- Hooks nunca quebram nem atrasam a sessão (falha silenciosa, saída 0): nada de `koffi` em `hook.js`/`permission-hook.js`/`window.js`.
- Dependências: menor diff correto; só `koffi` (justificada, medida); gerenciador pnpm.
- Testes: `node:test`; lógica pura em `state.js`; função pura nunca lança e devolve `null`/padrão em entrada inválida; `now` entra por parâmetro.
- Estilo: CommonJS, 2 espaços, aspas simples, ponto e vírgula, vírgula final, constantes `UPPER_SNAKE_CASE` com unidade (`_MS`, `_PX`), comentários em pt-BR explicando o porquê, `ponytail:` para atalhos com teto conhecido, `catch {}` só com comentário do fallback.
- Gravação entre processos: `.tmp` + rename.
- Processo: commits semânticos em pt-br sem `Co-Authored-By`; branch protegida `main` (tudo por PR); PR em pt-br; mod portado exige aviso MIT (`THIRD_PARTY_NOTICES.md`): as constantes de âncora (16/40 px) e os degraus de transparência levam o comentário de origem.
- Fluxo GSD: nenhuma edição fora de um comando GSD.

## Pré-voo para o plan-phase (a Fase 3 não está na `main`)

1. Reler `main` depois da Fase 3: `WINDOW_SIZE`, `HORIZONTAL_SLACK`, `savedPosition`/`moveIsland`/`defaultIslandPosition`, o nome do campo de preferências no `island:state`, o nome e o local do normalizador, `springsAtRest`, `--stage-top`, `transform-origin`.
2. Confirmar se a Fase 3 gravou `preferences.json` em `~/.claude/island/` (Open Question 1).
3. As ondas da Fase 4 mexem em `main.js`, `index.html` e `gate.test.js` ao mesmo tempo: planos **sequenciais** (precedente da Fase 2).
4. Sugestão de ordem (não vinculante): W0 funções puras + testes + `sanitizePreferences`; W1 hover/capture e remoção do DOM hover; W2 preferências + menu + atalho + âncora/modos; W3 visibilidade + `fullscreen.js` + `koffi` (depois do checkpoint SUS); checkpoint humano único no fim.
5. `README`: documentar menu, atalho (e por que não é Ctrl+Alt+C) e a exigência de "Rolar janelas inativas" fica para a Fase 5.

## Sources

### Primary (HIGH confidence)
- Sondas executadas nesta sessão, em `C:/Users/marce/AppData/Local/Temp/claude/389cc417882bb777/f3adb4b2-0b4e-4fd2-a948-65a62e363da8/scratchpad/fase4/koffi-probe/` (`p1.js` bounds/koffi/áudio/eventos, `p2.js` menu, `p3.js` atalho, `p4.js` opacidade por pixel, `p5.js` monitor/cobertura/mover, `p6.js` memória, `p7.js` hide/show com komorebi, `layout.ps1` teclado, `psmem.ps1`) e `human-checks.js` (testado só com `--selftest`)
- Código lido: `main.js`, `index.html`, `preload.js`, `state.js`, `window.js`, `gate.test.js`, `fixtures/permission-vectors.json`, `package.json`, `pnpm-workspace.yaml`
- Documentação do projeto: `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, `PROJECT.md`, `research/{ARCHITECTURE,SUMMARY,PITFALLS,STACK,WINDHAWK-MOD}.md`, fase 3 em `claude-island-fase2/.planning/phases/03-*/`
- https://www.electronjs.org/docs/latest/api/browser-window (`setIgnoreMouseEvents` forward/UIPI, `showInactive`, `hide`, eventos)
- https://www.electronjs.org/docs/latest/api/menu (`popup`, `closePopup`, eventos)
- https://www.electronjs.org/docs/latest/api/global-shortcut (`register` falha em silêncio, só após `ready`)
- https://www.electronjs.org/docs/latest/api/screen (`getCursorScreenPoint` em DIP, `dipToScreenRect`)
- https://pnpm.io/settings/build (`allowBuilds`, `strictDepBuilds`)
- https://learn.microsoft.com/en-us/windows/win32/api/shellapi/nf-shellapi-shqueryusernotificationstate; https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getcursorpos

### Secondary (MEDIUM confidence)
- https://koffi.dev/start (nome do pacote e instalação); `npm view koffi` (versões, datas, `scripts`); `gsd-tools package-legitimacy check`

### Tertiary (LOW confidence)
- Comportamentos do Windows não verificados aqui (AltGr = Ctrl+Alt no `RegisterHotKey`, UIPI e `GetCursorPos`, roda com foco elevado, dispensa do menu): marcados `[ASSUMED]` e levados a CHK-01/02/03/07

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, tudo carregado e medido no Electron 45.4.1 do projeto; `koffi` SUS por recência
- Architecture: HIGH nos itens medidos; MEDIUM no encaixe com a Fase 3 (lida em worktree)
- Pitfalls: HIGH para 125%, atalho, `allowBuilds`, menu; LOW para UIPI e dispensa do menu (precisam de pessoa)

**Research date:** 2026-11-21
**Valid until:** 2026-12-05 (14 dias: Electron e `koffi` soltam versões a cada 1 a 2 semanas; reconfirmar `koffi@3.3.8` antes de instalar)
