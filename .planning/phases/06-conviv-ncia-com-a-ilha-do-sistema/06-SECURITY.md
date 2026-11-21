---
phase: "6"
slug: "conviv-ncia-com-a-ilha-do-sistema"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-21"
---

# Phase 6 — Security

> Contrato de segurança da fase: registro de ameaças, riscos aceitos e trilha de auditoria.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| arquivo `preferences.json` → main | `anchor` validado contra `ANCHORS` (agora 8 valores); qualquer outro valor volta a `top-center` | string `anchor` |
| geometria → gate | A posição ao lado só muda a janela; o gate continua exigindo a janela inteira na área útil, com a folga da âncora (`horizontalSlackFor`), e nada da geometria vem do renderer | `withinVisibleArea` calculado no main |
| ilha do mod (outro processo) ↔ nossa ilha | Nenhuma troca de dados: só convivência de janelas; o mod não envia entrada e nós não lemos nem mexemos na janela dele em tempo de execução | nenhum |
| medidor → janelas do sistema | Script somente leitura, rodado à mão | retângulos, classes, títulos, estilos |
| documento e issue → público | Texto publicado no repositório e, se o autor quiser, no repositório do mod | texto |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-06-01 | Spoofing | overlay do mod cobrindo o pedido e induzindo clique | high | mitigate + accept | Com área útil ≥ 1220 DIP, borda interna da pílula a 210 px do centro e janela invadindo a pílula expandida do mod em ≤ 5 px (`coexistence.test.js`); abaixo disso, risco aceito (ver abaixo); o mod não envia entrada, então um clique que caia nele nunca aprova por nós; gate (cursor parado, 0,8 s, mesmo botão, janela visível e dentro da área útil) inalterado | closed |
| T-06-02 | Denial of Service | disputa de "sempre no topo" entre os dois overlays | medium | mitigate | Um `setAlwaysOnTop` só, em `createIsland`; nenhum `moveTop`; nenhum timer mexendo no z (trava em `coexistence.test.js`) | closed |
| T-06-03 | Tampering | `anchor` adulterado no `preferences.json` | medium | mitigate | `PREFERENCE_VALIDATORS.anchor = isOneOf(ANCHORS)`; vetores com variações (`beside-right`, maiúsculas, espaço) voltando a `top-center` | closed |
| T-06-04 | Spoofing | pílula ao lado fora da área visível com decisão aceita | high | mitigate | `horizontalSlackFor` dá 20 px do lado interno (só a margem da sombra) e o resto do externo, somando o palco; `isWithinWorkArea` e o clamp conferidos nos dois monitores do autor | closed |
| T-06-05 | Information Disclosure | documento ou issue com dado pessoal | low | mitigate | Sem caminho local, nome de usuário, texto de pedido ou dado de sessão (`grep` na verificação); só o endereço público do repositório | closed |
| T-06-06 | Repudiation | ação externa (issue) sem o autor | medium | mitigate | Issue não postada; rascunho versionado com o aviso | closed |
| T-06-07 | Tampering | medidor alterando o mod ou outra janela | medium | mitigate | Só `EnumWindows`, `GetClassNameW`, `GetWindowTextW`, `GetWindowRect`, `IsWindowVisible` e `SetThreadDpiAwarenessContext` (da própria thread); `grep` sem `SetWindowPos`, `SendMessage`, `PostMessage`, `SendInput`, `ShowWindow` nem escrita em registro | closed |

---

## Accepted Risks

| Risk | Why accepted |
|------|--------------|
| Dois alertas simultâneos do mod (até ~356 px de meia-largura, ~4 s) alcançam a nossa pílula e o mod se sobe sobre ela | Risco de visibilidade, não de aprovação: o clique na região coberta cai no mod. Medição no CHK-64 |
| Oclusão por outra janela não detectada pelo gate (CR-01 da revisão): com área útil abaixo de 1220 DIP a âncora ao lado é puxada para cima da pílula do mod, que se sobe e pode cobrir o começo das linhas do pedido com os botões visíveis | Não é regressão: a âncora padrão (topo centro) fica exatamente em cima do mod desde a Fase 1, e qualquer overlay "sempre no topo" pode cobrir a ilha. Os botões continuam sujeitos ao gate e um clique no mod é do mod. Limite documentado no código, no README e em `docs/INTEGRACOES.md`, travado em teste. Fazer o gate recusar nesse caso (`fitsWorkArea` por âncora) mexe em `sendState`/`island:decide`, área da Fase 5: **decisão do autor** no PR |
| Convivência com o mod visível não medida nesta fase | A ilha do mod está escondida e nenhum agente a mostra; CHK-61..66 no `06-UAT.md` |

---

## Audit Trail

| Date | Auditor | Result |
|------|---------|--------|
| 2026-11-21 | Claude (fase 6, modo automático) | 7/7 ameaças fechadas; 0 abertas acima de `high`; 3 riscos aceitos (um deles, CR-01, levado ao autor) |
