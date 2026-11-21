# Fase 4: Entrada, preferências e comportamento no sistema - Mapa de padrões

**Mapeado:** 2026-11-21
**Arquivos analisados:** 13 (3 novos de teste/código + 1 script + 9 modificados)
**Analogos encontrados:** 13 / 13 (todos rastreados no git; checado com `git ls-files`)
**Raiz:** `D:/Desenvolvimentos/Pessoal/claude-island-fase2` (números de linha são deste worktree, base 263 testes)

## Classificação dos arquivos

| Arquivo | Papel | Fluxo de dados | Analogo mais próximo | Qualidade |
|---|---|---|---|---|
| `state.js` (+ `anchorPosition`, `islandDisplays`, `nextFullscreen`, `isIslandVisible`, `normalizePreferences` estendido) | utility (lógica pura) | transform | `state.js` `normalizePreferences`/`positionFromSavedOffset`/`effectiveOpacity` | exato |
| `main.js` (cursorTick, capture, menu, atalho, prefs, visibilidade) | controller/main wiring | event-driven + file-I/O | `main.js` `refresh`/`island:hover`/`writeDecision` | exato |
| `preload.js` | provider (bridge) | request-response | `preload.js` atual | exato |
| `index.html` (bloco `hover:inicio/fim`, `contextmenu`, `data-anchor`, `expandOn`/`pinExpanded`) | component | event-driven | `regras-do-gate`/`mola` + `setHovering` | exato |
| `fullscreen.js` (novo) | utility (sensor nativo) | request-response (poll) | `window.js` (`findWindowPid`, nunca lança) | role-match |
| `gate.test.js` | test | texto + vm | ele mesmo (`loadInlineBlock`, `collectChannels`, `objectArgument`) | exato |
| `island.test.js` | test | unit | `normalizePreferences:` e `isWithinWorkArea` testes | exato |
| `hover.test.js` (novo) | test | vm | `gate.test.js` `loadInlineBlock` | exato |
| `prefs.test.js` (novo) | test | unit + file-I/O | `island.test.js` `tempSettings` (mkdtemp) + `normalizePreferences:` | role-match |
| `fixtures/permission-vectors.json` | config (vetores) | transform | seção `isWithinWorkArea` (linha 715+) | exato |
| `package.json` | config | - | ele mesmo | exato |
| `pnpm-workspace.yaml` | config | - | ele mesmo (`allowBuilds: electron: true`) | exato |
| `scripts/human-checks.js` (novo) | utility (ferramenta) | CLI | `scripts/spike-verdict.js` | role-match |

## Atribuições de padrão

### `state.js` — funções puras novas e normalizador estendido (utility, transform)

**Analogo:** `state.js:342-354` (`normalizePreferences`), `:265-269` (`positionFromSavedOffset`), `:291-295` (`effectiveOpacity`), `:208-226` (`isWithinWorkArea`).

**Normalizador (copiar a forma; trocar a desestruturação por laço sobre o esquema, D-06):**
```js
// state.js:317-324, 342-354
const THEMES = Object.freeze(['auto', 'obsidian', ...]);
const DEFAULT_PREFERENCES = Object.freeze({ theme: 'auto', shape: 'pill', animationStyle: 'default', animationSpeed: 1 });
function normalizePreferences(input) {
  const { theme, shape, animationStyle, animationSpeed } = input || {};
  const pick = (value, list, fallback) => (typeof value === 'string' && list.includes(value) ? value : fallback);
  return {
    theme: pick(theme, THEMES, DEFAULT_PREFERENCES.theme),
    // NaN e Infinity falham na comparação.
    animationSpeed: typeof animationSpeed === 'number' && animationSpeed >= ANIMATION_SPEED_MIN && animationSpeed <= ANIMATION_SPEED_MAX
      ? animationSpeed : DEFAULT_PREFERENCES.animationSpeed,
  };
}
```
Regras para estender: `list.includes` (não `in`), sempre objeto novo e completo, nunca lança, nunca muta; `opacity` ∈ `[1, 0.85, 0.7, 0.55]` por `includes` (0 e NaN caem no padrão 1). `DEFAULT_PREFERENCES` é `Object.freeze`. Novas chaves: `expandOn`, `pinExpanded`, `opacity`, `anchor`, `islandMode`, `shortcut`, `version`. Atenção: o teste `island.test.js:245-262` e `gate.test.js:417-424` comparam o objeto completo e a linha literal de `loadPreferences`; mudam de propósito no mesmo commit.

**Funções puras com `workArea`/`windowSize` e retorno `{x,y}` (modelo para `anchorPosition`):**
```js
// state.js:252-254 e 276-283
function defaultIslandPosition(workArea, windowSize) {
  return { x: Math.round(workArea.x + (workArea.width - windowSize.width) / 2), y: workArea.y };
}
function clampIslandPosition(position, workArea, windowSize, horizontalSlack) {
  const clamp = (value, min, max) => Math.round(Math.max(min, Math.min(value, max)));
  return { x: clamp(position.x, ...), y: clamp(position.y, workArea.y, workArea.y + workArea.height - windowSize.height) };
}
```
`anchorPosition` deve ficar ao lado destas, com comentário MIT de origem nas constantes 16/40 px (ver Padrões compartilhados). O offset salvo continua relativo (`positionFromSavedOffset` `:265-269` valida `Number.isFinite` e devolve o padrão); trocar a âncora zera `savedOffsets`.

**Guarda de entrada inválida (fail-safe) a copiar para `nextFullscreen`/`islandDisplays`/`isIslandVisible`:**
```js
// state.js:291-295
function effectiveOpacity(preferredOpacity, hasPermission) {
  if (hasPermission !== false) return 1;
  if (typeof preferredOpacity !== 'number' || !(preferredOpacity > 0 && preferredOpacity <= 1)) return 1;
  return preferredOpacity;
}
```
`effectiveOpacity` já existe e é o consumidor de PREF-06; só o main passa a chamá-la (remover "Ainda sem consumidor" do JSDoc `:288`).

**Tolerância de borda de baixo a 125% (D-14):** `WORK_AREA_TOLERANCE_PX = 2` em `state.js:208`; o limite de baixo está em `:225`. Decidir 2 ou 4 no plano; novo vetor em `fixtures/permission-vectors.json`.

**Exports:** acrescentar ao único `module.exports` (`state.js:360-369`), uma lista, constantes junto das funções.

---

### `main.js` — gravação atômica de preferências e posições (file-I/O)

**Analogo:** `writeDecision` `main.js:111-119`; hoje `persistSavedOffsets` `:66-72` usa `writeFileSync` direto (D-07 troca).
```js
// main.js:111-119
function writeDecision(permissionId, behavior) {
  const decisionFile = path.join(DECISIONS_DIR, `${permissionId}.json`);
  // Grava num temporário e renomeia: o hook nunca lê uma decisão pela metade.
  const temporaryFile = `${decisionFile}.tmp`;
  fs.mkdirSync(DECISIONS_DIR, { recursive: true });
  fs.writeFileSync(temporaryFile, JSON.stringify({ behavior }));
  fs.renameSync(temporaryFile, decisionFile);
}
```
**Tratamento de erro (copiar):** falha de gravação não lança, só `console.error` pt-BR (`main.js:66-72`, `:90-97`).

**Leitura de preferências (estender `loadPreferences`, `main.js:58-64`):**
```js
function loadPreferences() {
  try {
    preferences = normalizePreferences(JSON.parse(fs.readFileSync(PREFERENCES_FILE, 'utf8')));
  } catch {
    // arquivo ausente ou corrompido: valem os padrões
  }
}
```
Acrescentar: teto de 64 KB (`fs.statSync().size`), distinguir `ENOENT` (padrões, sem renomear) de JSON inválido (`fs.renameSync(PREFERENCES_FILE, `${PREFERENCES_FILE}.bad`)`). `.bad` não termina em `.json`, então `isSessionFile` (`state.js:331-333`) já o ignora. Trava `gate.test.js:417-424` exige a string literal da leitura, "uma só chamada" de `loadPreferences()` e `writeFileSync(PREFERENCES_FILE` ausente: a gravação deve ir por variável de arquivo temporário (`${PREFERENCES_FILE}.tmp`), e a trava é reescrita de propósito para "grava só por tmp+rename".

---

### `main.js` — funil `refresh(reason)` e rearme (event-driven)

**Analogo:** `main.js:183-196`, ouvintes `:219-220`, `:359-364`.
```js
// main.js:183-196
function refresh(reason) {
  const picked = pickState(readSessions(), Date.now());
  const serialized = JSON.stringify(picked);
  const permissionId = picked.permission ? picked.permission.id : null;
  const nextShown = nextShownPermission(shown, permissionId, performance.now(), reason === 'rearm');
  if (serialized === lastSent && nextShown.epoch === shown.epoch) return;
  lastSent = serialized; lastPickedState = picked; shownWindowPid = picked.windowPid ?? null; shown = nextShown;
  for (const island of islands.values()) sendState(island);
}
// main.js:219-220 (já rearmam em reexibir)
island.on('show', () => refresh('rearm'));
island.on('restore', () => refresh('rearm'));
// main.js:362-364 (modelo para ligar um evento a rearme)
for (const eventName of ['display-added', 'display-removed', 'display-metrics-changed']) screen.on(eventName, () => refresh('rearm'));
```
Reuso para a fase: `menu.on('menu-will-show' | 'menu-will-close', () => refresh('rearm'))`; toda `applyPreference` termina em `refresh('rearm')`; troca de monitor no modo `cursor` idem. Invariante I2: `shown =` só muda dentro de `refresh` (teste `gate.test.js:54-74`). `setOpacity(effectiveOpacity(preferences.opacity, picked.permission !== null))` entra no mesmo passo, para todas as ilhas, antes do retorno antecipado ou depois dele cuidadosamente: o retorno antecipado `:190` engole preferência nova sem estado novo, então a aplicação de opacidade deve ficar antes dele ou a mudança de preferência deve chamar uma função própria. O payload `island:state` (`:173`) é travado em `gate.test.js:343`; novas chaves entram na mesma edição.

---

### `main.js` + `preload.js` — canais IPC e checagem de remetente

**Analogo:** `main.js:260-273`, `preload.js:3-11`.
```js
// main.js:260-273
const islandOf = (event) => {
  const frame = event.senderFrame;
  const isMainFrame = Boolean(frame) && frame === event.sender.mainFrame;
  if (!isIslandSender({ isMainFrame, url: frame?.url, islandUrl: ISLAND_URL })) return null;
  return BrowserWindow.fromWebContents(event.sender);
};
ipcMain.on('island:hover', (event, isOverPill) => {
  const island = islandOf(event);
  if (!island || dragStartPositions.has(island) || !CAN_CLICK_THROUGH) return;
  island.setIgnoreMouseEvents(!isOverPill, { forward: true });
});
```
**Copiar para `island:capture` (boolean estrito) e `island:menu` (sem argumentos):** todo `ipcMain.on` abre com `const island = islandOf(event); if (!island ...) return;`; segurar a captura com `dragStartPositions.has(island)` e `menuOpen`; trocar `setIgnoreMouseEvents(!isOverPill, { forward: true })` por `setIgnoreMouseEvents(!capture)` (sem `forward`). Validar `typeof capture === 'boolean'` (padrão de validação de `island:drag`, `Number.isFinite`, `main.js:280`). `createIsland` `:228` troca `setIgnoreMouseEvents(true, { forward: true })` por `setIgnoreMouseEvents(true)`; remover `CAN_CLICK_THROUGH` só no que for Windows/macOS (Linux mantém, D-03).

**Envio ao renderer (`island:cursor`):** mesmo guarda de `sendState` `main.js:160-176`, com `isIslandSender({ isMainFrame: true, url: island.webContents.getURL(), islandUrl: ISLAND_URL })` antes de `island.webContents.send(...)`.

**Preload (modelo `preload.js:4-5`):**
```js
onState: (callback) => ipcRenderer.on('island:state', (_event, state, shouldChime) => callback(state, shouldChime)),
setHover: (isOverPill) => ipcRenderer.send('island:hover', isOverPill),
```
Saem `setHover`; entram `onCursor` (`ipcRenderer.on`), `setCapture` e `openMenu` (`ipcRenderer.send`). `collectChannels` exige canal literal em toda menção a `ipcRenderer` (sem alias).

---

### `main.js` — `island:decide` e os fatos da janela (gate)

**Analogo:** `main.js:316-348`.
```js
// main.js:327-330
windowVisible: island.isVisible() && !island.isMinimized(),
// ponytail: sem sonda de tela cheia até a Fase 4 (TELA-01); ...
coveredByFullscreen: false,
withinVisibleArea: Boolean(display) && isWithinWorkArea(island.getBounds(), display.workArea, HORIZONTAL_SLACK),
```
Trocar `false` por `display ? fullscreenByDisplay.has(display.id) : true` (display desconhecido = coberto) e remover o `ponytail` obsoleto. A trava `gate.test.js:322` (`['coveredByFullscreen', 'false']`) muda no mesmo commit. `objectArgument` lê uma chave por linha, então manter o valor em uma linha e sem vírgula interna ambígua. Se CHK-03 reprovar o menu, `!menuOpen` entra em `windowVisible` (trava `:321`).

---

### `main.js` — menu nativo, atalho global, visibilidade

**Sem analogo no repo** (nenhum `Menu`/`globalShortcut`/`hide()` em uso). Usar RESEARCH.md linhas 319-330 (`registerToggleShortcut` com `try/catch` devolvendo `'ok'|'unavailable'|'invalid'`), `menu.popup({ window: island, callback })` sem x/y, `menu-will-show`/`menu-will-close` e `globalShortcut.unregisterAll()`. Estrutura para seguir:
- `will-quit`: estender o `app.on('will-quit', () => fs.rmSync(HEARTBEAT_FILE, { force: true }))` (`main.js:378`).
- Imports: acrescentar `Menu, globalShortcut` ao `require('electron')` de `main.js:1`; o `require` multilinha de `./state` (`:6-11`) cresce no mesmo estilo.
- Registro do atalho só depois de `app.whenReady()` (`start`, `main.js:351-370`), antes de `syncIslands`.
- Esconder por `island.hide()` e `showInactive()` (nunca `destroy`; `syncIslands` `:248-253` é o único que destrói). Efeito dispara `'show'` que já rearma (`:219`).

**`createIsland` na âncora (D-14):** hoje cria com `...clampIslandPosition(savedPosition(display), ...)` (`:200-201`) e `moveIsland` (`:149-153`) usa `setBounds` com tamanho explícito:
```js
island.setBounds({ ...clampIslandPosition(position, workArea, WINDOW_SIZE, HORIZONTAL_SLACK), ...WINDOW_SIZE });
```
Chamar `moveIsland` uma vez depois de construir; nunca `setPosition`. `savedPosition` (`:155-157`) passa a derivar de `anchorPosition`. `moveIsland` e `positionFromSavedOffset` recebem a âncora; `island:drag-end` (`:286-294`) e `island:reset-position` (`:296-303`) usam `defaultIslandPosition`, que deve virar a posição da âncora atual.

---

### `index.html` — bloco puro `hover:inicio/fim` (component, event-driven)

**Analogo:** `// regras-do-gate:inicio` ... `fim` (`index.html:307-402`) e `// mola:inicio` ... `fim` (`:404-552`).
```js
// index.html:307-317
// regras-do-gate:inicio
// Regras puras do gate no renderer ... Aqui só entram constantes e funções que nunca lançam.
// ponytail: regras puras inline, testadas por extração em node:vm. ...
const PERMISSION_ARM_MS = 800;
```
Regras para o bloco novo: marcadores `// hover:inicio` e `// hover:fim` cada um exatamente uma vez (`loadInlineBlock` assert `gate.test.js:96-103`); só constantes e funções que nunca lançam, sem `window`, `document`, `performance`; constantes com unidade (`HOVER_ENTER_PX`, `HOVER_LEAVE_PX`); entrada inválida devolve `false` (fail-safe: não captura). Modelo do `hoverStep` está em RESEARCH.md linhas 187-197 (ajustar sinal: entra 2 px dentro, sai 8 px fora). O retângulo vem de `pill.getBoundingClientRect()` (mesma leitura de `index.html:1021`).

### `index.html` — troca do hover por DOM

**Remover (`index.html:975-985`):**
```js
function setHovering(isOverPill) {
  hovering = isOverPill;
  window.island.setHover(isOverPill);
  render();
}
pill.addEventListener('mouseenter', () => setHovering(true));
pill.addEventListener('mousemove', () => { if (!hovering) setHovering(true); });
pill.addEventListener('mouseleave', () => { if (!drag) setHovering(false); });
```
Substituir por `window.island.onCursor((point) => { const next = hoverStep({ inside: hovering, point, rect: pill.getBoundingClientRect() }); ... window.island.setCapture(next) ... })`, com uma única entrada para `hovering` (Pitfall 9). **Manter:** `actions.addEventListener('pointermove', ...)` (`:855`, é do armamento) e `pointermove`/`pointerdown` do arraste (`:992-1011`).
- `lostpointercapture` (`:1014-1025`): trocar o cálculo por `clientX/Y` pela última posição de `island:cursor`; manter `if (moved) window.island.endDrag()`.
- `dblclick` (`:1027-1033`): manter `resetPosition()`, trocar `setHovering(false)` pelo equivalente novo.
- Expansão (`:717-719`): estender sem tocar o gate:
```js
const expandsOnHover = hovering && current.state !== 'done';
pill.classList.toggle('expanded', current.state !== 'idle' && (expandsOnHover || current.state === 'waiting'));
```
com `expandOn` `'hover'|'click'` e `pinExpanded` (D-04/D-05, `done` continua sem expandir). Função de decisão pura vai no bloco `hover:` para ser testada por `node:vm`.
- Menu: `document.addEventListener('contextmenu', (event) => { event.preventDefault(); window.island.openMenu(); })` sem argumentos. Nenhum canal grava preferência (SEG-08).
- Preferências: `applyPreferences` (`:919-927`) já grava `dataset` e chama `restartArming()` quando muda com pedido; estender com `anchor` (`root.dataset.anchor`) e `expandOn`/`pinExpanded` mantendo `if (changed && current.permission) restartArming();` (trava `gate.test.js:434`).
- CSS: seletores `:root[data-shape="notch"] { --stage-top: 0px; }` (`:140`) são o modelo para `:root[data-anchor="..."]` (flex start/center/end; base com `align-items: flex-end` e `padding-bottom` para a sombra de 19 px).
- Trava de CSP (`index.html:5`, `default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'`): nenhum script externo.

---

### `fullscreen.js` (novo; utility, request-response)

**Analogo (role-match):** `window.js` `findWindowPid` (nunca lança, devolve `null`, `try/catch` de topo). Confirmar o trecho com `grep -n "findWindowPid" window.js` ao planejar; o contrato é o mesmo: JSDoc "Nunca lança", só dados puros na saída.
Estrutura: `koffi` via `require` dentro de `if (process.platform === 'win32')` e `try/catch` (lazy), nenhum `require('./fullscreen')` em `hook.js`/`permission-hook.js`/`window.js`, `module.exports = { probe }`. Corpo: RESEARCH.md linhas 296-317. Cor local: CommonJS, `node:` prefix, comentário pt-BR sobre o porquê.

---

### `gate.test.js` — travas e vm (test)

**Extração inline em `node:vm` (reuso direto em `hover.test.js`):**
```js
// gate.test.js:96-103
function loadInlineBlock(startMarker, endMarker, exported) {
  for (const marker of [startMarker, endMarker]) {
    assert.equal(rendererSource.split(marker).length - 1, 1, `marcador ausente ou repetido no index.html: ${marker}`);
  }
  const start = rendererSource.indexOf(startMarker) + startMarker.length;
  const block = rendererSource.slice(start, rendererSource.indexOf(endMarker));
  return vm.runInNewContext(`${block}\n({ ${exported.join(', ')} })`, Object.create(null));
}
```
**Travas que mudam de propósito (mesmo commit da mudança):**
- `gate.test.js:236-238` `RENDERER_CHANNELS`: sai `'island:hover'`, entram `'island:capture'`, `'island:cursor'`, `'island:menu'` (`cursor` é main→renderer, mas hoje a lista mistura `island:state`; `:295` filtra só `island:state` dos handlers do main, então ajustar o filtro para também excluir `island:cursor`). Títulos "sete canais" (`:240`) e "seis canais" (`:292`) mudam.
- `:261` `assert.equal(handlers.length, 6)`: novo total (`capture` e `menu` entram, `hover` sai: 7).
- `:322` `['coveredByFullscreen', 'false']`.
- `:343` string do payload `island:state` se ganhar chave.
- `:417-424` trava da gravação de preferências.
- `:259` regex `islandOf` e `:263-265` "todo handler chama `islandOf(event)`" valem para os novos handlers sem alteração.
- Aproveitar o helper `objectArgument` (`:301-310`) para travar a cola `setOpacity(effectiveOpacity(...))` e o fato por display.

**Vetores do gate (modelo):**
```js
// gate.test.js:30-35
for (const vector of vectors.isWithinWorkArea) {
  test(`isWithinWorkArea: ${vector.name}`, () => {
    const { bounds, workArea, horizontalSlack } = vector.input;
    assert.equal(isWithinWorkArea(bounds, workArea, horizontalSlack), vector.expect);
  });
}
```
Novo vetor entra em `fixtures/permission-vectors.json` na seção `"isWithinWorkArea"` (linha 715+), formato `{ "name", "input": { "bounds": {x,y,width,height}, "workArea": {...}, "horizontalSlack" }, "expect": bool }`; não editar vetores existentes (`version`/`armMs` na raiz, `:2-3`).

---

### `island.test.js` e `prefs.test.js` (test, unit)

**Analogo:** `island.test.js:245-262` (`normalizePreferences:` por chave), `:200-206` (`tempSettings` com `fs.mkdtempSync(path.join(os.tmpdir(), ...))`), `:339-344` (`isWithinWorkArea` com `MONITOR_WORK_AREA`).
```js
// island.test.js:200-206
function tempSettings(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'island-install-'));
  const file = path.join(dir, 'settings.json');
  fs.writeFileSync(file, JSON.stringify(content));
  return file;
}
```
Cabeçalho do arquivo (`island.test.js:1-12`): `node:test`, `node:assert/strict`, `require('./state')` por desestruturação multilinha. Nomes de teste em pt-BR. `prefs.test.js` usa o mesmo cabeçalho: `normalizePreferences` (arquivo vazio, truncado, tipos errados, formato da Fase 3, `__proto__`, `opacity: 0`, `animationSpeed: 0`), persistência tmp+rename em `os.tmpdir()` e status do atalho. O teste de persistência precisa que a escrita seja uma função testável: extrair para `state.js`/módulo sem Electron só se for pura; senão manter a lógica de arquivo no `main.js` e testar só `normalizePreferences` e o `.bad` por texto.
`hover.test.js`: copiar o cabeçalho e `loadInlineBlock` de `gate.test.js:90-103` (função não é exportada de lá; duplicar as 8 linhas é o menor diff, `ponytail` em vez de extrair um helper compartilhado).

---

### `package.json`, `pnpm-workspace.yaml`

```yaml
# pnpm-workspace.yaml (atual)
allowBuilds:
  electron: true
```
Passa a `allowBuilds:\n  electron: true\n  koffi: false`. `package.json` atual só tem `devDependencies.electron` (`^45.4.1`); `koffi` entra em `dependencies` com `"koffi": "3.3.8"` exato (sem `^`). Antes do `pnpm add`, a conferência de D-20 (release, `scripts`, optionalDependency) vai ao SUMMARY.

---

### `scripts/human-checks.js` (novo; utility, CLI)

**Analogo:** `scripts/spike-verdict.js:1-25`: comentário de cabeçalho com o porquê e o uso (`// Uso: node scripts/... <args>`), `require('node:fs')`/`require('node:path')`, constantes `UPPER_SNAKE_CASE` com unidade, tolerância justificada em comentário. Por rodar no Electron (CHK-01/02: pílula de teste e `globalShortcut`), o script é executado por `node_modules/electron/dist/electron.exe`, nunca em hook; manter fora do `require` de qualquer módulo da ilha. Teste companheiro no estilo de `scripts/spike-verdict.test.js` só se tiver lógica pura (modo `--selftest` como a pesquisa descreveu).

## Padrões compartilhados

### Remetente confiável em todo canal novo
**Fonte:** `main.js:260-265` (`islandOf`) e `state.js:307-315` (`isIslandSender`). **Aplicar a:** `island:capture`, `island:menu`. Trava `gate.test.js:259-265` já cobre.

### Funil de rearme
**Fonte:** `main.js:183-196` e `:219-220`. **Aplicar a:** menu (will-show/will-close), mudança de preferência, atalho/esconder-reexibir, troca de monitor no modo `cursor`. Nenhuma outra função escreve `shown`.

### Gravação entre processos/arquivos
**Fonte:** `main.js:111-119`. **Aplicar a:** `preferences.json` e `positions.json` (`persistSavedOffsets`, `:66-72`).

### Entrada de disco nunca é confiável
**Fonte:** `state.js:265-269` (offset), `main.js:49-56` (`loadSavedOffsets`), `state.js:342-354`. **Aplicar a:** esquema de preferências, `shortcut`, `version`, leitura com teto de 64 KB.

### Falha silenciosa com comentário do fallback
**Fonte:** `main.js:53-55`, `:106-108`. `catch {}` só com comentário do que acontece; erro visível ao usuário: `console.error` em pt-BR e o app segue.

### Licença do mod
**Fonte:** `gate.test.js:185-200` (teste do aviso) e `THIRD_PARTY_NOTICES.md`. **Aplicar a:** constantes de âncora (16 px laterais, 40 px de baixo) e degraus de opacidade 100/85/70/55 com `// Origem: Windhawk mod (MIT), ver THIRD_PARTY_NOTICES.md`.

### Estilo
2 espaços, aspas simples, ponto e vírgula, vírgula final, `node:` prefix, comentários pt-BR sobre o porquê, `ponytail:` para atalhos com teto conhecido, um `module.exports` no fim com todas as exportações.

## Sem analogo

| Arquivo/trecho | Papel | Fluxo | Motivo |
|---|---|---|---|
| Menu nativo (`Menu.buildFromTemplate`/`popup`) em `main.js` | controller | event-driven | Nenhum menu no repo; usar RESEARCH.md Pattern 3 |
| `globalShortcut` em `main.js` | controller | event-driven | Nenhum atalho no repo; usar RESEARCH.md linhas 319-330 |
| `screen.getCursorScreenPoint` timer a 30 Hz | controller | polling | Só existe `setInterval` de `POLL_MS` (`main.js:369`) e do heartbeat (`:356`); copiar essa forma de `setInterval` |
| Chamadas FFI `koffi` em `fullscreen.js` | utility | request-response | Nenhuma FFI no repo; usar RESEARCH.md linhas 296-317 |

## Metadados

**Escopo de busca:** `main.js`, `preload.js`, `index.html`, `state.js`, `gate.test.js`, `island.test.js`, `fixtures/permission-vectors.json`, `package.json`, `pnpm-workspace.yaml`, `scripts/`.
**Pendente para o planejador:** reler `window.js` (`findWindowPid`) para o excerto exato do analogo de `fullscreen.js` (não lido neste mapeamento).
**Data:** 2026-11-21
