---
gsd_state_version: "1.0"
current_phase: 4
current_phase_name: Palco fixo, animação e visual
status: human_needed
stopped_at: Phase 4 context gathered
last_updated: "2026-11-21T16:41:05.543Z"
last_activity: 2026-11-21
last_activity_desc: Fase 3 executada (3 planos), revisão com 3 correções, verificação human_needed, segurança 17/17; PR aberto
state_head: ddda2e471b90a035054c475835cb3498649ea867
progress:
  total_phases: 6
  completed_phases: 2
  total_plans: 17
  completed_plans: 11
  percent: 33
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-11-21)

**Core value:** Saber de relance o que cada sessão do Claude Code está fazendo e responder ao que ela pede sem trocar de janela, sem nunca aprovar algo que o usuário não viu.
**Current focus:** Phase 3 — Palco fixo, animação e visual

## Current Position

Phase: 4 (Palco fixo, animação e visual) — READY TO EXECUTE
Status: 3/3 planos executados; verificação human_needed (9 itens visuais em 03-UAT.md, 1 bloqueante: 125%/150%); segurança threats_open 0
Last activity: 2026-11-21 — Fase 3 entregue em PR, sem merge

Progress: [███░░░░░░░] 33%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 1 P01 | 25min | 3 tasks | 6 files |
| Phase 1 P02 | 30min | 3 tasks | 12 files |
| Phase 1 P03 | 85min | 3 tasks | 18 files |
| Phase 1 P04 | 5min | 3 tasks | 0 files |
| Phase 02 P01 | 3min | 2 tasks | 6 files |
| Phase 02 P02 | 4min | 2 tasks | 4 files |
| Phase 02 P03 | 14min | 2 tasks | 3 files |
| Phase 02 P04 | 10min | 3 tasks | 5 files |

## Accumulated Context

### Decisions

Decisões ficam na tabela Key Decisions do PROJECT.md. Decisões recentes que afetam o trabalho atual:

- [Roadmap]: Electron permanece como base, salvo se o Tauri passar a regra de decisão inteira da Fase 1 (regra escrita antes de medir)
- [Roadmap]: Gate de permissão (Fase 2) antes de qualquer feature que mude a tela; Fases 2 e 3 são portáveis, 4 a 6 dependem da base
- [Roadmap]: CONV-04 (aviso MIT do mod) mora na Fase 2 para existir antes das primeiras constantes portadas (molas, Fase 3)
- [Roadmap]: Fase "Port para Tauri" não é numerada; vira Fase 3.1 só se o spike escolher Tauri
- [Roadmap]: Convivência com o Windhawk (Fase 6) é a única cortável; plano B é âncora e deslocamento manuais da Fase 4
- [Phase 02]: 02-01: o alvo da decisão é sempre o pedido exibido no main; o eco do renderer só pode recusar (echo-mismatch)
- [Phase 02]: 02-01: decidedPermissionId só é marcado depois de writeDecision; coveredByFullscreen é constante false até a Fase 4 (TELA-01)
- [Phase 02]: O pedido exibido (id, since, epoch) só é atribuído dentro de refresh(reason); retorno antecipado compara estado e época para não engolir o rearme
- [Phase 02]: Plano 02-03: regras puras do renderer ficam inline entre marcadores regras-do-gate e são testadas por extração em node:vm vazio; a CSP não muda
- [Phase 02]: Plano 02-03: isValidRelease exige a mesma geração de armamento (armToken) do pointerdown; armed sozinho não pega rearme que volta a armar no meio do gesto
- [Phase 02]: 02-04: sem trava de process.sandboxed no preload (A7 não verificada, sem Electron); reavaliar na UAT-1
- [Phase 02]: 02-04: aviso MIT validado comparando o corpo com o LICENSE do repositório, sem rede
- [Phase 1]: Validade de janela (D-10) com tolerância de 2% no tamanho: o Electron abre a janela a 125% com 550x410, não 550x405; errata commitada antes de qualquer medição
- [Phase 1]: Regra Electron x Tauri commitada em spike/REGRA-DE-DECISAO.md antes de existir spike/results; o medidor recusa gravar lá sem ela
- [Phase 1]: Medidor ignora a janela interna do Tao ('Tao Thread Event Target', 16x16) e aceita -Exe sem argumentos; sem isso o T0 sairia inválido pela D-10
- [Phase 1]: Etapa 1 reprovada: T0 de 117,6% a 136,7% do WS de E3 e CPU ociosa acima; base continua Electron, sem Etapa 2 nem fase 3.1 (só Windows)
- [Phase 1]: E2 inelegível (capturas PrintWindow pretas com --in-process-gpu); E_ref = E3
- [Phase 1]: Plano 01-04: Etapa 2 pulada (Etapa 1 reprovada, D-04/BASE-03); Task 3 pending-human, halo D-03 a conferir pelo autor no PR

### Pending Todos

None yet.

### Blockers/Concerns

- [Fase 1]: Nenhum número de Tauri existe neste projeto; os 426 MB atuais têm método não registrado, então o Electron atual precisa ser medido de novo com o mesmo script
- [Fase 2]: Titular exato do copyright do mod e origem da paleta Nord precisam ser lidos no `LICENSE` do repositório do autor antes de portar constantes
- [Fase 4]: AltGr+C no ABNT2, `Menu.popup` em janela `focusable:false` e `koffi` no Electron 45 com pnpm 11 ainda não foram verificados
- [Fase 5]: Se o hook não grava `cwd`/nome do projeto, o rótulo da sessão exige mudança de contrato no hook
- [Fase 6]: Classe da janela do Windhawk e se o Electron reafirma o topo sozinho não foram confirmados
- [Geral]: macOS e Linux nunca foram testados; qualquer decisão de base declara que vale para o Windows

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-11-21T15:22:45.676Z
Stopped at: Phase 4 context gathered
Resume file: .planning/phases/04-entrada-prefer-ncias-e-comportamento-no-sistema/04-CONTEXT.md
