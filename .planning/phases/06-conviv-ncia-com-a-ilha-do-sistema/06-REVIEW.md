---
phase: 06-conviv-ncia-com-a-ilha-do-sistema
reviewed: 2026-11-21T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - state.js
  - index.html
  - main.js
  - coexistence.test.js
  - prefs.test.js
  - scripts/measure-coexistence.ps1
findings:
  critical: 1
  warning: 5
  info: 8
  total: 14
  necessity: 1
status: issues_found
---

# Fase 6: Relatório de Code Review

**Revisado:** 2026-11-21
**Profundidade:** standard
**Arquivos revisados:** 6 (diff `main..HEAD` no worktree `claude-island-fase6`, branch `feat/fase-6-convivencia`)
**Status:** issues_found

## Resumo

Revisei o diff de código da fase: as âncoras `right-of-island`/`left-of-island` (`state.js`, CSS do `index.html`),
o comentário do `createIsland`, os testes novos (`coexistence.test.js`, ajuste em `prefs.test.js`) e o medidor
`scripts/measure-coexistence.ps1`. `node --test` passa: 361 testes, 0 falhas. Rodei o medidor com o mod escondido:
recusa com código 2, como esperado. Ele não chama nenhuma API que escreva em janela ou no registro; a única
gravação é o CSV no `%TEMP%`.

O caso que mais pesa é a geometria em telas estreitas. Com a área útil abaixo de 1220 DIP, o clamp empurra a
janela "ao lado" para cima da pílula expandida do mod e passa do limiar de 1/8 do `EnsureTopmost`. Aí o mod sobe
por cima de nós e cobre o começo das linhas do texto do pedido, e os botões (centralizados) continuam
armados. Isso contradiz o próprio docstring ("Vale em todo monitor", "até ~5 px"), e os testes só cobrem os dois
monitores do autor. No medidor, há falso positivo garantido sem o backdrop do mod e o código de saída 1 colide
com erro do script. A trava de texto de CONV-02 deixa passar casos (falsos negativos) e o nome do teste promete
mais do que ele confere.

## Critical Issues

### CR-01: Em área útil com menos de 1220 DIP o clamp joga a ilha "ao lado" sobre a pílula do mod e o mod passa a cobrir o texto do pedido

**Arquivo:** `state.js:345-365` (`besidePosition`), com `state.js:426-436` (`clampIslandPosition`) e `main.js:349` (`moveIsland`)
**Problema:** a janela à direita começa em `centro + 190`, e o clamp só deixa a janela sair `free` = 100 px
pela direita. Em área útil com `W < 2 × (210 + 400) = 1220` DIP, `moveIsland` puxa a janela para o centro.
Conferi com `anchorPosition` + `clampIslandPosition`:

| área útil (DIP) | config real | borda interna da pílula ao centro | sobreposição janela × pílula expandida do mod | ≥ 1/8 (8740 px²)? |
|---|---|---|---|---|
| 1093 | 1366×768 a 125%, 1920×1080 a 175% | 146,5 (deveria ser 210) | 12 558 px² | sim |
| 1066 | 1600×900 a 150% | 133 | 15 042 px² | sim |
| 1189 | — | 194,5 | 3 726 px² | não |

O espelho (`left-of-island`) dá os mesmos números. Abaixo de ~1190 DIP o `EnsureTopmost` do mod
(`.wh.cpp:4141`, documentado em `docs/INTEGRACOES.md:26-28`) dispara toda vez que o mod expande, e a janela dele
sobe por cima da nossa. A faixa coberta são uns 45-60 px da borda interna da nossa pílula, entre y≈30 e 214 da
área útil. É exatamente onde começa cada linha do `#permission-text` (`text-align: left`, `index.html:245`) no
`right-of-island`, ou onde terminam no `left-of-island`. Os `#actions` são centralizados (`index.html:260-262`) e
ficam visíveis e armados. O gate (`acceptDecision`, com `withinVisibleArea` em `main.js:607`) não sabe de
oclusão por outra janela topmost e aceita o clique. Dá para aprovar um pedido cujo começo do comando estava
coberto (por exemplo `sudo rm` escondido, `-rf ~/x` à vista). Isso viola a restrição de segurança do projeto.

Os testes `coexistence.test.js:42-51` e `:73-82` só usam `PRIMARY_WORK_AREA` (2560) e `SECONDARY_125_WORK_AREA`
(1536), e por isso não pegam o caso. O docstring em `state.js:351-353` afirma o contrário.
**Correção:** como não há posição no topo que caiba (meia-largura do mod 195 + pílula 400 + margem > W/2), a
saída segura é o fail-safe do gate, igual ao limite já aceito do palco maior que a área útil (`state.js:316-317`):
```js
// state.js
// A pílula expandida só cabe ao lado do mod com a área útil a partir desta largura; abaixo, o clamp a jogaria
// sobre a pílula dele e o EnsureTopmost do mod a cobriria.
const BESIDE_MIN_WORK_AREA_WIDTH_PX = 2 * (BESIDE_GAP_PX + EXPANDED_PILL_WIDTH_PX); // 1220

/** true se a âncora ao lado cabe nesta área útil; as outras âncoras sempre cabem. */
function besideFits(anchor, workArea) {
  if (anchor !== 'right-of-island' && anchor !== 'left-of-island') return true;
  return Number.isFinite(workArea?.width) && workArea.width >= BESIDE_MIN_WORK_AREA_WIDTH_PX;
}
```
Usar `besideFits(preferences.anchor, display.workArea)` junto de `isWithinWorkArea` em `fitsWorkArea`
(`main.js:367`) e em `withinVisibleArea` (`main.js:607`). Assim o renderer mostra "Responda no terminal" e o gate
recusa. Acrescentar em `coexistence.test.js` vetores com 1093 e 1066 DIP, corrigir o docstring e registrar o
limite em `docs/INTEGRACOES.md`.

## Warnings

### WR-01: Âncora ao lado com a forma "notch": pílula de topo reto flutuando 17 px abaixo do topo e desalinhada em 8 px

**Arquivo:** `index.html:146-147` e `index.html:162-165`; `state.js:334-336`
**Problema:** `:root[data-shape="notch"]` zera `--stage-top` e tira o arredondamento de cima
(`border-radius: 0 0 16px 16px`), porque o notch "pendura" do topo. Nas âncoras ao lado a janela desce
`BESIDE_TOP_OFFSET_PX = 17`, e o resultado é um notch de cantos retos solto 17 px abaixo da borda. A conta do
offset também supõe `--stage-top: 8px`: o centro da pílula fica em 17 + 0 + 23 = 40, e não em 48 como o da faixa
do mod. O menu oferece a combinação e nada a recusa.
**Correção:** no CSS, restaurar o respiro e o arredondamento do notch nas âncoras ao lado:
```css
:root[data-shape="notch"][data-anchor="right-of-island"],
:root[data-shape="notch"][data-anchor="left-of-island"] { --stage-top: 8px; }
:root[data-shape="notch"][data-anchor="right-of-island"] #pill,
:root[data-shape="notch"][data-anchor="left-of-island"] #pill { border-radius: 16px; }
```
A outra opção é documentar que o notch não se aplica ao lado. Em qualquer caso, um teste de CSS deve travar a
escolha.

### WR-02: Medidor: sem `DynamicIslandBackdrop` visível a "pílula" vira o palco inteiro do mod e a sobreposição é garantida

**Arquivo:** `scripts/measure-coexistence.ps1:86-90`, `:103-105`, `:131`
**Problema:** quando não há backdrop visível, `Get-Sample` usa como pílula a janela do mod, que é o palco de
936×364. Na posição `right-of-island` a nossa janela vai de `centro+190` a `centro+710` e cruza sempre o
palco (meia-largura 468, y 38-402). A conta é feita **por amostra**. Com o blur do mod desligado, então, toda
amostra conta sobreposição e o script sai com 1 de forma determinística: o aviso da linha 104 não impede o
falso resultado. Com o blur ligado, cada amostra em que o backdrop estiver oculto por um instante (transição
de estado do mod) cai no palco e conta sobreposição falsa. Bastam 2 dessas para `exit 1`. O resumo ainda
mostra `pilula_do_mod` da primeira amostra (`:145`), escondendo a troca.
**Correção:** sem backdrop no início, sair com 2 ("não dá para medir a pílula"). No laço, amostra sem backdrop
visível não entra na sobreposição (gravar `overlap_px2` vazio e contar à parte, `amostras_sem_pilula`). A
alternativa é estimar a pílula pela geometria conhecida do palco: topo `T + 22·escala`, largura `380·escala`,
centrada. E nunca usar o palco inteiro.

### WR-03: Medidor: código de saída 1 é ao mesmo tempo "convivência falhou" e "o script quebrou"; duração 0 sai com 0

**Arquivo:** `scripts/measure-coexistence.ps1:15-19`, `:114`, `:142`, `:148`
**Problema:** com `$ErrorActionPreference = 'Stop'` e `-File`, qualquer exceção não tratada termina com código 1.
Conferi com um script mínimo: falha em `WriteAllLines` → `exit=1`. Entram aí falha do `Add-Type`,
`EntryPointNotFoundException` no PowerShell de 32 bits (IN-05), `-OutCsv` em pasta inexistente (depois dos 5
minutos de medição, sem resumo) e `-IntervalMs` negativo no `Start-Sleep`. Todos são indistinguíveis da
inversão, do sumiço ou da sobreposição que o CHK-61 procura. No sentido oposto, `-DurationSec 0` (ou negativo)
não executa o laço, dá `amostras=0` e sai com **0 = "convivência limpa"** sem medir nada.
**Correção:**
```powershell
param(
  [ValidateRange(1, 86400)][int]$DurationSec = 300,
  [ValidateRange(50, 60000)][int]$IntervalMs = 500,
  ...
)
$ErrorActionPreference = 'Stop'
trap { Write-Host "Erro no medidor: $_"; exit 3 }
```
Documentar `3 = erro do medidor` no cabeçalho. Também convém testar a gravação do CSV (criar o arquivo vazio)
antes do laço, para não perder 5 minutos.

### WR-04: A trava de texto de CONV-02 tem falsos negativos e o teste de timer promete mais do que confere

**Arquivo:** `coexistence.test.js:136-159`
**Problema:**
1. `:146` corta a chamada no primeiro `;` depois do `setInterval(`. Num corpo em bloco
   (`setInterval(() => { tick(); island.setAlwaysOnTop(true); }, 1000)`) o recorte termina em `tick()` e o
   `setAlwaysOnTop` passa. O comentário da linha 145 diz "até o fim da instrução", mas não é isso que acontece.
2. Só a função agendada por nome é inspecionada, um nível só. Hoje `setInterval(cursorTick, ...)` (`main.js:310`)
   → `cursorTick` → `syncIslands()` (`main.js:288`) → `createIsland` → `setAlwaysOnTop` (`main.js:450`):
   há um caminho de timer até o `setAlwaysOnTop`, e o teste "nenhum timer do main mexe na ordem das janelas"
   passa. O caminho é aceitável (janela nova, uma vez), mas o nome do teste é falso e qualquer chamada indireta
   futura também passaria.
3. `:138` e `:137` usam `/setAlwaysOnTop\(/` e `'moveTop('` literais: `setAlwaysOnTop (true)`,
   `island['setAlwaysOnTop'](...)` e `.setAlwaysOnTop.call(` escapam.
4. Falso positivo frágil: um timer com função `const tick = () => ...` faz `functionBody('function tick(')`
   falhar a asserção da linha 132, sem relação com o topo.
**Correção:** trocar a heurística por uma lista fechada. Os callees de timer permitidos são
`['writeHeartbeat', 'cursorTick', "() => refresh('poll')"]`, e um timer novo obriga a revisar a trava. Usar regex
tolerante (`/\bsetAlwaysOnTop\b|\bmoveTop\b/` sobre o fonte sem comentários) para a contagem. Renomear o teste
ou documentar no próprio teste que `createIsland` alcançado por `syncIslands` é permitido por criar janela nova.

### WR-05: Oclusão pela ilha do mod não é vista pelo gate, e o encaixe ao lado a torna esperada (dois alertas, CHK-64)

**Arquivo:** `state.js:345-357` (premissa do encaixe); `main.js:596-608` (entradas do gate)
**Problema:** mesmo em tela larga, os dois alertas lado a lado do mod chegam a ~356 px de meia-largura
(`06-RESEARCH.md:144`, `docs/INTEGRACOES.md:39`). Eles cobrem uns 146 px da borda interna da nossa pílula, a
sobreposição com a nossa janela pode passar de 1/8 e o mod sobe sobre nós por ~4 s. O armamento dos botões
(`index.html:881-923`) e o gate só olham visibilidade, tela cheia e área útil. Nenhum dos dois sabe que o
começo do texto está coberto, e 4 s é bem mais que o tempo de armar. A fase entrega a âncora como "cresce para
fora sem cobri-la" (`README.md`), mas a verificação ficou para o CHK-63/64, sem gate no código. A classe de
risco já existia com `top-center` (sobreposição total). A diferença é que agora o produto promete que o encaixe
evita o problema.
**Correção:** tornar CHK-63/CHK-64 bloqueantes para o ship da âncora. Se CHK-64 confirmar a sobreposição,
subir o `BESIDE_GAP_PX` para cobrir os dois alertas (≥ 360). A alternativa é registrar no README que, com
alerta do mod na tela, o pedido se responde no terminal. Sem detecção de oclusão no gate, o risco precisa
estar escrito e não vendido como resolvido.

## Info

### IN-01: Arredondamento assimétrico com centro fracionário (largura ímpar)

**Arquivo:** `state.js:360-363`
**Problema:** `Math.round` arredonda `.5` para +∞ nos dois lados. Com `W` ímpar (centro `k + 0,5`), a borda
interna fica a 210,5 px à direita e a 209,5 px à esquerda. O teste do espelho (`coexistence.test.js:38`) só
passa porque os dois monitores do autor têm centro inteiro. A diferença de 1 px é desprezível na tela, mas o
teste dá uma garantia que não vale em geral.
**Correção:** arredondar o centro uma vez (`const center = Math.round(workArea.x + workArea.width / 2)`) e
somar inteiros. Acrescentar um vetor com largura ímpar.

### IN-02: Centro da área útil (código) contra "centro do monitor" (documento); qual centro o mod usa não foi verificado

**Arquivo:** `state.js:359`; `docs/INTEGRACOES.md:10` e `:23`
**Problema:** o código centra pela `workArea` e o documento fala em "210 px do centro do monitor" e em "palco
centrado no monitor principal". Com barra de tarefas vertical (largura `T`), os dois centros diferem `T/2`.
No `left-of-island` com a barra à esquerda a pílula chega `T/2` mais perto do mod (24 px com `T = 48`). Na
máquina do autor os dois coincidem e a pesquisa não conferiu se o mod usa `rcWork` ou `rcMonitor`.
**Correção:** conferir no `.wh.cpp` qual retângulo o mod centra e alinhar o código, o docstring e o documento
pela mesma referência.

### IN-03: CSS duplica as regras de lado em vez de agrupar os seletores (D-06), e o teste trava o texto duplicado

**Arquivo:** `index.html:162-165`; `coexistence.test.js:111-125`
**Problema:** D-06 diz "right-of-island entra no grupo de -left". A implementação repete os corpos das regras.
Mudar depois o alinhamento das âncoras de lado (outro padding, outra propriedade) deixa as âncoras ao lado com
o comportamento antigo, e `ruleBody` (que exige "uma regra só" com texto exato) ainda trava essa duplicação.
**Correção:** `:root[data-anchor$="-left"] body, :root[data-anchor="right-of-island"] body { ... }` (idem para
`--origin-x` e o lado direito). No teste, conferir o valor computado por seletor em vez do texto do corpo.

### IN-04: Medidor: campos coletados e nunca usados; lista de APIs do cabeçalho incompleta

**Arquivo:** `scripts/measure-coexistence.ps1:8`, `:30-31`, `:62-67`
**Problema:** `Pid`, `Title` e `Topmost` são lidos e não entram na lógica nem no CSV. `Topmost` serviria para
detectar a nossa janela perdendo o `WS_EX_TOPMOST`, que é o sumiço "atrás" que o CONV-02 descreve. O
cabeçalho lista as APIs "somente leitura" sem `GetWindowThreadProcessId` e `SetThreadDpiAwarenessContext`
(esta muda só a thread do próprio script, mas deve constar para a afirmação de somente leitura ficar completa).
**Correção:** usar `Topmost` (contar amostra em que a nossa ou a do mod deixa de ser topmost) ou remover os campos.
Completar a lista do cabeçalho.

### IN-05: Medidor quebra no PowerShell de 32 bits

**Arquivo:** `scripts/measure-coexistence.ps1:40`, `:64`
**Problema:** em processo de 32 bits, `user32.dll` não exporta `GetWindowLongPtrW` (é macro para
`GetWindowLongW`). Rodado pelo `SysWOW64\WindowsPowerShell`, a primeira amostra lança
`EntryPointNotFoundException` e sai com 1 (ver WR-03).
**Correção:** escolher a função por `IntPtr.Size` (`GetWindowLongW` quando 4) ou recusar com mensagem quando
`[Environment]::Is64BitProcess` é falso.

### IN-06: Medidor: "inversoes" conta amostras e não eventos; só a primeira janela do mod é considerada

**Arquivo:** `scripts/measure-coexistence.ps1:84`, `:130`
**Problema:** uma única inversão aos 10 s soma ~580 no contador `inversoes`, o que confunde quem lê o resumo
colado no CHK-61. Com o mod em mais de um monitor (`TargetMonitor` diferente de `primary`), `Select-Object -First 1`
compara tudo contra uma janela qualquer do mod.
**Correção:** contar transições (`$above` diferente do valor da amostra anterior) e, opcionalmente, as amostras à
parte. Com mais de uma janela do mod, avisar ou escolher a do monitor da nossa janela.

### IN-07: Already-defended-elsewhere: no teste de timer, as checagens de `setAlwaysOnTop`/`moveTop` já estão cobertas pelo teste de contagem

**Arquivo:** `coexistence.test.js:147` e `:154`
**Categoria:** necessity
**Problema:** o teste da linha 136 já exige zero `moveTop(` e exatamente um `setAlwaysOnTop(`, dentro de
`createIsland`. Portanto `setAlwaysOnTop`/`moveTop` no texto de um timer ou no corpo de uma função agendada
só podem aparecer se o timer estiver dentro de `createIsland`. O valor próprio do segundo teste está em
`.focus(`, `showInactive` e `.show(`. Isso é julgamento sobre valor de teste, não defeito.
**Correção:** reduzir o segundo teste às chamadas que só ele cobre, ou fundi-lo à lista fechada sugerida em WR-04.

### IN-08: Mensagens com acento saem truncadas quando a saída do medidor é redirecionada

**Arquivo:** `scripts/measure-coexistence.ps1:96`, `:101`, `:104`
**Problema:** no Git Bash/CI a saída veio como `N�o d� para medir`. O arquivo tem BOM e está certo; o PS 5.1
escreve no code page OEM do console. É só cosmético, mas o resumo é o que vai colado no UAT.
**Correção:** `[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)` no início, ou manter as mensagens em
ASCII.

---

_Revisado: 2026-11-21_
_Revisor: Claude (gsd-code-reviewer)_
_Profundidade: standard_
