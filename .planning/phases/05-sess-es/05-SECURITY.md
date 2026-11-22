---
phase: "5"
slug: "sess-es"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-21"
---

# Phase 5 — Security

> Contrato de segurança da fase: registro de ameaças, riscos aceitos e trilha de auditoria.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| renderer → main (`island:wheel`, `island:select`) | Dois canais novos. Cada um leva só um número, que o main valida (`Number.isFinite` e teto, ou índice inteiro na lista atual), por `islandOf(event)`, e ignora com a ilha ociosa. O renderer nunca envia chave de sessão nem id de pedido | delta da roda, índice do ponto |
| main → renderer (`island:state`) | O payload leva só `{state, pending, current}` por sessão e `queue {position, total}`. Chave, PID e texto de pedido de outra sessão ficam no main | pontos, fila, pedido exibido |
| seleção → pedido exibido (`refresh`) | Toda troca (roda, ponto, snap, avanço da fila, saída da sessão exibida) passa por `refresh` e muda `shown` só por `nextShownPermission`: época nova, 0,8 s, leitura zerada | id do pedido exibido |
| arquivos em `~/.claude/island/` → main | Sessões lidas e, se mortas (`process.kill(pid, 0)` com `ESRCH`) ou com mais de 12 h, apagadas; só arquivos que passam por `isSessionFile` | estado de sessão |
| renderer → main (`island:decide`) | Inalterada desde a Fase 2 (eco do id, 800 ms, primeiro clique vence), com o fato da área visível agora incluindo a âncora ao lado (`besideFits`) | intenção + eco do id |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-05-01 | Spoofing | âncora ao lado em tela estreita sob a pílula do mod | high | mitigate | `besideFits` (limite de 1220 DIP) em `fitsVisibleArea`, que alimenta `fitsWorkArea` e `withinVisibleArea`; vetores `besideDecision` | closed |
| T-05-02 | Tampering | ordem de `acceptDecision` e fixture antigo | high | mitigate | corpo idêntico a `c461158`; 17 grupos antigos idênticos | closed |
| T-05-03 | Tampering | merge da main com a Fase 6 | medium | mitigate | merge de dois pais, sem rebase; funções da Fase 6 idênticas a `6741b25`; `coexistence.test.js` verde | closed |
| T-05-04 | Info. Disclosure | oclusão por outra janela topmost | low | accept | ver AR-05-01 | closed |
| T-05-05 | Tampering | `island:select` escolhendo alvo | high | mitigate | `islandOf`, índice inteiro na lista atual, ignorado ociosa | closed |
| T-05-06 | Info. Disclosure | dados de outra sessão no renderer | high | mitigate | payload sem chave, PID nem texto de pedido oculto (teste) | closed |
| T-05-07 | Spoofing | clique em voo atingindo o pedido novo após troca | high | mitigate | época nova, leitura zerada, `armToken`; vetores `sessionSwitch` (799 ms recusa, 800 ms aceita, eco antigo recusa) | closed |
| T-05-08 | Tampering | `key`/`firstSeenAt` vindos do arquivo | medium | mitigate | sobrescritos pelo main depois do `JSON.parse` | closed |
| T-05-09 | Spoofing | projeto/ferramenta cortados no cabeçalho do pedido | medium | mitigate | só o projeto corta; a ferramenta quebra linha, nunca corta | closed |
| T-05-10 | DoS | pulso dos pontos | low | mitigate | só `opacity`; assinatura evita refazer; pausa escondida; anel com movimento reduzido | closed |
| T-05-11 | Tampering | `island:wheel` com valor fora do contrato | medium | mitigate | `Number.isFinite`, teto `WHEEL_DELTA_MAX`, `wheelStep` puro sem lançar | closed |
| T-05-12 | DoS | roda solta disparando trocas | low | mitigate | intervalo de 85/200 ms, um entalhe pendente, trava pós-snap | closed |
| T-05-13 | Spoofing | roda sobre o pedido trocando de sessão | high | mitigate | `#permission` segura a roda; a pílula confere `closest('#permission')` | closed |
| T-05-14 | Elev. of Privilege | entrada sintética no SO | medium | mitigate | nenhum `SendInput`/`sendInputEvent`/automação; roda real na lista manual | closed |
| T-05-15 | Spoofing | snap no meio do gesto | high | mitigate | `SNAP_GESTURE_GAP_MS`, `SNAP_WHEEL_LOCK_MS`; vetores | closed |
| T-05-16 | Spoofing | pedido novo substituindo o que está sendo lido | high | mitigate | entra na fila sem snap; "N de M" | closed |
| T-05-17 | Spoofing | avanço da fila sem rearme | high | mitigate | avanço dentro de `refresh` (época nova, 0,8 s) | closed |
| T-05-18 | Info. Disclosure | snap desfazendo o esconder do usuário | medium | mitigate | `refresh` não chama mostrar/esconder (trava de texto) | closed |
| T-05-19 | DoS | sessão viva apagada por engano | high | mitigate | só `ESRCH` conta como morta; EPERM e erro desconhecido contam como vivo | closed |
| T-05-20 | Elev. of Privilege | `process.kill` com sinal real | high | mitigate | uma única chamada, `process.kill(pid, 0)` (trava) | closed |
| T-05-21 | Tampering | apagar arquivo fora das sessões | low | mitigate | `readdirSync(STATE_DIR)` + `isSessionFile`; um só `rmSync` | closed |
| T-05-22 | Spoofing | mola de troca movendo botões | high | mitigate | só `#lead`, `#detail`, `#permission` (sem `button`); `springs.tab` em `allSpringsAtRest` | closed |
| T-05-23 | Spoofing | camada antiga como alvo de clique | medium | mitigate | conteúdo trocado de forma atômica, sem crossfade de duas camadas | closed |
| T-05-24 | Tampering | fixture antigo alterado | high | mitigate | grupos antigos idênticos; novos só no fim | closed |
| T-05-25 | Spoofing | caminho de troca sem prova contra o gate | high | mitigate | 7 vetores `sessionSwitch`, um por caminho | closed |
| T-05-26 | Elev. of Privilege | IPC ou CSP crescendo | medium | mitigate | `RENDERER_CHANNELS` exata (11), 9 handlers com `islandOf`, CSP literal | closed |
| T-05-27 | Spoofing | Permitir/Negar após mudança de layout | high | mitigate | rearme por retângulo, `ResizeObserver`, época nova na troca de id | closed |
| T-05-28 | Spoofing | botões que não aprovam mudando de lugar | low | accept | ver AR-05-02 | closed |
| T-05-30 | DoS | "concluído" exibido preso para sempre | low | mitigate | só segura com outra sessão viva e enquanto exibido; 12 h removem o arquivo. Desde a D-22 (2026-11-22) só segura com o cursor sobre a pílula: sair com o cursor solta no ciclo seguinte | closed |
| T-05-31 | Spoofing | saída da sessão exibida puxando pedido já deixado | medium | mitigate | só pedido nunca exibido e fora do gesto; vizinha pula pedido deixado. Desde a D-22 a saída acontece também quando o "concluído" exibido vence (bem mais frequente); a exceção (todas as restantes com pedido deixado) ficaria sob o cursor de quem ia clicar em "Abrir", então o vencimento espera o cursor sair da pílula; o armamento de 0,8 s, o dwell de 200 ms e o rearme por retângulo seguem valendo | closed |
| T-05-SC | Tampering | instalação de pacotes | low | accept | ver AR-05-03 | closed |

T-05-29 foi retirado na revisão dos planos (fundido em T-05-28).

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-05-01 | T-05-04 | O gate não enxerga outra janela topmost cobrindo a nossa, em nenhuma âncora. Não é regressão (a âncora padrão já fica sobre o mod) e já está aceito no `06-SECURITY.md` (CR-01), com o limite em `docs/INTEGRACOES.md`. O caso estreito ao lado da ilha do sistema passou a ser mitigado por T-05-01. O terminal segue valendo | plano 05-01 e Fase 6 | 2026-11-21 |
| AR-05-02 | T-05-28 | A largura da pílula e a posição dos pontos e do "Abrir" variam com o número de sessões e, no hover, entre "concluído" compacto e sessão expandida. São botões que não aprovam: o pior caso é trocar de sessão (que rearma) ou focar um terminal. A aprovação segue coberta pelo rearme por retângulo (T-05-27). Leitura do objetivo registrada na D-17 | decisão D-17 | 2026-11-21 |
| AR-05-03 | T-05-SC | Fase sem pacote novo (`package.json`, `pnpm-lock.yaml` e `pnpm-workspace.yaml` sem diff) | planos 05-01..07 | 2026-11-21 |
| AR-05-04 | T-05-09 | O nome do projeto é cortado no fim, a 140 px; dois projetos com o mesmo começo longo parecem iguais na linha. O nome inteiro fica no tooltip nativo, que numa janela sem foco pode não aparecer. A ferramenta nunca é cortada e a posição do ponto desambigua. Registrado em `ponytail:` e no README | revisão de código (WR-03), orquestrador | 2026-11-21 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-21 | 31 | 31 | 0 | gsd-security-auditor (ASVS L1, block_on high) |

Correções pós-execução conferidas pelo auditor, sem abrir o gate:
- WR-01, `a823c8e`: a última leitura boa só vale se a sessão estiver viva.
- WR-02, `dafcbe4`: a escolha explícita do usuário no ciclo vence; a troca passa por `nextShownPermission`.
- WR-03, `60d6f27`: tooltip com o nome inteiro.
- WR-04, `c023d69`: o som não toca na troca manual; `chime()` em `try/catch` antes de `current = next`.

Resíduos registrados pelo auditor (nenhum bloqueia):

- **Avanço da fila (T-05-17, IN-02):** vai ao pedido mais antigo restante, mesmo que já tenha sido exibido e deixado. Segue o SESS-05 e a D-14, e rearma.
- **Saída da sessão exibida (T-05-31):** com todas as sessões restantes com pedido já deixado, pousa na mais próxima. É a exceção registrada da D-21, e rearma.
- **Corrida na limpeza (T-05-19/T-05-21, IN-06):** entre `isSessionDead` e `rmSync`, um hook pode ter acabado de reescrever o arquivo. O hook o recria no próximo evento.
- **Roda sobre `#actions` ou `#bar` (T-05-13):** troca de sessão, porque só `#permission` segura a roda. É seguro, porque toda troca rearma e o eco antigo é recusado.
- **Comportamento não executado em teste:** nenhum teste executa a ordem real das chamadas em `refresh()` nem o laço de molas do renderer. A cobertura vem de travas de texto, vetores das funções puras e execuções em `vm` de `readSessions` e `sendState`. T-05-07, T-05-15, T-05-17, T-05-22 e T-05-27 dependem também do checklist manual do PR.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-21 (auditoria automatizada; verificação de tela pendente no PR)
