---
phase: quick-261122-sv-seletor-vertical
reviewed: 2026-11-22T00:00:00Z
depth: deep
diff: 2d9b9ca..HEAD (feat/seletor-vertical)
files_reviewed: 9
files_reviewed_list:
  - state.js
  - main.js
  - index.html
  - island.test.js
  - gate.test.js
  - README.md
  - .planning/REQUIREMENTS.md
  - .planning/PROJECT.md
  - .planning/phases/05-sess-es/05-CONTEXT.md
findings:
  critical: 0
  warning: 6
  info: 6
  total: 12
status: issues_found
---

# Revisão: seletor vertical, pontos só na expandida, revogação da D-21

**Revisado:** 2026-11-22
**Profundidade:** deep (state.js → main.js → index.html, cruzado com os testes e a documentação)
**Testes:** `node --test` no worktree: 500 passam, nenhum falha.

## Resumo

A parte de lógica está correta. Sem a chave segurada, `sessionList` não depende mais da seleção, então
`lastSessionList = list` dá exatamente o que dava o recálculo antigo depois da troca. `previousKeys`, a vizinha
de `keyAfterPoll`, o snap para pedido nunca exibido e a espera durante o gesto continuam iguais. O CSS da
coluna também está certo na especificidade e no `hidden`.

Os problemas estão em três lugares:
- **Interação com o invariante de segurança:** a D-22 transforma uma saída rara (a "exceção registrada") em
  algo que acontece toda vez que um "concluído" vence. O argumento escrito na D-22 de que "o pior caso é o
  Abrir" não vale nas âncoras de baixo.
- **Layout:** a calha de 40 px move Permitir/Negar quando o número de sessões muda, e a coluna centralizada
  na vertical move os pontos quando a altura muda.
- **Testes e documentação:** a conta do palco não considera a calha, e vários documentos ainda descrevem a D-21.

Nenhum achado é crítico. Em todos os casos de movimento de Permitir/Negar, o rearme por retângulo, o
armamento de 0,8 s e a espera de 200 ms (`canPress`) seguem segurando a aprovação.

## Verificado sem achado

- `main.js:481-497`: uma lista só, guardada como `lastSessionList`. Sem `keptKey`, `sessionList(sessions, now)`
  não depende da chave, e a lista que os pontos mostram (`pickState(...).sessions`) e a lista em que o clique e
  a roda andam (`lastSessionList`) saem dos mesmos `sessions` e `now`, na mesma ordem `byFirstSeen`.
- Quando o concluído exibido vence, `exited` fica true (`state.js:397`), `keyAfterPoll` usa as chaves do ciclo
  anterior (que ainda têm A) e chega à vizinha certa. Com gesto em curso, a vizinha vem sem snap e o pedido
  nunca exibido fica para o ciclo seguinte (`state.js:403-407`). A chave antiga não traz o vencido de volta
  (`pickState` volta para a urgência).
- Especificidade: `#pill.expanded:has(> #sessions:not([hidden]))` vale (2,2,0) e ganha de `#pill.expanded`
  (1,1,0). Nenhuma regra de forma ou de âncora mexe em padding. `#sessions[hidden]` (1,1,0) e
  `#pill:not(.expanded) #sessions` (2,1,0) ganham de `#sessions {display:flex}` (1,0,0).
- `measurePillTarget` (`index.html:807-822`) lê `paddingRight` já calculado, então `--content-width` fica em
  336 px com a calha.
- A mola de troca (`--tab-*`) não chega a `#sessions`, e `gate.test.js:1771-1789` continua travando isso.
  Nenhum ponto fica dentro de `#lead`, `#detail` ou `#permission`.
- Clip pelos cantos: com 8 pontos de 10 px na expandida de 104 px, o centro do ponto de cima (380, 17) fica a
  24,8 px do centro do canto (364, 36), dentro do raio de 36. No notch (16 px embaixo) e no win11 (8 px), cabe.

## Avisos

### WR-01: com a D-22, a ilha cai num pedido já deixado em cada "concluído" que vence, e nas âncoras de baixo Permitir aparece onde estava o "Abrir"

**Arquivos:** `state.js:258`, `state.js:352` (`?? candidates[0]`), `.planning/phases/05-sess-es/05-CONTEXT.md:212`,
`.planning/phases/05-sess-es/05-SECURITY.md:62,101`

**Cenário:**
1. Há duas sessões, A (trabalhando) e B (pedido de permissão).
2. O usuário vê o pedido de B, decide deixar para depois e rola até A. O pedido de B fica "exibido e deixado".
3. A conclui. A pílula fica compacta e verde, com "Abrir" (`#open-compact`) na ponta direita da barra.
4. Aos 10 s, A sai da lista. Como todas as sessões restantes (só B) têm pedido deixado, `keyAfterPoll` cai em
   `candidates[0]`: é a exceção registrada da D-21, que antes só acontecia com `SessionEnd`, terminal fechado
   ou prazo de 2 h/12 h. Agora acontece em todo concluído que vence.
5. B está em `waiting`, então `shouldExpand` abre a pílula sozinho.

Com âncora `bottom-*`, a base da pílula fica parada e ela cresce para cima. A conta aproximada, com a compacta
multissessão de cerca de 376 px (título de 140 px, anel e "Abrir"):

| Elemento | Faixa horizontal | Faixa vertical |
|---|---|---|
| "Abrir" na compacta | centro+111 a centro+171 | H-36 a H-10 |
| Permitir na expandida | centro+79 a centro+176 | H-49 a H-16 |

As duas faixas se sobrepõem. Se o usuário mira "Abrir" (A acabou de concluir) e clica depois de cerca de 1 s,
o clique cai em Permitir já armado. Se o texto coube inteiro, ele já conta como lido.

O 0,8 s mais os 200 ms de `canPress` são a mitigação aceita para snaps. Mesmo assim:
- O argumento escrito na D-22 (`05-CONTEXT.md:212`: "o pior caso é o clique em 'Abrir' cair na pílula da
  sessão seguinte, que não aprova nada") está errado nesse caso.
- A ameaça T-05-31 (média) ficou muito mais frequente, e o registro dela continua dizendo que é rara.
- O pedido alvo é justamente um que o usuário decidiu deixar.

**Correção sugerida (escolha do autor):**
- (a) Correção mínima: quando a saída vem de um concluído que venceu e todas as restantes têm pedido deixado,
  não cair nelas. Por exemplo, segurar o concluído só nesse caso: `aliveSessions` mantém o exibido vencido se
  `list.every((entry) => leftKeys.has(entry.key))`. Isso exige passar a informação de `pollSelection` para
  `sessionList`, ou fazer o filtro no `refresh`.
- (b) Exigir que o cursor saia do retângulo dos botões antes de armar depois de uma troca automática
  (`snapped` ou saída).
- Em qualquer caso, corrigir o texto da D-22 e reabrir a T-05-31 no `05-SECURITY.md` com a frequência nova.

### WR-02: a calha de 40 px liga e desliga com o número de sessões e move Permitir/Negar 16 px durante um pedido

**Arquivos:** `index.html:248`, `index.html:907`, `index.html:324-328`

**Cenário:**
1. O usuário está lendo o pedido de B. Há 2 sessões, a coluna está visível e o conteúdo vai até x = 360.
2. O "concluído" de A, que não está na tela, vence em 10 s (ou uma terceira sessão abre, ou passa de 8 para 9).
3. `sessionsStrip.hidden` muda, a regra `:has` deixa de valer e o padding-right volta a 24.
4. `#pill.has-permission #open { margin-right: auto }` mantém Negar/Permitir alinhados à direita do conteúdo,
   então os dois andam 16 px para a direita.

O rearme por retângulo (`index.html:992`) e o `ResizeObserver` desarmam a tempo, então isso não é falha de
segurança. Mas é um movimento novo dos botões que aprovam, e ele acontece justamente no evento mais comum da
D-22 (outra sessão concluir enquanto se lê um pedido). Antes da D-23, uma sessão a mais ou a menos mudava só
a barra. O texto do pedido também quebra as linhas de outro jeito no meio da leitura.

**Correção:** reservar a calha sempre que há pedido na tela, para o layout do pedido não depender do número
de sessões:
```css
#pill.expanded:has(> #sessions:not([hidden])), #pill.expanded.has-permission { padding-right: 40px; }
```
Outra opção: reservar sempre que a pílula estiver expandida. Atualizar o teste de `gate.test.js:1401-1402`.

### WR-03: a coluna fica centralizada na altura inteira da pílula, então os pontos mudam de lugar quando a altura muda

**Arquivo:** `index.html:243-246` (`top: 8px; bottom: 8px; justify-content: center`)

**Cenário:** com 4 sessões na expandida de 104 px, o usuário clica no ponto 2 para ir a uma sessão com janela.
A altura vai para 148 px (`has-window`), o centro da coluna desce de 52 para 74 px e cada ponto desce 22 px.
O cursor agora está sobre outro ponto, e um segundo clique (duplo clique, ou clicar de novo "para garantir")
leva a outra sessão. A mesma coisa acontece:
- com pedido na tela (`height: auto`): os pontos andam junto com a mola de altura;
- ao expandir: a coluna nasce com 30 px de altura e cresce, então os botões encolhem e voltam a crescer
  sob o cursor.

Trocar de sessão não aprova nada (e rearma), mas o seletor fica instável justamente onde se clica.

**Correção:** prender a coluna na faixa de cima, de altura fixa, para a posição depender só do índice:
```css
#sessions { position: absolute; right: 12px; top: 8px; height: 88px; /* 104 - 2 × 8 */ ... }
```
Trocar no teste `gate.test.js:1411-1412` a leitura de `bottom` pela de `height`.

### WR-04: a conta do palco nos testes ignora a calha, e a afirmação "a conta do palco segue valendo" só é verdade pelo arredondamento

**Arquivos:** `gate.test.js:962-977` (`toolLabelLines`), `gate.test.js:1400`

`toolLabelLines` calcula a largura do rótulo com `2 × padding-inline` (24 + 24), ou seja 400 − 48 − 18 = 334 px.
Com a coluna, a largura real é 400 − 24 − 40 − 18 = 318 px. A conta dá 2,64 linhas no modelo e 2,77 linhas na
realidade. As duas arredondam para 3, então `pillMaxHeight` não mudou por sorte. Qualquer ajuste pequeno (fonte,
`max-width` do projeto, calha de 44 px) passa para 4 linhas sem o teste perceber. O teste novo
(`gate.test.js:1400-1402`) afirma que a conta segue valendo, mas não liga a calha à conta.

**Correção:** em `toolLabelLines`, usar o padding da direita da regra `:has` quando ela existir:
```js
const gutter = cssDeclarations('#pill.expanded:has(> #sessions:not([hidden]))')['padding-right'];
const pillPadding = cssPixels(expanded['padding-inline'], '…') + (gutter ? cssPixels(gutter, '…') : cssPixels(expanded['padding-inline'], '…'));
```

### WR-05: o JSDoc de `nextSelection` ainda promete que "concluído" não troca a sessão

**Arquivo:** `state.js:439-441`, `state.js:451`

O texto atual: "por isso 'concluído' e 'voltou a trabalhar' não trocam a sessão (SESS-06)", e na lista de
saídas de fato: "(SessionEnd, terminal fechado, prazo de 'trabalhando' ou 'precisa de você')". Desde a D-22, o
prazo do "concluído" também é uma saída de fato e troca a sessão sozinho aos 10 s. Quem mexer em
`pollSelection` lendo esse contrato pode tentar "consertar" a troca.

**Correção:** incluir "prazo de 'concluído' (10 s)" na lista de saídas e reescrever a frase do SESS-06 como "a
troca nunca acontece no instante em que uma sessão conclui ou volta a trabalhar".

### WR-06: a documentação de planejamento e de segurança continua descrevendo a D-21 e os pontos na compacta

Pontos que contradizem o código novo:
- `.planning/ROADMAP.md:149` (critério 3 da Fase 5): "'concluído' e 'voltou a trabalhar' nunca trocam a
  sessão sozinhos". Revogado.
- `.planning/ROADMAP.md:166`: o plano 05-05 ainda é descrito como "o 'concluído' exibido não vence (D-21)",
  sem anotação.
- `05-CONTEXT.md:56` (D-06): "Sem tempo de expiração: a ilha nunca troca sozinha por 'concluído'". Contradiz a D-22.
- `05-CONTEXT.md:65`: a lista de saídas da regra que "continua valendo" não inclui o prazo do concluído.
- `05-CONTEXT.md:78` (D-07, "no lugar de `#count`") e `:86` (D-08, "o estado segue pela cor e pelos pontos" na
  compacta): na compacta não há mais pontos.
- `.planning/REQUIREMENTS.md:63` (SESS-01) e `:65` (SESS-03): não dizem "só na expandida". Na prática, o
  SESS-03 não dá para cumprir no estado "concluído" (ver IN-01).
- `05-SECURITY.md:61` (T-05-30, "só segura com outra sessão viva"): a mitigação descreve código removido.
  `:62,101` (T-05-31): ver WR-01.
- `README.md:36`: "com mais de uma sessão ativa aparece um contador". Já estava velho e ficou mais errado.
- `README.md:90-93`: "Com a pílula expandida (hover ou clique)". Mas o "concluído" nunca expande e "precisa de
  você" sempre expande. Com `expandOn: click`, o hover não mostra os pontos.

**Correção:** anotar "revogado/ajustado pela D-22/D-23" nesses trechos. Atualizar SESS-01/03, o critério 3 do
ROADMAP e as T-05-30/31. No README, dizer quando os pontos aparecem: trabalhando com hover ou clique, sempre
com pedido, nunca no concluído.

## Info

### IN-01: no "concluído" não há seletor nem contador, e o clique no ponto (SESS-03) fica impossível nesse estado

**Arquivos:** `index.html:247,269`, `index.html:691-697`

`shouldExpand` nunca expande `done`, e agora os pontos e `#count` só aparecem na expandida. Enquanto a sessão
exibida está concluída, a única pista de que há outras sessões é o título com o projeto, e só a roda troca de
sessão. Com mais de 8 sessões, não há nem número. No modo `expandOn: click`, a sessão "trabalhando" também
esconde o seletor até o clique. Isso segue o pedido do autor, mas vale confirmar com ele se essa consequência
no concluído é aceita.

### IN-02: "o ponto fica na parte reta do raio de 36 px" não é verdade

**Arquivos:** `index.html:239`, `05-CONTEXT.md:215`

A 20 px da borda direita, o ponto está dentro da faixa horizontal da curva (x > 364). A parte reta da lateral
só existe entre y = 36 e y = 68 na pílula de 104 px, e a coluna vai de 12 a 92 px. O ponto ainda fica dentro do
recorte (verificado acima), mas o comentário está errado. O anel de foco (`outline-offset: 2px`) do botão de
cima sai do recorte no canto (39,6 px > 36). Isso não importa na prática, porque a janela não recebe foco.

### IN-03: durante a mola de largura, a coluna anda com a borda direita e passa por cima da barra

**Arquivo:** `index.html:243-244`, `index.html:841-857`

O conteúdo fica na largura final (`--content-width`) e centralizado, mas `#sessions` é absoluto em relação à
borda que está animando. Ao expandir de cerca de 200 para 400 px, os pontos ficam sobre o título, o anel ou o
texto do pedido e varrem a área horizontalmente sob o cursor. É passageiro e não aprova nada.

### IN-04: efeitos de a saída por prazo do concluído acontecer com frequência

**Arquivos:** `state.js:343-353`, `index.html:712-719`, `index.html:1170`
- Se a vizinha também é um "concluído" recente, a ilha pousa nela e troca de novo segundos depois, em cascata
  até uma sessão viva.
- Como a lista muda de tamanho na saída, `sessionSwitchDirection` devolve 0: a troca por prazo nunca anima a
  mola e o conteúdo muda de uma vez.
- Ao pousar num pedido deixado (WR-01), toca de novo o aviso de "precisa de você" de um pedido que o usuário
  já viu (`shouldChime` é true porque não foi `userSwitched`).

### IN-05: comentários que ficaram velhos com a coluna vertical

- `index.html:208-211`: diz que o título "só encolhe abaixo de 140 px quando a barra não cabe (muitos pontos
  com 'Abrir' e anel)", e o ponytail sugere "tirar o anel da compacta com muitas sessões". Não há mais pontos
  na barra.
- `index.html:708-710`: o JSDoc de `sessionSwitchDirection` ainda fala em "direita/esquerda". Agora é
  "baixo/cima", como diz o comentário de `index.html:1167`.

### IN-06: detalhes dos testes

- `gate.test.js:1412`: usa a altura 104 escrita no teste em vez de ler `cssDeclarations('#pill.expanded').height`.
  Se a expandida mudar de altura, o teste não acompanha. `gate.test.js:1409` também escreve `16` em vez de usar
  `button.width`.
- `island.test.js:1091`: o helper `heldSession` tem o nome de um comportamento (segurar) que deixou de existir.
  Sugestão: `sessionAt`.
- O bloco D-22 (`island.test.js:1094-1145`) trava o comportamento novo: vizinha, pedido nunca exibido com snap,
  pedido deixado pulado, gesto em curso, chave antiga sem trazer o vencido de volta. Falta um caso para a
  exceção "todas as restantes têm pedido deixado" vinda do prazo do concluído, que é exatamente o cenário de
  WR-01. Vale escrever esse teste se a regra mudar.

---

_Revisado: 2026-11-22_
_Revisor: Claude (gsd-code-reviewer)_
_Profundidade: deep_
