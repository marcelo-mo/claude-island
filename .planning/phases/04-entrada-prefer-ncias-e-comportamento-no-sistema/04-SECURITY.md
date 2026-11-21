---
phase: "4"
slug: "entrada-prefer-ncias-e-comportamento-no-sistema"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-21"
---

# Phase 4 — Security

> Contrato de segurança da fase: registro de ameaças, riscos aceitos e trilha de auditoria.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| renderer → main (`island:capture`) | O renderer só pede captura com um booleano; o main aplica, segura no arraste e no menu, solta ao esconder ou ociosar e recusa captura com a ilha ociosa | booleano |
| renderer → main (`island:menu`) | Sem argumentos; itens, valores e gravação são do main (SEG-08); um menu por vez; abrir e fechar rearmam | nenhum |
| main → renderer (`island:cursor`) | Ponto local do cursor a 30 Hz, só com ilha visível e não ociosa; o hit-test do renderer só muda hover e captura, nunca arma | `{x, y}` ou `null` |
| arquivo `preferences.json` ↔ main | Esquema fechado por chave, teto de 64 KB, quarentena com carimbo; gravação só pelo main por `.tmp` + rename | 11 chaves de preferência |
| atalho global → main | Acelerador validado (tecla sozinha só de função), registro único em `try/catch`; esconder não aprova e reexibir rearma | evento de tecla |
| fato de tela cheia → gate | Calculado só no main, por monitor; monitor desconhecido conta como coberto; sem sensor nesta fase (D-20) | `coveredByFullscreen` por display |
| renderer → main (`island:decide`) | Inalterada desde a Fase 2; agora com `windowVisible`, `coveredByFullscreen` e `withinVisibleArea` com folga por âncora | intenção + eco do id |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-04-01 | Spoofing | menu aberto sobre Permitir/Negar | high | mitigate | `menu-will-show` e `menu-will-close` → `refresh('rearm')` (main.js); gate.test.js | closed |
| T-04-02 | Tampering | `preferences.json` adulterado | high | mitigate | validador por chave, `Object.hasOwn`, teto de 64 KB, `quarantinePath` (state.js, main.js); prefs.test.js | closed |
| T-04-03 | Elevation of Privilege | canal do renderer gravando preferência | high | mitigate | `island:menu` sem argumentos; `applyPreference` só pelo menu; 9 canais travados | closed |
| T-04-04 | Denial of Service | menu pedido em laço | low | mitigate | `menuIsland` (um por vez), `catch` do popup solta | closed |
| T-04-05 | Tampering | gravação interrompida | medium | mitigate | `writeFileAtomic` (`.tmp` + `renameSync`) para preferências e posições | closed |
| T-04-06 | Denial of Service | renderer ligando captura para engolir cliques | medium | mitigate | `islandOf` + booleano; ociosa solta tudo; captura com a ilha ociosa recusada (ed51422) | closed |
| T-04-07 | Spoofing | hover, captura ou expansão armando decisão | high | mitigate | `updateHover` só chama `setCapture` e `render`; hover.test.js proíbe `restartArming`/`armed`/`decide` | closed |
| T-04-08 | Denial of Service | captura presa após arraste, menu ou ociosa | medium | mitigate | reaplicar no fim do arraste e do menu; `'hide'` → `releaseCapture`; `isDestroyed` (WR-02) | closed |
| T-04-09 | Denial of Service | hover sem efeito com terminal elevado (UIPI) | low | accept | sem `forward`; prova humana CHK-01 | closed |
| T-04-10 | Spoofing | modo cursor levando pedido a outro monitor | high | mitigate | `islandDisplays` só segue o cursor sem pedido; troca rearma | closed |
| T-04-11 | Spoofing | pílula de canto fora da tela com o gate aceitando | high | mitigate | `horizontalSlackFor(anchor)` no clamp, no `fitsWorkArea` e no gate; vetores de canto | closed |
| T-04-12 | Denial of Service | âncora de baixo a 125% recusando tudo | low | mitigate | `setBounds` após criar; vetores +2/+3/+6 DIP | closed |
| T-04-13 | Tampering | deslocamento de uma âncora aplicado a outra | medium | mitigate | trocar a âncora zera `savedOffsets`; `positionFromSavedOffset` valida | closed |
| T-04-14 | Spoofing | reexibir com botão armado sob o cursor | high | mitigate | `showInactive` só em `applyVisibility`; `'show'` → `refresh('rearm')` | closed |
| T-04-15 | Elevation of Privilege | decisão com a ilha escondida | high | mitigate | `windowVisible` no `acceptDecision`; `setUserHidden` não toca decisão | closed |
| T-04-16 | Spoofing | pedido lido numa janela translúcida | high | mitigate | `applyOpacity` antes de `sendState` no `refresh`; `effectiveOpacity` fail-safe | closed |
| T-04-17 | Tampering | acelerador hostil travando a subida | medium | mitigate | forma e tamanho validados, tecla sozinha só F1–F24 (945858f), `try/catch` único | closed |
| T-04-18 | Denial of Service | esconder sem atalho deixa a ilha inalcançável | low | mitigate | "Esconder" desabilitado sem atalho `ok`; `userHidden` não persiste | closed |
| T-04-19 | Tampering | dependência nativa sem autorização | high | mitigate | D-20 (não concedida); package.json, pnpm-workspace.yaml e pnpm-lock.yaml idênticos a 4393a57; sem `fullscreen.js` | closed |
| T-04-20 | Denial of Service | hook quebrando por dependência nativa | high | mitigate | trava em gate.test.js: hooks, `window.js`, `state.js` e `install.js` não citam o pacote | closed |
| T-04-21 | Tampering | fato de tela cheia vindo do renderer | high | mitigate | só o main calcula; display desconhecido = coberto; só `false` exato aceita | closed |
| T-04-22 | Spoofing | atalho reexibindo sobre tela cheia | high | mitigate | `isIslandVisible` exige não coberto; `nextUserHidden` não inverte com todas cobertas | closed |
| T-04-23 | Repudiation | PR dando TELA-01 como entregue | medium | mitigate | `requirements_partial`; REQUIREMENTS.md com TELA-01 pendente e TELA-02 parcial | closed |
| T-04-24 | Tampering | ferramenta humana gerando entrada sintética | low | mitigate | `scripts/human-checks.js` sem API de entrada nem `child_process`; recusa com a ilha no ar | closed |
| T-04-25 | Repudiation | PR mesclado sem as verificações de tela | medium | mitigate | "Testar manualmente" e "Notas para o PR" (04-06-SUMMARY, 04-VALIDATION, 04-UAT) | closed |
| T-04-SC | Tampering | instalação de pacote | low | accept | nada instalado; arquivos de dependência inalterados | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

Evidência linha a linha: verdict do `gsd-security-auditor` de 2026-11-21 (26/26 fechadas, `node --test` 348/348).

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-04-01 | T-04-09 | O desenho por polling (`screen.getCursorScreenPoint()`) não usa a opção `forward`, a parte afetada por UIPI segundo a documentação do Electron; a prova com janela elevada é humana (CHK-01, `scripts/human-checks.js --mode=hover`) | orquestrador (autor fora), registrado no plano 04-02 | 2026-11-21 |
| AR-04-02 | T-04-SC | A fase não instalou nada (D-20 negou o `koffi`); arquivos de dependência idênticos a 4393a57 | orquestrador (autor fora), registrado nos planos | 2026-11-21 |

*Accepted risks do not resurface in future audit runs.*

Fora do registro, sem correção nesta fase (revisão de código): IN-02 (JSON válido porém inútil não vai para a quarentena; perde a edição manual, mantém o fail-safe) e IN-04 (`island:cursor` sem conferir a página; só vazaria a posição do cursor, e a navegação já é bloqueada).

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-21 | 26 | 26 | 0 | gsd-security-auditor (opus) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-21
