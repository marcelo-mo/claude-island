---
status: testing
phase: 06-conviv-ncia-com-a-ilha-do-sistema
source: [06-VERIFICATION.md]
started: 2026-11-21T00:00:00Z
updated: 2026-11-21T00:00:00Z
---

## Current Test

number: 1
name: Convivência medida por 5 minutos (CHK-61)
expected: |
  Com a ilha do mod visível e a nossa em "Ao lado da ilha do sistema, à direita" com uma sessão na tela,
  `powershell -NoProfile -File scripts/measure-coexistence.ps1 -DurationSec 300` sai com 0 e imprime
  inversoes=0, sumicos=0 e amostras_com_sobreposicao 0 ou 1.
awaiting: user response

## Tests

Pré-condição de todos: **a pessoa mostra a ilha do mod** (atalho do próprio mod, Ctrl+Alt+D na configuração do
autor, ou reiniciando o mod no Windhawk). Nenhum agente faz isso. A nossa ilha em *Âncora > Ao lado da ilha do
sistema, à direita*, no monitor principal, com uma sessão na tela (por exemplo, um prompt rodando).

### 1. CHK-61: convivência medida por 5 minutos
expected: `scripts/measure-coexistence.ps1 -DurationSec 300` sem mexer no mouse sai com 0; inversoes=0, sumicos=0, amostras_com_sobreposicao ≤ 1; colar o resumo e o caminho do CSV aqui
result: [pending]

### 2. CHK-62: hover alternado nas duas pílulas
expected: Passar o mouse na pílula do mod (expande 380×184) e depois na nossa, alternando: cada uma expande só com o cursor nela; nenhuma cobre a outra; a nossa cresce para a direita e a borda esquerda dela não se mexe
result: [pending]

### 3. CHK-63: alerta do mod com pedido de permissão na nossa
expected: Com a nossa em "Precisa de você" (pedido falso pelo hook) acionar um alerta no mod (volume ou Caps Lock): as pílulas não se sobrepõem e Permitir na nossa funciona com o alerta na tela
result: [pending]

### 4. CHK-64: dois alertas simultâneos no mod
expected: Registrar se os dois alertas lado a lado (até ~356 px de meia-largura) alcançam a nossa pílula e por quanto tempo; se alcançarem, é o limite real da distância de 210 px
result: [pending]

### 5. CHK-65: tela cheia no monitor principal
expected: Vídeo em F11: a do mod some (AutoHideFullscreen); a nossa só some quando o sensor de tela cheia da Fase 4 for ativado (hoje fica por cima); anotar o que aconteceu
result: [pending]

### 6. CHK-66: hover na nossa encostando na do mod
expected: Com o cursor na nossa pílula, perto da borda interna, a do mod não expande
result: [pending]

### 7. CHK-67 (opcional): toast de outro app aparece na ilha do mod
expected: Um toast de teste de outro programa (não nosso) com o mod visível aparece na ilha dele por ~4 s; registrar em docs/INTEGRACOES.md
result: [pending]

### 8. Lado esquerdo e ajuste fino
expected: "Ao lado da ilha do sistema, à esquerda" espelha o lado direito (cresce para a esquerda); arrastar a pílula ajusta o lugar e ele volta igual depois de reiniciar a ilha; trocar de âncora zera o ajuste
result: [pending]

### 9. Issue ao autor do mod (CONV-03)
expected: O autor decide postar docs/ISSUE-API-EXTERNA.md no repositório do mod; depois, o link vai para docs/INTEGRACOES.md
result: [pending]

## Summary

total: 9
passed: 0
issues: 0
pending: 9
skipped: 0

## Gaps

[]
