---
status: testing
phase: 02-funda-o-segura-do-gate-de-permiss-o
source: [02-VERIFICATION.md]
started: 2026-11-21T06:00:00Z
updated: 2026-11-21T06:00:00Z
---

## Current Test

number: 1
name: UAT-1 (sandbox e preload)
expected: |
  A ilha sobe com contextIsolation, sandbox e nodeIntegration=false explícitos, mostra o pedido e responde: depois de armar e clicar Permitir, o stdout do hook imprime a decisão allow.
awaiting: user response

## Tests

Harness: com a ilha no ar a partir deste checkout (`pnpm start`), disparar pedidos falsos pelo hook real, sem tocar em `~/.claude/settings.json`:
`echo '{"session_id":"uat-a","hook_event_name":"PermissionRequest","tool_name":"Bash","tool_input":{"command":"echo A"},"cwd":"."}' | node permission-hook.js`
(o stdout só imprime a decisão quando se clica; sem clique em 5 min o hook sai calado).

### 1. UAT-1 (sandbox e preload): subir a ilha e disparar um pedido pelo harness
expected: A ilha mostra o pedido; depois de armar e clicar Permitir, o stdout do hook imprime allow
result: [pending]

### 2. UAT-2 (armamento): clicar antes de 0,8 s; clicar < 200 ms após chegar ao botão; parar 0,3 s e clicar; passar o mouse sem clicar
expected: Os dois primeiros cliques são descartados; o terceiro vale; os botões não ampliam no hover (só brilho)
result: [pending]

### 3. UAT-3 (pedido muda no clique): com A armado, disparar B (uat-b) e clicar logo
expected: Nada vale para A nem B; depois do rearme de B (0,8 s), o clique responde só B
result: [pending]

### 4. UAT-4 (duas ilhas, 2 monitores): Permitir numa ilha e Negar na outra em sequência rápida
expected: O stdout mostra uma única decisão, a do primeiro clique; a outra ilha trava os botões
result: [pending]

### 5. UAT-5 (roda): pedido com texto longo, rolar rápido no touchpad no instante em que aparece; repetir com texto curto
expected: Permitir não libera pela inércia; texto longo só libera após rolar até o fim depois de ~0,4 s; pedido novo volta a exigir leitura; a roda nunca desloca outra coisa
result: [pending]

### 6. UAT-6 (opacidade): pedido na tela sobre fundo claro e escuro
expected: Pílula 100% opaca
result: [pending]

### 7. Revisão CR-01: Permitir e Negar funcionam sob a conferência de URL do remetente
expected: A decisão chega ao hook (se a URL divergisse, todo clique seria recusado — falha segura)
result: [pending]

### 8. Revisão CR-01: arrastar um link do navegador e um .html do Explorer para a pílula
expected: Nada acontece; a janela continua na ilha, sem nova página nem nova janela
result: [pending]

### 9. Revisão WR-01: clicar no instante em que um segundo pedido chega ou a ilha muda de monitor
expected: Se o main recusou, os botões destravam no próximo estado e rearmam; o renderer nunca reenvia sozinho
result: [pending]

### 10. Revisão WR-02: fazer "Abrir sessão" aparecer/sumir ou rolar o texto até o fim com pedido na tela
expected: Os botões desarmam e só rearmam 0,8 s depois, com o layout assentado
result: [pending]

## Summary

total: 10
passed: 0
issues: 0
pending: 10
skipped: 0
blocked: 0

## Gaps
