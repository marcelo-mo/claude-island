# Phase 3: Palco fixo, animação e visual - Pattern Map

**Mapped:** 2026-11-21
**Files analyzed:** 8 (6 modificados, 2 testes novos possíveis)
**Analogs found:** 8 / 8 (todos no próprio repositório; nenhuma dependência nova)

## File Classification

| Arquivo novo/modificado | Papel | Fluxo de dados | Análogo mais próximo | Qualidade |
|---|---|---|---|---|
| `index.html` — bloco `// mola:inicio … // mola:fim` | utility pura inline | transform (estado da mola → próximo estado) | `index.html` linhas 238-322 (`// regras-do-gate:inicio … fim`) | exata |
| `index.html` — `settleStep` com `springsAtRest` | utility pura (gate) | request-response | `index.html` linhas 262-275 (`settleStep`) | exata |
| `index.html` — laço rAF das molas, `render()`, nudge, hover, `data-theme`/`data-shape` | component (renderer) | event-driven | `index.html` linhas 362-473 (`render`, `restartArming`, `waitUntilSettled`, `ResizeObserver`) e 565-574 (`setHovering`) | exata |
| `index.html` — CSS de temas, formas, material, `--perm-*` | config (tokens CSS) | n/a | `index.html` linhas 8-45 (`:root` + `@media (prefers-color-scheme: light)`) | exata |
| `state.js` — `normalizePreferences` (+ constantes de padrão) | utility pura | transform | `state.js` linhas 254-264 (`effectiveOpacity`) e 236-252 (`defaultIslandPosition`/`clampIslandPosition`) | exata |
| `main.js` — `WINDOW_SIZE`, conversão de posição salva, leitura de `preferences.json`, payload `island:state` | controller (Electron main) | file-I/O + request-response (IPC) | `main.js` linhas 13-18, 49-58 (`loadSavedOffsets`), 143-169 (`moveIsland`, `savedPosition`, `sendState`) | exata |
| `fixtures/permission-vectors.json` — vetores `springsAtRest` (e, se fizer sentido, vetores da mola) | test fixture | batch | `fixtures/permission-vectors.json` linhas 1210-1431 (`settleStableMs` + `settleStep`) | exata |
| `gate.test.js` (ou `spring.test.js` novo) — extração da mola, simulação do palco | test | batch | `gate.test.js` linhas 85-129 (`loadRendererRules` + laço de vetores) | exata |
| `theme.test.js` novo (ou dentro de `animation.test.js`) — contraste lido dos tokens | test | file-I/O (lê CSS) | `animation.test.js` linhas 6-34 (`keyframeBlocks`, `selectorsWhere`) | role-match |
| `island.test.js` — `normalizePreferences`, posições com o palco novo | test | batch | `island.test.js` linhas 1-10 e 56-65 | exata |

---

## Pattern Assignments

### `index.html` — bloco `// mola:inicio … // mola:fim` (utility pura, transform)

**Análogo:** `index.html` linhas 238-322 e o extrator em `gate.test.js` linhas 89-104.

**Cabeçalho do bloco** (linhas 238-243) — copiar a forma: marcador, por que é inline, contrato de pureza, `ponytail:` com o caminho de saída (`spring.js` + `script-src 'self'`, adiado pelo D-03):
```js
  // regras-do-gate:inicio
  // Regras puras do gate no renderer: ... Ficam inline porque
  // a CSP não aceita script externo; o gate.test.js lê o texto entre os marcadores e o executa num
  // contexto vazio, ... um predicado que tocasse DOM ou relógio global quebraria lá. Aqui só entram constantes e funções que nunca lançam.
  // ponytail: regras puras inline, testadas por extração em node:vm. Quando a Fase 3 validar script-src 'self' via file:// (spring.js), mover ...
```
Atualizar o `ponytail:` da linha 243: a Fase 3 decidiu não validar (D-03); o texto deve dizer que segue adiado.

**Constantes com unidade no nome e comentário do porquê** (linhas 245-253):
```js
  const PERMISSION_ARM_MS = 800;
  // Retângulo parado por este tempo = transição assentada (vale para a transição CSS de hoje e
  // para molas em JS depois): um botão que ainda anda é um botão no lugar errado.
  const SETTLE_STABLE_MS = 100;
```
Para a mola: `SPRING_STEP_MS = 0.5`, `SPRING_MAX_FRAME_MS = 50`, `SPRING_GROW = { stiffness: 380, damping: 26 }` etc., cada trecho portado com o comentário curto de origem MIT apontando para `THIRD_PARTY_NOTICES.md` (D-01, D-21).

**Função pura que nunca lança, entrada por objeto, `now`/`dt` como parâmetro** (linhas 262-275):
```js
  function settleStep(input) {
    const { previousRect, rect, pillOpacity, actionsOpacity, stableSince, now } = input || {};
    if (!Number.isFinite(now) || !isSameRect(previousRect, rect) || pillOpacity !== '1' || actionsOpacity !== '1') {
      return { stableSince: null, settled: false };
    }
    const since = Number.isFinite(stableSince) ? stableSince : now;
    return { stableSince: since, settled: now - since >= SETTLE_STABLE_MS };
  }
```
A mola segue igual: `springStep({ position, velocity, target, stiffness, damping, frameMs, speed })` → `{ position, velocity, atRest }`, sem mutar a entrada, `dt` inválido devolve o estado como está (ou já em repouso no alvo), sem `performance`/`window`. Escolha da direção por eixo (D-02) e multiplicadores de estilo (D-01) como funções puras no mesmo bloco.

**Ordem no script:** o bloco da mola entra junto do bloco do gate, antes da linha 324 (`document.addEventListener('visibilitychange'…)`), fora de `regras-do-gate` (cada extrator exige marcador único: `gate.test.js` linha 95).

---

### `index.html` — `settleStep` com `springsAtRest` (gate)

**Análogo:** o próprio `settleStep` (linhas 262-275) e a chamada em `waitUntilSettled` (linhas 440-467).

Campo novo booleano estrito, no mesmo estilo de `pillOpacity !== '1'` (comparação exata, nada de truthy):
```js
const { previousRect, rect, pillOpacity, actionsOpacity, springsAtRest, stableSince, now } = input || {};
if (... || springsAtRest !== true) return { stableSince: null, settled: false };
```
Atenção: os vetores existentes de `settleStep` não têm `springsAtRest` e não podem mudar (D-10). Ou o campo é opcional com fail-safe calculado de outro jeito, ou a regra vira **predicado novo** (`canArm({ settled, springsAtRest })`) chamado em `waitUntilSettled` linha 457 (`if (step.settled && springsAtRest)`). O predicado novo é o caminho que não toca nenhum vetor antigo; recomendo ele.

**Ponto de chamada** (linhas 447-462):
```js
      const step = settleStep({
        previousRect,
        rect,
        pillOpacity: getComputedStyle(pill).opacity,
        actionsOpacity: getComputedStyle(actions).opacity,
        stableSince,
        now,
      });
      previousRect = rect;
      stableSince = step.stableSince;
      if (step.settled) {
        armed = true;
```
Exportar o nome novo na lista `exported` de `gate.test.js` linhas 99-102.

---

### `index.html` — laço rAF das molas, nudge, hover, preferências (component, event-driven)

**Análogo:** `waitUntilSettled` (linhas 439-467) para o laço que para sozinho; `restartArming` (420-427); `setHovering` (565-569); `onState` (534-558); `visibilitychange` (325, 473).

**Laço que só existe enquanto há trabalho** (linhas 439-466) — copiar a forma `function frame() { if (<nada a fazer>) return; …; requestAnimationFrame(frame); }`, com uma flag `springLoopRunning` para não abrir dois laços (D-04). O laço das molas é separado do de armamento (D-04).

**Hover existente** (linhas 565-574):
```js
  function setHovering(isOverPill) {
    hovering = isOverPill;
    window.island.setHover(isOverPill);
    render();
  }
```
A escala-alvo 1,025 sai de `render()` a partir de `hovering && !current.permission` (D-08, D-09); nada de seletor CSS `:hover` com `transform`/`scale` (trava `gate.test.js` linhas 339-347 reprova qualquer regra `:hover`, `button`, `#actions` com essas propriedades). O `transform` vai por `pill.style.transform` em JS.

**Detecção de troca de estado para o nudge** — o lugar é `onState` (linhas 534-538), que já compara `next.state !== current.state` para o aviso sonoro:
```js
  window.island.onState((next, shouldChime) => {
    if (shouldChime && next.state !== current.state && CHIMES[next.state]) chime(CHIMES[next.state]);
```
Nudge só se `current.state !== 'idle'` (não na primeira exibição), sem pedido na tela, e com limite de 0,45 s (D-07); o limite usa `performance.now()` como o resto do renderer.

**Aplicar preferências e rearmar** — `restartArming()` (linhas 420-427) já faz `render()`; aplicar `document.documentElement.dataset.theme/shape` dentro de `onState` quando o valor mudar e chamar `restartArming()` só se houver pedido (padrão da linha 470: `if (current.permission) restartArming();`). O renderer só lê `next.preferences`; nunca envia (SEG-08).

**Visibilidade** (linhas 325 e 473): o handler que leva as molas ao alvo quando `document.hidden` entra junto desses dois listeners. Trava de texto: `animation.test.js` linha 57 exige a linha 325 exatamente como está; acrescentar listener novo, não editar esse.

**Movimento reduzido:** `matchMedia('(prefers-reduced-motion: reduce)')` + `addEventListener('change', …)`; espelha o `@media` da linha 198, que continua (trava `animation.test.js` linhas 60-64).

**Alvo medido do DOM (D-06):** `render()` (linhas 362-409) é quem troca as classes `expanded`/`has-window`/`has-permission`; depois delas, medir o tamanho natural (ex.: `scrollWidth`/`scrollHeight` com o tamanho inline liberado) e passar como alvo. Note que `#pill.expanded` (linhas 71-74) fixa `width: 400px; height: 104px/148px/auto` — essas medidas podem ficar como contêiner (D-06), mas as transições da linha 62-63 saem (D-05).

---

### `index.html` — CSS de temas, formas, material (config)

**Análogo:** linhas 8-45.

**Bloco de tokens + variante por esquema** (linhas 8-14 e 31-36):
```css
  :root {
    /* Laranja primário do tema escuro do quaint-money (globals.css, --primary). */
    --running: oklch(0.705 0.213 47.604);
    --waiting: #ff9f0a;
    --done: #30d158;
    --accent: var(--running);
    --surface: #000;
  ...
  @media (prefers-color-scheme: light) {
    :root {
      --running: oklch(0.646 0.222 41.116); /* --primary do tema claro do quaint-money */
```
Temas novos: `:root[data-theme="nord"] { --surface: …; --text: …; --muted: …; --border: …; }`; o `@media (prefers-color-scheme: light)` precisa passar a valer só para `auto` (ex.: `:root:not([data-theme]), :root[data-theme="auto"]`), senão um tema escuro num sistema claro herda as cores de estado claras. Porcelain repete as cores de estado claras. Cada bloco com o comentário MIT curto (D-21).

**Regras de estado que usam `--accent`** (linhas 69-70, 78): o contorno `--contour` substitui `--ring` (linha 78) e entra no `box-shadow` da linha 64.

**Pontos que mudam por decisão:**
- linhas 62-63: retirar `width`, `height`, `transform` e `var(--spring)` da transição (D-05); manter `opacity`, `box-shadow`, `background`; raio passa a `border-radius .3s ease`.
- linha 68 (`#pill[data-state="idle"]`): trocar `transform: scale(.6) translateY(-12px)` por `scale: .6; translate: 0 -12px` (UI-SPEC), para não brigar com o `style.transform` das molas.
- linha 47 (`interpolate-size`) e linha 28 (`--spring`): remover se ficarem sem uso; `--spring` ainda é usado em `#dot` (linha 99) — decidir ali.
- linha 51 (`padding-top: 8px`) vira `var(--stage-top)`; `notch` zera.
- linhas 153 e 183: `#permission` ganha `--perm-bg` opaco (hoje translúcido `color-mix(... 9%, transparent)`), contorno de Negar vai para `--perm-deny-border` (60%).
- linhas 123, 126, 156: pesos 500/700 → 400/600, `#count` 12,5px → 12px (UI-SPEC, sem trava de teste).

**Travas a respeitar** (`animation.test.js`): base `#pill` sem `animation` (linha 46 do teste); `animation: glow` só em `#pill:not([data-state="idle"])::before` (linha 51); keyframes só `opacity`/`transform`. Lavagem do acento no `background` da pílula (UI-SPEC), sem pseudo-elemento novo.

---

### `state.js` — `normalizePreferences` (utility pura)

**Análogo:** `effectiveOpacity` (linhas 254-264) — mesma família (preferência visual, fail-safe, JSDoc em prosa com o padrão):
```js
/**
 * Opacidade com que a ilha deve aparecer. Devolve 1 quando há pedido na tela ou o fato é
 * desconhecido (`hasPermission !== false`, fail-safe) e quando a preferência não é um número em
 * (0, 1]; senão devolve a preferência. ...
 */
function effectiveOpacity(preferredOpacity, hasPermission) {
  if (hasPermission !== false) return 1;
  if (typeof preferredOpacity !== 'number' || !(preferredOpacity > 0 && preferredOpacity <= 1)) return 1;
  return preferredOpacity;
}
```
Constantes de conjunto como em `state.js` linha 33 (`const WAITING_NOTIFICATIONS = new Set([...])`): `THEMES`, `SHAPES`, `ANIMATION_STYLES`; padrão `DEFAULT_PREFERENCES = Object.freeze({ theme: 'auto', shape: 'pill', animationStyle: 'default', animationSpeed: 1 })` (forma de `SECURE_WEB_PREFERENCES`, linha 288). Retorna objeto novo; `input || {}` como em `isIslandSender` (linha 277). `animationSpeed` fora de [0,5; 2] ou não finito → 1 (UI-SPEC).

**Export** (linhas 290-296): acrescentar ao único `module.exports`, mantendo o agrupamento.

Se a conversão de posição para o palco novo virar função, ela é pura e mora aqui, ao lado de `defaultIslandPosition`/`clampIslandPosition` (linhas 235-252), recebendo tamanhos como `{ width, height }`.

---

### `main.js` — palco, preferências, payload (controller, file-I/O + IPC)

**Análogo:** o próprio `main.js`.

**Constante com o porquê** (linhas 13-18):
```js
// A janela é maior que a pílula para caber a versão expandida; a sobra é transparente.
// A altura é a da pílula com um pedido de permissão no tamanho máximo (texto com rolagem).
const WINDOW_SIZE = { width: 440, height: 324 };
// A pílula expandida (400px) fica centrada na janela (440px): sobram 20px transparentes de
// cada lado, que podem sair da tela para a pílula encostar na borda do monitor.
const HORIZONTAL_SLACK = 20;
```
Com 520 de largura, `HORIZONTAL_SLACK` passa a `(520 − 400) / 2 = 60` para a pílula ainda encostar na borda; o comentário muda junto. Um teste deve ligar `WINDOW_SIZE` à simulação da mola (D-13) — hoje `WINDOW_SIZE` não é exportado (main.js depende de `electron`): mover a constante para `state.js` ou o teste ler o texto como as travas de `gate.test.js` (linha 51).

**Leitura opcional de arquivo, falha vira padrão** (linhas 51-58, `loadSavedOffsets`) — modelo exato para `loadPreferences()` lendo `path.join(STATE_DIR, 'preferences.json')` uma vez na subida, passando por `normalizePreferences`:
```js
function loadSavedOffsets() {
  try {
    const parsed = JSON.parse(fs.readFileSync(positionsFile(), 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) savedOffsets = parsed;
  } catch {
    // arquivo ausente ou corrompido: a ilha sobe na posição padrão
  }
}
```
Estado módulo com `let` e comentário (padrão das linhas 27-47).

**Posições salvas (D-14)** (linhas 149-155 e 279-287): os offsets são relativos a `defaultIslandPosition(workArea, WINDOW_SIZE)`, que já centra pela largura da janela — então o centro horizontal se preserva sozinho; o `y` da janela é o topo, e o topo da pílula fica em `y + stage-top` (inalterado fora do notch). Conferir com teste antes de converter qualquer coisa. `positions.json` é gravado em `persistSavedOffsets` (linhas 60-66).

**Payload IPC** (linhas 158-169):
```js
  island.webContents.send(
    'island:state',
    { ...lastPickedState, answeredId: decidedPermissionId, armEpoch: shown.epoch },
    isFirstIsland,
  );
```
**Trava de texto:** `gate.test.js` linha 331 exige exatamente `'{ ...lastPickedState, answeredId: decidedPermissionId, armEpoch: shown.epoch }'`. Acrescentar `preferences` muda esse texto: o diff da trava vai no mesmo commit (D-12). `refresh` (linhas 176-189) só reenvia quando muda; como as preferências são lidas uma vez, `did-finish-load` (linha 224) já cobre o envio inicial. `preload.js` linha 4 repassa o objeto inteiro, sem mudança.

---

### `fixtures/permission-vectors.json` — vetores novos

**Análogo:** linhas 1210-1431. Forma: constante escalar no topo do grupo + array de `{ name, input, expect }`, nomes em pt-BR descritivos:
```json
  "settleStableMs": 100,
  "pressDwellMs": 200,
  "settleStep": [
    {
      "name": "primeiro quadro parado, sem stableSince, ainda não assentou",
      "input": { "previousRect": { "left": 20, "top": 62, "width": 400, "height": 180 }, "rect": { ... }, ... },
```
Acrescentar chave nova (ex.: `"canArm": [...]` ou `"springsAtRest"`) depois de `isIslandSender`; JSON plano, independente de linguagem (I10). Incluir vetores com `springsAtRest` ausente, `1`, `"true"` → não arma. Não tocar nos existentes.

---

### `gate.test.js` (ou `spring.test.js`) — extração da mola e palco

**Análogo:** `gate.test.js` linhas 89-104 e 124-129:
```js
function loadRendererRules() {
  for (const marker of [RULES_START, RULES_END]) {
    assert.equal(rendererSource.split(marker).length - 1, 1, `marcador ausente ou repetido no index.html: ${marker}`);
  }
  const start = rendererSource.indexOf(RULES_START) + RULES_START.length;
  const block = rendererSource.slice(start, rendererSource.indexOf(RULES_END));
  const exported = [ ... ];
  return vm.runInNewContext(`${block}\n({ ${exported.join(', ')} })`, Object.create(null));
}
...
    // O objeto nasce noutro realm (vm), então o deepEqual estrito pede uma cópia no realm do teste.
    assert.deepEqual({ ...loadRendererRules().settleStep(vector.input) }, vector.expect);
```
Generalizar para `loadBlock(startMarker, endMarker, exported)` ou duplicar com `// mola:inicio`/`// mola:fim`. O teste "script inline compila inteiro" (linhas 109-113) continua valendo e pega const repetida entre os dois blocos. Simulação do palco (D-13): rodar `springStep` em passos de 16 ms com estilo `bouncy` a 1× e 2×, do compacto ao maior alvo e com retarget, e exigir `WINDOW_SIZE.width ≥ pico + 40` e `height ≥ stageTop + pico + 20`.

Travas que continuam: CSP (linhas 164-168), `buttonsRect`/`restartArming` (linha 269 em diante), `island:state` (linha 331).

---

### teste de contraste (novo) — lê tokens do `index.html`

**Análogo:** `animation.test.js` linhas 6-34:
```js
// O arquivo no disco pode ser CRLF (core.autocrlf): as regexes abaixo assumem LF.
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
...
function selectorsWhere(css, bodyTest) {
  let flat = css;
  for (const block of keyframeBlocks(css).reverse()) flat = flat.slice(0, block.start) + flat.slice(block.end);
  return [...flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, , body]) => bodyTest(body))
    .map(([, selector]) => selector.trim());
}
```
Usar o mesmo `matchAll(/([^{}]+)\{([^{}]*)\}/g)` para achar `:root[data-theme="..."]` e ler `--surface/--text/--muted/--border`. Atenção: o `@media (prefers-color-scheme: light) { :root { … } }` é aninhado e a regex plana não o pega inteiro (o teste de reduced-motion, linhas 60-64, usa regex específica para o `@media`). O teste precisa resolver `oklch(...)` e `color-mix(in srgb, …)` para sRGB por conta própria (sem dependência): implementar só os dois formatos usados, em JS puro, e falhar se aparecer outro formato. Par `--button-text`/`--button` registrado como controle (≥3:1), conforme UI-SPEC.

---

### `island.test.js` — `normalizePreferences` e posições

**Análogo:** linhas 1-10 (import de `state.js`) e 56-65 (testes de posição com `windowSize` explícito):
```js
  const clamp = (position) => clampIslandPosition(position, workArea, windowSize, 20);
  assert.deepEqual(defaultIslandPosition(workArea, windowSize), { x: -1180, y: 0 });
```
Ou, como `effectiveOpacity`, vetores em `fixtures/permission-vectors.json` consumidos em `gate.test.js` linhas 156-161 — para `normalizePreferences` é mais simples ficar em `island.test.js` (não é gate).

---

## Shared Patterns

### Pureza e fail-safe
**Fonte:** `index.html` linhas 262-275; `state.js` linhas 260-264, 276-284.
**Aplicar a:** mola, `canArm`/`springsAtRest`, `normalizePreferences`, conversão de posição.
Entrada desestruturada de `input || {}`, comparação estrita (`=== true`, `Number.isFinite`), nunca lança, devolve padrão/`false`, nunca muta a entrada.

### Rearmar no lado seguro
**Fonte:** `index.html` linhas 405, 420-427, 469-473.
**Aplicar a:** troca de tema/forma, retarget de mola com pedido na tela.
```js
  const layoutObserver = new ResizeObserver(() => { if (current.permission) restartArming(); });
```

### Travas de texto (D-12)
**Fonte:** `gate.test.js` linhas 49-50, 163-168, 327-347; `animation.test.js` inteiro.
**Aplicar a:** qualquer edição em `main.js` `sendState`, CSS de `#pill`/`:hover`/botões, `visibilitychange`.
Mudou o texto protegido de propósito: trava atualizada no mesmo commit.

### Origem MIT
**Fonte:** `THIRD_PARTY_NOTICES.md` (rastreado) e teste em `gate.test.js` linha 173.
**Aplicar a:** constantes da mola, estilos, temas, formas, camadas do material. Comentário curto apontando para `THIRD_PARTY_NOTICES.md`.

### Comentários e idioma
Comentário em pt-BR explicando o porquê, acima da linha; `ponytail:` para atalho com teto (ex.: palco único em multi-monitor com DPI misto, que a UI-SPEC deixa como suposição).

## No Analog Found

| Arquivo | Papel | Fluxo | Motivo |
|---|---|---|---|
| (conversão `oklch`/`color-mix` → sRGB no teste de contraste) | utility de teste | transform | Nada no repo calcula cor; escrever o mínimo em JS puro, sem dependência |
| (integrador da mola em si) | utility | transform | Sem física no repo; seguir D-01 e `WINDHAWK-MOD.md` §1, encaixando na forma do bloco `regras-do-gate` |

## Metadata

**Escopo da busca:** raiz do repositório (`index.html`, `main.js`, `state.js`, `preload.js`, `gate.test.js`, `animation.test.js`, `island.test.js`, `fixtures/permission-vectors.json`).
**Arquivos lidos:** 8.
**Data:** 2026-11-21.
