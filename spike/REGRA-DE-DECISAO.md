# Regra de decisão: Electron × Tauri (escrita antes de qualquer medição)

Esta regra é commitada antes de existir qualquer arquivo em `spike/results/`. Depois do primeiro número medido
ela não muda mais: mudar a regra depois de ver os números invalida o spike.

## Escopo e viés declarado

- Escopo (D-13): Windows 11 com os 2 monitores do autor (100% e 125%). macOS e Linux não foram medidos e a decisão
  não vale para eles; uma base Tauri exigiria validação separada em macOS e Linux antes de a fase 3.1 ser fechada.
- A base atual é Electron. O Tauri só vence passando a regra inteira (Etapa 1 e Etapa 2). Dado incompleto não decide
  nada: na dúvida, a base continua Electron.

## Variantes

Labels dos arquivos de resultado: `e0`, `e1`, `e3`, `e2`, `t0`.

- E0: Electron atual, 2 janelas, brilho original (commit `2530f30`, anterior ao BASE-05).
- E1: E0 com o brilho do contorno corrigido (commit do BASE-05, sha fixado na medição), 2 janelas. Isola o efeito do CSS.
- E3: E1 com uma janela (monitor principal). É o "Electron otimizado" do BASE-03.
- E2: E3 com o switch do Chromium `--in-process-gpu`. Só pode ser referência se for elegível (ver Elegibilidade de E2).
- T0: casca Tauri, 1 janela (monitor principal), carregando a mesma `index.html` de E1.

## Método

- Medidor: `scripts/measure-footprint.ps1`. Aquecimento de 30 s, janela de 60 s, amostra a cada 5 s, 3 execuções por
  tentativa, mediana das 3.
- Cenários: ociosa (nenhuma sessão), trabalhando (sessão `running`) e precisa de você (sessão `waiting` com pedido de
  permissão de 20 linhas). Nos arquivos e no relatório os ids são `idle`, `running` e `waiting`.
- Ordem: medição intercalada por cenário. Primeiro ociosa (e0, e1, e3, e2, t0), depois trabalhando, depois precisa de
  você.
- Memória: private working set somado na árvore inteira de processos (inclui `msedgewebview2.exe` no Tauri), em décimos
  de MB.
- CPU: tempo de CPU da árvore inteira / segundos / processadores lógicos, em "% do total", com 4 casas decimais.
- Precisão da comparação: private working set em décimos de MB e CPU em 4 casas do "% do total", exatamente como o
  medidor arredonda. As comparações da regra usam esses valores arredondados.
- Instância isolada: `USERPROFILE` descartável e `--user-data-dir` próprio por execução. Nada é gravado no
  `~/.claude` real.
- Referência: E_ref = a variante otimizada elegível (E3 ou E2) com o menor private working set mediano no cenário
  ociosa. Empate fica com E3.

## Validade de execução (D-10)

Igual para toda variante. Uma execução só vale se cada janela da ilha tem:

- `WS_EX_TOPMOST` ligado (TOPMOST);
- `WS_EX_APPWINDOW` desligado (APPWINDOW);
- retângulo do tamanho esperado na base declarada, com tolerância de 2% em largura e altura (ver Errata).

Base declarada: pixels físicos do `GetWindowRect`, lido com a thread em DPI por monitor
(`SetThreadDpiAwarenessContext` com PER_MONITOR_AWARE_V2). Esperado 440×324 no monitor a 100% e 550×405 no monitor a
125% (440 e 324 × DPI/96, arredondado), com tolerância de 2% em largura e altura (ver Errata). `WS_EX_TOOLWINDOW` não é exigido: o Electron não o usa (estilo estendido
`0x8280028`: TOPMOST, TRANSPARENT, LAYERED, NOREDIRECTIONBITMAP, NOACTIVATE); a casca Tauri o liga só para escapar do
gerenciador de janelas em mosaico. O JSON guarda o retângulo físico e em DIP.

## Tentativas e remedições (D-12a)

- Cada medição de variante × cenário é uma tentativa, gravada em `spike/results/{label}-{cenario}-a{N}.json` e nunca
  sobrescrita.
- No máximo 2 remedições (a1, a2, a3) por variante × cenário, e só se a tentativa anterior for inválida ou tiver caído.
  Uma tentativa interrompida continua contando.
- Vale a primeira tentativa válida.
- Depois da a3 sem tentativa válida, a linha fica INVÁLIDA e aquela variante não pode ser referência nem vencedora:
  T0 inválido = o Tauri não vence; sem referência válida = a base continua Electron.

## Elegibilidade de E2 (D-12)

E2 é elegível a E_ref se e somente se (a) e (b) valem; senão E_ref = E3, mesmo que E2 gaste menos.

- (a) Cada uma das 9 execuções medidas de E2 (a1 de cada cenário; E2 nunca é remedida) mantém o PID raiz vivo a janela
  inteira (`rootAlive: true`) e passa na validade de execução acima.
- (b) Nas sondas antes da medição, para cada cenário, a captura `PrintWindow` de E2 comparada com a de E3 difere em no
  máximo 1% dos pixels, com tolerância de 8 por canal (diferença absoluta em R, G, B ou A acima de 8 conta o pixel como
  diferente; tamanhos diferentes = 100%).

As capturas das sondas são feitas com o movimento parado: E2 e E3 sobem com o switch do Chromium
`--force-prefers-reduced-motion` (a regra de reduced-motion da `index.html` desliga o brilho, o ponto e as reticências),
só nas sondas, nunca nas execuções medidas. Antes, as capturas de E3 de duas execuções de sonda seguidas têm de diferir
no máximo 0,1% em cada cenário (prova de que a imagem está parada); se não estabilizar, E2 fica inelegível com esse
motivo.

Os percentuais medidos, a checagem de estabilidade e as flags de PID vivo das 9 execuções ficam gravados em
`spike/results/eligibility.json`, que entra como entrada explícita do veredito.

## Etapa 1 (numérica)

O Tauri só passa à Etapa 2 se TODAS valerem:

- N1 (D-01). Em cada um dos 3 cenários (ociosa, trabalhando, precisa de você):
  WS(T0) <= 0,60 × WS(E_ref). N1 passa em exatamente 60%.
- N2 (D-02). CPU(T0, ociosa) <= CPU(E_ref, ociosa), estrito: sem tolerância, empate passa, qualquer valor acima
  reprova.

Se qualquer uma falhar: a base continua Electron. A Etapa 2 não é executada e o caminho de permissão não é portado
(BASE-03). Os números ficam no `PROJECT.md`.

Evidência adicional (não é gate): a CPU ociosa de E1 abaixo da de E0 mostra o efeito do BASE-05.

## Etapa 2 (funcional, só se a Etapa 1 passar), com os 2 monitores

- F1: transparência sem borda nem flash na criação.
- F2: hover sem perder o clique (exige polling de cursor em Rust, não implementado nesta fase).
- F3: clicar na pílula não tira o foco do terminal.
- F4: acima de vídeo em tela cheia.
- F5: posição certa nos dois monitores (retângulo e estilo conferidos por `GetWindowRect`/`GetWindowLong`), sem ser
  capturada por gerenciador de janelas em mosaico.
- F6: caminho de permissão ponta a ponta com o `permission-hook.js` real (pedido → decisão → arquivo → saída do hook),
  nos casos allow, deny e id velho recusado.

Definição de F6 nesta fase (escopo declarado, não redução): a paridade com `fixtures/permission-vectors.json` é o
SEG-07 e pertence à fase 3.1, porque esse arquivo é saída da Fase 2 e não existe neste branch.

Quem observa: o agente, F5 e F6; o autor, F1, F3, F4 e a aparência a 125%, no checkpoint humano do fim da fase.

Resultado (D-09, D-04): o Tauri vence somente se a Etapa 1 passar e cada gate F1 a F6 for observado passando nesta
fase. Gate não observado, inclusive F2, dá o resultado "Electron mantido; Tauri pendente de Etapa 2 incompleta": o
`PROJECT.md` registra Electron, os números e o que faltou, o orquestrador escala ao autor e nenhuma fase 3.1 é criada.
Só com todos os gates observados passando o orquestrador cria a 3.1 por `/gsd-phase --insert 3`. Etapa 1 reprovada: a
Etapa 2 não roda e o caminho de permissão não é portado (BASE-03).

Decisão automática de teste (D-14): qualquer decisão automática usada para testar o F6 só existe atrás da feature do
cargo `spike-autodecide`, desligada no build padrão, usada só pelo `spike/tauri/check-permission.ps1`, e não pode
existir em nenhum porte.

## Errata (antes de qualquer medição)

Corrige a validade de janela (D-10), sem mexer em N1, N2, nos cenários, nas tentativas nem na elegibilidade de E2.
Uma execução de mecânica do medidor, feita antes de existir qualquer arquivo em `spike/results/`, mostrou que o
Electron atual abre a janela do monitor a 125% com 550×410 em pixels físicos (328 DIP de altura), de forma repetível,
e não 550×405: o arredondamento de escala fracionária do Windows para a janela transparente (o `main.js` já
comenta essa instabilidade em `moveIsland`). Com a conta exata, toda execução de E0 e E1 (2 janelas) ficaria
INVÁLIDA e o spike perderia a evidência da CPU ociosa de E1 contra E0. O critério passa a aceitar diferença de até
2% (arredondada para cima) em largura e altura sobre o tamanho calculado: 410 num esperado de 405 vale; uma janela
retiliada por gerenciador de janelas em mosaico (por exemplo 1091×466) continua inválida, que é o que o critério
existe para pegar. TOPMOST ligado e APPWINDOW desligado seguem exatos. Esse critério filtra execuções mal
montadas e não é limiar de decisão. A execução de mecânica imprimiu valores de memória e CPU de E1 (brilho original,
só um cenário); nenhum foi anotado nem usado para ajustar N1, N2 ou qualquer limiar.

## Divulgação pré-regra

Durante a pesquisa foram feitas execuções curtas só para validar mecânica (janela de 12 a 35 s, sem aquecimento,
enquanto o `cargo` compilava). Nenhum valor delas é evidência e nenhum foi anotado. Os limiares desta regra (60% e CPU
ociosa) são os do autor em BASE-02 e não foram ajustados a partir dessas execuções. Única observação qualitativa: com o
brilho original a ilha ociosa tinha CPU mensuravelmente não nula. Toda medição de verdade é tratada como inexistente
até o commit desta regra.

---

A aritmética desta regra está em scripts/spike-verdict.js (evaluateRule); se divergirem, vale este texto.

scripts/spike-verdict.js é ferramenta do spike, não lógica da ilha em execução; por isso mora em scripts/ e não no state.js.
