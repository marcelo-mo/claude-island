---
phase: "3"
slug: "palco-fixo-anima-o-e-visual"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-21"
---

# Phase 3 — Security

> Contrato de segurança da fase: registro de ameaças, riscos aceitos e trilha de auditoria.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| arquivo `preferences.json` → main | Lido uma vez na subida, só leitura, normalizado por função pura; nunca gravado nem observado | tema, forma, estilo e velocidade da animação |
| main → renderer (`island:state`) | O renderer só aplica as preferências e o fato `fitsWorkArea` que o main manda; nunca escolhe nem envia preferência | preferências normalizadas, `fitsWorkArea` |
| molas e layout → armamento | Os botões só armam com o retângulo assentado e todas as molas paradas; qualquer troca de tema, forma ou layout rearma | estado das molas, retângulo dos botões |
| renderer → main (`island:decide`) | Inalterada desde a Fase 2 (eco do id, 800 ms, primeiro clique vence, janela inteira na área útil) | intenção + eco do id |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-03-01 | Tampering | armamento com mola em movimento | high | mitigate | `canArm` estrito (`settled` e `springsAtRest`), 8 vetores no fixture; `waitUntilSettled` chama `canArm` com `allSpringsAtRest()` (trava de texto) | closed |
| T-03-02 | Tampering | `preferences.json` adulterado ou corrompido | medium | mitigate | `normalizePreferences` aceita só as 4 chaves e os valores das listas, nunca lança; `try/catch` na leitura | closed |
| T-03-03 | Elevation of Privilege | canal novo ou renderer escolhendo preferência | high | mitigate | `preload.js` intocado; travas de 7 canais do preload e 6 `ipcMain.on`; leitura única, sem watch nem gravação | closed |
| T-03-04 | Elevation of Privilege | CSP afrouxada para carregar a mola | medium | mitigate | mola inline testada por extração em `node:vm`; trava da CSP exata | closed |
| T-03-05 | Denial of Service | laço de mola eterno | medium | mitigate | `springStep` sem NaN, quadro de no máximo 50 ms, `SPRING_MAX_STEPS`, assenta no alvo exato; ociosa, movimento reduzido e janela escondida levam ao alvo | closed |
| T-03-06 | Spoofing | pedido recortado durante a mola parecendo inteiro | low | mitigate | botões desarmados com mola em movimento; Permitir segue exigindo leitura até o fim | closed |
| T-03-07 | Tampering | nudge ou escala de hover movendo Permitir/Negar | high | mitigate | `shouldNudge` e `hoverScaleTarget` exigem `hasPermission === false` (e sem escala em Concluído); escala da pílula inteira por JS; trava de CSS sem transform em hover e botões | closed |
| T-03-08 | Tampering | troca de forma sem rearmar | high | mitigate | `applyPreferences` chama `restartArming()` quando tema ou forma mudam com pedido na tela; `buttonsRect` contra `armedRect` no render e no `pointerdown` | closed |
| T-03-09 | Spoofing | palco recortando botões ou comando no pico | medium | mitigate | simulação de 4 estilos × 3 velocidades com retarget, hover, nudge, sombra e rótulo de 2 linhas prova que 520×410 cobre o pico; `WINDOW_SIZE` congelado | closed |
| T-03-10 | Denial of Service | janela de 410 px fora de área útil baixa | low | mitigate | recusar segue sendo o lado seguro; `fitsWorkArea` (mesma conta do gate) desabilita Permitir/Negar e mostra "Responda no terminal"; a trava só desabilita | closed |
| T-03-11 | Spoofing | tema com contraste baixo | medium | mitigate | teste resolve os tokens do `index.html` nos 10 casos: texto ≥4,5:1, controles ≥3:1, inclusive no rodapé escurecido e sob a lavagem | closed |
| T-03-12 | Spoofing | bloco translúcido ou reflexo pintando o comando | medium | mitigate | `--perm-bg` opaco (o teste recusa alfa); lavagem com raio vertical fixo de 56 px travada; nenhum pseudo-elemento novo | closed |
| T-03-13 | Tampering | troca de tema com pedido na tela sem rearmar | high | mitigate | `restartArming()` em `applyPreferences`; travado em `gate.test.js` e `visual.test.js` | closed |
| T-03-14 | Tampering | tema escuro herdando cores de estado claras | low | mitigate | `@media` claro restrito a `auto`; teste de cores fixas nos 10 casos; nenhum `var(--accent)` no `:root` | closed |
| T-03-15 | Spoofing | `preferences.json` lido como sessão (achado da revisão, WR-01) | high | mitigate | `isSessionFile` em `state.js` exclui o arquivo; `readSessions` a usa; teste em `island.test.js` | closed |
| T-03-16 | Denial of Service | Linux sem click-through com janela maior (achado da revisão, WR-03) | low | accept | ver Accepted Risks | closed |
| T-03-SC | Tampering | instalação de pacotes | low | accept | nenhuma dependência nova (`package.json` e lockfile sem diff) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | T-03-SC | Fase sem pacote novo | planos 03-01..03 | 2026-11-21 |
| AR-03-02 | T-03-16 | Linux é melhor esforço no projeto; sem `forward` em `setIgnoreMouseEvents`, a área transparente de 520×410 bloqueia cliques no topo central (≈50% maior que antes). Não toca o gate: clicar na área transparente não aciona botão. Vai para o checklist do PR | revisão de código (WR-03), orquestrador | 2026-11-21 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-21 | 17 | 17 | 0 | gsd-security-auditor (ASVS L1, block_on high) |

Resíduos registrados pelo auditor (nenhum bloqueia):

- **Folga do palco (T-03-09):** com rótulo de 2 linhas, o pior caso (Elástico a 0,5×) pede ≈409,5 px de 410. Um nome de ferramenta com 3 ou mais linhas (glifos largos, fora da estimativa de 0,6 em) passaria ≈17 px no pico, mas o excesso cai na margem de sombra e no padding de baixo, sem escala nem nudge com pedido na tela, e os botões ficam desarmados durante o movimento.
- **Caixa do nome (T-03-15):** a comparação de nome é exata; em NTFS um `Preferences.json` seria lido pelos dois caminhos. Exige o mesmo usuário do SO. Para a Fase 4, que vai gravar o arquivo: comparar sem caixa ou mover o arquivo para fora da pasta de sessões.
- **Rótulo do Permitir (T-03-11):** `--button-text` sobre `--button` mede ≈3,38:1, limiar de controle; cores fixas pela Key Decision, iguais em todos os temas.
- **Trava de hover (T-03-07, IN-05):** barra só propriedades de transformação; uma regra de hover que mudasse `margin`, `padding` ou `width` passaria. Hoje os hovers usam só `filter`.
- **Arquivo enorme ou FIFO no lugar do `preferences.json` (T-03-02, IN-02):** travaria a subida no `readFileSync`. Exige o mesmo usuário do SO.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-21 (auditoria automatizada; verificação visual pendente no PR)
