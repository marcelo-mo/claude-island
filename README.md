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
