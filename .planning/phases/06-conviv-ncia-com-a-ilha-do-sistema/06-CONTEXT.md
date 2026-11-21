# Phase 6: Convivência com a ilha do sistema - Context

**Gathered:** 2026-11-21
**Status:** Ready for planning
**Modo:** `--auto` (o autor está fora; o orquestrador `desenvolvimentos-81` pediu a escolha recomendada em cada zona cinzenta, registrada aqui e no DISCUSSION-LOG)

<domain>
## Phase Boundary

A ilha ganha duas âncoras novas que a põem ao lado da ilha do mod "Dynamic Island for Windows"
(Windhawk), com a borda interna da pílula parada e o crescimento para fora; a ausência de qualquer
reafirmação do "sempre no topo" vira trava de teste; um script somente leitura mede a convivência; e
os demais caminhos de integração (API do mod, toast do Windows, apps de notch no macOS) ficam
registrados em documento, com o rascunho da issue ao autor do mod.

Requisitos: CONV-01, CONV-02, CONV-03. Fora: detectar o mod, seguir a pílula dele ao vivo, desenhar
dentro dela (INTG-01, v2), convivência com apps de notch (INTG-02/03), postar a issue (pendente do
autor).

</domain>

<decisions>
## Implementation Decisions

### Pré-voo: pesquisa × código da Fase 4 na `main` (78a1893)
- **D-01:** A pesquisa foi escrita antes da Fase 4 entrar na `main`. Conferido no código atual:
  `ANCHORS` tem 6 valores (`state.js`), `anchorPosition(anchor, workArea, windowSize)` e
  `horizontalSlackFor(anchor)` decidem o lado pelo **sufixo** (`endsWith('-left')`/`'-right'`), o CSS
  faz o mesmo (`:root[data-anchor$="-left"]`, `$="-right"`, `^="bottom-"`, `index.html:151-157`) e o
  teste `anchorPosition: a pílula fica a 16 px da lateral...` (`island.test.js:384`) itera `ANCHORS`
  pelo mesmo sufixo. O normalizador é `normalizePreferences` com `PREFERENCE_VALIDATORS` (não
  `sanitizePreferences`). `setAlwaysOnTop` aparece uma vez (`main.js:446`, em `createIsland`), sem
  `moveTop`; esconder e mostrar é `hide()`/`showInactive()` em `applyVisibility`. Trocar a âncora
  zera os deslocamentos salvos (`applyPreference`). Suíte: **348** testes. Mod conferido de novo:
  `@version 1.4.0`, linhas 664/672/4141/23126 iguais às da pesquisa, ilha do mod ainda escondida
  (`ManuallyHidden = 1`). Nenhuma recomendação da pesquisa ficou inválida; os nomes mudam (D-02).

### Encaixe ao lado (CONV-01)
- **D-02:** As âncoras se chamam `right-of-island` e `left-of-island`, e não `beside-right`/`beside-left`
  como na pesquisa. Motivo: no código da Fase 4 o sufixo `-right`/`-left` quer dizer "a pílula encosta
  nesse lado do palco", e `beside-right` herdaria o alinhamento à direita, que é o contrário do que ela
  precisa (ao lado direito do mod a borda interna é a esquerda). Um nome sem esse sufixo não pega
  nenhuma regra por engano no CSS, no `state.js` nem no teste da Fase 4. Rótulos do menu: "Ao lado da
  ilha do sistema, à direita" / "..., à esquerda".
- **D-03:** Posição: a borda interna da pílula fica a `BESIDE_GAP_PX = 210` do centro horizontal da área
  útil (190 de meia-largura do painel expandido do mod, `kExpandedWidth = 380`, + 4,75 do hover 1,025 +
  folga). A janela começa `STAGE_SHADOW_PX` (20) antes dessa borda, para a sombra caber: a janela
  invade a pílula do mod em até ~5 px só com ela expandida e com hover, bem abaixo do limiar de 1/8 do
  `EnsureTopmost` dele (`.wh.cpp:4141`). Vertical: `BESIDE_TOP_OFFSET_PX = 17` abaixo da âncora de topo,
  para alinhar o centro da nossa pílula compacta (8 + 46/2 = 31) com o da faixa ociosa do mod
  (8 + 22 + 36/2 = 48, `.wh.cpp:664` e `:4054`).
- **D-04:** "Deslocamento configurável" = o arraste da Fase 4, que já grava um deslocamento por monitor
  relativo à âncora. Sem chave nova `besideGapPx` no `preferences.json`: o arraste cobre o ajuste fino
  sem mudar o esquema. `ponytail:` no código com o caminho de subir (chave no esquema) se alguém pedir.
- **D-05:** A âncora vale para todos os monitores, igual às outras seis. Quem usa o mod só no principal
  escolhe "Ilhas > Só no monitor principal" (Fase 4). `ponytail:` com o caminho de subir (âncora por
  monitor).
- **D-06:** Alinhamento: a pílula encosta na borda interna do palco (com a margem da sombra) e o
  `transform-origin` fica nessa borda, então mola, hover e nudge (só vertical) mexem só a borda externa.
  O CSS reaproveita as regras de lado da Fase 4: `right-of-island` entra no grupo de `-left` e
  `left-of-island` no de `-right`. `horizontalSlackFor` segue a mesma regra (folga de 20 px do lado
  interno).
- **D-07:** Nada detecta o mod nem lê a janela dele em tempo de execução (sem `koffi`, sem PowerShell no
  main). Seguir a pílula dele ao vivo fica como ideia de v2 junto do INTG-01.

### Nunca disputar o topo (CONV-02)
- **D-08:** Trava de texto num arquivo de teste novo (`coexistence.test.js`, combinado com a sessão da
  Fase 5 para não disputar o fim de `gate.test.js`): `main.js` sem `moveTop(`, exatamente um
  `setAlwaysOnTop(` e dentro de `createIsland`, e nenhum corpo de `setInterval`/`setTimeout` citando
  `setAlwaysOnTop`, `moveTop` ou `focus`. Comentário no `createIsland` explicando a regra.
- **D-09:** `scripts/measure-coexistence.ps1`, somente leitura (EnumWindows, GetWindowRect, estilos),
  DPI-aware, 2 Hz, padrão 300 s: recusa com código 2 se a ilha do mod não estiver visível, e sai com 1
  se houver inversão de ordem, sumiço ou sobreposição da nossa janela com a pílula do mod em mais de 1
  amostra. O agente só o roda para provar a recusa (o mod está escondido e nenhum agente o mostra); os
  5 minutos ficam no checkpoint humano.

### Registro e proposta (CONV-03)
- **D-10:** `docs/INTEGRACOES.md` (mod, toast do Windows, apps de notch, com o que foi verificado e a
  fonte) e `docs/ISSUE-API-EXTERNA.md` (texto da issue em inglês, rascunho). README ganha o link e a
  âncora nova.
- **D-11:** A issue **não** é postada: fica pendente do autor (instrução do orquestrador). CONV-03 fecha
  parcial: documento entregue, issue pronta para postar.

### Claude's Discretion
- Texto exato dos rótulos, formato do CSV do medidor, estrutura do documento.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/phases/06-conviv-ncia-com-a-ilha-do-sistema/06-RESEARCH.md` — geometria do mod, z-order medido, rascunho da issue, conteúdo do documento
- `.planning/research/WINDHAWK-MOD.md` — leitura anterior do mod
- `state.js` (`ANCHORS`, `anchorPosition`, `horizontalSlackFor`, `PREFERENCE_LABELS`) e `index.html:148-157` — mecanismo de âncora da Fase 4
- `main.js:406-455` (`createIsland`) — único `setAlwaysOnTop`
- `THIRD_PARTY_NOTICES.md` — crédito do mod (valores portados levam a referência)

</canonical_refs>

<deferred>
## Deferred Ideas

- Chave `besideGapPx` no `preferences.json` (D-04) e âncora por monitor (D-05), se o arraste não bastar.
- Seguir a pílula do mod ao vivo pela janela `DynamicIslandBackdrop` (exige FFI ou PowerShell persistente).
- Postar a issue no repositório do mod (autor).

</deferred>
</content>
