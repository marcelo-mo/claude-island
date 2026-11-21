---
phase: 03-palco-fixo-anima-o-e-visual
plan: 03
subsystem: ui
tags: [electron, css, themes, contrast, wcag, material, typography, node-test]

requires:
  - phase: 03-palco-fixo-anima-o-e-visual
    provides: "applyPreferences gravando data-theme e data-shape, visual.test.js com leitura do <style>, --stage-top e --radius"
provides:
  - "8 temas (obsidian, graphite, slate, nord, evergreen, espresso, plum, porcelain) por :root[data-theme] e o auto restrito ao @media claro"
  - "tokens opacos do bloco de permissão (--perm-bg, --perm-text, --perm-label, --perm-hint, --perm-deny-border)"
  - "material estático da pílula: lavagem do acento de 56 px, profundidade, contorno de 35% e sombra"
  - "resolvedor de cor (hex, oklch, color-mix, var) e contraste WCAG no visual.test.js, provando os 10 casos"
affects: [fase-4-menu-preferencias, verificacao-da-fase-3]

actuals:
  tokens: 7900
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "contraste provado por teste que resolve os tokens do próprio index.html (JS puro, sem dependência)"
    - "token derivado do acento declarado na #pill, nunca no :root (o :root resolveria sempre o laranja)"

key-files:
  created:
    - .planning/phases/03-palco-fixo-anima-o-e-visual/03-03-SUMMARY.md
  modified:
    - index.html
    - visual.test.js
    - THIRD_PARTY_NOTICES.md

key-decisions:
  - "Cores de estado são pares fixos escuro/claro e botões têm um valor só nos 10 casos (Key Decision de 2026-11-21); os temas trocam só --surface, --text, --muted e --border"
  - "--perm-label usa o âmbar (--waiting) nos escuros e --text nos claros, porque o bloco só existe em Precisa de você e um token do :root não enxerga o acento da #pill"
  - "--depth claro ficou em .033 (x0,55 do mod): nenhum controle caiu abaixo de 3:1 no rodapé, então o remédio de reduzir a profundidade não foi usado"
  - "Sem variante ociosa da lavagem: a pílula ociosa tem opacidade 0, então um segundo valor não teria efeito visível"

patterns-established:
  - "regra :root[data-theme] só com os quatro tokens do tema; Porcelain repete as cores de estado claras do @media porque o CSS não junta os seletores"

requirements-completed: [VIS-01, VIS-03, VIS-04, VIS-05]

coverage:
  - id: D1
    description: "Os 8 temas e o auto aplicados por valor de preferência, só fundo, superfície, texto, secundário e borda mudando"
    requirement: "VIS-01"
    verification:
      - kind: unit
        ref: "visual.test.js#cada tema de THEMES tem a sua regra e #as cores de estado são o par escuro ou claro da Key Decision"
        status: pass
    human_judgment: false
  - id: D2
    description: "Bloco de permissão opaco, texto >= 4,5:1 e controles >= 3:1 nos 10 casos, inclusive no rodapé escurecido e sob a lavagem"
    requirement: "VIS-04"
    verification:
      - kind: unit
        ref: "visual.test.js#contraste do bloco de permissão, #--perm-bg é uma cor opaca e #contraste com a profundidade"
        status: pass
    human_judgment: false
  - id: D3
    description: "Superfície com profundidade, lavagem do acento de 56 px, contorno de 35% e sombra estática, sem pseudo-elemento novo"
    requirement: "VIS-03"
    verification:
      - kind: unit
        ref: "visual.test.js#o fundo da pílula tem lavagem..., #contorno de 35%... e #nenhum pseudo-elemento além do brilho"
        status: pass
    human_judgment: false
  - id: D4
    description: "Pesos só 400 e 600, contador em 12 px, fontes do sistema e nenhuma fonte embarcada"
    requirement: "VIS-05"
    verification:
      - kind: unit
        ref: "visual.test.js#pesos só 400 e 600..."
        status: pass
    human_judgment: false
  - id: D5
    description: "Aparência real dos 8 temas e do auto (Windows claro e escuro): pílula compacta, expandida e com pedido, reflexo sem chegar ao comando"
    verification: []
    human_judgment: true
    rationale: "Só se avalia olhando a ilha; o executor não sobe o Electron. Vai no checklist do PR."

duration: 25min
completed: 2026-11-21
story_points_realized: 5
status: complete
plan_head_before: 1bca4bbd80300f538334fe8d567a6cd8d0e89208
plan_head_after: 9da4d63aa1363ff967f31b88d0c1f89bd3a38c29
commits: 4
---

# Phase 3 Plan 03: Temas, material e tipografia Summary

**Os 8 temas do mod e o automático por `data-theme`, bloco de permissão opaco com contraste provado por teste nos 10 casos, e a pílula com lavagem do acento de 56 px, profundidade, contorno de 35% e sombra estática, tudo sem mexer nas cores de estado.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-11-21
- **Tasks:** 2 (ambas TDD: RED e GREEN em commits separados)
- **Files modified:** 3 (`index.html`, `visual.test.js`, `THIRD_PARTY_NOTICES.md`)
- **Suíte:** 245 testes na base, 261 ao final, 0 falhas

## Accomplishments

- **Temas:** um bloco `:root[data-theme="<tema>"]` por tema (valores do mod, com origem MIT e crédito à paleta Nord no Nord). O `@media (prefers-color-scheme: light)` agora tem o seletor `:root:not([data-theme]), :root[data-theme="auto"]`, então um tema escuro num sistema claro mantém as cores de estado escuras. O Porcelain repete as cores de estado claras do `@media`.
- **Bloco de permissão:** `--perm-bg` opaco (escuros: preto a 55% sobre a superfície; claros: 4% do texto sobre a superfície), `--perm-text`, `--perm-label`, `--perm-hint` e `--perm-deny-border` (60% do texto sobre a superfície, sobe dos 35% que reprovavam nos claros). O rearme na troca de tema já vinha do `applyPreferences` do 03-01; só ganhou trava duplicada em `visual.test.js`.
- **Material:** `background` em três camadas na `#pill` (lavagem radial `ellipse 75% 56px at 50% 0` a 7,5% do acento, profundidade `--depth`, preenchimento `--surface`), `--contour` (35% do acento sobre a borda do tema, declarado na `#pill`) e `box-shadow: 0 0 0 1px var(--contour), var(--shadow)`. O anel `--ring` saiu, o `background` saiu da transição, nenhum pseudo-elemento novo e o `glow` da Fase 1 segue a única animação.
- **Tipografia:** pesos só 400 e 600 (`#context-number` 400, `#count` 12 px e 600, `#permission-tool` 600); famílias do sistema inalteradas.
- **Resolvedor de cor no teste:** `themeVariables`, `resolveColor` (hex, `oklch`, `color-mix in srgb`, `var`; `transparent`, `rgb(...)` e o resto lançam com o formato no texto) e `contrastRatio` (WCAG 2.x). As âncoras `oklch` conferem com `#f54900`, `#ff6900` e `#fff7ed`.

## Contraste medido (mínimo entre os 10 casos)

| Par | Mínimo | Limite | Pior caso |
|-----|--------|--------|-----------|
| `--perm-text` sobre `--perm-bg` | 15,47 | 4,5 | porcelain |
| `--perm-hint` sobre `--perm-bg` | 4,69 | 4,5 | auto claro |
| `--perm-label` sobre `--perm-bg` | 8,70 | 4,5 | nord |
| `--muted` sobre `--surface` | 5,07 | 4,5 | auto claro |
| `--button` sobre `--surface` (controle) | 3,32 | 3 | porcelain |
| `--perm-deny-border` sobre `--surface` (controle) | 4,45 | 3 | auto claro |
| `--button-text` sobre `--button` (controle) | 3,38 | 3 | todos iguais (obsidian listado) |
| `--muted` sobre o rodapé escurecido | 4,72 | 4,5 | auto claro |
| `--button` sobre o rodapé escurecido (controle) | 3,09 | 3 | porcelain |
| `--perm-deny-border` sobre o rodapé escurecido (controle) | 4,14 | 3 | auto claro |
| `--text` sobre a superfície com a lavagem de trabalhando | 9,95 | 4,5 | nord |
| `--text` sobre a superfície com a lavagem de precisa de você | 9,52 | 4,5 | nord |
| `--text` sobre a superfície com a lavagem de concluído | 9,47 | 4,5 | nord |

O controle mais apertado é o `--button` do Porcelain sobre o rodapé (3,09:1, margem de 0,09). Se uma mudança futura de `--depth` ou de superfície o derrubar, o teste acusa.

## Task Commits

1. **Task 1: temas e bloco de permissão**
   - `515c529` test: prova o contraste do bloco de permissão nos temas
   - `a9d5651` feat: aplica os 8 temas e o automático com o bloco de permissão opaco
2. **Task 2: material e tipografia**
   - `4a05f11` test: trava o material e a tipografia da pílula
   - `9da4d63` feat: dá à pílula profundidade, sombra e o reflexo da cor do estado

## Deviations from Plan

Nenhuma alteração de comportamento além do previsto. Notas:

**1. [Processo] `--perm-label` e a UI-SPEC**
- A UI-SPEC pede o acento no rótulo da ferramenta dos temas escuros; o plano já escolhia `var(--waiting)` (o bloco só existe em Precisa de você) e o executor seguiu o plano. É o mesmo valor em todo estado em que o bloco existe. Se um dia o bloco aparecer em outro estado, o token precisa ir para uma regra da `#pill`.

**2. [Processo] Edição de arquivo CRLF**
- O `index.html` está em CRLF; as trocas foram feitas por script que normaliza para LF, troca e volta para CRLF (`git ls-files --eol` mostra `w/crlf`). Nenhum `sed -i` em arquivo de trabalho.

**3. [Processo] Ledger de commits**
- O ledger `gsd-plan-head-before-03-03` foi gravado direto no diretório git do worktree (o guarda recusa comando composto com git). `plan_head_before` e `commits` saem dele: `git rev-list --count` = 4.

---

**Total deviations:** 3 (todas de processo)
**Impact on plan:** nenhum. O remédio de reduzir `--depth` não foi necessário e não houve checkpoint.

## Issues Encountered

Nenhum. Os commits de teste (RED) falham de propósito (6 e 5 falhas); os de feature deixaram a suíte inteira verde (255 e 261 testes).

## Known Stubs

Nenhum.

## Threat Flags

Nenhum. T-03-11 e T-03-12 mitigados pelos testes de contraste, opacidade e lavagem de 56 px; T-03-13 pelo `applyPreferences` do 03-01 (travado de novo em `visual.test.js`); T-03-14 pelo seletor do `@media` restrito ao auto e pela trava de que nenhuma regra `:root` usa `var(--accent)`.

## Itens de backstop (checklist do PR, o executor não rodou)

- Com `~/.claude/island/preferences.json` em cada um dos 8 temas e no `auto` com o Windows claro e escuro: pílula compacta, expandida e com pedido mostrando superfície do tema, profundidade, sombra e reflexo do topo laranja (trabalhando), âmbar (precisa de você) e verde (concluído); bloco de permissão legível e o reflexo sem chegar ao comando; contorno legível sobre fundo claro e escuro.
- Trocar o tema com um pedido na tela: os botões rearmam (não aceitam clique até assentar de novo).
- Registrado, não corrigido (cores travadas pela Key Decision): o botão verde "Abrir" (Concluído) mede 2,84:1 contra a superfície do Nord e o rótulo branco 4,40:1 sobre o verde; o `--button-text` sobre `--button` mede 3,38:1 (controle, não texto de 13 px); o `--button` do Porcelain sobre o rodapé mede 3,09:1.
- Nota para a descrição do PR: Key Decision das cores esclarecida na Fase 3: temas trocam fundo, superfície, texto, secundário e borda; cores de estado fixas (cada uma um par escuro/claro, inclusive botão e brilho tingido).

## Self-Check: PASSED

Arquivos conferidos (`index.html`, `visual.test.js`, `THIRD_PARTY_NOTICES.md`) e os quatro commits (`515c529`, `a9d5651`, `4a05f11`, `9da4d63`) presentes no histórico da branch `feat/fase-3-visual`; `node --test` com 261 testes, 0 falhas; script inline compila em `node:vm`.
