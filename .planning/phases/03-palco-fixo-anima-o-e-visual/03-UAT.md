---
status: testing
phase: 03-palco-fixo-anima-o-e-visual
source: [03-VERIFICATION.md]
started: 2026-11-21T12:00:00Z
updated: 2026-11-21T12:00:00Z
---

## Current Test

number: 1
name: Estilos e velocidades da mola
awaiting: user response

## Tests

Harness: ilha no ar a partir deste checkout (`pnpm start`, parando antes a ilha da pasta `claude-island` e subindo-a de novo no fim). Os valores visuais vêm de um `preferences.json` em `~/.claude/island/` (lido uma vez na subida; reiniciar a ilha a cada troca), por exemplo `{"theme":"nord","shape":"notch","animationStyle":"bouncy","animationSpeed":2}`. Pedidos de permissão falsos pelo hook real, sem tocar em `~/.claude/settings.json`:
`echo '{"session_id":"uat-a","hook_event_name":"PermissionRequest","tool_name":"Bash","tool_input":{"command":"echo A"},"cwd":"."}' | node permission-hook.js`

### 1. Estilos e velocidades da mola
expected: Passagem leve ao crescer no Padrão; nenhum balanço ao encolher em qualquer estilo (o Elástico só difere do Padrão ao crescer); alvo novo no meio sem salto; nenhum quadro com a ilha em repouso; com "reduzir movimento" do Windows a pílula muda de tamanho sem mola
result: [pending]

### 2. Nudge, hover e formas
expected: Nudge de −6 px na troca de estado; ampliação de 2,5% no hover; em Concluído o hover não amplia e o "Abrir" fica parado; com pedido na tela nada se mexe; pílula, notch (colado no topo) e Windows 11 como o mod
result: [pending]

### 3. BLOQUEANTE PARA O MERGE: palco em 125% e 150%
expected: O palco de 520×410 e a pílula no pico do Elástico a 2× sem recorte e sem linha de 1 px na borda
result: [pending]

### 4. "Abrir sessão" em Trabalhando com hover
expected: O botão escala junto com a pílula (2,5%); aceito
result: [pending]

### 5. Posição salva
expected: A pílula fica no mesmo lugar depois de atualizar; arrastada para os últimos ~86 px de baixo, sobe até a janela caber na área útil
result: [pending]

### 6. Os 8 temas e o automático
expected: Superfície do tema com profundidade, sombra e reflexo do topo na cor do estado; bloco de permissão legível, sem reflexo no comando; trocar o tema com pedido na tela rearma os botões
result: [pending]

### 7. Área útil baixa (correção WR-02)
expected: Em monitor com altura útil abaixo de 410 DIP, Permitir e Negar desabilitados e a dica "Responda no terminal"
result: [pending]

### 8. Nome de ferramenta longo (correção WR-04)
expected: O rótulo quebra linha em vez de ser cortado e a pílula não é recortada no Elástico a 2×
result: [pending]

### 9. Desvio do Elástico registrado no PR
expected: A descrição do PR explica que encolher nunca balança em nenhum estilo (ANIM-01 acima do mod)
result: [pending]

## Summary

total: 9
passed: 0
issues: 0
pending: 9
skipped: 0
blocked: 0

## Gaps
