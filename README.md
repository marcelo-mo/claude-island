# claude-island

Uma "Dynamic Island" de desktop para o Claude Code: uma pílula no topo central de cada monitor que
mostra quando uma sessão está executando, quando precisa da sua resposta e quando terminou, e
deixa responder a um pedido de permissão sem abrir o terminal.
Feita em Electron, roda em Windows, macOS e Linux.

## Uso

```bash
pnpm install            # baixa o Electron
pnpm hooks:install  # registra os hooks no ~/.claude/settings.json (faz backup antes)
```

Pronto: a ilha sobe sozinha quando uma sessão do Claude Code começa e ela não está no ar.
Para abrir à mão, `pnpm start`. Para remover os hooks: `pnpm hooks:uninstall`. Testes: `pnpm test`.

Sessões do Claude Code abertas antes do `hooks:install` só passam a aparecer depois de reiniciadas.
Quem já tinha os hooks instalados precisa rodar `pnpm hooks:install` de novo para ganhar os hooks
novos (permissão e início automático).

O `~/.claude/settings.json.island-backup` guarda o seu `settings.json` como era antes da ilha:
reinstalar ou desinstalar não o sobrescreve. Mudou a pasta do repo de lugar ou trocou de Node? Rode
`pnpm hooks:install` de novo e os hooks antigos da ilha são trocados pelos novos; hooks de outras
ferramentas ficam como estão.

## Contribuindo

Sugestões e relatos de erro são bem-vindos por **issue**; pull requests de fora não são aceitos.
Veja o [CONTRIBUTING.md](CONTRIBUTING.md). Licença [MIT](LICENSE).

## Como funciona

Os hooks do Claude Code chamam `hook.js`, que grava o estado de cada sessão em
`~/.claude/island/<session_id>.json`. A ilha (`main.js`) lê essa pasta e mostra a sessão mais
urgente; com mais de uma sessão ativa aparece um contador.

| Estado | Quando | Aparência |
|---|---|---|
| Trabalhando | prompt enviado ou ferramenta em uso | pílula compacta, ponto laranja pulsando e reticências animadas |
| Precisa de você | pedido de permissão, pergunta ou plano aguardando aprovação | expande sozinha, selo âmbar com exclamação e aviso sonoro |
| Concluído | fim do turno | selo verde com check e botão "Abrir" por 10 segundos |
| Ocioso | nenhuma sessão ativa | some |

À direita da pílula, um anel mostra o percentual de contexto já usado pela sessão: verde
até 50%, amarelo de 50% a 80% e vermelho acima disso. O dado vem do arquivo
`claude-ctx-<sessão>.json` que o statusline do GSD grava na pasta temporária; sem o GSD, o
anel não aparece. O percentual é o do GSD, medido até o ponto de compactação automática.

Passar o mouse sobre a pílula (ou clicar nela, conforme a escolha no menu) expande e mostra o
projeto e o que está rodando.

Com mais de um monitor, cada um ganha a sua ilha, e elas acompanham quando um monitor é
conectado, removido ou muda de resolução. O aviso sonoro toca uma vez só.

Para tirar a ilha do caminho (numa reunião, por exemplo), **clique na pílula e arraste**. Ela
fica dentro da área útil do monitor em que está, cada monitor guarda a própria posição e ela
é mantida depois de reiniciar (fica em `positions.json`, na pasta de dados do app). **Duplo
clique** na pílula devolve aquela ilha ao topo central.

Expandida, a ilha mostra o botão **Abrir sessão**, que traz para frente (e restaura, se
minimizada) a janela do terminal daquela sessão. No primeiro evento de cada sessão o hook sobe a
árvore de processos até achar o processo dono da janela e guarda o PID no arquivo de estado; isso
acrescenta cerca de 0,45 s a esse primeiro hook no Windows e nada aos seguintes. Se a janela não
for encontrada, o botão não aparece. O código específico de cada sistema fica em `window.js`.

### Permitir ou negar pela ilha

Quando o Claude Code mostra o diálogo de permissão de uma ferramenta, a ilha expande com o nome
da ferramenta, o pedido por inteiro (o comando, no caso do Bash; a entrada em JSON, nas demais) e
os botões **Negar** e **Permitir**. O clique responde ao Claude Code na hora, e o diálogo do
terminal continua valendo: quem responder primeiro decide.

- **Vale só para aquela chamada.** Não existe "permitir sempre" pela ilha.
- **Só o que dá para ler inteiro.** Pedido com mais de 600 caracteres ou 20 linhas, ou com
  caracteres de controle ou invisíveis, não ganha botões: fica com o terminal. Se o texto não
  couber sem rolagem, "Permitir" só habilita depois de rolar até o fim.
- **Os botões levam 0,8 s para habilitar** depois que o pedido aparece, para um clique que já ia
  para outra janela não virar aprovação.
- Perguntas (`AskUserQuestion`) e planos (`ExitPlanMode`) continuam sendo respondidos no terminal.

Por baixo: o hook `PermissionRequest` chama `permission-hook.js`, que grava o pedido no arquivo
de estado da sessão e espera até 5 minutos pelo arquivo de decisão que a ilha grava em
`~/.claude/island/decisions/`. Ele só participa se a ilha estiver no ar (ela grava um batimento
em `~/.claude/island/.heartbeat` a cada 2 s); senão, sai na hora e nada muda no Claude Code.

### Várias sessões

Com duas ou mais sessões do Claude Code abertas, a ilha troca o contador por um ponto por sessão e
deixa sempre à vista de qual projeto é a sessão na tela.

- **Um ponto por sessão.** A cor é a do estado, o ponto da sessão exibida é maior e o de quem pede
  permissão pulsa (parado, com um anel, se o sistema pedir para reduzir movimento).
- **Ordem estável.** Da sessão mais antiga, à esquerda, para a mais nova. Acima de 8 sessões os
  pontos somem e volta o número.
- **Clique num ponto para ver aquela sessão.** A ilha não troca sozinha quando outra sessão conclui
  ou volta a trabalhar; só troca se a sessão exibida terminar, e então vai à vizinha dela.
- **A roda do mouse sobre a pílula troca de sessão.** Para cima vai à sessão anterior, para baixo à
  próxima, sem dar a volta no fim da lista. Cada entalhe conta, e o touchpad, que manda passos
  menores, é mais lento (as regras de gesto são as do mod Dynamic Island for Windows). Sobre o
  texto de um pedido a roda só rola o texto e nunca troca de sessão. No Windows a roda chega à ilha
  por "Rolar janelas inativas ao passar o mouse sobre elas" (Configurações > Bluetooth e
  dispositivos > Mouse), ligado por padrão, porque a ilha nunca recebe o foco; sem isso, clique no
  ponto.
- **Um pedido de permissão novo leva a ilha até a sessão que pediu, uma vez por pedido.** Se você
  rolar ou clicar para longe, ela não puxa de novo e o ponto da sessão segue pulsando. Ela espera a
  roda parar antes de trocar e, depois da troca, ignora a roda por 0,4 s.
- **Pedidos simultâneos entram numa fila por ordem de chegada.** Com mais de um pendente, o pedido
  mostra a posição ("1 de N") e um pedido novo nunca toma o lugar do que está na tela.
- **Ao responder, na ilha ou no terminal, a ilha vai ao próximo pendente.** Sem outro pendente, fica
  onde está; se você estava numa sessão sem pedido, nada se move.
- **Toda troca reinicia os 0,8 s dos botões e a exigência de rolar o texto até o fim**, para uma
  troca automática nunca deixar Permitir ou Negar atingir um pedido que você não viu.
- **Com a ilha escondida ou em tela cheia, um pedido novo não a faz reaparecer.** Só a seleção muda.
- **O projeto fica à vista.** O nome da pasta da sessão é o título da pílula compacta e abre o
  cabeçalho do pedido ("projeto · ferramenta"). Dois projetos com a mesma pasta final mostram o
  mesmo nome; a posição do ponto diz qual é qual.

### Menu, atalho e tela cheia

**Clique direito na pílula** abre o menu: tema, forma, estilo e velocidade da animação, expandir (ao
passar o mouse ou ao clicar), fixar aberta, transparência, âncora, ilhas (uma por monitor, só no
principal ou no monitor do cursor) e esconder. O menu e o arraste só existem com uma sessão na tela:
ociosa, a pílula fica invisível e sem `pointer-events`, e os cliques passam para as janelas de baixo.

- **As escolhas ficam em `~/.claude/island/preferences.json`.** Se o arquivo estiver corrompido ou
  passar de 64 KB, ele é guardado como `preferences.json.<carimbo>.bad` (uma cópia a cada vez que
  isso acontece) e a ilha sobe com os padrões.
- **`Ctrl+Alt+Shift+C` esconde e mostra a ilha.** O padrão não é `Ctrl+Alt+C` porque, no teclado ABNT2,
  ele é o AltGr+C, que digita `¢`. O atalho é editável no campo `shortcut` do arquivo de preferências, e
  o menu avisa se ele não puder ser registrado (tomado por outro programa ou texto inválido), com
  "Esconder" desabilitado. Esconder não é lembrado ao reiniciar: a ilha sempre sobe visível.
- **Transparência.** Vale para a ilha inteira, mas nunca com um pedido de permissão na tela: ele fica
  100% opaco e, ao terminar, a ilha volta à escolhida. Com a ilha escondida, um pedido só toca o som;
  responda no terminal ou mostre a ilha pelo atalho.
- **Ao lado da ilha do Windhawk.** Com o mod "Dynamic Island for Windows" no topo da tela, escolha
  *Âncora > Ao lado da ilha do sistema, à direita* (ou *à esquerda*): a nossa pílula fica ao lado da dele,
  cresce para fora sem cobri-la e o arraste ajusta o lugar. Precisa de 1220 DIP de área útil: abaixo disso a pílula
  não cabe ao lado e fica por cima da do mod, então, com um pedido de permissão na tela, os botões ficam
  desabilitados com "Responda no terminal" (a pílula do mod cobriria o começo do pedido). Vale em qualquer
  monitor abaixo desse limite, mesmo sem o mod aberto nele, porque a ilha não enxerga o mod. Combina com as
  formas Pílula e Windows 11. A ilha nunca reafirma o
  "sempre no topo" por timer. O que foi verificado dessa convivência, do toast do Windows e dos apps de notch está em
  [`docs/INTEGRACOES.md`](docs/INTEGRACOES.md); `scripts/measure-coexistence.ps1` mede as duas ilhas juntas
  por 5 minutos, só lendo as janelas.
- **Tela cheia: ainda não está ativo.** A regra de esconder a ilha do monitor ocupado por um app em tela
  cheia está pronta, mas o sensor depende de uma decisão pendente. Por enquanto a ilha continua por
  cima de app em tela cheia, e o atalho é o jeito de tirá-la do caminho.

O que só uma pessoa na tela confirma (hover com terminal elevado e AltGr+C) está em
`scripts/human-checks.js`, que só escuta, não gera entrada e exige a ilha parada:
`node_modules\electron\dist\electron.exe scripts\human-checks.js --mode=hover` ou `--mode=hotkey`.
O uso completo está no cabeçalho do arquivo.
