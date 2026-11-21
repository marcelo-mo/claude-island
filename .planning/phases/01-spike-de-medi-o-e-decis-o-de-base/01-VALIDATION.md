---
phase: "1"
slug: "spike-de-medi-o-e-decis-o-de-base"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-21"
---

# Phase 1 — Validation Strategy

> Contrato de validação da fase. Detalhes em `01-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict` (Node do sistema) |
| **Config file** | nenhum (`pnpm test` = `node --test`) |
| **Quick run command** | `node --test animation.test.js scripts/spike-verdict.test.js` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~5 segundos |

---

## Sampling Rate

- **After every task commit:** `node --test animation.test.js` (e `scripts/spike-verdict.test.js` quando existir)
- **After every plan wave:** `pnpm test`
- **Before `/gsd-verify-work`:** `pnpm test` verde, ordem do git provada (regra antes dos resultados), JSONs de resultado presentes
- **Max feedback latency:** 10 segundos (a medição em si leva minutos e não entra no laço de feedback)

---

## Per-Task Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists |
|-------------|----------|-----------|-------------------|-------------|
| BASE-02 | Regra commitada antes do primeiro resultado | git | `git merge-base --is-ancestor <commit da regra> <primeiro commit de spike/results>` | ❌ W0 |
| BASE-05 | Keyframes só `opacity`/`transform`; `#pill` em idle sem animação | unit (estático) | `node --test animation.test.js` | ❌ W0 |
| BASE-05 | Idle = 0 animações; escondida = pausada | integração (CDP) | `document.getAnimations()` numa instância isolada | evidência no SUMMARY |
| BASE-01 | Script roda cenários × execuções e grava JSON com medianas | smoke | `powershell -File scripts/measure-footprint.ps1 ... -Runs 1 -Seconds 6` | ❌ W0 |
| BASE-03 | Veredito puro da regra | unit | `node --test scripts/spike-verdict.test.js` | ❌ W0 |
| BASE-03 | Tabela E0/E1/E3/(E2)/T0 | dados | `node scripts/spike-verdict.js spike/results` | ❌ W0 |
| BASE-04 | Decisão e números no PROJECT.md | grep | `grep -n "Tauri" .planning/PROJECT.md` | n/a |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `spike/REGRA-DE-DECISAO.md` — BASE-02 (primeiro commit da execução)
- [ ] `animation.test.js` — BASE-05
- [ ] `scripts/measure-footprint.ps1` — BASE-01
- [ ] `scripts/spike-verdict.js` + `scripts/spike-verdict.test.js` — BASE-03

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Halo interno do brilho aceitável no lugar do externo | BASE-05 | Julgamento visual | Rodar a ilha e olhar os estados trabalhando e precisa de você |
| Gates funcionais F1–F4 (flash, hover, foco, vídeo em tela cheia) | BASE-02/03 | Exigem olho humano e os 2 monitores | Só existem se a Etapa 1 numérica passar |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
