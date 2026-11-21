# Phase 6: Convivência com a ilha do sistema - Research

**Researched:** 2026-11-21
**Domain:** encaixe lateral de uma segunda ilha (Electron 45.4.1) ao lado da ilha do mod "Dynamic Island for Windows" (Windhawk 1.4.0), z-order entre dois overlays `TOPMOST` no Windows 11, e registro das demais integrações (toast do Windows, apps de notch no macOS) com proposta de API ao autor do mod
**Confidence:** HIGH para classe, estilos, geometria-por-código e para "o Electron não reafirma o topo sozinho" (lidos no código do mod, medidos nesta máquina, nesta sessão); MEDIUM para a pesquisa de mercado (páginas públicas lidas, algumas por resumo); **LOW (não medido) para tudo que exige as duas ilhas visíveis ao mesmo tempo**: a ilha do mod está **escondida** (`ManuallyHidden = 1`) e eu não podia, nem devia, fazê-la aparecer. Esses itens estão em "Itens que exigem uma pessoa na tela", com o comando de captura pronto.

<user_constraints>
## User Constraints (from CONTEXT.md)

Não existe `06-CONTEXT.md` (o autor pulou o discuss-phase). As restrições abaixo vêm do orquestrador, do `ROADMAP.md` e dos documentos do projeto, e são tratadas como travadas.

### Locked Decisions
- Base = Electron 45.4.1 (decisão da Fase 1, `.planning/PROJECT.md` Key Decisions). Cores de estado fixas; temas só trocam fundo/superfície.
- Fase 6 depende da Fase 4 (âncora, deslocamento e esconder), é a última e é cortável: se for cortada, âncora e deslocamento manuais da Fase 4 são o plano B. Modo `mvp`.
- CONV-01: com a ilha do Windhawk ativa a nossa pode se encaixar como segunda bolha ao lado dela, por um deslocamento configurável, **expandindo para fora sem cobri-la**.
- CONV-02: a ilha **nunca** disputa o "sempre no topo" com outros overlays por timer. Critério de sucesso: em 5 minutos de convivência medidos nenhuma das duas some atrás da outra e a nossa nunca reafirma o topo por timer.
- CONV-03: proposta de API para conteúdo externo **aberta como issue** no repositório do autor do mod; toast do Windows e apps de notch no macOS **registrados em documento** com o que foi verificado de cada um. (Abrir a issue é ação externa: só com o "vai" explícito do autor deste repositório.)
- CONV-04 (feito na Fase 2): `THIRD_PARTY_NOTICES.md` credita o mod. Constantes portadas (16/40 px de âncora) levam o comentário de origem.
- Invariantes do gate (toda fase): hover, scroll, nudge, tema, opacidade, esconder e **posição/encaixe** nunca habilitam nem disparam uma decisão; rodar a suíte do gate (`node:test`, `fixtures/permission-vectors.json`) antes de fechar.
- Restrições de `CLAUDE.md` (seção própria abaixo).

### Claude's Discretion
- Forma do encaixe (âncora nova × deslocamento livre), valores padrão, formato do script de medição, local e estrutura do documento de integrações, texto da issue, estrutura de ondas e planos.

### Deferred Ideas (OUT OF SCOPE)
- Integração real (conteúdo nosso desenhado dentro da ilha do mod) = INTG-01 (v2), só se o autor do mod aceitar uma API. Convivência ativa com apps de notch no macOS = INTG-02; teste de convivência com o NotchNook aprovando o mesmo `PermissionRequest` = INTG-03.
- Fork/módulo C++ dentro do Windhawk, gambiarras (`ProgressPercent`, sessão de mídia falsa), blur/acrílico, macOS/Linux (todos Out of Scope no `REQUIREMENTS.md`).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONV-01 | Segunda bolha ao lado da ilha do mod, por deslocamento configurável, expandindo para fora sem cobri-la | Geometria do mod medida e conferida com o código (estágio 936×364 em y=38, pílula a partir de y=60, expandida 380×184); âncora "ao lado" com borda interna fixa e crescimento para fora (Pattern 1); distância padrão da borda interna = 210 px do centro (A1, a confirmar na tela) |
| CONV-02 | Nunca disputar o topo por timer | Medido: o Electron **não** reafirma o topo sozinho (2 sondas + 317 s da ilha real); só `setAlwaysOnTop(true…)` repetido e `moveTop()` sobem a janela; `setBounds/setSize/setIgnoreMouseEvents/setOpacity/hide/show/showInactive/setVisibleOnAllWorkspaces` não mexem no z. O `EnsureTopmost` do mod só age com ≥1/8 de sobreposição da **nossa janela** com a **pílula dele**: a geometria evita isso |
| CONV-03 | Issue com proposta de API; toast e apps de notch registrados | Rascunho da issue (inglês) pronto, com checagem de duplicidade feita; conteúdo verificado do toast (código do mod, consentimento nesta máquina) e dos apps de notch (NotchNook, Alcove, boring.notch, Live Activities do macOS 27.3) com fonte |
</phase_requirements>

## Summary

**O que mudou em relação ao que o projeto "sabia" (`WINDHAWK-MOD.md` § "Não confirmado").** (1) A classe é mesmo `Windhawk.DynamicIslandForWindows`, dona = `windhawk.exe -tool-mod "dynamic-island-for-windows"`, estilo estendido `0x8080088` (LAYERED|TOPMOST|TOOLWINDOW|NOACTIVATE), retângulo 812,38 → 1748,402 (936×364, centrado em x=1280 no monitor principal a 100%) [VERIFIED: EnumWindows nesta máquina + `.wh.cpp:651`, `:663-664`, `:3979-3980`]. (2) A ilha do mod **está escondida agora**: `LocalStorage\ManuallyHidden = 1`, `IsWindowVisible = False`. Tudo o que depende de ver as duas juntas (sobreposição real, hover cruzado, 5 minutos medidos) **não foi medido** e fica para o checkpoint humano; a ilha **não** foi mostrada por mim. (3) O `EnsureTopmost` do mod testa a **pílula dele** contra o retângulo inteiro da **nossa janela** (440×324 hoje, 520×410 depois da Fase 3), exige sobreposição ≥ max(256 px², 1/8 da área da pílula) e, quando acontece, sobe a janela dele **uma vez** (`.wh.cpp:4141`, `:4172`); não há briga de volta porque nós nunca reafirmamos o topo. (4) O Electron **não** reafirma o topo sozinho: com B acima de A durante 29,7 s e 58 s o par nunca inverteu; a ilha real ficou 317 s sem se mexer no z.

**Recomendação de produto para o encaixe.** O que torna o "segunda bolha" correto é **geometria, não z-order**: se a nossa janela (estágio) não encosta na pílula do mod, o `EnsureTopmost` dele nunca dispara e a ordem de z deixa de importar, porque as duas janelas são transparentes fora das pílulas. Para isso o deslocamento precisa ser a **distância do centro do monitor até a borda interna da nossa pílula**, com a pílula alinhada pela borda interna e crescendo para fora (CSS `transform-origin` + `justify-content`). Com a âncora central da Fase 4 (pílula centrada na janela) a nossa pílula expandida (400 px) cobriria a do mod (380 px) mesmo com deslocamento. Proposta: duas âncoras novas `beside-right`/`beside-left` ("Ao lado da ilha do sistema") sobre o mecanismo de âncora da Fase 4, uma função pura `besideCenterPosition` em `state.js`, distância padrão de 210 px (190 px de meia-largura do painel de mídia expandido + hover 2,5% + folga) editável em `preferences.json`, e o arraste da Fase 4 como ajuste fino. Só no monitor principal (o alvo padrão do mod é `primary`).

**CONV-02 não é código novo, é uma trava.** O `main.js` atual tem **um** `setAlwaysOnTop` (linha 219, em `createIsland`) e nenhum `moveTop`. A Fase 4 vai esconder/mostrar por `hide()`/`showInactive()`, que **não** sobem a janela (medido). O trabalho do plano é travar isso por teste de texto (padrão de `gate.test.js`) e medir os 5 minutos com um script versionado.

**CONV-03.** A issue está redigida (inglês, sem dado pessoal), e verifiquei que **não há** issue de API/IPC aberta no repositório do mod (busca por `api|ipc|external|integration|plugin|pipe|protocol` retornou só clima). Descoberta relevante para o documento: o **NotchNook Pro tem versão para Windows** e anuncia "Approve Claude Code and Codex from the pill" [VERIFIED: HTML de `lo.cafe/notchnook/windows/` baixado nesta sessão]. Isso concorre diretamente com o produto e muda o texto do INTG-03.

**Primary recommendation:** planejar três entregas pequenas e um checkpoint humano: (1) `besideCenterPosition` + âncoras `beside-*` + testes puros; (2) trava de texto de CONV-02 + `scripts/measure-coexistence.ps1` (somente leitura); (3) `docs/INTEGRACOES.md` + `docs/ISSUE-API-EXTERNA.md` (rascunho); **checkpoint humano único**: mostrar a ilha do mod, rodar as 7 verificações CHK-6x, e só então postar a issue (go explícito do autor).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Posição "ao lado" (distância da borda interna ao centro) | `state.js` (função pura `besideCenterPosition`) | Main (`setBounds` via `moveIsland`) | Matemática pura, testável com `node:test`; o main só aplica |
| Alinhamento da pílula pela borda interna e crescimento para fora | Renderer (CSS `data-anchor`, `transform-origin`) | — | Só o CSS sabe onde a pílula fica dentro do palco; mesmo mecanismo da âncora de canto da Fase 4 |
| Persistência e validação do lado e da distância | Main + `sanitizePreferences` (Fase 4) | — | SEG-08: nenhum canal do renderer grava preferência |
| Nunca reafirmar o topo | Main (ausência de código) + teste de texto | — | A garantia é uma invariante do código, travada por teste |
| Medição de 5 min (z-order, visibilidade, sobreposição) | Script PowerShell somente leitura (`scripts/`) | Humano (liga a ilha do mod) | Observa janelas de fora; não toca em nenhuma |
| Detecção do mod | **Nenhuma** no v1 (deslocamento manual) | — | Detectar exige FFI (`koffi`) e não muda o resultado; ver "Don't Hand-Roll" |
| Proposta de API / documento de integrações | Documentação (`docs/`) | Humano (posta a issue) | Ação externa só com go explícito |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Electron | 45.4.1 (já no repo) | `BrowserWindow.setBounds`, `screen`, tudo que a fase usa | Nenhuma API nova; o encaixe é posição + CSS [VERIFIED: sondas desta sessão com `node_modules/electron/dist/electron.exe`] |
| `node:test` | Node 26.4.0 do sistema | Testes puros e travas de texto | Padrão do projeto; baseline **194 testes passando em 204 ms** [VERIFIED: `node --test` nesta sessão] |
| Windows PowerShell 5.1 + `Add-Type` (P/Invoke somente leitura) | do sistema | Script de medição `measure-coexistence.ps1` | Mesmo padrão de `scripts/measure-footprint.ps1` [VERIFIED: `ls scripts` = `measure-footprint.ps1`, `spike-verdict.js`, `spike-verdict.test.js`] |

### Supporting
Nenhuma. **Esta fase não instala pacote algum.** Se o autor aceitar, no futuro, detectar a presença do mod, reaproveitaria o `koffi` que a Fase 4 já trará (auditoria de legitimidade em `04-RESEARCH.md`); aqui isso é recomendado **não** fazer.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Âncora `beside-*` com borda interna fixa | Só deslocamento livre sobre `top-center` (plano B da Fase 4) | Sem custo de código, mas a pílula cresce simétrica e **cobre** a do mod ao expandir (400 px × 380 px); falha CONV-01 "expandindo para fora" |
| Distância fixa configurável | Seguir a pílula do mod ao vivo (ler o retângulo da janela `DynamicIslandBackdrop`) | Seguiria idle/expandida/alerta, mas exige FFI, polling e só funciona com blur/acrílico ligado; mais código e mais um timer. Ver Open Question 3 |
| Documento em `docs/INTEGRACOES.md` | Seção no `README.md` | `docs/` não existe hoje; o README é de uso. Documento próprio, com link no README |

**Installation:** nenhuma. **Package Legitimacy Audit:** sem pacotes externos nesta fase, nenhum `gsd-tools package-legitimacy` a rodar.

## Package Legitimacy Audit

> Fase sem instalação de pacotes externos (código, CSS, testes, script PowerShell e documentação).

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| — | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** nenhum. **Packages flagged [SUS]:** nenhum.

## O que foi medido nesta máquina (somente leitura)

Ambiente: Windows 11 Pro 10.0.26300; monitor principal 2560×1080 a 100% (`workArea` = `{x:0,y:30,width:2560,height:990}`, o topo reservado de 30 px é de uma barra externa [yasb]), secundário 1920×1080 a 125% em x=-1920 (DIP 1536×864) [VERIFIED: `screen.getPrimaryDisplay().workArea` da sonda; EnumWindows]. Processo de medição **DPI-aware** (`SetProcessDpiAwarenessContext(-4)`): sem isso o `GetWindowRect` da ilha a 125% devolve 440×324 virtualizado em vez dos 550×405 físicos.

### Janelas

| Janela | Classe | Dono | `exstyle` | Retângulo (físico) | Visível |
|--------|--------|------|-----------|--------------------|---------|
| Ilha do mod | `Windhawk.DynamicIslandForWindows` (título "Dynamic Island for Windows") | `windhawk.exe` PID 41872, linha de comando `"C:\Program Files\Windhawk\windhawk.exe" -tool-mod "dynamic-island-for-windows"` | `0x8080088` = LAYERED(0x80000) \| TOPMOST(0x8) \| TOOLWINDOW(0x80) \| NOACTIVATE(0x8000000); `style` `0x84000000` | `812,38,1748,402` (936×364), DPI 96, monitor principal | **Não** (`ManuallyHidden=1`) |
| Backdrop do mod | `DynamicIslandBackdrop` | `windhawk.exe` | `0x80000A8` | `1086,59,1474,246` (388×187) | Não |
| Nossa ilha, principal | `Chrome_WidgetWin_1` ("Claude Island") | `electron.exe` PID 38248 | `0x8280028` = LAYERED \| TOPMOST \| TRANSPARENT(0x20) \| NOACTIVATE \| NOREDIRECTIONBITMAP(0x200000) (sem TOOLWINDOW) | `1060,30,1500,354` (440×324) | Sim |
| Nossa ilha, secundária | idem | idem | idem | `-1230,44,-680,449` (550×405 físicos = 440×324 DIP a 125%), DPI 120 | Sim |

Ordem de z observada: mod (z=23) > Raycast (25) > nossas duas (26 e 27); irrelevante enquanto o mod está escondido [VERIFIED: EnumWindows].

### Conferência com o código do mod (citações literais, `C:\ProgramData\Windhawk\ModsSource\dynamic-island-for-windows.wh.cpp`)

| Fato | Linhas | Citação |
|------|--------|---------|
| Classe | 651 | `constexpr wchar_t kWindowClass[] = L"Windhawk.DynamicIslandForWindows";` |
| Janela criada | 22667-22669 | `HWND hwnd = CreateWindowExW(` / `WS_EX_LAYERED \| WS_EX_TOPMOST \| WS_EX_TOOLWINDOW \| WS_EX_NOACTIVATE \| WS_EX_TRANSPARENT,` / `kWindowClass, L"Dynamic Island for Windows", WS_POPUP, 0, 0, 520, 140,` |
| Folgas do palco | 663-664 | `constexpr float kRenderPadX = 28.0f;` / `constexpr float kRenderPadY = 22.0f;` |
| Palco | 3979-3980 | `constexpr float kStageContentWidth = 880.0f;   // content px, multiplied by sizeScale` / `constexpr float kStageContentHeight = 320.0f;` (⇒ 880+56 = **936** e 320+44 = **364**, iguais ao medido) |
| Topo do palco | 4054 | `s.origin.y = (flushTop ? work.top : work.top + 8) + offsetY;` (⇒ 30+8 = **38**, igual ao medido; topo da pílula = 38+22 = **60**) |
| Painel expandido | 672-673 | `constexpr float kExpandedWidth = 380.0f;` / `constexpr float kExpandedHeight = 184.0f;` |
| Faixa ociosa | 843-844 | `constexpr float kMinWidth = 72.0f;` / `constexpr float kMaxWidth = 280.0f;` (altura `kHeight = 36.0f`) |
| Alertas | 20786 em diante | notificação 360×58, clipboard 340×56, volume/brilho 300×54, bluetooth 280×54, progresso 230×48 |
| Hover | 23021 | `hover = PtInRect(&pillRect, cursor) != FALSE;` (retângulo da pílula, sem folga) |
| Click-through só ocioso | 23333 | `SetClickThrough(hwnd, (primary.kind == IslandKind::Idle && !draggingOrHover && !pinned) \|\| ctrlHoverCT);` |
| Fora da pílula | 21984-21993 | `WM_NCHITTEST` devolve `HTTRANSPARENT` fora de `g_pillClientRect` |
| Presentação por alfa por pixel | 11934, 11937 | `info.dwFlags = ULW_ALPHA;` / `UpdateLayeredWindowIndirect(hwnd_, &info)` |
| **Reafirmar o topo (timer de 1 s)** | 23126 | `now - lastTopmostCheck > 1.0) {` (só se `!isFullscreen && !g_manuallyHidden.load() && !g_autoHiddenParked.load()`, linha 23125) |
| Limiar de sobreposição | 4141 | `const long minOverlapArea = std::max(256L, islandArea / 8);` |
| Quem é comparado | 4133 e 4160 | `islandRect = *pillScreenRect;  // the stage is mostly empty, so test the pill only` e `GetWindowRect(above, &otherRect)`: **a pílula dele contra o retângulo inteiro da janela de quem está acima** |
| Ação | 4172 | `SetWindowPos(hwnd, HWND_TOPMOST, 0, 0, 0, 0,` (sem timer de volta; ele só sobe a si) |
| Backdrop reempilha atrás dele | 3775 | `if (GetWindow(island, GW_HWNDNEXT) != g_slots[0].hwnd) {` (move o **backdrop**, nunca a nossa janela) |
| Backdrop = pílula | 3751 e 3752-3760 | `constexpr int inset = 1;` e `x/y/w/h` do backdrop = retângulo da pílula com 1 px de recuo: **a janela `DynamicIslandBackdrop` expõe de fora o retângulo vivo da pílula** (388×187 = 380×184 × hover 1,025 menos o recuo) |
| Esconder manual é persistente e vence o auto-hide | 22706-22711, 22803-22810 | `if (g_settings.autoHideIdleSeconds == 0) { g_manuallyHidden = false; Wh_SetIntValue(L"ManuallyHidden", 0); }`: com `AutoHideIdleSeconds=0` (o valor desta máquina) **reiniciar o mod o mostra de novo** |
| "Unhide on hover" só do auto-park | 21039-21040 | o gancho de mouse só age com `g_autoHiddenParked`; o esconder manual o invalida |

Configurações do mod nesta máquina (HKLM, leitura): `Appearance.Position=top-center`, `TargetMonitor=primary`, `OffsetX=0`, `OffsetY=0`, `SizeScale=1.0`, `AutoDpiScale=1`, `Behavior.AlwaysOnTop=1`, `ExpandOnHover=1`, `AutoHideFullscreen=1`, `AutoHideIdleSeconds=0`, `BackdropMaterial=acrylic`, `Modules.MediaTabLyrics=0`, `Shortcuts.HideShowKey=D (ctrl_alt)`. Estado local: `ManuallyHidden=1`, `PinnedExpanded=0` [VERIFIED: `Get-ItemProperty` em `HKLM:\SOFTWARE\Windhawk\Engine\Mods\dynamic-island-for-windows\Settings` e `...\ModsWritable\...\LocalStorage`].

### A geometria das duas ilhas (principal, 100%, `workArea.y=30`)

| | Topo da pílula | Compacta | Expandida | Eixo X |
|---|---|---|---|---|
| Mod | y = 38 + 22 = **60** | faixa 36 px de altura, largura 72–280 | 380×184 (y 60 a 244), hover ×1,025 | centrada em 1280 |
| Nossa (hoje) | y = 30 + 8 = **38** (`body padding-top: 8px`, janela em `workArea.y`) | altura 46 (`index.html:56`) | 400×104 (`index.html:71`) | centrada em 1280 |

Hoje as duas ocupam o mesmo centro: a nossa fica **22 px mais alta** e se sobrepõe à dele nos y 60–84. Estimativa de meia-largura do mod: faixa ociosa ≤ 140; painel expandido 190 (195 com hover); notificação 180; **dois alertas lado a lado** até ~356 (360+12+340 ÷ 2), caso raro e de 4 s. [VERIFIED nos números de código e na conferência de 936×364/38; o aspecto visual real é não medido.]

### O Electron reafirma o topo sozinho? Não. O que sobe a janela?

Sondas descartáveis em `scratchpad/fase6/` (A e B transparentes, `focusable:false`, `setAlwaysOnTop(true,'screen-saver')`, `--user-data-dir` descartável, processos próprios encerrados sozinhos; amostragem de z a 2 Hz por EnumWindows na faixa topmost).

| Teste | Resultado |
|-------|-----------|
| B criada depois de A e **nenhuma chamada** em A por 29,7 s (sonda 1) | B acima de A o tempo todo: sem reafirmação |
| 60 s ocioso com B acima de A (sonda 2, 116 amostras) | B acima de A em todas |
| Ilha real (PID 38248), 317 s, 620 amostras | O conjunto de janelas acima dela só mudou quando **minhas** sondas apareceram/saíram |
| `A.setAlwaysOnTop(true,'screen-saver')` de novo | **A sobe acima de B** (controle positivo) |
| `A.setAlwaysOnTop(true)` (nível padrão) | **sobe** |
| `A.moveTop()` | **sobe** (documentado: "Moves window to top(z-order) regardless of focus") |
| `A.setBounds`, `A.setSize`, `A.setIgnoreMouseEvents(false)→(true,{forward})`, `A.setOpacity`, `A.hide()+showInactive()`, `A.hide()+show()`, `A.showInactive()` já visível, `A.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true})`, `executeJavaScript` com reflow | **não** mudam o z (B continuou acima) |

Níveis diferentes (`screen-saver` × padrão) ficam na **mesma faixa** entre janelas Electron: quem sobe por último fica por cima. [VERIFIED: sondas `probe-top.js`/`probe-top2.js`, `analyze.js`/`analyze2.js`; `main.js:219` é a única chamada de `setAlwaysOnTop`, `grep` nesta sessão. Docs: "From `pop-up-menu` to a higher it is shown above the Dock on macOS and above the taskbar on Windows" (electronjs.org/docs/latest/api/browser-window).]

**Consequência para a Fase 4 (TELA-01 por `hide()`/`showInactive()`):** esconder e reexibir **não** devolve a nossa janela ao topo; se o mod subiu entre uma coisa e outra, ela continua abaixo. Isso é o comportamento desejado (sem briga). **Não** acrescentar `setAlwaysOnTop` ao reexibir.

## Architecture Patterns

### System Architecture Diagram

```
 preferences.json (Fase 4)                 menu nativo (Fase 4)
 { anchor: 'beside-right',  ───────────►  "Ancorar > Ao lado da ilha do sistema (direita/esquerda)"
   besideGapPx: 210 }                       │ applyPreference() sanitiza + grava (tmp+rename)
        │                                    ▼
        ▼                          sanitizePreferences  (anchor ∈ ANCHORS+beside-*, besideGapPx ∈ [0..600])
 besideCenterPosition(side, workArea, stage, gapPx)   [puro, state.js]
        │  x = centro ± gapPx (borda interna da pílula) ∓ folga do palco; y = âncora de topo da Fase 4
        ▼
 moveIsland() → setBounds()   (nunca setPosition; nunca setAlwaysOnTop)         MAIN
        │  data-anchor="beside-right" no island:state/prefs
        ▼
 CSS: justify-content:flex-start|flex-end; transform-origin na borda interna    RENDERER
 → pílula cresce PARA FORA; a borda interna não se mexe (mola, hover 1,025, nudge só vertical)

 ┌── fora do nosso código ──────────────────────────────────────────────────────────────┐
 │ mod (windhawk.exe): estágio 936×364 | pílula centrada | EnsureTopmost 1 Hz            │
 │   dispara só se  área(pílula dele ∩ NOSSA JANELA) ≥ max(256, área/8)                   │
 │   por construção da geometria: nossa janela começa na borda interna → ∩ = ∅ → nunca    │
 └────────────────────────────────────────────────────────────────────────────────────────┘
 medição: scripts/measure-coexistence.ps1 (somente leitura, 300 s, 2 Hz) ─► CSV ─► 06-UAT.md
```

### Recommended Project Structure
```
claude-island/
├── state.js                          # + besideCenterPosition, anchors beside-* no esquema (Fase 4)
├── index.html                        # + [data-anchor="beside-*"] (alinhamento e transform-origin)
├── main.js                           # só liga a âncora nova ao moveIsland; NENHUM setAlwaysOnTop novo
├── scripts/measure-coexistence.ps1   # NOVO: medição de 5 min, somente leitura
├── docs/INTEGRACOES.md               # NOVO: mod, toast, apps de notch (verificado × não verificado)
├── docs/ISSUE-API-EXTERNA.md         # NOVO: texto da issue (rascunho; o autor posta)
└── gate.test.js / island.test.js     # + trava de CONV-02, + vetores de besideCenterPosition
```

### Pattern 1: "Ao lado" = distância da borda interna ao centro, crescendo para fora
**What:** `besideCenterPosition(side, workArea, stage, gapPx, slack)` devolve a posição da **janela** para que a **borda interna da pílula** fique a `gapPx` do centro horizontal do monitor. `side: 'right'` ⇒ pílula alinhada ao início do palco (cresce para a direita); `'left'` ⇒ alinhada ao fim (cresce para a esquerda). O topo vem da âncora de topo da Fase 4 (16 px/8 px de respiro já existentes). O arraste da Fase 4 continua somando um deslocamento (é o "ajuste fino", e é isso que torna o encaixe configurável na tela).
**When to use:** quando o usuário escolhe "Ao lado da ilha do sistema". Vale só no monitor principal (o `TargetMonitor` padrão do mod é `primary`); os demais monitores seguem o topo central.
**Por que a borda interna e não o centro:** a mola alargando a pílula (até ~21% de passagem no estilo Elástico) e o hover 1,025 só podem mover a borda **externa** se `transform-origin` e o alinhamento forem os da borda interna; a interna (a que importa para não cobrir o mod) fica parada.
**Valor padrão:** `gapPx = 210` = 190 (meia-largura de `kExpandedWidth = 380`) + 5 (hover ×1,025 ≈ +4,75) + 15 de folga visual [ASSUMED: A1; o autor ajusta na tela]. Sem `kMaxWidth` (280, faixa ociosa) nem `kExpandedWidth` (380) o mod passa de 190 de meia-largura, **exceto** com "letras na aba de mídia" (`kSideLyricsWidth = 220`, hoje desligado) e com dois alertas lado a lado (~356), que aí sobrepõem a nossa por até 4 s.
```javascript
// Source: contrato proposto; valores do mod em .wh.cpp:672 (380) e :3751 (inset 1). Puro: não toca em Electron.
// Devolve { x, y } da janela; nunca lança, entrada inválida devolve null (convenção do state.js).
const BESIDE_GAP_DEFAULT_PX = 210; // 190 de meia-largura do painel de mídia do mod + hover + folga
function besideCenterPosition(side, workArea, stage, gapPx) {
  if (side !== 'left' && side !== 'right') return null;
  if (![workArea.x, workArea.width, stage.width, gapPx].every(Number.isFinite)) return null;
  const centerX = workArea.x + workArea.width / 2;
  const x = side === 'right' ? centerX + gapPx : centerX - gapPx - stage.width;
  return { x: Math.round(x) };
}
```
(O `y` e a folga horizontal do palco saem da âncora de topo da Fase 4; o clamp existente (`clampIslandPosition`) continua valendo.)

### Pattern 2: CONV-02 por trava de texto e por medição
**What:** (a) teste no estilo de `gate.test.js:286-333` que lê `main.js` e exige: nenhum `moveTop(`; `setAlwaysOnTop(` aparece **uma única vez** e dentro de `createIsland`; nenhum `setInterval`/`setTimeout` cujo corpo cite `setAlwaysOnTop`/`moveTop`/`setBounds` de z. (b) `scripts/measure-coexistence.ps1` mede 300 s a 2 Hz e reporta zero inversões de ordem, zero sumiços e a área de interseção entre a **nossa janela** e a **pílula do mod** (deve ser 0 px²).
**Por que dois:** o texto garante a causa (não há timer); a medição garante o efeito (nenhuma some atrás da outra) com as duas ilhas vivas.

### Pattern 3: Medição somente leitura de fora
Identificar o mod por `Windhawk.DynamicIslandForWindows` (palco) e `DynamicIslandBackdrop` (pílula viva, recuo de 1 px, só com blur/acrílico ligado); a nossa por `Chrome_WidgetWin_1` + título "Claude Island" + PID do `electron.exe` da ilha.

### Anti-Patterns to Avoid
- **Timer que "garante" o topo** (`setInterval(() => island.setAlwaysOnTop(true, ...))`, `moveTop()` periódico): é exatamente o que o requisito proíbe e, com o `EnsureTopmost` do mod, vira disputa visível.
- **Chamar `setAlwaysOnTop(true…)` ao reexibir/aplicar preferência** (a Fase 4 é a tentação): sobe a janela (medido) e, com sobreposição, desperta o `EnsureTopmost` do mod.
- **Âncora central + deslocamento para "ficar ao lado"**: a pílula cresce simétrica e cobre a do mod.
- **Detectar o mod (FindWindow/registro HKLM) para decidir posição**: acopla a ilha a um mod de terceiros, só Windows, e ele pode estar escondido/desligado/reiniciado; o deslocamento manual funciona sempre.
- **Pôr texto de comando em toast** (ver Security Domain).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Garantir "nunca disputa o topo" | Guarda em tempo de execução, heurística de z-order | Ausência de código + teste de texto + medição | A propriedade é "não há timer"; provar o negativo por texto é barato e exato |
| Seguir a pílula do mod | Polling de janelas por FFI | Distância fixa configurável + arraste | Um timer a mais, um `koffi` a mais, quebra se o blur do mod estiver desligado |
| Medir convivência | Captura de tela/OCR | EnumWindows + `GetWindowRect` + estilos (somente leitura) | Determinístico, repetível, não toca no mod |
| Posição | Conta de DPI própria | `workArea` do `display` + `setBounds` (Fase 4, já medido a 100% e 125%) | A 125% é onde a conta erra (`04-RESEARCH.md` Pitfall 1) |
| Texto da integração por toast | Biblioteca de toast | Nada nesta fase: só documentar | Não há requisito de enviar toast; o notificador de terceiros já cobre |

**Key insight:** a fase é de **geometria e de registro**, não de integração. O produto entregue é uma âncora, um teste e dois documentos; o resto é verificação com a ilha do mod visível.

## Common Pitfalls

### Pitfall 1: Medir convivência com a ilha do mod escondida
**What goes wrong:** `IsWindowVisible` falso, `EnsureTopmost` nunca roda (`!g_manuallyHidden` na condição, `.wh.cpp:23125`), e qualquer "5 minutos sem problema" é vazio.
**How to avoid:** o script de medição **recusa** (código de saída ≠ 0) se a janela do mod não está visível; o checkpoint humano começa por mostrar o mod (Ctrl+Alt+D, ou reiniciar o mod: com `AutoHideIdleSeconds=0` ele volta visível). Eu não fiz isso.

### Pitfall 2: DPI virtualizado no medidor
**What goes wrong:** sem `SetProcessDpiAwarenessContext(-4)` o `GetWindowRect` da janela a 125% devolve retângulo em escala diferente; a interseção sai errada.
**How to avoid:** o medidor se declara DPI-aware (medido: `-1368..-928` virtualizado contra `-1230..-680` físico). O encaixe é no monitor principal (100%), mas o medidor enxerga as duas.

### Pitfall 3: Palco nosso invadindo a pílula do mod
**What goes wrong:** nosso palco (520×410 depois da Fase 3) é transparente mas é **janela**: o `EnsureTopmost` do mod compara a janela inteira. Com `gapPx` pequeno e folga de palco, a interseção passa de 1/8 e o mod passa a subir sobre nós a cada vez que nos sobrepomos a ele (uma vez por evento, sem briga, mas a nossa pílula pode ficar atrás da dele se coincidirem).
**How to avoid:** a janela começa **na** borda interna (folga do lado interno = 0); a interseção estática é 0; o script reporta `stageOverlapPx2`.

### Pitfall 4: Alinhamento por borda externa deixa a pílula longe do centro
**What goes wrong:** com `justify-content: center` a pílula compacta (≈200 px) num palco de 520 px fica ~160 px longe da borda interna do palco; o "ao lado" fica com um vão que muda com a largura.
**How to avoid:** alinhar por `flex-start`/`flex-end` conforme o lado, com `transform-origin` na borda interna (mesmo mecanismo da âncora de canto da Fase 4).

### Pitfall 5: Alertas do mod passando por cima do nosso pedido
**What goes wrong:** notificação+clipboard lado a lado no mod (até ~712 px, ±356) alcançam a nossa pílula a +210; por 4 s ela pode ficar parcialmente coberta e o `EnsureTopmost` sobe o mod sobre nós.
**Por que é aceitável:** o mod não envia entrada; clicar numa região coberta clica **nele**, nunca aprova por nós; a Fase 2 já exige o cursor parado e o pedido visível por 0,8 s. É risco residual de visibilidade, não de aprovação (ver Security Domain). Registrar no documento.

### Pitfall 6: A Fase 3/4 ainda não estão na `main`
**What goes wrong:** `besideCenterPosition` depende de `WINDOW_SIZE` 520×410, `--stage-top`, do esquema de preferências e da âncora da Fase 4, que existem só em ramo/worktree/pesquisa (`git branch`: `feat/fase-3-visual` local; `04-RESEARCH.md`).
**How to avoid:** pré-voo obrigatório (seção própria); ler o `main` real antes de planejar os arquivos.

## Code Examples

### Medidor somente leitura (núcleo, verificado nesta sessão)
```powershell
# Source: scratchpad/fase6/zsampler.ps1 (testado: 620 amostras a 2 Hz, 317 s). Somente EnumWindows/GetWindowRect/estilos.
Add-Type -TypeDefinition @'
using System; using System.Text; using System.Runtime.InteropServices;
public static class Z6 {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc p, IntPtr l);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassNameW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetWindowLongPtrW(IntPtr h, int i);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr c); // só o próprio processo
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
}
'@
[void][Z6]::SetProcessDpiAwarenessContext([IntPtr](-4))
# por tick: percorrer EnumWindows (ordem = z, topo primeiro), manter só (exstyle & 0x8) e visíveis;
# gravar "<idx>|<hwnd>|<pid>|<classe>|<L,T,W,H>" por janela. O idx menor está acima.
```
Para `measure-coexistence.ps1` acrescentar: localizar o mod por classe, exigir `IsWindowVisible`, ler `DynamicIslandBackdrop` como pílula viva, calcular `stageOverlapPx2 = área(nossa janela ∩ pílula do mod)` e `relation` (qual está acima); falhar com saída ≠ 0 se alguma janela sumir, se a relação inverter, ou se `stageOverlapPx2 > 0` por mais de 1 amostra.

### Trava de texto de CONV-02 (padrão `gate.test.js`)
```javascript
// Source: padrão de gate.test.js:286-333 (lê main.js como texto). Falha se alguém reintroduzir a disputa pelo topo.
test('a ilha nunca reafirma o topo: sem moveTop e um único setAlwaysOnTop, dentro de createIsland', () => {
  const mainSource = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
  assert.equal(mainSource.includes('moveTop('), false);
  assert.equal((mainSource.match(/setAlwaysOnTop\(/g) || []).length, 1);
  const createIsland = mainSource.slice(mainSource.indexOf('function createIsland'), mainSource.indexOf('function syncIslands'));
  assert.ok(createIsland.includes('setAlwaysOnTop('));
});
```

### Rascunho da issue (para o repositório do mod; **inglês**; o autor posta, depois do go explícito)
```markdown
**Title:** Proposal: optional local API so other apps can show a read-only activity in the island

Hi, and thanks for the mod. I maintain an MIT desktop app, Claude Island (github.com/marcelo-mo/claude-island),
a small pill that shows when a Claude Code session is working / needs an answer / is done. I run it next to your
island (top-center, primary monitor) by offsetting mine to the side, and it works. What I cannot do is show
my status *in* your island, because there is no supported way for another program to hand it content.
The only routes I found are side effects of the current implementation: (1) `ProgressPercent` in
`ModsWritable\...\LocalStorage` (progress ring only), (2) a toast picked up by `UserNotificationListener`
(4 s, title + body cut at 120 chars, no icon of ours, needs "Let apps access your notifications"),
(3) a fake SMTC session. None is a good contract.

**Proposal (opt-in, off by default, nothing changes for current users):**
- A setting, e.g. `Modules.ExternalActivities` (default off).
- One minimal local channel, your choice: a per-user named pipe, or a drop folder of small JSON files
  (no network, no admin).
- Payload: `{ id, source, title (<=40), subtitle (<=80), icon (PNG <=32 px, optional), accent (hex, optional),
  progress (0..1, optional), ttl_ms, priority: "normal" | "high" }`. Same `id` replaces the previous one.
- Hard limits so it stays safe: plain text only, truncated, rate-limited, read-only (no buttons, no actions),
  per-`source` block list (like `MediaExpandBlocklist`).
- It would take a slot in `ChooseActivities` (probably under notifications), so nothing existing is removed.

Happy to send a PR for the `.wh.cpp` if you agree on the shape, following the Contributing section
(credit line included). I am not asking for any interactive content in the island: approvals stay in my app.

Question: would you prefer the pipe or the folder, and is a new `IslandKind` acceptable?
```
(Não contém caminho local, nome de usuário nem dado de sessão. Antes de postar: reler as issues abertas por duplicidade; a busca desta sessão não achou.)

## Itens que exigem uma pessoa na tela (checkpoint humano único)

Pré-condição: **a pessoa mostra a ilha do mod** (Ctrl+Alt+D, atalho do próprio mod, ou reinicia o mod; nenhum agente faz isso). Em seguida, com a nossa ilha em `beside-right` (distância padrão 210) no monitor principal:

| ID | O que fazer | Esperado | O que registrar |
|----|-------------|----------|-----------------|
| CHK-61 | Rodar `scripts/measure-coexistence.ps1 -DurationSec 300` com as duas visíveis, sem mexer no mouse | exit 0; `inversoes=0`, `sumicos=0`, `stageOverlapPx2=0` | CSV + resumo em `06-UAT.md` |
| CHK-62 | Passar o mouse na pílula do mod (expande 380×184) e depois na nossa, alternando | cada uma expande **só** quando o cursor está na pílula dela; nenhuma cobre a outra; a nossa cresce **para fora** | foto/descrição, medir `DynamicIslandBackdrop` expandido |
| CHK-63 | Acionar um alerta no mod (ex.: Caps Lock ou volume) com a nossa em estado "precisa de você" | pílulas sem sobreposição; clicar em **Permitir** na nossa funciona com o alerta ativo (`WS_EX_TRANSPARENT` desligado no mod, `.wh.cpp:23333`) | resultado do clique |
| CHK-64 | Dois alertas simultâneos no mod (±356) | registrar se alcançam a nossa e por quanto tempo | limite real do `gapPx` padrão |
| CHK-65 | Tela cheia (F11 num vídeo) no monitor principal | as duas somem (a nossa pela Fase 4; a dele por `AutoHideFullscreen=1`), voltam juntas | observação |
| CHK-66 | Hover na nossa pílula **encostando** na dele | a dele **não** expande | observação |
| CHK-67 | (opcional, documento do toast) enviar um toast de teste de outro app (não nosso) com o mod visível | aparece na ilha por ~4 s; confirma `.wh.cpp:5788` | evidência para `INTEGRACOES.md` |

Postar a issue (CONV-03) é um item humano separado: `gh issue create` no repositório do autor do mod **só com o go explícito do autor deste repositório**; depois, `gh issue view <url>` somente leitura para registrar o link no documento.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Integrar por gambiarra (`ProgressPercent`, SMTC falso) | Proposta de API opt-in ao autor + encaixe lateral | Esta fase | Única via sob nosso controle (Key Decision do projeto) |
| Âncora central + deslocamento | Âncora `beside-*` (borda interna fixa, crescimento para fora) | Esta fase | Resolve "sem cobri-la" |
| Medição "a olho" de convivência | Script versionado, somente leitura, 5 min a 2 Hz | Esta fase | CONV-02 verificável |
| Notch no macOS só como app de mídia | NotchNook Pro anuncia "Approve Claude Code and Codex"; macOS 27.3 (beta) abre Live Activities a apps de terceiros | 2026-11 | Concorrência e caminho futuro; ver documento |

**Deprecated/outdated (no `WINDHAWK-MOD.md`):** a linha "Classe de janela para detectar: `Windhawk.DynamicIslandForWindows` (a confirmar)" está **confirmada**; "nossa ≈ y 8–54; dela ≈ y 30–66" ficou impreciso: medido/derivado, a nossa pílula está em y **38–84** e a dele em **60–96** (ociosa) / **60–244** (expandida).

## Documento de integrações (conteúdo verificado para `docs/INTEGRACOES.md`)

### Ilha do Windhawk (mod 1.4.0)
- Sem API: README do repositório não descreve API pública, IPC ou forma de outro app empurrar conteúdo [CITED: github.com/devcode90/Dynamic-Island-for-Windows, README, lido por resumo]; no código, nada de pipe/`WM_COPYDATA`/arquivo/socket [VERIFIED: `grep` no `.wh.cpp`, ver `WINDHAWK-MOD.md` § 3].
- Repositório: 64 estrelas, 48 forks, 110 commits, MIT; issues habilitadas (58 abertas, 80 fechadas na amostra); seção "Contributing": "destructive changes without discussion will not be accepted" e crédito obrigatório do contribuidor [CITED: README, por resumo]. **Não há issue de API/IPC**: busca `is:issue api OR ipc OR external OR integration OR plugin OR pipe OR protocol` = 4 resultados, todos de clima ou hardware (#163, #104, #44, #42) [VERIFIED: página de busca do GitHub nesta sessão, por resumo]. Issues próximas e sem resposta visível: #190 "notifications in the Dynamic Island", #195 "An option to disable the notification banners", #161 (toast com ação) [CITED: páginas das issues]. **A responsividade do autor não pôde ser determinada** (#190 e #155 sem comentário do dono).
- Convivência: encaixe lateral por deslocamento (esta fase). Classe `Windhawk.DynamicIslandForWindows`; estágio 936×364; `EnsureTopmost` a 1 Hz com limiar de 1/8 (tabela acima).

### Toast do Windows
- **Caminho no mod (lido no código):** `UserNotificationListener` com `GetNotificationsAsync(Toast)` a cada 1 s; mostra **uma** notificação por 4 s com `título - corpo` truncado em 120 caracteres; filtra apps cujo nome contém `powershell`, `pwsh` ou `cmd.exe`; respeita Não Perturbe; sem botões [VERIFIED: `.wh.cpp:5755-5836`, `:5788`, `:5795`, `:5834`, `:5874`].
- **Pré-requisito:** "Let apps access your notifications" [CITED: cabeçalho do mod, `.wh.cpp:73`]. **Nesta máquina:** `HKCU\...\CapabilityAccessManager\ConsentStore\userNotificationListener\Value = Allow` e `ToastEnabled = 1` [VERIFIED: leitura de registro].
- **Do lado do Electron:** `Notification` aceita `toastXml` (Windows) e `timeoutType` (Windows/Linux) [CITED: electronjs.org/docs/latest/api/notification]. Exigência de AppUserModelID/atalho no Menu Iniciar em app não empacotado: [ASSUMED] (a página não cobre).
- **Não verificado:** que um toast nosso apareça na ilha do mod (a ilha estava escondida). CHK-67 fecha. **Limite de produto:** 4 s, sem ação, texto truncado ⇒ **não serve** para aprovar permissão; no máximo "avisa que há pedido". Nunca pôr o comando no toast (Security Domain).

### Apps de notch no macOS (tudo por página pública, sem instalar nada)
| App | O que consta | Integração externa | Fonte |
|-----|--------------|--------------------|-------|
| NotchNook | Mac: Pro R$70 vitalício/R$15 mês, Classic R$29; macOS 14.6+; a página cita só "your Shortcuts" no resumo. **Windows**: "NotchNook Pro for Windows", R$29,00 (R$19,00 na Black Friday até 30/11), Windows 10 22H2/11 x64, "Approve Claude Code and Codex from the pill", "Claude Code and Codex show their progress in the pill" | Sem API/SDK/URL scheme documentados nas páginas lidas | [VERIFIED: HTML de `lo.cafe/notchnook/windows/` baixado nesta sessão]; `lo.cafe/notchnook` por resumo |
| Alcove | v1.7, US$12,99 único, macOS 15+, lista "Live Activities" sem detalhe | Nenhum documentado | [CITED: tryalcove.com, por resumo] |
| boring.notch | GPL-3.0, 271 issues abertas; "Extension system" é item **não marcado** do roadmap; existe `BoringNotchXPCHelper` sem descrição; issues #1747 "API support", #1522/#1470 (Codex) abertas | Nenhum shipado | [CITED: README e busca de issues, por resumo] |
| Live Activities no macOS 27.3 | Beta em 2026-11-04; "Third-party Mac apps can also implement Live Activities support now"; barra de menus; release esperada em dezembro | API da Apple, não do app de notch | [CITED: macrumors.com/2026/11/04/macos-27-3-live-activities-in-menu-bar/, por resumo] |
| Outros que aprovam Claude Code do notch | ClaudeNotch, Vibe Notch, Coucou (macOS e Windows), AgentPeek | Via hooks do Claude Code | [CITED: resultados de busca; não abertos um a um] |

**Implicação para o documento:** o produto deixou de ser único; o diferencial declarado do projeto é o gate (nunca aprovar o que o usuário não viu). Várias ferramentas registrando `PermissionRequest` ao mesmo tempo: o Claude Code roda os hooks do evento **em paralelo** [CITED: code.claude.com/docs/en/hooks]; a regra de precedência entre dois `PermissionRequest` **não foi encontrada** na parte lida (só a de `PreToolUse`: `deny` > `defer` > `ask` > `allow`) ⇒ [ASSUMED] até testar; é o INTG-03.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `besideGapPx` padrão = 210 px deixa a nossa pílula fora da do mod em ociosa, mídia expandida (com hover) e notificação | Pattern 1 | Pílulas se tocam ou o vão fica grande demais; o autor ajusta (arraste + JSON); CHK-62/64 medem |
| A2 | A janela estágio do mod (alfa por pixel, `UpdateLayeredWindowIndirect`) deixa o clique passar nos pixels transparentes mesmo sem `WS_EX_TRANSPARENT` (doc de janelas em camadas) | Pitfall 3, CHK-63 | O clique no nosso botão sob o estágio dele (fora da pílula) seria engolido; só afeta usabilidade, nunca aprova. A sombra dele (alfa ≠ 0) bloqueia ~14–18 px |
| A3 | O `gapPx` e as larguras do mod valem para o `SizeScale=1.0` e `AutoDpiScale` do autor; outro `SizeScale` muda tudo proporcionalmente | Pattern 1 | Distância fica curta/longa; documentar e expor `besideGapPx` |
| A4 | Reiniciar o mod mostra a ilha (porque `AutoHideIdleSeconds=0` zera `ManuallyHidden`) | Pitfall 1 | Se não mostrar, usar o atalho Ctrl+Alt+D (humano) |
| A5 | O encaixe só é necessário no monitor principal (`TargetMonitor=primary`) | Pattern 1 | Se o autor usar "Display N"/"Follow", a âncora precisa valer no monitor certo (opção de lista) |
| A6 | A Fase 4 entregará âncora, `data-anchor`, preferências saneadas e `hide/show` como descritos em `04-RESEARCH.md` | todo o documento | Os planos precisam ser revistos contra o `main` pós-Fase 4 (pré-voo) |
| A7 | O NotchNook Windows aprova `PermissionRequest` por hook do Claude Code (o mecanismo não está nas páginas lidas) | Documento de integrações | Se for outro mecanismo, a nota de INTG-03 muda |
| A8 | Precedência entre dois hooks `PermissionRequest` desconhecida | Documento de integrações | Convivência com NotchNook (INTG-03) pode ter resultado inesperado |
| A9 | AppUserModelID/atalho necessário para toast Electron não empacotado | Documento (toast) | Só afeta quem implementar toast no futuro |

## Open Questions

1. **Distância padrão e lado (A1).** Recomendação: `beside-right`, 210 px; o autor decide o lado olhando as duas na tela (CHK-62).
2. **O encaixe vale em todos os monitores ou só no principal?** Recomendação: só no principal (o mod padrão é `primary`); nos outros, topo central. Confirmar com o uso real (A5).
3. **Seguir a pílula do mod ao vivo (leitura do `DynamicIslandBackdrop`)?** Não recomendado agora: exige `koffi` (Fase 4) e polling, e só funciona com blur/acrílico ligado. Registrar como `ponytail:` no código e como idéia de v2 junto do INTG-01.
4. **Quando postar a issue?** Depois do documento e da medição (a proposta fica mais forte com a convivência provada), mas é decisão do autor; o texto está pronto.
5. **O documento de integrações vai no README ou em `docs/`?** Recomendação: `docs/INTEGRACOES.md` com link no README.
6. **A Fase 4 mantém `data-anchor` por canto com `transform-origin` na borda?** É a base das âncoras `beside-*`; se a Fase 4 mudar o desenho, o CSS desta fase muda junto.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Electron | encaixe, sondas | ✓ | 45.4.1 (`node_modules`) | — |
| Node | testes | ✓ | 26.4.0 | — |
| Windows PowerShell 5.1 | medidor | ✓ | 5.1 | — |
| Windhawk + mod "Dynamic Island for Windows" | CHK-6x | ✓ instalado e rodando, **ilha escondida** | mod 1.4.0 (`dynamic-island-for-windows_1.4.0_610383.dll`), `windhawk.exe` PID 41872 | A pessoa mostra a ilha (Ctrl+Alt+D) |
| GitHub CLI `gh` | postar/ler a issue | ✓ | 2.96.0 | Postar pela web |
| Monitores | CHK-6x | ✓ | principal 2560×1080/100%, secundário 1920×1080/125% | — |
| Tiling manager (komorebi) e barra (yasb) | contexto | ✓ rodando | `workArea.y = 30` por causa da barra | Fase 4 CHK-08 cobre o retilamento |

**Missing dependencies with no fallback:** nenhuma.
**Missing dependencies with fallback:** ilha do mod visível (humano).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` + `node:assert/strict` (Node 26.4.0) |
| Config file | nenhum (`package.json`: `"test": "node --test"`) |
| Quick run command | `node --test gate.test.js island.test.js` |
| Full suite command | `pnpm test` (baseline: 194 passam, 0 falham; só vale até a Fase 4 somar os dela) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONV-01 | `besideCenterPosition` (esquerda/direita, centro do monitor, valores inválidos devolvem `null`, `gapPx` fora de [0,600] saneado em `sanitizePreferences`, clamp no `workArea`) | unit | `node --test island.test.js` | ✅ acrescentar |
| CONV-01 | CSS `[data-anchor="beside-*"]` presente com `transform-origin` e alinhamento corretos; `index.html` e `main.js` ligam a âncora | texto | `node --test gate.test.js` | ✅ acrescentar |
| CONV-01 | Crescimento para fora, sem cobrir, com o mod visível | manual | CHK-62 | humano |
| CONV-02 | Sem `moveTop(`, um `setAlwaysOnTop(` em `createIsland`, nenhum timer de z | texto | `node --test gate.test.js` | ✅ acrescentar |
| CONV-02 | 5 min, sem inversão/sumiço, `stageOverlapPx2 = 0` | script + manual | `powershell -File scripts/measure-coexistence.ps1 -DurationSec 300` | ❌ Wave 0 |
| CONV-03 | `docs/INTEGRACOES.md` existe e cobre mod, toast, NotchNook, Alcove, boring.notch com data e fonte; link da issue após postar | texto | `node --test gate.test.js` (ou `grep` na tarefa) | ❌ Wave 0 |
| CONV-03 | Issue aberta no repositório do mod | manual (go explícito) | `gh issue view <url>` (somente leitura) | humano |

### Sampling Rate
- **Per task commit:** `node --test gate.test.js island.test.js`
- **Per wave merge:** `pnpm test`
- **Phase gate:** `pnpm test` verde (inclui a suíte do gate e `fixtures/permission-vectors.json`) antes de `/gsd-verify-work`; CHK-61..67 e a issue no PR/UAT

### Wave 0 Gaps
- [ ] `scripts/measure-coexistence.ps1` (somente leitura, DPI-aware, recusa mod invisível)
- [ ] vetores de `besideCenterPosition` em `island.test.js`
- [ ] trava de texto de CONV-02 em `gate.test.js`
- [ ] `docs/INTEGRACOES.md` e `docs/ISSUE-API-EXTERNA.md`
- [ ] sem framework novo

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | não | — |
| V3 Session Management | não | — |
| V4 Access Control | sim | A posição/encaixe nunca entra no gate: `acceptDecision` não recebe fato de geometria do renderer; `islandOf(event)` confere remetente (Fase 2) |
| V5 Input Validation | sim | `besideGapPx` e `anchor` por `sanitizePreferences` (esquema fechado, padrão por chave, nunca lança); `besideCenterPosition` devolve `null` em entrada inválida |
| V6 Cryptography | não | — |
| V10 Malicious Code / dependências | não | Nenhum pacote novo |
| V12 Files | sim | Preferência gravada por `.tmp` + `renameSync` (Fase 4); medidor só lê |
| V13 Privacy / egress | sim | A issue e o documento não levam caminho local, nome de usuário, texto de pedido nem dado de sessão; toast futuro nunca com comando |

### Known Threat Patterns for ilhas sobrepostas no desktop

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Overlay de terceiro cobre parte do pedido/botões e induz clique errado | Spoofing | Geometria sem sobreposição (`stageOverlapPx2 = 0`); o mod não envia entrada; clique em área coberta cai **nele**, nunca aprova por nós; gate (cursor parado, 0,8 s, mesmo botão) inalterado. Risco residual: alertas duplos do mod por ~4 s (Pitfall 5) |
| Disputa de topo entre dois overlays (DoS visual) | DoS | Nunca reafirmar o topo por timer; trava de texto; o mod é quem reclama o dele, uma vez por evento |
| Arquivo de preferências editado (`besideGapPx` enorme/negativo/NaN) | Tampering | Esquema fechado, faixa [0,600], clamp no `workArea`, padrão por chave |
| Vazamento por conteúdo externo (toast mostrado na ilha do mod, compartilhamento de tela) | Information disclosure | Toast só genérico ("Claude precisa da sua resposta"), nunca o comando; o mod lê o texto do toast no Action Center e o exibe (código `:5834`) |
| Ação externa não autorizada (postar issue) | Repudiation | Nenhum agente posta; só `gh issue create` com go explícito do autor; rascunho versionado |
| Medidor alterando o mod | Tampering | Somente `EnumWindows`/`GetWindowRect`/`GetWindowLongPtr`; sem `SetWindowPos`/`SendMessage`/`SendInput`; sem tocar em registro do Windhawk |

## Project Constraints (from CLAUDE.md)

Fonte: `.claude/CLAUDE.md` do projeto e `~/.claude/CLAUDE.md` (SDD-WORKFLOW). Mesma autoridade das decisões travadas.
- Plataformas: recurso só de Windows é aceitável como opcional, nunca como base. O encaixe é geometria pura (funciona em qualquer SO); o medidor é só Windows e fica em `scripts/`.
- Segurança: aprovação é fronteira de confiança; nenhuma mudança de interação (hover, scroll, troca, **encaixe**) pode permitir aprovar o que não foi visto.
- Hooks nunca quebram nem atrasam a sessão: nada desta fase toca `hook.js`/`permission-hook.js`/`window.js`.
- Dependências: menor diff correto; **zero pacote novo**; pnpm.
- Testes: `node:test`; lógica pura em `state.js` (`besideCenterPosition`); função pura nunca lança e devolve `null`/padrão; `now` por parâmetro.
- Estilo: CommonJS, 2 espaços, aspas simples, ponto e vírgula, vírgula final, constantes `UPPER_SNAKE_CASE` com unidade (`BESIDE_GAP_DEFAULT_PX`), comentários em pt-BR explicando o porquê, `ponytail:` para atalhos com teto (seguir o mod ao vivo = v2), `catch {}` só com comentário.
- Comentário de origem do mod (MIT): 16/40 px de âncora e as larguras 380/184 citadas levam a referência a `THIRD_PARTY_NOTICES.md`.
- Processo: commits semânticos em pt-br **sem** `Co-Authored-By`; `main` protegida (tudo por PR, em pt-br); fluxo GSD; `README` ganha o link do documento.
- O texto da issue ao repositório do mod é em **inglês** (o repositório dele é em inglês); todo o resto do repositório, em pt-BR.

## Pré-voo para o plan-phase (Fases 3 e 4 ainda não estão na `main`)

1. Reler `main` depois da Fase 4: `WINDOW_SIZE`, `HORIZONTAL_SLACK`, `moveIsland`/`savedPosition`, `anchorPosition`, `data-anchor` no CSS, `PREFERENCE_SCHEMA`/`sanitizePreferences`, o local do `preferences.json` (Open Question 1 da Fase 4), `hide()/showInactive()`.
2. Confirmar que a Fase 4 **não** chama `setAlwaysOnTop` fora de `createIsland` (a trava de CONV-02 pega, mas é melhor saber antes).
3. Reconferir a versão do mod (`@version` do `.wh.cpp`, hoje 1.4.0): o mod é novo e muda rápido (issues de 2026-11-20); rever as linhas 4141/4172/23126 se mudar.
4. Estrutura sugerida (não vinculante): **Onda 1** `besideCenterPosition` + âncoras + testes puros + CSS; **Onda 2** trava de texto + `measure-coexistence.ps1`; **Onda 3** `docs/INTEGRACOES.md` + `docs/ISSUE-API-EXTERNA.md` + link no README; **checkpoint humano único** (mostrar o mod → CHK-61..67 → registrar em `06-UAT.md` → decidir postar a issue). Planos sequenciais: mexem em `main.js`/`index.html`/`gate.test.js` juntos (precedente da Fase 2).
5. Se a fase for cortada: o plano B (âncora de topo + arraste da Fase 4) já cobre "deslocamento manual"; perde-se o crescimento para fora e a medição.

## Sources

### Primary (HIGH confidence)
- Medições desta sessão em `scratchpad/fase6/` (pasta temporária da sessão de pesquisa, não versionada; os trechos que importam estão neste documento) (`enum.ps1`, `zsampler.ps1`, `probe-top.js`, `probe-top2.js`, `analyze.js`, `analyze2.js`, `z.tsv`, `probe-log.json`, `probe2-log.json`): EnumWindows/estilos/retângulos, ordem de z a 2 Hz, sondas com Electron 45.4.1 do repositório e `--user-data-dir` descartável. Processos próprios encerrados sozinhos; nenhum processo de terceiros tocado.
- Código lido: `main.js` (371 linhas), `index.html` (linhas 49-72), `state.js` (236-238), `gate.test.js` (1-30, travas), `package.json`, `.planning/{REQUIREMENTS,PROJECT,STATE,ROADMAP,research/WINDHAWK-MOD,config}`, `04-RESEARCH.md`, e o mod `C:\ProgramData\Windhawk\ModsSource\dynamic-island-for-windows.wh.cpp` (trechos citados com linha).
- Registro (somente leitura): `HKLM\SOFTWARE\Windhawk\Engine\Mods\dynamic-island-for-windows` (+ `\Settings`, `ModsWritable\...\LocalStorage`), `HKCU\...\ConsentStore\userNotificationListener`.
- https://learn.microsoft.com/en-us/windows/win32/winmsg/window-features ("Hit testing of a layered window is based on the shape and transparency of the window... areas ... whose alpha value is zero will let the mouse messages through"; "A topmost window overlaps all other non-topmost windows")
- https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowpos (`HWND_TOPMOST`, `SWP_NOACTIVATE`: "moved to the top of either the topmost or non-topmost group")
- https://www.electronjs.org/docs/latest/api/browser-window (`setAlwaysOnTop` níveis, `moveTop`, `showInactive`)
- `lo.cafe/notchnook/windows/` (HTML baixado e lido nesta sessão)

### Secondary (MEDIUM confidence)
- github.com/devcode90/Dynamic-Island-for-Windows (README, issues, buscas) e github.com/TheBoredTeam/boring.notch (README, busca de issues), tryalcove.com, lo.cafe/notchnook, macrumors.com (2026-11-04), code.claude.com/docs/en/hooks (trechos), electronjs.org/docs/latest/api/notification: lidos por resumo do `WebFetch`.

### Tertiary (LOW confidence)
- Resultados de `WebSearch` sobre ClaudeNotch, Vibe Notch, Coucou, AgentPeek, Notchzy, Notchify, "Windows Notch Overlay": só títulos/trechos; não verificados um a um.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, nenhum pacote; tudo já no repositório
- Architecture (âncora `beside-*`, geometria, EnsureTopmost): HIGH no que é código e medição; MEDIUM no valor 210 e no aspecto visual (mod escondido, A1/A2)
- Pitfalls: HIGH para z-order, DPI do medidor e sobreposição por janela; LOW para a convivência ao vivo (não medida)
- Pesquisa de mercado (CONV-03): MEDIUM (páginas públicas por resumo; NotchNook Windows com HTML lido)

**Research date:** 2026-11-21
**Valid until:** 2026-12-05 (14 dias: o mod 1.4.0 e as páginas dos apps de notch mudam toda semana; o NotchNook Windows está em promoção até 2026-11-30; macOS 27.3 sai em dezembro)
