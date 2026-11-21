---
phase: 06-conviv-ncia-com-a-ilha-do-sistema
plan: 02
subsystem: medição e documentação
tags: [conv-02, conv-03, windhawk, toast, notch]
requires: [06-01]
provides: [scripts/measure-coexistence.ps1, docs/INTEGRACOES.md, docs/ISSUE-API-EXTERNA.md, 06-UAT.md]
affects: [README.md]
key-files:
  created: [scripts/measure-coexistence.ps1, docs/INTEGRACOES.md, docs/ISSUE-API-EXTERNA.md, .planning/phases/06-conviv-ncia-com-a-ilha-do-sistema/06-UAT.md]
  modified: [README.md]
key-decisions: [D-09 medidor somente leitura com recusa, D-10 documento em docs/, D-11 issue não postada]
---

# 06-02: medidor de convivência e registro das integrações

## O que foi feito

- `scripts/measure-coexistence.ps1`: P/Invoke somente leitura (EnumWindows, GetClassName, GetWindowText,
  GetWindowRect, IsWindowVisible, GetWindowLongPtr), DPI-aware por thread, 2 Hz, padrão 300 s. Pílula do mod
  pela janela `DynamicIslandBackdrop` (cai no palco inteiro, com aviso, se o blur estiver desligado). CSV por
  amostra e resumo `inversoes`, `sumicos`, `amostras_com_sobreposicao`, `maior_sobreposicao_px2`. Saída 0/1/2.
- `docs/INTEGRACOES.md`: mod (sem API, janela, disputa de topo, clique), toast (caminho no mod, limites, por que
  não aprova), apps de notch (NotchNook com a versão Windows, Alcove, boring.notch, Live Activities do macOS
  27.3, outros), cada um com verificado × não verificado e fonte.
- `docs/ISSUE-API-EXTERNA.md`: texto da issue em inglês, marcado como não postado.
- README: item "Ao lado da ilha do Windhawk" com o link do documento e do medidor.
- `06-UAT.md`: CHK-61..67, lado esquerdo e ajuste fino, e a issue.

## Verificação

- Medidor com a ilha do mod escondida: recusa com código 2 e a mensagem certa.
- Laço de medição exercitado numa cópia descartável (fora do repositório) que troca a classe do mod pela da
  barra de tarefas secundária: 6 amostras, CSV com as 13 colunas, código 0. O caminho de sobreposição positiva
  não foi exercitado (precisa das duas ilhas na tela).
- Nenhum caminho local, nome de usuário ou texto de pedido nos documentos.

## Desvios

Nenhum.

## Self-Check: PASSED
