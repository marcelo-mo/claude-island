# Phase 2: Fundação segura do gate de permissão - Research

**Researched:** 2026-11-21
**Domain:** gate de aprovação de permissão num app Electron (processo principal, preload, renderer vanilla, lógica pura testada com `node:test`) + aviso de licença MIT de terceiros
**Confidence:** HIGH (código do próprio repositório lido por inteiro; Electron conferido na documentação; LICENSE do mod lido direto do GitHub). MEDIUM só nos comportamentos de Chromium marcados `[ASSUMED]`.

## User Constraints (from CONTEXT.md)

Não existe `CONTEXT.md` para esta fase: o usuário aprovou planejar sem `/gsd-discuss-phase`. Valem como restrições travadas, com a mesma autoridade:

- `.claude/CLAUDE.md` do projeto (seção "Project Constraints" abaixo).
- `ROADMAP.md` § Phase 2 (goal, 5 critérios de sucesso, `Mode: mvp`, "Research flag: não").
- Invariantes I1..I10 de `.planning/research/SUMMARY.md` § "Invariantes de segurança de permissão (NÃO NEGOCIÁVEIS)".

### Locked Decisions
Nenhuma formal. Tratar como travado: Electron permanece a base nesta fase; o trabalho é portável (lógica pura em `state.js`, vetores em JSON).

### Claude's Discretion
Todo o desenho interno: assinatura da função pura, nomes dos motivos de recusa, estratégia de armamento no renderer, divisão em planos.

### Deferred Ideas (OUT OF SCOPE)
Tudo que o ROADMAP atribui a outras fases: molas/temas (Fase 3), hover por cursor, menu, preferências persistidas, atalho, sonda de tela cheia (Fase 4), sessões/scroll/fila (Fase 5), Windhawk (Fase 6), port Tauri (3.1 condicional).

<phase_requirements>
## Phase Requirements

| ID | Descrição | Suporte da pesquisa |
|----|-----------|---------------------|
| SEG-01 | Decisão sempre se aplica ao pedido que o `main` registrou; renderer envia intenção + eco do id | `acceptDecision` pura; eco = id capturado no `pointerdown`; hoje `preload.js:7` não envia eco (gap) |
| SEG-02 | Pedido exibido muda por caminho único (`refresh()`); toda troca reinicia o armamento | funil `refresh(reason)` + reducer puro `nextShownPermission`; hoje há um só ponto de escrita, mas anônimo, e só reinicia por id novo |
| SEG-03 | Armar após 0,8 s + animação assentada + cursor parado; sem escala de hover | armamento em duas camadas (main 0,8 s autoritativo; renderer: rect estável + opacidade 1 + dwell 200 ms) |
| SEG-04 | Clique começa e termina no mesmo botão do mesmo pedido; duas ilhas: primeiro vence | `pressedId` capturado no `pointerdown`; `decidedId` no main (hoje a segunda ilha sobrescreve a decisão: gap real) |
| SEG-05 | 100% opaca com pedido; roda só rola o texto; "lido" zera por pedido; ignora inércia 300-400 ms | opacidade 1 como pré-condição de armar; `wheel` com `preventDefault` na janela de 400 ms; `effectiveOpacity` pura |
| SEG-06 | Escondida / tela cheia / fora da área não aceita decisão; esconder nunca aprova; reexibir rearma | entradas `windowVisible`, `coveredByFullscreen`, `withinVisibleArea` na função pura; `show` rearma. Sonda de tela cheia só na Fase 4 |
| SEG-07 | Regra de aceite pura testada com vetores compartilháveis | `fixtures/permission-vectors.json` + `gate.test.js` |
| SEG-08 | `webPreferences` explícitas e seguras; preferências só pelo menu do main | constante `SECURE_WEB_PREFERENCES`; lista fechada de canais testada; sem canal de preferência hoje |
| CONV-04 | `THIRD_PARTY_NOTICES.md` com MIT completo, versão e titular conferido | titular conferido: `Copyright (c) 2026 devcode90` (ver § CONV-04) |
</phase_requirements>

## Summary

O gate de hoje é melhor do que o ROADMAP sugere: o renderer nunca informa o alvo, `main.js` usa `shownPermissionId` e recusa cliques nos 0,8 s após a troca de id, o id vem validado por `UUID_PATTERN`, e o único ponto de escrita de `shownPermissionId` já é um só (dentro do `setInterval`). Os gaps reais são cinco e todos estreitos: (1) não há eco de id, então a única defesa contra "o pedido mudou entre o clique e a chegada do IPC" é o relógio de 0,8 s; (2) **duas ilhas podem gravar decisões diferentes para o mesmo pedido** (cada renderer só trava o próprio botão, e `writeDecision` sobrescreve por `rename`), o que viola "primeiro clique vence"; (3) o armamento do renderer só reinicia por id novo e nunca desarma (`armedPermissionId` fica para sempre), não olha a animação nem o cursor, e a inércia da roda pode marcar "lido" um pedido novo; (4) não existe regra para ilha escondida, fora da área ou coberta (e nenhuma sonda para tela cheia existe antes da Fase 4); (5) `webPreferences` são implícitas e a única barreira a regressão é memória.

A estratégia é tests-first e de menor diff: extrair **três funções puras** para `state.js` (`acceptDecision`, `nextShownPermission`, `isWithinWorkArea`, mais `effectiveOpacity` de 1 linha), cobri-las com vetores JSON em `fixtures/permission-vectors.json` rodados por `node:test`, e só então religar `main.js` (handler `island:decide` fino + funil `refresh()`), `preload.js` (eco) e `index.html` (armamento por estado assentado, press/release, guarda de roda). Nenhuma dependência nova. O renderer não é testável por `node:test` (script inline, sandbox): o que ele faz é verificado por UAT manual com o `permission-hook.js` real alimentado por `stdin`, sem tocar em `~/.claude/settings.json`.

**Primary recommendation:** primeiro a função pura `acceptDecision` com o fixture de vetores (falhando), depois religar o handler `island:decide` para usá-la; eco, `decidedId` e `refresh()` entram **no mesmo commit atômico** que o renderer passa a enviar o eco (senão o gate recusa tudo entre os commits).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Decidir qual pedido está "na tela" (`shown`) | Processo principal (`main.js` + `state.js` puro) | — | Fronteira de confiança: renderer nunca escolhe o alvo (I1/I2) |
| Regra de aceite da decisão | `state.js` (puro) | `main.js` (reúne fatos, executa veredito) | Testável sem Electron; portável para Rust (I10) |
| "Primeiro clique vence" (duas ilhas) | Processo principal | — | Só o main enxerga as duas janelas; ipcMain é síncrono, sem intercalação entre checar e marcar |
| Armamento por tempo (0,8 s) | Processo principal | Renderer (espelha para UX) | Autoridade no main; renderer só adiciona recusas |
| Armamento por animação assentada + cursor parado | Renderer | — | Só o renderer vê o layout e o ponteiro; só pode **recusar**, nunca conceder |
| Press/release no mesmo botão e mesmo pedido | Renderer | main (eco do `pressedId`) | Gesto é do DOM; o eco leva a prova ao main |
| Guarda da inércia da roda / "lido até o fim" | Renderer | — | Estado de rolagem é do DOM; main não consegue verificar (limitação aceita, ver A3) |
| Visibilidade / fora da área / tela cheia | Processo principal | `window.js`/sonda (Fase 4) | Só o main conhece `isVisible()`, bounds e display |
| `webPreferences` seguras, canais IPC fechados | Processo principal + preload | — | Superfície de ataque do renderer |
| Aviso de licença do mod | Repositório (doc na raiz) | — | MIT exige o aviso em cópias/partes substanciais |

## Mapa do fluxo atual (ponta a ponta, com referências)

```
Claude Code ──PermissionRequest──▶ permission-hook.js (stdin JSON)
  permission-hook.js:117-126   lê stdin, chama waitForDecision
  :44-48                       sessionId sanitizado; exige batimento fresco; permissionRequest(input) ou sai calado
  :50                          id = crypto.randomUUID()
  :56-63                       grava ~/.claude/island/<session>.json {state:'waiting', permission:{id,tool,text}, updatedAt}
  :76-114                      poll 250 ms: decisions/<id>.json → decisionOutput → stdout; senão espera até PERMISSION_WAIT_MS

main.js setInterval (400 ms)   main.js:278-291
  readSessions → pickState(…)  → serialized === lastSent ? return          (:279-282)
  permissionId !== shownPermissionId ? shownPermissionId=…; shownPermissionSince=Date.now()   (:285-289)
  for each island: sendState → webContents.send('island:state', lastPickedState, isFirstIsland)  (:149-152, :290)

renderer (index.html)
  onState (:325-334)           current = next; se id novo: setTimeout(800) → armedPermissionId = id; render()
  render() (:251-293)          botões: disabled = locked || !wasRead ; locked = id !== armedPermissionId || id === answeredPermissionId
  click (:296-303)             answeredPermissionId = id; window.island.decide(behavior)   ← sem eco
  preload.js:7                 ipcRenderer.send('island:decide', behavior)

main.js island:decide (:250-260)
  remetente é uma das ilhas?  → shownPermissionId && decisionOutput(behavior)? → Date.now()-shownPermissionSince < PERMISSION_ARM_MS? → writeDecision(shownPermissionId, behavior)
  writeDecision (:97-104)      temp + rename em decisions/<id>.json   → o hook lê, apaga, imprime a decisão
```

### Todos os lugares onde o pedido exibido pode mudar

| Variável | Onde muda | Gatilho |
|----------|-----------|---------|
| `shownPermissionId` / `shownPermissionSince` | `main.js:286-289` (único ponto de escrita, dentro do `setInterval`) | poll vê id diferente de `shownPermissionId` (inclui `null`) |
| `lastPickedState`, `shownWindowPid` | `main.js:283-284` | poll vê estado serializado diferente |
| `current` (renderer) | `index.html:328` | chega `island:state` |
| `armedPermissionId` | `index.html:331` (timer de 800 ms), **nunca volta a `null`** | id novo |
| `answeredPermissionId` | `index.html:298` | clique em Permitir/Negar |
| `readPermissionId` | `index.html:286` | rolagem chega ao fim (tolerância 2 px) |

Observação: `pickState` escolhe a sessão `waiting` mais recente (`state.js:160`); um pedido B posterior **substitui na tela** o A que o usuário lia. Isso é a Fase 5 (SESS-05, fila "1 de N"). Na Fase 2 só se garante segurança: a troca rearma e o eco recusa o clique dado em A.

### Estado de cada invariante hoje

| Inv. | Requisito | Hoje | Gap |
|------|-----------|------|-----|
| I1 | SEG-01 | Alvo = `shownPermissionId` do main (`main.js:256`) | **Sem eco** (`preload.js:7`) |
| I2 | SEG-02 | Uma só escrita (`main.js:286-289`), mas anônima e sem `refresh()` | Funil nomeado + reducer testável; early return `serialized === lastSent` (`:281`) pularia qualquer rearme que não mude o estado |
| I3 | SEG-02/03 | Main rearma só por id novo; renderer só por id novo e nunca desarma | Rearmar em re-exibição/layout; armar por estado assentado + opacidade + dwell |
| I4 | SEG-04 | Clique nativo entre botões distintos já não gera `click` no botão `[ASSUMED]`; sem checagem entre pedidos | `pressedId` + **`decidedId` no main** (duas ilhas sobrescrevem a decisão hoje) |
| I5 | SEG-03/05 | Hover de botão só muda `filter: brightness(1.15)` (`index.html:166`), sem `transform`; não há transparência ainda | Guarda para Fase 3/4: arme exige `opacity === 1`; `effectiveOpacity` pura |
| I6 | SEG-05 | Sem troca de sessão por roda ainda; `readPermissionId` é por id (zera por pedido) | **Inércia** pós-troca pode marcar "lido" um texto novo (`index.html:279-286`) |
| I7 | — | `render()` troca texto e id a partir do mesmo `current` (um turno de evento) | nada |
| I8 | SEG-06 | Sem esconder; sem checagem de visibilidade/área | regra pura + `show` rearma; sonda de tela cheia só na Fase 4 |
| I9 | SEG-08 | Nenhum canal de preferência (ver abaixo) | Teste de lista fechada de canais |
| I10 | SEG-07 | — | Fixture JSON |

## Standard Stack

Sem dependência nova (restrição do projeto e desta fase).

| Item | Versão | Uso | Fonte |
|------|--------|-----|-------|
| Electron | 45.4.1 | base; `webPreferences`, `ipcMain`, eventos `show`/`hide` da `BrowserWindow` | `[VERIFIED: node_modules/electron/package.json]` `45.4.1` |
| Node (máquina de desenvolvimento) | v26.4.0 | `node --test` | `[VERIFIED: node --version]` |
| `node:test` + `node:assert/strict` | embutido | suíte do gate | `[VERIFIED: island.test.js:1-2]` |

**Package Legitimacy Audit:** não se aplica: a fase não instala pacote externo. Packages removidos por SLOP: nenhum. SUS: nenhum.

**Instalação:** nenhuma. `pnpm test` = `node --test` (`package.json`, script `test`) `[VERIFIED: package.json]`.

## Architecture Patterns

### Estrutura recomendada (arquivos tocados)

```
state.js                          # + acceptDecision, nextShownPermission, isWithinWorkArea, effectiveOpacity,
                                  #   SECURE_WEB_PREFERENCES, WHEEL_SETTLE_MS, PRESS_DWELL_MS, ACCEPT_REASONS
fixtures/permission-vectors.json  # NOVO: vetores de acceptDecision (e do reducer), JSON puro
gate.test.js                      # NOVO: suíte do gate (vetores + reducer + área + lista de canais + webPreferences)
main.js                           # refresh(reason); island:decide fino; decidedPermissionId; show/hide rearmam; webPreferences
preload.js                        # decide(behavior, pressedId); (opcional) trava se !process.sandboxed
index.html                        # armamento por epoch; press/release; guarda de roda; settle probe; dwell
THIRD_PARTY_NOTICES.md            # NOVO (CONV-04), raiz do repositório
```

### Pattern 1: função pura `acceptDecision` (SEG-01, 03, 04, 06, 07)

**O que é:** o `main` reúne fatos e entrega a uma função que devolve veredito + motivo. O handler vira "reunir, perguntar, executar".
**Assinatura recomendada (plana, para o JSON portar sem adaptação):**

```js
// state.js — esboço; nomes finais são do executor
/**
 * Regra de aceite de uma decisão vinda do renderer. Devolve { accept: true, permissionId, behavior }
 * ou { accept: false, reason }. A ordem das checagens faz parte do contrato: os vetores de
 * fixtures/permission-vectors.json fixam qual motivo vence quando várias falham.
 */
function acceptDecision({ behavior, echoedId, shownId, shownSince, now, decidedId,
                          windowVisible, coveredByFullscreen, withinVisibleArea }) {
  if (decisionOutput(behavior) === null) return refuse('invalid-behavior');
  if (typeof shownId !== 'string' || shownId === '') return refuse('nothing-shown');
  if (echoedId !== shownId) return refuse('echo-mismatch');        // ausente, outro tipo, outro id, caixa diferente
  if (decidedId === shownId) return refuse('already-decided');     // primeiro clique vence
  if (windowVisible !== true) return refuse('window-hidden');      // só `true` exato vale
  if (coveredByFullscreen !== false) return refuse('covered-by-fullscreen');
  if (withinVisibleArea !== true) return refuse('outside-visible-area');
  if (!Number.isFinite(now) || !Number.isFinite(shownSince) || now - shownSince < PERMISSION_ARM_MS) {
    return refuse('not-armed');                                    // inclui relógio andando para trás
  }
  return { accept: true, permissionId: shownId, behavior };        // o alvo é shownId, nunca o eco
}
```

- **Fail-safe:** campo ausente recusa (`=== true` / `=== false` estritos). Ausência de eco recusa.
- O alvo retornado é `shownId`; o eco só serve para recusar.
- `PERMISSION_ARM_MS` já existe `[VERIFIED: state.js:16]` `const PERMISSION_ARM_MS = 800;` e já é exportado. O limite exato (`800` aceita, `799` recusa) deve ter vetor.
- Reutiliza `decisionOutput` `[VERIFIED: state.js:117-121]` para validar `behavior` (reuso, degrau 2 do ladder).
- Relógio: recomendar `performance.now()` (monotônico) no main para `shownSince` e `now`, em vez de `Date.now()` (que salta com NTP/suspensão). `[ASSUMED]` que `performance` global existe no main do Electron 45 (Node 24): é global desde Node 16; confirmar com uma linha no plano. A função não muda: recebe números.

### Pattern 2: reducer puro `nextShownPermission` + funil `refresh(reason)` (SEG-02)

```js
// state.js — esboço
/** `shown` = { id, since, epoch }. `epoch` sobe a cada evento que exige reiniciar o armamento. */
function nextShownPermission(shown, permissionId, now, rearm = false) {
  if (permissionId === shown.id && !rearm) return shown;           // mesma referência: nada mudou
  return { id: permissionId, since: now, epoch: shown.epoch + 1 };
}
```

- No main, `shown` é **uma** variável (`let shown = { id: null, since: 0, epoch: 0 }`) atribuída em **um** lugar: `refresh(reason)`. Motivos: `'poll'` (a cada 400 ms) e `'rearm'` (evento `show` da janela, `display-metrics-changed` com pedido na tela).
- O rearme **não** pode passar pelo `if (serialized === lastSent) return` (`main.js:281`), que descarta tudo que não muda o estado serializado. Separar: "o estado mudou?" e "o `shown` mudou?"; enviar `island:state` se qualquer um mudou.
- O payload de `island:state` ganha `armEpoch: shown.epoch` e `answeredId: decidedPermissionId`. O renderer reinicia o armamento quando `armEpoch` muda (cobre id novo **e** reexibição com o mesmo mecanismo) e trava os botões quando `answeredId === permission.id` (a **outra** ilha trava logo, em vez de só depois do poll do hook).
- Critério 1 do roadmap ("um único caminho") fica provado por: reducer testado + um teste de fonte opcional que conta atribuições a `shown =` em `main.js` (frágil por ser regex; é a forma barata de o CI barrar um segundo caminho).

### Pattern 3: handler `island:decide` fino

```js
// main.js — esboço
ipcMain.on('island:decide', (event, behavior, pressedId) => {
  const island = islandOf(event);
  if (!island || ![...islands.values()].includes(island)) return;
  const display = displayOf(island);
  const verdict = acceptDecision({
    behavior, echoedId: pressedId, shownId: shown.id, shownSince: shown.since, now: performance.now(),
    decidedId: decidedPermissionId,
    windowVisible: island.isVisible() && !island.isMinimized(),
    coveredByFullscreen: false,   // ponytail: sem sonda até a Fase 4 (TELA-01); a entrada já existe no contrato
    withinVisibleArea: Boolean(display) && isWithinWorkArea(island.getBounds(), display.workArea, HORIZONTAL_SLACK),
  });
  if (!verdict.accept) return;
  try {
    writeDecision(verdict.permissionId, verdict.behavior);
    decidedPermissionId = verdict.permissionId;       // só depois de gravar: se falhar, o usuário pode tentar de novo
    for (const each of islands.values()) sendState(each);
  } catch (error) { console.error('Não foi possível gravar a decisão do pedido de permissão:', error.message); }
});
```

- **Atomicidade do "primeiro vence":** `ipcMain.on` roda no event loop único do main; checar `decidedId` e marcá-lo no mesmo turno síncrono não tem intercalação entre as duas ilhas. `[ASSUMED]` (modelo de execução de Node/Electron, sem fonte citada).
- `shown.id`/`shown.since` lidos no instante da chegada do IPC: é o que torna "pedido mudou no instante do clique" decidível (eco ≠ `shown.id` → recusa).

### Pattern 4: eco = id capturado no `pointerdown` (renderer)

O eco enviado é o id do pedido **que estava na tela quando o gesto começou**, não o do `click`. Assim o main recusa também o gesto que atravessa uma troca. No renderer, o `click` só dispara `decide` se houve `pointerdown` válido no mesmo botão e `current.permission.id === pressedId`.

```js
// index.html — esboço
let press = null; // { button, id }
for (const [button, behavior] of [[allowButton, 'allow'], [denyButton, 'deny']]) {
  button.addEventListener('pointerdown', (event) => {
    press = canPress(button) ? { button, id: current.permission.id } : null;   // armado + assentado + dwell + opaco
    if (!press) event.preventDefault();
  });
  button.addEventListener('click', () => {
    const pressed = press; press = null;
    if (!pressed || pressed.button !== button || !current.permission || pressed.id !== current.permission.id) return;
    answeredPermissionId = pressed.id;
    window.island.decide(behavior, pressed.id);
    render();
  });
}
```

- Clique sem `pointerdown` (teclado, `element.click()`) é descartado. A janela é `focusable: false` (`main.js:163`), então Tab/Enter não chegam nela; o descarte é só cinto e suspensório (ver A4).
- Armar (`canPress`) exige, **todos**: `armEpoch` atual já armado; `getComputedStyle(pill).opacity === '1'`; rect de `#actions` estável por ~100 ms (comparar `getBoundingClientRect` em `requestAnimationFrame` sucessivos: vale para transição CSS **e** para as molas JS da Fase 3, sem acoplar a nenhuma); dwell: `performance.now() - max(últimoMovimentoSobreBotão, instanteEmQueArmou) >= 200` (SUMMARY I3 pede 150-300 ms; 200 ms).
- Re-desarmar (sem `null`-forever como hoje): a cada mudança de `armEpoch`, `ResizeObserver` em `#actions`/`#pill` ao mudar de tamanho, `document.visibilitychange` para hidden. Um contador de geração (`armToken++`) invalida timers antigos.

### Pattern 5: guarda de roda e "lido" (SEG-05)

```js
// index.html — esboço
const WHEEL_SETTLE_MS = 400;          // espelhar o valor exportado de state.js: o renderer não importa state.js
let contentChangedAt = performance.now();   // atualizado em toda troca de id/epoch/texto
permissionText.addEventListener('wheel', (event) => {
  event.stopPropagation();                                   // pré-requisito da Fase 5: a roda do texto nunca vira troca de sessão
  if (performance.now() - contentChangedAt < WHEEL_SETTLE_MS) event.preventDefault();   // inércia do touchpad
}, { passive: false });
```

- Além de bloquear a roda, `render()` só pode gravar `readPermissionId` quando `performance.now() - contentChangedAt >= WHEEL_SETTLE_MS`; agendar um `render()` ao fim da janela (texto curto que cabe inteiro não pode ficar sem "lido").
- CSS: `overscroll-behavior: contain` em `#permission-text` (a rolagem não encadeia para fora).
- Erro a evitar: bloquear a roda no capture do `document` (listener passivo por padrão em alvos de topo, `preventDefault` ignorado). Registrar no próprio elemento com `{ passive: false }`. `[ASSUMED]` (comportamento de Chromium, conhecimento de treino; verificar na UAT).

### Anti-Patterns a evitar

- **Duas fontes da verdade para "o que está na tela":** o renderer pode manter `current` só para pintar; qualquer decisão de alvo/tempo usa `shown` do main.
- **Aceitar eco ausente** "por compatibilidade": recusar. Quebra visível é melhor que gate frouxo.
- **Marcar `decidedPermissionId` antes de gravar:** se `writeDecision` falhar, o usuário fica sem poder tentar de novo e o terminal é o único caminho.
- **Teste de fonte como única prova:** regex em `main.js` não prova comportamento; serve só de trava de regressão (ver Validation).

## Don't Hand-Roll

| Problema | Não construir | Usar | Por quê |
|----------|---------------|------|---------|
| Validar `behavior` | comparação nova | `decisionOutput` (`state.js:117-121`) | já tem teste e contrato |
| Validar id de pedido | regex nova | `UUID_PATTERN` / `validPermission` (`state.js:72`, `:105-111`) | o `shownId` já chega validado; o eco só precisa de igualdade estrita |
| Escrita atômica | outra forma | padrão temp+rename de `writeDecision` (`main.js:97-104`) | convenção do projeto |
| "Animação assentou" | contagem de `transitionend` por propriedade | comparação de `getBoundingClientRect` em rAFs sucessivos | independe de CSS/JS e da Fase 3 |
| Harness de UAT do gate | script novo que finge hook | o próprio `permission-hook.js` alimentado por `stdin` | é o caminho real e já existe (ver UAT) |
| Cliente de vetores para Rust | nada agora | só o JSON | Fase 3.1 é condicional; o JSON é o ativo portável |

**Insight:** a regra mais perigosa (aprovar o que o usuário não viu) é pequena e determinística. Extraí-la numa função pura com vetores custa menos que qualquer teste de integração com Electron, e é o único artefato que sobrevive a uma troca de base.

## Common Pitfalls

### Pitfall 1: quebrar o app entre commits (eco obrigatório antes de o renderer enviá-lo)
**O que dá errado:** se o main passa a exigir eco num commit e o renderer/preload só o enviam no seguinte, toda decisão é recusada e o usuário fica só com o terminal.
**Como evitar:** mudar `state.js` (puro) + testes primeiro (não afeta runtime); **`main.js` + `preload.js` + `index.html` do eco no mesmo plano/commit**.
**Sinal:** UAT com `permission-hook.js` nunca imprime a decisão.

### Pitfall 2: o rearme é engolido pelo `serialized === lastSent`
**O que dá errado:** reexibir a janela com o mesmo pedido não muda `lastPickedState`; o `return` antecipado (`main.js:281`) impede `refresh()` de rearmar.
**Como evitar:** separar "estado mudou" de "`shown` mudou" e enviar se qualquer um mudou; vetor/teste do reducer com `rearm = true`.

### Pitfall 3: duas ilhas, dois cliques, duas decisões
**O que dá errado:** hoje cada ilha tem o seu `answeredPermissionId`; clicar Permitir na ilha 1 e Negar na ilha 2 antes de o hook retirar o pedido (até ~650 ms: poll do hook 250 ms + poll do main 400 ms) grava dois arquivos de decisão, o segundo por cima do primeiro; o hook lê o que estiver lá.
**Como evitar:** `decidedPermissionId` no main (recusa a segunda) + `answeredId` no payload para travar a outra ilha. `[VERIFIED: main.js:250-260 sem guarda de "já decidido"]`.

### Pitfall 4: inércia da roda marca "lido"
**O que dá errado:** pedido novo substitui o antigo, `scrollTop` volta a 0 só se o **texto** mudou (`index.html:279-282`), e a inércia ainda rola o texto novo até o fim em ~300 ms; `render()` marca `readPermissionId` (`:286`) e o "Permitir" libera sem leitura.
**Como evitar:** Pattern 5 (bloquear a roda e a marcação por 400 ms desde `contentChangedAt`).

### Pitfall 5: `armedPermissionId` nunca desarma
**O que dá errado:** depois de armado para X, qualquer reexpansão/reexibição/troca de layout mantém o botão vivo (`index.html:247`, `:290`).
**Como evitar:** armar por `armEpoch` e desarmar em epoch novo, `ResizeObserver`, `visibilitychange`.

### Pitfall 6: tolerância de DPI e "dentro da área" falso-negativo
**O que dá errado:** `getBounds()` arredonda com escala 125% (STATE: Fase 4 já lista isso como pesquisa pendente); uma checagem de área exata recusaria decisões legítimas.
**Como evitar:** `isWithinWorkArea` com folga de 2 px além do `HORIZONTAL_SLACK` que o `clampIslandPosition` já usa (`main.js:16`). Recusar por engano é seguro (o terminal vale), mas não pode ser permanente.

### Pitfall 7: `Date.now()` como relógio do gate
**O que dá errado:** relógio andando para trás (NTP, suspensão) dá `now - since` negativo; para a frente, arma antes da hora.
**Como evitar:** `performance.now()` no main; a função recusa se o delta for negativo (vetor).

### Pitfall 8: renderer sob CSP não pode importar `state.js`
**O que dá errado:** tentar `require('./state')` ou `<script src>` quebra: a CSP é `default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'` `[VERIFIED: index.html:5]` e o renderer está em sandbox.
**Como evitar:** constantes do renderer (800, 400, 200) duplicadas com comentário apontando `state.js`, como já é feito com `PERMISSION_ARM_MS` (`index.html:241-244`). Não mexer na CSP nesta fase (a Fase 3 trata `spring.js`).

### Pitfall 9: teste que carrega `main.js`
`require('electron')` em Node puro devolve o caminho do executável; desestruturar `app`/`BrowserWindow` dá `undefined` e o módulo falha ao ser carregado. Nada do gate deve ser testado importando `main.js`: toda regra vai para `state.js`.

### Pitfall 10: fixture com `undefined`
JSON não tem `undefined`. "Eco ausente" = **omitir a chave** `echoedId` no objeto de entrada do vetor; a função deve tratar chave ausente igual a `undefined` (já trata: `undefined !== shownId`). Em Rust vira `Option::None`.

## Decisões de desenho para o fixture (`fixtures/permission-vectors.json`)

Estrutura: um arquivo, chaves de topo por função, para a Fase 3.1 (Rust) acrescentar grupos sem quebrar leitores:

```json
{
  "version": 1,
  "armMs": 800,
  "acceptReasons": ["invalid-behavior", "nothing-shown", "echo-mismatch", "already-decided",
                    "window-hidden", "covered-by-fullscreen", "outside-visible-area", "not-armed"],
  "acceptDecision": [
    { "name": "aceita: eco igual, 800 ms exatos",
      "input": { "behavior": "allow", "echoedId": "3f2b8c1e-9d4a-4b6f-8a1c-2e5d7f9b0c3a",
                 "shownId": "3f2b8c1e-9d4a-4b6f-8a1c-2e5d7f9b0c3a", "shownSince": 1000, "now": 1800,
                 "decidedId": null, "windowVisible": true, "coveredByFullscreen": false, "withinVisibleArea": true },
      "expect": { "accept": true } },
    { "name": "recusa: 799 ms", "input": { "...": "idem, now: 1799" }, "expect": { "accept": false, "reason": "not-armed" } }
  ]
}
```

- Tempos como inteiros (ms), ids em minúsculas (como `UUID_PATTERN`), sem `undefined`, sem funções, sem datas: tudo que Rust (`serde_json`) lê direto.
- `armMs` no fixture é contrato: um teste afirma `PERMISSION_ARM_MS === fixture.armMs` (uma porta que mude o valor sem mudar o fixture quebra).
- Vetores obrigatórios (mínimo): aceita (caminho feliz, `deny` também); `invalid-behavior` (`'ALLOW'`, `'allow '`, `null`, objeto); `nothing-shown` (`shownId` `null`/ausente); `echo-mismatch` (outro UUID, **maiúsculas**, ausente, número, `null`); `already-decided` (mesmo id); `window-hidden` / `covered-by-fullscreen` / `outside-visible-area` (cada um e **campo ausente**); `not-armed` em 0, 799, **800 aceita**, 801, `now < shownSince`, `NaN`-equivalente (campo ausente); **precedência** (várias falhas → vence a primeira da ordem); "pedido mudou no instante do clique" (eco = A, `shownId` = B → `echo-mismatch` mesmo com 10 s decorridos); "pedido novo logo após o clique" (eco = B, `shownSince` há 100 ms → `not-armed`); "duas ilhas" (`decidedId` = `shownId`).
- O reducer ganha grupo próprio (`nextShownPermission`: id novo reinicia `since` e sobe `epoch`; mesmo id devolve igual; `rearm` reinicia; id → `null`).
- Teste em `gate.test.js`: `for (const vector of vectors.acceptDecision) test(vector.name, …)` e uma checagem de que todo `reason` usado no fixture está em `acceptReasons` (impede motivo digitado errado passar em silêncio).

## SEG-08: `webPreferences` e canais IPC

**Estado atual** `[VERIFIED: main.js:165-168]`:
```js
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      autoplayPolicy: 'no-user-gesture-required', // o aviso sonoro toca sem clique
    },
```
Os padrões da documentação do Electron: `nodeIntegration` "Default is `false`"; `contextIsolation` "Defaults to `true`"; `sandbox` "Default is `true` since Electron 20" e "will automatically be disabled when `nodeIntegration` is set to `true`" `[CITED: electronjs.org/docs/latest/api/structures/web-preferences]`. Logo as janelas **já** rodam isoladas e em sandbox hoje; o requisito é tornar isso explícito e protegido contra regressão (um `nodeIntegration: true` futuro desligaria o sandbox em silêncio).

**Preload sob `sandbox: true` funciona:** `preload.js` só faz `require('electron')` e usa `contextBridge` e `ipcRenderer` `[VERIFIED: preload.js:1-3]`. Um preload em sandbox só pode carregar o módulo `electron`, com `contextBridge`, `crashReporter`, `ipcRenderer`, `nativeImage`, `webFrame` e `webUtils` `[CITED: electronjs.org/docs/latest/tutorial/sandbox]`. Nenhuma mudança de comportamento esperada; a UAT confirma subindo a ilha e vendo o estado chegar.

**Recomendação:**
- `SECURE_WEB_PREFERENCES = { contextIsolation: true, sandbox: true, nodeIntegration: false }` exportada de `state.js` e espalhada em `main.js` (`webPreferences: { ...SECURE_WEB_PREFERENCES, preload, autoplayPolicy }`), com teste de igualdade do objeto. Limite conhecido: não impede quem sobrescrever depois do spread; por isso mais o teste de fonte abaixo.
- Teste de lista fechada de canais: ler `preload.js` e afirmar que o conjunto de canais `ipcRenderer.send('…')`/`on('…')` é exatamente `{island:state, island:hover, island:focus, island:decide, island:drag, island:drag-end, island:reset-position}`; ler `main.js` e afirmar o mesmo conjunto em `ipcMain.on('…')`. Qualquer canal novo (inclusive um futuro `island:set-pref`) exige editar o teste de propósito: é a trava de I9 para as Fases 4-5. Frágil por ser regex; barato.
- Opcional (um linha, só defesa): `if (!process.sandboxed || !process.contextIsolated) throw …` no topo do `preload.js` (fecha em falha: sem API, sem botões). `process.sandboxed`/`process.contextIsolated` existem na documentação de `process` `[CITED: electronjs.org/docs/latest/api/process]`, mas a doc não confirma que o `process` reduzido do preload em sandbox os expõe: **`[ASSUMED]`; validar na UAT antes de manter**, e remover se `process.sandboxed` vier `undefined` em sandbox.

**Canais que gravam algo hoje:** `island:drag-end` e `island:reset-position` persistem `positions.json`; mas o que se grava é calculado **no main** a partir de `island.getBounds()` e do `defaultIslandPosition` (`main.js:222-239`), e o deslocamento do `island:drag` só entra após `Number.isFinite` e `clampIslandPosition` (`:213-220`). Nenhum canal carrega um valor que o main grave literalmente. Conclusão para o plano: **não há canal de preferência a remover**; SEG-08 fica satisfeito pela trava de lista fechada + documentar que posição de janela não é "preferência do renderer". A Fase 4 introduz as preferências reais sob o menu nativo.
Hardening opcional de custo mínimo: `island.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))` e negar `will-navigate` (o renderer só carrega `index.html`); fora do escopo estrito.
`onState` retorna o resultado de `ipcRenderer.on` pela ponte; a documentação do Electron indica que `ipcRenderer` não atravessa mais o `contextBridge` `[CITED: electronjs.org (api/ipc-renderer, relato de WebSearch)]`: sem ação, e ninguém usa o retorno.

## CONV-04: aviso de licença do mod

**Conferido** (leitura de `LICENSE` do repositório do autor via `gh api repos/devcode90/Dynamic-Island-for-Windows/license`, repositório público, sha do blob `30ee69c1c1d2c6804f4e845e303f59d4ef1a96e6`, branch `main`):

```
MIT License

Copyright (c) 2026 devcode90

Permission is hereby granted, free of charge, to any person obtaining a copy
… (corpo MIT padrão, idêntico ao do `LICENSE` deste repositório exceto a linha de copyright) …
```
`[VERIFIED: gh api repos/devcode90/Dynamic-Island-for-Windows/license]` A diferença entre o corpo MIT do mod e o do nosso `LICENSE` foi checada por `diff` e é **somente** a linha do titular (`devcode90` × `Marcelo Oliveira`). O texto completo para copiar é o do `LICENSE` do mod; o executor deve **reler da fonte** (`gh api repos/devcode90/Dynamic-Island-for-Windows/license --jq .content | base64 -d`) e colar verbatim, não digitar.

Outros fatos conferidos:
- Cabeçalho do mod (`C:\ProgramData\Windhawk\ModsSource\dynamic-island-for-windows.wh.cpp`, local): `@name Dynamic Island for Windows`, `@version 1.4.0`, `@author Himanshu`, `@github https://github.com/devcode90`, `@license MIT` `[VERIFIED: leitura do arquivo, linhas 2-11]`. O cabeçalho não traz linha de copyright (por isso o `LICENSE` do repositório era necessário).
- `CHANGELOG.md` do repositório do autor: `## [1.4.0] — 2026-10-20` `[VERIFIED: gh api …/contents/CHANGELOG.md]`.
- Perfil do autor no GitHub: login `devcode90`, nome de exibição `Himanshu{.exe}` `[VERIFIED: gh api users/devcode90]`.
- O titular **formal** no `LICENSE` é só `devcode90`. Há contribuidores creditados na seção Credits do README/cabeçalho (Sarthak Singh, ciizerr, ChrisSch-dev, thevioletto, David Ravelo, Retr0dev-jpg) `[VERIFIED: leitura do .wh.cpp, linhas 99-106]`, mas o `LICENSE` não os nomeia como titulares. **Não inventar** "e colaboradores" na linha de copyright: copiar `Copyright (c) 2026 devcode90` verbatim e acrescentar, em linha **separada**, o autor (`Himanshu`, `github.com/devcode90`) e a observação de que contribuições de terceiros estão creditadas no repositório do mod.

**Paleta Nord (usada na Fase 3):** o mod tem um tema "Nord" com `#2E3440 / #ECEFF4 / #3B4252` (`WINDHAWK-MOD.md:66`). O repositório Nord (`nordtheme/nord`) é MIT: `Copyright (c) 2016-present Sven Greb <development@svengreb.de> (https://www.svengreb.de)` `[VERIFIED: gh api repos/nordtheme/nord/license]`. Que os três hex são da paleta Nord é `[ASSUMED]` (conhecimento de treino). Recomendação: uma seção "Nord" no mesmo `THIRD_PARTY_NOTICES.md` com a linha acima, para a Fase 3 não precisar voltar ao arquivo.

**Conteúdo recomendado de `THIRD_PARTY_NOTICES.md`:** cabeçalho (nome do mod, versão `1.4.0`, URL do repositório, `@license MIT`); o que foi tomado (valores/comportamento reescritos em JS: molas, temas, tamanhos; nenhum trecho de C++ traduzido); a linha `Copyright (c) 2026 devcode90` + texto MIT completo; seção Nord; nota de fontes (Segoe UI Variable e Segoe Fluent Icons **não** são embarcadas; `font-family` do sistema) e de marca ("Dynamic Island" é descrição de comportamento, o produto é "Claude Island").
**Ordem:** o arquivo precisa ser commitado antes de qualquer commit de **código** com constantes portadas (Fase 3). Observação: `.planning/research/WINDHAWK-MOD.md` já traz as constantes (commit `035d377`), é análise e não código; criar o aviso cedo nesta fase cobre isso também. Verificação de ordem na Fase 3: `git log --diff-filter=A --format=%h -- THIRD_PARTY_NOTICES.md` mais antigo que o primeiro commit que adiciona as constantes. Opcional: link no `README.md`.
Teste barato (`gate.test.js` ou verificação de plano): o arquivo contém `Copyright (c) 2026 devcode90`, `1.4.0` e `Permission is hereby granted`.

## Environment Availability

| Dependência | Necessária para | Disponível | Versão | Fallback |
|-------------|-----------------|------------|--------|----------|
| Node | `node --test`, hooks | ✓ | v26.4.0 | — |
| `pnpm test` | suíte (`node --test`) | n/c (usar `node --test` direto) | — | `node --test` |
| `gh` (leitura pública) | conferir LICENSE do mod | ✓ | — | `curl` em `raw.githubusercontent.com` |
| Electron | UAT do renderer | ✓ instalado (45.4.1) | 45.4.1 | — |
| Ilha em execução | UAT | **Não iniciar durante a pesquisa** (outra sessão mede) | — | UAT só na fase de verificação |
| 2 monitores | UAT "duas ilhas" | no hardware do autor (ROADMAP cita 2 monitores) | — | cenário marcado como manual |

Baseline: `node --test` hoje passa **13 testes, 0 falhas** `[VERIFIED: execução nesta sessão]` (as 9 do CLAUDE.md estão desatualizadas).

## Validation Architecture

### Test Framework
| Propriedade | Valor |
|-------------|-------|
| Framework | `node:test` + `node:assert/strict` (embutidos; Node v26.4.0 aqui) |
| Config | nenhuma (`node --test` descobre `*.test.js`) |
| Comando rápido | `node --test gate.test.js` |
| Suíte completa | `pnpm test` (= `node --test`) |

`gate.test.js` novo (em vez de inflar `island.test.js`): permite a regra do ROADMAP "rodar a suíte do gate antes de fechar fase" com um comando curto, e `pnpm test` roda tudo. Decisão de discrição, desvio pequeno da convenção "um só arquivo de teste".

### Phase Requirements → Test Map
| Req | Comportamento | Tipo | Comando automatizado | Existe? |
|-----|---------------|------|----------------------|---------|
| SEG-01 | eco ausente/divergente/maiúsculo recusa; alvo é `shownId`; "pedido mudou no clique" | unit (vetores) | `node --test gate.test.js` | ❌ Wave 0 |
| SEG-01 | `preload.js` repassa o eco (aridade de `decide`) | UAT + revisão | manual | manual |
| SEG-02 | reducer: id novo/`rearm` reinicia `since` e sobe `epoch`; mesmo id estável | unit | `node --test gate.test.js` | ❌ Wave 0 |
| SEG-02 | caminho único (`shown =` só em `refresh`) | teste de fonte (frágil, opcional) | `node --test gate.test.js` | ❌ Wave 0 |
| SEG-03 | limite 799/800/801 ms; relógio para trás | unit (vetores) | `node --test gate.test.js` | ❌ Wave 0 |
| SEG-03 | armar só com layout assentado + cursor parado + sem escala de hover | **manual (UAT-2)** | manual | manual |
| SEG-04 | segunda decisão para o mesmo id recusada (`already-decided`) | unit (vetores) | `node --test gate.test.js` | ❌ Wave 0 |
| SEG-04 | press/release; duas ilhas reais | **manual (UAT-3, UAT-4)** | manual | manual |
| SEG-05 | `effectiveOpacity(p, true) === 1` para qualquer `p` | unit | `node --test gate.test.js` | ❌ Wave 0 |
| SEG-05 | roda só no texto; inércia ignorada 400 ms; "lido" zera por pedido | **manual (UAT-5)** | manual | manual |
| SEG-06 | `window-hidden`/`covered`/`outside` recusam; campo ausente recusa; `isWithinWorkArea` (dentro, fora, tolerância de 2 px) | unit | `node --test gate.test.js` | ❌ Wave 0 |
| SEG-06 | `show` rearma; esconder real | **adiado à Fase 4** (não há UI de esconder) + revisão de código | — | manual |
| SEG-07 | fixture carrega, motivos válidos, `armMs` = `PERMISSION_ARM_MS` | unit | `node --test gate.test.js` | ❌ Wave 0 |
| SEG-08 | `SECURE_WEB_PREFERENCES` exato; lista fechada de canais em `preload.js` e `main.js` | unit + teste de fonte | `node --test gate.test.js` | ❌ Wave 0 |
| SEG-08 | ilha sobe e recebe estado sob `sandbox: true` explícito | **manual (UAT-1)** | manual | manual |
| CONV-04 | arquivo existe com titular, versão e texto MIT | unit/grep | `node --test gate.test.js` | ❌ Wave 0 |

### UAT manual (batida no fim da fase: `human_verify_mode: end-of-phase`)

Harness: **o `permission-hook.js` real por `stdin`**, sem tocar em `~/.claude/settings.json` (`[VERIFIED: permission-hook.js:117-126]` lê JSON do `stdin`; `permissionRequest` exige `tool_name` e `tool_input`; exige batimento fresco, ou seja, ilha rodando):

```bash
echo '{"session_id":"uat-a","hook_event_name":"PermissionRequest","tool_name":"Bash","tool_input":{"command":"echo A"},"cwd":"."}' | node permission-hook.js
```
Imprime o JSON da decisão no `stdout` só quando se clica; se nada aparecer em 5 min, saiu calado (comportamento normal). Usar `session_id` distintos (`uat-a`, `uat-b`) para dois pedidos.

- **UAT-1 (sandbox/preload):** subir a ilha com `webPreferences` explícitas; o estado aparece; um pedido aparece e responde. Se a trava `process.sandboxed` for mantida, confirmar que a ilha ainda sobe.
- **UAT-2 (armamento):** com pedido na tela, mover o cursor para o botão antes de 0,8 s e clicar o mais cedo possível: descartado. Mover o cursor para o botão e clicar em < 200 ms: descartado. Parar 0,3 s e clicar: vale. Passar o mouse sobre os botões: sem ampliação.
- **UAT-3 (pedido muda no clique):** pedido A armado; disparar o pedido B (`uat-b`) e clicar logo: nada vale para A nem B; depois do rearme de B, responde só B.
- **UAT-4 (duas ilhas, 2 monitores):** clicar Permitir numa ilha e Negar na outra em sequência rápida: o `stdout` do hook mostra **uma** decisão (a primeira) e a outra ilha trava os botões.
- **UAT-5 (roda):** rolar rápido com touchpad ao chegar o pedido; "Permitir" não libera sozinho; texto longo exige rolar até o fim; pedido novo volta a exigir.
- **UAT-6 (opacidade):** pedido na tela: pílula 100% opaca (e, quando a Fase 4 existir, a transparência não vale).

### Sampling Rate
- **Por commit:** `node --test gate.test.js`
- **Por merge de wave:** `pnpm test`
- **Gate da fase:** `pnpm test` verde + UAT-1..6 antes de `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `fixtures/permission-vectors.json` — SEG-07 (e base de SEG-01/03/04/06)
- [ ] `gate.test.js` — todos os SEG automatizáveis e CONV-04
- [ ] Funções puras em `state.js` (precondição dos testes): `acceptDecision`, `nextShownPermission`, `isWithinWorkArea`, `effectiveOpacity`, `SECURE_WEB_PREFERENCES`
- [ ] Sem instalação de framework (nada a instalar)

## Security Domain

`security_enforcement` está habilitado e `security_asvs_level: 1` em `.planning/config.json` `[VERIFIED: leitura do arquivo]`; `security_block_on: high`.

### Categorias ASVS aplicáveis

| Categoria ASVS | Aplica | Controle padrão |
|----------------|--------|-----------------|
| V2 Autenticação / V3 Sessão | não | app local, sem login |
| V4 Controle de acesso | sim | remetente do IPC precisa ser uma das janelas (`main.js:251`); alvo da decisão vem do estado do main, nunca do renderer |
| V5 Validação de entrada | sim | `acceptDecision` valida `behavior` (`decisionOutput`), eco (igualdade estrita), tipos; `UUID_PATTERN` no arquivo em disco |
| V6 Criptografia | não | `crypto.randomUUID()` já usado para ids (não é segredo) |
| V14 Configuração | sim | `webPreferences` explícitas (`contextIsolation`, `sandbox`, sem `nodeIntegration`), CSP restritiva já existente |

### Ameaças conhecidas para esta pilha

| Padrão | STRIDE | Mitigação padrão |
|--------|--------|------------------|
| Troca de conteúdo sob o cursor (clickjacking por TOCTOU: pedido muda entre ver e clicar) | Tampering | eco do id do `pointerdown`; armamento por tempo + layout assentado + dwell; rearme em toda troca |
| Dois canais de decisão concorrentes (duas ilhas) | Tampering | `decidedPermissionId` no main; primeiro vence |
| Decisão vinda de janela invisível/fora da área/coberta | Elevation of Privilege | `windowVisible`/`withinVisibleArea`/`coveredByFullscreen` na regra; esconder nunca aprova |
| Texto exibido ≠ comando real (bidi, controle, campos extras do Bash) | Spoofing | já mitigado em `isReadablePermissionText` / `permissionRequest` (`state.js:70-102`); fora do escopo, só não regredir |
| Renderer comprometido envia canal arbitrário | Elevation of Privilege | `contextIsolation` + `sandbox` + lista fechada de canais; renderer só carrega `index.html` local com CSP `default-src 'none'` |
| Arquivo de decisão forjado em `~/.claude/island/decisions` | Tampering | fora do escopo desta fase (mesmo usuário do SO); registrado como limite conhecido |

Modelo de ameaça desta fase: **erro/corrida do usuário e conteúdo trocado**, não renderer malicioso. Por isso evidências do renderer (armado, assentado, dwell, "lido") só podem **recusar**; o main não as confere (limite aceito, A3).

## Code Examples

Ver Patterns 1-5 acima (esboços). Teste-modelo do fixture:

```js
// gate.test.js — esboço
const test = require('node:test');
const assert = require('node:assert/strict');
const vectors = require('./fixtures/permission-vectors.json');
const { acceptDecision, PERMISSION_ARM_MS } = require('./state');

test('o fixture e o código concordam no tempo de armamento', () => {
  assert.equal(PERMISSION_ARM_MS, vectors.armMs);
});

for (const { name, input, expect } of vectors.acceptDecision) {
  test(`acceptDecision: ${name}`, () => {
    const verdict = acceptDecision(input);
    assert.equal(verdict.accept, expect.accept);
    if (!expect.accept) {
      assert.ok(vectors.acceptReasons.includes(expect.reason)); // motivo digitado errado não passa em silêncio
      assert.equal(verdict.reason, expect.reason);
    }
  });
}
```

## State of the Art

| Antigo | Atual | Impacto |
|--------|-------|---------|
| Sandbox opt-in no renderer | Sandbox padrão desde Electron 20 | tornar explícito não muda runtime; protege de regressão `[CITED: web-preferences]` |
| `ipcRenderer` vazando pela ponte | wrapper que repassa só os argumentos; `ipcRenderer` não atravessa `contextBridge` | `preload.js:4` já usa o wrapper correto |

**Obsoleto neste repo:** o "9 tests" do `.claude/CLAUDE.md`; hoje são 13.

## Assumptions Log

| # | Claim | Seção | Risco se errado |
|---|-------|-------|-----------------|
| A1 | `ipcMain.on` roda em turno síncrono único do main, sem intercalar duas ilhas entre checar e marcar `decidedPermissionId` | Pattern 3 | "Primeiro vence" falharia: mitigar gravando `decidedPermissionId` **antes** de qualquer `await` (já é síncrono no esboço) |
| A2 | `performance.now()` é global no main do Electron 45 | Pattern 1 | cair para `process.hrtime.bigint()` convertido, ou manter `Date.now()` com a recusa de delta negativo |
| A3 | "Lido até o fim", armado/assentado/dwell não precisam ser verificados pelo main (só recusam no renderer) | Pattern 4, Security | se o autor quiser defesa também no main: o renderer envia evidência booleana e o main recusa `allow` sem ela (acréscimo ao fixture) |
| A4 | Teclado não alcança a janela (`focusable:false`), então descartar `click` sem `pointerdown` não tira acessibilidade | Pattern 4 | se a ilha ganhar foco de teclado (Fase 4+), reabrir: aceitar teclado com as mesmas guardas |
| A5 | Chromium dispara `click` no ancestral comum (não no botão) quando `pointerdown` e `pointerup` caem em elementos diferentes | Estado das invariantes (I4) | a checagem explícita de `pressed.button === button` cobre mesmo se for falso |
| A6 | `wheel` registrado no próprio elemento com `{ passive: false }` aceita `preventDefault`; em alvos de topo é passivo por padrão | Pattern 5 | UAT-5 acusa; alternativa: `overflow: hidden` temporário no texto durante a janela de 400 ms |
| A7 | `process.sandboxed`/`process.contextIsolated` existem no `process` reduzido do preload em sandbox | SEG-08 | remover a trava opcional se vierem `undefined` (senão a ilha nunca subiria) |
| A8 | Os três hex do tema Nord do mod são da paleta Nord do Sven Greb | CONV-04 | só afeta o texto do aviso Nord; conferir com a paleta oficial ao portar na Fase 3 |
| A9 | `island.on('show')` dispara ao reexibir (`show`/`showInactive`) e é suficiente para "reexibir rearma" | SEG-02/06 | só verificável com a UI de esconder (Fase 4); registrar como verificação adiada |

## Open Questions (RESOLVED)

1. **"Em tela cheia não aceita decisão" é verificável nesta fase?** — RESOLVED: 02-01 Task 2 (`coveredByFullscreen` na regra, constante `false` com `ponytail:`; prova ponta a ponta adiada à Fase 4, TELA-01).
   - Sabemos: não há API do Electron para saber se outra janela está em tela cheia (PITFALLS #13); a ilha hoje aparece **por cima** de tela cheia (`setAlwaysOnTop(true, 'screen-saver')`, `visibleOnFullScreen: true`, `main.js:170-171`); a sonda é TELA-01 (Fase 4).
   - Falta: critério 3 do roadmap menciona tela cheia.
   - Recomendação: a Fase 2 entrega a **regra e o contrato** (`coveredByFullscreen` na função pura, vetores, constante `false` com comentário `ponytail:`); a prova ponta a ponta fica para TELA-01/02. O planner deve registrar isso explicitamente no plano para o verificador não cobrar o que não existe.
2. **"Reexibir rearma" sem UI de esconder.** — RESOLVED: 02-02 Task 2 (rearme em `show`/`restore`; verificação ponta a ponta adiada à Fase 4). Hoje nada esconde a ilha. Recomendação: ligar `island.on('show', …)` e o rearme agora (barato, protege a Fase 4) e marcar a verificação ponta a ponta como adiada à Fase 4 (A9).
3. **Dois commits ou um para o eco?** — RESOLVED: 02-01 Task 1 (um único commit no GREEN). Ver Pitfall 1: main+preload+renderer do eco juntos.
4. **Transparência/opacidade sem preferência ainda.** — RESOLVED: 02-04 Task 3 (`effectiveOpacity`) + `opacity === 1` no armamento (02-03). `effectiveOpacity` entra pura e testada, sem consumidor; a Fase 4 (PREF-06) a usa. O enforcement em runtime desta fase é a exigência `opacity === 1` no armamento do renderer.

## Project Constraints (from CLAUDE.md)

Extraídas de `.claude/CLAUDE.md` do projeto (e do `CLAUDE.md` global quando relevante):

- CommonJS (`require`/`module.exports`), sem transpilação; `node:` prefixo nos built-ins; um `module.exports` ao final listando cada nome.
- Lógica pura em `state.js` (só `node:os`/`node:path`); Electron em `main.js`; específico de plataforma em `window.js`. Funções puras recebem `now` por parâmetro e devolvem `null`/valores sentinela sem lançar.
- Estilo: 2 espaços, aspas simples, ponto e vírgula, vírgula final, linhas ≲120; constantes `UPPER_SNAKE_CASE` com unidade (`_MS`); identificadores em inglês; **comentários, strings de usuário e nomes de teste em pt-BR**; comentário explica o porquê; `// ponytail: <simplificação>. <como evoluir>.` para atalhos com teto conhecido; JSDoc `/** */` descrevendo o retorno em prosa, sem `@param`/`@returns`.
- Dados lidos do disco nunca são confiáveis; IPC do renderer é validado no main e nunca fornece identificadores; arquivos entre processos: temp + rename.
- Hooks nunca imprimem em `stdout`/`stderr` fora do contrato e nunca atrasam a sessão (esta fase não altera `hook.js` nem `permission-hook.js`).
- Sem dependência nova; pnpm; **não** introduzir linter; testes com `node:test`.
- Segurança: nenhuma mudança de interação pode permitir aprovar pedido que o usuário não via.
- Processo: commits semânticos em pt-br sem `Co-Authored-By` (o `CLAUDE.md` global vence sobre o lembrete de atribuição); `main` protegida, tudo por PR; branch atual `feat/fase-2-seguranca`; PR em pt-br sem rodapé "Generated with…".
- Licença MIT; portar valores/lógica do mod exige manter o aviso de copyright do autor (CONV-04).
- Não mexer em `~/.claude/settings.json`; não iniciar/encerrar o Electron durante a pesquisa (outra sessão mede).

## Sugestão de divisão em planos (para o planner)

1. **Núcleo puro + vetores + notices (Wave 1, sem tocar runtime):** `state.js` (4 funções + constantes), `fixtures/permission-vectors.json`, `gate.test.js`, `THIRD_PARTY_NOTICES.md`. Cobre SEG-07 e CONV-04 e a base de SEG-01/03/04/05/06/08. Testes escritos primeiro e falhando.
2. **Religar main + preload + renderer do eco (Wave 2, atômico):** `refresh(reason)`, `decidedPermissionId`, `island:decide` fino, `answeredId`/`armEpoch` no payload, `show` rearma, `SECURE_WEB_PREFERENCES`, `preload.js` com `pressedId`, renderer com `pressedId`, travas.
3. **Armamento e roda no renderer (pode ir junto do 2 por tocar `index.html`):** epoch, settle probe, dwell, press/release, guarda de roda, `overscroll-behavior`, opacidade.
4. **UAT** (checkpoint humano no fim: `human_verify_mode: end-of-phase`).

## Sources

### Primary (HIGH)
- Código lido nesta sessão: `main.js`, `index.html`, `preload.js`, `state.js`, `permission-hook.js`, `island.test.js`, `package.json`, `LICENSE`, `.planning/{REQUIREMENTS,ROADMAP,STATE,config.json}`, `.planning/research/{SUMMARY,ARCHITECTURE,PITFALLS}.md` (trechos de invariantes e pitfalls 1-6, 20).
- `gh api repos/devcode90/Dynamic-Island-for-Windows/{license,contents/CHANGELOG.md,contents/README.md,contributors}` e `gh api users/devcode90`; `gh api repos/nordtheme/nord/license`.
- Arquivo local do mod: `C:\ProgramData\Windhawk\ModsSource\dynamic-island-for-windows.wh.cpp` (cabeçalho e Credits).
- `node --version`, `node --test` (13 verdes), `node_modules/electron/package.json` (45.4.1).

### Secondary (MEDIUM, `[CITED]`)
- https://www.electronjs.org/docs/latest/api/structures/web-preferences (defaults de `nodeIntegration`, `contextIsolation`, `sandbox`)
- https://www.electronjs.org/docs/latest/tutorial/sandbox (sandbox padrão desde o 20; módulos permitidos no preload)
- https://www.electronjs.org/docs/latest/api/process (`process.sandboxed`, `process.contextIsolated`)
- Resultado de WebSearch sobre `contextBridge` e `ipcRenderer` (docs de `context-bridge`/`ipc-renderer`; versão exata da mudança não confirmada)

### Tertiary (LOW)
- Comportamento de Chromium para `click` entre elementos distintos e `wheel` passivo: conhecimento de treino, marcado `[ASSUMED]` (A5, A6); a UAT decide.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (sem dependência nova; versões lidas)
- Arquitetura do gate: HIGH (fluxo e gaps lidos no código com linhas)
- Armamento/roda no renderer: MEDIUM (desenho sólido, mas depende de A5/A6 e só a UAT confirma)
- CONV-04: HIGH (LICENSE do mod lido direto; sha registrado)
- Pitfalls: HIGH

**Research date:** 2026-11-21
**Valid until:** 30 dias (código estável); reler `LICENSE` do mod se `pushed_at` do repositório do autor passar de 2026-10-31
