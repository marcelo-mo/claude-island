# Quick 261122-sv: seletor de sessões vertical e o "concluído" que não prende a ilha

**Origem:** pedido do autor depois de ver a Fase 5 na tela, repassado pelo orquestrador `desenvolvimentos-81` em
2026-11-22. O pedido já era a aprovação; sem pesquisa. Branch `feat/seletor-vertical`, a partir da `main` 2d9b9ca.

## O que mudou

- **D-22 (revoga a D-21):** o "concluído" exibido vence em 10 s mesmo com outras sessões vivas, e a ilha segue a
  regra de saída (pedido nunca exibido, senão a vizinha sem pedido já deixado). Com o cursor sobre a pílula, o
  vencimento espera o cursor sair (`isCursorOverIsland` no main, `heldKey` em `sessionList`/`pickState`).
- **D-23:** os pontos viram uma coluna na lateral direita da pílula expandida (`#sessions`, último filho de `#pill`,
  `right: 12px; top: 8px; height: 88px`), e pontos e contador só aparecem expandidos. A expandida segue com 400 px;
  o conteúdo cede 16 px com pontos ou com pedido na tela.
- Decisões em `05-CONTEXT.md` (D-22, D-23), PROJECT Key Decisions, SESS-01/03/06, ROADMAP, `05-SECURITY.md`
  (T-05-30, T-05-31) e README.

## Revisão de código (REVIEW.md)

| ID | Decisão | Commit |
|----|---------|--------|
| WR-01 | Corrigido: o vencimento espera o cursor sair da pílula | ae5223e |
| WR-02 | Corrigido: faixa da coluna reservada sempre que há pedido | 1fc5245 |
| WR-03 | Corrigido: coluna de altura fixa (88 px) a partir do topo | 1fc5245 |
| WR-04 | Corrigido: a conta do palco nos testes desconta a faixa | 1fc5245 |
| WR-05 | Corrigido: JSDoc de `nextSelection` | ae5223e |
| WR-06 | Corrigido: ROADMAP, REQUIREMENTS, 05-CONTEXT, 05-SECURITY, README | a0db3cf |
| IN-01 | Pergunta ao autor no PR: no "concluído" (não expande) não há pontos; a troca ali é pela roda | — |
| IN-02 | Corrigido: comentário "dentro do recorte do raio" | 1fc5245 |
| IN-03 | Aceito: durante a mola de largura a coluna passa sobre a barra; passageiro, não aprova nada | — |
| IN-04 | Aceito e no PR: cascata por outros "concluídos" recentes, troca por vencimento sem mola (a lista muda de tamanho), aviso sonoro ao pousar em pedido já deixado (já acontecia na saída por SessionEnd) | — |
| IN-05 | Corrigido: comentários de `#title` e `sessionSwitchDirection` | 1fc5245 |
| IN-06 | Parcial: helper renomeado, altura da expandida lida do CSS; a exceção da vizinha já tem teste na suíte de saída | ae5223e / 1fc5245 |

## Verificação

- `node --test`: 501/501.
- Harness de render isolado (Electron só com `index.html` e o preload real, sem `main.js`, sem `~/.claude/island`,
  sem lock, sem clique nem tecla sintéticos; fechado ao fim):
  - coluna em x = borda − 28 a borda − 12 e y = 16 a 104, igual com 3 pontos e com pedido;
  - 8 pontos com 11,2 px cada;
  - Permitir no mesmo x com 1 e com 3 sessões;
  - pontos e contador escondidos na compacta;
  - contador "10" só na expandida.
- Não verificado: a ilha real com sessões reais (hover pelo cursor do main, roda do SO, vencimento do "concluído"
  com o cursor sobre a pílula e fora dela), as formas Win11 e Notch e as âncoras de baixo.
