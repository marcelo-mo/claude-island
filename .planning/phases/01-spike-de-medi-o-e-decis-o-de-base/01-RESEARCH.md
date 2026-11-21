# Phase 1: Spike de medição e decisão de base - Research

**Researched:** 2026-11-21
**Domain:** medir consumo (memória/CPU) de um overlay Electron × casca Tauri no Windows 11 com PowerShell 5.1, e tirar animação contínua de repintura do `index.html`
**Confidence:** HIGH para método de medição, isolamento, casca Tauri e correção do glow (tudo executado nesta máquina nesta sessão); MEDIUM para a interpretação dos critérios da regra (ver Assumptions Log)

<user_constraints>
## User Constraints (from CONTEXT.md)

Não existe CONTEXT.md (o autor pulou o discuss-phase). Restrições vindas do orquestrador, tratadas como travadas:

### Locked Decisions
- Regra de decisão (BASE-02, ROADMAP SC1): gates funcionais no Windows com os 2 monitores **e** `private working set` do Tauri ≤ 60% do melhor Electron otimizado **e** CPU ociosa ≤ a do Electron otimizado. Escrita e commitada **antes** da primeira medição.
- Compara no mínimo: Electron atual, Electron otimizado (sem animação contínua de `box-shadow`; uma janela só) e uma casca Tauri com a mesma interface (BASE-03). O caminho de permissão ponta a ponta só é portado para o Tauri se ele passar a primeira etapa.
- Script versionado `scripts/measure-footprint.ps1`, Windows PowerShell 5.1, árvore inteira de processos (inclui `msedgewebview2.exe`), 3 execuções com mediana (BASE-01).
- BASE-05: brilho do contorno anima só `opacity`/`transform`; nenhuma animação CSS roda com a ilha parada ou escondida.
- O Electron atual é medido de novo com o mesmo script; não comparar com os 426 MB antigos.
- A casca Tauri mora em `spike/tauri/`, separada (não é dependência do app). Não instalar ferramenta global. Não tocar em `~/.claude/settings.json`. A ilha viva do autor continua rodando; outra sessão trabalha a Fase 2 em outro worktree (`claude-island-fase2`) e não reinicia a ilha.
- O autor aprovou plano → execução → verificação → review → ship sem parar.

### Claude's Discretion
- Método de lançar cada variante, de simular os cenários, do "Electron otimizado" com o menor diff, forma do glow, estrutura de planos (2 a 4, grossos).

### Deferred Ideas (OUT OF SCOPE)
- Qualquer porte de comportamento de processo principal para Tauri antes da primeira etapa da regra passar; Fases 2 a 6; macOS/Linux (declarar "decisão vale para o Windows").
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BASE-01 | Script versionado soma private WS e CPU da árvore inteira, 3 cenários, 3 execuções, mediana | Script de referência testado (seção Code Examples): árvore por `Win32_Process`, private WS por `Win32_PerfFormattedData_PerfProc_Process.WorkingSetPrivate`, CPU por delta de `KernelModeTime+UserModeTime` por PID, HOME descartável, mediana, JSON invariante de cultura |
| BASE-02 | Regra escrita e versionada antes de medir | Texto proposto em pt-BR (seção Decision Rule) + prova por `git merge-base --is-ancestor` (Validation Architecture) |
| BASE-03 | Mede Electron atual, Electron otimizado e casca Tauri com a mesma interface; permissão só portada se passar a 1ª etapa | Variantes E0/E1/E3/E2/T0 com receita de lançamento; casca Tauri compilada e verificada; Etapa 1 (numérica) antes da Etapa 2 (funcional + porte) |
| BASE-04 | Decisão e números em `PROJECT.md` (Key Decisions); se Tauri vencer, roadmap ganha fase 3.1 | Formato da tabela Key Decisions lido (`PROJECT.md:80-90`); comando de verificação por grep |
| BASE-05 | Glow só `opacity`/`transform`; nada anima parado ou escondido | CSS substituto testado no Electron 45 (0 animações em idle, pausa em `hidden`), teste `node:test` que falha no código atual e passa no novo |
</phase_requirements>

## Summary

O método de medição é **executável e já foi exercitado de ponta a ponta nesta máquina**: um script PowerShell 5.1 lança cada variante com `USERPROFILE` e `--user-data-dir` descartáveis (a instância medida não enxerga nem escreve em `~/.claude/island`, e a trava de instância única não conflita com a ilha viva), escreve uma sessão falsa por cenário, espera o aquecimento, amostra a árvore de processos a cada 5 s e soma private working set e CPU. Quatro armadilhas reais foram encontradas e têm correção testada: `Get-Counter` falha no Windows pt-BR (nomes localizados), `powershell -File` entrega listas como uma string só, o formato numérico sai com vírgula no pt-BR, e **o `komorebi` do autor retiliza a janela Tauri** (redimensiona e move) porque o Tao não marca `WS_EX_TOOLWINDOW`; sem essa correção a medição do Tauri seria inválida e o gate "posição certa nos dois monitores" falharia por motivo de configuração, não da tecnologia.

A casca Tauri **compila na primeira tentativa** com `cargo build --release --features tauri/custom-protocol` (sem CLI Node, sem `create-tauri-app`): tauri 2.12.7, 1m54s a frio nesta máquina de 20 threads, 24 a 30 s incremental, `.exe` de 8,96 MB, 432 crates travadas (~209 baixadas), 1,2 GB de `target/` (manter fora do repositório). Ela carrega o `index.html` **sem alterá-lo**, recebe estado de um poller Rust (mesma carga de 400 ms + heartbeat de 2 s do `main.js`) e foi verificada por captura da própria janela. Atenção: `--remote-debugging-port` **não funciona** no Tauri release; a verificação de render da casca é por `PrintWindow` + `GetWindowRect`, não por CDP.

Para BASE-05, o `glow` hoje roda **em todos os estados, inclusive `idle`** (confirmado por CDP: `document.getAnimations()` devolve `glow` rodando na janela ociosa, e `visibilityState` é `visible` mesmo com a pílula invisível). A substituição testada é um `#pill::before` com a sombra **interna** estática cuja `opacity` pulsa só fora de `idle`, mais uma regra que pausa tudo quando `document.hidden`. Resultado verificado no Electron 45: idle = 0 animações, running = glow+breathe+3×hop, waiting = glow, hidden = pausado.

**Primary recommendation:** (1) commitar a regra de decisão e só depois qualquer resultado; (2) rodar `scripts/measure-footprint.ps1` com HOME descartável e lançamento por `PID`, nunca por nome; (3) T0 só vale com `WS_EX_TOOLWINDOW` aplicado após o `show()` e geometria física; (4) mesma `index.html` corrigida (BASE-05) nas variantes otimizadas e no Tauri.

## Architectural Responsibility Map

Aqui "tier" é o processo/camada onde a responsabilidade mora (não há servidor).

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Animação do glow (BASE-05) | Renderer (`index.html`, CSS) | Compositor do Chromium | Só `opacity`/`transform` rodam no compositor; `box-shadow` repinta na thread principal |
| Pausar animações escondido | Renderer (`visibilitychange`) | Processo principal (`win.hide()`) | Em Windows/Linux a página só vira `hidden` com `hide()` ou minimizar (doc Electron); quem esconde (Fase 4) é o main |
| Medir consumo | Script PowerShell fora da árvore medida | WMI/CIM (`Win32_Process`, `Win32_PerfFormattedData_PerfProc_Process`) | O medidor não pode estar na árvore que mede |
| Simular sessões | Arquivos JSON em HOME descartável | `main.js`/poller Rust (leitor) | O barramento do projeto já é arquivo; zero mudança de produto |
| Isolar a instância medida | Ambiente do processo (`USERPROFILE`, `--user-data-dir`) | — | `os.homedir()` do Node respeita `USERPROFILE` no Windows (verificado) |
| Casca Tauri (estado, janelas) | Rust (`spike/tauri/src-tauri`) | `initialization_script` (shim `window.island`) | Sem preload no Tauri; o shim reproduz os 7 métodos do `preload.js` |
| Veredito da regra | Função pura em Node (`scripts/spike-verdict.js`) | — | Decisão por aritmética testável, não por impressão |
| Gates funcionais | Humano (visual/foco/vídeo) + agente (geometria, estilos, foreground) | — | Só parte é automatizável (ver Decision Rule) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Electron | 45.4.1 (instalado; `node_modules/.pnpm/electron@45.4.1`) | Baseline E0/E1/E3/E2; executa qualquer pasta de app (`electron.exe <pasta>`) | Já é a base; variantes não exigem `pnpm install` [VERIFIED: linha de comando do `electron.exe` vivo, e execução de `e1app`/`e0app` sem `node_modules`] |
| `tauri` + `tauri-build` (crates) | 2.12.7 + 2.7.6 (resolvidos; wry 0.57.3, tao 0.37.3, tauri-runtime-wry 2.12.5, webview2-com 0.39.1) | Casca T0 | Compilou e rodou; `Cargo.lock` registra o conjunto [VERIFIED: log de `cargo build` desta sessão] |
| Rust / cargo | 1.99.1 (MSVC) | Compilar T0 | Já instalado [VERIFIED: `cargo --version`] |
| WebView2 Runtime | 157.0.4341.60 | Motor do Tauri | [VERIFIED: caminho no `msedgewebview2.exe --embedded-browser-webview` da casca] |
| Windows PowerShell | 5.1.26100.9818 | Script de medição | [VERIFIED: `$PSVersionTable`] |
| `node:test` (Node v26.4.0 no sistema) | embutido | Guarda de animação e veredito | Convenção do projeto |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CIM `Win32_Process` | Windows | Árvore (`ParentProcessId`), CPU (`KernelModeTime`+`UserModeTime`, 100 ns) | Sempre |
| CIM `Win32_PerfFormattedData_PerfProc_Process` | Windows | `WorkingSetPrivate`, `IDProcess` (propriedades de nome fixo) | Memória (métrica principal) |
| CDP via `WebSocket` global do Node 26 | embutido | `document.getAnimations()` no Electron (verificação ad hoc) | Só nas variantes Electron e só em execução de verificação (não na medição) |
| `PrintWindow` + `EnumWindows`/`GetWindowRect` (P/Invoke em PS) | user32 | Captura da janela e geometria/estilos do Tauri | Verificação da casca |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `cargo build --release --features tauri/custom-protocol` | `pnpm tauri build --no-bundle` (`@tauri-apps/cli`) | O CLI baixa um pacote npm e faz a mesma coisa; direto no cargo há menos superfície. O CLI só é necessário para empacotar instalador, que não é escopo |
| `Get-CimInstance Win32_PerfFormattedData_PerfProc_Process` | `Get-Counter '\Process(*)\Working Set - Private'` | **Falha no Windows pt-BR** (`$?` = False, verificado): nomes de contador localizados |
| HOME descartável (`USERPROFILE`) | Parar a ilha viva e usar `~/.claude/island` | Parar derruba os botões de permissão das sessões reais (cai no terminal, seguro mas ruim) e as sessões reais contaminariam o cenário "ociosa" |
| Cópia de `main.js` com uma linha trocada (E3) | Variável de ambiente em `main.js` | Mexe em arquivo que a Fase 2 está reescrevendo e entrega código de medição no produto |

**Installation:** nada novo no `package.json`. Tauri: `cargo build` (rede: crates.io, ~209 crates, ~2 min a frio).

**Version verification:** versões acima saíram do `Cargo.lock`/log desta sessão; o registro `crates.io` foi consultado pela seam `package-legitimacy` (ver abaixo).

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| tauri | crates.io | desde 2019-11 | ~1,5 M/semana | github.com/tauri-apps/tauri | OK | Approved |
| tauri-build | crates.io | desde 2021-04 | ~1,5 M/semana | github.com/tauri-apps/tauri | OK | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
Nenhum pacote npm é adicionado. As ~430 crates transitivas vêm do lockfile do `tauri` e não foram auditadas uma a uma [ASSUMED: seguem a confiança do upstream]. `Cargo.lock` deve ser commitado para a casca ser reproduzível. Fonte do veredito: `gsd-tools query package-legitimacy check --ecosystem crates tauri tauri-build` [VERIFIED: seam, esta sessão].

## Pre-rule disclosure (integridade de "regra antes dos números")

Durante a pesquisa foram feitas execuções curtas **só para validar mecânica** (janela de 12 a 35 s, sem aquecimento, enquanto o `cargo` compilava). Nenhum valor delas é evidência e nenhum foi anotado aqui. Os limiares da regra (60%, CPU ociosa ≤) são os do autor em BASE-02 e **não foram ajustados a partir dessas execuções**. Única observação qualitativa: com o `glow` original a ilha ociosa tinha CPU mensuravelmente não nula. O plano deve tratar todas as medições de verdade como inexistentes até o commit da regra.

## Architecture Patterns

### System Architecture Diagram

```
measure-footprint.ps1 -Label <v> -Exe <exe> -ArgumentList <args>
   |
   |  para cada cenário (idle | running | waiting) x 3 execuções:
   v
[HOME descartável  %TEMP%\island-measure-<guid>]
   |  Write-FakeSession  -> <HOME>\.claude\island\spike-fake.json   (idle = sem arquivo)
   |  env do filho: USERPROFILE=<HOME> (+ ISLAND_WINDOWS=1|all para T0)
   v
Start-Process <exe> --user-data-dir=<HOME>\ud   --------------------+
   |                                                                 |
   |   Electron (E0/E1/E3/E2)               Tauri (T0)               |
   |   main.js: readdir 400 ms ------+      Rust thread: 400 ms --+  |
   |   heartbeat 2 s                 |      heartbeat 2 s         |  |
   |   -> renderer (index.html)      |      -> emit island:state  |  |
   |      window.island (preload)    |         shim window.island |  |
   |                                 v                            v  |
   |            <HOME>\.claude\island\*.json  (leitura)              |
   v                                                                 |
aquecimento 30 s -> janela 60 s, amostra a cada 5 s:  <---------------+
   Get-TreeSnapshot (Win32_Process: ParentProcessId até a raiz)
   Get-PrivateWorkingSetMB (WorkingSetPrivate somado na árvore)
   CPU = soma dos deltas por PID de (Kernel+User) / segundos / nº lógicos
   |
   v
taskkill /PID <raiz> /T /F  (nunca por nome)  -> apaga HOME
   |
   v
spike/results/<label>.json  (3 execuções + mediana por cenário)
   |
   v
scripts/spike-verdict.js  -> PASS/FAIL por linha da regra (Etapa 1)
   |
   +-- Etapa 1 FAIL -> decisão = Electron; PROJECT.md; Etapa 2 não roda (BASE-03)
   +-- Etapa 1 PASS -> Etapa 2 (funcional + permissão ponta a ponta) -> fase 3.1 se vencer
```

### Recommended Project Structure
```
scripts/
├── measure-footprint.ps1      # BASE-01 (lançador + medidor)
├── spike-verdict.js           # veredito puro da regra (+ spike-verdict.test.js)
spike/
├── REGRA-DE-DECISAO.md        # BASE-02: commit ANTES de qualquer results/
├── results/<label>.json       # saídas do script (commitadas)
├── RESULTADOS.md              # tabela gerada (E0, E1, E3, E2, T0)
├── tauri/
│   ├── build.ps1              # copia ../../index.html -> ui/, define CARGO_TARGET_DIR fora do repo, cargo build
│   ├── ui/                    # cópia bit a bit do index.html (gitignored; build.ps1 recria)
│   └── src-tauri/
│       ├── Cargo.toml  Cargo.lock  build.rs  tauri.conf.json
│       ├── capabilities/default.json
│       ├── icons/icon.ico icon.png      # gerados (ver Code Examples)
│       └── src/main.rs  shim.js
animation.test.js              # guarda de BASE-05 (arquivo novo: evita conflito com island.test.js da Fase 2)
```
Adicionar ao `.gitignore`: `spike/tauri/ui/` e `spike/tauri/src-tauri/gen/`. **`CARGO_TARGET_DIR` fora do repositório** (`%LOCALAPPDATA%\claude-island\spike-tauri-target`): 1,2 GB dentro do repo fariam o `node --test` (que varre recursivamente) lento [ASSUMED: custo exato não medido] e poluiriam o worktree. A pasta do WebView2 nasce ao lado do `.exe` (`<exe>.WebView2\EBWebView`, observado na linha de comando do `msedgewebview2.exe`), então também fica fora do repo.

### Variantes (todas com os mesmos 2 monitores e o mesmo polling)

| ID | O que é | Como obter (sem mexer em `main.js`/produto) |
|----|---------|---------------------------------------------|
| **E0** | Electron atual (2 janelas, glow original) | Snapshot do commit `2530f30` (anterior ao BASE-05): `git archive --format=zip -o <zip> 2530f30` + `Expand-Archive` [VERIFIED]. Rodar com `electron.exe <pasta>` |
| **E1** | E0 + glow corrigido (2 janelas) | Raiz do repo depois do commit do BASE-05 (ou snapshot dele). Isola o efeito do CSS |
| **E3** | **"Electron otimizado" do BASE-03**: E1 + uma janela | Cópia do snapshot de E1 com `const displays = screen.getAllDisplays();` trocado por `const displays = [screen.getPrimaryDisplay()];` em `syncIslands` (`main.js:182`). Patch por `-replace` na cópia; o script grava o hash do snapshot no JSON |
| **E2** | E3 + `--in-process-gpu` | Mesmo app de E3 com o argumento extra. **Verificado: some o processo de GPU** (árvore de 6 para 4 processos com 2 janelas). Só conta como referência se capturas das 3 telas saírem corretas e o processo não cair durante as 9 execuções (Electron não documenta o switch; é do Chromium) |
| **T0** | Casca Tauri, **1 janela** (monitor principal), `index.html` de E1 | `spike/tauri` (abaixo). `ISLAND_WINDOWS=all` dá 2 janelas (linha secundária da tabela, e necessária ao gate de 2 monitores) |

### Pattern 1: Isolar a instância medida (zero mudança de produto)
**What:** lançar com `USERPROFILE=<HOME descartável>` e `--user-data-dir=<HOME>\ud`.
**Why it works:** `STATE_DIR = path.join(os.homedir(), '.claude', 'island')` (`state.js:5`) e `os.homedir()` usa `USERPROFILE` no Windows [VERIFIED: `USERPROFILE='C:\Temp\fakehome' node -e "console.log(require('os').homedir())"` imprimiu `C:\Temp\fakehome`]. O `--user-data-dir` diferente dá outra chave à trava (`app.requestSingleInstanceLock()`, `main.js:294`): instâncias isoladas subiram **ao lado da ilha viva** sem quitar [VERIFIED: 6 processos da ilha viva intactos o tempo todo]. O heartbeat, as decisões e as sessões são escritos no HOME descartável, nunca no real [VERIFIED: `~/.claude/island` só tem os 3 arquivos de sessão reais ao fim]. `readContextPercent` usa `os.tmpdir()` (`main.js:67`, não afetado): sessão falsa não tem anel de contexto, igual nas duas bases.
**Não parar a ilha viva.** Se o autor quiser medir "limpo": parar por **PID raiz** (o `electron.exe` cuja linha de comando não tem `--type=`) com `taskkill /PID <pid> /T /F`; reiniciar com `Start-Process <electron.exe> -ArgumentList '<repo>'` ou deixar o próximo `SessionStart` subir (batimento velho em 6 s, `state.js:11`). Enquanto parada, pedidos de permissão caem no terminal (seguro).

### Pattern 2: Cenários por arquivo (`spike-fake.json`, id fixo)
Conteúdo mínimo, igual ao que `hook.js:60` grava (`{ ...result, project, windowPid, permission, updatedAt: Date.now() }`):

| Cenário | Arquivo | Resultado de `pickState` |
|---------|---------|--------------------------|
| ociosa | nenhum arquivo | `{ state: 'idle', count: 0 }` (`state.js:159`) |
| trabalhando | `{state:'running',detail:'Bash',project:'spike',windowPid:null,updatedAt:<ms>}` | `running` (válido por `RUNNING_STALE_MS = 2 * 60 * 60_000`, `state.js:26`) |
| precisa de você | igual, `state:'waiting'`, `detail:'Precisa da sua resposta'` e `permission:{id,tool,text}` | `waiting` + `permission` (só se `validPermission`) |

Regras lidas em `state.js` e confirmadas rodando `pickState` com o arquivo gerado: `UUID_PATTERN` é `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/` (`state.js:72`), em minúsculas, então `'00000000-0000-4000-8000-000000000001'` vale; `PERMISSION_TEXT_LIMIT = 600` (`state.js:18`) e `PERMISSION_LINE_LIMIT = 20` (`state.js:19`): o texto máximo usado é 20 linhas × 28 caracteres = **579 caracteres** (um primeiro teste com 645 caracteres foi **rejeitado em silêncio** e o cenário virou `waiting` sem caixa; conferir `permission=true`). `\p{Cc}` inclui tab: não usar tab.
**`waiting` sem `permission` é aceitável?** Não para a medição: a ilha expande a 104 px sem caixa, que é o estado mais barato. O cenário "precisa de você" tem de ter o pedido de 20 linhas (altura medida 284 px dos 324 da janela).
**Não clobbera nada:** id fixo `spike-fake`, HOME descartável, apagado ao fim. Sem `permission-hook` rodando, ninguém lê decisão; o botão "Permitir" fica habilitado na tela mas nada o clica (o script não injeta cliques).
**Aviso sonoro:** `waiting` dispara `chime` no primeiro estado (`index.html:326`); isso cria um processo utilitário de áudio no Electron (idle = 5 processos, waiting = 6, verificado). O shim do Tauri deve passar `shouldChime = true` para a casca pagar o mesmo custo (WebView2 também cria processo de áudio [ASSUMED: não testado]). O aquecimento de 30 s deixa o beep fora da janela.

### Pattern 3: Glow só com compositor (BASE-05), testado
```css
/* index.html: substitui a linha 77 (animation: glow ...) e só a regra @keyframes glow (182-184);
   breathe e hop (180-181) ficam como estão */
#pill { --ring: color-mix(in srgb, var(--accent) 40%, transparent); --pulse: 2.4s; position: relative; isolation: isolate; }
/* ...linhas 78-79 (--pulse de waiting e done) ficam... */
/* Brilho do contorno: a sombra é desenhada uma vez, numa camada própria, e só a opacidade pulsa
   (o compositor anima sem repintar). Parada, a ilha não anima nada. */
#pill::before {
  content: ''; position: absolute; inset: 0; z-index: -1; border-radius: inherit; pointer-events: none; opacity: 0;
  box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--accent) 80%, transparent),
              inset 0 0 14px color-mix(in srgb, var(--accent) 50%, transparent);
}
#pill:not([data-state="idle"])::before { animation: glow var(--pulse) ease-in-out infinite; }
@keyframes glow { 50% { opacity: 1; } }
/* Janela escondida (hide() ou minimizada): a página fica "hidden" e nada deve animar. */
html[data-hidden="true"] *, html[data-hidden="true"] ::before { animation-play-state: paused !important; }
/* reduced-motion (linha 185): acrescentar #pill::before ao seletor: #pill, #pill::before, #dot, #dots i */
```
```js
// <script>, junto das constantes do topo
document.addEventListener('visibilitychange', () => { document.documentElement.dataset.hidden = document.hidden; });
```
**Por que sombra interna e `::before`:** `#pill` tem `overflow: hidden` (`index.html:61`), que recorta qualquer descendente, então um halo **externo** num pseudo-elemento sumiria; a sombra interna cabe no recorte e foi renderizada corretamente (captura do estado `waiting` com o texto intacto). `isolation: isolate` + `z-index: -1` põem o brilho atrás do texto (relevante para VIS-04, "o reflexo nunca pinta o comando"). O halo externo original (`0 2px 16px`) deixa de pulsar; o anel externo estático `0 0 0 1px var(--ring)` (linha 64) permanece. Se o autor não aceitar o halo interno, o plano B é um wrapper sem `overflow` (mais mexida no HTML) [ver Open Questions].
**Verificado no Electron 45 (CDP, janela isolada):**

| Estado | `document.getAnimations()` |
|--------|----------------------------|
| idle (original) | `glow` rodando em `#pill` (e `visibilityState` = `visible`) |
| idle (novo) | 0 |
| running (novo) | `glow` (pseudo), `breathe` em `#dot`, 3× `hop` |
| waiting (novo) | `glow` |
| `document.hidden` simulado + `visibilitychange` | `glow:paused` |

Animações restantes em `running` (`breathe`, `hop`) usam só `transform`/`opacity` e só existem enquanto `running` (`#dots` é `display:none` fora dele, `index.html:100-101`).

### Anti-Patterns to Avoid
- **Medir `Get-Process … PrivateMemorySize64` como "private WS":** é commit (private bytes), não working set privado.
- **`taskkill /IM electron.exe` ou `Stop-Process -Name electron`:** mata a ilha viva (6 `electron.exe` rodando agora).
- **`-WindowStyle Hidden` no `Start-Process`:** pode esconder a primeira janela (o valor vai no `STARTUPINFO` e a primeira `ShowWindow(SW_SHOWDEFAULT)` o respeita) [ASSUMED: não testado]; o app já é GUI sem console, então omitir.
- **`NODE_OPTIONS=--require shim.js` para mexer no `main`:** o shim não consegue `require('electron')` ("Cannot find module 'electron'", verificado). Use cópia patchada do app.
- **Deixar o `cargo build` rodar durante a medição.**
- **Ligar `--remote-debugging-port` na execução medida:** só em execuções de verificação.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Private working set | P/Invoke de `GetProcessMemoryInfo`/`QueryWorkingSet` | CIM `WorkingSetPrivate` | Mesmo número do Gerenciador de Tarefas; nome de propriedade não localizado |
| Árvore de processos | Rastrear filhos no lançamento | Fechamento por `ParentProcessId` de `Win32_Process` | Pega `msedgewebview2.exe` (filho direto do `.exe` Tauri, verificado) e utilitários do Chromium |
| CPU de árvore que muda | Delta só entre o primeiro e o último snapshot | Soma de deltas por PID a cada amostra | Processo que nasce/morre na janela não distorce |
| Ver animações ativas | Olhar a tela | `document.getAnimations()` via CDP (Electron) | Prova objetiva de "nenhuma animação roda" |
| Posição/estilo da janela Tauri | Estimar | `EnumWindows` + `GetWindowRect` + `GetWindowLong(GWL_EXSTYLE)` | Pegou a retiling do komorebi |
| Veredito | Ler a tabela e decidir | Função pura + `node:test` | A regra vira código revisável |
| Extrair snapshot de commit | `tar` do PATH (Git Bash quebra caminho `C:`) | `git archive --format=zip` + `Expand-Archive` | Funciona no PS 5.1 sem `tar` [VERIFIED] |

**Key insight:** o custo e o risco do spike estão em **medir errado**, não em escrever código. Tudo acima existe para que o número seja de árvore inteira, comparável e livre de contaminação.

## Common Pitfalls

### Pitfall 1: `Get-Counter` no Windows pt-BR
**What goes wrong:** `Get-Counter '\Process(*)\Working Set - Private'` falha [VERIFIED: `$?` = False; cultura e UI `pt-BR`]. **How to avoid:** CIM `Win32_PerfFormattedData_PerfProc_Process` (propriedades `IDProcess`, `WorkingSetPrivate`, `WorkingSetPeak`, `PrivateBytes`).

### Pitfall 2: `powershell -File` e listas
**What goes wrong:** `-Scenarios idle,waiting` chega como UMA string `"idle,waiting"` (o cenário virou rótulo e nada foi medido) [VERIFIED]. **How to avoid:** `$Scenarios = @($Scenarios | ForEach-Object { $_ -split ',' })` logo após `param`; vale para `-ExtraEnv`.

### Pitfall 3: Decimal com vírgula
**What goes wrong:** `Format-List`/`-f` usam a cultura (`103,3`). **How to avoid:** `.ToString([Globalization.CultureInfo]::InvariantCulture)` em tudo que for impresso para colar em tabela; JSON por `ConvertTo-Json` ficou correto [VERIFIED].

### Pitfall 4: komorebi retiliza a janela Tauri (específico do ambiente do autor, mas decisivo)
**What goes wrong:** `komorebi` + `yasb` + `windhawk` rodam aqui. Sem correção, as janelas Tauri saíam em `1091×466` e `1509×747` e em posições erradas (as de Electron saem `440×324` em `y=30`). Estilo estendido do Tauri: `0x80c0118` (tem `WS_EX_APPWINDOW 0x40000`, sem `WS_EX_TOOLWINDOW 0x80`); o do Electron: `0x8280028` (`TOOLWINDOW` + `TOPMOST` + `NOACTIVATE` + `LAYERED` + `TRANSPARENT`) [VERIFIED: `GetWindowLong`].
**Why it happens:** `skip_taskbar(true)` no Tao esconde da barra mas não marca como janela de ferramenta; o gerenciador em mosaico a trata como app comum. O Tao **regrava** o estilo estendido ao `show()`, então aplicar antes não vale.
**How to avoid (testado):** criar com `.visible(false)`; depois do `show()`, **numa thread após 300 ms**, aplicar `(style | WS_EX_TOOLWINDOW) & !WS_EX_APPWINDOW` via `SetWindowLongPtrW` (FFI direto a `user32`, sem crate nova) e reaplicar `set_size`/`set_position` em **pixels físicos** do monitor-alvo (`work_area()`); a posição lógica do builder usa escala errada em multi-DPI. Resultado verificado: retângulos `440×324` em `(1060,30)` e `(-1372,30)` (igual ao Electron) e estilo `0x8000198` (com `TOPMOST`, `TOOLWINDOW`, `NOACTIVATE`).
**Warning signs:** `GetWindowRect` da janela diferente de 440×324 (×escala); `ex` com `0x40000`. **Isto não é regra de decisão** (é config); mas T0 só pode ser medido depois de passar nesse teste de geometria.

### Pitfall 5: Contaminação da medição
- Sessões reais fazem o cenário "ociosa" não ser ocioso → HOME descartável (verificado).
- WebView2: a pasta de dados é por `.exe` e **persiste entre execuções** (cache quente na 2ª e 3ª) → apagar `<exe>.WebView2` antes de cada execução (Electron já recebe `--user-data-dir` novo a cada uma).
- Outros apps WebView2 (Teams, Widgets: há ~30 `msedgewebview2.exe` vivos aqui) pertencem a **outros grupos de processos**; a árvore por `ParentProcessId` a partir do `.exe` Tauri pega só os dele (7 processos para 1 janela). Conferir cruzando: processos cuja linha de comando contém o `--user-data-dir` da casca devem ser os mesmos da árvore.
- Aviso sonoro assimétrico (ver Pattern 2).
- Janela de CPU curta: o tempo de CPU tem granularidade de ~15,6 ms; em 3 s dá 0,02% de ruído num processo ocioso. Usar 60 s.

### Pitfall 6: Tauri release e remote debugging
`cargo build --release` puro não define `custom-protocol`; compilei com `--features tauri/custom-protocol` e funcionou. Que **sem** a feature ele tente carregar `devUrl` é conhecimento prévio [ASSUMED: não testado]. `--remote-debugging-port` chega na linha de comando do `msedgewebview2.exe` mas **a porta não escuta** (devtools desligados em release) [VERIFIED: `netstat`]. Verificação do render por `PrintWindow(…, 2)` (fundo transparente sai preto) [VERIFIED].

### Pitfall 7: `index.html` no disco é CRLF
`git ls-files --eol` mostra `i/lf w/crlf` (`core.autocrlf=true`). `Edit` com `old_string` multilinha falha por quebra de linha; usar âncoras de uma linha ou normalizar `\r\n`→`\n` em scripts de patch (o patch testado normaliza). O commit normaliza para LF.

### Pitfall 8: Conflito com a Fase 2 (worktree paralelo)
A Fase 2 mexe em `main.js`, provavelmente em `index.html` (armamento) e em `island.test.js`. Manter o diff do BASE-05 pequeno e em regiões distintas (CSS do glow nas linhas 77-79/180-185; 1 linha de script no topo do `<script>`), e **criar `animation.test.js` novo** em vez de anexar a `island.test.js`. Não tocar em `main.js`/`state.js`.

### Pitfall 9: Idle não é "hidden"
Doc do Electron: em Windows/Linux a visibilidade só vira `hidden` com `win.hide()` ou minimizar; `backgroundThrottling:false` mantém `visible` sempre [CITED: electronjs.org/docs/latest/api/browser-window]. Confirmado: janela ociosa e transparente reporta `visible`. Logo a pausa de BASE-05 em idle **tem de ser por estado CSS**, e o `visibilitychange` cobre o futuro "esconder" (Fase 4). Não ligar `backgroundThrottling:false`.

## Code Examples

### Script de medição (testado: PS 5.1, pt-BR; executado de ponta a ponta contra Electron e contra um `node` de teste)
Salvar como `scripts/measure-footprint.ps1`. Diferenças pedidas ao executor: renomear `$Env` para `$ExtraEnv`; adicionar `-CleanDirs` (pastas a apagar antes de cada execução, para `<exe>.WebView2`); gravar no JSON o `git rev-parse` do snapshot e as versões; `-Seconds 60` e `-WarmupSeconds 30` como padrão (BASE-01 pede 3 execuções).

```powershell
# Mede o consumo de uma variante da ilha (Electron ou Tauri) em cenários fixos.
# Uso: powershell -File scripts/measure-footprint.ps1 -Label e1 -Exe <exe> -ArgumentList '<args>' [-ExtraEnv 'K=V,K2=V2']
# {home} em -ArgumentList vira a pasta descartável da execução. Não toca em ~/.claude.
param(
  [Parameter(Mandatory)][string]$Label,
  [Parameter(Mandatory)][string]$Exe,
  [string]$ArgumentList = '',
  [string[]]$ExtraEnv = @(),
  [string[]]$Scenarios = @('idle', 'running', 'waiting'),
  [int]$Runs = 3,
  [int]$WarmupSeconds = 30,
  [int]$Seconds = 60,
  [int]$IntervalSeconds = 5,
  [string]$OutDir = (Join-Path $PSScriptRoot '..\spike\results')
)
$ErrorActionPreference = 'Stop'
# powershell -File entrega listas separadas por vírgula como uma única string.
$Scenarios = @($Scenarios | ForEach-Object { $_ -split ',' })
$ExtraEnv = @($ExtraEnv | ForEach-Object { $_ -split ',' } | Where-Object { $_ })
$inv = [Globalization.CultureInfo]::InvariantCulture   # o Windows do autor é pt-BR: sem isto sai "103,3"

function Get-TreeSnapshot([int]$root) {
  $all = Get-CimInstance Win32_Process -Property ProcessId, ParentProcessId, Name, KernelModeTime, UserModeTime
  $ids = New-Object 'System.Collections.Generic.HashSet[int]'
  [void]$ids.Add($root)
  do {
    $before = $ids.Count
    foreach ($p in $all) { if ($ids.Contains([int]$p.ParentProcessId)) { [void]$ids.Add([int]$p.ProcessId) } }
  } while ($ids.Count -ne $before)
  @($all | Where-Object { $ids.Contains([int]$_.ProcessId) })
}

# Get-Counter usa nomes de contador localizados (falha no Windows pt-BR); a classe WMI tem nomes fixos.
function Get-PrivateWorkingSetMB($tree) {
  $ids = @{}; foreach ($p in $tree) { $ids[[uint32]$p.ProcessId] = $true }
  $sum = 0.0
  Get-CimInstance Win32_PerfFormattedData_PerfProc_Process -Property IDProcess, WorkingSetPrivate |
    ForEach-Object { if ($ids.ContainsKey([uint32]$_.IDProcess)) { $sum += [double]$_.WorkingSetPrivate } }
  $sum / 1MB
}

function Get-Median([double[]]$values) {
  $sorted = $values | Sort-Object
  $mid = [int][math]::Floor($sorted.Count / 2)
  if ($sorted.Count % 2) { $sorted[$mid] } else { ($sorted[$mid - 1] + $sorted[$mid]) / 2 }
}

# A CPU soma os deltas por PID a cada amostra: processo que nasce ou morre na janela não distorce.
function Measure-Window([int]$root) {
  $cpuLast = @{}; $cpuTicks = 0.0; $mem = New-Object System.Collections.Generic.List[double]
  $t0 = $null; $tn = $null; $count = 0
  $steps = [math]::Floor($Seconds / $IntervalSeconds)
  for ($i = 0; $i -le $steps; $i++) {
    $tree = Get-TreeSnapshot $root
    $tn = [DateTime]::UtcNow; if (-not $t0) { $t0 = $tn }
    foreach ($p in $tree) {
      $ticks = [double]$p.KernelModeTime + [double]$p.UserModeTime   # unidades de 100 ns
      if ($cpuLast.ContainsKey($p.ProcessId)) { $cpuTicks += $ticks - $cpuLast[$p.ProcessId] }
      elseif ($i -gt 0) { $cpuTicks += $ticks }   # nasceu dentro da janela
      $cpuLast[$p.ProcessId] = $ticks
    }
    $count = $tree.Count
    $mem.Add((Get-PrivateWorkingSetMB $tree))
    if ($i -lt $steps) { Start-Sleep -Seconds $IntervalSeconds }
  }
  $elapsed = ($tn - $t0).TotalSeconds
  [pscustomobject]@{
    processes = $count
    privateWsMb = [math]::Round(($mem | Measure-Object -Average).Average, 1)
    cpuPercentTotal = [math]::Round($cpuTicks / 1e7 / $elapsed / [Environment]::ProcessorCount * 100, 4)
    cpuPercentOfOneCore = [math]::Round($cpuTicks / 1e7 / $elapsed * 100, 3)
    seconds = [math]::Round($elapsed, 1)
  }
}

# Sessão falsa: o mesmo JSON que o hook.js grava. Id fixo e HOME descartável.
function Write-FakeSession([string]$home1, [string]$scenario) {
  $dir = Join-Path $home1 '.claude\island'; New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $file = Join-Path $dir 'spike-fake.json'
  if ($scenario -eq 'idle') { Remove-Item $file -ErrorAction SilentlyContinue; return }
  $session = @{ state = $scenario; detail = 'Bash'; project = 'spike'; windowPid = $null
                updatedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() }
  if ($scenario -eq 'waiting') {
    $text = (0..19 | ForEach-Object { 'step {0:D2}: {1}' -f $_, ('x' * 19) }) -join "`n"   # 20 linhas, 579 caracteres
    $session.detail = 'Precisa da sua resposta'
    $session.permission = @{ id = '00000000-0000-4000-8000-000000000001'; tool = 'Bash'; text = $text }
  }
  [IO.File]::WriteAllText($file, ($session | ConvertTo-Json -Depth 5), (New-Object Text.UTF8Encoding $false))
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$results = @()
foreach ($scenario in $Scenarios) {
  $runsOut = @()
  for ($run = 1; $run -le $Runs; $run++) {
    $home1 = Join-Path $env:TEMP ("island-measure-{0}" -f [guid]::NewGuid().ToString('N'))
    Write-FakeSession $home1 $scenario
    $names = @('USERPROFILE') + ($ExtraEnv | ForEach-Object { $_.Split('=')[0] })
    $saved = @{}; foreach ($name in $names) { $saved[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
    $env:USERPROFILE = $home1
    foreach ($pair in $ExtraEnv) { $k, $v = $pair.Split('=', 2); [Environment]::SetEnvironmentVariable($k, $v, 'Process') }
    $proc = Start-Process -FilePath $Exe -ArgumentList $ArgumentList.Replace('{home}', $home1) -PassThru `
      -RedirectStandardOutput (Join-Path $home1 'out.txt') -RedirectStandardError (Join-Path $home1 'err.txt')
    foreach ($name in $saved.Keys) { [Environment]::SetEnvironmentVariable($name, $saved[$name], 'Process') }
    try {
      Start-Sleep -Seconds $WarmupSeconds
      if ($proc.HasExited) { throw "a variante $Label encerrou durante o aquecimento (veja $home1\err.txt)" }
      $m = Measure-Window $proc.Id
      $runsOut += $m
      Write-Host ("{0} {1} #{2}: {3} MB, {4}% do total ({5} processos)" -f $Label, $scenario, $run,
        $m.privateWsMb.ToString($inv), $m.cpuPercentTotal.ToString($inv), $m.processes)
    } finally {
      & taskkill.exe /PID $proc.Id /T /F | Out-Null   # por PID, nunca por nome: a ilha viva também é electron.exe
      Start-Sleep -Seconds 2
      Remove-Item $home1 -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
  $results += [pscustomobject]@{
    label = $Label; scenario = $scenario; runs = $runsOut
    median = [pscustomobject]@{
      privateWsMb = [math]::Round((Get-Median ($runsOut | ForEach-Object { $_.privateWsMb })), 1)
      cpuPercentTotal = [math]::Round((Get-Median ($runsOut | ForEach-Object { $_.cpuPercentTotal })), 4)
      processes = (Get-Median ($runsOut | ForEach-Object { [double]$_.processes }))
    }
  }
}
$out = [pscustomobject]@{
  label = $Label; exe = $Exe; arguments = $ArgumentList; env = $ExtraEnv
  measuredAt = (Get-Date).ToUniversalTime().ToString('o')
  logicalProcessors = [Environment]::ProcessorCount
  warmupSeconds = $WarmupSeconds; windowSeconds = $Seconds; runs = $Runs
  results = $results
}
$path = Join-Path $OutDir ("{0}.json" -f $Label)
[IO.File]::WriteAllText($path, ($out | ConvertTo-Json -Depth 8), (New-Object Text.UTF8Encoding $false))
Write-Host "gravado em $path"
```
Exemplos de chamada (Electron): `-Exe <repo>\node_modules\.pnpm\electron@45.4.1\node_modules\electron\dist\electron.exe -ArgumentList '"<pasta do app>" --user-data-dir="{home}\ud"'`. Tauri: `-Exe <target>\release\claude-island-spike.exe -ExtraEnv 'ISLAND_WINDOWS=1' -CleanDirs <target>\release\claude-island-spike.exe.WebView2`.
Duração estimada: ~98 s por execução × 3 cenários × 3 execuções ≈ 15 min por variante; 6 variantes ≈ 90 min. Rodar como tarefa de fundo, sem outra carga pesada na máquina.

### Casca Tauri (compilada e verificada; copiar para `spike/tauri/`)
`Cargo.toml`: `[package] name="claude-island-spike" version="0.0.0" edition="2021"`; `[build-dependencies] tauri-build = { version = "2", features = [] }`; `[dependencies] tauri = { version = "2", features = [] }`. `build.rs`: `fn main() { tauri_build::build() }`.
`tauri.conf.json`:
```json
{
  "productName": "claude-island-spike",
  "identifier": "dev.marcelo-mo.claude-island-spike",
  "version": "0.0.0",
  "build": { "frontendDist": "../ui" },
  "app": { "withGlobalTauri": true, "windows": [], "security": { "csp": null } },
  "bundle": { "active": false, "icon": ["icons/icon.ico", "icons/icon.png"] }
}
```
`capabilities/default.json`: `{ "identifier": "default", "windows": ["island-*"], "permissions": ["core:default"] }`. O `<meta>` CSP do `index.html` (`default-src 'none'`) **não** bloqueou `listen` do `__TAURI__` (estado chegou à página) [VERIFIED: captura].
Ícones (Windows exige `icons/icon.ico`; gerados em Node sem dependência; PNG 32×32 sólido embutido no `.ico`): usar `zlib.deflateSync` + `zlib.crc32` (Node ≥ 22.2) e cabeçalho ICO de 22 bytes. Que o build falhe sem `.ico` é conhecimento prévio [ASSUMED: não testado].
`src/shim.js` (reproduz os 7 métodos de `preload.js`; só `onState` é real):
```js
(() => {
  const toState = (raw) => {
    const { count, session } = JSON.parse(raw);
    if (!session) return { state: 'idle', count: 0 };
    return { state: session.state, detail: session.detail, project: session.project, count,
             windowPid: null, context: null, permission: session.permission || null };
  };
  const noop = () => {};
  window.island = {
    // true: a casca paga o mesmo aviso sonoro do Electron (a primeira ilha toca)
    onState: (callback) => window.__TAURI__.event.listen('island:state', (event) => callback(toState(event.payload), true)),
    setHover: noop, focusSession: noop, decide: noop, drag: noop, endDrag: noop, resetPosition: noop,
  };
})();
```
`src/main.rs` (essencial; compilou com tauri 2.12.7):
```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::{fs, path::PathBuf, sync::{Arc, Mutex}, thread, time::{Duration, SystemTime, UNIX_EPOCH}};
use tauri::{webview::PageLoadEvent, Emitter, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder};

// Gerenciadores de janela em mosaico (komorebi) ignoram WS_EX_TOOLWINDOW, como o Electron faz com skipTaskbar.
#[cfg(windows)]
fn make_tool_window(window: &tauri::WebviewWindow) {
    #[link(name = "user32")]
    extern "system" {
        fn GetWindowLongPtrW(hwnd: isize, index: i32) -> isize;
        fn SetWindowLongPtrW(hwnd: isize, index: i32, value: isize) -> isize;
    }
    const GWL_EXSTYLE: i32 = -20; const WS_EX_TOOLWINDOW: isize = 0x80; const WS_EX_APPWINDOW: isize = 0x40000;
    if let Ok(hwnd) = window.hwnd() {
        let hwnd = hwnd.0 as isize;
        unsafe { let s = GetWindowLongPtrW(hwnd, GWL_EXSTYLE); SetWindowLongPtrW(hwnd, GWL_EXSTYLE, (s | WS_EX_TOOLWINDOW) & !WS_EX_APPWINDOW); }
    }
}

const SHIM: &str = include_str!("shim.js");
const EMPTY: &str = r#"{"count":0}"#;

fn state_dir() -> PathBuf {   // mesma regra do state.js: USERPROFILE/.claude/island
    let home = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")).unwrap_or_default();
    PathBuf::from(home).join(".claude").join("island")
}

fn read_state(dir: &PathBuf) -> String {   // mesma carga do main.js: lista a pasta e lê os .json
    let (mut count, mut first) = (0, String::new());
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("json") { continue; }
            if let Ok(raw) = fs::read_to_string(&path) { if first.is_empty() { first = raw; } count += 1; }
        }
    }
    if count == 0 { EMPTY.to_string() } else { format!(r#"{{"count":{count},"session":{first}}}"#) }
}

fn main() {
    let last = Arc::new(Mutex::new(EMPTY.to_string()));
    let for_pages = last.clone();
    tauri::Builder::default()
        .setup(move |app| {
            let all = std::env::var("ISLAND_WINDOWS").map(|v| v == "all").unwrap_or(false);
            let mut monitors = app.available_monitors()?;
            if !all { if let Some(primary) = app.primary_monitor()? { monitors = vec![primary]; } }
            for (index, monitor) in monitors.iter().enumerate() {
                let scale = monitor.scale_factor();
                let state_for_page = for_pages.clone();
                let window = WebviewWindowBuilder::new(app, format!("island-{index}"), WebviewUrl::App("index.html".into()))
                    .inner_size(440.0, 324.0)
                    .transparent(true).decorations(false).shadow(false).resizable(false)
                    .always_on_top(true).skip_taskbar(true).focusable(false).visible(false)
                    .initialization_script(SHIM)
                    .on_page_load(move |webview, payload| {
                        // O estado inicial só chega depois que a página registrou o ouvinte (fim do load).
                        if let PageLoadEvent::Finished = payload.event() {
                            let _ = webview.emit("island:state", state_for_page.lock().unwrap().clone());
                        }
                    })
                    .build()?;
                // Pixels físicos do monitor-alvo; a posição lógica do builder usa a escala errada em multi-DPI.
                let work = monitor.work_area();
                let size = PhysicalSize::new((440.0 * scale).round() as u32, (324.0 * scale).round() as u32);
                let position = PhysicalPosition::new(
                    work.position.x + (work.size.width as i32 - size.width as i32) / 2, work.position.y);
                let _ = window.set_size(size); let _ = window.set_position(position); let _ = window.show();
                // O Tao regrava o estilo estendido ao mostrar: aplicar depois, e reaplicar a geometria.
                let delayed = window.clone();
                thread::spawn(move || {
                    thread::sleep(Duration::from_millis(300));
                    #[cfg(windows)] make_tool_window(&delayed);
                    let _ = delayed.set_size(size); let _ = delayed.set_position(position);
                });
            }
            let handle = app.handle().clone();
            let shared = last.clone();
            thread::spawn(move || {
                let dir = state_dir();
                let _ = fs::create_dir_all(&dir);
                let mut tick = 0u64;
                loop {
                    if tick % 5 == 0 {   // heartbeat de 2 s, como o main.js
                        let now = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0);
                        let _ = fs::write(dir.join(".heartbeat"), now.to_string());
                    }
                    let state = read_state(&dir);
                    if *shared.lock().unwrap() != state {
                        *shared.lock().unwrap() = state.clone();
                        let _ = handle.emit("island:state", state);
                    }
                    tick += 1;
                    thread::sleep(Duration::from_millis(400));
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("falha ao iniciar o Tauri");
}
```
(O payload do evento é a string JSON montada pelo Rust; o `toState` faz o `JSON.parse`.) Comando: `cargo build --release --features tauri/custom-protocol --manifest-path spike/tauri/src-tauri/Cargo.toml` com `$env:CARGO_TARGET_DIR` fora do repo; o `.exe` fica em `<target>\release\claude-island-spike.exe`. `ui/index.html` = `Copy-Item index.html` (da raiz, **depois** do BASE-05) e conferir `Get-FileHash` igual.

### Verificação das animações no Electron (ad hoc, só nas execuções de verificação)
```js
// cdp-eval.js <porta> "<expressão>": avalia em cada página do Electron aberto com --remote-debugging-port
const [port, expression] = process.argv.slice(2);
(async () => {
  const pages = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  for (const page of pages.filter((p) => p.type === 'page')) {
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve) => (ws.onopen = resolve));
    const reply = await new Promise((resolve) => {
      ws.onmessage = (m) => resolve(JSON.parse(m.data));
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
    });
    console.log(JSON.stringify(reply.result.result.value)); ws.close();
  }
})();
```
Expressão: `document.getAnimations().map(a => a.animationName + ':' + a.playState)`.

### Guarda `node:test` de BASE-05 (`animation.test.js`; vermelho no `index.html` atual, verde no corrigido)
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').replace(/\r\n/g, '\n');

// Corpo de cada @keyframes, respeitando as chaves aninhadas.
function keyframeBlocks(css) {
  const blocks = [];
  const open = /@keyframes\s+([\w-]+)\s*\{/g;
  let match;
  while ((match = open.exec(css))) {
    let depth = 1; let end = open.lastIndex;
    while (depth > 0 && end < css.length) { if (css[end] === '{') depth += 1; if (css[end] === '}') depth -= 1; end += 1; }
    blocks.push({ name: match[1], body: css.slice(open.lastIndex, end - 1) });
  }
  return blocks;
}

test('animações contínuas só mexem em opacity e transform (nada que repinte)', () => {
  const blocks = keyframeBlocks(html);
  assert.ok(blocks.length > 0);
  for (const { name, body } of blocks) {
    const properties = [...body.matchAll(/([\w-]+)\s*:/g)].map((found) => found[1]);
    assert.deepEqual(properties.filter((p) => p !== 'opacity' && p !== 'transform'), [], `@keyframes ${name}`);
  }
});

test('o estado base de #pill (ilha parada) não declara animation', () => {
  assert.doesNotMatch(html, /\n\s*#pill\s*\{[^}]*\banimation\s*:/);
});
```
[VERIFIED: rodado contra o `index.html` original (2 falhas) e contra o corrigido (2 passes)].

### Veredito puro (`scripts/spike-verdict.js`, esboço para o executor)
Entrada: medianas por variante e cenário (do JSON). Saída: `{ reference, gates: [{ id, pass, detail }], stage1: boolean }`. `reference` = variante otimizada (E3 ou E2 válida) de menor `privateWsMb` no cenário `idle`. Testes `node:test` com vetores: passa em 0,60 exato, falha em 0,61, falha por CPU, escolhe a referência de menor memória, ignora E2 inválida.

## Regra de decisão proposta (BASE-02; commitar em `spike/REGRA-DE-DECISAO.md` antes de qualquer `spike/results/`)

```markdown
# Regra de decisão: Electron × Tauri (escrita antes de qualquer medição)

Escopo: Windows 11, 2 monitores (100% e 125%). macOS e Linux não foram medidos e a decisão não vale para eles.
Variantes: E0 (Electron atual, commit 2530f30), E1 (E0 + brilho do contorno sem box-shadow animado),
E3 (E1 com uma janela: o "Electron otimizado"), E2 (E3 + --in-process-gpu, só se renderizar certo e não cair),
T0 (casca Tauri, 1 janela, mesma index.html de E1).
Método: scripts/measure-footprint.ps1; aquecimento de 30 s; janela de 60 s; 3 execuções; mediana.
Métrica de memória: private working set somado na árvore inteira (inclui msedgewebview2.exe).
Métrica de CPU: tempo de CPU da árvore inteira / segundos / processadores lógicos.
Referência: E_ref = a variante otimizada (E3 ou E2) com menor private working set mediano no cenário ociosa.

Etapa 1 (numérica). O Tauri só passa à Etapa 2 se TODAS valerem:
  N1. Em cada um dos 3 cenários (ociosa, trabalhando, precisa de você): WS(T0) <= 0,60 x WS(E_ref).
  N2. CPU ociosa: CPU(T0, ociosa) <= CPU(E_ref, ociosa) + 0,05 ponto percentual do total.
Se qualquer uma falhar: a base continua Electron. A Etapa 2 não é executada e o caminho de permissão
não é portado (BASE-03). Os números ficam no PROJECT.md.

Etapa 2 (funcional, só se a Etapa 1 passar), todos com os 2 monitores:
  F1 transparência sem borda nem flash na criação;   F2 hover sem perder o clique (exige polling de cursor em Rust);
  F3 clicar na pílula não tira o foco do terminal;   F4 acima de vídeo em tela cheia;
  F5 posição certa nos dois monitores (retângulo e estilo conferidos por GetWindowRect/GetWindowLong), sem ser
     capturada por gerenciador de janelas em mosaico;
  F6 caminho de permissão ponta a ponta portado (pedido -> decisão -> arquivo -> hook), com os mesmos vetores.
Tauri vence somente se Etapa 1 e Etapa 2 passarem. Vencendo, o ROADMAP ganha a fase 3.1 (port) antes da Fase 4.
```
**Quem checa cada gate de F:** agente: F5 (geometria/estilo, script `EnumWindows`), foreground inalterado após criar/mostrar a janela (verificado: `GetForegroundWindow` do mesmo PID antes e depois de subir T0), parte de F1 (captura da janela com `PrintWindow`); F6 (hook real `permission-hook.js` com HOME descartável + decisão gravada). **Humano:** F1 (flash/borda branca ao vivo), F2, F3 com Windows Terminal real, F4 com vídeo em tela cheia, o aspecto a 125%. Com `human_verify_mode: end-of-phase`, esses cinco itens viram um único checkpoint no fim, e só existem se a Etapa 1 passar. A ilha do Windhawk ocupa o mesmo lugar do topo central; para olhar a casca, capturar a janela por PID em vez da tela.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Glow por `box-shadow` animado em `#pill` (repintura contínua, inclusive idle) | Pseudo-elemento com sombra estática, só `opacity` pulsa, `animation` só fora de `idle` | esta fase | idle sem animação; compositor anima o resto |
| Medir `WorkingSet` somado | `WorkingSetPrivate` somado na árvore | esta fase | não conta DLLs compartilhadas do Chromium várias vezes |
| `tauri build` via CLI Node | `cargo build --release --features tauri/custom-protocol` | verificado hoje | sem `@tauri-apps/cli` |

**Deprecated/outdated:** a estimativa do STACK.md de "tao 0.37.1" é de 0.37.3 no lockfile atual; a advertência de roubo de foco do 0.37.1 (`set_visible`) não se manifestou (foreground do mesmo PID antes e depois do `show()` com `focusable(false)`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | O gate de memória N1 vale nos 3 cenários (BASE-02 não diz em quais) | Regra de decisão | Se o autor quiser só ociosa, a regra fica mais fácil de passar; escolher antes de commitar |
| A2 | Tolerância de 0,05 ponto percentual do total (~1% de um núcleo) no gate de CPU ociosa, para empate técnico | Regra de decisão | O texto do autor é "≤" estrito; sem tolerância o ruído de medição decide |
| A3 | `cargo build --release` sem `tauri/custom-protocol` tentaria carregar `devUrl` | Pitfall 6 | Só afeta a receita (já compila com a feature) |
| A4 | `Start-Process -WindowStyle Hidden` poderia esconder a primeira janela | Anti-Patterns | Inofensivo (a receita omite o parâmetro) |
| A5 | `icons/icon.ico` é obrigatório no build Windows | Code Examples | Só afeta a necessidade do gerador de ícone |
| A6 | `komorebi` ignora janelas `WS_EX_TOOLWINDOW` (observado por efeito: retângulo correto depois da mudança; a regra interna do komorebi não foi lida) | Pitfall 4 | Em outra máquina sem komorebi, o passo é inofensivo |
| A7 | WebView2 também cria processo de áudio no aviso sonoro | Pattern 2 | Se não criar, T0 ganha ~1 processo que não custaria no produto; mitigado por `shouldChime=true` |
| A8 | `--in-process-gpu` renderiza bem com janela transparente e não cai (verificado só a contagem de processos) | Variantes | E2 pode ser descartada; o plano já exige captura das 3 telas |
| A9 | Halo interno aceito visualmente pelo autor no lugar do externo | Pattern 3 | Pode exigir o wrapper sem `overflow` (mexida maior no HTML) |
| A10 | `target/` dentro do repo deixaria `node --test` lento | Estrutura | Só afeta onde pôr o `CARGO_TARGET_DIR` |
| A11 | ~430 crates transitivas do tauri são confiáveis | Package Audit | Risco de cadeia de suprimentos aceito como o do upstream |

## Open Questions (RESOLVED)

1. **Escopo do gate de memória e tolerância de CPU (A1/A2).** O que sabemos: BASE-02 cita "≤60% do private working set" e "CPU ociosa ≤". O que falta: escolher cenários e tolerância. Recomendação: adotar o texto proposto e commitar; é o autor aprovando a regra no PR/checkpoint, antes dos números.
   **RESOLVIDA → D-01 e D-02:** N1 vale nos 3 cenários (ociosa, trabalhando, precisa de você); N2 é o texto literal do autor, CPU(T0, ociosa) <= CPU(E_ref, ociosa), estrito e sem tolerância.
2. **E2 (`--in-process-gpu`) como referência?** Só entra se as 3 capturas e as 9 execuções passarem; senão E3 é a referência.
   **RESOLVIDA → D-12:** a elegibilidade de E2 é decidida pelas sondas antes de medir, gravada em `spike/results/eligibility.json` e passada como entrada explícita a `evaluateRule`; E2 com qualquer queda é excluída; inelegível, a referência é E3 mesmo que E2 gaste menos.
3. **Halo interno do glow (A9).** Julgamento visual do autor no checkpoint de fim de fase; plano B descrito.
   **RESOLVIDA → D-03:** halo interno aceito (pseudo-elemento, só `opacity`), com checagem visual do autor no checkpoint humano único do fim da fase; o plano B não é planejado.
4. **Etapa 2 dentro da Fase 1 ou já como fase 3.1?** Se a Etapa 1 passar, o roadmap manda criar a 3.1. Recomendação: o plano condicional da Etapa 2 faz só F5/F6 mínimos e o checkpoint humano; o porte de verdade fica na 3.1.
   **RESOLVIDA → D-04 e D-09:** a Etapa 2 só roda se a Etapa 1 passar; o Tauri só vence se a Etapa 1 passar e cada gate F1 a F6 for observado passando nesta fase. Gate não observado (inclusive F2, que exige polling de cursor em Rust) dá "Electron mantido; Tauri pendente de Etapa 2 incompleta", o orquestrador escala ao autor e nenhuma 3.1 é criada. F6 aqui = caminho de permissão ponta a ponta com o `permission-hook.js` real (allow, deny, id velho recusado); a paridade com `fixtures/permission-vectors.json` é o SEG-07, da fase 3.1.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Windows PowerShell | script de medição | sim | 5.1.26100.9818 | — |
| Electron 45.4.1 | E0/E1/E3/E2 | sim | 45.4.1 | — |
| Rust/cargo + MSVC | T0 | sim | 1.99.1 | — |
| crates.io (rede) | T0 (primeira compilação) | sim (usado) | ~209 crates, ~2 min | — (sem rede, T0 não compila) |
| WebView2 Runtime | T0 | sim | 157.0.4341.60 | — |
| Node / pnpm | testes | sim | v26.4.0 / 11.10.0 | — |
| Monitores | gates | 2: principal 2560×1080 a 100% em (0,0); secundário 1920×1080 a 125% em (-1920,0) | — | — |
| Espaço em disco | `target/` | 30 GB livres; `target/` = 1,2 GB | — | — |
| komorebi, yasb, windhawk | (ambiente) | rodando | — | afeta T0 (ver Pitfall 4) e a posição (área útil começa em y=30) |
| Ilha viva (`electron.exe`, 6 processos) | — | rodando | — | não tocar; isolada por HOME |

**Missing dependencies with no fallback:** nenhuma. **Rede:** a primeira compilação do T0 baixa crates (flag para o orquestrador/autor; nada de dados do projeto sai).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (Node v26.4.0), `node:assert/strict` |
| Config file | nenhum (`pnpm test` = `node --test`) |
| Quick run command | `node --test animation.test.js scripts/spike-verdict.test.js` |
| Full suite command | `pnpm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BASE-05 | Keyframes só `opacity`/`transform`; `#pill` base sem `animation` | unit (estático) | `node --test animation.test.js` | Wave 0 |
| BASE-05 | Idle = 0 animações; hidden = pausado (runtime) | integração ad hoc (CDP) | `electron.exe <repo> --user-data-dir=<tmp> --remote-debugging-port=9333` com `USERPROFILE` descartável + `node cdp-eval.js 9333 "document.getAnimations().length"` | evidência no SUMMARY |
| BASE-01 | Script roda 3×3 e grava JSON com medianas | smoke | `powershell -File scripts/measure-footprint.ps1 -Label smoke -Exe <node.exe> -ArgumentList '-e "setInterval(()=>{},1000)"' -Scenarios idle -Runs 1 -WarmupSeconds 2 -Seconds 6 -OutDir <tmp>` | Wave 0 |
| BASE-01 | Idle CPU do E1 < E0 (SC4) | dados | `node scripts/spike-verdict.js spike/results` imprime a comparação | Wave 0 |
| BASE-02 | Regra vem antes dos números | git | `RULE=$(git log --diff-filter=A --format=%H -- spike/REGRA-DE-DECISAO.md \| tail -1); FIRST=$(git log --diff-filter=A --reverse --format=%H -- 'spike/results/*.json' \| head -1); git merge-base --is-ancestor $RULE $FIRST && echo ORDEM-OK` (e `git log -- spike/results` vazio antes) | Wave 0 |
| BASE-03 | Tabela com E0, E1, E3 (E2), T0; permissão só se Etapa 1 passou | dados | `node scripts/spike-verdict.js spike/results` + `test -f spike/RESULTADOS.md` | Wave 0 |
| BASE-03 | Veredito puro correto | unit | `node --test scripts/spike-verdict.test.js` | Wave 0 |
| BASE-04 | Decisão e números em `PROJECT.md`; fase 3.1 se Tauri venceu | grep | `grep -n "Tauri" .planning/PROJECT.md` (linha em Key Decisions com números) e, se venceu, `grep -n "3.1" .planning/ROADMAP.md` | n/a |
| T0 (pré-medição) | Geometria/estilo corretos nos 2 monitores; foco inalterado | script | `EnumWindows` por PID: retângulo 440×324 (×escala) e `ex` sem `0x40000`; `GetForegroundWindow` antes/depois | Wave 0 (script de verificação) |

### Sampling Rate
- **Per task commit:** `node --test animation.test.js` (e o teste do veredito quando existir)
- **Per wave merge:** `pnpm test`
- **Phase gate:** `pnpm test` verde, ordem do git provada, JSONs de resultado presentes, evidência CDP no SUMMARY

### Wave 0 Gaps
- [ ] `animation.test.js` — BASE-05
- [ ] `scripts/measure-footprint.ps1` — BASE-01
- [ ] `scripts/spike-verdict.js` + `scripts/spike-verdict.test.js` — BASE-03
- [ ] `spike/REGRA-DE-DECISAO.md` — BASE-02 (primeiro commit da fase)
- [ ] `spike/tauri/**` + `.gitignore` (`spike/tauri/ui/`, `spike/tauri/src-tauri/gen/`)
- [ ] Rodar `pnpm test` depois de criar `spike/` para conferir que a varredura do `node --test` segue rápida

## Security Domain

`security_enforcement: true`, ASVS nível 1. A fase não toca no gate de permissão nem em hooks; a superfície é de ferramental.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication / V3 Session | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | limited | O script só lê números de WMI; sessão falsa é gerada pelo próprio script |
| V6 Cryptography | no | — |
| V10/V14 (código/cadeia de suprimentos) | yes | `Cargo.lock` commitado; `package-legitimacy` OK para `tauri`/`tauri-build`; nenhuma dependência npm nova |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Matar a ilha viva do autor por nome (`electron.exe`) | Denial of Service | `taskkill /PID <raiz> /T /F`, só PIDs lançados pelo script |
| Sessão/permissão falsa aparecer na ilha viva ou aprovar algo real | Tampering / Elevation | HOME descartável; `decide` é no-op no shim do Tauri; nenhum clique injetado; UUID de teste fixo sem hook esperando |
| Medição gravar em `~/.claude` ou em `settings.json` | Tampering | `USERPROFILE` descartável (verificado); o plano não chama `install.js` |
| Casca Tauri com superfície IPC ampla | Elevation | `capabilities` só `core:default`, janelas `island-*`, conteúdo 100% local, sem plugins |
| `--remote-debugging-port` aberto | Information Disclosure | só em execuções de verificação, loopback, instância descartável, encerrada ao fim |

## Project Constraints (from CLAUDE.md)

- Commits semânticos em pt-br (`tipo(escopo): descrição`), sem `Co-Authored-By`; PRs em pt-br; branch protegida: tudo por PR (a branch atual é `feat/fase-1-medicao`).
- Menor diff correto, sem dependência nova; pnpm; testes com `node:test`; lógica pura testável; comentários explicam o porquê, em pt-BR; identificadores em inglês; 2 espaços, aspas simples, ponto e vírgula, vírgula final; `node:` nos built-ins.
- Hooks nunca quebram nem atrasam a sessão (a fase não os toca); segurança de permissão intocada; macOS/Linux "melhor esforço, não testado" e a decisão declara que vale para o Windows.
- Não introduzir linter; não mexer em `~/.claude/settings.json`; não deletar arquivos sem confirmação; sem chamar APIs de terceiros sem confirmação (a compilação do T0 baixa crates: sinalizado).
- Não commitar arquivos temporários; documentar decisões técnicas (PROJECT.md Key Decisions).

## Sources

### Primary (HIGH confidence)
- Execuções nesta máquina em 2026-11-21: `cargo build` da casca; `GetWindowRect`/`GetWindowLong` das janelas Electron vivas e Tauri; `PrintWindow`; CDP no Electron 45 (`getAnimations`, `document.hidden`); contagem de processos com `--in-process-gpu`; `os.homedir()` com `USERPROFILE`; `Get-Counter` falhando em pt-BR; script de medição de ponta a ponta; `git archive --format=zip` + `Expand-Archive`.
- Código lido: `main.js`, `state.js`, `hook.js`, `index.html`, `preload.js`, `package.json`, `island.test.js` (cabeçalho), `.planning/*`.
- `gsd-tools query package-legitimacy check --ecosystem crates tauri tauri-build` (OK/OK).

### Secondary (MEDIUM confidence)
- https://www.electronjs.org/docs/latest/api/browser-window — `backgroundThrottling` e visibilidade (`hidden` só com `hide()`/minimizar em Windows/Linux) — doc oficial lida via WebFetch.
- https://www.electronjs.org/docs/latest/api/command-line-switches — não documenta `--in-process-gpu`, `--disable-gpu` nem `--user-data-dir` (confirmado por leitura; os switches são do Chromium e foram validados por execução).
- `.planning/research/STACK.md`, `PITFALLS.md` (Pitfall 14), `SUMMARY.md` do milestone.

### Tertiary (LOW confidence)
- Comportamento do `komorebi` com `WS_EX_TOOLWINDOW` (inferido por efeito).

(A seam `research-plan` não foi usada: todos os provedores de busca estão desligados em `config.json` e as perguntas foram respondidas por execução local e duas leituras de doc oficial.)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - versões e compilação verificadas nesta sessão
- Architecture: HIGH - método exercitado de ponta a ponta; casca renderiza e recebe estado
- Pitfalls: HIGH para os encontrados por execução (1, 2, 3, 4, 5, 6, 7, 9); MEDIUM para os marcados [ASSUMED]
- Regra de decisão: MEDIUM - limiares são do autor; escopo de N1 e tolerância de N2 são propostas (A1, A2)

**Research date:** 2026-11-21
**Valid until:** 2026-12-21 (Tauri/Electron mudam rápido; as versões fixam no `Cargo.lock` e em `package.json`)
