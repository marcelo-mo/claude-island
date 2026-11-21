---
phase: 01-spike-de-medi-o-e-decis-o-de-base
plan: 03
subsystem: infra
tags: [spike, medicao, electron, tauri, veredito, windows]

requires:
  - phase: 01-01
    provides: "regra de decisão, medidor measure-footprint.ps1 e spike-verdict.js"
  - phase: 01-02
    provides: "casca Tauri T0 validada pela D-10"
provides:
  - "spike/prepare-variants.ps1 e spike/compare-captures.ps1"
  - "spike/results: 14 tentativas de e0, e1, e3 e t0 mais eligibility.json (E2 inelegível)"
  - "spike/RESULTADOS.md com tabela, tentativas descartadas, método e veredito"
  - "Key Decisions do PROJECT.md: base continua Electron (Etapa 1 reprovada, só Windows)"
affects: [01-04]

actuals:
  tokens: 33300
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Variantes extraídas por git archive de um sha fixo, fora do repositório, com o patch de E3 só na cópia"
    - "Elegibilidade de E2 por sonda gravada antes de medir"

key-files:
  created:
    - spike/prepare-variants.ps1
    - spike/compare-captures.ps1
    - spike/results/eligibility.json
    - spike/results/e0-idle-a1.json
    - spike/results/e0-idle-a2.json
    - spike/results/e0-running-a1.json
    - spike/results/e0-waiting-a1.json
    - spike/results/e1-idle-a1.json
    - spike/results/e1-running-a1.json
    - spike/results/e1-waiting-a1.json
    - spike/results/e3-idle-a1.json
    - spike/results/e3-running-a1.json
    - spike/results/e3-waiting-a1.json
    - spike/results/t0-idle-a1.json
    - spike/results/t0-running-a1.json
    - spike/results/t0-running-a2.json
    - spike/results/t0-waiting-a1.json
    - spike/RESULTADOS.md
  modified:
    - .planning/PROJECT.md

key-decisions:
  - "Etapa 1 REPROVOU (N1 nos 3 cenários e N2): a base continua Electron; Etapa 2 não roda, caminho de permissão não é portado, sem fase 3.1"
  - "E2 inelegível (capturas PrintWindow pretas com --in-process-gpu; waiting 44,67% de diferença): E_ref = E3 e E2 não foi medida"

requirements-completed: [BASE-01, BASE-02, BASE-03, BASE-04]

coverage:
  - id: D1
    description: "Commit da regra é ancestral estrito do primeiro commit em spike/results"
    requirement: BASE-02
    verification:
      - kind: other
        ref: "git merge-base --is-ancestor 68db4e5 df25c37 -> ORDEM-OK (commits distintos)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Medianas de 3 execuções de private WS e CPU da árvore inteira nos 3 cenários para e0, e1, e3 e t0"
    requirement: BASE-01
    verification:
      - kind: integration
        ref: "node scripts/spike-verdict.js spike/results -> sem PROBLEMA nem FALTA"
        status: pass
    human_judgment: false
  - id: D3
    description: "Critério 4 (D-11): CPU ociosa de E1 abaixo da de E0"
    requirement: BASE-01
    verification:
      - kind: integration
        ref: "spike-verdict --json: idleCpuBelowCurrent.pass true (E1 0,0129% x E0 0,2266%)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Decisão, números e escopo Windows em Key Decisions do PROJECT.md"
    requirement: BASE-04
    verification:
      - kind: other
        ref: "grep -c 'Base tecnológica decidida por medição' .planning/PROJECT.md -> 1"
        status: pass
    human_judgment: false

duration: 85min
completed: 2026-11-21
status: complete
story_points_realized: 5
plan_head_before: ea6579c8f649dda4f5aec5f8fff86d3e5a2db1cc
plan_head_after: 2307b6e8521c76526994b366545c2af57187f355
commits: 4
---

# Phase 1 Plan 03: Medição e veredito da Etapa 1 Summary

**Etapa 1 reprovada: o Tauri (T0) pesa de 117,6% a 136,7% do private working set do Electron otimizado (E3) nos três cenários, contra o limite de 60%, e a CPU ociosa também fica acima. A base continua Electron.**

## Resultado (sem escalação ao Tauri)

A Etapa 1 REPROVOU. Não há escalação de "Tauri passou": o plano 04 (Etapa 2) deve ser pulado, o caminho de permissão não é portado (BASE-03) e a fase 3.1 não é criada. A decisão vale só para Windows (2 monitores, 100% e 125%).

Saída de `node scripts/spike-verdict.js spike/results` (a mesma colada sem edição em `spike/RESULTADOS.md`):

```
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

(colunas: variante, cenário, tentativa, private WS mediana em MB, faixa WS, CPU mediana em % do total, faixa CPU, processos)

Referência: e3
N1 ociosa: REPROVA (WS(t0) 94,7 MB, limite 60% de WS(e3) 69,3 MB)
N1 trabalhando: REPROVA (WS(t0) 105,1 MB, limite 60% de WS(e3) 79,5 MB)
N1 precisa de você: REPROVA (WS(t0) 114,4 MB, limite 60% de WS(e3) 97,3 MB)
N2 CPU ociosa: REPROVA (CPU(t0) 0,0105%, CPU(e3) 0,0082% do total)
Etapa 1: REPROVOU
CPU ociosa E1 × E0: E1 0,0129% abaixo de E0 0,2266%

TENTATIVA: e0 idle a1 descartada (janela fora da validade (TOPMOST, APPWINDOW ou tamanho))
TENTATIVA: t0 running a1 descartada (janela fora da validade (TOPMOST, APPWINDOW ou tamanho))
EXCLUÍDA: e2 (criterio (b) reprovado: ...)
```

Critério 4 (D-11) atendido, então o plano não parou em checkpoint. Os 426 MB antigos não são comparáveis (método não registrado); com o método desta fase a ilha atual ociosa usa 117,2 MB e 0,2266% da CPU.

## Prova de ordem no git (regra antes dos resultados)

```
RULE=68db4e5a98cc236f7caac3eea34c718c9bca236c   (docs(spike): registra a regra de decisão ..., 02:37:14)
FIRST=df25c37cb96f0f20cbcf266acb68c3b712a5866b  (chore(spike): registra a elegibilidade de E2 ..., 03:01:12)
git merge-base --is-ancestor $RULE $FIRST -> ORDEM-OK
git log --diff-filter=M -- spike/REGRA-DE-DECISAO.md -> 37568c5 (errata de tolerância, antes de qualquer medição)
git log --diff-filter=M --format= --name-only -- spike/results -> vazio (nenhum arquivo de resultado foi alterado depois de criado)
```

## Task Commits

1. **Task 1: pré-voo** - `34da605` (scripts de preparo e comparação), `df25c37` (elegibilidade de E2)
2. **Task 2: medições** - `94adbcc` (14 tentativas, inclusive as 2 descartadas)
3. **Task 3: veredito e decisão** - `2307b6e` (`spike/RESULTADOS.md` e `PROJECT.md`)

## Pré-voo (anotações exigidas pelo plano)

- `prepare-variants.ps1`: E0 `2530f30524ee6d9021627e1d542caa8076fbd4b9` (blob `206105b7...`), E1 e E3 `6a893bdde60fcf90468049376f4118d5a197d593` (commit do BASE-05, blob `8593c603...` igual ao `HEAD:index.html`, ao carimbo `ui-index.blob` do T0 recompilado e diferente do de E0). Patch de E3 com exatamente 1 ocorrência; `git diff --quiet 1f69f77 -- main.js state.js` sai 0.
- PIDs raiz da ilha viva: nenhum no começo (`Get-CimInstance` sem `electron.exe` fora do `--type=`; `live-island-roots.txt` vazio). No fim há uma raiz 6568 (`electron.exe` do checkout, iniciada às 03:47:25, lançada pelo hook `SessionStart` de outra sessão do Claude Code, não pelo medidor). Não foi tocada e não faz parte de nenhuma árvore medida.
- Sondas de E2 × E3: estabilidade de E3 0,0000% nos 3 cenários; E2 × E3 0,0000% (idle), 0,9799% (running), 44,6710% (waiting). Abrindo as PNG, as de E2 saem inteiramente pretas. E2 inelegível; não medida (12 invocações em vez de 15).
- Pasta de dados do WebView2 do T0: ao lado do `.exe` (`claude-island-spike.exe.WebView2`); `%LOCALAPPDATA%\dev.marcelo-mo.claude-island-spike` não é criada. O `-CleanDirs` cobre as duas.
- `~/.claude/island/spike-fake.json` não existe; `USERPROFILE` e `--user-data-dir` descartáveis em toda execução; nada foi gravado em `~/.claude` nem em `settings.json`.

## Deviations from Plan

### Auto-fixed Issues

Nenhum. O que difere do plano:

**1. [Ajuste de execução] `-OutDir` passado explicitamente ao medidor**
- No Windows PowerShell 5.1 desta máquina, o padrão `Join-Path $PSScriptRoot '..\spike\results'` chega vazio e o medidor aborta antes de medir (nada foi gravado). Em vez de editar o medidor depois da regra, passei `-OutDir` com a pasta `spike/results` do repositório (o medidor a reconhece como a pasta de resultados). Registrado em `spike/RESULTADOS.md`. Candidato a conserto futuro do medidor; não afeta nenhum número.

**2. [Ajuste de execução] Invocações em fila em segundo plano**
- As 11 invocações restantes depois da primeira foram enfileiradas num script sequencial (cada uma lança uma variante × cenário, nada em paralelo, ordem intercalada da regra), em vez de uma chamada do Bash por invocação, porque o Bash passa a segundo plano depois de 180 s. As remedições (t0 running a2) foram feitas depois da fila, não logo após cada linha.

### Tentativas descartadas (D-12a, dentro do teto)

- `e0 idle a1`: execução 1 com 27 processos, 588,5 MB e uma terceira janela 1902×942 sem TOPMOST; a2 válida.
- `t0 running a1`: execução 3 com a janela retiliada por um gerenciador de janelas em mosaico (17,47, 1251×956); a2 válida.

## Auth gates

Nenhum.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum. T-01-09 (ilha viva) mitigado: o medidor só encerrou PIDs que ele lançou e nenhum processo foi encerrado à mão; T-01-10 (integridade): JSON brutos commitados, inclusive os descartados, nenhum sobrescrito; T-01-11: blobs conferidos; T-01-SC: nenhuma instalação (rebuild com o `Cargo.lock` commitado).

## Pendências para o orquestrador

- Plano 04 (Etapa 2) deve ser pulado: Etapa 1 reprovada, sem fase 3.1.
- `STATE.md`/`ROADMAP.md`: o ROADMAP da fase 1 e o STATE avançam por este plano; a fase só fecha com o plano 04 resolvido como "pulado".
- Pasta `%TEMP%` tem 1 diretório `island-measure-*` órfão (descartável); pastas de variantes em `%LOCALAPPDATA%\claude-island` podem ser apagadas.

## Self-Check

PASSED: arquivos criados existem, `pnpm test` com 38 testes e 0 falhas, e os commits `34da605`, `df25c37`, `94adbcc` e `2307b6e` são ancestrais do HEAD.
