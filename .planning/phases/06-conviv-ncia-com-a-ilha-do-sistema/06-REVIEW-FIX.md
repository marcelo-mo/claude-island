---
phase: 06-conviv-ncia-com-a-ilha-do-sistema
fixed: 2026-11-21
source: 06-REVIEW.md
status: partial
fixed_count: 11
skipped_count: 3
---

# Fase 6: Correções do Code Review

| ID | Decisão | O que foi feito | Commit |
|----|---------|-----------------|--------|
| CR-01 | Parcial; o resto vai ao autor | Não é regressão: a âncora padrão já fica em cima do mod, e o gate não vê oclusão por outra janela em nenhuma âncora. Corrigido o que estava errado: o docstring não diz mais "vale em todo monitor" e passa a registrar o limite de 1220 DIP; um teste trava o limite (1220 cabe, 1218 não, 1093 puxa 64 px); README e `docs/INTEGRACOES.md` avisam. Fazer o gate recusar nesse caso mexe em `sendState`/`island:decide` (área da Fase 5) e vira pergunta ao autor no PR | 32b68c6 |
| WR-01 | Documentado | Notch com âncora ao lado: `ponytail:` no código, README e documento recomendam Pílula ou Windows 11 | 32b68c6 |
| WR-02 | Corrigido | Sem o backdrop, a pílula do mod é estimada pelo maior painel (380×184 ×1,025, centrado, 22 px abaixo do topo do palco, escala pela largura do palco), em vez do palco inteiro | 99c013f |
| WR-03 | Corrigido | `trap` sai com 3 em erro do script; parâmetros inválidos saem com 2 (validados no corpo, porque erro de binding do `-File` sai com 1) | 99c013f |
| WR-04 | Corrigido | Trava com `\b` (pega espaço e colchete); `createIsland` só chamado por `syncIslands` (criação não é reafirmação, e o nome do teste foi corrigido); argumentos dos timers por parênteses balanceados; função agendada declarada com `function` ou `const` | 32b68c6 |
| WR-05 | Documentado | "Dois alertas do mod" e "oclusão não detectada" em Limites conhecidos do documento e nos riscos aceitos do `06-SECURITY.md`; CHK-63/64 no UAT | — |
| IN-01 | Corrigido | Centro arredondado uma vez; vetor com largura ímpar no teste do espelho | 32b68c6 |
| IN-02 | Corrigido | Conferido no mod: ele centra pela área útil (`work.left + (workW - s.width) / 2`, `.wh.cpp:4041`); documento ajustado | 32b68c6 / docs |
| IN-03 | Mantido | Agrupar os seletores quebra a trava de `visual.test.js` ("uma regra só" por seletor da Fase 4). A duplicação são 4 linhas com teste próprio | — |
| IN-04 | Corrigido | Removidos `Pid`, `Title`, `Topmost` e `GetWindowLongPtrW`; cabeçalho lista todas as APIs | 99c013f |
| IN-05 | Corrigido | Com `GetWindowLongPtrW` removido, o script roda no PowerShell de 32 bits | 99c013f |
| IN-06 | Corrigido | `inversoes` conta trocas; aviso quando há mais de uma janela do mod; `sumicos` virou `amostras_com_sumico` | 99c013f |
| IN-07 | Corrigido | O teste de timer ficou só com o que o outro não cobre (`.focus(`, `showInactive(`, `.show(`, `.restore(`) | 32b68c6 |
| IN-08 | Corrigido | `[Console]::OutputEncoding` em UTF-8 | 99c013f |

Suíte depois das correções: `node --test` 362/362.
