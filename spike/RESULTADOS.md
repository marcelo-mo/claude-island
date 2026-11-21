# Resultados do spike: Electron × Tauri (Etapa 1)

Medido em 2026-11-21 com a regra de `spike/REGRA-DE-DECISAO.md`, commitada em `68db4e5a98cc236f7caac3eea34c718c9bca236c`
antes de existir qualquer arquivo em `spike/results/` (o primeiro, `eligibility.json`, veio em `df25c37`).

## Ambiente

- Windows 11 Pro, versão `10.0.26300` (campo `versions.os` dos JSON), 20 processadores lógicos, PowerShell 5.1.
- 2 monitores: principal 2560×1080 a 100% e secundário 1920×1080 a 125%.
- Electron `45.4.1`. Tauri `2.12.7` (`spike/tauri/src-tauri/Cargo.lock`, 432 pacotes), WebView2 do sistema.
- Aquecimento de 30 s, janela de 60 s, amostra a cada 5 s, 3 execuções por tentativa, mediana das 3.

## Variantes

| Label | Origem (commit) | Patch | Argumentos |
|---|---|---|---|
| e0 | `2530f30524ee6d9021627e1d542caa8076fbd4b9` (antes do BASE-05) | nenhum | nenhum |
| e1 | `6a893bdde60fcf90468049376f4118d5a197d593` (BASE-05, fixado) | nenhum | nenhum |
| e3 | `6a893bdde60fcf90468049376f4118d5a197d593` + `primary-display` | `const displays = screen.getAllDisplays();` → `const displays = [screen.getPrimaryDisplay()];` só na cópia | nenhum |
| e2 | e3 + `in-process-gpu` | igual ao e3 | `--in-process-gpu` (não medida, ver abaixo) |
| t0 | HEAD do plano 03 + `tauri 2.12.7` | casca Tauri com a mesma `index.html` de E1 | nenhum |

Saída do `spike/prepare-variants.ps1` (blobs da `index.html`: E0 `206105b703d2f6b0ddbeea8a14b85ccc9942d564`, E1 e E3
`8593c6038da8194681a5454343ec33d9a89651bb`, igual ao `HEAD:index.html` e ao carimbo `ui-index.blob` do T0):

```json
{
  "e0": { "commit": "2530f30524ee6d9021627e1d542caa8076fbd4b9", "indexBlob": "206105b703d2f6b0ddbeea8a14b85ccc9942d564" },
  "e1": { "commit": "6a893bdde60fcf90468049376f4118d5a197d593", "indexBlob": "8593c6038da8194681a5454343ec33d9a89651bb" },
  "e3": { "commit": "6a893bdde60fcf90468049376f4118d5a197d593", "indexBlob": "8593c6038da8194681a5454343ec33d9a89651bb",
          "patch": "const displays = screen.getAllDisplays(); -> const displays = [screen.getPrimaryDisplay()];" }
}
```

## Elegibilidade de E2 (D-12)

E2 ficou inelegível, gravado em `spike/results/eligibility.json` antes de medir. Sondas curtas (aquecimento de 8 s,
janela de 5 s, `--force-prefers-reduced-motion` só nas sondas): a estabilidade de E3 entre duas execuções foi 0,0000% nos
três cenários, mas a captura de E2 contra a de E3 deu 0,0000% (idle), 0,9799% (running) e 44,6710% (waiting), acima do
limite de 1% em waiting. Abrindo as PNG, as capturas de E2 saem inteiramente pretas: com `--in-process-gpu` o
`PrintWindow` não enxerga o conteúdo da janela, então a equivalência visual com E3 não é demonstrável. Pela regra,
E_ref = E3 e E2 não é medida.

## Tentativas descartadas e linhas inválidas (D-12a)

| Tentativa | Motivo | Resultado |
|---|---|---|
| e0 idle a1 | a execução 1 apareceu com 27 processos, 588,5 MB e uma terceira janela de 1902×942 sem TOPMOST (fora da validade D-10); as execuções 2 e 3 tinham 5 processos e 2 janelas | descartada; vale a a2 (válida) |
| t0 running a1 | a execução 3 mostrou a janela em 17,47 com 1251×956: retiliada por um gerenciador de janelas em mosaico (fora da validade D-10, o caso que o critério existe para pegar) | descartada; vale a a2 (válida) |

Nenhuma linha ficou INVÁLIDA (todas as combinações de e0, e1, e3 e t0 têm tentativa válida). Nenhum arquivo de tentativa foi
sobrescrito. Durante a medição a ilha viva do autor não existia no começo; um processo `electron.exe` da ilha do checkout
(raiz 6568, não lançado pelo medidor) subiu às 03:47:25, pelo hook de `SessionStart` de outra sessão do Claude Code, e
ficou fora de todas as árvores medidas.

## Como reproduzir

Electron (E0, E1, E3), da raiz do repositório, com as pastas geradas por `spike/prepare-variants.ps1`:

```
powershell -NoProfile -File scripts/measure-footprint.ps1 -Label {e0|e1|e3} -App "$env:LOCALAPPDATA\claude-island\spike-variants\{e0|e1|e3}" -Source "{origem}" -Scenarios {idle|running|waiting} -OutDir "<raiz>\spike\results"
```

Tauri (T0), depois de `powershell -NoProfile -File spike/tauri/build.ps1`:

```
powershell -NoProfile -File scripts/measure-footprint.ps1 -Label t0 -Exe "$env:LOCALAPPDATA\claude-island\spike-tauri-target\release\claude-island-spike.exe" -CleanDirs "$env:LOCALAPPDATA\claude-island\spike-tauri-target\release\claude-island-spike.exe.WebView2,$env:LOCALAPPDATA\dev.marcelo-mo.claude-island-spike" -Source "{sha}+tauri 2.12.7" -Scenarios {idle|running|waiting} -OutDir "<raiz>\spike\results"
```

Observação: `-OutDir` foi passado explicitamente porque, neste Windows PowerShell 5.1, o padrão do parâmetro
(`Join-Path $PSScriptRoot ...`) chega vazio e o medidor aborta antes de medir; o diretório passado é o mesmo que o
medidor trata como o de resultados do repositório. A pasta de dados do WebView2 do T0 fica ao lado do `.exe`
(`claude-island-spike.exe.WebView2`); o `-CleanDirs` cobre também `%LOCALAPPDATA%\dev.marcelo-mo.claude-island-spike`.

Veredito: `node scripts/spike-verdict.js spike/results`.

## Relatório do veredito (saída de `node scripts/spike-verdict.js spike/results`, sem edição)

# Veredito da Etapa 1

| Variante | Cenário | Tentativa | Private WS mediana (MB) | Faixa WS (mín–máx) | CPU mediana (% do total) | Faixa CPU | Processos |
|---|---|---|---|---|---|---|---|
| e0 | idle | a2 | 117,2 | 112,9–117,3 | 0,2266 | 0,1884–0,2405 | 5 |
| e0 | running | a1 | 241,3 | 240,6–246,7 | 1,5615 | 1,5550–1,6352 | 5 |
| e0 | waiting | a1 | 137,4 | 136,3–141,6 | 1,8550 | 1,7432–2,0255 | 6 |
| e1 | idle | a1 | 88,3 | 85,6–91,4 | 0,0129 | 0,0105–0,0196 | 5 |
| e1 | running | a1 | 101,3 | 100,7–102,9 | 0,7086 | 0,7043–0,7254 | 5 |
| e1 | waiting | a1 | 121,7 | 121,6–132,5 | 0,8615 | 0,6592–0,8684 | 6 |
| e3 | idle | a1 | 69,3 | 69,1–70,6 | 0,0082 | 0,0023–0,0176 | 4 |
| e3 | running | a1 | 79,5 | 78,5–80,0 | 0,4067 | 0,3981–0,4140 | 4 |
| e3 | waiting | a1 | 97,3 | 95,2–98,6 | 0,3495 | 0,0327–0,3514 | 5 |
| t0 | idle | a1 | 94,7 | 94,6–97,1 | 0,0105 | 0,0059–0,0235 | 7 |
| t0 | running | a2 | 105,1 | 104,6–106,8 | 0,2737 | 0,2593–0,2799 | 7 |
| t0 | waiting | a1 | 114,4 | 113,7–114,8 | 0,2794 | 0,2687–0,2940 | 8 |

Cenários: idle = ociosa, running = trabalhando, waiting = precisa de você.

Referência: e3
N1 ociosa: REPROVA (WS(t0) 94,7 MB, limite 60% de WS(e3) 69,3 MB)
N1 trabalhando: REPROVA (WS(t0) 105,1 MB, limite 60% de WS(e3) 79,5 MB)
N1 precisa de você: REPROVA (WS(t0) 114,4 MB, limite 60% de WS(e3) 97,3 MB)
N2 CPU ociosa: REPROVA (CPU(t0) 0,0105%, CPU(e3) 0,0082% do total)
Etapa 1: REPROVOU
CPU ociosa E1 × E0: E1 0,0129% abaixo de E0 0,2266%

TENTATIVA: e0 idle a1 descartada (janela fora da validade (TOPMOST, APPWINDOW ou tamanho))
TENTATIVA: t0 running a1 descartada (janela fora da validade (TOPMOST, APPWINDOW ou tamanho))
EXCLUÍDA: e2 (criterio (b) reprovado: a captura PrintWindow de E2 no cenario waiting difere 44.6710% da de E3 (limite 1%); em running 0.9799% e em idle 0.0000%. As capturas de E2 saem inteiramente pretas, com o switch --in-process-gpu o PrintWindow nao enxerga o conteudo da janela, entao a equivalencia visual com E3 nao e demonstravel. E2 nao e medida e E_ref = E3.)

## Leitura

- **Etapa 1: REPROVOU.** A referência é E3 (E2 inelegível). N1 reprova nos três cenários: T0 pesa 136,7% do private
  working set de E3 na ociosa (94,7 contra 69,3 MB), 132,2% em trabalhando (105,1 contra 79,5 MB) e 117,6% em precisa de
  você (114,4 contra 97,3 MB), quando o limite é 60%. N2 também reprova, por pouco: CPU ociosa do T0 0,0105% do total
  contra 0,0082% do E3 (D-02, estrito).
- **N2 está dentro do ruído de medição e não sustenta a decisão.** A CPU vem de `KernelModeTime` e `UserModeTime` do
  `Win32_Process`, contabilizados por tick do escalonador (cerca de 15,6 ms), e na ociosa as faixas das 3 execuções se
  sobrepõem por completo: T0 0,0059–0,0235% e E3 0,0023–0,0176%, com medianas 0,0105% e 0,0082% (diferença de 0,0023
  ponto). A regra congelada e os limiares não mudam, e o veredito "REPROVOU" continua o mesmo; ele se apoia no N1, que
  reprova por larga margem nos três cenários (T0 em 117,6% a 136,7% do E3, contra o limite de 60%). N2 não deve ser
  citado como evidência no `PROJECT.md`. Numa nova medição, usar o contador de ciclos por processo
  (`QueryProcessCycleTime`) ou uma tolerância justificada pela variação observada por execução.
- **Critério 4 (D-11) atendido:** a CPU ociosa de E1 (0,0129% do total) ficou abaixo da de E0 (0,2266%), o que mostra o
  efeito do BASE-05.
- **A base continua Electron.** Pela D-04 e D-09 a Etapa 2 não roda, o caminho de permissão não é portado (BASE-03) e não
  há fase 3.1; o plano 04 se pula.
- **A decisão vale para o Windows** (2 monitores, 100% e 125%). macOS e Linux não foram medidos; uma base Tauri exigiria
  validação separada em macOS e Linux antes de a fase 3.1 ser fechada (D-13), o que aqui não se aplica porque o Tauri
  reprovou.
- **Os 426 MB antigos não são comparáveis** (método não registrado). Com o método desta fase, a ilha atual (E0, 2 janelas,
  ociosa) usa 117,2 MB de private working set e 0,2266% da CPU; com o BASE-05 (E1), 88,3 MB e 0,0129%; com uma janela
  (E3), 69,3 MB e 0,0082%.
- O veredito está em `scripts/spike-verdict.js`, ferramenta do spike fora do `state.js`.
