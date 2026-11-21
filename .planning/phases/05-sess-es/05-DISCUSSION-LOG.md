# Phase 5: Sessões - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-21
**Phase:** 05-sess-es
**Mode:** `--auto`, a pedido do orquestrador `desenvolvimentos-81`. Em cada pergunta, a opção escolhida foi a recomendada.
**Areas discussed:** checagens do ROADMAP, seleção e ordem, pontos e rótulo, roda, snap e fila, sessões mortas, animação da troca, IPC, coordenação com a Fase 6.

---

## Checagens do ROADMAP

| Pergunta | Opções | Escolha |
|---|---|---|
| O hook já grava o projeto? | Sim, sem mudar o hook / Mudar o contrato do hook | Sim. `hook.js` e `permission-hook.js` já gravam `project` a partir do `cwd` (conferido no código). |
| Como checar a roda na janela não focável | Item de tela no PR + README / Roda sintética por SendInput | Item de tela e README. A roda sintética é proibida pela regra do projeto. |

## Seleção e ordem

| Pergunta | Opções | Escolha |
|---|---|---|
| Seleção por monitor ou única | Única, espelhada (recomendado pelo ARCHITECTURE) / Por janela | Única |
| Ordem dos pontos | Primeira aparição, a partir do `birthtimeMs` / Urgência / Recência | Primeira aparição |
| Quais sessões entram | Filtro de vivas de hoje / Manter `done` mais tempo | Filtro de hoje |
| A seleção manual expira? | Até a sessão sair da lista / Por tempo | Até a sessão sair |

## Pontos e rótulo

| Pergunta | Opções | Escolha |
|---|---|---|
| Quando os pontos aparecem | Com 2 ou mais sessões / Sempre | Com 2 ou mais |
| Teto | 8 pontos, depois o contador numérico / Sem teto | 8 pontos |
| Projeto sempre visível | Título da compacta + `#detail` + cabeçalho do pedido / Só no `#detail` | As três posições |

## Roda

| Pergunta | Opções | Escolha |
|---|---|---|
| Onde acumular | No main, função pura `wheelStep` (ARCHITECTURE) / No renderer | No main |
| Valor enviado | `wheelDeltaY` (±120, como `WM_MOUSEWHEEL`) / `deltaY` | `wheelDeltaY`, com `deltaY` × 1,2 de reserva |
| Área que só rola o texto | `#permission` inteiro / Só `#permission-text` | `#permission` inteiro |
| Clique no ponto envia | Índice inteiro validado no main / Chave da sessão | Índice |

## Snap e fila

| Pergunta | Opções | Escolha |
|---|---|---|
| Snap | Por borda, uma vez por pedido / Por nível | Por borda |
| Durante o gesto | Adiar se houve roda há menos de 400 ms / Ignorar | Adiar |
| Trava depois do snap | 400 ms / Nenhuma | 400 ms |
| Pedido novo com outro pedido na tela | Entra na fila sem snap / Substitui | Fila |
| Saída do pedido exibido | Ir ao mais antigo pendente / Voltar à sessão anterior | Mais antigo |

## Sessões mortas

| Pergunta | Opções | Escolha |
|---|---|---|
| Como detectar | `process.kill(windowPid, 0)` + idade / PID do Claude (muda o hook) | `windowPid` + idade |
| O que apagar | Mortas e as mais velhas que 12 h / Todas as expiradas | Mortas e as de mais de 12 h |

## Animação da troca

| Pergunta | Opções | Escolha |
|---|---|---|
| Mola de troca | Constantes do mod (250/31/34 px/0,965) com troca atômica / Crossfade | Mod, com troca atômica |
| Lerp do acento | Transição curta de cor / Adiar | Transição curta |

## IPC

| Pergunta | Opções | Escolha |
|---|---|---|
| Canais | `island:wheel` + `island:select`, só número / Canal genérico | Dois canais específicos |

## Claude's Discretion
- Desenho dos pontos, posição do "1 de N", nomes finais e a forma do lerp do acento.

## Deferred Ideas
- Pré-visualização no ponto, sessões por monitor, som para cada pedido da fila, PID do Claude.
