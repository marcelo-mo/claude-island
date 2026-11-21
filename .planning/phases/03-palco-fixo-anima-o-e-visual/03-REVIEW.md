---
phase: 03-palco-fixo-anima-o-e-visual
reviewed: 2026-11-21T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - index.html
  - main.js
  - state.js
  - gate.test.js
  - island.test.js
  - visual.test.js
  - fixtures/permission-vectors.json
  - THIRD_PARTY_NOTICES.md
findings:
  critical: 0
  warning: 4
  info: 5
  total: 9
  necessity: 0
status: issues_found
---

# Phase 3: Relatório de Code Review

**Reviewed:** 2026-11-21
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Foram lidos por inteiro `index.html`, `main.js`, `state.js` e os três arquivos de teste, mais o diff de
`ec6a209..HEAD` de cada arquivo. `node --test` passa (261 testes). A necessity-review foi lida e não gerou
nenhum achado de necessidade.

Nenhum defeito que quebre a fronteira de confiança foi encontrado. Rastreei estes caminhos e todos se sustentam:

- Os botões só armam com `canArm({ settled, springsAtRest })`, e `springsAtRest` cobre largura, altura, nudge e
  escala. Qualquer deslocamento de layout depois do armamento passa por uma de três travas: o
  `ResizeObserver` em `#pill` e `#actions`, a conferência de `buttonsRect()` em `renderContent`, ou a
  conferência no `pointerdown`.
- `hoverScaleTarget` e `shouldNudge` exigem `hasPermission` exatamente `false`. Se a escala já estava em curso
  quando o pedido chega, ela volta a 1 e o armamento espera as molas pararem.
- Os laços de `requestAnimationFrame` terminam: `springFrame` para ao repousar, `waitUntilSettled` para quando
  o token muda ou o pedido some, e `startSpringLoop` não agenda quadro com a janela escondida ou com
  movimento reduzido.
- `springStep` nunca devolve NaN. O quadro é limitado a 50 ms, os passos a 2000, a velocidade só entra por
  `normalizePreferences` (0,5 a 2) e o estilo passa por `Object.hasOwn`.
- `normalizePreferences` e `positionFromSavedOffset` tratam entrada em disco como não confiável. A CSP é a
  mesma, e não há canal IPC novo (o teste dos sete canais passa).
- As cores de estado ficam fixas nos 10 casos de tema.

Os achados abaixo são de robustez, de acoplamento e de lacunas de teste. Os dois primeiros afetam o
funcionamento real.

## Warnings

### WR-01: `preferences.json` fica na pasta de sessões e é lido como se fosse uma sessão

**File:** `main.js:121-139` (e `state.js:12`)
**Issue:** `PREFERENCES_FILE` foi colocado em `~/.claude/island/`, a mesma pasta que `readSessions` varre. O
filtro é só `file.endsWith('.json')`, então a cada ciclo de 400 ms o `preferences.json` é lido, parseado e
empurrado em `sessions`. `readContextPercent('preferences')` também tenta ler
`<tmp>/claude-ctx-preferences.json` a cada ciclo. Hoje `pickState` descarta a entrada porque `state` é
`undefined`, mas o arquivo é editável à mão (D-16) e a Fase 4 passa a gravá-lo. Se ele ganhar qualquer chave
`state`, `updatedAt` ou `permission` (hoje ou numa fase futura), a ilha mostraria uma sessão fantasma. O
`validPermission` do fantasma ainda alimentaria o gate. O isolamento depende do acaso de os nomes de chave não
colidirem.
**Fix:** Excluir o arquivo explicitamente na leitura, e fazer o mesmo na Fase 4 ao gravar:
```js
const NON_SESSION_FILES = new Set(['preferences.json']);
// em readSessions:
if (!file.endsWith('.json') || NON_SESSION_FILES.has(file)) continue;
```
Alternativa mais limpa: gravar as preferências em `app.getPath('userData')`, ao lado de `positions.json`.
Se for alterar o local, é preciso mudar `PREFERENCES_FILE` e o texto de `gate.test.js` que o referencia.

### WR-02: Com o palco de 410 px, monitor de área útil baixa recusa toda decisão, sem aviso

**File:** `state.js:243` e `state.js:216-226`; `main.js:325`
**Issue:** `WINDOW_SIZE.height` subiu de 324 para 410. `clampIslandPosition` diz que, quando a área útil é
menor que a janela, vence o mínimo, e a janela passa da borda de baixo. `isWithinWorkArea` exige a janela
inteira dentro da área útil, então devolve `false` e `acceptDecision` recusa com `outside-visible-area` para
sempre naquele monitor. O gate fica seguro, mas os botões continuam habilitados. `island:decide` só reenvia o
estado e o renderer solta a trava. O usuário clica em Permitir, nada acontece, e o pedido só se resolve no
terminal ou por timeout de 5 minutos. A área útil abaixo de 410 DIP ocorre em combinações reais, por exemplo
1920×1080 a 250% com barra de tarefas, ou 1366×768 a 200%. O texto do `ponytail` de `WINDOW_SIZE` só fala de
DPI misto e não menciona esse limite.
**Fix:** Há duas opções. A primeira é manter o gate como está e, quando o main sabe que a janela não cabe
(`display.workArea.height < WINDOW_SIZE.height`), enviar ao renderer um fato `canDecide: false` no mesmo
estado, para ele mostrar os botões desabilitados e a dica "Responda no terminal". Isso não cria canal novo. A
segunda é limitar a altura da janela a `Math.min(WINDOW_SIZE.height, workArea.height)` por monitor, o que
exige revisar o teste do palco, que hoje assume um tamanho só. Em qualquer caso, registrar o limite no
`ponytail`.

### WR-03: Em Linux o palco maior vira um retângulo invisível de 520×410 que bloqueia cliques

**File:** `main.js:20`, `main.js:223`; `state.js:243`
**Issue:** `CAN_CLICK_THROUGH` é `false` em Linux, então `setIgnoreMouseEvents` nunca é chamado e a janela
transparente captura todo clique na sua área, também com a ilha ociosa. A fase aumentou essa área de 440×324
(~142 mil px²) para 520×410 (~213 mil px²), um aumento de cerca de 50% sobre o topo central de cada monitor,
onde ficam barras de título, menus e abas. Isso é uma regressão de usabilidade em Linux que não aparece em
nenhum teste nem no resumo da fase.
**Fix:** Em Linux, ou dimensionar a janela ao tamanho real da pílula e redimensioná-la fora das molas (o que
contradiz o palco fixo), ou registrar a limitação no README e no `ponytail` de `WINDOW_SIZE` e aceitar o custo
de forma explícita. Se a ilha ociosa não precisa de janela, `island.hide()` quando o estado é `idle` em Linux
resolve o caso mais frequente (mas precisa passar pelo gancho `show` que já rearma).

### WR-04: O modelo de altura do palco não cobre o rótulo da ferramenta, que pode passar de uma linha ou ser cortado

**File:** `index.html:225` (`#permission-tool`); `gate.test.js:784-807` (`pillMaxHeight`); `state.js:23`
**Issue:** `isPermissionTool` aceita até 100 caracteres. `#permission-tool` é `display: block` sem
`overflow-wrap`, e `#permission-text` tem `overflow-wrap: anywhere`. O rótulo tem ~348 px de largura útil, ou
cerca de 56 caracteres a 11 px. Dois casos:

1. Nome sem espaço nem hífen (o formato `mcp__servidor__ferramenta` não tem ponto de quebra): o texto passa da
   caixa e o `overflow: hidden` da pílula o corta, sem reticências. O usuário aprova olhando um nome de
   ferramenta truncado, que é exatamente o que "não se aprova um comando cortado" quer evitar.
2. Nome com espaços ou hífens: o rótulo quebra em 2 linhas. `pillMaxHeight` soma uma linha só (11 × 1,3) e o
   teste do palco não vê isso.

Medi o segundo caso por simulação com a mola Elástico a 2×: o pico de altura é ~354,7 px para a pílula de
299,7 px. Pela fórmula do teste, o palco precisa de `8 + 354,7 × 1,025 + 20 ≈ 391,6 px`, com folga de ~18 px
sobre 410. Uma linha a mais no rótulo (+14,3 px) leva a necessidade para ~409 px, ou seja, a folga some. Na
largura a folga já é de só ~10 px (necessário ≈ 510 px para 520).
**Fix:** Acrescentar `overflow-wrap: anywhere;` em `#permission-tool` e fazer `pillMaxHeight` somar
`PERMISSION_TOOL_LIMIT / caracteresPorLinha` linhas de rótulo (ou limitar o rótulo a 2 linhas com
`-webkit-line-clamp` e somar 2). Subir `WINDOW_SIZE.height` só se a conta pedir. Também vale rodar
`worstPeak` com `frameMs` de 8 e de 33 ms, já que o teste só usa 16 ms e o pico varia ~1,5 px com o quadro.

## Info

### IN-01: O botão verde "Abrir" fica em 4,40:1 e o teste de contraste não o mede

**File:** `index.html:36-39` (`--done-button`), `index.html:202`; `visual.test.js:276-295`
**Issue:** O comentário diz que o verde escuro foi escolhido porque "o rótulo branco precisa de contraste nos
dois temas". Branco sobre `#248a3d` mede 4,395:1 (calculado), abaixo de 4,5:1 para texto de 13 px em peso 600.
O teste de contraste cobre `--button-text` sobre `--button` (travado em ≥3 por decisão registrada) mas não
tem nenhuma checagem para `--done-button`, e o `#fff` do rótulo é fixo no CSS, então nada pega regressão.
**Fix:** Escurecer para algo como `#217a37` (≥4,5:1 com branco) ou incluir
`check(found, '#fff sobre --done-button', '#fff', 'var(--done-button)', 4.5)` no teste e aceitar o valor
medido de forma explícita no comentário.

### IN-02: `main.js` lê `preferences.json` inteiro, sem limite de tamanho nem checagem de tipo de arquivo

**File:** `main.js:58-64`
**Issue:** O `try/catch` cobre arquivo ausente, JSON inválido, diretório (`EISDIR`) e string grande demais, então
"arquivo ruim impede a ilha de subir" não ocorre nessas formas. Duas formas escapam: um arquivo de centenas de
MB é lido e decodificado de forma síncrona no `start()`, antes de qualquer janela, e um arquivo especial
(FIFO) bloquearia o `readFileSync` para sempre. Ambas exigem escrita local e são improváveis, mas o requisito
da fase é que o arquivo nunca atrapalhe a subida.
**Fix:** Conferir antes de ler: `const stat = fs.statSync(PREFERENCES_FILE); if (!stat.isFile() || stat.size > 64 * 1024) return;`
dentro do mesmo `try`.

### IN-03: Com movimento reduzido ligado no meio da execução, a escala do hover fica presa até o próximo render

**File:** `index.html:707-709`
**Issue:** O `change` de `prefers-reduced-motion` chama só `snapAllSprings()`. Se isso acontece com o cursor
sobre a pílula, a mola de escala é fixada no alvo antigo (1,025) e fica ali, porque o alvo só é recalculado em
`render()`, que só roda em mudança de estado ou de hover. Com a ilha parada em `running`, a pílula pode ficar
ampliada indefinidamente. Não afeta o gate (sem pedido a escala já era 1), é só visual.
**Fix:** Chamar `render()` depois do `snapAllSprings()` no listener, para o alvo ser recalculado com
`reducedMotion.matches` verdadeiro e a escala ir a 1.

### IN-04: No formato notch, o nudge sobe a pílula 6 px acima do topo da janela e é cortado

**File:** `index.html:140-141`, `index.html:514`; `gate.test.js:811-812`
**Issue:** O notch zera `--stage-top`, então o topo da pílula encosta no topo da janela. O nudge (−6 px) e o
translate de entrada da pílula ociosa (−12 px) a empurram para fora do palco, e a janela recorta o topo por
~300 ms a cada troca de estado. O teste do palco usa `stageTop` como o maior valor (8 px) e por isso nunca
exercita esse caso.
**Fix:** No notch, suprimir o nudge (`shouldNudge` recebendo a forma) ou manter 6 px de respiro e deslocar o
topo visual por `translate`. Como a forma só vem de arquivo até a Fase 4, pode ser tratado lá, mas o teste do
palco deveria falhar hoje para registrar a lacuna.

### IN-05: Algumas travas de teste são por texto e a do hover só protege propriedades de transformação

**File:** `gate.test.js:350-358`, `gate.test.js:53-70`
**Issue:** O teste "botões e hover sem transform..." só rejeita `transform|scale|translate|rotate|zoom` nas
regras que tocam botão ou `:hover`. Uma regra de hover que mude `margin`, `padding`, `width`, `top` ou
`position` move o botão do mesmo jeito e passa. O teste de `shown` conta 2 atribuições por regex: uma
reformatação legítima de `main.js` o quebra e um desvio com outra sintaxe (desestruturação, `Object.assign`
aninhado) o contorna. O próprio arquivo já avisa que são travas baratas e frágeis, então isto é só registro.
**Fix:** Ampliar a lista do teste de hover para `margin|padding|width|height|top|left|right|bottom|inset|position`
dentro das regras guardadas. As travas de texto restantes podem ficar como estão, com o aviso que já têm.

---

_Reviewed: 2026-11-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
