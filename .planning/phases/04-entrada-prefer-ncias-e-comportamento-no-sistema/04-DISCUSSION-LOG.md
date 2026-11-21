# Phase 4: Entrada, preferências e comportamento no sistema - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-21
**Phase:** 04-entrada-prefer-ncias-e-comportamento-no-sistema
**Areas discussed:** local do preferences.json, atalho padrão, transparência, regra de tela cheia, modo "monitor do cursor", "fixar aberta" em concluído, koffi sem o autor, sombra cortada da Fase 3
**Modo:** `--auto`, sem o autor; cada escolha é a recomendada pela pesquisa ou pelo orquestrador.

---

## Local do preferences.json

| Option | Description | Selected |
|--------|-------------|----------|
| `~/.claude/island/` | D-16 da Fase 3; `isSessionFile` já o exclui | ✓ |
| `userData` | Ao lado do `positions.json`, exige migração | |

**Escolha:** [auto] manter `~/.claude/island/` (já resolvido pela Fase 3 na `main`).

## Atalho padrão

| Option | Description | Selected |
|--------|-------------|----------|
| `Control+Alt+Shift+C` | Sem caractere no ABNT2 nem no US | ✓ |
| `Control+Alt+C` | Conflita com AltGr+C (`¢`), medido | |
| `Control+Shift+Alt+F12` | Sem conflito, difícil de digitar | |

**Escolha:** [auto] `Control+Alt+Shift+C` (recomendado pela pesquisa e pelo orquestrador).

## Transparência

| Option | Description | Selected |
|--------|-------------|----------|
| `setOpacity` da janela | Medido, dono único do fato "há pedido" | ✓ |
| Só o preenchimento por CSS | Mais fiel ao mod (não confirmado), mais código | |

**Escolha:** [auto] `setOpacity`.

## Regra de tela cheia

| Option | Description | Selected |
|--------|-------------|----------|
| Primeiro plano + HWND lembrado por monitor | Não reaparece sobre o vídeo ao focar o outro monitor | ✓ |
| Só primeiro plano | Simples, como o mod | |

**Escolha:** [auto] primeiro plano + HWND lembrado; o atalho não vence a tela cheia.

## Modo "monitor do cursor"

| Option | Description | Selected |
|--------|-------------|----------|
| Troca de monitor só sem pedido na tela | Não move botões sob o usuário | ✓ |
| Segue o cursor sempre | Move pedido entre monitores | |

**Escolha:** [auto] só sem pedido.

## "Fixar aberta" em concluído

| Option | Description | Selected |
|--------|-------------|----------|
| Não expande `done` | Mesma regra de hoje: "Abrir" fica parado | ✓ |
| Expande sempre | | |

**Escolha:** [auto] não expande `done`.

## koffi sem o autor

| Option | Description | Selected |
|--------|-------------|----------|
| Executor confere release, scripts e binário; PR pede confirmação antes do merge | Orquestrador autorizou | ✓ |
| Parar a fase até o autor voltar | | |
| Helper PowerShell residente | 28 MB, sem dependência nova | |

**Escolha:** [auto] conferência automatizada registrada + item no PR.

## Sombra cortada no topo (achado da Fase 3)

| Option | Description | Selected |
|--------|-------------|----------|
| Registrar, sem mudar o respiro | Corte só aparece com a ilha arrastada para baixo, alfa baixo | ✓ |
| `--stage-top: 15px` | Resolve, mas desce a pílula 7 px (decisão visual do autor) | |

**Escolha:** [auto] registrar no PR com a correção descrita.

## Claude's Discretion

Taxas de polling, ondas e planos, nomes de funções e constantes, texto dos itens do menu.

## Deferred Ideas

Corte da sombra, transparência só do preenchimento, UI de captura de tecla, itens das Fases 5 e 6.
