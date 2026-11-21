---
phase: 06-conviv-ncia-com-a-ilha-do-sistema
verified: 2026-11-21
status: human_needed
score: 4/6
---

# Phase 6: Convivência com a ilha do sistema - Verification

**Goal:** Ao lado da ilha do Windhawk a nossa se encaixa como segunda bolha, sem cobri-la e sem disputar o topo, e
os demais caminhos de integração ficam registrados com o que foi verificado.

## Critérios de sucesso

| # | Critério | Status | Evidência |
|---|----------|--------|-----------|
| 1a | O usuário define um deslocamento e a nossa fica ao lado da do mod, expandindo para fora | ✓ (do nosso lado) | Âncoras `right-of-island`/`left-of-island` + arraste; medido pelo CDP a 100% e 125%: borda interna a 210 px do centro, parada em todos os quadros das transições no Elástico; `coexistence.test.js` |
| 1b | ...sem cobrir a do mod, com a ilha do mod ativa | ? humano | A ilha do mod está escondida (`ManuallyHidden = 1`) e nenhum agente a mostra. Por geometria a janela invade a pílula expandida do mod em ≤ 5 px (teste). CHK-62/63/64 |
| 2a | A nossa nunca reafirma o "sempre no topo" por timer | ✓ | Um `setAlwaysOnTop` (em `createIsland`), nenhum `moveTop`, nenhum timer mexendo no z: trava de texto em `coexistence.test.js`, que pegou o primeiro rascunho do comentário |
| 2b | Em 5 minutos medidos nenhuma das duas some atrás da outra | ? humano | `scripts/measure-coexistence.ps1` pronto e exercitado (recusa com o mod escondido; laço em cópia descartável). CHK-61 |
| 3a | Toast do Windows e apps de notch registrados com o que foi verificado | ✓ | `docs/INTEGRACOES.md` |
| 3b | Proposta de API aberta como issue no repositório do autor do mod | ✗ pendente do autor | Texto em `docs/ISSUE-API-EXTERNA.md`; postar é decisão do Marcelo (instrução do orquestrador) |

## Requisitos

| ID | Status | Nota |
|----|--------|------|
| CONV-01 | Parcial | Encaixe e crescimento para fora entregues e medidos do nosso lado; convivência com o mod visível no checkpoint humano |
| CONV-02 | Parcial | Causa travada por teste; efeito (5 min) no checkpoint humano |
| CONV-03 | Parcial | Documento entregue; issue pendente do autor |

## Automatizado

- `node --test`: **361/361** (348 de antes + 13 novos), incluindo a suíte do gate e `fixtures/permission-vectors.json`.
- Gate inalterado: nenhuma mudança em `acceptDecision`, `island:decide`, armamento ou IPC.

## Itens humanos

Os nove itens de `06-UAT.md` (CHK-61..67, lado esquerdo e ajuste fino, issue).

## Não verificado nesta fase

- Qualquer coisa com as duas ilhas visíveis juntas (mod escondido).
- O caminho de sobreposição positiva do medidor.
- macOS e Linux (melhor esforço; a âncora é geometria pura e vale em qualquer SO).
