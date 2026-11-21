---
phase: 05-sess-es
plan: 05
subsystem: sessoes
tags: [sessoes, sessao-morta, process-kill, concluido-exibido, saida-de-fato, sess-06, sess-07]

requires:
  - phase: 05-sess-es
    provides: sessionList, nextSelection/pollSelection com requests { id, seenAt, handled, shown }, refresh com a seleção e lastSessionList (planos 02 e 04), suíte de 421 testes
provides:
  - isSessionDead(session, now, isPidAlive) em state.js (PID injetado, só exatamente false mata; idade acima de WAITING_STALE_MS mata)
  - isPidAlive(pid) em main.js (só o sinal 0; só ESRCH conta como morto) e a remoção do arquivo da sessão morta em readSessions
  - aliveSessions(sessions, now, keptKey) interno e sessionList(sessions, now, selectedKey) / pickState com a chave exibida segurando o concluído vencido enquanto há outra sessão viva
  - saída de fato da sessão exibida no poll: pedido nunca exibido mais antigo (sem gesto de roda) ou vizinha na ordem estável, pulando as de pedido já deixado
affects: [05-06, 05-07]

plan_head_before: 2f68ff1
plan_head_after: 6db0823ce7a62bd01fb1582b0e9c53c26a73deba
commits: 6
story_points_realized: 5

actuals:
  tokens: 14000
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "o main só pergunta ao sistema se o processo existe (process.kill(pid, 0)); a decisão de morta é pura em state.js com o teste do PID injetado"
    - "o concluído exibido é segurado por aliveSessions a partir da chave exibida; o refresh recalcula lastSessionList com a chave nova, então lista do main e pontos do renderer concordam"
    - "keyAfterPoll recebe as sessões com pedido já deixado e as pula; só com todas deixadas pousa na vizinha mais próxima"

key-files:
  created: []
  modified: [state.js, main.js, island.test.js, gate.test.js, README.md]

key-decisions:
  - "aliveSessions só segura o concluído com updatedAt numérico finito, para um arquivo sem data nunca ficar preso na lista"
  - "Na saída de fato sem gesto, todos os pedidos viram handled, mesmo quando o alvo é a vizinha: um pedido já exibido nunca volta a ser alvo pelo caminho normal do snap"
  - "Dois testes do poll do plano 04 mudaram de propósito: eles fixavam 'saída de fato vai à vizinha' com um pedido nunca exibido pendente e sem gesto, o que a regra desta tarefa substitui"

requirements-completed: [SESS-07, SESS-06]

coverage:
  - id: D1
    description: "Sessão de terminal fechado sem SessionEnd (windowPid cujo processo não existe) sai da lista e tem o arquivo apagado no mesmo ciclo; EPERM, sucesso ou fato desconhecido mantêm a sessão; sem PID válido o PID nem é consultado"
    requirement: SESS-07
    verification:
      - kind: unit
        ref: "island.test.js#isSessionDead: só isPidAlive exatamente false mata a sessão de windowPid válido (SESS-07); isSessionDead: sem windowPid válido o PID nem é consultado (SESS-07); isSessionDead: entrada inválida nunca lança nem muta a sessão (SESS-07)"
        status: pass
      - kind: unit
        ref: "gate.test.js#a conferência de vida só envia o sinal 0 e só ESRCH conta como morto (SESS-07); readSessions apaga a sessão morta antes de ela ganhar chave e ordem, e só ali (SESS-07)"
        status: pass
    human_judgment: true
    rationale: "O fechamento real de uma janela de terminal e o sumiço do ponto em menos de 1 s só se confirmam com o aparelho; os testes nunca tocam em ~/.claude/island nem em processo real"
  - id: D2
    description: "Arquivo de sessão com mais de 12 h sem atualização é apagado em qualquer estado; o concluído recente de terminal vivo fica"
    requirement: SESS-07
    verification:
      - kind: unit
        ref: "island.test.js#isSessionDead: arquivo com mais de 12 h sem atualização é lixo de qualquer estado, vivo o PID ou não (SESS-07); isSessionDead: o concluído recente de terminal vivo fica, e o de terminal fechado sai (SESS-07)"
        status: pass
    human_judgment: false
  - id: D3
    description: "O concluído exibido fica na lista e na tela com outra sessão viva, inclusive uma hora depois; sozinho vence aos 10 s; deixando de ser exibido sai na hora"
    requirement: SESS-06
    verification:
      - kind: unit
        ref: "island.test.js#o concluído exibido fica na lista e na tela com outra sessão viva, inclusive uma hora depois (SESS-06); o concluído sozinho vence aos 10 s e a ilha fica ociosa, sem trocar para nada (SESS-06); deixando de ser exibido o concluído vencido sai na hora, e o vencido que não é o exibido nunca entra (SESS-06)"
        status: pass
    human_judgment: true
    rationale: "Que a ilha nunca troque de sessão sozinha por um concluído só se avalia vendo duas sessões reais"
  - id: D4
    description: "A sessão exibida que sai de fato vai ao pedido nunca exibido mais antigo (sem gesto de roda) ou à vizinha na ordem estável, nunca à mais urgente nem a um pedido já deixado; a vizinha com pedido já deixado é pulada; todas deixadas pousa na mais próxima"
    requirement: SESS-06
    verification:
      - kind: unit
        ref: "island.test.js#a sessão exibida que sai de fato vai ao pedido nunca exibido mais antigo, senão à vizinha, nunca à mais urgente (SESS-06); a vizinha com pedido já deixado é pulada; só com todas deixadas pousa na mais próxima; o gesto adia o nunca exibido (SESS-06)"
        status: pass
    human_judgment: false
  - id: D5
    description: "O refresh calcula a lista com a chave exibida antes do poll e recalcula lastSessionList com a chave nova depois dele"
    verification:
      - kind: unit
        ref: "gate.test.js#a seleção só muda por nextSelection e o refresh a calcula antes de escolher a sessão"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-11-21
status: complete
---

# Phase 5 Plan 05: Sessão morta e o concluído exibido Summary

**Sessão de terminal fechado sem SessionEnd (PID inexistente, só ESRCH) ou com arquivo de mais de 12 h sai da lista e tem o arquivo apagado, e o "concluído" na tela fica enquanto houver outra sessão viva, com a sessão exibida que sai de fato levando ao pedido nunca exibido ou à vizinha, nunca à mais urgente.**

## Performance

- **Duration:** 35 min
- **Tasks:** 3 (Task 1 é o traçador)
- **Files modified:** 5
- **Commits:** 6 (RED e GREEN de cada task), medido de `2f68ff1` até `6db0823`

## Accomplishments

- `state.js`: `isSessionDead(session, now, isPidAlive)`: pura, nunca lança nem muta; morta é a de idade acima de `WAITING_STALE_MS` (números finitos) ou a de `windowPid` inteiro maior que 0 cujo `isPidAlive` devolve exatamente false. Com o `ponytail:` do limite de 12 h.
- `main.js`: `isPidAlive(pid)` (`process.kill(pid, 0)`, só ESRCH conta como morto, com o `ponytail:` dos limites da aba do Windows Terminal e do PID reaproveitado) e, em `readSessions`, a remoção do arquivo da sessão morta antes de ela ganhar chave e ordem (`rmSync` dentro de `try` com `catch` comentado).
- `state.js`: `aliveSessions(sessions, now, keptKey)` (interno) segura o concluído exibido e vencido quando há outra sessão viva; `sessionList` ganhou o 3º parâmetro e `pickState` usa `selection.key`.
- `state.js`: no poll, `exited` (a chave exibida saiu de fato da lista) leva ao pedido nunca exibido mais antigo quando não há gesto de roda, e senão à vizinha; `keyAfterPoll` pula as sessões com pedido já deixado e, se todas o tiverem, pousa na mais próxima.
- `main.js`: `refresh` usa `sessionList(sessions, now, selection.key)` antes do poll e recalcula `lastSessionList` com a chave nova depois dele.
- `README.md`: itens "O concluído na tela fica até você trocar" e "Sessão morta sai da lista" na seção "Várias sessões".

## Commits

| Hash | Tipo | Assunto |
|------|------|---------|
| `c98dda8` | RED | test(sessoes): cobre a sessão morta pelo processo do terminal |
| `74a7ff8` | GREEN | feat(sessoes): tira da lista e apaga a sessão de terminal fechado |
| `63fbb12` | RED | test(sessoes): cobre a remoção por idade |
| `86439dd` | GREEN | feat(sessoes): apaga arquivos de sessão com mais de 12 h e documenta a sessão morta |
| `68d3251` | RED | test(sessoes): cobre o concluído exibido que não vence com outra sessão viva |
| `6db0823` | GREEN | feat(sessoes): mantém o concluído na tela até o usuário trocar |

## Testes

Base: 421. Final: **433**, `fail 0` (`island.test.js` de 59 para 69 testes, `gate.test.js` de 85 para 87). Marcos do plano: 426 depois da Task 1 (meta 423), 428 depois da Task 2 (meta 425), 433 depois da Task 3 (meta 430). Os três `node -e` do plano imprimem `true false false`, `true false false` e `2 1 idle`. Os cinco arquivos tocados seguem `w/crlf`. Nenhum teste lê, grava ou apaga arquivo real em `~/.claude/island/`: o predicado é testado com o `isPidAlive` injetado e a remoção do `main.js` por trava de texto.

Travas e testes que mudaram de propósito, no mesmo commit do código:

- `gate.test.js`, "a seleção só muda por nextSelection e o refresh a calcula antes de escolher a sessão": passou a exigir, nesta ordem, `sessionList(sessions, now, selection.key)`, o poll, `lastSessionList = sessionList(sessions, now, selection.key);` e `pickState(sessions, now, selection)` (como o plano manda).
- `island.test.js`, dois testes do poll do plano 04 ("o poll poda os pedidos que saíram..." e "quando o pedido exibido sai a ilha vai ao mais antigo restante..."): fixavam que a saída de fato com um pedido nunca exibido pendente e sem gesto ia à vizinha. A regra desta task manda ir ao pedido nunca exibido, então o caso sem gesto agora espera o alvo (`b`, `snapped` true) e o caso com gesto (`lastWheelAt` recente) segue esperando a vizinha (`x`, `snapped` false) e `shown` false.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug de teste] Dois testes do plano 04 contradiziam a regra nova da saída de fato**
- **Found during:** Task 3 (primeira rodada do GREEN)
- **Issue:** o plano diz que os testes dos planos 02 e 04 passam sem mudança, mas esses dois testes de `nextSelection` usam uma saída de fato com pedido nunca exibido pendente e sem gesto e esperam a vizinha, que é exatamente o comportamento que a Task 3 troca (CONTEXT, terceira revisão da D-21).
- **Fix:** o caso sem gesto passou a esperar o pedido nunca exibido; o caso da vizinha continua coberto com um gesto de roda em curso. Nenhuma asserção sobre outro comportamento foi tocada.
- **Files modified:** `island.test.js`
- **Commit:** `6db0823`

**Total deviations:** 1 auto-fixed (1 teste de plano anterior ajustado). **Impact:** nenhum no comportamento entregue, que é o do plano.

Observações sem impacto:

- As linhas de baseline `[HEAD=... @c461158]` dos critérios partem de um HEAD antigo; as metas finais foram cumpridas (`island.test.js` 69 >= 67, `gate.test.js` 87 >= 87, 433 >= 430 testes).
- O ledger do ponto de partida em `.git` não foi usado; o `commits:` foi medido de `2f68ff1`, o HEAD no início da execução.
- A Task 1 é o traçador e o `<verify>` é só automático: foi re-executado (`node --test`, 426 testes) antes de expandir.
- Marcadores de planejamento (D-xx, T-05-xx) não ficaram em comentários do código; os títulos dos testes citam só IDs de requisito.
- A ponte com o Boards não está em uso neste repositório (sem `.planning/boards/`), então o shim não foi chamado. `STATE.md` e `ROADMAP.md` ficam com o orquestrador. `.planning/state.json` continua sem rastreio.

## Para a atenção do orquestrador

- `aliveSessions` não tem o limite de 12 h do arquivo: ele depende de `readSessions` apagar o arquivo antes (via `isSessionDead`). Chamado direto com uma sessão `done` de 13 h exibida, ele a seguraria; no main isso não ocorre porque a leitura já a removeu.
- Se uma sessão exibida some (SessionEnd) no mesmo ciclo em que chega um pedido novo em outra, o pedido novo conta como nunca exibido e é o alvo da saída (o mesmo resultado do snap normal, só que vindo do caminho de saída).
- A exceção registrada da D-21 (todas as restantes com pedido já deixado: pousa na mais próxima) é coberta por teste e não tem rearme próprio: quem rearma é o `refresh`, porque o id do pedido exibido muda.

## Testar manualmente

Fica para o checklist do PR (o plano 07 consolida):

- Com duas sessões, fechar a janela do terminal de uma (sem /exit) faz o ponto dela sumir em menos de 1 s e o arquivo `~/.claude/island/<id>.json` dela desaparecer; a sessão do outro terminal continua intacta.
- Fechar só uma aba do Windows Terminal mantém o ponto até o prazo (2 h trabalhando, 12 h esperando).
- Com uma sessão concluída na tela e outra trabalhando, depois de 10 s a ilha continua mostrando a concluída; ao rolar para a outra, o ponto da concluída some.
- Com a concluída sozinha, a ilha some em 10 s.
- Com três sessões, deixar um pedido de lado (rolar para longe dele) e encerrar a sessão exibida leva à vizinha da esquerda, e não de volta ao pedido deixado (se a da esquerda for a do pedido deixado, ela é pulada).
- Com um pedido que nunca apareceu na tela (chegou na fila), encerrar a exibida leva a ele.

## Known Stubs

None.

## Threat Flags

None. A remoção de arquivo só atinge o que `readdir` de `STATE_DIR` devolveu e passou por `isSessionFile` (T-05-21, trava do corpo de `readSessions`); a única chamada a `process.kill` é a de sinal 0 dentro de `isPidAlive` (T-05-20, trava de texto); só `isPidAlive(...) === false` ou mais de 12 h condenam, e EPERM ou erro desconhecido contam como vivo (T-05-19); o concluído exibido só fica enquanto é o exibido e há outra sessão viva (T-05-30); só um pedido nunca exibido é alvo da saída de fato, nunca no meio de um gesto de roda (T-05-31). O Electron não foi iniciado, nenhum evento sintético foi gerado e nenhum arquivo real de `~/.claude/island/` foi tocado.

## Self-Check: PASSED

- Arquivos: `state.js`, `main.js`, `island.test.js`, `gate.test.js` e `README.md` existem e estão commitados.
- Commits `c98dda8`, `74a7ff8`, `63fbb12`, `86439dd`, `68d3251` e `6db0823` estão na branch `feat/fase-5-sessoes`.
- `node --test`: 433 testes, 0 falhas; `grep -c "^test(" island.test.js` = 69, `gate.test.js` = 87.
