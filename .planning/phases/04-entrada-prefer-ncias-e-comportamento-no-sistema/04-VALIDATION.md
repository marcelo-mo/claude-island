---
phase: "4"
slug: "entrada-prefer-ncias-e-comportamento-no-sistema"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-21"
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict` (Node do sistema) |
| **Config file** | nenhum (`package.json`: `"test": "node --test"`) |
| **Quick run command** | `node --test gate.test.js` + o arquivo de teste da tarefa |
| **Full suite command** | `pnpm test` (baseline: 263 passam, 0 falham, ~0,5 s) |
| **Estimated runtime** | ~1 segundo |

---

## Sampling Rate

- **After every task commit:** `node --test gate.test.js` e o arquivo da tarefa
- **After every plan wave:** `pnpm test`
- **Before `/gsd-verify-work`:** suíte inteira verde (≥263 + novos)
- **Max feedback latency:** 5 segundos

---

## Per-Task Verification Map

Preenchido pelo planejador em cada PLAN.md (`<automated>` por tarefa). Mapa por requisito, da pesquisa:

| Requirement | Behavior | Test Type | Automated Command | File Exists |
|-------------|----------|-----------|-------------------|-------------|
| HOV-01 | `hoverStep`: histerese, borda ±1–3 px, retângulo escalado, entrada inválida | unit (vm sobre bloco do `index.html`) | `node --test hover.test.js` | ✅ `hover.test.js` (04-02) |
| HOV-02 | canais travados (`island:capture`, `island:cursor`, `island:menu`); sem `forward`; contagem de handlers; remetente conferido | texto | `node --test gate.test.js` | ✅ atualizar travas |
| HOV-03 | `expandOn`/`pinExpanded` na regra de expansão | unit | `node --test island.test.js` | ✅ acrescentar |
| HOV-04 | arraste mantém captura; duplo clique e botões intactos; gate verde | texto + gate | `node --test gate.test.js` | ✅ |
| PREF-01 | itens e valores de constantes; `Menu.popup({ window })`; sem canal de gravação | texto | `node --test gate.test.js` | ✅ |
| PREF-02 | `normalizePreferences` estendido: vazio, truncado, tipos errados, formato da Fase 3, `__proto__`, `opacity:0`, `animationSpeed:0`; gravação temp+rename e `.bad` | unit | `node --test prefs.test.js` | ✅ `prefs.test.js` (04-01) |
| PREF-03 | status do atalho `ok`/`unavailable`/`invalid`; padrão sem conflito AltGr | unit | `node --test prefs.test.js` | ✅ `prefs.test.js` (04-04); AltGr+C só em CHK-02 |
| PREF-04 | `anchorPosition` das 6 âncoras, clamp, base a 125%, zerar deslocamentos | unit | `node --test island.test.js` | ✅ acrescentar |
| PREF-05 | `islandDisplays` por modo; cursor só sem pedido | unit | `node --test island.test.js` | ✅ acrescentar |
| PREF-06 | `effectiveOpacity` + trava de que `refresh` aplica no mesmo passo do pedido | unit + texto | `node --test gate.test.js` | ✅ |
| TELA-01 | `nextFullscreen`: cobre/não cobre, desktop/ilha ignoradas, HWND lembrado, soltar | unit | `node --test island.test.js` | ⚠️ parcial: regra pura testada em `island.test.js` (04-05); sem sensor, a ilha não some em tela cheia (D-20, escolha do autor pendente) |
| TELA-02 | `acceptDecision` recusa `window-hidden`/`covered-by-fullscreen`; fato vem do main por display; reexibir rearma | vetores + texto | `node --test gate.test.js` | ⚠️ parcial: vale no ramo "escondida pelo usuário"; o ramo "em tela cheia" espera o sensor do TELA-01 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `hover.test.js` — extração do bloco `hover:inicio/fim` por `node:vm` (padrão de `gate.test.js`)
- [ ] `prefs.test.js` — `normalizePreferences` estendido, persistência em `os.tmpdir()`, status do atalho
- [ ] vetores novos em `fixtures/permission-vectors.json` só para o que toca o gate (`isWithinWorkArea` a 125% embaixo); vetores existentes não mudam
- [ ] travas de `gate.test.js` atualizadas de propósito no mesmo commit de cada mudança (`RENDERER_CHANNELS`, contagem de handlers, `coveredByFullscreen`)

---

## Manual-Only Verifications

Lista "Testar manualmente" do PR. Os itens com `--mode` usam `scripts/human-checks.js`, que só escuta e recusa rodar com a ilha no ar: **pare a ilha antes de CHK-01 e CHK-02** (encerre o `electron.exe` da pasta do repositório e espere cerca de 6 s).

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Hover e roda com terminal elevado em foco | HOV-02 | UIPI só se prova com janela elevada real | CHK-01, ilha parada: `node_modules\electron\dist\electron.exe scripts\human-checks.js --mode=hover`, uma vez com terminal comum e outra com o Gerenciador de Tarefas (elevado) em foco, nos monitores a 100% e a 125%; esperado: com o elevado o contador do DOM para e o do polling segue |
| AltGr+C não dispara o atalho padrão | PREF-03 | Tecla sintética é proibida | CHK-02, ilha parada: `node_modules\electron\dist\electron.exe scripts\human-checks.js --mode=hotkey`, digitar AltGr+C e Ctrl+Alt+Shift+C; `tomado-por-outro-processo` invalida a rodada |
| Menu: abre perto do cursor, fecha ao clicar fora, o clique que fecha não aprova, escolher item não tira o foco do terminal | PREF-01 | Precisa de clique real | CHK-03; se o menu nativo reprovar, o fallback é um menu em HTML no palco (D-08), fora desta fase |
| 125%: sem piscar na borda, arraste, duplo clique, Permitir e Negar, âncora de baixo sem recusa | HOV-01/04, PREF-04 | Monitor secundário real | CHK-04 |
| Tela cheia some e volta | TELA-01 | Vídeo F11 real | CHK-05, **pendente do sensor** (TELA-01): hoje a ilha continua por cima do app em tela cheia, como antes da fase |
| Som com a ilha escondida pelo atalho por cerca de 10 minutos | TELA-02 | Só o ouvido confirma | CHK-06 |
| Roda sobre a pílula com app elevado em foco | HOV-02 | Insumo da Fase 5 | CHK-07 |
| komorebi não retila ao esconder e mostrar várias vezes | PREF-03 | Gerenciador de janelas do autor | CHK-08 |
| Respiro da pílula expandida: com hover em "Trabalhando", a linha de cima (ponto e título à esquerda; pontos, anel e percentual à direita) não encosta nos cantos curvos | Fase 3 (visual) | Julgamento visual | Commit `ddda2e4` (pedido do autor): temas claro e escuro, forma pílula; respiro lateral de 24 px e raio máximo de 36 px (12 + 24, concêntrico com o bloco de pedido); a recolhida não muda |
| Cada item do menu muda a ilha e volta igual depois de reiniciar | PREF-01/02 | Precisa de reinício real | Escolher cada valor e reiniciar a ilha; JSON inválido em `preferences.json` gera `preferences.json.<carimbo>.bad` |
| As 6 âncoras: a compacta encosta no canto; o Elástico a 2× não recorta; com a âncora de baixo, Elástico a 0,5× e um pedido chegando com o cursor em cima, a sombra de cima pode perder cerca de 6 px da borda fraca | PREF-04 | Julgamento visual | Menu "Âncora" (04-03) |
| Transparência a 85, 70 e 55%: texto legível; com pedido na tela volta a 100% | PREF-06 | Julgamento visual | Se o texto a 55% não ler bem, a troca para "só o preenchimento" é a ideia adiada de D-16 |
| Notch com âncora de baixo (topo reto flutuando 40 px acima da base) | PREF-04 | Julgamento visual | Aparência aceita ou não |
| "Ilhas" no modo cursor troca de monitor sem pedido e fica parada com pedido | PREF-05 | Dois monitores reais | Com DPI diferente, a ilha mantém o tamanho físico; se a janela crescer cerca de 25%, recriar em vez de mover |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
