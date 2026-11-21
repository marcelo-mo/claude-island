# Phase 6: Convivência com a ilha do sistema - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-21
**Phase:** 06-conviv-ncia-com-a-ilha-do-sistema
**Areas discussed:** nome das âncoras, forma do deslocamento, monitores, alinhamento vertical, onde vive a trava de CONV-02, issue
**Modo:** `--auto`, sem o autor; cada escolha é a recomendada pela pesquisa ou pelo orquestrador, salvo onde o código da Fase 4 obrigou a ajustar.

---

## Nome das âncoras

| Option | Description | Selected |
|--------|-------------|----------|
| `beside-right` / `beside-left` | Da pesquisa; o sufixo pega as regras de lado da Fase 4 ao contrário | |
| `right-of-island` / `left-of-island` | Sem sufixo de lado; nenhuma regra herdada por engano | ✓ |

**Escolha:** [auto] `right-of-island` / `left-of-island` (D-02).

## Forma do deslocamento

| Option | Description | Selected |
|--------|-------------|----------|
| Arraste da Fase 4 | Já grava deslocamento por monitor relativo à âncora | ✓ |
| Chave `besideGapPx` no esquema | Pesquisa; muda o esquema e a validação | |

**Escolha:** [auto] arraste (D-04).

## Monitores

| Option | Description | Selected |
|--------|-------------|----------|
| Todos, como as outras âncoras | Sem âncora por monitor; "Só no monitor principal" já existe | ✓ |
| Só no principal | Pesquisa; exige âncora efetiva por ilha no main (área da Fase 5) | |

**Escolha:** [auto] todos (D-05).

## Alinhamento vertical

| Option | Description | Selected |
|--------|-------------|----------|
| Topo da âncora de topo | Pílula 22 px acima da do mod | |
| +17 px | Centro da compacta alinhado com a faixa ociosa do mod | ✓ |

**Escolha:** [auto] +17 px (D-03); o arraste ajusta.

## Trava de CONV-02

| Option | Description | Selected |
|--------|-------------|----------|
| Fim do `gate.test.js` | Pesquisa; a Fase 5 também acrescenta lá | |
| `coexistence.test.js` novo | Combinado com a sessão da Fase 5 | ✓ |

**Escolha:** [auto] arquivo novo (D-08).

## Issue ao autor do mod

| Option | Description | Selected |
|--------|-------------|----------|
| Postar | Ação externa, sem o autor | |
| Rascunho versionado | Orquestrador: pendente do Marcelo | ✓ |

**Escolha:** [auto] rascunho (D-11).
</content>
