# Phase 3: Palco fixo, animação e visual - Context

**Gathered:** 2026-11-21
**Status:** Ready for planning
**Modo:** `--auto` (o autor pediu as fases 3 a 6 seguidas; cada zona cinzenta foi resolvida com PROJECT, REQUIREMENTS, `research/` e as decisões já tomadas, escolhendo o recomendado)

<domain>
## Phase Boundary

A pílula passa a mudar de tamanho por molas em JS (assimétricas, interrompíveis, 4 estilos, velocidade 0,5× a 2×), dá nudge na troca de estado e amplia levemente no hover, dentro de uma janela de tamanho fixo (palco). Ganha 8 temas mais o automático, 3 formas (pílula, notch, Windows 11) e um material com profundidade, sombra e reflexo no topo tingido pela cor do estado. Tudo é aplicado **por valor de preferência**: o menu que escolhe esses valores é da Fase 4.

Fica de fora: menu de clique direito, gravação de preferências, hover pela posição de tela (HOV-01), troca de sessão por scroll e a mola de troca de aba (Fase 5), transparência configurável (PREF-06), blur/acrílico (INTR-02).

O gate da Fase 2 continua inteiro: os botões só armam com o layout assentado, e "assentado" agora inclui "nenhuma mola em movimento".
</domain>

<decisions>
## Implementation Decisions

### Mola e laço de animação
- **D-01:** A mola é código próprio, sem biblioteca: integração semi-implícita, massa 1, passo fixo de 0,5 ms, `dt` do quadro limitado a 50 ms, velocidade multiplicando o `dt`. Constantes do mod: crescer k=380/c=26, encolher k=200/c=28, neutro k=280/c=24; estilos Suave (k×1, c×1,35), Padrão (×1, ×1), Elástico (k×1,1, c×0,7), Rápido (k×1,5, c×1,25). Cada trecho portado leva o comentário curto de origem MIT apontando para `THIRD_PARTY_NOTICES.md`.
- **D-02:** A direção (crescer ou encolher) é escolhida por eixo, comparando o alvo novo com a posição atual; um alvo novo no meio da animação mantém posição e velocidade (retarget sem salto).
- **D-03:** A mola fica **inline no `index.html`**, num bloco puro entre marcadores `// mola:inicio` e `// mola:fim`, testado por extração em `node:vm` vazio, como as `regras-do-gate` da Fase 2. **A CSP não muda.** Motivo: a Fase 1 confirmou Electron (a reutilização num webview Tauri caiu); `script-src 'self'` sob `file://` não foi validado e a CSP é uma trava de regressão do gate (T-02-19). — **Reversibility:** reversible — mover o bloco para `spring.js` depois é trocar a extração do teste e acrescentar `'self'` à CSP.
- **D-04:** O laço `requestAnimationFrame` só roda enquanto alguma mola não assentou (posição e velocidade abaixo de um limiar) e para sozinho; com a ilha ociosa ou escondida nenhum quadro roda. O laço do armamento da Fase 2 continua separado.
- **D-05:** As molas animam largura e altura da pílula, o deslocamento do nudge e a escala do hover. As transições CSS de `width`, `height` e `transform` da `#pill` saem (a curva `--spring` em CSS deixa de existir para tamanho); cor, opacidade e raio podem continuar por CSS. O conteúdo é posto na largura final e a pílula recorta (`overflow: hidden`), como o mod.
- **D-06:** O alvo de tamanho vem do layout real (medido no DOM com o conteúdo final), nunca de larguras fixas presas a uma fonte (VIS-05). As medidas de contêiner que já existem (400 px expandida, alturas de linha) podem ficar.

### Nudge e hover
- **D-07:** Nudge: quando o estado da sessão exibida muda, o topo da pílula pula −6 px e volta por mola neutra (k=280, c=24), no máximo uma vez a cada 0,45 s. Não dispara na primeira exibição nem com a ilha ociosa.
- **D-08:** Hover: escala 1,025 por mola, usando a detecção de hover que já existe no renderer (`setHovering`); a detecção pela posição de tela é da Fase 4.
- **D-09:** Com um pedido de permissão na tela não há nudge nem escala de hover na pílula inteira (é o jeito mais simples de garantir que os botões não sofrem nenhum dos dois, SEG-03). Quando o pedido sai, os efeitos voltam.

### Gate da Fase 2 com as molas
- **D-10:** O armamento passa a exigir também "todas as molas em repouso", além do retângulo dos botões parado por `SETTLE_STABLE_MS` (que continua). Vira um predicado puro novo ou um campo novo no `settleStep`/`canPress`, com vetores novos em `fixtures/permission-vectors.json` (I10: JSON plano, independente de linguagem). Os vetores existentes não mudam.
- **D-11:** Qualquer mudança de tema ou forma que mova os botões rearma (SEG-02); na prática o `ResizeObserver` e o `buttonsRect()` já pegam, e a aplicação de preferência chama `restartArming()` explicitamente.
- **D-12:** Os 194 testes atuais continuam passando sem afrouxar nenhuma trava; travas de texto exato só mudam se o texto que elas protegem mudar de propósito, e o diff da trava fica no mesmo commit.

### Palco fixo
- **D-13:** A janela tem tamanho fixo calculado para o pior caso: maior pílula (expandida com pedido no limite de rolagem) × pico do estilo Elástico a 2×, mais nudge, escala de hover e margem da sombra. Um teste simula a mola e confere que o palco cobre o pico (a pesquisa estimou ~520×410). `WINDOW_SIZE` em `main.js` muda uma vez e nunca durante a animação.
- **D-14:** A posição visual da pílula não pode pular para quem já tem posição salva: a troca de tamanho da janela preserva o centro horizontal e o topo da pílula (converter ou interpretar as posições salvas pela diferença de tamanho). O clique atravessa fora da pílula como hoje (`isOverPill` do renderer → `setIgnoreMouseEvents`).

### Preferências desta fase (só leitura)
- **D-15:** As preferências visuais (`theme`, `shape`, `animationStyle`, `animationSpeed`) são normalizadas por uma função pura em `state.js` (valor inválido ou ausente volta ao padrão, sem lançar) e enviadas pelo main ao renderer junto do estado. Padrões: `theme: auto`, `shape: pill`, `animationStyle: default`, `animationSpeed: 1`.
- **D-16:** O main lê um `preferences.json` opcional em `~/.claude/island/` uma vez na subida, só leitura, sem watch. Sem arquivo, valem os padrões. Gravar, menu, `version` e migração são da Fase 4 (PREF-01/02). O renderer nunca escolhe nem envia preferência (SEG-08).
- **D-17:** O renderer aplica as preferências como atributos `data-theme`, `data-shape` no documento e passa estilo/velocidade às molas.

### Temas
- **D-18:** Cada tema troca só fundo, superfície, texto, secundário e borda (tabela da seção 2 de `WINDHAWK-MOD.md`). **As cores de estado nunca mudam** (Key Decision de 2026-11-21): laranja `oklch(0.705 0.213 47.604)` / `oklch(0.646 0.222 41.116)`, verde `#30d158` / `#248a3d`, âmbar `#ff9f0a` / `#f08c00`, e o botão do quaint-money. Os 7 temas escuros usam as variantes escuras das cores de estado; o Porcelain usa as claras; `auto` segue `prefers-color-scheme` como hoje.
- **D-19:** Os tokens moram no CSS do `index.html` (uma fonte só) por seletor `:root[data-theme="..."]`; o teste de contraste lê esses tokens do próprio arquivo.
- **D-20:** O bloco de permissão tem tokens próprios (fundo do bloco, texto, rótulo da ferramenta, botões) e um teste puro calcula o contraste em todos os 9 temas (8 + automático claro e escuro): texto ≥4,5:1, controles ≥3:1. Se a cor de estado não atingir 3:1 num tema como rótulo, o rótulo usa o texto do tema, e a cor de estado não muda.
- **D-21:** Paleta Nord já creditada em `THIRD_PARTY_NOTICES.md` (Sven Greb); temas do mod levam o comentário MIT de origem.

### Formas
- **D-22:** `data-shape="pill"`: raio = altura/2, limitado a 44 px; `win11`: raio 8; `notch`: raio 16 só embaixo, topo reto e colado na borda (a pílula encosta no topo do palco, sem o respiro de 8 px). Valores do mod.

### Material
- **D-23:** Camadas da seção 2 de `WINDHAWK-MOD.md`, por CSS e estáticas: preenchimento do tema, gradiente de profundidade, lavagem radial do acento a partir do centro do topo (opacidade ~0,075, ~0,055 ociosa), contorno fino, sombra estática. Nada disso anima continuamente.
- **D-24:** O `::before` continua sendo só o brilho da Fase 1 (as travas de `animation.test.js` exigem que seja a única camada com `animation: glow` e que os keyframes só mexam em `opacity`/`transform`). A lavagem do acento usa `::after` ou o `background` da própria pílula, limitada à faixa do topo e abaixo do bloco de permissão, que tem fundo próprio opaco: o reflexo nunca pinta o comando.

### Movimento reduzido
- **D-25:** Com `prefers-reduced-motion: reduce`, as molas pulam direto para o alvo (sem rAF), sem nudge e sem escala de hover; a regra CSS que já para as animações continua.

### Claude's Discretion
- Limiares de repouso da mola, nomes das funções, como medir o tamanho-alvo no DOM, organização dos seletores de tema.
- Se o contorno do material substitui ou soma ao `box-shadow` atual de anel, desde que o brilho da Fase 1 continue igual.
- Divisão em planos e ondas.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Escopo e decisões
- `.planning/ROADMAP.md` § "Phase 3: Palco fixo, animação e visual" — objetivo e 5 critérios de sucesso
- `.planning/REQUIREMENTS.md` — ANIM-01..05, VIS-01..05 (e SEG-02/03/05 que não podem regredir)
- `.planning/PROJECT.md` § Key Decisions — cores de estado fixas; base Electron
- `.planning/research/SUMMARY.md` § "Decisões padrão recomendadas" (linhas de Mola, Tema e legibilidade, Fontes, Licença) e invariantes I3/I5

### Referência do mod
- `.planning/research/WINDHAWK-MOD.md` §1 (mola, estilos, nudge, hover, formas, palco) e §2 (temas, camadas do material, sombra, tipografia)
- `THIRD_PARTY_NOTICES.md` — aviso MIT do mod e crédito da paleta Nord; todo trecho portado aponta para cá

### Gate e travas que não podem quebrar
- `.planning/phases/02-funda-o-segura-do-gate-de-permiss-o/02-SECURITY.md` — ameaças T-02-08, T-02-11, T-02-19 (CSP)
- `gate.test.js` — travas de texto do renderer (CSP, `buttonsRect`, `restartArming`, bloco `regras-do-gate`)
- `fixtures/permission-vectors.json` — vetores dourados; acrescentar, nunca mudar os existentes
- `animation.test.js` — travas da Fase 1 (brilho só em `::before`, keyframes só `opacity`/`transform`, pausa com `data-hidden`, reduced-motion)

### Pesquisa de apoio
- `.planning/research/PITFALLS.md` — P1 (botão em movimento), P6 (contraste), P8/P9 (animação cara, DPI), P20 (fontes e licença)
- `.planning/research/ARCHITECTURE.md` — palco fixo e hit-test no retângulo vivo
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `index.html` bloco `// regras-do-gate:inicio … fim`: precedente de lógica pura inline testada por `node:vm` (modelo para o bloco da mola)
- `restartArming()` / `waitUntilSettled()` / `buttonsRect()` / `ResizeObserver` no renderer: ponto onde entra "molas em repouso"
- `setHovering(isOverPill)` e o `isOverPill` enviado ao main: hover e clique atravessando já existem
- `state.js`: lugar das funções puras novas (normalizar preferências) e das constantes
- Tokens CSS em `:root` e o bloco `@media (prefers-color-scheme: light)`: base dos temas

### Established Patterns
- Funções puras não lançam e devolvem padrão/`null` em entrada inválida; `now` entra como parâmetro
- Comentário explica o porquê; `ponytail:` para atalhos com teto conhecido
- Arquivo entre processos: gravar `.tmp` e renomear (não se aplica aqui: preferências só leitura)
- Testes `node:test` na raiz (`island.test.js`, `gate.test.js`, `animation.test.js`, `scripts/spike-verdict.test.js`)

### Integration Points
- `main.js`: `WINDOW_SIZE` (440×324 hoje), `createIsland`, `moveIsland`, posições salvas, envio do estado (`island:state`) que passa a levar as preferências
- `index.html`: CSS da `#pill` (transições de tamanho saem), `render()` (aplica alvo das molas e `data-*`), laço do armamento
</code_context>

<specifics>
## Specific Ideas

- Teste manual dispensado pelo autor; o que só se vê olhando a ilha (sensação da mola, os 4 estilos, os 9 temas, as 3 formas, o reflexo) vai como checklist no PR.
- Testes manuais desta sessão nunca mandam clique ou tecla sintética para janelas de outros apps.
- A ilha do autor roda a partir da pasta `claude-island` (main); subir a desta branch exige parar a dele e subi-la de novo a partir da main no fim.
</specifics>

<deferred>
## Deferred Ideas

- Mola de troca de aba (k=250, c=31, 34 px, escala 0,965) e lerp do acento: entram com a troca de sessão (Fase 5)
- Mover a mola e as regras do gate para `spring.js` com `script-src 'self'`: quando houver motivo (reuso fora do renderer)
- Gravar preferências, menu, `version`/migração: Fase 4 (PREF-01/02)
- Transparência configurável: Fase 4 (PREF-06)
- Blur/acrílico: v2 (INTR-02)
</deferred>

---

*Phase: 03-palco-fixo-anima-o-e-visual*
