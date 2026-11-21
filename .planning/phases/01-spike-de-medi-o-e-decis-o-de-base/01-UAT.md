---
status: testing
phase: 01-spike-de-medi-o-e-decis-o-de-base
source: [01-VERIFICATION.md]
started: 2026-11-21T05:00:00Z
updated: 2026-11-21T05:00:00Z
---

## Current Test

number: 1
name: Halo interno do brilho (D-03)
expected: |
  O contorno pulsa por dentro da pílula, em laranja (trabalhando) e âmbar (precisa de você), sem halo externo
  e sem pintar o texto do pedido; com a ilha ociosa nada pisca. Não clicar em Permitir/Negar.
awaiting: user response

## Tests

### 1. Halo interno do brilho (D-03)
expected: Rodar `powershell -NoProfile -File scripts/measure-footprint.ps1 -Label olhar -App . -Scenarios running -Runs 1 -WarmupSeconds 60 -Seconds 10 -OutDir "$env:TEMP\olhar"` e olhar a pílula; repetir com `-Scenarios waiting`. O contorno pulsa por dentro, em laranja (running) e âmbar (waiting), sem halo externo e sem pintar o texto do pedido; ociosa nada pisca. Só olhar: não clicar em Permitir/Negar.
result: [pending]

### 2. Sem animação com a ilha ociosa ou escondida (runtime)
expected: `document.getAnimations().length` = 0 com a ilha ociosa e animações pausadas com a janela escondida. Evidência por CDP numa instância descartável já registrada em 01-01-SUMMARY.md (escondida simulada via visibilitychange); falta observar com um hide() real, que só existirá com o "esconder" da Fase 4.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
