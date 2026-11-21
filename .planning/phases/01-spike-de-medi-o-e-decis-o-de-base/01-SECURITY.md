---
phase: "1"
slug: "spike-de-medi-o-e-decis-o-de-base"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-21"
---

# Phase 1 — Security

> Contrato de segurança da fase: fronteiras de confiança, registro de ameaças e trilha de auditoria.
> A fase é ferramental de medição; não toca no gate de permissão nem nos hooks do produto.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Medidor → instância medida | `scripts/measure-footprint.ps1` lança Electron/Tauri com `USERPROFILE` e `--user-data-dir` descartáveis | sessão falsa `spike-fake.json` (sem dado real) |
| Medidor → SO | leitura de WMI/CIM e encerramento de processos | PIDs; só os lançados pelo script são encerrados |
| Renderer da casca Tauri → Rust | IPC limitado a `core:event:allow-listen/unlisten` em janelas `island-*` | estado da sessão (somente leitura) |
| Build da casca → crates.io | dependências `tauri` e `tauri-build`, fixadas por `Cargo.lock` | código de terceiros |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-01 | Denial of Service | measure-footprint.ps1 (encerramento) | high | mitigate | `taskkill /PID` só da raiz lançada e só se viva (`measure-footprint.ps1:346-348`); nenhum encerramento por nome | closed |
| T-01-02 | Tampering | sessão/pedido falso | high | mitigate | HOME e `--user-data-dir` descartáveis por execução, removidos no fim (`:301-314`, `:83`, `:352`) | closed |
| T-01-03 | Information Disclosure | porta CDP de verificação | medium | mitigate | Só em verificação ad hoc, loopback, instância descartável; o medidor nunca passa a porta | closed |
| T-01-04 | Repudiation | regra antes dos números | high | mitigate | Regra em `68db4e5`; medidor recusa gravar em `spike/results` sem a regra commitada (`:57-61`); ORDEM-OK | closed |
| T-01-05 | Tampering | `-CleanDirs` | medium | mitigate | Só subpasta estrita normalizada de `%LOCALAPPDATA%`/`%TEMP%` (`:63-74`, corrigido em `88341b7`) | closed |
| T-01-06 | Elevation of Privilege | IPC da casca Tauri | medium | mitigate | Capability só `event:allow-listen/unlisten` (`000b8b1`); sem plugins, sem `#[command]`; `decide` no-op no shim | closed |
| T-01-07 | Tampering | cadeia de crates | medium | mitigate | `Cargo.lock` versionado; só `tauri` e `tauri-build` diretos; 432 crates do registro com checksum | closed |
| T-01-08 | Tampering | casca contra o HOME real | high | mitigate | Casca sai com código 1 sem `ISLAND_SPIKE_ISOLATED` (`main.rs:70-73`, `359cd24`), definido só pelo medidor | closed |
| T-01-09 | Denial of Service | ilha viva do autor | high | mitigate | Encerramento só por PID lançado; trava de instância separada por `--user-data-dir` | closed |
| T-01-10 | Repudiation | integridade dos resultados | high | mitigate | JSON brutos commitados, inclusive tentativas descartadas; nenhum modificado ou apagado; teto de 3 | closed |
| T-01-11 | Tampering | snapshot/patch das variantes | medium | mitigate | `git archive` por sha, blob da `index.html` conferido, patch de E3 exige exatamente 1 ocorrência | closed |
| T-01-12 | Elevation of Privilege | `decide` da casca | high | mitigate | Vetor ausente: Etapa 1 reprovou, `decide` nunca foi implementado | closed |
| T-01-13 | Tampering | decisão automática | high | mitigate | Vetor ausente: feature `spike-autodecide` nunca criada | closed |
| T-01-14 | Elevation of Privilege | clique aprovando pedido real | high | mitigate | Nenhum código de injeção de entrada; checagem humana pendente é "só olhar" (01-UAT.md) | closed |
| T-01-SC | Tampering | instalações npm/cargo | high | mitigate | Nenhuma dependência npm nova; só `tauri`/`tauri-build` | closed |

*Status: open · closed · open — below high threshold (non-blocking)*

---

## Accepted Risks Log

No accepted risks.

Observações não bloqueantes (auditor): `build.ps1` roda `cargo build` sem `--locked` (o lock não mudou após os builds); a trava `ISLAND_SPIKE_ISOLATED` confere só a presença da variável; `tauri.conf.json` mantém `csp: null`, contido pela capability mínima e pela CSP da própria `index.html`; o `.exe` foi recompilado após as correções da revisão, então o binário em disco não é mais o medido (as medições foram commitadas antes).

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-21 | 18 | 18 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-21
