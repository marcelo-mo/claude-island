---
phase: "2"
slug: "funda-o-segura-do-gate-de-permiss-o"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-21"
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict` (embutidos) |
| **Config file** | none — `node --test` descobre `*.test.js` |
| **Quick run command** | `node --test gate.test.js` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test gate.test.js`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd-verify-work`:** Full suite must be green + UAT-1..6 (ver 02-RESEARCH.md § Validation Architecture)
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

Preenchido pelos planos (cada tarefa traz `<automated>` + `<fails_when>`). Mapa por requisito:

| Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|-----------------|-----------|-------------------|-------------|--------|
| SEG-01 | eco ausente/divergente recusa; alvo é sempre o id exibido no main | unit (vetores) | `node --test gate.test.js` | ❌ W0 | ⬜ pending |
| SEG-02 | troca de pedido reinicia `since`; caminho único de escrita | unit | `node --test gate.test.js` | ❌ W0 | ⬜ pending |
| SEG-03 | desarmado < 800 ms; relógio para trás recusa | unit (vetores) | `node --test gate.test.js` | ❌ W0 | ⬜ pending |
| SEG-04 | segunda decisão para o mesmo id recusada | unit (vetores) | `node --test gate.test.js` | ❌ W0 | ⬜ pending |
| SEG-05 | opacidade efetiva 1 com pedido na tela | unit | `node --test gate.test.js` | ❌ W0 | ⬜ pending |
| SEG-06 | janela escondida/coberta/fora da área recusa | unit | `node --test gate.test.js` | ❌ W0 | ⬜ pending |
| SEG-07 | vetores JSON carregam e batem com a regra | unit | `node --test gate.test.js` | ❌ W0 | ⬜ pending |
| SEG-08 | `webPreferences` explícitas; lista fechada de canais | unit + fonte | `node --test gate.test.js` | ❌ W0 | ⬜ pending |
| CONV-04 | notices com titular, versão e MIT | unit | `node --test gate.test.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `fixtures/permission-vectors.json` — vetores dourados (SEG-07, base de SEG-01/03/04/06)
- [ ] `gate.test.js` — testes dos SEG automatizáveis e CONV-04
- [ ] Funções puras em `state.js` que os testes exercitam

*Sem instalação de framework.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Ilha sobe sob `sandbox: true` explícito | SEG-08 | precisa do Electron rodando | UAT-1 |
| Armar só com layout assentado, cursor parado, sem ampliação de hover | SEG-03 | timing do renderer | UAT-2 |
| Pedido muda no clique: nada vale | SEG-01/02 | corrida real | UAT-3 |
| Duas ilhas: só o primeiro clique vale | SEG-04 | 2 monitores | UAT-4 |
| Roda só no texto; inércia não conta como leitura | SEG-05 | eventos de roda reais | UAT-5 |
| Pílula 100% opaca com pedido | SEG-05 | visual | UAT-6 |

UAT usa o `permission-hook.js` real por `stdin` (sem tocar em `~/.claude/settings.json`) e exige combinar horário com a sessão da Fase 1, que mede a ilha.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
