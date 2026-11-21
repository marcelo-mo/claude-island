---
phase: 04-entrada-prefer-ncias-e-comportamento-no-sistema
reviewed: 2026-11-21T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - main.js
  - state.js
  - index.html
  - preload.js
  - scripts/human-checks.js
  - spike/tauri/src-tauri/src/shim.js
  - gate.test.js
  - island.test.js
  - hover.test.js
  - prefs.test.js
  - visual.test.js
  - fixtures/permission-vectors.json
  - README.md
findings:
  critical: 1
  warning: 3
  info: 4
  total: 8
  necessity: 1
status: issues_found
---

# Fase 4: Relatório de revisão de código

**Revisado:** 2026-11-21
**Profundidade:** standard
**Arquivos revisados:** 13
**Status:** issues_found

## Resumo

Revisei o diff `4393a57..HEAD` dos 13 arquivos, com prioridade na fronteira de confiança do gate de permissão. `node --test` passa (345 testes), mas o que os testes travam em `main.js` é só o texto do arquivo, e foi assim que um defeito funcional passou.

**O gate em si se manteve sólido.** Não encontrei caminho em que hover, captura do mouse, menu, esconder/mostrar, opacidade ou troca de âncora ou monitor faça Permitir ou Negar atingir um pedido que o usuário não viu.
- `acceptDecision` continua sendo a única porta para `writeDecision`.
- O alvo é sempre `shown.id`.
- `windowVisible`, `coveredByFullscreen` e `withinVisibleArea` só aceitam o valor exato.
- A opacidade sai do mesmo passo do `refresh` que decide o pedido exibido.
- Os canais novos (`island:capture`, `island:menu`) passam por `islandOf`. `island:capture` valida `typeof === 'boolean'` e `island:menu` não recebe argumento.
- `normalizePreferences` lê só chaves do esquema, com `Object.hasOwn`, e o arquivo tem teto de 64 KB e quarentena.

**Pontos de atenção:**
- O item de menu "Esconder" nunca recebe o clique (CR-01).
- Um movimento de janela fora do menu e das preferências não rearma os botões (WR-01).
- O fechamento do menu pode tocar numa janela destruída (WR-02).
- Os testes de texto não detectam nenhum dos três (WR-03).

## Críticos

### CR-01: O item de menu "Esconder" é inerte: `toMenuItem` nunca liga o `click`

**Arquivo:** `main.js:216-225` (modelo em `state.js:634-636`)
**Problema:** `menuTemplate` gera o item de esconder como `{ label: 'Esconder', action: 'hide', enabled: true }`, **sem a chave `key`**. Em `toMenuItem`, a guarda `if (item.key === undefined) return { ...item };` vem **antes** do teste `if (item.action === 'hide')`. O item de esconder sempre cai na primeira guarda e é devolvido sem `click`, e o ramo `action === 'hide'` é código morto. Verifiquei com `node -e`: `menuTemplate({}, 'ok')` devolve o último item com `key === undefined`. Resultado:
- Clicar em "Esconder" no menu não faz nada, contra o README ("e esconder" no menu) e contra D-12.
- Só o atalho global esconde de fato.
- A variante "Esconder (sem atalho para mostrar de novo)", que existe para proteger o usuário, também é inerte.

O defeito passou porque `gate.test.js:1125-1126` só confere por regex que o corpo de `toMenuItem` contém `if (item.action === 'hide')` e `setUserHidden(true)`. Isso passa mesmo com o ramo inalcançável.
**Correção:** testar a ação antes da guarda de `key`:
```js
function toMenuItem(item) {
  if (item.submenu) return { ...item, submenu: item.submenu.map(toMenuItem) };
  if (item.action === 'hide') {
    const { action, ...rest } = item;
    return { ...rest, click: () => setUserHidden(true) };
  }
  if (item.key === undefined) return { ...item };
  const { key, value, ...rest } = item;
  return { ...rest, click: () => applyPreference(key, value) };
}
```
Mova `toMenuItem` para `state.js` (ou receba `{ onHide, onPreference }` por parâmetro), como `registerShortcut` já faz. Assim ele ganha teste de comportamento: dado o modelo real, o último item tem `click` e o `click` chama o callback.

## Avisos

### WR-01: `island:reset-position` e `island:drag-end` movem a janela sob o cursor sem rearmar os botões

**Arquivo:** `main.js:554-573`, `index.html:1111-1116`
**Problema:** A fase estabeleceu a regra de que todo evento que pode pôr um botão sob o cursor termina em `refresh('rearm')`. A regra vale para preferências, menu, esconder/mostrar, âncora e monitor. Dois caminhos que movem a janela ficaram de fora: `island:reset-position` (duplo clique na pílula) e `island:drag-end`.

O renderer não detecta o movimento: `armedRect` e `buttonsRect()` são relativos à janela, que não muda, então não há `restartArming`. O duplo clique cai fora de `button, #permission`, portanto vale com o pedido na tela. Com a janela arrastada para longe do padrão, `moveIsland(..., anchorPosition(...))` a leva de uma vez ao lugar padrão. Com o cursor parado, Permitir pode ficar sob ele.

Como `canPress` só exige 200 ms desde o último `pointermove` **dentro de `#actions`** ou desde `armedAt`, o botão já está armado e o terceiro clique de uma rajada (ou o clique seguinte do usuário) vale como decisão. É exatamente "Allow atingindo algo que o usuário não estava vendo na posição em que clicou", a ameaça central do projeto. O gate do main também aceita, porque `shown.since` é antigo.
**Correção:** reiniciar o armamento ao reposicionar:
```js
// island:reset-position, depois de moveIsland(...)
refresh('rearm');
// island:drag-end, depois de persistSavedOffsets()
refresh('rearm');
```
No arraste o custo é só 0,8 s sem botões depois de soltar. Acrescente um teste de texto (ou, melhor, de comportamento) em `gate.test.js` que exija `refresh('rearm')` nos dois handlers.

### WR-02: `menu-will-close` pode chamar `setIgnoreMouseEvents` numa janela destruída

**Arquivo:** `main.js:251-257`, `main.js:464-509`
**Problema:** `applyPreference` chama `syncIslands()` de dentro do `click` do item. No modo `primary`, ou com o modo `cursor` entre monitores, a ilha dona do menu pode ser a "sobra" destruída (`island.destroy()` na linha 508): escolher "Só no monitor principal" a partir da ilha de um monitor secundário faz exatamente isso. Depois, o handler `menu-will-close` chama `applyCapture(island)`, que faz `island.setIgnoreMouseEvents(...)` na janela destruída e lança "Object has been destroyed". Como o handler é de evento do Electron e não tem `try/catch`, vira exceção não tratada no main (diálogo de erro) e o `refresh('rearm')` seguinte não roda. O resultado depende da ordem entre o `click` e o `menu-will-close` na plataforma, que não verifiquei.

Há dois problemas ligados:
- `applyCapture` não checa `isDestroyed()`, ao contrário de `releaseCapture`.
- `syncIslands` não zera `menuIsland` quando destrói a ilha dona.
**Correção:**
```js
function applyCapture(island) {
  if (!CAN_CLICK_THROUGH || island.isDestroyed()) return;
  ...
}
// em syncIslands, no laço de leftovers:
if (island === menuIsland) menuIsland = null;
```
No `menu-will-close`, chame `refresh('rearm')` mesmo se a ilha foi destruída.

### WR-03: Os testes de `main.js` travam só o texto, e dois dos contratos novos ficam sem verificação real

**Arquivo:** `gate.test.js:1095-1127`
**Problema:** O código de `main.js` que só roda dentro do Electron é coberto por regex sobre o fonte (`bodyOf`, `includes`). Esse tipo de teste prova que uma string existe, não que o caminho é alcançável.
- CR-01 é o caso concreto.
- Não há teste que cubra a ordem das guardas de `toMenuItem`.
- Não há teste que cubra a liberação de `menuIsland` quando a ilha é destruída (WR-02).
- Não há teste que cubra o rearme nos handlers que movem a janela (WR-01).

A lógica pura (`menuTemplate`, `nextUserHidden`, `isIslandVisible`, `acceptDecision`) está bem testada; o problema é a cola.
**Correção:** extrair a cola testável para `state.js`, seguindo o padrão do `registerShortcut`: `toMenuItem` recebendo os callbacks, e uma função pura que diz se um evento de movimento exige rearme. Teste o comportamento (`menuTemplate` real, passado por `toMenuItem` com callbacks espiões, e `click` do último item chama o callback). Mantenha os testes de texto só como trava de regressão complementar.

## Informações

### IN-01: `SHORTCUT_PATTERN` aceita tecla sozinha, sem modificador

**Arquivo:** `state.js:477-479`, `main.js:629-631`
**Problema:** `^[A-Za-z0-9]+(?:\+[A-Za-z0-9]+)*$` aceita `"A"` ou `"Space"`. Um `preferences.json` com `"shortcut": "A"` registra via `globalShortcut` uma letra pura em todo o sistema, e o usuário perde essa tecla em todos os apps. O campo é editável à mão, então o risco é de autoengano, mas o "inválido" do menu só aparece quando o Electron recusa, não quando a forma é perigosa.
**Correção:** exigir pelo menos um modificador (`Control|Alt|Shift|Super|CommandOrControl`) mais uma tecla, por exemplo `/^(?:(?:Control|Ctrl|Alt|Shift|Super|CommandOrControl|CmdOrCtrl)\+)+[A-Za-z0-9]+$/`. Atualize o vetor de teste correspondente em `prefs.test.js`.

### IN-02: Arquivo de preferências com JSON válido, mas inútil, não vai para a quarentena e é sobrescrito sem aviso

**Arquivo:** `main.js:104-121`, `state.js:537-546`
**Problema:** O comentário de `quarantinePreferences` diz que o arquivo é editado à mão e que a próxima gravação do menu apagaria o que o usuário escreveu errado. A quarentena só dispara para JSON que não faz parse ou para arquivo acima de 64 KB. Estes casos passam sem aviso:
- JSON válido que não é objeto (`null`, `[]`, `42`): `normalizePreferences` devolve os padrões e o arquivo é sobrescrito na primeira escolha do menu.
- Objeto com valor inválido ou chave desconhecida: a chave volta ao padrão e o valor original se perde na mesma gravação.

O README promete a quarentena para arquivo "corrompido".
**Correção:** em `loadPreferences`, tratar parse que não resulta em objeto simples como inválido e chamar `quarantinePreferences()`. Se quiser cobrir também valores inválidos, compare `JSON.stringify(normalizePreferences(parsed))` com o objeto lido e coloque o original em quarentena quando divergir.

### IN-03: Sem produtor para o mapa de tela cheia (necessidade)

**Arquivo:** `main.js:75`, `main.js:241`, `main.js:419`, `main.js:599`, `state.js:199-221`
**Categoria:** necessity
**Problema:** `fullscreenByDisplay` nunca é escrito. `nextFullscreen` e as constantes `FULLSCREEN_TOLERANCE_PX`, `SHELL_WINDOW_CLASSES` e `WS_EX_TRANSPARENT` são exportados e testados, mas nenhum chamador de produção os usa. Em runtime, `covered` é sempre `false` e `coveredByFullscreen` é sempre `false` quando há `display`. O comentário `ponytail` e o README declaram isso como pendência (D-20), então não é falha escondida. A avaliação depende de julgamento: o código está dormente por decisão do autor, e o gate trata o monitor desconhecido como coberto, o que é o lado seguro e vale como defesa em profundidade.
**Correção:** nenhuma obrigatória. Se o sensor não vier na próxima fase, avalie remover `nextFullscreen` e o mapa, ou mantê-los marcados como dormentes.

### IN-04: `island:cursor` é enviado sem conferir a página que está na janela

**Arquivo:** `main.js:285`, `main.js:305`, `main.js:307`
**Problema:** `sendState` confere `isIslandSender` antes de enviar o texto do pedido. `island:cursor` não confere, e o ponto do cursor relativo à janela vai para qualquer página carregada. `will-navigate`, `will-redirect` e `setWindowOpenHandler` já bloqueiam a navegação, então hoje só vaza a posição do cursor, que não é sensível. É uma assimetria de camadas, não uma falha explorável.
**Correção:** opcional. Se quiser a mesma camada, extraia o `if (!isIslandSender(...)) return;` do `sendState` para um helper `sendToIsland(island, channel, ...args)` e use-o nos dois.

---

_Revisado: 2026-11-21_
_Revisor: Claude (gsd-code-reviewer)_
_Profundidade: standard_
