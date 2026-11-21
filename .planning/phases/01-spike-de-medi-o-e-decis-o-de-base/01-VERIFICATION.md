---
phase: 01-spike-de-medi-o-e-decis-o-de-base
verified: 2026-11-21T12:00:00Z
status: human_needed
score: 4/5 must-haves verified
covered_files:
  - .planning/PROJECT.md
  - .planning/phases/01-spike-de-medi-o-e-decis-o-de-base/01-01-PLAN.md
  - .planning/phases/01-spike-de-medi-o-e-decis-o-de-base/01-01-SUMMARY.md
  - .planning/phases/01-spike-de-medi-o-e-decis-o-de-base/01-02-PLAN.md
  - .planning/phases/01-spike-de-medi-o-e-decis-o-de-base/01-02-SUMMARY.md
  - .planning/phases/01-spike-de-medi-o-e-decis-o-de-base/01-03-PLAN.md
  - .planning/phases/01-spike-de-medi-o-e-decis-o-de-base/01-03-SUMMARY.md
  - .planning/phases/01-spike-de-medi-o-e-decis-o-de-base/01-04-PLAN.md
  - .planning/phases/01-spike-de-medi-o-e-decis-o-de-base/01-04-SUMMARY.md
  - animation.test.js
  - index.html
  - scripts/measure-footprint.ps1
  - scripts/spike-verdict.js
  - scripts/spike-verdict.test.js
  - spike/REGRA-DE-DECISAO.md
  - spike/RESULTADOS.md
  - spike/results/eligibility.json
covered_digest: "v4:sha256:df374c9cc8239d607acbd30521b47f529749cb52f09bd9952233e264dcf3acb4"
behavior_unverified: 1
overrides_applied: 0
behavior_unverified_items:
  - truth: "Com a ilha parada ou escondida nenhuma animação CSS roda (critério 4 do roadmap)"
    test: "Com a ilha ociosa, abrir o DevTools da janela e rodar document.getAnimations().length (esperado 0); depois esconder a janela (hide()/minimizar) com a ilha em running e conferir que data-hidden fica true e getAnimations() só devolve animações pausadas"
    expected: "0 animações ativas ociosa; animações pausadas (playState paused) com a janela escondida"
    why_human: "animation.test.js só confere o CSS e o listener por regex; nenhum teste exercita a transição visibilitychange nem getAnimations() em runtime. A metade 'parada' tem evidência empírica (CPU ociosa de E1 0,0129% contra 0,2266% de E0); a metade 'escondida' só tem presença estática"
human_verification:
  - test: "Halo interno (D-03): rodar `powershell -NoProfile -File scripts/measure-footprint.ps1 -Label olhar -App . -Scenarios running -Runs 1 -WarmupSeconds 60 -Seconds 10 -OutDir \"$env:TEMP\\olhar\"` e olhar a pílula; repetir com `-Scenarios waiting`"
    expected: "O contorno pulsa por dentro da pílula, em laranja (running) e âmbar (waiting), sem halo externo e sem pintar o texto do pedido; ociosa nada pisca. Não clicar em Permitir/Negar"
    why_human: "Aparência visual do brilho interno que substituiu o halo externo (o overflow:hidden da pílula recortaria o externo). O checkpoint humano da Task 3 do plano 01-04 ficou pending-human (autor ausente), não aprovado"
  - test: "Hidden/idle em runtime (ver behavior_unverified_items)"
    expected: "getAnimations() = 0 ociosa; animações pausadas com a janela escondida"
    why_human: "Nenhum teste automatizado exercita a transição em runtime"
---

# Fase 1: Spike de medição e decisão de base: Relatório de verificação

**Objetivo da fase:** O autor sabe, por número reproduzível e regra escrita antes da medição, se a base continua Electron ou vira Tauri, e a ilha parada deixa de gastar CPU com animação contínua
**Verificado em:** 2026-11-21
**Status:** human_needed
**Reverificação:** Não, verificação inicial

## Alcance do objetivo

### Verdades observáveis (os 5 critérios de sucesso do ROADMAP)

| # | Verdade | Status | Evidência |
|---|---------|--------|-----------|
| 1 | Regra Electron × Tauri versionada em commit anterior ao primeiro número medido | ✓ VERIFIED | `68db4e5` (02:37:14) adiciona `spike/REGRA-DE-DECISAO.md`; o erratum de tolerância `37568c5` (02:43:04) também vem antes. O primeiro commit com arquivo em `spike/results/` é `df25c37` (03:01:12, `eligibility.json`). `git merge-base --is-ancestor 68db4e5 df25c37` sai 0. `git log df25c37..HEAD -- spike/REGRA-DE-DECISAO.md` vazio: a regra não mudou depois. A regra contém gates funcionais F1 a F6 em 2 monitores, N1 (60% do WS) e N2 (CPU ociosa) |
| 2 | `scripts/measure-footprint.ps1` dá a mediana de 3 execuções do private working set e da CPU somados na árvore inteira, nos 3 cenários | ✓ VERIFIED | Recalculei a mediana de `runs[]` dos 14 JSON em `spike/results/` com um script próprio: todas as 14 batem com o campo `median` gravado e com a tabela do veredito (ex.: e1 idle 88,3 MB / 0,0129%; t0 waiting 114,4 / 0,2794). O medidor usa `Win32_Process` (ParentProcessId, árvore) e `WorkingSetPrivate` por PID; t0 chega a 7-8 processos (WebView2 incluído). 3 runs por tentativa em todos |
| 3 | Tabela E0/E1/E3/T0 comparando; caminho de permissão só portado se passou a Etapa 1 | ✓ VERIFIED | `spike/RESULTADOS.md` traz a tabela e o relatório de `node scripts/spike-verdict.js spike/results` (rodei: saída idêntica, Etapa 1 REPROVOU). E2 excluído por elegibilidade (`eligibility.json`, capturas pretas com `--in-process-gpu`), declarado. Etapa 1 reprovada: `grep -rni "autodecide\|permission" spike/tauri/src-tauri/src` só acha o comentário de guarda e `session.permission` do shim; nenhum `fn decide`, nenhum `check-permission.ps1`; plano 01-04 pulou a Etapa 2 (commits: 0) |
| 4 | Ilha parada/escondida sem animação CSS (brilho só `opacity`/`transform`); script mostra CPU ociosa abaixo do Electron atual | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Código: `@keyframes glow { 50% { opacity: 1; } }` (era `box-shadow`); `::before` só anima fora de `idle`; `#dot`/`#dots` só animam em running (`#dots` é `display:none` fora de running); `html[data-hidden="true"] ... animation-play-state: paused`; listener de `visibilitychange`. `animation.test.js` cobre estaticamente e passa (`pnpm test`: 38/38). Medido: CPU ociosa E1 0,0129% < E0 0,2266% (veredito "E1 abaixo de E0"). Falta prova em runtime da pausa com a janela escondida: ver `behavior_unverified_items` |
| 5 | `PROJECT.md` (Key Decisions) registra decisão e números; sem fase 3.1 porque o Tauri reprovou | ✓ VERIFIED | Linha "Base tecnológica decidida por medição na Fase 1 (Windows): Electron (Etapa 1 reprovada)" com os 3 cenários T0/E_ref em MB e percentuais, CPU ociosa E0→E1, escopo só Windows e ponteiro para `spike/RESULTADOS.md`. `grep "3\.1" ROADMAP.md`: a 3.1 continua "condicional, não existe agora" |

**Score:** 4/5 verdades verificadas (1 presente, comportamento não verificado em runtime)

### Itens diferidos

Nenhum.

### Artefatos exigidos

| Artefato | Esperado | Status | Detalhes |
|----------|----------|--------|----------|
| `spike/REGRA-DE-DECISAO.md` | Regra pré-registrada, contém N2 | ✓ VERIFIED | 150 linhas, N1/N2/D-10/D-12/D-12a/Etapa 2/Errata |
| `scripts/measure-footprint.ps1` | Medidor, contém `WorkingSetPrivate` | ✓ VERIFIED | 355 linhas, árvore por `ParentProcessId`, `WorkingSetPrivate` (l.200-201) |
| `scripts/spike-verdict.js` + `.test.js` | `evaluateRule` e demais exports; vetores | ✓ VERIFIED | `node scripts/spike-verdict.js spike/results` roda e emite o relatório; testes passam |
| `animation.test.js` | Guarda estática de BASE-05 | ✓ VERIFIED | 5 testes passam |
| `index.html` | `#pill::before` por opacity + pausa hidden | ✓ VERIFIED | Diff E0→E1 conferido |
| `spike/results/*.json` | 14 tentativas + `eligibility.json` | ✓ VERIFIED | Nenhuma sobrescrita; a1 de e0-idle e t0-running descartadas por janela inválida (D-10) com motivo registrado |
| `spike/tauri/**` | Casca T0 | ✓ VERIFIED | `build.ps1`, `src-tauri/`, `Cargo.lock`; `ui/` ignorado pelo git (`git status` limpo exceto `.planning/state.json`) |
| `spike/prepare-variants.ps1`, `spike/compare-captures.ps1` | Variantes e capturas | ✓ VERIFIED | Presentes; usados na RESULTADOS.md |
| `spike/RESULTADOS.md` | Tabela, tentativas, veredito, como reproduzir | ✓ VERIFIED | Contém `| t0 | idle |` |
| `.planning/PROJECT.md` | Key Decisions com a decisão | ✓ VERIFIED | Ver nota de coerência abaixo |

### Verificação de ligações

| De | Para | Via | Status | Detalhes |
|----|------|-----|--------|----------|
| `spike-verdict.js` | JSON do medidor | `privateWsMb`, `median`, `runs[].windows`, `eligibility.json` | ✓ WIRED | Rodou de ponta a ponta sobre os arquivos reais |
| `REGRA-DE-DECISAO.md` | `evaluateRule` | N1/N2/D-10/D-12a | ✓ WIRED | Saída reproduz N1 reprova nos 3 cenários, N2 reprova estrito, descarte de tentativas |
| `index.html` | `index.html` | `visibilitychange` → `dataset.hidden` → CSS | ⚠️ PARTIAL | Presente e conferido por regex; sem teste de runtime |
| `PROJECT.md` | `spike/RESULTADOS.md` | linha de Key Decisions cita os números e aponta a tabela | ✓ WIRED | |
| `eligibility.json` | `spike-verdict.js` | `loadResults` | ✓ WIRED | E2 aparece como EXCLUÍDA no relatório |

### Fluxo de dados (Nível 4)

| Artefato | Variável | Fonte | Dados reais | Status |
|----------|----------|-------|-------------|--------|
| `spike-verdict.js` (tabela) | mediana WS/CPU | `runs[]` dos JSON gravados pelo medidor | Sim: recalculado independentemente, 14/14 batem | ✓ FLOWING |

### Verificações comportamentais pontuais

| Comportamento | Comando | Resultado | Status |
|---------------|---------|-----------|--------|
| Veredito reproduz a tabela | `node scripts/spike-verdict.js spike/results` | Mesma tabela e "Etapa 1: REPROVOU" que `RESULTADOS.md` | ✓ PASS |
| Testes do projeto | `pnpm test` | 38 pass, 0 fail | ✓ PASS |
| Medianas reproduzíveis | script próprio sobre `runs[]` | 14/14 iguais ao gravado | ✓ PASS |
| Ordem regra → resultado | `git merge-base --is-ancestor 68db4e5 df25c37` | exit 0 | ✓ PASS |
| Nada do spike no `~/.claude` real | `ls ~/.claude/island \| grep -i spike` | vazio | ✓ PASS |
| Medição nova (Electron/Tauri) | não executada (longa; fora do escopo da verificação) | n/a | ? SKIP |

### Execução de sondas

Fase não declara `scripts/*/tests/probe-*.sh`; as sondas de captura (`spike/compare-captures.ps1`) já rodaram e estão gravadas em `eligibility.json`. Não re-executei (exigem Electron em tela e vários minutos). Status: SKIPPED, sem sondas conforme o contrato do passo 7c.

### Cobertura de requisitos

| Requisito | Plano de origem | Descrição | Status | Evidência |
|-----------|-----------------|-----------|--------|-----------|
| BASE-01 | 01-01, 01-03 | Script versionado, árvore inteira, 3 cenários, mediana de 3 | ✓ SATISFIED | Critério 2; medianas recalculadas |
| BASE-02 | 01-01, 01-03 | Regra escrita e versionada antes da medição | ✓ SATISFIED | Critério 1; `is-ancestor` exit 0 |
| BASE-03 | 01-02, 01-03, 01-04 | E0, otimizado (1 janela, sem box-shadow contínuo), T0 com a mesma UI; permissão só portada se passou | ✓ SATISFIED | Critério 3; Etapa 2 pulada com `commits: 0` |
| BASE-04 | 01-03, 01-04 | Decisão e números no PROJECT.md | ✓ SATISFIED | Critério 5 (nota de coerência abaixo) |
| BASE-05 | 01-01 | Brilho só opacity/transform; nada anima ocioso/escondido | ✓ SATISFIED (com ressalva) | Ociosa: medida (0,2266% → 0,0129%). Escondida: só estático; ver item de comportamento não verificado e o halo D-03 |

Todos os 5 IDs aparecem nos `requirements` dos PLANs e em REQUIREMENTS.md; os 5 estão marcados como Complete. Nenhum requisito órfão.

### Anti-padrões encontrados

| Arquivo | Linha | Padrão | Severidade | Impacto |
|---------|-------|--------|------------|---------|
| `.planning/PROJECT.md` | 91 | Cita "(N2 estrito reprova)" como parte do rationale, enquanto `spike/RESULTADOS.md` (commit `2c12910`) diz que N2 está dentro do ruído e "não deve ser citado como evidência no PROJECT.md" | ⚠️ Warning | Inconsistência documental: a decisão não depende de N2 (N1 reprova por larga margem), mas o PROJECT.md ainda sugere N2 como suporte. Sugestão: acrescentar "dentro do ruído; a decisão se apoia no N1" à linha |
| arquivos da fase | n/a | `TBD`/`FIXME`/`XXX` | nenhum | Varredura limpa |

Não considero blocker: os números continuam corretos e N1 sozinho decide.

### Verificação humana necessária

#### 1. Halo interno (D-03) no running e no waiting

**Teste:** `powershell -NoProfile -File scripts/measure-footprint.ps1 -Label olhar -App . -Scenarios running -Runs 1 -WarmupSeconds 60 -Seconds 10 -OutDir "$env:TEMP\olhar"`, olhar a pílula; repetir com `-Scenarios waiting`. Confira antes que a ilha viva não tenha pedido de permissão pendente; não clicar em Permitir/Negar.
**Esperado:** contorno pulsando por dentro da pílula (laranja em running, âmbar em waiting), sem halo externo e sem pintar o texto do pedido; ociosa nada pisca.
**Por que humano:** aparência visual. O checkpoint da Task 3 do plano 01-04 está `pending-human`, não aprovado; reprovou = registrar lacuna D-03 (plano B fora desta fase).

#### 2. Pausa das animações com a janela escondida e `getAnimations()` ociosa

**Teste:** ver `behavior_unverified_items`.
**Esperado:** 0 animações ociosa; pausadas com a janela escondida.
**Por que humano:** nenhum teste exercita a transição em runtime; presença de CSS e listener não prova a invariante.

### Resumo das lacunas

Nenhuma lacuna bloqueante. A decisão (Electron mantido) está sustentada: regra anterior à medição (git), medianas reproduzidas a partir dos JSON brutos, N1 reprovando nos 3 cenários (T0 em 117,6% a 136,7% do E3 contra o limite de 60%), Etapa 2 corretamente não executada, 3.1 não criada. A fase fica em `human_needed` por dois itens: o checkpoint visual do halo (D-03), pendente do autor, e a prova em runtime da pausa das animações com a janela escondida. Escopo declarado: só Windows com 2 monitores; macOS e Linux não medidos. Os resultados vêm do binário Tauri anterior às correções do code review (5ef5b04..2c12910, 5/5 corrigidas; binário reconstruído e verificado em fumaça pelo orquestrador); as correções não alteram os números medidos.

---

_Verificado: 2026-11-21_
_Verificador: Claude (gsd-verifier)_
