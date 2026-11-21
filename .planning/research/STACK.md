# Stack Research

**Domain:** overlay desktop transparente, sempre no topo, uma janela por monitor (Windows, macOS, Linux), que mostra o estado de sessões do Claude Code
**Researched:** 2026-11-21
**Confidence:** MEDIUM (APIs e versões: documentação oficial lida diretamente; consumo de memória/CPU do Tauri neste caso de uso: **não medido**, só hipótese; o seam `classify-confidence` devolve LOW para `webfetch`/`websearch` porque não havia Context7 nesta sessão, então a coluna "Evidência" abaixo diz de onde vem cada afirmação)

Escopo: só o que o próximo milestone exige. Não reavalia o sistema atual (Electron 45.4.1 + Node + HTML/CSS/JS puro, pnpm, `node:test`).

---

## Veredito em oito linhas

1. **Base tecnológica: Electron 45.4.1 continua sendo o baseline; Tauri 2.12.7 entra como candidato a ser provado, não como favorito.** No Windows o WebView2 é o mesmo Chromium (runtime 157 nesta máquina, Electron 45 traz 156): o custo do renderer é praticamente o mesmo. O que o Tauri elimina é o binário principal do Electron e, talvez, um processo. Expectativa (hipótese, a medir): economia de 15% a 40% no Windows, não de 80%.
2. **Antes de comparar tecnologias, tirar dois confundidores do Electron:** (a) os 426 MB são **working set somado**, que conta páginas compartilhadas várias vezes; o número comparável é *private working set*; (b) o `@keyframes glow` do `index.html` anima `box-shadow` em loop infinito, inclusive com a pílula `idle` (opacity 0): é repintura na main thread, provavelmente a maior parte dos ~1,5% de CPU, e **é idêntica no Tauri** (mesmo Chromium).
3. **Cada janela = um processo renderer, nas duas tecnologias.** A alavanca de memória que independe de tecnologia é ter menos janelas: um modo "uma ilha só" (monitor principal / seguir o cursor), que o mod de referência já tem.
4. **Tauri não tem o `forward` do Electron.** Ignorar eventos do cursor esconde também o `mousemove`. A saída documentada é fazer polling de `cursor_position()` no Rust e alternar `set_ignore_cursor_events`. Como o milestone já pede "hover pela posição do cursor" (o mod lê `GetCursorPos` a cada quadro), esse ponto fraco do Tauri vira requisito comum às duas bases.
5. **Mola: escrever à mão (~25 linhas, `spring.js`), sem biblioteca.** Testei o integrador aqui: 5,9% de overshoot crescendo (k=380, c=26), zero encolhendo (k=200, c=28), ~0,6 µs por quadro. O rAF **estaciona** quando as molas assentam.
6. **Zero dependência nova, com uma exceção condicional:** detecção de tela cheia no Windows. Sem addon nativo, só `koffi` 3.3.8 (FFI com binário pré-compilado, MIT) evita um PowerShell residente de ~40 MB; no Tauri sai de graça com a crate `windows`.
7. **Preferências:** JSON em `userData` com escrita atômica (temp + rename), igual a `positions.json` e `writeDecision`. **Atalho global:** `globalShortcut` do Electron. **Menu:** `Menu.popup()`. Nada disso pede pacote.
8. **Trabalho do milestone que é portável nas duas bases** (mola, temas, formas, material, nudge, tudo em `index.html`/`spring.js`) pode começar já; o que custa portar para Rust é o lado `main` (prefs, atalho, tela cheia, menu, polling de hover). Esse só deve ser feito **depois** do gate de decisão.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended | Evidência / Confiança |
|------------|---------|---------|-----------------|-----------------------|
| Electron | 45.4.1 (estável mais recente em 2026-11-18; Chromium 156.0.8078.100, Node 24.22.3; 46 está em alpha) | Shell desktop, processo `main`, janelas por monitor | Já entrega tudo que o milestone pede com API embutida: `setIgnoreMouseEvents(…, {forward})` (Win/mac), `setAlwaysOnTop(true,'screen-saver')` (nível acima da barra de tarefas no Windows), `focusable:false`, `globalShortcut`, `Menu.popup`, `screen.getCursorScreenPoint`. Custo de troca (porta de ~600 linhas de JS + lógica de segurança duplicada) só se justifica com ganho medido | doc oficial lida (releases.electronjs.org, API docs) / HIGH |
| Tauri (crate `tauri`, CLI, `@tauri-apps/api`) | `tauri` 2.12.7 (2026-11-18), `tauri-cli` 2.12.6, `@tauri-apps/api` 2.12.5 | **Só no spike** (candidato) | Binário pequeno (instalador ~1 MB num app mínimo, segundo medição de terceiros), acesso direto a Win32 via crate `windows`. Contra: WebView2 = Chromium (ganho de memória limitado), sem `forward`, sem NSPanel no macOS, WebKitGTK no Linux | docs.rs + v2.tauri.app lidos / HIGH para API; **LOW para ganho de memória (não medido)** |
| WebView2 Runtime | já instalado: 157.0.4341.60 | Motor do Tauri no Windows | Win10 1803+ e Win11 já trazem; mesmo motor do Edge, atualiza sozinho | verificado nesta máquina (registro) e doc oficial / HIGH |
| Node.js (hooks, testes) | sistema (v26.4.0 aqui); main do Electron roda Node 24.22.3 embutido | `hook.js`, `permission-hook.js`, `install.js`, `node --test` | Sem mudança. **Atenção:** os hooks do Claude Code continuam em Node mesmo se o `main` virar Rust; `state.js` seria compartilhado por Node (hooks) e por uma reimplementação Rust (ver "Custo de porte") | código lido / HIGH |
| pnpm | 11.10.0 (já fixado) | Gerenciador | Sem mudança. Se entrar `koffi`, pnpm 11 trava scripts de build: pode exigir `koffi: true` em `allowBuilds` de `pnpm-workspace.yaml` (a conferir no spike) | `package.json` lido; comportamento do koffi com pnpm **não verificado** / LOW |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| *(nenhuma)* `spring.js` próprio | n/a | Mola semi-implícita, passos de 0,5 ms | Sempre; carregado por `<script src>` no `index.html` e exportado com guarda `typeof module` para o `node:test` |
| *(nenhuma)* `prefs.json` em `app.getPath('userData')` | n/a | Tema, forma, estilo de animação, fixar aberta, transparência, âncora, deslocamento, atalho | Sempre. Validação pura em `state.js` (lista fechada de valores), escrita atômica |
| `globalShortcut` (embutido no Electron) | n/a | Ctrl+Alt+C esconder/mostrar | Sempre no Electron. `register()` devolve `false` se a combinação já estiver tomada: tratar |
| `Menu.buildFromTemplate().popup()` (embutido) | n/a | Menu de clique direito nativo | Sempre no Electron (testar dispensa do menu com janela `focusable:false`, ver Pitfalls) |
| `koffi` | 3.3.8 (MIT, pacote 1,7 MB, sem `dependencies`, 20 `optionalDependencies` de binários por plataforma) | Chamar `user32.dll` (`GetForegroundWindow`, `GetWindowRect`, `MonitorFromWindow`, `GetMonitorInfoW`, `GetClassNameW`) para detectar tela cheia **e** localizar a janela do Windhawk | **Somente se o Electron for mantido e só no Windows**, carregado com `require` dentro de `if (process.platform === 'win32')`. Script `install` do pacote é `cnoke … --prebuild` (sem `postinstall`): conferir se o pnpm 11 pede aprovação |
| `windows` (crate Rust) | versão a fixar no spike | Mesmas chamadas Win32 | **Somente se o Tauri vencer** |
| `tauri-plugin-global-shortcut` | 2.x (exige Rust 1.90+; há 1.99.1 instalado) | Atalho global | **Somente se o Tauri vencer** |
| `tauri-nspanel` (terceiro) | a pesquisar | Janela acima de apps em tela cheia no macOS | **Somente se o Tauri vencer**; no Electron o equivalente já existe (`visibleOnFullScreen`) |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `scripts/measure-footprint.ps1` (a criar no spike; código abaixo) | Soma a árvore de processos e mede memória e CPU | Validado aqui contra a árvore do Edge: `WorkingSet` somado deu 2868 MB e *private working set* 1643 MB (43% menos). É o mesmo viés que infla os 426 MB |
| Rust 1.99.1 + MSVC Build Tools 2022 (`stable-x86_64-pc-windows-msvc`) | Compilar o scaffold Tauri | **Já instalados nesta máquina** (verificado: `rustc`, `vswhere`, `rustup show`): o spike não exige instalar nada |
| `@tauri-apps/cli` 2.12.x (devDependency do diretório do spike, não do projeto) | `pnpm tauri build` | Manter o spike em pasta separada (`spike/tauri/`) para não sujar o `package.json` do app |
| `node --test` | Testes de `spring.js` e de validação de prefs | Sem Jest/Vitest, igual hoje |

---

## 1. Electron 45 × Tauri 2.12: capacidade por capacidade

Legenda de evidência: **[doc]** documentação oficial lida; **[issue]** issue/changelog público; **[local]** medido ou verificado nesta máquina; **[infer]** inferência minha; **[?]** não verificado.

| Capacidade | Electron 45.4.1 | Tauri 2.12.7 | Efeito na decisão |
|---|---|---|---|
| Transparência | `transparent:true` + `frame:false` (já em uso). Windows: ok | `transparent(true)` + `decorations(false)`; no Windows `shadow(false)` (com `shadow:true` a janela sem decoração ganha borda branca de 1 px e cantos arredondados) e fundo da webview alfa 0; flash branco na criação é conhecido, mitigação: criar oculta e mostrar depois, `html,body{background:transparent}` **[doc][issue]** | Tauri exige cuidado, não bloqueia. Gate visual no spike |
| Clique atravessando | `setIgnoreMouseEvents(true,{forward:true})`: **Windows e macOS**; Linux aceita `ignore` (X11 e Wayland) mas sem `forward`. No Windows o `forward` para quando uma janela elevada (Gerenciador de Tarefas) ganha o foco (UIPI) **[doc]** | `set_ignore_cursor_events(bool)` **sem `forward`**; issue #9250 fechada com `cursor_position()` (abr/2024) como saída: polling no Rust e alternância do flag **[doc][issue]** | Diferença estrutural. Polling de posição resolve as duas bases e é imune ao UIPI |
| Sempre no topo, acima de tela cheia | `setAlwaysOnTop(true,'screen-saver')`: níveis `pop-up-menu` e acima ficam acima da barra de tarefas (Win/mac). **Não suportado no Wayland.** macOS: `setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true})` (já em uso) **[doc]** | `always_on_top(true)`; Windows ok (HWND_TOPMOST **[infer]**). macOS acima de apps em tela cheia **exige NSPanel** (`tauri-nspanel`, terceiro) segundo relato de quem fez overlay; `visible_on_all_workspaces` não existe no Windows **[doc][issue]** | macOS favorece o Electron |
| Não focável | `focusable:false` (já em uso) | `focusable(false)` (config e builder). **Armadilha:** tao 0.37.1 (set/2026) faz janela criada com `with_focused(false)` ganhar foco em `set_visible(true)` no Windows. Esconder/mostrar pelo atalho global **não pode** usar `set_visible` sem testar roubo de foco; criar com `focusable(false)` e conferir **[issue]** | Gate: clicar na pílula não pode tirar o foco do Windows Terminal |
| Uma janela por monitor | `new BrowserWindow` por `display`; **1 processo renderer por janela** (doc de process model; `affinity` foi removido) **[doc]** | `WebviewWindowBuilder` por `available_monitors()`; WebView2: browser/GPU/utility compartilhados no mesmo *environment*, **1 renderer por webview** (docs Microsoft) **[doc]** | Empate. Memória escala com nº de janelas nas duas |
| DPI por monitor | `setBounds` com tamanho explícito (já em uso por causa do bug de escala fracionária). Coordenadas em DIP | Posição lógica convertida com a escala do monitor *atual* da janela, não do destino: há relatos de janela no monitor errado ao reaplicar posição salva (tauri #7890, tao #816). Converter com a escala do monitor-alvo **[issue]** | Gate com os dois monitores do autor (100% e 125%) |
| Atalho global | `globalShortcut` embutido. Wayland: via portal XDG, **ligado por padrão**; exige `desktopName` em DNS reverso igual ao `.desktop` instalado (no GNOME 50 um ID inválido nega **silenciosamente**) **[doc]** | `tauri-plugin-global-shortcut`, permissões em `capabilities`, Rust 1.90+. Doc não cita Wayland; relatos antigos dizem que não funciona **[doc][issue]** | Electron melhor no Linux |
| Menu de contexto nativo | `Menu.popup()` | `Menu` do `@tauri-apps/api` (muda) | Empate |
| Posição do cursor | `screen.getCursorScreenPoint()` em DIP. **Não suportado no Wayland** **[doc]** | `AppHandle::cursor_position() -> PhysicalPosition<f64>` (origem = monitor principal no Windows/mac; monitor mais à esquerda no X11) **[doc]** | Empate; Wayland nativo quebra os dois |
| App sem bandeja/Dock | já é sem bandeja. **Falta `app.dock.hide()` no macOS** (hoje aparece no Dock) **[infer]**: conferir no código, não achei chamada em `main.js` | `ActivationPolicy::Accessory` no macOS **[issue]** | Uma linha em qualquer das bases |
| Tamanho | binário principal ~235 MB em disco, instalador ~106 MB (app mínimo de terceiros) | instalador ~1 MB (app mínimo de terceiros). Qualquer distribuição por GitHub Release passa a exigir binários por SO, em vez de `pnpm install && pnpm start` | Hoje o app é "fonte + `pnpm start`": o Tauri **troca** o pré-requisito Node/pnpm pelo de Rust + MSVC (ou obriga a publicar binários) |
| Memória (Windows, 1 janela, app mínimo) | ~149 MB (1 execução) | ~142 MB (mediana de 5), ambos em *private bytes* somando todos os processos. Diferença de ~5% **[issue: blog de terceiros, método só em parte descrito]** | Evidência a favor de "Tauri não resolve memória no Windows". **LOW**: um único medidor, um app mínimo |
| Memória reportada de overlay Tauri "14 MB" | n/a | Relato de overlay em Windows 11 com ~14 MB e <1% de CPU **[issue]** | **Descartar:** quase certamente mede só o processo do app e não os `msedgewebview2.exe` filhos. É exatamente o erro que o protocolo abaixo evita |
| Wayland (Linux) | Electron ≥38.2 usa Wayland nativo por padrão. Em Wayland **não** funcionam `setAlwaysOnTop`, `setPosition`, `getBounds`, `getCursorScreenPoint`; redimensionar é restrito. A saída oficial é Xwayland com `--ozone-platform=x11` **[doc]** | GTK: `set_keep_above` é no-op no Wayland; transparência é problemática; saída equivalente `GDK_BACKEND=x11`. Layer-shell só em compositores que o implementam (não GNOME) **[infer]** | **Linux: forçar X11/XWayland nas duas bases** (ver Pitfalls). Wayland nativo está fora de escopo |

### Custo de porte Node → Rust (se o Tauri vencer)

| Peça atual | Linhas | O que vira | Risco |
|---|---|---|---|
| `main.js` (janelas, polling 400 ms, heartbeat 2 s, IPC, posições) | 301 | Rust: `std::thread` + `fs::read_dir`, `emit` de eventos, `#[tauri::command]` | Médio. Mecânico, mas é onde mora a fronteira de confiança |
| `state.js` (`pickState`, `validPermission`, `decisionOutput`, limites de texto) | 196 | **Duas implementações** (Node para os hooks, Rust para o `main`) ou deixar o `pickState` no JS do renderer e só validar a permissão no Rust | **Alto.** Divergência entre a validação dos hooks e a do `main` é falha de segurança. Exigiria testes de conformidade comuns (mesmos vetores JSON nos dois lados) |
| `window.js` (PowerShell/osascript/xdotool) | 107 | Pode ficar como `std::process::Command` equivalente; Win32 direto (crate `windows`) elimina os ~0,4 s do PowerShell | Baixo |
| `preload.js` + `contextBridge` | 12 | `initialization_script` com um shim `window.island` sobre `window.__TAURI__` | Baixo |
| `hook.js` (spawn do app) | n/a | Passa a lançar o `.exe` do Tauri em vez de `require('electron')` | Médio: mudança de contrato com `install.js` |
| Estimativa total | ~600 linhas JS | **~800 a 1100 linhas de Rust** + testes **[infer, não medido]** | Em troca de ganho de memória que, no Windows, a evidência acima aponta como pequeno |

---

## 2. Protocolo de medição do spike (barato e comparável)

### Variantes (todas com o mesmo `index.html`, nos mesmos 2 monitores, mesmo polling de 400 ms + heartbeat de 2 s)

| ID | O que é | Custo | Para quê |
|---|---|---|---|
| **E0** | Electron atual, sem mudar nada | 0 | Linha de base. Repetir a medição de 426 MB com *private working set* |
| **E1** | E0 + `ISLAND_NO_ANIM=1` (injeta `*{animation:none!important}` pelo `preload.js`, **sem editar** `index.html`) | 3 linhas | Quanto da CPU é CSS. Hipótese: a maior parte |
| **E2** | E1 + `app.commandLine.appendSwitch('in-process-gpu')` | 1 linha | Tira o processo de GPU. **Não verificado** no Electron 45 (a flag existe no Chromium); descartar se instável. A doc do WebView2 desaconselha desligar a GPU (`disable-gpu`) por prejudicar desempenho: não testar essa |
| **E3** | E1 com **uma só janela** no monitor do cursor ("seguir") | ~20 linhas | Remove 1 renderer. Medir a redução real por janela |
| **T0** | Scaffold Tauri (abaixo), mesmas 2 janelas, mesma carga de polling | ~1 h | Candidato |

### Cenários (cada um por 60 s, 3 execuções, usar a **mediana**)

- **S0:** nenhuma sessão (pílula `idle`).
- **S1:** uma sessão `running` (grava um JSON em `~/.claude/island/` igual ao do `hook.js`): animações ligadas.
- **S2:** pedido de permissão aberto (caixa de texto no tamanho máximo).
- Cada um **com e sem animações CSS** (E1 cobre o "sem" no Electron; no Tauri usar a mesma injeção).

### O que medir e por quê

| Métrica | Como | Por que |
|---|---|---|
| **Private working set** somado (métrica principal) | `Win32_PerfFormattedData_PerfProc_Process.WorkingSetPrivate`; é o "Memória (conjunto de trabalho privado ativo)" do Gerenciador de Tarefas | Não conta páginas compartilhadas (DLLs do Chromium, que o Electron e o WebView2 carregam em todos os processos). Sem isso o número de qualquer das duas bases fica inflado e a comparação é injusta |
| Working set somado | `Get-Process … WorkingSet64` | Só para reconciliar com os 426 MB já registrados |
| Private bytes (commit) | `PrivateMemorySize64` | Métrica usada no único benchmark de terceiros do Windows achado; permite comparar |
| Contagem de processos | `Get-Process` filtrado pela árvore | Mostra o que sobra no Tauri (`msedgewebview2.exe`: browser, GPU, utility, 1 renderer por janela) |
| CPU | Delta de `TotalProcessorTime` de toda a árvore ÷ 60 s ÷ nº de CPUs lógicas (20 aqui) | A "% do total" é a do Gerenciador de Tarefas; reportar também "% de um núcleo" (os ~1,5% atuais) |
| Início até o primeiro quadro | Cronômetro externo até um arquivo-marcador gravado pelo shim no primeiro `requestAnimationFrame` depois do `load` (mesmo código em `preload.js` e em `initialization_script`) | Uniforme nas duas bases e sem editar o `index.html`. Fazer 1 execução "fria" (sem `msedgewebview2`/Edge rodando) e 3 "quentes": a doc da Microsoft diz que com o Edge aberto os binários já estão em memória |
| Tamanho instalado | Pasta do app (Electron: `node_modules/electron/dist`; Tauri: `.exe` do `tauri build`) | Contexto, não decide |

**Cuidados:** (1) fechar tudo que use WebView2 (Teams, Widgets, Edge) antes de medir, senão o browser process compartilhado contamina o Tauri; (2) medir com o monitor 125% e o 100% ligados, é o cenário real do autor; (3) registrar versões (Electron 45.4.1 / Chromium 156; WebView2 157.0.4341.60; tauri 2.12.7).

### Script de medição (validado aqui contra uma árvore real; não toca no app)

Salvar como `scripts/measure-footprint.ps1` e chamar `pwsh -File scripts/measure-footprint.ps1 -RootPid <pid do electron.exe ou do .exe do Tauri> -Seconds 60`.

```powershell
param([Parameter(Mandatory)][int]$RootPid, [int]$Seconds = 60)
function Get-Tree([int]$root) {   # processo raiz + todos os descendentes (inclui msedgewebview2.exe)
  $all = Get-CimInstance Win32_Process -Property ProcessId, ParentProcessId
  $ids = [System.Collections.Generic.HashSet[int]]::new(); [void]$ids.Add($root)
  do { $before = $ids.Count
       foreach ($p in $all) { if ($ids.Contains([int]$p.ParentProcessId)) { [void]$ids.Add([int]$p.ProcessId) } }
  } while ($ids.Count -ne $before)
  $ids
}
function Get-Mem($ids) {
  $perf  = Get-CimInstance Win32_PerfFormattedData_PerfProc_Process | Where-Object { $ids.Contains([int]$_.IDProcess) }
  $procs = Get-Process -Id ([int[]]$ids) -ErrorAction SilentlyContinue
  [pscustomobject]@{
    Processes      = $procs.Count
    WorkingSetMB   = [math]::Round(($procs | Measure-Object WorkingSet64 -Sum).Sum / 1MB, 1)
    PrivateWSMB    = [math]::Round(($perf  | Measure-Object WorkingSetPrivate -Sum).Sum / 1MB, 1)  # métrica principal
    PrivateBytesMB = [math]::Round(($procs | Measure-Object PrivateMemorySize64 -Sum).Sum / 1MB, 1)
  }
}
function Get-Cpu($ids) { (Get-Process -Id ([int[]]$ids) | ForEach-Object { $_.TotalProcessorTime.TotalSeconds } | Measure-Object -Sum).Sum }
Get-Mem (Get-Tree $RootPid) | Format-List
$t0 = Get-Cpu (Get-Tree $RootPid); Start-Sleep -Seconds $Seconds; $t1 = Get-Cpu (Get-Tree $RootPid)
$cores = [Environment]::ProcessorCount
"CPU: {0:N2}% do total ({1} lógicos), {2:N2}% de um núcleo" -f ((($t1-$t0)/$Seconds/$cores)*100), $cores, ((($t1-$t0)/$Seconds)*100)
```

Limitação conhecida: se um processo da árvore morrer durante os 60 s o delta de CPU fica um pouco subestimado; irrelevante para um app estável.

### Regra de decisão (escrever **antes** de medir)

Adotar Tauri **somente se todos** forem verdadeiros; senão, ficar no Electron:

1. **Gates funcionais no Windows com os 2 monitores (100% e 125%)**, todos passando: transparência sem borda branca nem flash; hover pelo polling de `cursor_position` sem perder clique; clicar na pílula **não** tira o foco do Windows Terminal; fica acima de um vídeo em F11/jogo em janela sem borda; posição correta nos dois monitores ao reiniciar; esconder/mostrar pelo atalho sem roubar foco.
2. **Memória:** *private working set* do T0 em S0 ≤ **60%** do melhor Electron entre E1, E2 e E3 (ou seja, ≥40% de economia sobre o Electron já otimizado, não sobre o E0).
3. **CPU em S1** do T0 não maior que a do E1.
4. Plano para os 3 itens de custo estrutural: lógica de segurança duplicada (testes de conformidade), distribuição por binário, NSPanel no macOS.

Expectativa registrada hoje (para checar depois, não para decidir): E1 reduz a CPU mais que qualquer troca de base; E3 reduz a memória em ~uma janela de renderer (80 a 100 MB de working set por janela, a partir dos 426 MB / 5 processos); T0 fica perto de E3 no Windows.

---

## 3. Scaffold Tauri mínimo que carrega o `index.html` **sem alterá-lo**

Não compilado nem executado (restrição desta pesquisa): assinaturas conferidas na doc de 2.12.7, mas ajustar o que o compilador reclamar. Tempo estimado de primeira compilação: alguns minutos; o toolchain já está instalado.

```
spike/tauri/
  package.json                    # só "@tauri-apps/cli": "^2.12" em devDependencies
  ui/index.html                   # CÓPIA bit a bit de ../../index.html (copiar no script de build)
  src-tauri/
    Cargo.toml                    # tauri = "2.12"; (global-shortcut e windows só depois do gate)
    tauri.conf.json
    capabilities/default.json     # "core:default" + "core:window:allow-set-ignore-cursor-events"
    src/main.rs
```

`tauri.conf.json` (mínimo; `windows` vazio para o Tauri **não** criar a janela padrão):

```json
{
  "productName": "claude-island-spike",
  "identifier": "dev.marcelo-mo.claude-island-spike",
  "build": { "frontendDist": "../ui" },
  "app": { "withGlobalTauri": true, "windows": [], "security": { "csp": null } },
  "bundle": { "active": false }
}
```

Pontos que não são óbvios:

- **`frontendDist` embute o diretório inteiro no binário.** Apontar para a raiz do repositório embutiria `node_modules/` e `.planning/`. Por isso a cópia em `ui/`.
- **O `index.html` chama `window.island.*`, que no Electron vem do `preload.js`.** No Tauri não há preload: um `initialization_script` (roda **antes** do HTML ser analisado, só no frame principal) define o mesmo objeto sobre `window.__TAURI__` (exige `withGlobalTauri: true`). O arquivo da UI fica intacto.
- Mapeamento do shim (7 métodos de `preload.js`): `onState` ← `__TAURI__.event.listen('island:state')`; `setHover/focusSession/decide/drag/endDrag/resetPosition` ← `__TAURI__.core.invoke(...)`. No **spike** basta `onState` real e os demais como no-op: o que se mede é memória e CPU, não funcionalidade.
- Janelas: uma por `app.available_monitors()`, tamanho 440×324 lógicos, **criar com `focusable(false)`** (não `focused(false)`; ver tao 0.37.1), `transparent(true)`, `decorations(false)`, `shadow(false)`, `resizable(false)`, `always_on_top(true)`, `skip_taskbar(true)`, `.initialization_script(SHIM)`. Posição: converter `monitor.position()` (física) para lógica com `monitor.scale_factor()` **daquele** monitor.
- **Carga equivalente:** uma `std::thread` com `sleep(400 ms)` lendo `~/.claude/island/*.json` e emitindo evento só quando muda, mais gravação de heartbeat a cada 2 s. Sem isso o CPU do Tauri sairia artificialmente baixo.

Esqueleto de `main.rs` (ilustrativo):

```rust
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

const SHIM: &str = include_str!("shim.js"); // define window.island sobre window.__TAURI__

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            for (i, monitor) in app.available_monitors()?.iter().enumerate() {
                let scale = monitor.scale_factor();
                let pos = monitor.position().to_logical::<f64>(scale);
                WebviewWindowBuilder::new(app, format!("island-{i}"), WebviewUrl::App("index.html".into()))
                    .inner_size(440.0, 324.0)
                    .position(pos.x + (monitor.size().to_logical::<f64>(scale).width - 440.0) / 2.0, pos.y + 8.0)
                    .transparent(true).decorations(false).shadow(false).resizable(false)
                    .always_on_top(true).skip_taskbar(true).focusable(false)
                    .initialization_script(SHIM)
                    .build()?;
            }
            // thread de polling de 400 ms + heartbeat de 2 s aqui
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("falha ao iniciar o Tauri");
}
```

---

## 4. Animação por mola: escrever à mão

**Recomendação: `spring.js` próprio, integração semi-implícita (symplectic Euler) em passos fixos de 0,5 ms, massa 1, uma mola por dimensão.** É literalmente o algoritmo do mod de referência (`SpringValue`), então o porte é fiel e a atribuição MIT cobre o trecho; uma biblioteca (`motion`, `popmotion`, `react-spring`) acrescentaria dependência para entregar *menos*: o comportamento pedido (constantes assimétricas por direção, alvo trocado no meio mantendo a velocidade, multiplicadores por estilo, `dt` escalado pela "velocidade") é 25 linhas e não vem pronto em nenhuma. `linear()` do CSS só aproxima uma mola fixa e não é interrompível com velocidade preservada: descartado.

Código testado em Node 26 (ainda não no renderer; a aritmética é a mesma):

```js
// spring.js: carregado por <script src> no index.html; exportado só quando há `module` (testes).
class Spring {
  constructor(value) { this.value = value; this.velocity = 0; this.target = value; this.k = 280; this.c = 24; }
  // Trocar o alvo no meio do movimento mantém value e velocity: é o que torna a mola interrompível.
  retarget(target, k, c) { this.target = target; this.k = k; this.c = c; }
  get atRest() { return Math.abs(this.target - this.value) < 0.05 && Math.abs(this.velocity) < 0.5; }
  step(elapsedMs) {
    // Teto de 50 ms: uma janela voltando de oclusão não pode disparar milhares de sub-passos.
    let remaining = Math.min(elapsedMs, 50) / 1000;
    while (remaining > 0) {
      const h = Math.min(0.0005, remaining);
      this.velocity += (this.k * (this.target - this.value) - this.c * this.velocity) * h;
      this.value += this.velocity * h;
      remaining -= h;
    }
    if (this.atRest) { this.value = this.target; this.velocity = 0; }
  }
}
if (typeof module !== 'undefined') module.exports = { Spring };
```

Resultados medidos aqui (constantes do `WINDHAWK-MOD.md`): crescendo k=380/c=26 dá **5,9% de overshoot** (teoria ζ≈0,67 → 6,0%) e assenta (critério 0,05 px e 0,5 px/s) em ~0,6 s; encolhendo k=200/c=28 dá **mínimo 0,000, sem overshoot**; custo ~0,6 µs por quadro (33 sub-passos). Os estilos são só multiplicadores de `k` e `c` (tabela do mod): uma constante de dados, não código.

### Estacionar o rAF (o ponto que decide o custo em repouso)

```js
const springs = [widthSpring, heightSpring, radiusSpring];
let rafId = 0, last = 0;
function frame(now) {
  rafId = 0;
  const elapsed = last ? now - last : 16.7; last = now;
  for (const spring of springs) spring.step(elapsed);
  applyToPill();                                   // escreve width/height/border-radius em #pill
  if (springs.some((spring) => !spring.atRest)) schedule(); else last = 0;  // assentou: para de pedir quadros
}
function schedule() { if (!rafId && !document.hidden) rafId = requestAnimationFrame(frame); }
document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = 0; schedule(); } });
// todo retarget() termina com schedule()
```

Regras que mantêm a CPU em ~0 quando nada se move:

1. **O loop só existe enquanto alguma mola não assentou.** Não é loop contínuo.
2. **Não confiar no throttling do Chromium** para janela escondida: `win.hide()` torna a página `hidden` e o rAF para, mas a oclusão nativa no Windows pode não considerar uma janela transparente sempre no topo como "oclusa" (inferência; a doc do Chromium trata janelas totalmente visíveis). Estacionar por conta própria e, ao esconder pelo atalho, o `main` avisa o renderer (`island:visible`) para pausar também as animações CSS.
3. **O `glow` atual é o suspeito principal da CPU em repouso:** anima `box-shadow` com blur de 16 px, em loop infinito, também com `#pill[data-state="idle"]` (opacity 0). `box-shadow` não é composto na GPU: repinta na main thread a cada quadro, em cada janela. Trocar por um pseudo-elemento com a sombra estática e **animar só `opacity`/`transform`** (compositor), e `animation: none` em `idle` e quando a janela está escondida. Isto vale para Electron e Tauri.
4. **Animar `width`/`height`/`border-radius` do `#pill` dentro de um palco de tamanho fixo**, nunca redimensionar a janela (o próprio `moveIsland` já registra o bug de tamanho em escala fracionária no Windows). O palco precisa de folga para o overshoot: 6% do deslocamento (até ~24 px em 400 px) cabe nos 20 px de folga horizontal, mas **a altura de 324 px é o máximo exato do pedido de permissão**: o overshoot vertical seria cortado. Acrescentar ~16 px de altura à janela.
5. `elapsed` vem do timestamp do rAF (`performance.now()`), não de `Date.now()`; a "velocidade" do usuário (0,5× a 2×) multiplica o `elapsed` antes de `step`.
6. **Um teste `node:test`** em `island.test.js`: overshoot em torno de 6% ao crescer, ≤ 0 ao encolher, `retarget` no meio preserva `velocity`, `atRest` verdadeiro no fim.

---

## 5. Demais escolhas que o milestone implica

| Necessidade | Escolha | Por quê | Descartado |
|---|---|---|---|
| Preferências persistidas | `prefs.json` em `userData`, objeto plano, **validação por lista fechada em `state.js`** (tema ∈ 8+auto, forma ∈ 3, etc.), escrita atômica temp+rename | Mesmo padrão de `positions.json` e `writeDecision`; o arquivo é editável à mão, então valida no ponto de uso (regra já documentada em ARCHITECTURE.md). Pode absorver `positions.json` no mesmo arquivo | `electron-store`/`conf` (dependência para ~15 linhas), `tauri-plugin-store` |
| Atalho global esconder/mostrar | `globalShortcut.register` + estacionar rAF/animações ao esconder | Embutido; `register` devolve `false` se tomado. **Atenção pt-BR:** Ctrl+Alt equivale a AltGr no layout ABNT2, e AltGr+C produz um caractere (¢); registrar Ctrl+Alt+C como atalho global **rouba essa digitação** no sistema todo (hipótese a confirmar). Deixar a combinação configurável e tratar o `false` | `uiohook-napi`/hooks globais de teclado (addon nativo e superfície de keylogger) |
| Esconder com app em tela cheia (Windows) | Polling de **2 Hz**: `GetForegroundWindow` → ignorar janela própria (`GetWindowThreadProcessId`), `Progman`/`WorkerW` (`GetClassNameW`) → `GetWindowRect` contra `GetMonitorInfoW(MonitorFromWindow(…))`; cobre o monitor ⇒ esconder **aquela** ilha. Comparar contra `screen.dipToScreenRect(null, display.bounds)` | É o algoritmo do mod (client rect cobre o monitor, a cada 0,5 s) e dá por monitor, não global. Sem notificação do sistema: a doc de `SHQueryUserNotificationState` diz que **não há evento** ao entrar/sair de tela cheia, então polling é obrigatório | PowerShell residente (`Add-Type` compila com `csc.exe` ~1 s e o `powershell.exe` custa ~40 MB, no mesmo app que se quer enxugar); `SHQueryUserNotificationState` (não diz **qual** monitor; semântica por monitor não verificada); `active-win`/`node-window-manager` (addon nativo com rebuild) |
| Hover pela posição do cursor | No `main`, `screen.getCursorScreenPoint()` ~60 Hz **só** com a pílula visível (estado ≠ `idle` ou fixada) e o cursor dentro do retângulo da janela + margem; fora disso ~10 Hz; **zero** com a ilha `idle`. Testa contra o retângulo-alvo da mola, não contra o DOM | Resolve mouseenter perdido quando a pílula anda sob um cursor parado (o `index.html` já tem remendos para isso), é imune ao UIPI do `forward`, funciona igual no Tauri e dá hover no Linux/X11 (hoje desligado por `CAN_CLICK_THROUGH`). Projeto meu, custo a medir no spike | Manter só `forward` (quebra com janela elevada em foco; não existe no Tauri) |
| Menu de clique direito | `Menu.popup()` no `contextmenu` do renderer via IPC | Embutido. **Testar** em janela `focusable:false`: o fechamento por clique fora costuma depender de foco (relato geral, sem confirmação específica do Electron). Plano B: `popup({window})` com ativação momentânea, ou menu desenhado no próprio HTML | Biblioteca de menu |
| Coexistir com a ilha do Windhawk (milestone 3) | Mesmas chamadas Win32 do item de tela cheia: `FindWindowW('Windhawk.DynamicIslandForWindows', …)` (classe ainda **não confirmada**) + `GetWindowRect` para encaixar ao lado | Reaproveita o `koffi` (ou a crate `windows`): sem segunda dependência | Pipe/API do mod (não existe, ver `WINDHAWK-MOD.md`) |
| macOS: sem ícone no Dock | `app.dock?.hide()` no Electron; `ActivationPolicy::Accessory` no Tauri | Uma linha | n/a |
| Linux: coordenadas/topmost | Forçar X11/XWayland: `--ozone-platform=x11` na **linha de comando** do spawn feito por `hook.js` (o `appendSwitch` em JS pode chegar tarde para essa flag: **não verificado**). Tauri: `GDK_BACKEND=x11` antes de iniciar o GTK | Em Wayland nativo as duas bases perdem `setPosition`, `alwaysOnTop` e `cursor_position` | Wayland nativo com layer-shell: fora de escopo |

---

## Installation

```bash
# Mudança mínima no projeto (Electron mantido): nada para instalar.
#   spring.js, prefs.json, atalho, menu = código próprio / API embutida.

# SOMENTE se a detecção de tela cheia / convivência com o Windhawk for aprovada no Electron:
pnpm add koffi@3.3.8
#   conferir se o pnpm 11 pede "allowBuilds: koffi: true" em pnpm-workspace.yaml (não verificado)

# Spike do Tauri (em pasta separada, não altera o package.json do app):
mkdir -p spike/tauri && cd spike/tauri
pnpm add -D @tauri-apps/cli@^2.12
pnpm tauri build --no-bundle        # compila o .exe sem instalador; toolchain já instalado aqui
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Electron 45.4.1 (baseline) | Tauri 2.12.7 | Se passar a regra de decisão (≥40% de economia sobre o Electron já otimizado **e** todos os gates). Também se macOS/Linux ganharem peso: WKWebView/WebKitGTK são motores do sistema e a economia lá pode ser bem maior que no Windows (**não medido**) |
| Electron + `koffi` (tela cheia) | Tauri + crate `windows` | Se o Tauri vencer: elimina a dependência de FFI e o custo de PowerShell |
| `spring.js` próprio | `motion` / `popmotion` / `react-spring` | Nunca neste projeto: dependência para um comportamento de 25 linhas e sem o recurso de constantes assimétricas |
| JSON atômico em `userData` | `electron-store` | Só se as preferências ganharem esquema com migrações (não é o caso) |
| Polling de cursor para hover | `forward:true` somente | Se o spike mostrar que o polling custa CPU mensurável no Electron: manter `forward` no Windows/macOS e polling só onde falta |
| Janelas por monitor (comportamento atual) | Modo "uma ilha" (principal / seguir cursor) | É a **maior alavanca de memória que independe de base** (−1 renderer por monitor dispensado). Oferecer como preferência, não trocar o padrão |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Medir só com `WorkingSet`/Gerenciador de Tarefas por processo, ou só o `.exe` do app Tauri | Soma páginas compartilhadas várias vezes (aqui +43% numa árvore do Edge) e, no Tauri, esquece os `msedgewebview2.exe` filhos: gera o "14 MB" de overlay Tauri citado por aí | `WorkingSetPrivate` somado na árvore inteira (script acima) |
| Decidir a base antes de eliminar o `box-shadow` animado | A CPU atribuída ao Electron é, em boa parte, CSS que o Tauri herdaria | E1 primeiro |
| `set_visible(true)` para reexibir uma janela Tauri no Windows sem teste de foco | tao 0.37.1 passou a focar janelas criadas com `focused(false)` ao mostrar | `focusable(false)` na criação; validar o gate de foco |
| `loop` contínuo de `requestAnimationFrame` | Acorda a cada quadro em cada janela para sempre | rAF só enquanto houver mola em movimento |
| Animar `box-shadow`, `width` do contorno ou `filter` em loop infinito | Repintura na main thread | `opacity`/`transform` num pseudo-elemento |
| `disable-gpu`/`app.disableHardwareAcceleration()` para economizar memória | A doc do WebView2 desaconselha; com janela transparente a composição por software pode subir a CPU (não testado) | `in-process-gpu` (E2, a validar) ou menos janelas (E3) |
| `PowerShell` residente para observar tela cheia | `Add-Type` compila, processo extra de dezenas de MB | `koffi` (Electron) ou crate `windows` (Tauri) |
| `SHQueryUserNotificationState` como detector principal | Não diz de qual monitor; semântica por monitor não documentada | Retângulo da janela em foco × monitor, como o mod |
| `electron-store`, `tauri-plugin-store`, `uiohook-napi`, `active-win`, `node-window-manager` | Dependência/addon nativo para o que cabe em poucas linhas ou em API embutida | Código próprio / `koffi` |
| Rodar Tauri em Wayland nativo | `set_keep_above` é no-op, transparência instável, atalho global incerto | `GDK_BACKEND=x11` |

## Stack Patterns by Variant

**Se o Electron for mantido (cenário mais provável):**
- Fazer E1 (CSS) e E3 (modo "uma ilha") como entregas de produto, não só de spike.
- `koffi` só para Windows, `require` dentro de `if (process.platform === 'win32')`, para macOS/Linux não pagarem nada.
- `spring.js`, temas, formas, material: código de renderer, sem tocar no `main`.

**Se o Tauri vencer:**
- Manter hooks e `state.js` em Node; criar um conjunto de vetores JSON compartilhado (pedido de permissão válido/inválido, decisão, limites) rodado pelo `node:test` **e** por `cargo test`.
- `main` fica fino: lê arquivos, valida permissão, grava decisão; o renderer continua com `pickState` e UI.
- macOS: `tauri-nspanel` para ficar acima de tela cheia; Windows: crate `windows` no lugar do PowerShell.
- Distribuição por GitHub Release (binário por SO); `install.js` passa a registrar o caminho do `.exe`.

**Se o macOS entrar em pauta (milestone 3, apps de notch):**
- Medir também no macOS antes de generalizar qualquer número do Windows: WKWebView e WebView2 têm perfis de memória muito diferentes.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `electron@45.4.1` | Chromium 156.0.8078.100, Node 24.22.3 | Suporte oficial às 3 majors estáveis mais recentes; 46 está em alpha, 45 segue suportado enquanto estiver entre as 3 últimas |
| `tauri@2.12.7` | `tauri-cli@2.12.6`, `@tauri-apps/api@2.12.5`, `tauri-runtime-wry` 2.12.5 | Versões de 18/nov/2026. `macOSPrivateApi` virou no-op a partir da 2.12.1 (transparência no macOS sempre habilitada) |
| `tauri-plugin-global-shortcut` 2.x | Rust ≥ 1.90 | Máquina tem Rust 1.99.1 |
| WebView2 Runtime 157.0.4341.60 | Windows 11 (já presente) | Em Windows 10 muito antigo ou sem Edge, o instalador precisa embutir o bootstrapper (relato de falha em máquina limpa) |
| `koffi@3.3.8` | Node ≥ 16 (Node-API 8), Windows/Linux/macOS x64 e arm64 | Binário vem em `optionalDependencies` por plataforma; **não verificado** com Electron 45 nem com `allowBuilds` do pnpm 11. Verificar na primeira chamada de `user32.dll` dentro do Electron (preferir testar empacotado e em dev) |
| Electron `forward:true` | Windows, macOS | Linux só `ignore` |
| tao ≥ 0.37.1 | `focusable(false)` precisa de teste de foco | Mudança de comportamento no Windows (set/2026) |

## Sources

- https://releases.electronjs.org/ — Electron 45.4.1 estável (18/nov/2026), Chromium 156, Node 24.22.3; 46.0.0-alpha.12 — fonte oficial
- https://www.electronjs.org/docs/latest/tutorial/electron-timelines — política das 3 majors suportadas — oficial
- https://www.electronjs.org/docs/latest/api/browser-window — `setIgnoreMouseEvents` (`forward`: Win/mac; UIPI), `setAlwaysOnTop` (níveis; sem Wayland), `setFocusable`, `setVisibleOnAllWorkspaces`, lista de recursos sem Wayland — oficial
- https://www.electronjs.org/docs/latest/tutorial/custom-window-interactions — padrão de click-through com `forward` — oficial
- https://www.electronjs.org/docs/latest/api/screen — `getCursorScreenPoint` (DIP, sem Wayland), `display-metrics-changed` — oficial
- https://www.electronjs.org/docs/latest/api/global-shortcut — portal no Wayland ligado por padrão, `desktopName` — oficial
- https://electronjs.org/blog/tech-talk-wayland e resultados de busca — Wayland nativo por padrão desde 38.2 — blog oficial, lido só via resumo de busca (MEDIUM)
- https://www.electronjs.org/docs/latest/tutorial/process-model — um renderer por BrowserWindow; `affinity` removido (issue electron#16319, via busca) — oficial
- https://github.com/tauri-apps/tauri/releases — `tauri` 2.12.7, `tauri-cli` 2.12.6 (18/nov) — oficial
- https://docs.rs/tauri/latest/tauri/webview/struct.WebviewWindowBuilder.html e `.../struct.AppHandle.html` — métodos e notas de plataforma (tauri 2.12.7) — oficial
- https://v2.tauri.app/reference/config/ e `.../reference/javascript/api/namespacewindow/` — chaves de janela, `setIgnoreCursorEvents` sem `forward`, `cursorPosition`, `setFocusable`, `shadow`, `backgroundThrottling` (não vale no Windows) — oficial
- https://v2.tauri.app/plugin/global-shortcut/ — instalação, permissões, Rust 1.90 — oficial
- https://v2.tauri.app/start/prerequisites/ — pré-requisitos Windows/Linux — oficial
- https://v2.tauri.app/release/tao/v0.37.1/ — mudança de foco em `set_visible` (26/set/2026); v0.34.1 (`with_focusable`) — changelog oficial
- https://github.com/tauri-apps/tauri/issues/9250 — pedido de eventos de interseção com cursor ignorado; solução `cursor_position` (PR #9297, fechada 29/abr/2024) — issue; https://github.com/tauri-apps/tauri/issues/11461 — click-through com leitura de cursor, sem resolução
- https://github.com/tauri-apps/tauri/issues/7890 e tao#816 — posição em monitores com DPI diferentes — issues (LOW, versões antigas)
- https://dev.to/manasightgg/why-i-chose-tauri-v2-for-a-desktop-overlay-in-2026-597h — overlay Tauri: polling a ~60 fps de `setIgnoreCursorEvents`, NSPanel no macOS, roubo de foco no Windows, `ActivationPolicy::Accessory` — relato de terceiro (LOW); o "14 MB" foi descartado por método
- https://dawloom.com/blog/tauri-or-electron-in-2026/ — 142 MB (Tauri, mediana de 5) × 149 MB (Electron) em Windows 11, 1 janela, *private bytes* — terceiro, método parcial (LOW)
- https://learn.microsoft.com/microsoft-edge/webview2/concepts/performance — processos por WebView2, ambiente compartilhado, `disable-gpu` desaconselhado, `MemoryUsageTargetLevel`, `TrySuspendAsync` — oficial (atualizada 2026-11-02)
- https://learn.microsoft.com/en-us/windows/win32/api/shellapi/nf-shellapi-shqueryusernotificationstate — sem notificação ao entrar/sair de tela cheia — oficial
- https://registry.npmjs.org/koffi/latest — 3.3.8, MIT, 1,7 MB, script `install` com `cnoke --prebuild` — registro npm; https://koffi.dev/ — plataformas e binários pré-compilados — oficial
- https://chromium.googlesource.com/chromium/src/+/master/docs/windows_native_window_occlusion_tracking.md — oclusão nativa no Windows — oficial (inferência sobre janela transparente é minha)
- **Medições nesta máquina (2026-11-21):** `rustc 1.99.1`, MSVC Build Tools 2022, WebView2 157.0.4341.60, 20 CPUs lógicas; script de medição rodado contra a árvore do Edge (WS 2868 MB × private WS 1643 MB); `spring.js` rodado em Node 26 (5,9% / 0 / ~0,6 µs por quadro)
- Código lido: `main.js`, `window.js`, `preload.js`, `index.html`, `package.json`, `pnpm-workspace.yaml`, `.planning/codebase/*`, `.planning/research/WINDHAWK-MOD.md`

## Gaps to Address

- **Nenhum número de Tauri neste projeto existe ainda.** Toda a seção de memória do Tauri é hipótese até o T0 rodar.
- Não verificado: `in-process-gpu` no Electron 45; `koffi` dentro do Electron 45 e com `allowBuilds` do pnpm 11; classe de janela do Windhawk; popup de `Menu.popup` com `focusable:false`; AltGr+C no ABNT2; `appendSwitch('ozone-platform')` em JS; semântica de `SHQueryUserNotificationState` por monitor; se o Electron reafirma o topmost sobre a ilha do Windhawk.
- Assinaturas do esqueleto Rust não foram compiladas.
- macOS e Linux: nada foi medido nem testado; qualquer decisão de base deve declarar que vale para o Windows.
- Versão da crate `windows` e de `tauri-plugin-global-shortcut`/`tauri-nspanel` a fixar só se o Tauri vencer.

---
*Stack research for: overlay desktop transparente "Dynamic Island" multiplataforma para Claude Code*
*Researched: 2026-11-21*
