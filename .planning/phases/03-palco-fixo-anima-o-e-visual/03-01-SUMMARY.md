---
phase: 03-palco-fixo-anima-o-e-visual
plan: 01
subsystem: ui
tags: [electron, spring-physics, preferences, renderer, gate, node-test]

requires:
  - phase: 02-seguranca
    provides: "bloco regras-do-gate, settleStep, restartArming, travas de gate.test.js, THIRD_PARTY_NOTICES.md"
provides:
  - "normalizePreferences e as listas de tema, forma e estilo em state.js; preferences no payload de island:state"
  - "bloco puro mola (4 estilos, velocidade 0,5x a 2x, encolher sem balanço) testado por extração em node:vm"
  - "canArm: Permitir e Negar só armam com o retângulo assentado e todas as molas paradas"
  - "pílula que muda de tamanho por mola, com laço de quadros que para sozinho"
affects: [03-02-palco-formas-nudge-hover, 03-03-temas-material, fase-4-menu-preferencias]

actuals:
  tokens: 12000
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "bloco puro inline entre marcadores, extraído e executado em node:vm vazio (agora generalizado em loadInlineBlock)"
    - "preferência visual: arquivo lido uma vez pelo main, normalizada em state.js e enviada no payload; o renderer só aplica"

key-files:
  created:
    - .planning/phases/03-palco-fixo-anima-o-e-visual/03-01-SUMMARY.md
  modified:
    - state.js
    - main.js
    - index.html
    - island.test.js
    - gate.test.js
    - fixtures/permission-vectors.json

key-decisions:
  - "Ao encolher o amortecimento sobe até o crítico (c >= 2·√k) em todo estilo: desvio deliberado do mod para cumprir o ANIM-01; o Elástico só difere do Padrão ao crescer"
  - "Mola inline no index.html (D-03), CSP intacta; mover para spring.js só quando houver reuso fora do renderer"
  - "Direção desconhecida usa a mola neutra (k=280, c=24) sem fator de estilo"
  - "Teto de SPRING_MAX_STEPS = 2000 passos por quadro como defesa contra velocidade fora da faixa (T-03-05)"

patterns-established:
  - "canArm: predicado estrito (=== true) que combina o retângulo assentado com as molas paradas"
  - "Cola das molas: measurePillTarget (layout com conteúdo final) -> setSizeTarget (retarget sem salto) -> startSpringLoop (único caminho de animação)"

requirements-completed: [ANIM-01, ANIM-02, ANIM-04, ANIM-05, VIS-05]

coverage:
  - id: D1
    description: "Preferências de preferences.json normalizadas no main e aplicadas no renderer (data-theme, data-shape, estilo e velocidade das molas)"
    requirement: "ANIM-02"
    verification:
      - kind: unit
        ref: "island.test.js#normalizePreferences (7 testes) e gate.test.js#o main lê as preferências uma única vez"
        status: pass
    human_judgment: false
  - id: D2
    description: "Mola assimétrica e interrompível: Padrão passa 4 a 8% ao crescer, encolhe sem balanço em todo estilo e velocidade, retarget sem salto"
    requirement: "ANIM-01"
    verification:
      - kind: unit
        ref: "gate.test.js#mola Padrão ao crescer passa do alvo entre 4% e 8% e assenta em menos de 2 s"
        status: pass
      - kind: unit
        ref: "gate.test.js#mola ao encolher não balança em nenhum estilo nem velocidade"
        status: pass
    human_judgment: false
  - id: D3
    description: "Laço de molas que para sozinho; movimento reduzido e janela escondida vão direto ao alvo"
    requirement: "ANIM-04"
    verification:
      - kind: unit
        ref: "gate.test.js#o laço das molas só abre com algo em movimento"
        status: pass
    human_judgment: false
  - id: D4
    description: "Botões só armam com todas as molas paradas (canArm com 8 vetores e trava em waitUntilSettled)"
    requirement: "ANIM-05"
    verification:
      - kind: unit
        ref: "gate.test.js#canArm (8 vetores) e #os botões só armam com o retângulo assentado e todas as molas paradas"
        status: pass
    human_judgment: false
  - id: D5
    description: "Alvo da pílula medido no DOM com o conteúdo final, sem largura presa a uma fonte"
    requirement: "VIS-05"
    verification:
      - kind: unit
        ref: "gate.test.js#render mede o alvo no DOM com o conteúdo final e liga as molas"
        status: pass
    human_judgment: false
  - id: D6
    description: "A pílula cresce com leve passagem, encolhe sem balanço e um alvo novo no meio não dá salto, olhando a ilha real em cada estilo e velocidade"
    verification: []
    human_judgment: true
    rationale: "Sensação de movimento só se avalia olhando a ilha; o executor não sobe o Electron (a ilha do autor roda de outra pasta). Vai no checklist do PR."

duration: 45min
completed: 2026-11-21
story_points_realized: 8
status: complete
plan_head_before: ec6a20932802d3878d0f5e21207e7954f03fab94
plan_head_after: 2d3659cf57b8b24c872d6ca4865f01841f17ea7a
commits: 6
---

# Phase 3 Plan 01: Palco fixo, animação e visual (molas e preferências) Summary

**Pílula que cresce e encolhe por mola (4 estilos, 0,5x a 2x, encolher criticamente amortecido), com preferências lidas do arquivo pelo main e botões que só armam com todas as molas paradas.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-11-21
- **Tasks:** 3 (traçador, mola pura com `canArm`, cola das molas)
- **Files modified:** 6 (`state.js`, `main.js`, `index.html`, `island.test.js`, `gate.test.js`, `fixtures/permission-vectors.json`)
- **Suíte:** 194 testes na base, 226 ao final, 0 falhas

## Accomplishments

- **Traçador de preferências:** `~/.claude/island/preferences.json` é lido uma vez pelo main, normalizado por `normalizePreferences` (arquivo ausente, corrompido ou valor inválido cai no padrão por chave, sem lançar) e enviado em `island:state`. O renderer só aplica (`applyPreferences`: `data-theme`, `data-shape` e rearme se mudaram com pedido na tela). Nenhum canal IPC novo, sem watch e sem gravação.
- **Mola pura** (`// mola:inicio ... // mola:fim`): constantes do mod com origem MIT apontando para `THIRD_PARTY_NOTICES.md`. Medido por simulação: Padrão passa 5,8% ao crescer (faixa 4 a 8%), Suave 0,13%, Elástico 20,8%, Rápido 5,3%; ao encolher nenhum estilo passa do alvo em nenhuma velocidade (0,00%); 2x assenta em 50% do tempo de 1x e 0,5x em 200%, com o mesmo pico.
- **`canArm`** no bloco `regras-do-gate`, com 8 vetores novos no fixture (vetores existentes intocados). `waitUntilSettled` só arma com `canArm({ settled, springsAtRest })`.
- **Cola das molas:** `measurePillTarget` lê o layout com o conteúdo final, `setSizeTarget` troca o alvo sem salto, `startSpringLoop` é o único caminho de animação (movimento reduzido ou janela escondida pulam ao alvo; com tudo parado nenhum quadro é agendado). A transição CSS de largura, altura e transform foi removida.

## Task Commits

1. **Task 1 (traçador): preferências do arquivo ao renderer**
   - `5e9347b` test: cobre a leitura e o envio das preferências visuais
   - `5279eda` feat: lê as preferências visuais no main e as aplica no renderer (inclui a trava do payload, no mesmo commit do texto que ela guarda, D-12)
2. **Task 2: mola pura e `canArm`**
   - `60bb1eb` test: cobre a mola e o armamento com molas paradas
   - `c879ec5` feat: acrescenta a mola pura e o predicado de armamento com molas paradas
3. **Task 3: cola das molas de tamanho**
   - `d930af9` test: trava a cola das molas de tamanho
   - `2d3659c` feat: anima o tamanho da pílula por mola e só arma com as molas paradas

## Files Created/Modified

- `state.js` - `PREFERENCES_FILE`, `THEMES`, `SHAPES`, `ANIMATION_STYLES`, faixa de velocidade, `DEFAULT_PREFERENCES`, `normalizePreferences`
- `main.js` - `loadPreferences` (leitura única) e `preferences` no payload de `island:state`
- `index.html` - `applyPreferences`, bloco `mola`, `canArm`, cola das molas, CSS da `#pill` sem transição de tamanho e com `--content-width`
- `island.test.js` - 7 testes de `normalizePreferences` e das constantes
- `gate.test.js` - `loadInlineBlock`, `loadSpringRules`, `simulate`, propriedades da mola, vetores `canArm`, travas do main, do renderer e da cola
- `fixtures/permission-vectors.json` - grupo `canArm` acrescentado depois de `isIslandSender`

## Decisions Made

- Encolher no mínimo crítico em todo estilo é um **desvio deliberado do mod** (com os fatores do mod o Elástico balançaria ~6% ao encolher; o ANIM-01 manda encolher sem balanço). Registrar no checklist do PR: o Elástico só difere do Padrão ao crescer.
- Direção desconhecida usa a mola neutra sem fator de estilo (D-07/D-08 fixam a neutra em k=280/c=24).
- Mola inline, CSP exata mantida; o `ponytail:` do bloco `regras-do-gate` foi reescrito para refletir que a Fase 3 manteve tudo inline.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Teto de passos por quadro em `springStep`**
- **Found during:** Task 2
- **Issue:** `springStep` aceita qualquer `speed` finito > 0; um valor enorme (preferência adulterada que furasse a normalização, ou chamada futura) faria `frame * speed / 0,5` passos num só quadro, travando o renderer (T-03-05, laço eterno).
- **Fix:** constante `SPRING_MAX_STEPS = 2_000` (50 ms a 20x) limita o número de passos por quadro; dentro da faixa 0,5x a 2x o teto nunca é atingido (máximo 200 passos).
- **Files modified:** `index.html`
- **Committed in:** `c879ec5`

**2. [Rule 1 - Test expectation] Esperado de `springParams('shrink', 'bouncy')` com ponto flutuante**
- **Found during:** Task 2
- **Issue:** o plano descreve `{ 220, 2·√220 }`, mas `200 × 1,1` vale `220,00000000000003` em ponto flutuante; o `deepEqual` estrito falhava por 3e-14.
- **Fix:** o teste repete a conta do mod (`200 * 1.1`) em vez do literal 220. O comportamento da função não mudou.
- **Files modified:** `gate.test.js`
- **Committed in:** `c879ec5`

**3. [Processo] Ledger de commits do plano não gravado em disco**
- O ambiente recusou escrever o arquivo `gsd-plan-head-before-03-01` no diretório `.git` compartilhado do worktree. `plan_head_before` e `commits` foram medidos com o HEAD anotado antes do primeiro commit (`ec6a209`) e `git rev-list --count ec6a209..HEAD` (= 6).

---

**Total deviations:** 3 (1 Rule 2, 1 Rule 1 de teste, 1 de processo)
**Impact on plan:** nenhuma muda comportamento previsto; o teto de passos é só defesa. Sem expansão de escopo.

## Issues Encountered

None. A suíte ficou verde a cada commit de feature (203, 221 e 226 testes); os commits de teste (RED) falham de propósito, como o plano manda.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum. A única superfície nova (leitura do `preferences.json` pelo main) já está no `<threat_model>` (T-03-02) e é coberta por `normalizePreferences`.

## Verificação que fica para olhar a ilha (checklist do PR, o executor não rodou)

- Com `~/.claude/island/preferences.json` em cada `animationStyle` (smooth, default, bouncy, snappy) e `animationSpeed` 0,5, 1 e 2: a pílula cresce (hover, pedido de permissão) com leve passagem no Padrão, encolhe sem balanço em todo estilo e um alvo novo no meio não dá salto.
- Nenhum quadro de animação no Gerenciador de Tarefas com a ilha em repouso; com "reduzir movimento" do Windows ligado a pílula muda de tamanho sem mola.
- Risco herdado do plano: `justify-content: center` com o conteúdo mais largo que a pílula; se o excesso pender para um lado, a correção é `unsafe center`.
- Desvio deliberado do mod: Elástico encolhe criticamente amortecido (ANIM-01).

## Next Phase Readiness

Os planos 03-02 (palco de 520x410, formas, nudge e hover) e 03-03 (temas e material) usam o mesmo `index.html` e `gate.test.js`; `applyPreferences` já grava `data-theme` e `data-shape`, e os seletores que os leem entram neles. `loadInlineBlock` serve para extrair os blocos puros novos (`shouldNudge`, `hoverScaleTarget`).

## Self-Check: PASSED
