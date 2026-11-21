---
phase: 04-entrada-prefer-ncias-e-comportamento-no-sistema
fixed_at: 2026-11-21T00:00:00Z
review_path: D:/Desenvolvimentos/Pessoal/claude-island-fase2/.planning/phases/04-entrada-prefer-ncias-e-comportamento-no-sistema/04-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Fase 4: Relatório de correção da revisão de código

**Corrigido em:** 2026-11-21
**Revisão de origem:** 04-REVIEW.md
**Iteração:** 1

**Resumo:**
- Achados no escopo: 4 (CR-01, WR-01, WR-02, WR-03)
- Corrigidos: 4
- Ignorados: 0

**Verificação:** `node --test` na própria worktree da sessão (sem worktree extra), 345 testes antes, 348 depois, todos passando a cada commit. `node -c main.js` ok. Nenhuma execução de Electron, por regra da tarefa.

## Corrigidos

### CR-01: O item de menu "Esconder" era inerte

**Arquivos modificados:** `main.js`, `state.js`, `prefs.test.js`, `gate.test.js`
**Commit:** 95750d7
**Correção aplicada:** `toMenuItem` foi para o `state.js` e recebe os efeitos (`onHide`, `onPreference`) por parâmetro, como `registerShortcut`. A ação `hide` é testada antes da guarda de `key`. Item `hide` desabilitado nunca ganha `click`. `openMenu` monta os efeitos. A trava de texto de `gate.test.js` mudou de propósito no mesmo commit (agora confere só a ligação em `openMenu` e que `toMenuItem` não voltou ao `main.js`).
**Status:** corrigido, requer verificação humana (lógica de ordem de guardas; coberta por teste de comportamento, mas o clique real no Electron não foi exercitado).

### WR-01: `island:reset-position` e `island:drag-end` moviam a janela sem rearmar

**Arquivos modificados:** `main.js`, `gate.test.js`
**Commit:** c307265
**Correção aplicada:** `refresh('rearm')` ao fim dos dois handlers. Auditoria dos demais caminhos que movem a janela: `applyPreference`, a troca de monitor do modo cursor em `cursorTick` e os eventos de display já rearmavam; `createIsland`/arranque não têm armamento antigo a invalidar. Nova trava de texto em `gate.test.js` cobre os dois handlers e esses chamadores de `syncIslands`.
**Status:** corrigido, requer verificação humana (regra de segurança SEG-02; a trava é de texto, o rearme real depende do Electron).

### WR-02: `menu-will-close` podia tocar numa janela destruída

**Arquivos modificados:** `main.js`, `gate.test.js`
**Commit:** 7e501bc
**Correção aplicada:** `applyCapture` retorna cedo com `island.isDestroyed()`; `syncIslands` zera `menuIsland` antes de `island.destroy()`. O `menu-will-close` já chamava `refresh('rearm')` depois de `applyCapture`, que agora não lança. Trava de texto nova em `gate.test.js`.
**Status:** corrigido, requer verificação humana (a ordem entre `click` e `menu-will-close` não foi verificada em plataforma).

### WR-03: Testes de `main.js` travavam só o texto

**Arquivos modificados:** `prefs.test.js` (junto de CR-01), `gate.test.js` (CR-01, WR-01, WR-02)
**Commit:** 95750d7 (teste de comportamento de `toMenuItem`), c307265 e 7e501bc (travas de texto complementares)
**Correção aplicada:** novo teste de comportamento em `prefs.test.js`: o `menuTemplate` real passa por `toMenuItem` com callbacks espiões. O último item tem `click` com atalho `ok` e o `click` chama `onHide`; sem atalho não tem `click`; rádio e "Fixar aberta" chamam `onPreference` com `key`/`value`. Para rearme e menu destruído, que são cola do Electron e dependem de estado de janela, ficaram travas de texto: uma função pura de "movimento exige rearme" seria sempre `true` e não foi criada.
**Status:** corrigido (parcial por escolha: cola de Electron segue coberta por texto).

### IN-01: Atalho aceitava uma tecla comum sozinha (corrigido pelo orquestrador, fora do escopo crítico/aviso)

**Arquivos modificados:** `state.js`, `prefs.test.js`
**Commit:** 945858f
**Correção aplicada:** sem modificador, só tecla de função (F1 a F24) vale como atalho; letra ou número sozinho volta ao padrão. Vetores `'A'`, `'7'`, `'F25'` e `'Space'` no teste.
**Status:** corrigido. IN-02 (JSON válido porém inútil não vai para a quarentena) e IN-04 (`island:cursor` sem conferir a página; só vazaria a posição do cursor) ficam registrados, sem correção nesta fase. IN-03 é dormência por D-20.

---

_Corrigido: 2026-11-21_
_Corretor: Claude (gsd-code-fixer)_
_Iteração: 1_
