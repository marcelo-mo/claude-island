---
phase: 05-sess-es
plan: 06
subsystem: animacao
tags: [animacao, mola, troca-de-sessao, acento, property, sess-02, sess-03]

requires:
  - phase: 05-sess-es
    provides: sessionSwitchDirection e o switchDirection do onState (plano 02), max-width só na compacta (plano 02 e correção 1eca948), suíte de 433 testes
provides:
  - SPRING_TAB { 250, 31 }, TAB_SWITCH_OFFSET_PX 34, TAB_SWITCH_SCALE 0,965 e tabSwitchFrame(offset) no bloco mola, com a direção 'tab' em springParams
  - springs.tab no mesmo mapa das molas, então o laço de quadros a avança e allSpringsAtRest (e com ele canArm) a espera
  - variáveis CSS --tab-offset, --tab-scale e --tab-fade gravadas por applySprings e lidas só pela regra de #lead, #detail e #permission
  - @property --accent como cor herdada e --accent .18s ease-out na transição base de #pill
affects: [05-07]

plan_head_before: 38a543cf5fb371adb5a4bcff2d5beb91ff88f4f2
plan_head_after: 69e12fe332c5aa544ac403ea5f4fc28ceda62344
commits: 4
story_points_realized: 3

actuals:
  tokens: 4500
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "a mola da troca só entrega números por variáveis CSS; o CSS decide quem se move, e só invólucros sem controle clicável dentro leem as variáveis"
    - "springs.tab entra no mapa depois do literal travado, sem mudá-lo, para o laço, o snap de movimento reduzido e o canArm a tratarem como as outras molas sem código novo"

key-files:
  created: []
  modified: [index.html, gate.test.js]

key-decisions:
  - "O #detail recebe deslocamento e escala da troca, mas não a opacidade da troca: ele já tem opacidade própria (0 compacto, 1 expandido) com transição, que a regra da troca não sobrescreve"
  - "O offset gravado em --tab-offset é o da mola sem arredondar, e tabSwitchFrame trata offset não numérico como 0 (string '34' inclusive), para um valor ruim nunca virar NaN no CSS"

requirements-completed: [SESS-02, SESS-03]

coverage:
  - id: D1
    description: "A troca de sessão (mesmo número de sessões, índice exibido mudou) empurra a mola de troca em 34 px na direção da troca; ícone com título, detalhe e pedido deslizam com escala 0,965 e fade; a mola assenta em menos de 1 s a 1x e não passa de 1 px do alvo"
    requirement: SESS-02
    verification:
      - kind: unit
        ref: "gate.test.js#springParams: a direção tab devolve a mola da troca do mod, sem fator de estilo, e a desconhecida segue neutra; tabSwitchFrame: escala e fade seguem o deslocamento, sem passar do deslocamento da troca e sem NaN; a mola da troca assenta em menos de 1 s a 1x e nunca passa de 1 px além do alvo, para os dois lados"
        status: pass
      - kind: unit
        ref: "gate.test.js#a cola liga a mola da troca ao laço, ao canArm e ao onState, antes de o estado novo virar o atual"
        status: pass
    human_judgment: true
    rationale: "O ritmo e a direção do deslize só se avaliam vendo a ilha; o plano não inicia o Electron"
  - id: D2
    description: "Nenhum botão da pílula (pontos, Abrir, Abrir sessão, Permitir, Negar) se move, amplia ou some na troca: a mola só alcança #lead, #detail e #permission, que não têm botão dentro; só renderSessions cria botão"
    requirement: SESS-03
    verification:
      - kind: unit
        ref: "gate.test.js#a mola da troca nunca alcança um botão da pílula: só #lead, #detail e #permission, sem botão dentro; botões e hover sem transform, scale, translate, rotate ou zoom"
        status: pass
    human_judgment: false
  - id: D3
    description: "Permitir e Negar só armam com a mola parada (springs.tab em allSpringsAtRest, que o canArm consulta); com reduzir movimento a mola vai direto ao alvo, sem deslocamento"
    requirement: SESS-03
    verification:
      - kind: unit
        ref: "gate.test.js#a cola liga a mola da troca ao laço, ao canArm e ao onState, antes de o estado novo virar o atual; o laço das molas só abre com algo em movimento e movimento reduzido ou janela escondida pulam ao alvo"
        status: pass
    human_judgment: true
    rationale: "Que Permitir e Negar ficam desabilitados durante o deslize só se confirma com um pedido real e a troca de sessão no aparelho"
  - id: D4
    description: "A cor do acento (lavagem, contorno, brilho e ponto) interpola por 0,18 s na troca de estado ou de sessão; o bloco do pedido não usa o acento; com reduzir movimento a transição da pílula é só a opacidade"
    requirement: SESS-03
    verification:
      - kind: unit
        ref: "gate.test.js#o acento é uma cor registrada e a transição base da pílula o interpola sem animar o tamanho; o bloco do pedido não usa o acento: tem tokens próprios e opacos"
        status: pass
    human_judgment: true
    rationale: "A suavidade da passagem de laranja para âmbar e verde só se vê na tela"

duration: 15min
completed: 2026-11-21
status: complete
---

# Phase 5 Plan 06: Troca de sessão animada e acento suave Summary

**A troca de sessão desliza o ícone com o título, o detalhe e o pedido com a mola do mod (k 250, c 31, 34 px, escala 0,965 e fade, direcional), sem mover nenhum botão da pílula e com Permitir e Negar esperando a mola parar, e o acento da pílula passa a trocar de cor por uma transição de 0,18 s.**

## Performance

- **Duration:** 15 min
- **Tasks:** 2 (Task 1 é o traçador)
- **Files modified:** 2
- **Commits:** 4 (RED e GREEN de cada task), medido de `38a543c` até `69e12fe`

## Accomplishments

- `index.html`, bloco `mola`: `SPRING_TAB`, `TAB_SWITCH_OFFSET_PX` e `TAB_SWITCH_SCALE` com o aviso MIT do mod (devcode90) logo acima; `springParams('tab', …)` devolve uma cópia de `SPRING_TAB` sem fator de estilo (direção desconhecida continua neutra); `tabSwitchFrame(offset)` devolve `{ scale, opacity }` e nunca lança.
- Renderer: `springs.tab` entra depois do literal travado, `applySprings` grava `--tab-offset`, `--tab-scale` e `--tab-fade` (a linha do `transform` da pílula não mudou) e o `onState` dá o empurrão `switchDirection * TAB_SWITCH_OFFSET_PX` antes de `current = next;`. Com "reduzir movimento" ou a janela escondida o laço existente vai direto ao alvo.
- CSS: `#lead, #detail, #permission { translate; scale }` e `#lead, #permission { opacity }`, os três sem botão dentro. A barra, o lado direito (pontos e "Abrir") e `#actions` (Abrir sessão, Negar, Permitir) não leem as variáveis.
- CSS: `@property --accent { syntax: '<color>'; inherits: true; initial-value: transparent; }` e `--accent .18s ease-out` ao fim da `transition` de `#pill`. A regra de reduced-motion já trocava a transição da pílula por `opacity .2s`, então não há transição de acento com ela.

## Commits

| Hash | Tipo | Assunto |
|------|------|---------|
| `7b9e268` | RED | test(animacao): cobre a mola de troca de sessão |
| `365feb2` | GREEN | feat(animacao): desliza o conteúdo na troca de sessão com a mola do mod |
| `2225c59` | RED | test(animacao): cobre a transição do acento |
| `69e12fe` | GREEN | feat(animacao): troca a cor do acento por transição curta |

## Testes

Base: 433. Final: **440**, `fail 0` (`gate.test.js` de 87 para 94 testes). Marcos do plano: 438 depois da Task 1 (meta 435) e 440 depois da Task 2 (meta 437). O script inline compila em `node:vm`. `index.html` e `gate.test.js` seguem `w/crlf`. O RED da Task 1 derruba o arquivo inteiro de `gate.test.js` (o fixture `loadInlineBlock` roda no carregamento e `SPRING_TAB` não existia), em vez de falhar teste a teste; é o comportamento do carregador já usado no arquivo.

Acceptance: `grep -c "^test(" gate.test.js` = 94; `SPRING_TAB` = 1; `springs.tab = {` = 2 (declaração e o empurrão do `onState`); `--tab-offset` = 2; `#lead, #detail, #permission {` = 1; regra de `#bar`, `#side` ou `#actions` com `var(--tab-` = 0; `devcode90` = 6; `@property --accent` = 1; `--accent .18s` = 1.

## Deviations from Plan

None - plan executed exactly as written.

Observações sem impacto:

- A linha `[HEAD=0 EXPECT>=1]` de `springs.tab = {` parte de um HEAD antigo; o resultado final (2) cumpre o `-ge 1`, a segunda ocorrência é o `springs.tab = { ...springs.tab, … }` do `onState` que a própria trava exige.
- O ledger do ponto de partida em `.git` não foi gravado; o `commits:` foi medido de `38a543c`, o HEAD no início da execução.
- A Task 1 é o traçador e o `<verify>` é só automático: o `node --test` completo (438 testes) foi executado antes de expandir para a Task 2.
- Marcadores de planejamento (D-xx, T-05-xx) não ficaram em comentários do código; o comentário da regra de troca cita só SESS-02 e evita as palavras que a trava dos botões lê (o teste junta o comentário ao seletor).
- A ponte com o Boards não está em uso neste repositório (sem `.planning/boards/`), então o shim não foi chamado. `STATE.md` e `ROADMAP.md` ficam com o orquestrador. `.planning/state.json` continua sem rastreio.

## Para a atenção do orquestrador

- O zoom do hover e o nudge continuam como na Fase 3 (leitura da D-17 pedida no despacho): movem a pílula inteira, nunca com pedido na tela. Só a mola de troca é nova, e só em invólucros sem botão.
- O `#detail` desliza e escala na troca, mas não esmaece com `--tab-fade`: ele tem opacidade própria (0 compacto, 1 expandido) com transição. O ícone com o título e o pedido esmaecem.
- `--accent` registrado como `<color>` faz o `color-mix` da lavagem, do contorno e do brilho interpolarem junto com o ponto; o plano 02 já trocava `--accent` por `#pill[data-state=…]`, então nada mais precisou mudar.

## Testar manualmente

Fica para o checklist do PR (o plano 07 consolida):

- Com duas ou mais sessões, rolar a roda para baixo traz o conteúdo da próxima sessão de baixo para cima e rolar para cima traz o da anterior de cima, com o mesmo ritmo do mod (assenta em menos de 1 s, sem balanço).
- Durante a troca os pontos, o "Abrir", Permitir e Negar não se movem; só o ícone com o título, o detalhe e o pedido deslizam.
- Trocando para uma sessão com pedido, Permitir e Negar ficam desabilitados enquanto o conteúdo desliza e só habilitam depois dela, e um clique no meio da animação não aprova nada.
- Com "reduzir movimento" do Windows ligado a troca é seca, sem deslocamento, e a cor do acento também troca sem transição.
- A cor do acento passa suavemente de laranja para âmbar (precisa de resposta) e para verde (concluído); o bloco do pedido não muda de cor na troca.

## Known Stubs

None.

## Threat Flags

None. A mola só alcança `#lead`, `#detail` e `#permission`, nenhum com botão dentro, e a trava de texto cobre os seletores que leem `var(--tab-`, o HTML dos três invólucros e o único `createElement('button')` (em `renderSessions`) (T-05-22); `springs.tab` entra em `allSpringsAtRest`, então `canArm` espera a mola e a troca de id já rearma pelo main. O conteúdo é único, sem camada antiga: texto e id trocam juntos e só os invólucros se deslocam (T-05-23). O Electron não foi iniciado e nenhum evento sintético foi gerado.

## Self-Check: PASSED

- Arquivos: `index.html` e `gate.test.js` existem e estão commitados.
- Commits `7b9e268`, `365feb2`, `2225c59` e `69e12fe` estão na branch `feat/fase-5-sessoes`.
- `node --test`: 440 testes, 0 falhas; `grep -c "^test(" gate.test.js` = 94.
