# Referência: mod "Dynamic Island for Windows" (Windhawk)

**Analisado em:** 2026-11-21 · **Versão:** 1.4.0 · **Autor:** Himanshu (github devcode90) · **Licença:** MIT (cabeçalho `@license MIT`; o arquivo não traz linha de copyright — titular exato não confirmado)
**Fonte local:** `C:\ProgramData\Windhawk\ModsSource\dynamic-island-for-windows.wh.cpp` (~24 mil linhas, C++ + Direct2D, um arquivo só; roda como "tool mod" num processo `windhawk.exe` dedicado). Números de linha abaixo referem-se a esse arquivo.

Se portarmos lógica ou constantes, manter o aviso MIT do autor (`THIRD_PARTY_NOTICES.md` + comentário nos trechos portados).

## 1. Interação e animação

### Tamanhos (px lógicos × `sizeScale`)
- Ociosa: faixa de 36 px de altura, largura medida pelo conteúdo (l.838, 23164)
- Mídia recolhida: 150×44; painel expandido: 380×184 (l.672)
- Alertas (`ActivityForKind`, l.20788): notificação 360×58, clipboard 340×56, volume/brilho 300×54, Caps 180×42, Bluetooth 280×54, timer 260×54, DnD 220×42, progresso 230×48
- "Split": não é estado próprio; as duas atividades de maior prioridade lado a lado, com 12 px de espaço, largura = soma (l.11887, 23223)

### Física de mola (`SpringValue`, l.1608)
- Massa 1, integração em passos fixos de 0,5 ms; molas separadas para largura e altura
- Constantes por direção (l.23277):
  - crescendo: k=380, c=26 (ζ≈0,67, ~6% de overshoot)
  - encolhendo: k=200, c=28 (ζ≈1,0, sem overshoot)
  - neutro: k=280, c=24
- Estilos multiplicam k e c (l.23264):

  | Estilo | k | c | ζ ao crescer |
  |---|---|---|---|
  | Smooth | ×1 | ×1,35 | ≈0,9 |
  | Default | ×1 | ×1 | ≈0,67 |
  | Bouncy | ×1,1 | ×0,7 | ≈0,45 (~21% overshoot) |
  | Snappy | ×1,5 | ×1,25 | ≈0,68, mais rápido |

- Velocidade (0,5× a 2×) multiplica o `dt`. Mola interrompível: novo alvo mantém a velocidade atual. Sem duração fixa (assenta em ~0,3 s no Default)
- **Nudge:** em evento novo ou troca da atividade principal, o topo pula −6 px e volta por mola (k=280, c=24), no máximo 1× a cada 0,45 s (l.4980, 22979)
- **Hover:** escala 1,025 (l.11884)
- **Troca de abas:** mola k=250, c=31 (ζ≈0,92), deslocamento vertical 34 px, escala mínima 0,965 + fade (l.15480). Acento muda por lerp exponencial τ=0,18 s (l.12452)

### Entrada
- **Hover sem atraso:** a cada quadro lê `GetCursorPos` e testa o retângulo da pílula (l.23011). A "demora" ao sair vem só da mola de encolher. Opção "Expand on click": clique expande, sair recolhe
- **Rolagem entre abas:** acumula delta até 120; gesto novo após 220 ms ou inversão de direção; 85 ms entre passos (200 ms no touchpad); não dá a volta no fim (l.22541)
- **Cliques:** esquerdo age no item/abre o app; duplo clique fixa aberta (persiste); botão do meio muta o áudio; Ctrl + hover deixa a ilha translúcida e o clique atravessa (l.23330)
- **Menu do clique direito** (l.11223): Hide/Show, Dismiss, Focus Timer, Media source, File Tray, Pin expanded, game overlay, Shape style, Expand on Hover/Click, opções de letras, Transparency (100/85/70/55%), Theme, Open Windhawk settings. Tema, forma e pin voltam às settings quando o mod reinicia
- **Esconder:** `RegisterHotKey`, padrão Ctrl+Alt+D (l.22585); escondida, estaciona a thread de render (CPU ~0). "Unhide on hover" usa hook `WH_MOUSE_LL` só enquanto estacionada. Auto-hide por inatividade (−1, 0, 5, 10, 30, 60 s)

### Formas
- Pílula: raio = altura/2, limitado a 44
- Windows 11: raio 8
- Notch: raio 16, topo reto colado na borda (l.12757, 13022, 15671)

### Posicionamento (`ComputeStageLayout`, l.4006)
- 6 âncoras (16 px das laterais, 40 px de baixo); Offset X/Y, mais um Y separado para o estado expandido, interpolado pela fração de expansão (l.3909); "Border-merged" cola no topo
- Um monitor só: primário, Display N, ou "Follow" (monitor do cursor, reavaliado a cada quadro); Auto DPI = base × DPI do monitor

### Janela e clique atravessando
- Popup `WS_EX_LAYERED|TOPMOST|TOOLWINDOW|NOACTIVATE|TRANSPARENT` num palco fixo de 880×320 (+ padding 28/22); a janela nunca se redimensiona durante a animação; desenho por `UpdateLayeredWindowIndirect` com dirty rect (l.11787)
- Clique atravessa por `WM_NCHITTEST` → `HTTRANSPARENT` fora da pílula (l.21984) e por `WS_EX_TRANSPARENT` quando ociosa e sem hover (l.23333)
- **Tela cheia:** a cada 0,5 s verifica se o client rect da janela em foco cobre o monitor (l.2652); se cobre, recolhe e estaciona; o hotkey força exibição. Cede o z-order ao Snipping Tool. (Inferência: tela cheia em outro monitor também esconde, porque usa o monitor da janela em foco)

## 2. Visual

### Temas (fundo, texto, secundário, borda; l.1060)

| Tema | Fundo | Texto | Secundário | Borda |
|---|---|---|---|---|
| Obsidian | #08080A | #FFFFFF | #9B9BA5 | #1E1E22 |
| Graphite | #1C1C1E | #FFFFFF | #A8A8AE | #323236 |
| Slate | #111721 | #E9EEF6 | #92A2B8 | #232C3A |
| Nord | #2E3440 | #ECEFF4 | #A7B0C0 | #3B4252 |
| Evergreen | #0C1512 | #E4F1EA | #8CAE9D | #1A2A23 |
| Espresso | #1A1512 | #F6EEE7 | #B7A395 | #2E2420 |
| Plum | #16111C | #F1EAF6 | #AC9BB9 | #281F33 |
| Porcelain (claro) | #F5F6F8 | #14161A | #5B6270 | #D8DBE1 |

Secundário ≈4,5:1 de contraste em todos. Outras cores: acento padrão #4cc9f0; microfone #FF9500; câmera #34C759; alerta de bateria rgb(255,69,69) pulsando a 2,1 Hz.

### Camadas do material (`DrawPillSurface`, l.13096), de baixo para cima
1. **Scrim:** rgb(3,3,3) com alfa = TintIntensity
2. **Preenchimento:** cor de fundo × opacidade (35–100%)
3. **Profundidade:** gradiente preto vertical 0 → 0,25 (em 45%) → 1; opacidade 0,085 (mídia/ociosa) ou 0,06; temas claros ×0,55
4. **Lavagem de acento:** gradiente radial a partir do centro do topo, raios 0,75·largura × 1,15·altura, do acento opaco a transparente; opacidade 0,115 (mídia), 0,055 (ociosa), 0,075 (demais) × AccentBloom/100; acento corrigido para contraste ≥3:1
5. **Contorno:** 0,8 px (1 px na forma W11); em Auto, o acento com alfa 0,35 (ociosa) ou 0,60

- **Sombra:** 7 formas concêntricas com queda quadrática; espalhamento 14×escala (6–18), deslocamento y 0,35×espalhamento, alfa 0,55·(1−t)²·0,55; desligada com blur (l.12856)
- **Cards internos:** branco alfa 0,085/0,15 (escuro), preto 0,062/0,105 (claro), sem contorno
- **Texto:** primário alfa 0,98; secundário 0,88–0,90; terciário = mistura(secundário, fundo, 0,35) com alfa 0,72
- **Tipografia:** Segoe UI Variable Display/Small (reserva Segoe UI); ícones Segoe Fluent Icons/MDL2. Texto 13,5; pequeno 11; negrito 12; relógio 18; faixa ociosa 13 — × TextScale (l.12270)
- **Blur/acrylic:** `SetWindowCompositionAttribute` não documentada (WCA_ACCENT_POLICY=19; estado 3 blur, 4 acrylic, flag 0x10) numa janela **separada e não layered** abaixo da ilha, recortada no formato da pílula (l.3470, 3612). Depende de "Transparency effects" no Windows. No Electron, `backgroundMaterial` é só retangular (Windows 11); recorte arredondado exigiria código nativo

## 3. Arquitetura e convivência

- Uma thread por fonte (mídia, áudio, clima, letras, notificações, Bluetooth, hooks, render) escrevendo num `SharedState` com mutex, copiado pelo render a cada quadro
- **Prioridade** (`ChooseActivities`, l.20867): Lookup > Clipboard > Caps > Dispositivo > Bluetooth > DnD > Volume > Brilho > Notificação > Bateria fraca > Progresso > Timer > Mídia > Ociosa. Só as duas primeiras aparecem (principal à esquerda, secundária à direita); **sem fila** — as demais expiram sem aparecer
- **Não há API para outro programa empurrar conteúdo** (nada de pipe, `WM_COPYDATA`, arquivo ou socket). Brechas acidentais:
  1. `ProgressPercent` (DWORD 0–100, ou −1) em `HKLM\SOFTWARE\Windhawk\Engine\ModsWritable\dynamic-island-for-windows\LocalStorage`, lido a cada 250 ms; a ACL de `ModsWritable` dá FullControl a "Todos". Mostra só um anel "Progress N%"
  2. Toasts do Windows: um toast nosso apareceria por 4 s (exige "Let apps access your notifications"); lógica confirmada no código, não testado rodando
  3. Sessão de mídia falsa (SMTC) — gambiarra, não recomendado
- **Convivência com a nossa ilha:** as duas ocupam o topo central e se sobrepõem (nossa ≈ y 8–54; dela ≈ y 30–66 ociosa, até ≈214 expandida — leitura de código, não conferido na tela). O mod reafirma o topmost a cada 1 s quando uma janela topmost cobre ≥1/8 da pílula (`EnsureTopmost`, l.4086); como a nossa janela (440×324, quase toda transparente) entra inteira no cálculo, a ilha dele tende a ficar por cima. O hover dele é pela posição do cursor: passar o mouse na nossa também expande a dele. Classe de janela para detectar: `Windhawk.DynamicIslandForWindows` (a confirmar)

## 4. Inventário de módulos (fora de escopo — registro para referência)

Viabilidade: (a) Node/Electron/web multiplataforma; (b) só Windows sem módulo nativo; (c) exige addon nativo.

| Módulo | API/serviço | Rede | Viab. |
|---|---|---|---|
| Mídia | WinRT GSMTC | — | b/c |
| Espectro | WASAPI loopback + FFT | — | b |
| Letras | lrclib.net | título/artista/álbum/duração | a (depende de mídia) |
| Calendário | local | — | a |
| Clima | wttr.in | IP ou cidade, **ligado por padrão** | a |
| Hardware | GetSystemTimes, PDH | — | a/b |
| Game overlay | mesmas; "FPS" é o da própria ilha | — | a/b |
| Ociosa/relógio/bateria | GetSystemPowerStatus | — | a |
| Câmera/microfone | registro CapabilityAccessManager | — | b |
| Clipboard | AddClipboardFormatListener | — | a |
| Notificações | UserNotificationListener + SHELLHOOK | — | c |
| Bandeja de arquivos | OLE drag-drop | — | a |
| Quick Lookup | Wiktionary/Wikipedia/dictionaryapi.dev | termo, após Enter | a |
| Volume/brilho | IAudioEndpointVolume / IOCTL | — | b/c |
| Caps/Num Lock | hook `WH_KEYBOARD_LL` | — | c |
| Bluetooth/USB | WinRT DeviceWatcher / WM_DEVICECHANGE | — | b/c |
| Não perturbe | WNF não documentado | — | c |
| Progresso | lê `ProgressPercent` que nada escreve | — | — |

## 5. Riscos e qualidade observados

- Rede: clima ligado por padrão envia IP/cidade a cada 15 min; letras e lookup desligados por padrão. Sem telemetria
- Privacidade local: mostra conteúdo de toasts e do clipboard (risco em compartilhamento de tela); a bandeja grava texto colado em claro; hook global de teclado
- CPU: "zero CPU" só estacionada; visível, acorda a cada 16 ms, testa tela cheia a cada 0,5 s, lê registro a cada 250 ms
- APIs não documentadas (`SetWindowCompositionAttribute`, WNF) podem quebrar com atualizações do Windows

## Não confirmado

Titular do copyright; posições reais na tela das duas ilhas; se o Electron reafirma o topmost; se toasts nossos aparecem na ilha dele; `getCursorScreenPoint` no Wayland.
