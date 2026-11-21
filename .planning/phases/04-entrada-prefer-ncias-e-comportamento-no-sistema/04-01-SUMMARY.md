---
phase: 04-entrada-prefer-ncias-e-comportamento-no-sistema
plan: 01
subsystem: preferencias
tags: [electron, menu-nativo, ipc, preferencias, escrita-atomica, quarentena]

requires:
  - phase: 03
    provides: preferences.json de leitura (tema, forma, estilo, velocidade), refresh('rearm') e o payload de island:state
provides:
  - menu nativo de clique direito (Tema, Forma, Estilo da animação, Velocidade da animação) montado pelo main
  - menuTemplate, PREFERENCE_LABELS e ANIMATION_SPEED_STEPS em state.js
  - esquema completo de 11 chaves com validador por chave e normalizePreferences por esquema
  - leitura tolerante com teto de 64 KB e quarentena preferences.json.<carimbo>.bad
  - writeFileAtomic (.tmp + rename) para preferences.json e positions.json
  - canal island:menu (sem argumentos) e window.island.openMenu()
affects: [04-02, 04-03, 04-04, 04-05, 04-06]

actuals:
  tokens: 6000
  tasks: 2
  commits: 4

plan_head_before: bce0b030a06fb9064253da1af617c83558c87e12
plan_head_after: 36efbe29ecf7a24defa4c80bcae5c8bdfb0fe049

tech-stack:
  added: []
  patterns:
    - "modelo de menu puro em state.js (itens planos com key/value) e main.js que o traduz em Menu com click"
    - "escrita atômica única (writeFileAtomic) para todo arquivo gravado pelo main, fora o caminho do gate"
    - "quarentena com carimbo de tempo para arquivo editável à mão que não pôde ser lido"

key-files:
  created: [prefs.test.js]
  modified: [state.js, main.js, preload.js, index.html, gate.test.js, island.test.js]

key-decisions:
  - "applyPreference é o único caminho de mudança de preferência em tempo de execução e termina em refresh('rearm'); nenhum handler de IPC o chama (trava em gate.test.js)"
  - "menu-will-show e menu-will-close rearmam os botões, porque o clique que fecha o menu pode cair em Permitir ou Negar"
  - "arquivo de preferências inválido ou acima de 64 KB vai para <arquivo>.<carimbo>.bad em vez de ser sobrescrito pela próxima gravação"
  - "positions.json passou a ser gravado por .tmp + rename"

patterns-established:
  - "Trava de texto no gate.test.js muda só de propósito, no mesmo commit do código, e o corpo do commit diz qual"
  - "Novo valor de menu entra com o efeito dele: o teste genérico de menuTemplate usa o mapa VALUES_BY_KEY de prefs.test.js"

requirements-completed: [PREF-01, PREF-02]

coverage:
  - id: D1
    description: "Clique direito na pílula abre menu nativo com Tema, Forma, Estilo e Velocidade da animação, valor atual marcado"
    requirement: PREF-01
    verification:
      - kind: unit
        ref: "prefs.test.js#todo submenu com chave oferece exatamente a lista da chave, com um só marcado: o valor atual"
        status: pass
      - kind: unit
        ref: "gate.test.js#o menu só abre por pedido sem argumentos, um por vez, e rearma ao abrir e ao fechar"
        status: pass
    human_judgment: true
    rationale: "O menu nativo sobre uma janela focusable: false só se confirma numa pessoa na tela (CHK-03, lista Testar manualmente do plano 06)"
  - id: D2
    description: "Escolha gravada em preferences.json por .tmp + rename e aplicada pelo refresh('rearm')"
    requirement: PREF-02
    verification:
      - kind: unit
        ref: "gate.test.js#o main lê as preferências uma vez, não as vigia e só as grava pelo menu, por .tmp e rename"
        status: pass
    human_judgment: false
  - id: D3
    description: "Esquema de 11 chaves, cada valor inválido no padrão, imune a __proto__ e herança"
    requirement: PREF-02
    verification:
      - kind: unit
        ref: "prefs.test.js#__proto__ e herança não entram: só chave própria do esquema conta"
        status: pass
      - kind: unit
        ref: "prefs.test.js#o resultado tem exatamente as chaves do esquema, na ordem, sem chave extra nem mutar a entrada"
        status: pass
    human_judgment: false
  - id: D4
    description: "Arquivo corrompido ou acima de 64 KB vai para quarentena com carimbo de tempo e a ilha sobe com os padrões"
    requirement: PREF-02
    verification:
      - kind: unit
        ref: "prefs.test.js#quarantinePath leva o carimbo de tempo e nunca repete caminho"
        status: pass
      - kind: unit
        ref: "gate.test.js#o main lê as preferências uma vez, não as vigia e só as grava pelo menu, por .tmp e rename"
        status: pass
    human_judgment: true
    rationale: "A leitura em main.js depende do Electron e só tem trava de texto; o caminho de quarentena em execução real não foi exercido (proibido iniciar a ilha nesta execução)"

duration: 25min
completed: 2026-11-21
status: complete
story_points_realized: 5
---

# Phase 4 Plan 01: Menu de preferências e leitura tolerante Summary

**Menu nativo de clique direito (tema, forma, estilo e velocidade) que grava preferences.json por .tmp + rename e rearma os botões ao abrir, fechar e escolher, com esquema de 11 chaves e quarentena `.bad` com carimbo para arquivo corrompido ou acima de 64 KB.**

## Performance

- **Duration:** 25 min
- **Tasks:** 2 (1 traçador, 1 auto/TDD)
- **Files modified:** 7 (1 novo)
- **Testes:** 263 na base, 289 ao final, `fail 0`

## Accomplishments

- Traçador ponta a ponta: `contextmenu` na pílula pede `island:menu` sem argumentos; o main abre o menu nativo montado por `menuTemplate`, a escolha passa por `applyPreference`, `writeFileAtomic` e `refresh('rearm')`, e o renderer aplica pelo payload de `island:state`.
- `menu-will-show` e `menu-will-close` rearmam Permitir e Negar (T-04-01); um menu por vez via `menuIsland`, liberado também quando `popup` lança.
- Esquema completo (D-06): `expandOn`, `pinExpanded`, `opacity`, `anchor`, `islandMode`, `shortcut`, `version`, com `PREFERENCE_VALIDATORS` e `normalizePreferences` por esquema (`Object.hasOwn`, padrão por chave, sempre as 11 chaves na ordem).
- Leitura tolerante (D-07): `loadPreferences` nunca lança; ausente vale padrão sem log; JSON inválido ou acima de `PREFERENCES_MAX_BYTES` vai para `quarantinePath(PREFERENCES_FILE, Date.now())`.
- `positions.json` passou a ser gravado por `writeFileAtomic`.
- Atalho padrão `Control+Alt+Shift+C` registrado no esquema (D-10), com a medição do ABNT2 comentada.

## Task Commits

1. **Task 1 (traçador), RED:** `518c0c0` test(menu): cobre o modelo do menu de preferências
2. **Task 1 (traçador), GREEN:** `5ddf808` feat(menu): abre o menu de preferências no clique direito e grava a escolha
3. **Task 2, RED:** `a89b6b4` test(preferencias): cobre o esquema completo e a quarentena do arquivo
4. **Task 2, GREEN:** `36efbe2` feat(preferencias): completa o esquema e lê o arquivo sem nunca impedir a subida

Tracer gate: `<verify>` só tem `<automated>`; re-executado de ponta a ponta (suíte inteira e compilação do script inline em `node:vm`) e passou antes da Task 2.

## Travas alteradas de propósito (gate.test.js)

- `RENDERER_CHANNELS` ganhou `island:menu` (8 canais); handlers de IPC passaram de 6 para 7 (commit `5ddf808`).
- O teste de leitura/gravação de preferências foi reescrito: grava só por `writeFileAtomic(PREFERENCES_FILE`, `.tmp` + `renameSync` (commit `5ddf808`); a linha de leitura passou a `preferences = normalizePreferences(JSON.parse(text));` com teto e quarentena exigidos, e `positions.json` só por `writeFileAtomic` (commit `36efbe2`).
- Travas novas: o menu só abre sem argumentos, um por vez, rearmando ao abrir e fechar; nenhum handler de IPC chama `applyPreference`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Registro de base do plano fora do git-dir**
- **Found during:** início da Task 1
- **Issue:** o ledger `gsd-plan-head-before-04-01` ficaria em `.git/worktrees/...` dentro do checkout do autor (`D:/.../claude-island/.git`), proibido pelas regras desta execução.
- **Fix:** a base foi registrada no frontmatter (`plan_head_before: bce0b03...`) e `commits:` medido com `git rev-list --count bce0b03..HEAD` (= 4).
- **Files modified:** nenhum
- **Commit:** n/a

**Total deviations:** 1 (processo apenas, sem efeito no código). **Impact:** nenhum.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None. Os limites de confiança novos (menu nativo, arquivo de preferências) são os do `<threat_model>` do plano, T-04-01 a T-04-05, todos com a mitigação implementada e travada.

## Testar manualmente (não coberto por teste, vai para o plano 06)

- Clique direito na pílula abre o menu nativo no cursor, com os quatro submenus e o valor atual marcado (CHK-03).
- Com um pedido de permissão na tela, abrir o menu e fechá-lo clicando sobre Permitir ou Negar não decide; os botões voltam a armar após 0,8 s.
- Escolher um valor, reiniciar a ilha e ver a escolha de volta.
- Editar `~/.claude/island/preferences.json` para JSON inválido e subir a ilha: aparece `preferences.json.<carimbo>.bad` ao lado.

## Next Phase Readiness

Pronto para o plano 02 (cursor e hover): `menuTemplate`, `applyPreference` e `writeFileAtomic` existem; os itens 'Expandir' e 'Fixar aberta' entram lá, com uma linha nova em `VALUES_BY_KEY` de `prefs.test.js`.

## Self-Check: PASSED
