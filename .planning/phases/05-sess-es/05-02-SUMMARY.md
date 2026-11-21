---
phase: 05-sess-es
plan: 02
subsystem: sessoes
tags: [sessoes, pontos, island-select, selecao, sess-01, sess-03, sess-06]

requires:
  - phase: 05-sess-es
    provides: fitsVisibleArea e besideFits (plano 01), suíte de 382 testes
provides:
  - sessionList(sessions, now), nextSelection(selection, list, event) com os eventos poll e select, e pickState(sessions, now, selection) com sessions e queue, em state.js
  - selection, lastSessionList, firstSeenAtByKey e o canal island:select no main.js; selectSession no preload.js
  - "#sessions com um ponto por sessão, bloco sessoes (MAX_SESSION_DOTS, sessionSwitchDirection), título e cabeçalho do pedido com o projeto, pulso do ponto pendente"
affects: [05-03, 05-04, 05-05, 05-06, 05-07]

plan_head_before: 873ef8bb10ca48e844dc153244d52ef5831db4f9
plan_head_after: f1c5769e09bbbffcc2292ffe4cab86730b8a9891
story_points_realized: 8

actuals:
  tokens: 15000
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "o renderer só manda um índice; o main confere contra a lista que os pontos mostram e traduz para a sessão"
    - "a sessão exibida só muda por evento do usuário ou ao sair da lista, e então vai à vizinha na ordem estável"

key-files:
  created: []
  modified: [state.js, main.js, preload.js, index.html, island.test.js, gate.test.js, README.md, spike/tauri/src-tauri/src/shim.js]

key-decisions:
  - "A urgência só escolhe a sessão sem sessão exibida; concluído, voltou a trabalhar e recência nunca trocam a sessão (SESS-06)"
  - "A pílula compacta ganhou max-width de 400 px (a largura da expandida); quem cede com muitos pontos é o título, de largura fixa de 140 px"
  - "O payload leva só { state, pending, current } por sessão; chave, PID e texto de outra sessão ficam no main"

requirements-completed: [SESS-01, SESS-03, SESS-06]

coverage:
  - id: D1
    description: "Com duas a oito sessões a ilha mostra um ponto por sessão, em ordem estável, cor do estado, o da exibida maior; acima de 8 volta o número"
    requirement: SESS-01
    verification:
      - kind: unit
        ref: "island.test.js#sessionList e pickState com seleção; gate.test.js#sessionSwitchDirection dá a direção da troca e MAX_SESSION_DOTS é 8"
        status: pass
    human_judgment: true
    rationale: "Cor, tamanho do ponto e posição na barra só se vê na tela"
  - id: D2
    description: "Clicar num ponto troca a sessão pelo canal island:select, que só leva um índice validado no main e passa por refresh('select')"
    requirement: SESS-03
    verification:
      - kind: unit
        ref: "island.test.js#nextSelection select; gate.test.js#o canal island:select só leva um índice, conferido no main, e passa por refresh"
        status: pass
    human_judgment: true
    rationale: "O clique real, sem arrastar a pílula nem abri-la no modo clique, só se prova com o mouse"
  - id: D3
    description: "A sessão exibida não troca sozinha por concluído, voltou a trabalhar ou recência; quando sai, a ilha vai à vizinha, nunca à mais urgente"
    requirement: SESS-06
    verification:
      - kind: unit
        ref: "island.test.js#nextSelection poll mantém a sessão exibida e só vai à vizinha quando ela sai; a sessão exibida não troca sozinha, e quando sai a ilha vai à vizinha"
        status: pass
    human_judgment: false
  - id: D4
    description: "O payload de island:state não leva chave, PID nem texto de pedido de outra sessão"
    verification:
      - kind: unit
        ref: "island.test.js#o payload do estado não leva chave, PID nem texto de outra sessão"
        status: pass
    human_judgment: false
  - id: D5
    description: "Trocar de pedido zera a leitura e a rolagem, então Permitir volta a exigir rolar até o fim"
    verification:
      - kind: unit
        ref: "gate.test.js#o clique no ponto manda só o índice, o pedido novo zera a leitura (trava de texto)"
        status: pass
    human_judgment: true
    rationale: "A trava prova que as duas linhas existem no onState; só uma pessoa vê Permitir voltar a desabilitar numa troca real"
  - id: D6
    description: "O título compacto é o projeto, de largura fixa com reticências; o cabeçalho do pedido é projeto · ferramenta com só o projeto cortado; a conta do palco cobre o novo pior caso"
    verification:
      - kind: unit
        ref: "gate.test.js#título de largura fixa, cabeçalho do pedido, título pelo projeto e conta do palco (ANIM-04)"
        status: pass
    human_judgment: true
    rationale: "A largura da pílula ao trocar de sessão só se mede na tela"
  - id: D7
    description: "O ponto de quem pede permissão pulsa por opacidade e fica parado, com anel, em movimento reduzido"
    verification:
      - kind: unit
        ref: "gate.test.js#o ponto de quem pede permissão pulsa por opacidade e para com movimento reduzido"
        status: pass
    human_judgment: true
    rationale: "O pulso e o anel só se veem na tela"

duration: 35min
completed: 2026-11-21
status: complete
---

# Phase 5 Plan 02: Um ponto por sessão e troca pelo clique Summary

**Um ponto por sessão no lugar do contador, em ordem estável, com troca pelo clique via o canal `island:select` (só um índice, conferido no main) e a sessão exibida fixa até sair da lista; o projeto fica à vista no título compacto e no cabeçalho do pedido.**

## Performance

- **Duration:** 35 min
- **Tasks:** 2
- **Files modified:** 8
- **Commits:** 4 de código (RED e GREEN de cada task), medido de `873ef8b` até `f1c5769`

## Accomplishments

- `state.js`: `sessionList`, `nextSelection` e `pickState(sessions, now, selection)`. O filtro de vivas virou `isAliveSession` e o sort de urgência virou `byUrgency`, sem mudar prazo nem ordem; a ordem dos pontos é `byFirstSeen` (primeira aparição, empate pela chave). `nextSelection` nunca lança nem muta e devolve sempre objeto novo.
- `main.js`: `selection`, `lastSessionList` e `firstSeenAtByKey` (birthtime do arquivo, um `statSync` por sessão nova, podado quando o arquivo some). `readSessions` sobrescreve `key` e `firstSeenAt` depois do parse, então o arquivo não escolhe a própria chave nem a própria ordem. `refresh` calcula a lista e a seleção antes do `pickState`. Handler `island:select` com `islandOf`, `Number.isInteger` e ociosa ignorada.
- `index.html`: `#sessions` como último filho de `#side`, `renderSessions` com assinatura (o DOM só é refeito quando muda), clique que ignora o ponto da exibida, bloco `sessoes` testável em `node:vm`, `readPermissionId` e a rolagem zerados na troca de id, e sem som ao trocar de sessão (só a chegada a "precisa de você" avisa).
- Task 2: título de largura fixa (140 px) com reticências, cabeçalho "projeto · ferramenta" com só o projeto cortado, `#detail` em uma linha com pedido na tela, `@keyframes session-pulse` e anel parado em movimento reduzido, e a seção "Várias sessões" no README.

## Commits

| Hash | Tipo | Assunto |
|------|------|---------|
| `d93483a` | RED | test(sessoes): cobre a lista, a seleção e os pontos |
| `e42a6f0` | GREEN | feat(sessoes): mostra um ponto por sessão e troca pelo clique no ponto |
| `cd94972` | RED | test(sessoes): cobre o projeto no título e no pedido e o pulso dos pontos |
| `f1c5769` | GREEN | feat(sessoes): mostra o projeto da sessão exibida e pulsa o ponto que pede permissão |

## Testes

Base: 382. Final: **400**, `fail 0` (`island.test.js` 41 para 49 testes, `gate.test.js` 64 para 74 testes, contando os blocos `test(` do arquivo). O script inline do renderer compila em `node:vm`.

Travas que mudaram de propósito, no mesmo commit do código: canais do renderer de 9 para 10 e handlers do main de 7 para 8 (`gate.test.js`); o `deepEqual` de `pickState` ganhou `sessions` e `queue: null` (`island.test.js`); a conta do palco (`toolLabelLines` soma o projeto e o separador; `pillMaxHeight` conta o `#detail` com pedido em 1 linha: 46 + 15,6 + 194,2 + 40,9 + 16 ≈ 312,7 px, abaixo dos 314 de antes).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Bloqueio] O shim da casca Tauri precisava do método novo do preload**
- **Found during:** Task 1 (suíte completa)
- **Issue:** `gate.test.js#o shim da casca Tauri expõe os mesmos nomes do preload` falhou, porque `spike/tauri/src-tauri/src/shim.js` espelha o objeto do preload e o plano não o listava em `files_modified`.
- **Fix:** `selectSession: noop` no shim e o comentário "Os 10 métodos".
- **Files modified:** `spike/tauri/src-tauri/src/shim.js`
- **Commit:** `e42a6f0`

Fora isso, o plano foi executado como escrito.

Observações sem impacto:

- O ledger do ponto de partida em `.git` não foi usado; o `commits:` foi medido de `873ef8b`, o HEAD no início da execução.
- A ponte com o Boards não está em uso neste repositório (sem `.planning/boards/`), então o shim não foi chamado.
- `STATE.md` e `ROADMAP.md` ficam com o orquestrador, como pedido.

## Para a atenção do orquestrador

- **Overshoot da mola de largura:** `max-width: 400px` na regra base de `#pill`, como o plano manda, também recorta o excesso da mola de largura (o estilo elástico passa de 400 px ao expandir), porque a mola escreve `width` inline e o `max-width` vence. Só o rabo da animação perde um pouco de "balanço"; o palco não é afetado. Vale olhar na tela com o estilo Elástico.
- A ordem dos pontos usa o birthtime do arquivo da sessão; num sistema de arquivos sem birthtime vale o instante em que a ilha viu a sessão (suposição do plano).

## Testar manualmente

Fica para o checklist do PR (o plano 07 consolida):

- Com duas a oito sessões, os pontos aparecem na ordem de abertura, com a cor do estado e o da exibida maior.
- O clique num ponto troca a sessão, não arrasta a pílula nem a abre no modo clique.
- O título compacto mostra o projeto com reticências; o cabeçalho do pedido mostra "projeto · ferramenta" sem cortar a ferramenta.
- O ponto de quem pede permissão pulsa; com "reduzir movimento" do Windows fica parado, com anel.
- Com 9 sessões volta o número no lugar dos pontos.
- Trocar para uma sessão concluída não toca som.
- Um nome de projeto longo ou curto não muda a largura da pílula.
- Com o cursor sobre a pílula, ao clicar nos pontos de uma sessão "trabalhando" e de uma "concluído", anotar o quanto a pílula e os pontos se movem (resíduo aceito, T-05-28; numa âncora de baixo, também o quanto a barra sobe ou desce) e conferir que Permitir e Negar, se estavam armados, voltam a desabilitar e só rearmam no lugar novo.
- Com o estilo de animação Elástico, expandir a pílula e olhar se o fim do movimento da largura perdeu o balanço (efeito do `max-width` de 400 px).

## Known Stubs

None.

## Threat Flags

None. O canal `island:select`, o payload com sessões e a leitura do arquivo de sessão já estão no threat model do plano (T-05-05 a T-05-10, T-05-27 e T-05-28).

## Self-Check: PASSED

- Arquivos: `state.js`, `main.js`, `preload.js`, `index.html`, `island.test.js`, `gate.test.js`, `README.md` e o shim existem e estão commitados.
- Commits `d93483a`, `e42a6f0`, `cd94972` e `f1c5769` estão na branch `feat/fase-5-sessoes`.
- `node --test`: 400 testes, 0 falhas.
