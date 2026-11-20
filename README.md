# claude-island

Uma "Dynamic Island" de desktop para o Claude Code: uma pílula no topo central de cada monitor que
mostra quando uma sessão está executando, quando precisa da sua resposta e quando terminou.
Feita em Electron, roda em Windows, macOS e Linux.

## Uso

```bash
pnpm install            # baixa o Electron
pnpm hooks:install  # registra os hooks no ~/.claude/settings.json (faz backup antes)
pnpm start              # sobe a ilha
```

Para remover os hooks: `pnpm hooks:uninstall`. Testes: `pnpm test`.

Sessões do Claude Code abertas antes do `hooks:install` só passam a aparecer depois de reiniciadas.

## Como funciona

Os hooks do Claude Code chamam `hook.js`, que grava o estado de cada sessão em
`~/.claude/island/<session_id>.json`. A ilha (`main.js`) lê essa pasta e mostra a sessão mais
urgente; com mais de uma sessão ativa aparece um contador.

| Estado | Quando | Aparência |
|---|---|---|
| Executando | prompt enviado ou ferramenta em uso | pílula compacta, ponto laranja pulsando |
| Precisa de você | pedido de permissão, pergunta ou plano aguardando aprovação | expande sozinha, brilho âmbar e aviso sonoro |
| Concluído | fim do turno | ponto verde por 6 segundos |
| Ocioso | nenhuma sessão ativa | some |

Passar o mouse sobre a pílula expande e mostra o projeto e o que está rodando.

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

## Limitações conhecidas

- **Abrir sessão traz a janela, não a aba:** no Windows Terminal e no terminal integrado do
  VS Code várias sessões dividem a mesma janela; o botão não troca para a aba certa.
- **Abrir sessão fora do Windows não foi testado.** macOS usa `osascript` (o sistema pede
  permissão de Automação/Acessibilidade na primeira vez); Linux depende do `xdotool` e de X11
  — sem ele, ou em Wayland, o botão não aparece.
- **Abrir sessão no Windows simula um toque na tecla Alt** para o sistema permitir a troca de
  janela ativa; em algum aplicativo isso pode destacar a barra de menus por um instante.
- **A ilha não passa de um monitor para outro:** cada monitor tem a sua, e o arraste para na
  borda dele.
- **A posição salva é por identificador do monitor.** Se o sistema trocar esse identificador
  (outro cabo, outra porta, dock), a ilha daquele monitor volta ao topo central.
- **Arrastar e várias ilhas foram testados só no Windows.**
- **Linux:** o clique não atravessa a área transparente em volta da pílula (o Electron não
  encaminha eventos de mouse lá). Transparência também depende de um compositor ativo.
- **Não inicia com o sistema:** é preciso rodar `pnpm start`.
