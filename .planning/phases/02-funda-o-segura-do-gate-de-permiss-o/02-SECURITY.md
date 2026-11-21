---
phase: "2"
slug: "funda-o-segura-do-gate-de-permiss-o"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-21"
---

# Phase 2 — Security

> Contrato de segurança da fase: registro de ameaças, riscos aceitos e trilha de auditoria.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| renderer → main (IPC `island:decide`) | O renderer só manda intenção (`allow`/`deny`) e o eco do id que viu; o alvo é sempre o `shown.id` do main | intenção + eco do id (aprova execução de comando) |
| página carregada → preload | Só o frame principal em `index.html` (URL exata) é aceito como remetente; a janela não navega nem abre outras | `window.island` (capacidade de decidir) |
| main → arquivo de decisão | Gravação temp + rename, antes de marcar o pedido como decidido | decisão allow/deny por id |
| ilhas em vários monitores | Primeiro clique vence (`decidedPermissionId`) | decisão por id |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-01 | Tampering | `island:decide` + `acceptDecision` (TOCTOU) | high | mitigate | eco com igualdade estrita (`state.js`), vetores, trava da cola em `gate.test.js` | closed |
| T-02-02 | Tampering | duas ilhas decidindo o mesmo id | high | mitigate | `decidedPermissionId`, grava antes de marcar, `answeredId` no renderer | closed |
| T-02-03 | Elevation of Privilege | decisão de janela invisível/fora da área/coberta | high | mitigate | só valor exato aceita; `isVisible && !isMinimized`; `isWithinWorkArea`; tela cheia como constante (residual aceito, TELA-01) | closed |
| T-02-04 | Tampering | relógio do gate | medium | mitigate | `performance.now()`; delta negativo/não finito recusa; vetores 799/800/801 ms | closed |
| T-02-05 | Spoofing | renderer escolhendo o pedido | high | mitigate | `permissionId: shownId`; grava `verdict.permissionId` | closed |
| T-02-06 | Tampering | rearme engolido pelo retorno antecipado | medium | mitigate | compara estado + época; reducer `nextShownPermission` com vetores | closed |
| T-02-07 | Tampering | arquivo de decisão forjado | low | accept | mesmo usuário do SO (ver Accepted Risks) | closed |
| T-02-08 | Tampering | clique durante troca/animação | high | mitigate | `restartArming` por `armEpoch`, ResizeObserver, `visibilitychange`, `buttonsRect`; `settleStep`/`canPress` com vetores | closed |
| T-02-09 | Tampering | gesto que atravessa botões/pedidos | high | mitigate | press com `armToken`; `isValidRelease`; eco do `pointerdown` | closed |
| T-02-10 | Spoofing | inércia da roda marcando lido | medium | mitigate | `isWheelSettled`, `canMarkRead`, roda `passive: false` | closed |
| T-02-11 | Spoofing | pílula/botões translúcidos ou ampliados | medium | mitigate | opacidade computada '1' para armar; hover só com `filter` (travado) | closed |
| T-02-12 | Elevation of Privilege | clique sintético ou de teclado | low | mitigate | click exige press do `pointerdown` | closed |
| T-02-13 | Tampering | renderer comprometido ignorando guardas do renderer | medium | accept | main mantém 800 ms, eco e primeiro clique (ver Accepted Risks) | closed |
| T-02-14 | Elevation of Privilege | regressão em `webPreferences` | high | mitigate | `SECURE_WEB_PREFERENCES` congelado, espalhado por último, testado | closed |
| T-02-15 | Elevation of Privilege | canal IPC novo | high | mitigate | lista fechada (7 no preload, 6 `ipcMain.on`), `.ipc`/`ipc-message` recusados por teste | closed |
| T-02-16 | Spoofing | ilha translúcida com pedido (Fase 4) | medium | mitigate | `effectiveOpacity` com vetores; renderer exige opacidade '1' | closed |
| T-02-17 | Tampering | preload sem trava `process.sandboxed` | low | accept | ver Accepted Risks; reavaliar na UAT-1 | closed |
| T-02-18 | Tampering | clique logo após restaurar/reexibir | high | mitigate | `show`/`restore`/`display-*` chamam `refresh('rearm')`; travado por teste | closed |
| T-02-19 | Elevation of Privilege | CSP afrouxada para carregar regras | medium | mitigate | CSP intacta e travada; regras inline testadas via `node:vm` | closed |
| T-02-SC | Tampering | instalação de pacotes | low | accept | nenhuma dependência nova (diff conferido) | closed |
| T-02-CR01 | Elevation of Privilege | navegação da janela herdando `window.island` | critical | mitigate | `will-navigate`/`will-redirect` bloqueados, `setWindowOpenHandler` deny, `loadURL(ISLAND_URL)`, `isIslandSender` em todos os handlers (14 vetores) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-02-01 | T-02-07 | Forjar o arquivo de decisão exige o mesmo usuário do SO, que já tem acesso equivalente | plano 02-01 (pesquisa) | 2026-11-21 |
| AR-02-02 | T-02-13 | Modelo de ameaça é erro/corrida do usuário, não renderer malicioso; evidências do renderer só recusam; a navegação para página estranha está fechada por T-02-CR01 | plano 02-03 (pesquisa A3) | 2026-11-21 |
| AR-02-03 | T-02-17 | Premissa A7 não verificada; a trava poderia impedir a ilha de subir; `webPreferences` explícitas + teste cobrem a regressão provável | plano 02-04 | 2026-11-21 |
| AR-02-04 | T-02-SC | Fase sem pacote novo | planos 02-01..04 | 2026-11-21 |
| AR-02-05 | T-02-03 (residual) | `coveredByFullscreen` é constante `false` até TELA-01 (Fase 4); não é fail-safe para esse fato, mas o contrato recusa fato ausente/diferente de `false` e a ilha fica acima de tela cheia (`screen-saver`, `visibleOnFullScreen`) | plano 02-01 | 2026-11-21 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-21 | 21 | 21 | 0 | gsd-security-auditor (ASVS L1, block_on high) |

Observações: comportamento real de CR-01, WR-01 e WR-02 ainda sem prova humana (itens 7–10 de `02-UAT.md`). IN-01..03 da revisão seguem como info, fora do registro.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-21 (auditoria automatizada; UAT humana pendente)
