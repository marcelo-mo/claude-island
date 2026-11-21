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
| HOV-01 | `hoverStep`: histerese, borda ±1–3 px, retângulo escalado, entrada inválida | unit (vm sobre bloco do `index.html`) | `node --test hover.test.js` | ❌ W0 |
| HOV-02 | canais travados (`island:capture`, `island:cursor`, `island:menu`); sem `forward`; contagem de handlers; remetente conferido | texto | `node --test gate.test.js` | ✅ atualizar travas |
| HOV-03 | `expandOn`/`pinExpanded` na regra de expansão | unit | `node --test island.test.js` | ✅ acrescentar |
| HOV-04 | arraste mantém captura; duplo clique e botões intactos; gate verde | texto + gate | `node --test gate.test.js` | ✅ |
| PREF-01 | itens e valores de constantes; `Menu.popup({ window })`; sem canal de gravação | texto | `node --test gate.test.js` | ✅ |
| PREF-02 | `normalizePreferences` estendido: vazio, truncado, tipos errados, formato da Fase 3, `__proto__`, `opacity:0`, `animationSpeed:0`; gravação temp+rename e `.bad` | unit | `node --test prefs.test.js` | ❌ W0 |
| PREF-03 | status do atalho `ok`/`unavailable`/`invalid`; padrão sem conflito AltGr | unit | `node --test prefs.test.js` | ❌ W0 |
| PREF-04 | `anchorPosition` das 6 âncoras, clamp, base a 125%, zerar deslocamentos | unit | `node --test island.test.js` | ✅ acrescentar |
| PREF-05 | `islandDisplays` por modo; cursor só sem pedido | unit | `node --test island.test.js` | ✅ acrescentar |
| PREF-06 | `effectiveOpacity` + trava de que `refresh` aplica no mesmo passo do pedido | unit + texto | `node --test gate.test.js` | ✅ |
| TELA-01 | `nextFullscreen`: cobre/não cobre, desktop/ilha ignoradas, HWND lembrado, soltar | unit | `node --test island.test.js` | ✅ acrescentar |
| TELA-02 | `acceptDecision` recusa `window-hidden`/`covered-by-fullscreen`; fato vem do main por display; reexibir rearma | vetores + texto | `node --test gate.test.js` | ✅ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `hover.test.js` — extração do bloco `hover:inicio/fim` por `node:vm` (padrão de `gate.test.js`)
- [ ] `prefs.test.js` — `normalizePreferences` estendido, persistência em `os.tmpdir()`, status do atalho
- [ ] vetores novos em `fixtures/permission-vectors.json` só para o que toca o gate (`isWithinWorkArea` a 125% embaixo); vetores existentes não mudam
- [ ] travas de `gate.test.js` atualizadas de propósito no mesmo commit de cada mudança (`RENDERER_CHANNELS`, contagem de handlers, `coveredByFullscreen`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Hover e roda com terminal elevado em foco | HOV-02 | UIPI só se prova com janela elevada real | CHK-01 da pesquisa (`scripts/human-checks.js --mode=hover`) |
| AltGr+C não dispara o atalho | PREF-03 | Tecla sintética é proibida | CHK-02 (`--mode=hotkey`) |
| Menu: abre perto do cursor, fecha ao clicar fora, clique não atravessa armado | PREF-01 | Precisa de clique real | CHK-03 |
| 125%: sem piscar na borda, arraste, duplo clique, botões, âncora de baixo | HOV-01/04, PREF-04 | Monitor secundário real | CHK-04 |
| Tela cheia some e volta; pedido só toca som | TELA-01/02 | Vídeo F11 real | CHK-05, CHK-06 |
| Roda sobre a pílula com app elevado em foco | HOV-02 | Insumo da Fase 5 | CHK-07 |
| komorebi não retila ao esconder/mostrar | TELA-01 | Gerenciador de janelas do autor | CHK-08 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
