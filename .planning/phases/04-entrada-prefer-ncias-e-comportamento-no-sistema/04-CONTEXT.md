# Phase 4: Entrada, preferências e comportamento no sistema - Context

**Gathered:** 2026-11-21
**Status:** Ready for planning
**Modo:** `--auto` (o autor está fora; o orquestrador `desenvolvimentos-81` pediu a escolha recomendada em cada zona cinzenta, registrada aqui e no DISCUSSION-LOG)

<domain>
## Phase Boundary

A ilha passa a reagir ao cursor pela posição real de tela (não mais por `mouseenter` do DOM com
`forward`), ganha um menu de clique direito que grava as preferências, um atalho global de
esconder/mostrar, âncora, transparência e o modo "uma ilha só", e some no Windows quando um app
ocupa o monitor em tela cheia. Tudo isso sem nunca aceitar uma decisão de permissão com a ilha
escondida, coberta, translúcida ou com o menu aberto.

Requisitos: HOV-01..04, PREF-01..06, TELA-01..02. Fora: troca de sessão por roda, pontos e fila
(Fase 5), convivência com o Windhawk (Fase 6).

</domain>

<decisions>
## Implementation Decisions

### Pré-voo: pesquisa × código da Fase 3 na `main` (4393a57)
- **D-01:** A pesquisa foi escrita com a Fase 3 ainda fora da `main`. Conferido no código atual:
  `WINDOW_SIZE` = 520×410 e `HORIZONTAL_SLACK` = 60 (`state.js`); o normalizador se chama
  `normalizePreferences` (não `sanitizePreferences`) e `DEFAULT_PREFERENCES` tem só as 4 chaves
  visuais; `PREFERENCES_FILE` = `~/.claude/island/preferences.json` e `isSessionFile` já o exclui de
  `readSessions` (a Open Question 1 da pesquisa está resolvida pela Fase 3); o main envia
  `preferences` e `fitsWorkArea` no `island:state`; o hover atual é `island:hover` + `mouseenter`/
  `mouseleave`/`mousemove` + `setIgnoreMouseEvents(..., { forward: true })`; `coveredByFullscreen`
  segue `false` fixo; `positions.json` segue com `writeFileSync` direto. A suíte tem **263** testes
  (não 194). As travas citadas pela pesquisa mudaram de linha: `RENDERER_CHANNELS` em
  `gate.test.js:236`, `handlers.length` em `:261`, `['coveredByFullscreen', 'false']` em `:322`. O
  planejador relê esses pontos; nenhuma recomendação da pesquisa ficou inválida.

### Hover e captura do mouse (HOV-01..04)
- **D-02:** Hover pela posição de tela: o main lê `screen.getCursorScreenPoint()` a 30 Hz enquanto a
  ilha está visível e não ociosa, e envia o ponto local a cada ilha (`island:cursor`); o renderer
  decide com uma função pura `hoverStep` (bloco inline com marcadores no `index.html`, testado por
  `node:vm`, precedente das `regras-do-gate`) contra o retângulo vivo da pílula, e responde só um
  booleano (`island:capture`). Histerese: entra 2 px dentro, sai 8 px fora. Valores em constantes
  isoladas, fixados por vetor de teste.
- **D-03:** Sai o `forward: true` (para sob terminal elevado, UIPI). O main aplica
  `setIgnoreMouseEvents(!capture)` sem `forward`, e segura a captura durante arraste e com o menu
  aberto. Sai o hover por `mouseenter`/`mouseleave`/`mousemove` do DOM; o `pointermove` dos botões
  fica, porque é do armamento. `island:hover` é substituído por `island:capture`. Linux mantém o
  comportamento de hoje (sem click-through, melhor esforço).
- **D-04:** `expandOn: 'hover'` (padrão) ou `'click'`. No modo clique, um clique na pílula compacta a
  expande, e ela recolhe quando o cursor sai (mesma histerese). Expandir, hover e captura nunca armam
  nem desarmam o gate, e nunca disparam decisão.
- **D-05:** "Fixar aberta" (`pinExpanded`) mantém a pílula expandida, exceto em `done`, que segue sem
  expandir para o botão "Abrir" ficar parado (regra atual do `index.html`). Com pedido na tela a
  pílula já está expandida pelo pedido.

### Preferências e menu (PREF-01, PREF-02)
- **D-06:** Arquivo continua em `~/.claude/island/preferences.json` (D-16 da Fase 3, sem migração).
  `normalizePreferences` é estendido, não substituído: novas chaves `expandOn`, `pinExpanded`,
  `opacity` ∈ {1, 0.85, 0.7, 0.55}, `anchor` (6 valores), `islandMode` (`perDisplay` padrão,
  `primary`, `cursor`), `shortcut` (string) e `version` (inteiro). Itera só as chaves do esquema
  (imune a `__proto__` e chave extra), devolve sempre o objeto completo, valor inválido volta ao
  padrão da chave, nunca lança. Leitura com teto de tamanho (64 KB).
- **D-07:** Só o main grava, por `.tmp` + `renameSync` (padrão de `writeDecision`). JSON inválido na
  subida: o arquivo é renomeado para `preferences.json.bad` (fora do filtro `*.json` de sessões) e
  valem os padrões. `positions.json` passa a gravar do mesmo jeito.
- **D-08:** Menu nativo (`Menu.buildFromTemplate` + `menu.popup({ window })`, sem x/y), aberto por
  `contextmenu` no renderer → `island:menu` **sem argumentos**. Itens e valores vêm de constantes do
  main, com o valor atual marcado (radio/checkbox). Rótulos em pt-BR. Um menu por vez (`menuOpen`;
  pedidos enquanto aberto são descartados). Fallback em HTML só se a verificação humana (CHK-03)
  reprovar o nativo.
- **D-09:** Em `menu-will-show` e `menu-will-close` o main chama `refresh('rearm')`: o menu pode
  cobrir Permitir/Negar e o clique que o fecha pode cair no botão. Toda mudança de preferência
  aplicada pelo menu também passa por `refresh('rearm')` (SEG-02). Nenhum canal do renderer grava
  preferência (SEG-08): o renderer só pede "abrir menu".

### Atalho global (PREF-03)
- **D-10:** Padrão `Control+Alt+Shift+C`. Ctrl+Alt+C foi medido na pesquisa: produz `¢` com AltGr+C
  no ABNT2 do autor, logo conflita, e `register()` não enxerga esse conflito. Nenhuma letra produz
  caractere com Ctrl+Alt+Shift no ABNT2 nem no US.
- **D-11:** O acelerador é editável só no JSON (`shortcut`), sem UI de captura de tecla.
  `register` dentro de `try/catch`, sem retry em laço; status `ok` / `unavailable` (tomado por outro
  processo) / `invalid` (string que lança). O menu mostra o atalho atual e, se o status não for `ok`,
  um item desabilitado avisando que o atalho não pôde ser registrado. `unregisterAll()` em
  `will-quit`.
- **D-12:** Esconder (pelo atalho ou pelo menu) não é persistido: a ilha sobe visível. Esconder nunca
  aprova; reexibir passa pelo evento `'show'` que já rearma (`refresh('rearm')`). O atalho **não**
  reexibe uma ilha escondida por tela cheia (TELA-02).

### Âncora, modos e transparência (PREF-04..06)
- **D-13:** Seis âncoras: topo centro (padrão), topo esquerda, topo direita, base centro, base
  esquerda, base direita. Valores do mod com comentário MIT de origem: 16 px das laterais, 40 px de
  baixo. `anchorPosition` pura em `state.js`; a pílula se alinha dentro do palco por `data-anchor` no
  CSS (horizontal start/center/end; embaixo `align-items: flex-end` com `padding-bottom` que deixa
  caber a sombra para baixo, que alcança 19 px). O deslocamento continua vindo do arraste, preso ao
  monitor da própria ilha pelo clamp que já existe. Mudar a âncora zera os deslocamentos salvos.
- **D-14:** Depois de criar a janela, posicionar com `setBounds` (nunca `setPosition`): a 125% a
  janela nasce 6 DIP mais alta. Acrescentar vetor em `isWithinWorkArea` para a borda de baixo a 125%
  (+2/+3 DIP) e decidir a tolerância no plano; recusar por engano é o lado seguro.
- **D-15:** "Uma ilha só" opcional (`islandMode`): `perDisplay` (padrão), `primary` ou `cursor`.
  `islandDisplays` pura. No modo `cursor` a ilha só troca de monitor **sem pedido na tela**; trocar
  de monitor rearma.
- **D-16:** Transparência por `setOpacity` da janela inteira (medido: mistura de fato), com
  `effectiveOpacity(pref, hasPermission)` que já existe e é fail-safe. O main aplica no mesmo passo
  do `refresh` que decide o pedido exibido, para toda ilha, de novo no `'show'` e ao mudar a
  preferência. Com pedido na tela a opacidade é sempre 1. Trocar para "só o preenchimento" fica para
  depois se o autor achar o texto fraco a 55%.

### Tela cheia (TELA-01, TELA-02)
- **D-17:** Só Windows. Sensor em `fullscreen.js` (arquivo novo, separado de `window.js` porque os
  hooks fazem `require('./window')`), com `koffi` carregado de forma preguiçosa dentro de
  `if (process.platform === 'win32')` e `try/catch`; nunca lança, devolve só retângulos e strings.
  Sondagem a 2 Hz. Decisão por redutor puro `nextFullscreen` em `state.js`.
- **D-18:** Regra: primeiro plano cujo retângulo **cliente** cobre o monitor (tolerância 1 px),
  ignorando o próprio PID, `Progman`/`WorkerW`/`Shell_TrayWnd`/`Shell_SecondaryTrayWnd`, janela
  invisível, minimizada, *cloaked* ou `WS_EX_TRANSPARENT`; mapeamento monitor → display por igualdade
  do retângulo físico (`screen.dipToScreenRect(null, display.bounds)` = `rcMonitor`). O HWND coberto
  é lembrado por monitor: focar o outro monitor não faz a ilha reaparecer sobre o vídeo; solta quando
  o primeiro plano está naquele monitor e não é tela cheia, ou quando o HWND some.
- **D-19:** Efeito por `hide()`/`showInactive()` (nunca destruir: o som e o rearme dependem da janela
  viva). O gate recebe `coveredByFullscreen` por display: `display ? coberto(display.id) : true`
  (display desconhecido conta como coberto, fail-safe). Pedido com a ilha escondida só toca o som
  (`chime()` roda em janela escondida, medido); a ilha não reaparece; o terminal segue valendo.
- **D-20:** `koffi@3.3.8` exato em `dependencies`, `allowBuilds: { electron: true, koffi: false }` no
  `pnpm-workspace.yaml`. A pesquisa marcou a versão como SUS só por recência e pediu um checkpoint
  humano antes do `pnpm add`. Com o autor fora, o orquestrador autorizou o uso; o executor faz a
  conferência que o checkpoint pedia (release 3.3.8 no `Koromix/koffi`, `scripts` do pacote, binário
  vindo do optionalDependency oficial, nenhum script de build rodando com `koffi: false`), registra a
  evidência no SUMMARY, e o PR lista isso como item a confirmar pelo autor antes do merge. Se a
  conferência falhar, TELA-01 fica fora e o restante da fase segue. — **Reversibility:** costly —
  sair do `koffi` depois exige trocar o sensor por um helper PowerShell residente (28 MB medidos).

### Achado herdado da Fase 3: sombra cortada no topo
- **D-21:** `--stage-top` (8 px) é menor que o alcance da sombra para cima (9 px: desfoque 14 −
  deslocamento 5). Na posição padrão a janela encosta no topo da área útil, então a parte cortada
  cairia fora da tela de qualquer jeito; o corte só aparece com a ilha arrastada para baixo: 1 px na
  cauda em repouso (alfa ≈ 0) e até 7 px durante o nudge de −6 px (alfa ≈ 0,05, por 0,45 s). Subir o
  `--stage-top` para 15 px resolveria, mas desce a pílula 7 px e mexe no respiro de 8 px decidido na
  Fase 3 (D-22 de lá), que só o autor pode trocar. **Decisão:** não mudar nesta fase; registrar no PR
  como achado aceito, com a correção de uma linha descrita. A âncora de baixo (D-13) já reserva a
  sombra para baixo.

### Claude's Discretion
- Taxas (30 Hz cursor, 2 Hz tela cheia), estrutura de ondas e planos, nomes de constantes e de
  funções puras, texto exato dos itens do menu, se o cursor tick para com a ilha ociosa.
- Ordem sugerida (não vinculante): funções puras e testes → hover/captura → preferências, menu,
  atalho, âncora e modos → tela cheia com `koffi`. Planos sequenciais: todos mexem em `main.js`,
  `index.html` e `gate.test.js`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pesquisa e requisitos da fase
- `.planning/phases/04-entrada-prefer-ncias-e-comportamento-no-sistema/04-RESEARCH.md` — medições, padrões 1 a 6, armadilhas, CHK-01..08 (o `human-checks.js` precisa ser recriado em `scripts/`)
- `.planning/REQUIREMENTS.md` — HOV-01..04, PREF-01..06, TELA-01..02
- `.planning/ROADMAP.md` §Phase 4 — critérios de sucesso e regras que valem para toda fase

### Contrato das fases anteriores
- `.planning/phases/03-palco-fixo-anima-o-e-visual/03-CONTEXT.md` — D-07 (nudge), D-08 (hover), D-09, D-14, D-15/16/17 (preferências), D-22 (formas e respiro)
- `.planning/phases/03-palco-fixo-anima-o-e-visual/03-UI-SPEC.md` — palco, retângulo vivo, `restartArming` ao aplicar preferência
- `.planning/phases/02-funda-o-segura-do-gate-de-permiss-o/` — gate: `acceptDecision`, `refresh(reason)`, armamento, vetores
- `fixtures/permission-vectors.json` — vetores do gate (já tem `covered-by-fullscreen`)
- `.planning/PROJECT.md` §Key Decisions — cores de estado fixas, base Electron

### Origem e licença
- `.planning/research/WINDHAWK-MOD.md` — âncoras (16/40 px), transparência 100/85/70/55%
- `THIRD_PARTY_NOTICES.md` — aviso MIT do mod

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `refresh(reason)` (`main.js`): funil único que rearma; reexibir, menu, preferência e troca de monitor passam por ele.
- `effectiveOpacity` (`state.js`): já fail-safe; só falta o main aplicá-la.
- `acceptDecision` e o motivo `covered-by-fullscreen` (`state.js`, vetores): só falta o fato vir do main por display.
- `normalizePreferences`, `isSessionFile`, `PREFERENCES_FILE` (`state.js`): estender.
- `writeDecision` (`main.js`): padrão `.tmp` + rename para gravar preferências e posições.
- `clampIslandPosition`, `positionFromSavedOffset`, `defaultIslandPosition`, `isWithinWorkArea` (`state.js`): base da âncora.
- `applyPreferences` e `restartArming` (`index.html`): aplicar preferência no renderer.

### Established Patterns
- Regras puras do renderer inline entre marcadores e testadas por extração em `node:vm` (CSP não aceita script externo).
- Travas de texto em `gate.test.js` (canais, handlers, fatos da janela) mudam de propósito no mesmo commit da mudança.
- Hooks nunca carregam dependência nativa.

### Integration Points
- `main.js`: `createIsland`, `syncIslands`, `registerIpcHandlers`, `island:decide`, `sendState`.
- `preload.js`: sai `setHover`, entram `onCursor`, `setCapture`, `openMenu`.
- `index.html`: `setHovering` e listeners de `mouseenter`/`mouseleave`/`mousemove`, `contextmenu`, `data-anchor`.
- `pnpm-workspace.yaml`, `package.json`: `koffi`.

</code_context>

<specifics>
## Specific Ideas

- Atalho `Control+Alt+Shift+C` por causa do AltGr+C no ABNT2 (pedido do orquestrador, alinhado à pesquisa).
- Cores de estado fixas (Key Decision): nenhum item do menu muda cor de estado.
- Verificação na tela: nunca clique nem tecla sintética em janela de outro app; o que só se vê na tela vira checklist "Testar manualmente" no PR (CHK-01..08).

</specifics>

<deferred>
## Deferred Ideas

- Corrigir o corte da sombra subindo `--stage-top` (D-21): decisão visual do autor.
- Transparência só do preenchimento em vez da janela inteira (D-16), se o texto ficar fraco a 55%.
- UI de captura de tecla para o atalho.
- Roda do mouse trocando sessão, pontos e fila (Fase 5); "Rolar janelas inativas" no README (Fase 5).
- Convivência com o Windhawk (Fase 6).

</deferred>

---

*Phase: 04-entrada-prefer-ncias-e-comportamento-no-sistema*
*Context gathered: 2026-11-21*
