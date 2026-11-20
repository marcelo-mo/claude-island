# claude-island

Uma "Dynamic Island" de desktop para o Claude Code: uma pílula no topo central da tela que
mostra quando uma sessão está executando, quando precisa da sua resposta e quando terminou.
Feita em Electron, roda em Windows, macOS e Linux.

## Uso

```bash
npm install            # baixa o Electron
npm run hooks:install  # registra os hooks no ~/.claude/settings.json (faz backup antes)
npm start              # sobe a ilha
```

Para remover os hooks: `npm run hooks:uninstall`. Testes: `npm test`.

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

- **Linux:** o clique não atravessa a área transparente em volta da pílula (o Electron não
  encaminha eventos de mouse lá). Transparência também depende de um compositor ativo.
- **Não inicia com o sistema:** é preciso rodar `npm start`.
- **Node 26 no Windows:** o postinstall do Electron 39 pode sair em silêncio sem extrair o
  binário (`Electron failed to install correctly`). O zip já fica em
  `%LOCALAPPDATA%\electron\Cache`; extraia-o em `node_modules/electron/dist` e crie
  `node_modules/electron/path.txt` contendo `electron.exe`. No npm 11 também é preciso
  aprovar o script (`npm approve-scripts electron`), o que já está registrado no `package.json`.
