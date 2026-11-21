---
status: testing
phase: 04-entrada-prefer-ncias-e-comportamento-no-sistema
source: [04-VERIFICATION.md]
started: 2026-11-21T00:00:00Z
updated: 2026-11-21T00:00:00Z
---

## Current Test

number: 1
name: Esconder nunca aprova e reexibir rearma os botões
expected: |
  Com um pedido na tela, esconder pelo atalho Control+Alt+Shift+C e reexibir: Permitir e Negar voltam
  desarmados e só armam após 0,8 s; a ilha escondida nunca grava decisão.
awaiting: user response

## Tests

Antes de CHK-01 e CHK-02, pare a ilha (a ferramenta recusa rodar com o batimento recente).

### 1. Esconder nunca aprova e reexibir rearma os botões
expected: Com pedido na tela, esconder pelo atalho e reexibir: botões desarmados, armam após 0,8 s; nenhuma decisão gravada com a ilha escondida
result: [pending]

### 2. Arraste, duplo clique e menu seguram a captura e rearmam
expected: Nenhum clique cai na janela de baixo durante o arraste; depois de soltar, recentralizar ou fechar o menu os botões estão desarmados e armam após 0,8 s; o clique que fecha o menu não decide
result: [pending]

### 3. Timer do cursor parado com a ilha ociosa ou escondida
expected: Cliques e rolagem atravessam para a janela de baixo; CPU ociosa sem o timer de 30 Hz
result: [pending]

### 4. CHK-01, hover com terminal elevado
expected: Com o Gerenciador de Tarefas elevado em foco, o polling segue vendo o cursor (polling-viu-o-cursor) e a pílula real expande e captura o clique, a 100% e a 125%
result: [pending]

### 5. CHK-02, AltGr+C no ABNT2
expected: AltGr+C confirma o conflito de Control+Alt+C; Control+Alt+Shift+C dispara; nenhum acelerador "tomado-por-outro-processo"
result: [pending]

### 6. CHK-03, menu nativo
expected: Menu perto do cursor com todos os itens e o valor atual marcado; clicar fora fecha; o clique que fecha não decide; escolher item não tira o foco do terminal; "Esconder" esconde a ilha
result: [pending]

### 7. CHK-04, monitor a 125%
expected: Sem piscar na borda; arraste, duplo clique, Permitir/Negar funcionam; âncora de baixo sem recusa do gate; âncora de canto não deixa a pílula passar da borda
result: [pending]

### 8. CHK-06, som com a ilha escondida
expected: Esconder por ~10 min, chega pedido: o som toca, a ilha não reaparece, o terminal vale; ao reexibir, botões desarmados
result: [pending]

### 9. CHK-07 e CHK-08
expected: A roda chega à pílula com app elevado em foco; o komorebi não retila a ilha ao esconder/mostrar
result: [pending]

### 10. Respiro da pílula expandida (ddda2e4)
expected: Hover em "Trabalhando", temas claro e escuro, forma pílula: ponto, título, reticências, anel e percentual não encostam nos cantos curvos; a recolhida não muda
result: [pending]

### 11. As seis âncoras
expected: 16 px das laterais e 40 px da base, sombra não recortada, hover amplia a partir da borda ancorada, trocar a âncora zera a posição arrastada (limite conhecido: âncora de base, Elástico a 0,5x e pedido chegando pode perder ~6 px da cauda da sombra superior)
result: [pending]

### 12. Transparência 85/70/55%
expected: Mistura real com o fundo e texto legível; com pedido na tela volta a 100% e depois à escolhida
result: [pending]

### 13. "Uma ilha só" (principal e monitor do cursor)
expected: A ilha só troca de monitor sem pedido na tela, mantém o tamanho físico e rearma
result: [pending]

### 14. Notch com âncora de baixo, "Expandir ao clicar" e "Fixar aberta"
expected: Clique expande, cursor saindo recolhe; Concluído nunca expande; Permitir/Negar/Abrir não armam por hover
result: [pending]

### 15. Reiniciar com as escolhas e com preferences.json inválido
expected: Cada escolha volta igual; JSON inválido vira preferences.json.<carimbo>.bad e a ilha sobe com os padrões
result: [pending]

### 16. CHK-05, tela cheia
expected: Pendente do sensor (D-20); hoje a ilha continua por cima do app em tela cheia
result: blocked
reason: depende da escolha do autor entre koffi@3.3.8 e PowerShell persistente

## Summary

total: 16
passed: 0
issues: 0
pending: 15
skipped: 0
blocked: 1

## Gaps
