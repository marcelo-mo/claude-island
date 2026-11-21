---
phase: "3"
slug: "palco-fixo-animacao-e-visual"
status: approved
reviewed_at: 2026-11-21
shadcn_initialized: false
preset: none
created: "2026-11-21"
---

# Phase 3 — UI Design Contract

> Contrato visual e de interação da Fase 3 (palco fixo, animação e visual). Gerado por gsd-ui-researcher, verificado por gsd-ui-checker. Modo `--auto`: nenhuma pergunta ao autor; tudo vem de `03-CONTEXT.md` (D-01..D-25), `PROJECT.md` (Key Decisions) e `research/WINDHAWK-MOD.md`. Onde algo estava aberto, escolhi o recomendado e marquei **(Claude's discretion)**.

Escopo: só o renderer (`index.html`), as preferências lidas pelo `main.js` e o tamanho da janela. O menu que escolhe tema, forma e estilo é da Fase 4; aqui cada um é só um **valor de preferência** aplicado.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (Electron, HTML/CSS/JS puros em `index.html`; sem React, sem shadcn, sem biblioteca de componentes) |
| Preset | not applicable |
| Component library | none |
| Icon library | none (dois SVG inline: check e exclamação, já existentes) |
| Font | fontes do sistema, nada embarcado (VIS-05): corpo `system-ui, -apple-system, "Segoe UI", sans-serif`; comando `ui-monospace, "Cascadia Mono", Consolas, monospace` |

Fonte única dos tokens: o `<style>` do `index.html` (D-19). Temas e formas entram por atributos no `<html>` (`data-theme`, `data-shape`), nunca por classe nem por estilo inline.

---

## Spacing Scale

Escala declarada para tudo que esta fase cria (múltiplos de 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | respiro mínimo, `gap` entre reticências |
| sm | 8px | topo do palco (`--stage-top`), margem entre blocos da pílula |
| md | 16px | `padding-bottom` com pedido de permissão, raio da forma notch |
| lg | 24px | reserva no cálculo do palco (não é layout visível) |
| xl | 32px | reserva no cálculo do palco |
| 2xl | 48px | não usado nesta fase |
| 3xl | 64px | não usado nesta fase |

Exceções (todas **herdadas** do código atual, que a fase não reabre, ou valores de movimento/sombra que não são espaçamento de layout):

- Medidas de layout existentes: altura da barra 46px, `padding-inline` 17px, `gap` 11px e 38px, botões `padding` 8px 20px, `#count` `padding` 2px 9px. O alvo de tamanho é medido do DOM (D-06), então estes números não viram larguras fixas.
- Movimento: nudge de −6px e escala de hover 1,025 (valores do mod, §1).
- Sombra: espalhamento 14px, deslocamento y 5px, anel de 1px.
- Palco: 520×410 (ver Stage Contract), não é espaçamento de componente.
- Margem da sombra reservada dentro do palco: 20px nas laterais e embaixo.

---

## Typography

Três famílias de papel, quatro tamanhos e dois pesos. A fase **não** acrescenta texto novo; esta tabela fixa o que já existe e normaliza os resíduos (12,5px, pesos 500 e 700), sem teste que trave isso (verificado nos `*.test.js`). **(Claude's discretion)**

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body (título da barra "Trabalhando/Precisa de você/Concluído", número do contexto) | 15px | 600 (título) / 400 (número) | 1.3 |
| Label (botões Permitir/Negar/Abrir sessão/Abrir) | 13px | 600 | 1.3 |
| Detail (linha de detalhe, comando em monoespaçada, contador `#count`) | 12px | 400 (detalhe, comando) / 600 (contador) | 1.3 (detalhe, contador) / 1.45 (comando) |
| Caption (rótulo da ferramenta, dica "Role até o fim…") | 11px | 600 (rótulo) / 400 (dica) | 1.3 |

- Pesos permitidos: **400 e 600**. Remover 500 e 700 (`#context-number` vira 400 com `opacity: .8` já existente; `#permission-tool` e `#count` viram 600; `#count` passa de 12,5px para 12px).
- Nenhum tamanho depende de fonte específica; larguras vêm do conteúdo medido (VIS-05).
- `font-variant-numeric: tabular-nums` no número do contexto continua.

---

## Color

Regra 60/30/10 aplicada a cada tema (os valores por tema estão na tabela de temas abaixo):

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--surface` do tema (tabela de temas) | preenchimento da pílula |
| Secondary (30%) | `--perm-bg`, `--text`, `--muted`, `--border` do tema | bloco de permissão, texto, contorno, trilha do anel de contexto |
| Accent (10%) | cor do **estado**, fixa: laranja `oklch(0.705 0.213 47.604)` escuro / `oklch(0.646 0.222 41.116)` claro; âmbar `#ff9f0a` / `#f08c00`; verde `#30d158` / `#248a3d` | ver lista abaixo |
| Destructive | nenhum nesta fase (Negar é secundário neutro; `--context-critical` `#ff453a` / `#d70015` é semântica de contexto, não ação destrutiva) | n/a |

Accent reserved for: ponto de estado `#dot`, brilho pulsante `#pill::before` (Fase 1, inalterado), lavagem de acento no topo da barra (7,5%), tom de 35% no contorno, reticências `#dots i`, rótulo da ferramenta `#permission-tool` **somente nos temas escuros**. Nunca: texto do comando, título, bloco de permissão. Os fundos de botão (`--button` laranja e `--done-button` verde do "Abrir") são tokens próprios, fixos pela Key Decision das cores: o `--button` tem o mesmo valor do laranja claro, mas não é o acento e não muda com o estado.

Cores fixas que nenhum tema muda (Key Decision de 2026-11-21):

| Token | Escuro | Claro |
|-------|--------|-------|
| `--running` | `oklch(0.705 0.213 47.604)` | `oklch(0.646 0.222 41.116)` |
| `--waiting` | `#ff9f0a` | `#f08c00` |
| `--done` | `#30d158` | `#248a3d` |
| `--button` / `--button-text` | `oklch(0.646 0.222 41.116)` / `oklch(0.98 0.016 73.684)` (os dois esquemas) | igual |
| `--done-button` | `#248a3d` | `#248a3d` |
| `--context-warn` / `--context-critical` | `#ffd60a` / `#ff453a` | `#c79200` / `#d70015` |
| `--icon-ink` | `#000` | `#fff` |

Os 7 temas escuros usam a coluna "Escuro"; Porcelain usa a "Claro"; `auto` escolhe por `prefers-color-scheme` como hoje.

### Tabela de temas (D-18, D-21, valores do mod §2)

Cada tema troca **só** `--surface`, `--text`, `--muted`, `--border` (mais o derivado `--perm-bg`). Valor de preferência em minúsculas (identificador em inglês).

| `data-theme` | `--surface` | `--text` | `--muted` | `--border` | Esquema de estado |
|--------------|-------------|----------|-----------|------------|-------------------|
| `obsidian` | `#08080A` | `#FFFFFF` | `#9B9BA5` | `#1E1E22` | escuro |
| `graphite` | `#1C1C1E` | `#FFFFFF` | `#A8A8AE` | `#323236` | escuro |
| `slate` | `#111721` | `#E9EEF6` | `#92A2B8` | `#232C3A` | escuro |
| `nord` | `#2E3440` | `#ECEFF4` | `#A7B0C0` | `#3B4252` | escuro (paleta Nord, crédito Sven Greb em `THIRD_PARTY_NOTICES.md`) |
| `evergreen` | `#0C1512` | `#E4F1EA` | `#8CAE9D` | `#1A2A23` | escuro |
| `espresso` | `#1A1512` | `#F6EEE7` | `#B7A395` | `#2E2420` | escuro |
| `plum` | `#16111C` | `#F1EAF6` | `#AC9BB9` | `#281F33` | escuro |
| `porcelain` | `#F5F6F8` | `#14161A` | `#5B6270` | `#D8DBE1` | claro |
| `auto` (escuro do sistema) | `#000` | `#fff` | `#a1a1a6` | `rgb(255 255 255 / .12)` **(Claude's discretion)** | escuro |
| `auto` (claro do sistema) | `#fff` | `#1d1d1f` | `#6e6e73` | `rgb(0 0 0 / .10)` (o anel de hoje) | claro |

Padrão: `auto`. Valor inválido ou ausente volta a `auto` (D-15). Cada bloco de tema leva o comentário curto de origem MIT apontando para `THIRD_PARTY_NOTICES.md`.

### Bloco de permissão (D-20, D-24)

Token novo `--perm-bg`, **opaco** (nunca translúcido, nunca recebe a lavagem):

- esquema escuro: `color-mix(in srgb, #000 55%, var(--surface))` (cava o bloco, e é o que garante rótulo de estado legível em todos os escuros);
- esquema claro: `color-mix(in srgb, var(--text) 4%, var(--surface))`.

Tokens próprios do bloco: `--perm-bg`, `--perm-text` (= `--text`), `--perm-label` (escuro: `var(--accent)`; claro: `var(--text)`), `--perm-hint` (= `--muted`), `--perm-deny-border` (= `color-mix(in srgb, var(--text) 60%, var(--surface))`, sobe dos 35% de hoje, que reprovava nos claros).

Contraste medido por mim (WCAG 2.x, sRGB; o teste do plano tem de recalcular dos tokens do arquivo, não confiar nestes números):

| Par | Mínimo entre os 9 temas | Limite | Pior tema |
|-----|--------------------------|--------|-----------|
| Texto do comando sobre `--perm-bg` | 15,51 | 4,5 | Nord |
| `--muted` (dica) sobre `--perm-bg` | 4,69 | 4,5 | auto claro |
| Rótulo da ferramenta (escuros, `--accent` = âmbar; laranja também medido) | 6,18 | 4,5 | Nord (laranja) |
| Rótulo da ferramenta (claros, `--text`) | 14,85 | 4,5 | Porcelain |
| Botão `--button` sobre `--surface` (controle) | 3,32 | 3,0 | Porcelain |
| Contorno de Negar sobre `--surface` (controle) | 4,45 | 3,0 | auto claro |
| `--muted` ("Abrir sessão" com pedido) sobre `--surface` | 5,07 | 4,5 | auto claro |
| Texto da barra sobre `--surface` + lavagem de 7,5% | 9,52 | 4,5 | Nord |

**Sinal de alerta para o checker e o planejador (não é regressão):** o par `--button-text` sobre `--button` mede **3,38:1** em todos os temas, porque as duas cores são travadas pela Key Decision e valem desde a Fase 1. Cumpre ≥3:1 de controle, **não** cumpre 4,5:1 de texto de 13px/600. Não mude as cores; o teste de contraste registra este par como "controle (≥3:1)" e a decisão de aceitar fica documentada aqui. O rótulo de estado que reprovaria (âmbar/laranja/verde nos claros, 2,0 a 4,1) usa `--text`, como manda D-20; a cor de estado em si não muda.

---

## Interaction & Motion Contract

### O que anima, e com quê

| Propriedade | Mecanismo | Observação |
|-------------|-----------|------------|
| Largura e altura da `#pill` | mola em JS (D-01..D-06), `style.width/height` por quadro | saem as transições CSS de `width`, `height`, `transform` e a curva `--spring` de tamanho |
| Nudge (deslocamento y) e escala de hover | molas em JS, compostas em um único `style.transform = translateY(<n>px) scale(<s>)` | `transform-origin: 50% 0` (o topo não anda ao ampliar) |
| Entrada/saída do estado `idle` | CSS, **propriedades individuais** `scale` e `translate` (`scale: .6; translate: 0 -12px; opacity: 0`), `transition: opacity .25s, scale .25s ease, translate .25s ease` | separa do `transform` das molas: os dois não brigam. `pointer-events: none` no idle continua |
| Raio, cores, contorno, sombra | CSS | raio = alvo calculado pela forma, `transition: border-radius .3s ease` |
| Brilho, respiração, reticências, anel de contexto | CSS (Fase 1), **inalterado** | `::before` segue a única camada com `animation: glow` |

Nada do material (profundidade, lavagem, contorno, sombra) anima continuamente.

### Molas (D-01, D-02, D-04, D-25)

Código próprio no bloco `// mola:inicio … // mola:fim` do `index.html`, puro (sem DOM, sem relógio global), testado por extração em `node:vm`. Massa 1, integração semi-implícita, passo fixo 0,5 ms, `dt` do quadro limitado a 50 ms, velocidade multiplica o `dt`. **A CSP não muda.**

| Direção (por eixo, comparando alvo novo com posição atual) | k | c | ζ aprox. |
|-----------------------------------------------------------|---|---|----------|
| Crescer | 380 | 26 | 0,67 (~6% de passagem) |
| Encolher | 200 | 28 | 1,0 (sem balanço) |
| Neutro (nudge, hover) | 280 | 24 | 0,72 |

| Estilo (`animationStyle`) | k | c | ζ ao crescer |
|---------------------------|---|---|--------------|
| `smooth` (Suave) | ×1 | ×1,35 | ~0,9 |
| `default` (Padrão) | ×1 | ×1 | ~0,67 |
| `bouncy` (Elástico) | ×1,1 | ×0,7 | ~0,45 (~21% de passagem) |
| `snappy` (Rápido) | ×1,5 | ×1,25 | ~0,68, mais rápido |

Nomes de chave em inglês **(Claude's discretion)**; os rótulos em pt-BR (Suave, Padrão, Elástico, Rápido) entram com o menu da Fase 4. `animationSpeed`: número, limitado a [0,5; 2]; fora disso ou não numérico volta a 1. A velocidade só estica o tempo: o pico de passagem não muda, então o palco não depende dela.

- **Retarget sem salto:** alvo novo no meio da animação mantém posição e velocidade; só k e c mudam conforme a direção nova.
- **Repouso (Claude's discretion):** tamanho assenta com |posição − alvo| < 0,05 px e |velocidade| < 0,5 px/s; escala assenta com |posição − alvo| < 0,0005 e |velocidade| < 0,05/s. Ao assentar a mola vai exatamente ao alvo.
- **Piso:** a altura exibida nunca fica abaixo de 36 px, só na aplicação ao DOM, sem mexer no estado da mola (o Elástico, ao encolher, afunda ~6% do deslocamento abaixo do alvo). **(Claude's discretion)**
- **Laço (D-04):** `requestAnimationFrame` só roda enquanto alguma mola não assentou e para sozinho; ilha ociosa ou escondida não gasta quadro. O laço do armamento da Fase 2 continua separado.
- **Janela escondida:** ao virar `document.hidden`, todas as molas pulam para o alvo (o rAF congela e uma mola parada no meio travaria o armamento). **(Claude's discretion)**
- **Movimento reduzido (D-25, ANIM-05):** com `prefers-reduced-motion: reduce` as molas pulam direto para o alvo (sem rAF), sem nudge e sem escala de hover; a regra CSS atual que zera as animações continua. A preferência é lida por `matchMedia` e escutada por `change`.

### Nudge (D-07, ANIM-03)

Quando o **estado** da sessão exibida muda (`running`/`waiting`/`done`), a posição do deslocamento vai a −6 px e a mola neutra a devolve a 0. No máximo uma vez a cada 0,45 s. Não dispara na primeira exibição (vindo de `idle`), nem com a ilha ociosa, nem com pedido de permissão na tela.

### Hover (D-08, D-09)

Escala-alvo 1,025 com `hovering` verdadeiro (detecção atual do renderer; a por posição de tela é da Fase 4), mola neutra. Com pedido de permissão na tela: **sem nudge e sem escala** (alvo 1 e deslocamento 0); quando o pedido sai, os efeitos voltam. Os botões nunca escalam nem se deslocam por conta própria, em nenhuma circunstância.

### Gate de armamento com as molas (D-10, D-11, SEG-02/03)

- Armar exige, **além** do retângulo dos botões parado por `SETTLE_STABLE_MS` (100 ms, mantido) e das opacidades '1', que **todas as molas estejam em repouso**. Vira campo novo (`springsAtRest`, booleano estrito) em `settleStep` ou predicado puro novo, com vetores novos em `fixtures/permission-vectors.json`; os existentes não mudam.
- Aplicar preferência (tema, forma) chama `restartArming()` explicitamente; o `ResizeObserver` e `buttonsRect()` já pegam o resto.
- Nenhuma mudança de interação desta fase (hover, nudge, escala, forma, tema) pode armar um botão que o usuário não viu parado (restrição de segurança do projeto).

### Entrada do mouse

Fora da pílula o clique atravessa como hoje (`isOverPill` → `setIgnoreMouseEvents`); o retângulo de hit-test é o da pílula viva. Com a escala de hover, o retângulo medido é o escalado. Arrastar: a pílula não encolhe nem devolve o clique no meio do gesto (comportamento atual preservado).

---

## Shape Contract (D-22, VIS-02)

`data-shape` no `<html>`; padrão `pill`; inválido volta a `pill`.

| `data-shape` | Raio | Topo |
|--------------|------|------|
| `pill` | `min(alturaAlvo / 2, 44px)` (cálculo em JS a partir do alvo, via `--radius`; transição de 0,3 s) | respiro `--stage-top: 8px` |
| `win11` | 8px | respiro 8px; contorno de 1px |
| `notch` | 0 em cima, 16px embaixo (`0 0 16px 16px`) | `--stage-top: 0`: a pílula encosta no topo do palco |

- Trocar a forma muda o topo em 8 px no notch: o armamento rearma (D-11). Conteúdo nunca encosta no arco do canto: `padding-inline` ≥ 17px e `padding-bottom` 16px com pedido mantêm os botões e o ponto dentro do raio máximo de 44px (conferido por geometria).
- O raio de 44px na expandida (hoje 30px) é intencional (regra do mod).

---

## Material Contract (D-23, D-24, VIS-03)

Camadas estáticas, de baixo para cima, todas em CSS no `background`/`box-shadow` da `#pill` (sem pseudo-elemento novo; `::before` continua só com o brilho da Fase 1 e `animation.test.js` segue valendo):

1. **Preenchimento:** `var(--surface)` a 100% (transparência configurável é da Fase 4).
2. **Profundidade:** `linear-gradient(to bottom, rgb(0 0 0 / 0), rgb(0 0 0 / calc(.25 * var(--depth))) 45%, rgb(0 0 0 / var(--depth)))`; `--depth: .06` no esquema escuro e `.033` no claro (×0,55 do mod).
3. **Lavagem de acento (reflexo do topo):** `radial-gradient(ellipse 75% 56px at 50% 0, color-mix(in srgb, var(--accent) 7.5%, transparent), transparent)`. O raio vertical é **56px fixos**, nunca proporcional à altura: a lavagem termina antes de `#detail` e do bloco de permissão, que além disso tem `--perm-bg` opaco, então o reflexo nunca pinta o comando (VIS-04). A cor segue `--accent` do estado (laranja, âmbar, verde). A troca de estado é instantânea no reflexo (gradiente não interpola); o brilho e o ponto continuam suaves.
4. **Contorno:** `0 0 0 1px var(--contour)`, com `--contour: color-mix(in srgb, var(--accent) 35%, var(--border))`. Substitui o anel `--ring` atual de 40% **(Claude's discretion)**; o brilho `::before` da Fase 1 fica igual.
5. **Sombra estática:** escuro `0 5px 14px rgb(0 0 0 / .30), 0 1px 3px rgb(0 0 0 / .20)`; claro `0 5px 14px rgb(0 0 0 / .16), 0 1px 3px rgb(0 0 0 / .12)`. Cabe na margem de 20px do palco.

Ordem do `box-shadow`: contorno, depois a sombra. O material é um só para os 9 temas; só os tokens mudam.

---

## Stage Contract (D-13, D-14, ANIM-04)

- `WINDOW_SIZE` em `main.js` passa de 440×324 para **520×410**, uma vez, e nunca muda durante a animação. É o ponto de partida; **o teste do plano manda**: simula a mola Elástico (a 1× e a 2×, que dão o mesmo pico) de tamanho compacto mínimo até o maior alvo e também com retarget no pico de velocidade, e exige `largura do palco ≥ pico + 2×20` e `altura do palco ≥ --stage-top + pico + 20`. Se o teste pedir mais, `WINDOW_SIZE` sobe.
- Estimativa de pior caso (conta da pesquisa): maior pílula ≈ 400×300 (expandida com pedido no limite de rolagem de 105 px); Elástico ≈ +21% do deslocamento ≈ pico 452×353; com 8 px de topo e 20 px de sombra ≈ 492×381; sobra o restante como folga.
- Posição (D-14): trocar de 440×324 para 520×410 não pode mover a pílula de quem tem posição salva. A conversão preserva o **centro horizontal e o topo da pílula** (`x -= (520 − 440) / 2`, `y` igual; no notch o topo da pílula sobe 8 px junto do `--stage-top`). Vale para o padrão (`defaultIslandPosition`), para as posições salvas e para `clampIslandPosition`.
- `body` continua `display: flex; justify-content: center; align-items: flex-start`, com `padding-top: var(--stage-top)`.
- Fora da pílula a janela é transparente e deixa o clique atravessar (a margem maior não pode capturar cliques).

---

## Copywriting Contract

A fase não cria texto novo para o usuário. Os rótulos atuais ficam, em pt-BR, sem mudança; nomes de tema, forma e estilo são valores de preferência (menu da Fase 4).

| Element | Copy |
|---------|------|
| Primary CTA | `Permitir` (preenchido; é o único botão de destaque com pedido na tela) |
| Secondary actions | `Negar` (contorno neutro); `Abrir sessão` (texto `--muted`, só com pedido) / `Abrir` (compacto, verde, em Concluído) |
| Empty state heading | não se aplica: sem sessão a pílula fica escondida (`idle`), sem texto |
| Empty state body | não se aplica (nada a fazer; a ilha reaparece na próxima sessão) |
| Error state | não se aplica a esta fase; o erro de preferência é silencioso: valor inválido volta ao padrão sem mensagem (D-15) |
| Destructive confirmation | nenhuma ação destrutiva. `Negar` não pede confirmação: é o lado seguro e adicionar passo o deixaria mais lento que aprovar |
| Títulos de estado (inalterados) | `Trabalhando`, `Precisa de você`, `Concluído` |
| Dica do pedido (inalterada) | `Role até o fim para poder permitir` |

---

## UI Considerations

Applicable state considerations resolved: 8 covered, 2 backstop, 1 unresolved

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| long-text | `#permission-text` (pedido no limite de 105 px com rolagem) | ✅ covered | É o pior caso do palco: o teste simula a mola até o maior alvo e confere que `WINDOW_SIZE` cobre o pico |
| rapid-change | alvo novo no meio da animação | ✅ covered | Retarget mantém posição e velocidade; nudge limitado a 1× por 0,45 s |
| zero-one-many | sessões 0 / 1 / várias | ✅ covered | Idle sem rAF, sem nudge na primeira exibição; várias sessões usam o mesmo palco e o mesmo alvo medido |
| permission-on-screen | botões e hover | ✅ covered | Sem nudge nem escala de hover com pedido; botões só armam com todas as molas em repouso |
| reduced-motion | molas, nudge, hover | ✅ covered | Pulam direto ao alvo, sem rAF (D-25) |
| hidden-window | molas em movimento | ✅ covered | `document.hidden` leva as molas ao alvo; sem quadro rodando |
| invalid-preference | `theme`, `shape`, `animationStyle`, `animationSpeed` | ✅ covered | Função pura em `state.js` normaliza e nunca lança; padrão `auto`/`pill`/`default`/`1` |
| contrast | bloco de permissão nos 9 temas | ✅ covered | Teste puro lê os tokens do `index.html` e exige texto ≥4,5:1 e controles ≥3:1 (par `--button-text`/`--button` registrado como controle, 3,38:1) |
| feel | sensação da mola, 4 estilos, reflexo, 3 formas, 9 temas | 🧪 backstop | Só se vê olhando a ilha: checklist visual no PR (teste manual dispensado pelo autor) |
| dpi-scale | arredondamento da pílula com escala fracionária | 🧪 backstop | Conferir no PR em 125%/150% que não há linha de 1 px na borda do palco |
| loading | bloco de permissão, botão "Abrir" | ✅ covered | Não há carregamento: o pedido chega inteiro pelo estado; até armar, Permitir e Negar ficam desabilitados (opacidade 0,45), sem spinner |
| error | decisão recusada pelo main, foco do terminal que falha | ✅ covered | Sem mensagem na pílula: decisão recusada destrava os botões no próximo estado e rearma (WR-01 da Fase 2); falha de foco vai para o `console.error` como hoje |
| overflow | `#permission-text` | ✅ covered | Rola dentro dos 105 px; a roda só rola o texto (`overscroll-behavior: contain`); "Role até o fim" exige chegar ao fim |
| long-text | rótulos dos botões | ✅ covered | Rótulos fixos e curtos (Permitir, Negar, Abrir, Abrir sessão); o título da sessão não quebra linha e a pílula cresce até a largura expandida |
| multi-monitor | cada ilha com suas molas e DPI diferentes | ⚠ unresolved — planner must treat as assumption | Cada monitor tem a sua instância de renderer e de mola; o palco único de 520×410 vale em DPIs diferentes, sem validação em hardware. O planejador trata como suposição |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | nenhum (projeto sem shadcn) | not required |
| third-party | nenhum | not applicable |

Sem dependência nova, sem fonte embarcada. Código portado do mod (molas e temas) leva o comentário curto de origem MIT apontando para `THIRD_PARTY_NOTICES.md`.

---

## Regression Locks (o design não pode quebrar)

- `animation.test.js`: keyframes só com `opacity`/`transform`; `#pill` base sem `animation`; `animation: glow` só em `#pill:not([data-state="idle"])::before`; `html[data-hidden="true"]` pausa; `@media (prefers-reduced-motion: reduce)` continua listando `#pill::before`.
- `gate.test.js`: CSP **inalterada** (`default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'`), `buttonsRect`, `restartArming`, bloco `regras-do-gate`, e os trechos de texto do renderer que cada trava nomeia. Um trecho só muda se o texto que ele protege mudar de propósito, com o diff da trava no mesmo commit (D-12).
- Os 194 testes atuais passam sem afrouxar nenhuma trava.
- `interpolate-size: allow-keywords` e a curva `--spring` em CSS deixam de ser usadas para tamanho; remover ou manter só o que ainda tem uso.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: FLAG (rótulos Permitir/Negar/Abrir herdados, não reabertos nesta fase)
- [x] Dimension 2 Visuals: FLAG (palco com DPI misto é risco do plano)
- [x] Dimension 3 Color: FLAG (resolvido: fundos de botão são tokens fixos, não o acento)
- [x] Dimension 4 Typography: FLAG (11/12/13 próximos; aceito)
- [x] Dimension 5 Spacing: FLAG (medidas herdadas não múltiplas de 4 declaradas como exceção)
- [x] Dimension 6 Registry Safety: PASS
- [x] Dimension 7 Inventory Provenance: PASS (seção omitida: `Tool: none`)

**Approval:** aprovado pelo gsd-ui-checker em 2026-11-21, com 5 recomendações não bloqueantes
