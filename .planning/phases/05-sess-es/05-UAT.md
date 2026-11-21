---
status: testing
phase: 05-sess-es
source: [05-VERIFICATION.md]
started: 2026-11-21T22:00:00Z
updated: 2026-11-21T22:00:00Z
---

## Current Test

number: 1
name: A roda chega à janela da ilha, que nunca recebe o foco
expected: |
  Com "Rolar janelas inativas ao passar o mouse sobre elas" ligado, um entalhe anda uma sessão (para baixo a seguinte, para cima a anterior, sem dar a volta); sem a opção a roda não chega e o clique no ponto continua trocando; o touchpad é mais lento e a inércia não dispara várias sessões.
awaiting: user response

## Tests

Harness: ilha no ar a partir deste checkout (`pnpm start`, parando antes a ilha da pasta `claude-island` e subindo-a de novo no fim). Sessões e pedidos falsos pelo hook real, sem tocar em `~/.claude/settings.json`, por exemplo:
`echo '{"session_id":"uat-a","hook_event_name":"UserPromptSubmit","cwd":"C:/projetos/alfa"}' | node hook.js`
`echo '{"session_id":"uat-b","hook_event_name":"PermissionRequest","tool_name":"Bash","tool_input":{"command":"echo B"},"cwd":"C:/projetos/beta"}' | node permission-hook.js`
A lista completa e agrupada está em "Testar manualmente (checklist do PR)" do `05-07-SUMMARY.md`.

### 1. A roda chega à janela da ilha, que nunca recebe o foco
expected: Com duas ou mais sessões, girar um entalhe sobre a pílula, com e sem "Rolar janelas inativas" ligado, e com um terminal elevado em foco. Com a opção ligada, um entalhe anda uma sessão sem dar a volta; sem ela, a roda não chega e o clique no ponto continua trocando; o touchpad é mais lento e a inércia não dispara várias sessões.
result: [pending]

### 2. Sensação e aparência da troca e dos pontos
expected: A mola de troca assenta em menos de 1 s, sem balanço, com o conteúdo vindo de baixo ao rolar para baixo; pontos com o tamanho certo, anel na exibida, pulso em quem pede e anel parado com "reduzir movimento"; a cor do acento troca por transição. Durante a troca, os pontos, "Abrir", Permitir e Negar não se movem; com "reduzir movimento" a troca é seca.
result: [pending]

### 3. Aviso sonoro
expected: Um snap ou um pedido novo na sessão exibida toca o "precisa de você"; rolar ou clicar até uma sessão que já espera, ou até uma "concluído", não toca.
result: [pending]

### 4. Palco a 125% e 150% de escala
expected: Com 2 a 8 pontos, projeto longo no título e pedido com "N de M" no pico do Elástico a 2×, nada é recortado e não há linha de 1 px na borda do palco; o cabeçalho "projeto · ferramenta" e o "N de M" não passam do pico.
result: [pending]

### 5. Âncora "Ao lado da ilha do sistema" em tela estreita
expected: A 1366×768 em 125% (área útil abaixo de 1220 DIP), com um pedido na tela, Permitir e Negar ficam desabilitados com "Responda no terminal"; com área útil de 1220 DIP ou mais, funcionam como antes.
result: [pending]

### 6. Correções da revisão que mudaram lógica
expected: Num uso real de várias sessões, a ilha nunca troca sozinha por causa de um arquivo de sessão lido pela metade, e a escolha de quem rolou ou clicou não é desfeita pelo pedido que saiu no mesmo instante.
result: [pending]

### 7. Resíduo de layout aceito e exceção registrada da saída da sessão exibida
expected: Com o cursor sobre a pílula, clicar nos pontos de uma sessão "trabalhando" e de uma "concluído" e anotar quanto a pílula e os pontos andam; Permitir e Negar, se armados, voltam a desabilitar e só rearmam no lugar novo. Com todas as sessões restantes com pedido já deixado, encerrar a exibida faz o pedido reaparecer com rearme.
result: [pending]

### 8. Demais itens do checklist do PR
expected: Sessão morta (fechar a janela do terminal sem /exit), "concluído" exibido além dos 10 s com outra sessão viva, saída da sessão exibida (vizinha ou pedido nunca exibido), pedido novo no meio do gesto de roda, ilha escondida pelo atalho: cada um como descrito no `05-07-SUMMARY.md`.
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
