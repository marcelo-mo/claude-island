# Phase 3: Palco fixo, animação e visual - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-21
**Phase:** 03-palco-fixo-anima-o-e-visual
**Mode:** `--auto` (o autor pediu as fases 3 a 6 em sequência, sem perguntas; cada escolha é a recomendada)

[--auto] Selected all gray areas: onde mora a mola, o que as molas animam, gate com molas, palco fixo, origem das preferências, temas e contraste, formas, material, movimento reduzido.

| Área | Opções consideradas | Escolhida | Por quê |
|------|---------------------|-----------|---------|
| Onde mora a mola | `spring.js` com `script-src 'self'`; bloco inline entre marcadores testado por `node:vm` | Inline | CSP intacta (T-02-19); precedente da Fase 2; reuso no Tauri caiu com a Fase 1 |
| O que anima | Largura/altura por mola em JS; `transform: scale` sobre tamanho fixo; manter CSS `cubic-bezier` | Largura/altura + nudge + hover por mola | É o que o mod faz; CSS não interrompe preservando velocidade (ANIM-01) |
| Gate com molas | Só retângulo parado; molas em repouso + retângulo parado | Os dois | Defesa em profundidade; vetores novos sem mudar os antigos |
| Nudge/hover com pedido | Isolar os botões do transform; desligar os efeitos com pedido na tela | Desligar | Menor diff que garante SEG-03 |
| Palco | Estimativa fixa ~520×410; tamanho conferido por teste que simula a mola | Conferido por teste | Evita recorte do estilo Elástico a 2× |
| Preferências | Só padrões em código; `preferences.json` só leitura; gravação + menu | Só leitura, normalizado | Permite aplicar "por valor de preferência" e conferir os temas; gravação é da Fase 4 |
| Tokens de tema | JSON separado; CSS como fonte única lida pelo teste | CSS | Uma fonte só, sem passo de build |
| Material | Camadas animadas; camadas estáticas por CSS | Estáticas | BASE-05 (nada anima com a ilha parada) |
| Movimento reduzido | Mola mais curta; pular para o alvo | Pular para o alvo | ANIM-05 |

## Claude's Discretion
- Limiares de repouso, nomes, medição do alvo no DOM, organização dos seletores, divisão em planos.

## Deferred Ideas
- Mola de troca de aba e lerp do acento (Fase 5); `spring.js` externo; gravação/menu de preferências e transparência (Fase 4); blur/acrílico (v2).
