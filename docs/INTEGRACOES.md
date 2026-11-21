# Integrações e convivência

Registro dos caminhos para a ilha conviver com outras "ilhas" ou aparecer dentro delas (CONV-03). Cada item diz
o que foi **verificado** (lido no código, medido na máquina do autor ou lido numa página pública, com a fonte) e
o que **não foi verificado**. Situação em 2026-11-21; o mod e os apps de notch mudam rápido.

## Ilha do Windhawk ("Dynamic Island for Windows", mod 1.4.0)

**Como as duas convivem hoje.** Pelo encaixe lateral: no menu, *Âncora > Ao lado da ilha do sistema, à
direita* (ou *à esquerda*). A borda interna da nossa pílula fica a 210 px do centro da área útil (o mesmo centro
que o mod usa), a pílula cresce para fora e o arraste ajusta o lugar (o deslocamento fica salvo por monitor). O
topo desce 17 px para o centro da nossa pílula compacta ficar na altura da faixa ociosa do mod. Quem usa o mod só
no monitor principal pode escolher *Ilhas > Só no monitor principal*.

Limites conhecidos:
- **Área útil abaixo de 1220 DIP** (1366×768 a 125%, 1600×900 a 150%, 1920×1080 a 175%): não cabe a pílula
  expandida ao lado do mod, a janela é puxada para o centro e fica por cima da pílula dele; o mod então se sobe
  e pode cobrir o começo das linhas do nosso pedido. Nessas telas, prefira uma âncora de canto.
- **Dois alertas do mod lado a lado** (até ~356 px de meia-largura, por ~4 s) alcançam a nossa pílula mesmo em
  tela larga.
- A ilha não detecta que outra janela a cobre (vale para qualquer overlay "sempre no topo", e para a âncora
  padrão, que fica exatamente em cima do mod). O gate continua exigindo cursor parado, 0,8 s e o mesmo botão,
  e um clique que caia no mod é do mod, nunca uma aprovação nossa.
- A forma Notch, feita para colar no topo, fica 17 px abaixo dele nesta âncora; com o mod, prefira Pílula ou
  Windows 11.

Verificado:
- **Sem API.** O README do mod não descreve API, IPC ou forma de outro programa mandar conteúdo, e o código
  não tem pipe, `WM_COPYDATA`, arquivo de troca nem socket. Não havia issue de API aberta no repositório do mod
  (busca por `api`, `ipc`, `external`, `integration`, `plugin`, `pipe`, `protocol`: só resultados de clima e de
  hardware). Issues próximas e sem resposta do autor na data: #190 (notificações na ilha), #195 (desligar os
  banners), #161 (toast com ação).
- **A janela.** Classe `Windhawk.DynamicIslandForWindows`, dona `windhawk.exe -tool-mod
  "dynamic-island-for-windows"`, estilo estendido LAYERED | TOPMOST | TOOLWINDOW | NOACTIVATE, palco de 936×364
  centrado na área útil do monitor principal (`.wh.cpp:4041`), 8 px abaixo do topo dela; a pílula começa 22 px dentro do palco. Painel
  expandido 380×184 (×1,025 com hover); faixa ociosa de 36 px de altura e 72 a 280 px de largura. A janela
  `DynamicIslandBackdrop` acompanha a pílula viva com 1 px de recuo quando o fundo de blur/acrílico está ligado.
- **Disputa de topo.** O mod confere o topo a cada 1 s e só se sobe (uma vez) quando a **pílula dele** é coberta
  pela **janela inteira** de quem está acima numa área de pelo menos max(256 px², 1/8 da pílula). Ele nunca
  mexe na nossa janela. A nossa ilha chama `setAlwaysOnTop` uma única vez, ao criar a janela, e nunca mais (trava
  em `coexistence.test.js`). Medido no Electron 45.4.1: a ordem de z não muda sozinha (317 s da ilha real), e só
  `setAlwaysOnTop(true…)` repetido ou `moveTop()` sobem a janela; `hide`/`showInactive`, `setBounds`,
  `setIgnoreMouseEvents` e `setOpacity` não mexem nela. Na posição ao lado, com área útil de 1220 DIP ou mais, a
  nossa janela invade a pílula expandida do mod em no máximo ~5 px, abaixo do limiar dele.
- **Clique.** Fora da pílula a janela do mod devolve `HTTRANSPARENT`, e ela só deixa o clique atravessar por
  inteiro quando está ociosa. O mod não envia entrada: um clique que caia nele nunca aprova nada por nós.

Não verificado (a ilha do mod estava escondida em toda a fase e nenhum agente a mostra; os itens estão no
`06-UAT.md`, CHK-61 a CHK-67):
- As duas ilhas visíveis juntas por 5 minutos (`scripts/measure-coexistence.ps1`, que sai com 0 se a convivência foi
  limpa, 1 se houve inversão, sumiço ou sobreposição, 2 se não dava para medir e 3 se ele mesmo falhou).
- Se 210 px bastam para o painel expandido do mod com hover, e o que acontece com **dois alertas lado a lado**
  no mod (até ~356 px de meia-largura, por ~4 s), que alcançam a nossa pílula.
- Hover cruzado: cada uma expande só com o cursor nela.
- Clique em Permitir na nossa com um alerta do mod na tela.

## Toast do Windows

Verificado no código do mod:
- O mod lê o Centro de Ações por `UserNotificationListener` a cada 1 s e mostra **uma** notificação por 4 s, com
  `título - corpo` cortado em 120 caracteres, sem botões, respeitando o Não Perturbe. Ignora apps cujo nome
  contém `powershell`, `pwsh` ou `cmd.exe`.
- Pré-requisito: "Permitir que os apps acessem suas notificações". Na máquina do autor está permitido e os
  toasts estão ligados (leitura de registro).
- No Electron, `Notification` aceita `toastXml` no Windows.

Não verificado: que um toast nosso apareça na ilha do mod (CHK-67), e se um app Electron não empacotado precisa
de AppUserModelID e atalho no Menu Iniciar para o toast sair.

**Por que não serve para aprovar.** Dura 4 s, não tem ação e o texto é cortado. No máximo avisaria "há um
pedido". E o comando nunca deve ir no toast: o mod mostra o texto do Centro de Ações na própria ilha, e ele
aparece em compartilhamento de tela.

## Apps de notch no macOS (e um no Windows)

Lido em páginas públicas, sem instalar nada:

| App | O que consta | Integração externa | Fonte |
|-----|--------------|--------------------|-------|
| NotchNook | macOS 14.6+, Pro e Classic. **Há versão para Windows** (Windows 10 22H2/11 x64) que anuncia "Approve Claude Code and Codex from the pill" e "Claude Code and Codex show their progress in the pill" | Nenhuma API, SDK ou esquema de URL documentados | lo.cafe/notchnook e lo.cafe/notchnook/windows |
| Alcove | v1.7, macOS 15+, lista "Live Activities" sem detalhe | Nenhuma documentada | tryalcove.com |
| boring.notch | GPL-3.0; "Extension system" é item não marcado do roadmap; issues abertas pedindo API (#1747) e Codex (#1522, #1470) | Nenhuma entregue | github.com/TheBoredTeam/boring.notch |
| Live Activities no macOS 27.3 | Beta em 2026-11-04: apps de terceiros podem mostrar Live Activities na barra de menus; lançamento esperado em dezembro | API da Apple, não de um app de notch | macrumors.com, 2026-11-04 |
| ClaudeNotch, Vibe Notch, Coucou, AgentPeek | Aprovam pedidos do Claude Code a partir do notch | Pelos hooks do Claude Code | Resultados de busca; não abertos um a um |

**O que isso muda.** A ilha deixou de ser única: há apps que aprovam pedidos do Claude Code a partir de uma
pílula, inclusive no Windows. O que diferencia este projeto é o gate (nunca aprovar o que o usuário não viu).

Não verificado: como o NotchNook para Windows aprova (presumivelmente pelo hook `PermissionRequest`) e qual
resposta vale quando duas ferramentas respondem ao mesmo `PermissionRequest`. O Claude Code roda os hooks do
evento em paralelo, e a regra de precedência entre dois `PermissionRequest` não foi encontrada na
documentação lida. Testar isso é o INTG-03.

## Proposta de API ao autor do mod

O texto está em [`ISSUE-API-EXTERNA.md`](ISSUE-API-EXTERNA.md). **Ainda não foi postado**: postar é decisão do
autor deste repositório. Quando for, o link entra aqui.
