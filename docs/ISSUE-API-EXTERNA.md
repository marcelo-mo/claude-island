# Proposta de API para o mod "Dynamic Island for Windows" (rascunho)

**Situação: não postada.** Postar é decisão do autor deste repositório. O texto vai em inglês porque o
repositório do mod é em inglês. Antes de postar, refazer a busca por issues duplicadas (`api`, `ipc`,
`external`, `integration`, `plugin`, `pipe`, `protocol`); na busca de 2026-11-21 não havia nenhuma. Depois de
postar, registrar o link em [`INTEGRACOES.md`](INTEGRACOES.md).

Repositório: github.com/devcode90/Dynamic-Island-for-Windows

---

**Title:** Proposal: optional local API so other apps can show a read-only activity in the island

Hi, and thanks for the mod. I maintain an MIT desktop app, Claude Island (github.com/marcelo-mo/claude-island),
a small pill that shows when a Claude Code session is working, needs an answer, or is done. I run it next to
your island (top-center, primary monitor) by placing mine beside it, and it works. What I cannot do is show my
status *in* your island, because there is no supported way for another program to hand it content.

The only routes I found are side effects of the current implementation: (1) `ProgressPercent` in the mod's local
storage (progress ring only), (2) a toast picked up by `UserNotificationListener` (4 s, title and body cut at 120
characters, no icon of ours, needs "Let apps access your notifications"), (3) a fake SMTC session. None of them
is a good contract.

**Proposal (opt-in, off by default, nothing changes for current users):**
- A setting, e.g. `Modules.ExternalActivities` (default off).
- One minimal local channel, your choice: a per-user named pipe, or a drop folder of small JSON files (no
  network, no admin).
- Payload: `{ id, source, title (<=40), subtitle (<=80), icon (PNG <=32 px, optional), accent (hex, optional),
  progress (0..1, optional), ttl_ms, priority: "normal" | "high" }`. The same `id` replaces the previous one.
- Hard limits so it stays safe: plain text only, truncated, rate-limited, read-only (no buttons, no actions),
  and a per-`source` block list (like `MediaExpandBlocklist`).
- It would take a slot in `ChooseActivities` (probably under notifications), so nothing existing is removed.

Happy to send a PR for the `.wh.cpp` if you agree on the shape, following the Contributing section (credit line
included). I am not asking for any interactive content in the island: approvals stay in my app.

Question: would you prefer the pipe or the folder, and is a new `IslandKind` acceptable?
