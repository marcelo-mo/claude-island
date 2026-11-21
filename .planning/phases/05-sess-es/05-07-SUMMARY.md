---
phase: 05-sess-es
plan: 07
subsystem: gate
tags: [gate, fixture, vetores, troca-de-sessao, roda, snap, fila, sess-02, sess-03, sess-04, sess-05]

requires:
  - phase: 05-sess-es
    provides: nextSelection, sessionList, wheelStep, constantes de gesto e de snap, nextShownPermission e acceptDecision (planos 02 a 05), suíte de 440 testes
provides:
  - grupo sessionSwitch no fixture, com sete vetores (clique no ponto, roda para baixo, roda para cima, snap de pedido novo, avanço da fila, troca para sessão sem pedido e saída de fato da sessão exibida), cada um com before (799 ms), after (800 ms) e oldEcho
  - grupos wheelStep (14 vetores) e nextSelection (31 vetores) no fixture, JSON puro reaproveitável por um gate futuro em outra linguagem
  - as sete chaves de constantes (snapGestureGapMs, snapWheelLockMs, wheelNotchDelta, wheelGesturePauseMs, wheelStepMs, wheelPreciseStepMs, wheelDeltaMax) e o teste que as espelha no state.js
  - a lista consolidada "Testar manualmente (checklist do PR)" da fase inteira
affects: [verify-work, ship]

plan_head_before: e76b94ec1b5a484ac3fbcebccf1e5fcd9824d75c
plan_head_after: d73e1a7a8d37d3149d260d2293a66e4a8fa18b8e
commits: 2
story_points_realized: 5

actuals:
  tokens: 7900
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "o vetor de troca encadeia as funções puras na ordem do main (nextSelection, nextShownPermission, acceptDecision) e prova os três instantes de aceite: 799 ms recusa, 800 ms aceita, eco do pedido anterior recusa"
    - "o fixture só cresce no fim: os grupos e vetores de c461158 continuam byte a byte iguais"

key-files:
  created: []
  modified: [fixtures/permission-vectors.json, gate.test.js]

key-decisions:
  - "Nenhuma mudança em state.js nem em main.js: os 53 testes novos passaram de primeira contra o código dos planos 02 a 06, então o plano só acrescenta prova"
  - "A saída de fato da sessão exibida ficou com dois vetores de seleção além do de sessionSwitch (o que vai a c e o que pula b), para o caso do pedido nunca exibido e o da vizinha serem distinguíveis um do outro"

requirements-completed: [SESS-02, SESS-03, SESS-04, SESS-05]

coverage:
  - id: D1
    description: "Todo caminho de troca de sessão (clique, roda para baixo e para cima, snap, avanço da fila, saída de fato da sessão exibida) sobe a época, passa a exibir o pedido da sessão nova e faz acceptDecision recusar com not-armed aos 799 ms, aceitar aos 800 ms e recusar com echo-mismatch o eco do pedido anterior"
    requirement: SESS-05
    verification:
      - kind: unit
        ref: "gate.test.js#sessionSwitch: (sete vetores)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A troca para uma sessão sem pedido zera o pedido exibido e toda decisão depois dela recusa com nothing-shown"
    requirement: SESS-05
    verification:
      - kind: unit
        ref: "gate.test.js#sessionSwitch: troca para sessão sem pedido: nada exibido, toda decisão recusa com nothing-shown"
        status: pass
    human_judgment: false
  - id: D3
    description: "wheelStep e nextSelection estão no fixture como vetores JSON puros, e as constantes de gesto e de snap do state.js são as do fixture"
    requirement: SESS-02
    verification:
      - kind: unit
        ref: "gate.test.js#wheelStep: (14 vetores); nextSelection: (31 vetores); as constantes de gesto e de snap do state.js são as do fixture"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-11-21
status: complete
---

# Phase 5 Plan 07: Gate da troca de sessão e checklist do PR Summary

**Todo caminho de troca de sessão está provado contra o gate por vetores JSON portáveis (a troca sobe a época, aceita só aos 800 ms e recusa o eco do pedido anterior), wheelStep e nextSelection viraram grupos do fixture com suas constantes, e a fase tem a lista única de "Testar manualmente" para o PR.**

## Performance

- **Duration:** 20 min
- **Tasks:** 2 (Task 1 é o traçador)
- **Files modified:** 2
- **Commits:** 2, medido de `e76b94e` até `d73e1a7`

## Accomplishments

- Task 1 (traçador): o vetor do clique no ponto atravessa `nextSelection`, `nextShownPermission` e `acceptDecision` de ponta a ponta, e o laço `sessionSwitch` do `gate.test.js` já aceita o caminho da roda (`wheel`), o do evento (`event`) e a sessão sem pedido.
- Task 2: seis vetores novos em `sessionSwitch` (roda para baixo e para cima, snap, avanço da fila, sessão sem pedido, saída de fato da sessão exibida indo ao pedido nunca exibido), 14 vetores de `wheelStep` (entalhe, os três toques do touchpad, pausa de 220 ms, inversão, 85 ms, entalhe pendente, delta 0, texto, instante nulo, gesto nulo) e 31 de `nextSelection` (select, scroll, poll, D-21 com os quatro casos pedidos, snap uma vez, adiamento no gesto, fila, avanço, subida com dois pedidos e poda).
- As sete chaves de constantes entram no fim do fixture e um teste as compara com as do `state.js`.
- O fixture antigo está intacto: todo grupo de `c461158` continua igual (`JSON.stringify` por chave), e `acceptDecision` não foi tocado.

## Commits

| Hash | Tipo | Assunto |
|------|------|---------|
| `98bfebe` | test | test(gate): prova a troca pelo clique no ponto contra a regra de aceite |
| `d73e1a7` | test | test(gate): prova roda, snap e fila contra a regra de aceite e leva as regras de sessão ao fixture |

## Testes

Base: 440. Final: **493**, `fail 0` (441 depois da Task 1, piso 438; 493 depois da Task 2, piso 473). `grep -c "^test(" gate.test.js` = 95 (o piso era 95: os laços dos vetores contam como uma declaração `test(` cada). O `gate.test.js` segue `w/crlf` e o fixture `w/lf`.

Acceptance da Task 2: `v.sessionSwitch.length>=7, v.wheelStep.length>=10, v.nextSelection.length>=18, 400, 1200` imprimiu `true true true 400 1200`; a comparação com `c461158` imprimiu `ok`; todo `expect.before.reason` de `sessionSwitch` é `not-armed` ou `nothing-shown`.

## Deviations from Plan

None - plan executed exactly as written.

Observações sem impacto:

- O RED da Task 1 não existe: as funções puras já estavam prontas, então o vetor e o laço entram verdes de primeira (o plano chama isso de traçador, não de TDD).
- A linha `[HEAD=0 EXPECT>=1 @c461158]` do `grep -c "vectors.sessionSwitch"` parte de c461158; no HEAD de partida a contagem era 0 e passou a 1, como o `-ge 1` exige.
- O ledger do ponto de partida em `.git` não foi gravado; o `commits:` foi medido de `e76b94e`, o HEAD no início da execução.
- Os vetores de `nextSelection` têm 31 em vez do piso de 18, porque os quatro casos de D-21 e os de snap, gesto, fila e poda pedem um vetor cada.
- A ponte com o Boards não está em uso neste repositório (sem `.planning/boards/`), então o shim não foi chamado. `STATE.md` e `ROADMAP.md` ficam com o orquestrador. `.planning/state.json` continua sem rastreio.

## Para a atenção do orquestrador

- A cola do `main.js` (quem chama quem) continua coberta só pelas travas de texto dos planos 02 a 04; os vetores provam as funções puras na ordem do main, não a ordem real das chamadas.
- Revisões que mudaram o comportamento durante a fase e já estão refletidas nos vetores: o `pollSelection` dos planos 04 e 05 (cada pedido leva `shown`; na saída de fato a ilha vai ao pedido nunca exibido mais antigo, salvo gesto de roda em curso, e senão à vizinha que não tenha pedido já exibido) e o `#detail` da troca animada do plano 06 (desliza e escala, mas não esmaece).

## Testar manualmente (checklist do PR)

Cada item se confere com a ilha desta branch (`feat/fase-5-sessoes`): a ilha do autor roda de outra pasta e não tem este código.

### Âncora ao lado em tela estreita

- A 1366x768 a 125% (área útil abaixo de 1220 DIP), com a âncora *Ao lado da ilha do sistema* e um pedido de permissão na tela, Permitir e Negar aparecem desabilitados com "Responda no terminal". Com área útil de 1220 DIP ou mais, os botões funcionam como antes.

### Pontos e projeto

- Com duas a oito sessões, os pontos aparecem na ordem de abertura, com a cor do estado e o da exibida maior; com 9 sessões volta o número no lugar dos pontos.
- O clique num ponto troca a sessão, não arrasta a pílula nem a abre no modo clique.
- O ponto de quem pede permissão pulsa; com "reduzir movimento" do Windows ele fica parado, com anel.
- O título compacto mostra o projeto com reticências; o cabeçalho do pedido mostra "projeto · ferramenta" sem cortar a ferramenta. Um nome de projeto longo ou curto não muda a largura da pílula.
- Trocar para uma sessão concluída não toca som.
- Com o estilo de animação Elástico, expandir a pílula e olhar se o fim do movimento da largura perdeu o balanço (efeito do `max-width` de 400 px).
- Resíduo de layout aceito (T-05-28): com o cursor sobre a pílula, ao clicar nos pontos de uma sessão "trabalhando" e de uma "concluído", anotar o quanto a pílula e os pontos se movem (numa âncora de baixo, também o quanto a barra sobe ou desce) e conferir que Permitir e Negar, se estavam armados, voltam a desabilitar e só rearmam no lugar novo.

### Roda e "Rolar janelas inativas"

- Com duas ou mais sessões, um entalhe da roda sobre a pílula anda uma sessão: para baixo a seguinte, para cima a anterior, sem dar a volta no começo nem no fim. No touchpad a troca é mais lenta e a inércia não dispara várias sessões.
- A roda só chega à janela da ilha, que nunca recebe o foco, com "Rolar janelas inativas ao passar o mouse sobre elas" ligado; sem essa opção a roda não chega e o clique no ponto continua trocando a sessão (D-02).
- A roda chega à ilha com um terminal elevado (Gerenciador de Tarefas) em foco.
- Rolar o texto de um pedido, sobre a ferramenta, o texto ou a dica, até o fim nunca troca de sessão.

### Snap e fila

- Com duas sessões, um pedido na outra leva a ilha até ela uma vez e toca o som de "precisa de você". Rolando para longe, a ilha não volta e o ponto da sessão do pedido pulsa.
- Girando a roda quando o pedido chega, a troca espera o gesto parar.
- Com um pedido na tela, um segundo pedido só aparece como "1 de 2" e no ponto.
- Ao responder o primeiro (na ilha e, noutra rodada, no terminal), a ilha vai ao segundo, com Permitir e Negar desabilitados por 0,8 s.
- Exceção da D-14: girando a roda sobre a pílula enquanto o terminal responde o pedido exibido, a ilha vai ao próximo pendente sem esperar o gesto, e Permitir e Negar só armam depois dos 800 ms.
- Com a ilha escondida pelo atalho, um pedido novo não a mostra.

### Sessão morta e saída da sessão exibida

- Com duas sessões, fechar a janela do terminal de uma (sem /exit) faz o ponto dela sumir em menos de 1 s e o arquivo `~/.claude/island/<id>.json` dela desaparecer; a sessão do outro terminal continua intacta. Fechar só uma aba do Windows Terminal mantém o ponto até o prazo (2 h trabalhando, 12 h esperando).
- Com uma sessão concluída na tela e outra trabalhando, depois de 10 s a ilha continua mostrando a concluída; ao rolar para a outra, o ponto da concluída some. A concluída sozinha some em 10 s.
- Saída da sessão exibida (D-21), com três sessões: deixar um pedido de lado (rolar para longe dele) e encerrar a sessão exibida leva à vizinha da esquerda, nunca de volta ao pedido deixado; se a vizinha da esquerda for a do pedido deixado, ela é pulada e vale a próxima. Só se todas as restantes tiverem um pedido deixado a ilha pousa na mais próxima (exceção registrada, com Permitir e Negar rearmando).
- Com um pedido que nunca apareceu na tela (chegou na fila), encerrar a exibida leva a ele; no meio de um gesto de roda, não leva e fica na vizinha.

### Mola de troca e acento

- Com duas ou mais sessões, rolar para baixo traz o conteúdo da próxima sessão de baixo para cima e rolar para cima traz o da anterior de cima, com o ritmo do mod (assenta em menos de 1 s, sem balanço).
- Durante a troca os pontos, o "Abrir", Permitir e Negar não se movem; só o ícone com o título, o detalhe (desliza, mas não esmaece) e o pedido deslizam.
- Trocando para uma sessão com pedido, seja pela roda, pelo ponto, pelo snap ou pela fila, Permitir e Negar ficam desabilitados enquanto o conteúdo desliza e só habilitam depois dos 0,8 s, e um clique no meio da animação não aprova nada.
- Com "reduzir movimento" do Windows ligado, a troca é seca, sem deslocamento, e a cor do acento também troca sem transição.
- A cor do acento passa suavemente de laranja para âmbar (precisa de resposta) e para verde (concluído); o bloco do pedido não muda de cor na troca.

## Known Stubs

None.

## Threat Flags

None. O plano só acrescenta vetores e um teste de constantes; não mudou canal de IPC, CSP nem código de produção (T-05-24 a T-05-26 do plano seguem cobertos pela comparação com `c461158`, pelos sete vetores de `sessionSwitch` e pelas travas que já existiam).

## Self-Check: PASSED

- `fixtures/permission-vectors.json` e `gate.test.js` existem e estão commitados.
- Commits `98bfebe` e `d73e1a7` estão na branch `feat/fase-5-sessoes`.
- `node --test`: 493 testes, 0 falhas; fixture antigo igual ao de `c461158`.
