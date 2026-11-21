---
phase: 03-palco-fixo-anima-o-e-visual
verified: 2026-11-21T12:00:00Z
status: human_needed
score: 16/23 must-haves verified
covered_files:
  - .planning/phases/03-palco-fixo-anima-o-e-visual/03-01-PLAN.md
  - .planning/phases/03-palco-fixo-anima-o-e-visual/03-01-SUMMARY.md
  - .planning/phases/03-palco-fixo-anima-o-e-visual/03-02-PLAN.md
  - .planning/phases/03-palco-fixo-anima-o-e-visual/03-02-SUMMARY.md
  - .planning/phases/03-palco-fixo-anima-o-e-visual/03-03-PLAN.md
  - .planning/phases/03-palco-fixo-anima-o-e-visual/03-03-SUMMARY.md
  - THIRD_PARTY_NOTICES.md
  - fixtures/permission-vectors.json
  - gate.test.js
  - index.html
  - island.test.js
  - main.js
  - state.js
  - visual.test.js
covered_digest: "v4:sha256:7093396231a34e043e14bc48f5c19b51e9d8ee4168689470297dad3429ca7cb9"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Estilos e velocidades olhando a ilha. Com preferences.json em cada animationStyle (smooth, default, bouncy, snappy) e animationSpeed 0.5, 1 e 2, fazer a ilha crescer (hover, pedido de permissão) e encolher."
    expected: "Passagem leve no Padrão ao crescer, nenhum balanço ao encolher em qualquer estilo, alvo novo no meio sem salto; sem quadro de animação no Gerenciador de Tarefas com a ilha em repouso; com 'reduzir movimento' do Windows ligado a pílula muda de tamanho sem mola."
    why_human: "Sensação de movimento e consumo real de quadros só se avaliam olhando a ilha; a simulação numérica passa, mas não substitui o olho (truth marcada verification: backstop no 03-01)."
  - test: "Checklist do PR: registrar que o Elástico só difere do Padrão ao crescer (ao encolher todo estilo é criticamente amortecido), desvio deliberado do mod pelo ANIM-01."
    expected: "A descrição do PR traz o desvio explicado; o comentário em index.html (bloco mola) e o 03-01-SUMMARY já o registram."
    why_human: "Item de documentação do PR (verification: backstop no 03-01); só o autor decide como o PR o apresenta."
  - test: "Aparência do nudge, da ampliação de 2,5% no hover e das formas pílula, notch e Windows 11, com preferences.json em cada shape. Em Concluído conferir que o hover não amplia e o Abrir fica parado; com pedido na tela conferir que não há nudge nem ampliação e que os botões não se mexem."
    expected: "Raio e topo como o mod; notch colado no topo da tela; nenhum movimento nos botões de um pedido."
    why_human: "Aparência 'como a do mod' é julgamento visual (backstop no 03-02)."
  - test: "ITEM BLOQUEANTE DO PR: em 125% e 150% de escala (os monitores do autor misturam 100% e 125%), olhar o palco de 520x410 e a pílula no pico do Elástico a 2x."
    expected: "Nada recortado e nenhuma linha de 1 px na borda do palco."
    why_human: "Escala de DPI fracionária e recorte de janela transparente só aparecem em monitor real; o palco é provado por simulação em pixels CSS, não por DPI (backstop no 03-02; o PR não segue para merge sem este item)."
  - test: "Em Trabalhando, passar o mouse sobre a pílula expandida e olhar o botão Abrir sessão."
    expected: "O botão escala junto com a pílula (2,5%); aceito e registrado, porque aparece com a expansão do hover e não é botão de permissão."
    why_human: "Aceite explícito de comportamento visual (backstop no 03-02)."
  - test: "Quem tinha posição salva: atualizar e abrir a ilha; arrastar a ilha para os últimos ~86 px de baixo do monitor."
    expected: "A pílula fica no mesmo lugar depois de atualizar; na borda de baixo a ilha sobe exatamente até caber, porque o gate exige a janela inteira na área útil."
    why_human: "Posição real em monitor real (backstop no 03-02); a aritmética é provada em island.test.js."
  - test: "Os 8 temas e o auto (Windows claro e escuro), pílula compacta, expandida e com pedido. Trocar o tema com um pedido na tela."
    expected: "Superfície do tema, profundidade, sombra e reflexo do topo laranja (trabalhando), âmbar (precisa de você) e verde (concluído); bloco de permissão legível e o reflexo sem chegar ao comando; contorno legível em fundo claro e escuro; ao trocar o tema os botões rearmam (não aceitam clique até assentar de novo)."
    why_human: "Aparência dos temas é julgamento visual (backstop no 03-03); o contraste numérico já foi reproduzido pelo verificador."
  - test: "Monitor de área útil baixa (altura abaixo de 410 DIP, ex.: 1366x768 a 200%), com um pedido de permissão na tela (correção WR-02 do code review)."
    expected: "Permitir e Negar ficam desabilitados e a dica diz 'Responda no terminal'; o terminal segue valendo."
    why_human: "A correção muda o que o renderer oferece numa tela com pedido de permissão e o 03-REVIEW-FIX.md a marca 'requires human verification'."
  - test: "Pedido com nome de ferramenta longo (até 100 caracteres, com e sem pontos de quebra) no estilo Elástico a 2x (correção WR-04)."
    expected: "O rótulo quebra em linhas em vez de ser cortado e a pílula não é recortada pelo palco de 520x410."
    why_human: "O modelo de linhas do teste do palco usa largura média de 0,6 em, uma estimativa de fonte documentada; só o olho confirma o pior caso real."
---

# Fase 3: Verificação do palco fixo, animação e visual

**Objetivo da fase:** A ilha se move e se parece com a do mod, com molas assimétricas num palco fixo, 8 temas, 3 formas e material com reflexo da cor do estado, sem comprometer a leitura do bloco de permissão
**Verificado:** 2026-11-21
**Status:** human_needed
**Re-verificação:** Não, verificação inicial

## Resumo do veredito

Todo o comportamento que dá para provar sem olhar a ilha está provado, e por evidência própria do verificador, não só pelo SUMMARY: a suíte inteira passa (263 testes, 0 falhas), o script inline compila, e três verificações independentes reproduziram os números centrais (mola, contraste e a cola das molas num DOM falso). Nenhum gap bloqueante foi encontrado. O status é `human_needed` porque 7 truths do plano são `verification: backstop` (aparência e sensação de movimento) e o autor dispensou o teste manual nesta execução: elas viram o checklist do PR, e um deles (125% e 150% de escala) é bloqueante para o merge. Duas correções do code review (WR-02 e WR-04) também pedem uma olhada humana.

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidência |
|----|-------|--------|-----------|
| 1 | SC1 (ANIM-01): ao crescer passa ≈4–8% do alvo (Padrão); ao encolher não balança; alvo novo no meio continua da posição e da velocidade atuais | ✓ VERIFIED | Extraí o bloco `mola` do `index.html` e simulei em `node:vm`: Padrão 5,84%, Suave 0,13%, Elástico 20,78%, Rápido 5,26% ao crescer; encolher 400→200 deu 0,000% abaixo do alvo nos 4 estilos a 0,5×, 1× e 2×. `retargetSpring` preserva posição e velocidade e só troca a direção. Entrada NaN devolve mola parada, nunca NaN. Testes em `gate.test.js` (propriedades da mola) cobrem o mesmo |
| 2 | SC1 (ANIM-05): com "reduzir movimento" nenhuma transição usa mola nem nudge | ✓ VERIFIED | `startSpringLoop` faz `snapAllSprings()` quando `reducedMotion.matches \|\| document.hidden` antes de qualquer quadro; `shouldNudge` e `hoverScaleTarget` exigem `reducedMotion === false`. Executei o script do renderer num DOM falso com `matches: true`: rAF pendente 0, laço parado, nudge 0, escala 1 |
| 3 | SC2 (ANIM-02): 4 estilos e velocidade 0,5× a 2× dão movimentos distinguíveis, aplicados por valor de preferência | ✓ VERIFIED | Picos 0,13% / 5,84% / 20,78% / 5,26% e assentamento 560 / 640 / 976 / 528 ms (Padrão e Rápido diferem no tempo, não no pico); 2× assenta em 0,50 do tempo de 1× e 0,5× em 1,98, com diferença de pico 0,00 px. `springFrame` lê estilo e velocidade de `current.preferences` |
| 4 | SC2 (ANIM-03): nudge de −6 px no máximo a cada 450 ms; hover de ≈2,5%; botões de permissão não sofrem nenhum dos dois | ✓ VERIFIED | `shouldNudge`: verdadeiro na base, falso vindo de idle, com pedido, com movimento reduzido, a 449 ms; verdadeiro a 450 ms. `hoverScaleTarget`: 1,025 em running, 1 em done, 1 com pedido, 1 com movimento reduzido. No DOM falso: running→waiting com pedido deixou `nudge.position` 0 e alvo da escala 1 mesmo com o cursor em cima; sem pedido o nudge foi −6. Nenhuma regra CSS de hover ou de botão declara transform (grep e trava do `gate.test.js`) |
| 5 | SC3 (ANIM-04): a janela não muda de tamanho durante a animação | ✓ VERIFIED | `WINDOW_SIZE = Object.freeze({520, 410})` em `state.js`; o único `setBounds` do `main.js` usa `...WINDOW_SIZE`; nenhum `setSize` e `resizable: false`. Teste do palco simula 4 estilos × 3 velocidades com retarget a cada quadro e compara com o palco (pior caso, Elástico a 0,5×, ≈510 × 392 contra 520 × 410) |
| 6 | SC3 (ANIM-04): nenhum quadro de mola roda com a ilha em repouso | ✓ VERIFIED | Fonte: `if (springLoopRunning \|\| allSpringsAtRest()) return;` e `springFrame` desmarca o laço ao repousar. No DOM falso: primeira exibição não abre laço (rAF 0); hover abre o laço e ele para sozinho em menos de 2 s (laço false, rAF 0); nudge assenta e zera o rAF; depois do armamento o rAF pendente é 0. Ressalva: evidência de execução do verificador, sem teste commitado (ver Gaps Summary) |
| 7 | SC3 (D-10): Permitir e Negar seguem desarmados enquanto qualquer mola se move | ✓ VERIFIED | `canArm` estrito (`settled === true && springsAtRest === true`) com 8 vetores no fixture, chamado em `waitUntilSettled` com `allSpringsAtRest()` (inclui width, height, nudge e scale). No DOM falso, com pedido chegando durante hover ampliado: `armed` false e `allow.disabled` true no início, armou só após ≈960 ms, e `armedWhileMoving` false em 400 quadros |
| 8 | SC4 (VIS-01): 8 temas e o automático claro/escuro por valor de preferência, trocando só superfície, texto, secundário e borda | ✓ VERIFIED | 7 blocos `:root[data-theme]` escuros + Porcelain em `index.html`, valores idênticos à tabela do mod (`WINDHAWK-MOD.md` linhas 63–70); `@media (prefers-color-scheme: light)` restrito a `:root:not([data-theme]), :root[data-theme="auto"]`. Cadeia ponta a ponta: `loadPreferences` → `normalizePreferences` → payload `island:state` → `applyPreferences` → `data-theme` |
| 9 | SC4 (VIS-02): pílula, notch e Windows 11 por valor de preferência | ✓ VERIFIED | `:root[data-shape="win11"] #pill` 8px; `:root[data-shape="notch"]` com `--stage-top: 0px` e raio `0 0 16px 16px`; pílula usa `--radius` = min(altura-alvo/2, 44 px) gravado em `setSizeTarget`; sem regra para forma fora de `SHAPES` (`visual.test.js`) |
| 10 | SC5 (VIS-03): profundidade, sombra e reflexo do topo na cor do estado | ✓ VERIFIED | `#pill` com três camadas: `radial-gradient(ellipse 75% 56px at 50% 0, color-mix(... var(--accent) 7.5% ...))`, profundidade por `--depth` e `var(--surface)`; `--contour` 35% do acento; `box-shadow: 0 0 0 1px var(--contour), var(--shadow)`; `--accent` vira `--waiting` e `--done` por estado. Nenhum `::after`, o `glow` da Fase 1 segue a única animação contínua |
| 11 | SC5 (VIS-04): bloco de permissão com texto ≥4,5:1 e controles ≥3:1 nos 10 casos; fundo opaco; o reflexo nunca pinta o comando | ✓ VERIFIED | Reproduzi o contraste com um conversor OKLCH/`color-mix` próprio, que não reutiliza o do teste: mínimos 15,47 (texto), 4,69 (dica), 8,70 (rótulo), 5,07 (secundário); controles 3,32 (`--button` no Porcelain), 4,45 (borda de Negar), 3,38 (rótulo do botão); no rodapé escurecido 4,72 / 3,09 / 4,14. Bate com o 03-03-SUMMARY. `--perm-bg` é `color-mix` de cores opacas; a lavagem tem 56 px verticais fixos e fica atrás do bloco opaco |
| 12 | SC5 (VIS-05): fontes do sistema, nada embarcado, larguras não presas a uma fonte | ✓ VERIFIED | Nenhum `@font-face` nem `url(`; famílias `system-ui` e `ui-monospace`; pesos só 400 e 600; contador em 12 px. O alvo da pílula vem de `offsetWidth`/`offsetHeight` medidos no DOM com o conteúdo final (`measurePillTarget`) e o conteúdo fica na largura final por `--content-width` |
| 13 | Preferência entra só pelo main, sem canal novo (SEG-08) | ✓ VERIFIED | `ipcMain.on(` = 6 e `ipcRenderer.` = 7 (inalterados), `preload.js` sem diff desde `f57113b`; sem `fs.watch`; nenhuma gravação de `PREFERENCES_FILE`; `normalizePreferences` aceita só as 4 chaves e valores das listas (velocidade 0,5–2), nunca lança; CSP idêntica à da Fase 2 |
| 14 | Posição salva preservada ao trocar o palco; exceção aceita na borda de baixo (D-14) | ✓ VERIFIED | `positionFromSavedOffset` pura em `state.js`, delegada por `savedPosition`; testes de padrão, deslocamento (centro horizontal e topo iguais ao palco antigo 440×324) e borda de baixo (sobe 86 px e fica na área útil) passam |
| 15 | Cores de estado e dos botões fixas nos 10 casos (Key Decision) | ✓ VERIFIED | Laranja, âmbar e verde só em pares escuro/claro (Porcelain e auto claro usam o claro); `--button`, `--button-text` e `--done-button` com valor único; nenhuma regra `:root` usa `var(--accent)`; tudo travado em `visual.test.js` |
| 16 | Gate da Fase 2 preservado | ✓ VERIFIED | `node --test`: 263 testes, 263 passam, 0 falham; vetores existentes de `fixtures/permission-vectors.json` idênticos aos de `f57113b` (conferido com `git show`), grupo `canArm` acrescentado com 8 vetores; `canPress`, `isValidRelease`, `settleStep`, `acceptDecision` e `isWithinWorkArea` sem alteração |
| 17 | Backstop (03-01): estilos e velocidades olhando a ilha | ? UNCERTAIN (insufficient_spec) | `verification: backstop`; sem evidência explícita de olhar a ilha (teste manual dispensado) |
| 18 | Backstop (03-01): Elástico só difere do Padrão ao crescer, registrado como desvio deliberado | ? UNCERTAIN (insufficient_spec) | Desvio documentado em `index.html` e no 03-01-SUMMARY; falta a entrada na descrição do PR |
| 19 | Backstop (03-02): nudge, hover e formas com a aparência do mod, sem mexer nos botões | ? UNCERTAIN (insufficient_spec) | `verification: backstop`; lógica provada, aparência não |
| 20 | Backstop (03-02, bloqueante): 125% e 150% de escala sem recorte do palco | ? UNCERTAIN (insufficient_spec) | Só monitor real confirma; o PR não segue sem este item |
| 21 | Backstop (03-02): Abrir sessão escala junto no hover em Trabalhando, aceito | ? UNCERTAIN (insufficient_spec) | Aceite visual a registrar |
| 22 | Backstop (03-02): ilha nos últimos ~86 px de baixo sobe até caber | ? UNCERTAIN (insufficient_spec) | Aritmética provada em `island.test.js`; o comportamento em monitor real fica no checklist |
| 23 | Backstop (03-03): 8 temas e auto com a aparência esperada e bloco de permissão legível | ? UNCERTAIN (insufficient_spec) | Contraste reproduzido (truth 11); a aparência é julgamento visual |

**Pontuação:** 16/23 truths verificadas; 0 present-but-behavior-unverified; 7 backstops encaminhados a verificação humana (nenhum falhou).

### Prohibitions (ADR-550)

Todas as 14 proibições dos três planos (5 + 5 + 4) são de nível `test` e têm cobertura ligada, nenhuma fica sem enforcement (a última linha agrupa as 4 do 03-03):

| Proibição | Status | Enforcement |
|-----------|--------|-------------|
| Não afrouxar a CSP nem carregar a mola de arquivo | resolvida | grep da CSP exata = 1; trava no `gate.test.js`; mola inline entre `// mola:inicio` e `// mola:fim` |
| Não criar canal IPC novo nem deixar o renderer enviar preferência | resolvida | contagens 6 e 7 inalteradas; teste dos canais passa; `preload.js` sem diff |
| Não armar com mola em movimento | resolvida | `canArm` com vetores e trava em `waitUntilSettled`; DOM falso confirma |
| Não alterar vetores existentes | resolvida | comparação com `f57113b` idêntica |
| Não vigiar nem gravar o `preferences.json` | resolvida | 0 `fs.watch`, 0 `writeFileSync(PREFERENCES_FILE` |
| Não aplicar nudge/escala com pedido na tela | resolvida | tabelas de `shouldNudge` e `hoverScaleTarget` e execução no DOM falso |
| Não ampliar em Concluído | resolvida | `HOVER_SCALE_STATES = ['running', 'waiting']` e tabela |
| Não aplicar transform por regra CSS de hover ou de botão | resolvida | trava no `gate.test.js` e grep manual (só `filter`) |
| Não redimensionar a janela durante a animação | resolvida | `WINDOW_SIZE` congelado, único `setBounds` |
| Não mover quem tem posição salva (exceto subida mínima) | resolvida | testes de `positionFromSavedOffset` |
| Cores de estado fixas, bloco opaco, sem pseudo-elemento novo, sem fonte embarcada | resolvidas | `visual.test.js`; `::after` = 0, `@font-face` = 0, `url(` = 0 |

### Required Artifacts

| Artefato | Esperado | Status | Detalhes |
|----------|----------|--------|----------|
| `state.js` | `THEMES`, `SHAPES`, `ANIMATION_STYLES`, `DEFAULT_PREFERENCES`, `PREFERENCES_FILE`, `normalizePreferences`, `WINDOW_SIZE`, `HORIZONTAL_SLACK`, `positionFromSavedOffset`, `isSessionFile` | ✓ VERIFIED | Substantivo, exportado e importado por `main.js` e pelos testes |
| `main.js` | `loadPreferences` (leitura única), `preferences` e `fitsWorkArea` no payload, `savedPosition` delegando | ✓ VERIFIED | `loadPreferences()` chamada uma vez em `start()`; payload `{ ...lastPickedState, answeredId, armEpoch, preferences, fitsWorkArea }` |
| `index.html` | `applyPreferences`, bloco `mola`, `canArm`, cola das molas, formas, 8 temas, material, tipografia | ✓ VERIFIED | Marcadores únicos; script compila em `node:vm` |
| `gate.test.js` | extração `loadInlineBlock`, propriedades da mola, vetores `canArm`, simulação do palco, travas | ✓ VERIFIED | Passa |
| `island.test.js` | `normalizePreferences`, `positionFromSavedOffset`, `isSessionFile` | ✓ VERIFIED | Passa |
| `visual.test.js` | formas, temas, contraste nos 10 casos, material, tipografia | ✓ VERIFIED | Novo, 401 linhas, passa |
| `fixtures/permission-vectors.json` | grupo `canArm` (8 vetores) sem tocar nos existentes | ✓ VERIFIED | Conferido contra `f57113b` |
| `THIRD_PARTY_NOTICES.md` | lista do que vem do mod atualizada | ✓ VERIFIED | Linha cita estilos, nudge, hover, temas, formas, camadas e tamanhos; texto da licença intacto |

### Key Link Verification

| De | Para | Via | Status | Detalhes |
|----|------|-----|--------|----------|
| `main.js` | `state.js` | `normalizePreferences(JSON.parse(fs.readFileSync(PREFERENCES_FILE, 'utf8')))` | WIRED | Linha exata presente |
| `main.js` | `index.html` | `preferences` no payload, `applyPreferences(next.preferences)` e `current.preferences` em `springFrame` | WIRED | Confirmado no DOM falso (estilo `bouncy` lido do payload) |
| `gate.test.js` | `index.html` | `loadInlineBlock` entre `// mola:inicio` e `// mola:fim` | WIRED | Marcadores únicos |
| `gate.test.js` | `fixtures/permission-vectors.json` | `vectors.canArm` | WIRED | 8 vetores executados |
| `main.js` | `state.js` | `positionFromSavedOffset(display.workArea, WINDOW_SIZE, savedOffsets[display.id])` | WIRED | Linha exata presente |
| `visual.test.js` | `index.html`, `state.js` | leitura do `<style>` e `THEMES` | WIRED | Passa |

### Data-Flow Trace (Level 4)

| Artefato | Variável | Fonte | Dados reais | Status |
|----------|----------|-------|-------------|--------|
| `index.html` `springFrame` | `animationStyle`, `animationSpeed` | `preferences.json` → `normalizePreferences` → `island:state` | Sim (arquivo lido pelo main, valor validado) | ✓ FLOWING |
| `index.html` `applyPreferences` | `data-theme`, `data-shape` | mesmo payload | Sim | ✓ FLOWING |
| `index.html` `setSizeTarget` | `target.width/height/contentWidth` | `measurePillTarget` (layout do DOM) | Sim | ✓ FLOWING |
| `index.html` `renderContent` | `current.fitsWorkArea` | `isWithinWorkArea(island.getBounds(), workArea, HORIZONTAL_SLACK)` no main | Sim | ✓ FLOWING |

### Behavioral Spot-Checks

| Comportamento | Comando | Resultado | Status |
|---------------|---------|-----------|--------|
| Suíte completa | `node --test` | 263 passam, 0 falham | ✓ PASS |
| Script inline compila | `node -e "...new vm.Script(s)"` | sem erro | ✓ PASS |
| Mola: crescer, encolher, velocidade, retarget, NaN | script do verificador sobre o bloco extraído | valores da truth 1 e 3 | ✓ PASS |
| Contraste nos 10 casos | conversor independente do verificador | valores da truth 11 | ✓ PASS |
| Cola das molas num DOM falso (laço, armamento, nudge, hover, movimento reduzido, `fitsWorkArea`) | script do verificador executando o script inline | valores das truths 2, 4, 6 e 7; `fitsWorkArea:false` deixou os dois botões desabilitados com `armed` true, `true` os liberou | ✓ PASS |

### Probe Execution

SKIPPED: a fase não declara probes (`scripts/*/tests/probe-*.sh`).

### Requirements Coverage

| Requisito | Plano de origem | Descrição | Status | Evidência |
|-----------|-----------------|-----------|--------|-----------|
| ANIM-01 | 03-01 | Molas assimétricas, passagem 4–8% ao crescer, sem balanço ao encolher, sem salto | ✓ SATISFIED | Truth 1 |
| ANIM-02 | 03-01 | 4 estilos e velocidade 0,5× a 2× | ✓ SATISFIED | Truth 3 (por valor de preferência; seletor chega na Fase 4, como o ROADMAP aceita) |
| ANIM-03 | 03-02 | Nudge ≤ 1 por 0,45 s e hover ≈2,5% | ✓ SATISFIED | Truth 4 |
| ANIM-04 | 03-01, 03-02 | Palco fixo e laço que para sozinho | ✓ SATISFIED | Truths 5 e 6 |
| ANIM-05 | 03-01, 03-02 | Movimento reduzido sem mola nem nudge | ✓ SATISFIED | Truth 2 |
| VIS-01 | 03-03 | 8 temas e automático | ✓ SATISFIED | Truth 8 |
| VIS-02 | 03-02 | 3 formas | ✓ SATISFIED | Truth 9 |
| VIS-03 | 03-03 | Profundidade, sombra e reflexo na cor do estado | ✓ SATISFIED (aparência em backstop) | Truth 10 |
| VIS-04 | 03-03 | Contraste do bloco de permissão e reflexo que não pinta o comando | ✓ SATISFIED | Truth 11 |
| VIS-05 | 03-01, 03-03 | Fontes do sistema, larguras sem medida de fonte fixa | ✓ SATISFIED | Truth 12 |

Todos os 10 IDs do prompt aparecem no frontmatter dos três planos (03-01: ANIM-01, 02, 04, 05 e VIS-05; 03-02: ANIM-03, 04, 05 e VIS-02; 03-03: VIS-01, 03, 04 e 05) e o `REQUIREMENTS.md` mapeia exatamente esses 10 para a Fase 3. Nenhum requisito órfão. Observação de rastreabilidade: o `REQUIREMENTS.md` ainda mostra os 10 como `[ ]`/`Pending`, e a linha da Fase 3 no `ROADMAP.md` ainda está sem marcação; o orquestrador atualiza isso ao fechar a fase.

### Anti-Patterns Found

| Arquivo | Linha | Padrão | Severidade | Impacto |
|---------|-------|--------|------------|---------|
| (nenhum) | - | `TBD`, `FIXME`, `XXX`, `TODO`, `HACK` em `index.html`, `main.js`, `state.js` e nos três arquivos de teste | - | Nenhum marcador de dívida |

Sem stubs: os retornos vazios e os valores iniciais encontrados (`springs`, `current`, `hovering`) são estado inicial sobrescrito por dados reais, como o Data-Flow Trace mostra.

### Achados do code review ainda abertos (não bloqueantes)

Estado dos 9 achados do `03-REVIEW.md`, conforme o `03-REVIEW-FIX.md` e o código atual:

| Achado | Estado | Nota |
|--------|--------|------|
| WR-01 `preferences.json` lido como sessão | Corrigido (`b8a7d57`) | `isSessionFile` em `state.js`, usado por `readSessions`; confirmado no diff |
| WR-02 monitor baixo recusa decisão sem aviso | Corrigido (`746b75f`) | `fitsWorkArea` só desabilita (nenhuma atribuição `disabled = false` na trava); confirmado no DOM falso. Pede olhada humana (item 8) |
| WR-03 Linux: retângulo invisível de 520×410 bloqueia cliques | Pulado, documentado | Linux é melhor esforço; vai para o checklist do PR (registro de plataforma do 03-02). Não contradiz nenhuma truth da fase |
| WR-04 modelo de altura sem o rótulo da ferramenta | Corrigido (`b01d03f`) | `overflow-wrap: anywhere` e linhas do rótulo no `pillMaxHeight`; usa largura média 0,6 em (estimativa). Pede olhada humana (item 9) |
| IN-01 `--done-button` com 4,40:1 | Aberto | Cor travada pela Key Decision; fora do bloco de permissão |
| IN-02 leitura do `preferences.json` sem limite de tamanho | Aberto | Exige escrita local; improvável |
| IN-03 escala do hover presa se o movimento reduzido liga no meio | Aberto | Só visual, não afeta o gate |
| IN-04 notch: nudge de −6 px sai pelo topo e é recortado | Aberto | Aceito explicitamente no plano 03-02 (Assumptions) |
| IN-05 travas de hover só cobrem propriedades de transformação | Aberto | Registro; o próprio arquivo avisa que as travas de texto são frágeis |

### Human Verification Required

Os 9 itens estão no frontmatter (`human_verification`): os 7 backstops dos planos e as 2 correções do review que pedem olhada humana. O item 4 (125% e 150% de escala) é **bloqueante para o merge do PR**, conforme o plano 03-02.

### Gaps Summary

Nenhum gap bloqueante: nenhuma truth falhou, nenhum artefato é stub ou está desligado, nenhum link quebrado, e as proibições têm enforcement. O que resta é humano por natureza (aparência e sensação de movimento, DPI fracionária em monitor real) e foi dispensado na execução.

Um aviso (WARNING, não gap): o comportamento da cola das molas no DOM (o laço que para sozinho, o armamento só com as molas paradas, o nudge e o hover suprimidos com pedido na tela, o movimento reduzido) é protegido no repositório apenas por travas de texto sobre o fonte e por testes dos predicados puros. Nenhum teste commitado executa a cola. Eu a executei num DOM falso com um script do verificador (fora do repositório, sem layout real: os retângulos dos botões ficaram estáticos), e o comportamento bateu em todos os cenários, então marquei as truths 2, 4, 6 e 7 como verificadas. Mas uma mutação na cola que preserve o texto travado ainda sobreviveria à suíte, o mesmo ponto que a verificação da Fase 2 já registrou. Vale considerar um teste `node:vm` com DOM falso, no molde do que usei, numa fase futura.

---

_Verificado: 2026-11-21_
_Verificador: Claude (gsd-verifier)_
