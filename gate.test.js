const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const {
  acceptDecision, isWithinWorkArea, nextShownPermission, PERMISSION_ARM_MS, SECURE_WEB_PREFERENCES,
  effectiveOpacity, isIslandSender, ANIMATION_STYLES, DEFAULT_PREFERENCES, WINDOW_SIZE, HORIZONTAL_SLACK,
  PERMISSION_TOOL_LIMIT, STAGE_SHADOW_PX, EXPANDED_PILL_WIDTH_PX, besideFits, anchorPosition, clampIslandPosition,
  horizontalSlackFor, BESIDE_GAP_PX, BESIDE_MIN_WORK_AREA_WIDTH_PX,
  nextSelection, wheelStep, WHEEL_NOTCH_DELTA, WHEEL_GESTURE_PAUSE_MS, WHEEL_STEP_MS, WHEEL_PRECISE_STEP_MS, WHEEL_DELTA_MAX,
  SNAP_GESTURE_GAP_MS, SNAP_WHEEL_LOCK_MS,
} = require('./state');
// Os vetores são JSON puro para um gate futuro em outra linguagem reaproveitá-los sem adaptação.
const vectors = require('./fixtures/permission-vectors.json');

test('o tempo de armamento do state.js é o do fixture', () => {
  assert.equal(PERMISSION_ARM_MS, vectors.armMs);
});

test('o fixture não tem motivo digitado errado nem motivo sem cobertura', () => {
  const used = new Set(vectors.acceptDecision.filter((vector) => !vector.expect.accept).map((vector) => vector.expect.reason));
  for (const reason of used) assert.ok(vectors.acceptReasons.includes(reason), `motivo fora de acceptReasons: ${reason}`);
  for (const reason of vectors.acceptReasons) assert.ok(used.has(reason), `motivo sem vetor: ${reason}`);
});

for (const vector of vectors.acceptDecision) {
  test(`acceptDecision: ${vector.name}`, () => {
    assert.deepEqual(acceptDecision(vector.input), vector.expect);
  });
}

for (const vector of vectors.isWithinWorkArea) {
  test(`isWithinWorkArea: ${vector.name}`, () => {
    const { bounds, workArea, horizontalSlack } = vector.input;
    assert.equal(isWithinWorkArea(bounds, workArea, horizontalSlack), vector.expect);
  });
}

for (const vector of vectors.nextShownPermission) {
  test(`nextShownPermission: ${vector.name}`, () => {
    const { shown, permissionId, now, rearm } = vector.input;
    assert.deepEqual(nextShownPermission(shown, permissionId, now, rearm), vector.expect);
  });
}

for (const vector of vectors.isIslandSender) {
  test(`isIslandSender: ${vector.name}`, () => {
    assert.equal(isIslandSender(vector.input), vector.expect);
  });
}

// Os testes de fonte abaixo são travas de regressão baratas e assumidamente frágeis (leem texto):
// não provam comportamento. Se um comentário em main.js quebrar a contagem, ajuste o comentário.
const mainSource = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');

test('o pedido exibido só é atribuído na declaração e dentro de refresh (invariante I2)', () => {
  const assignments = mainSource.match(/(?<![\w.])shown\s*=(?!=)/g) || [];
  assert.equal(assignments.length, 2);
  assert.match(mainSource, /^let shown = \{/m);
  const refreshStart = mainSource.indexOf('function refresh(reason)');
  assert.ok(refreshStart >= 0);
  const refreshBody = mainSource.slice(refreshStart, mainSource.indexOf('\nfunction ', refreshStart));
  assert.match(refreshBody, /(?<![\w.])shown = nextShown;/);
  // Escrever num campo também troca o alvo da decisão ou o relógio do armamento fora de refresh.
  for (const mutation of [
    /(?<![\w.])shown\s*(?:\.\s*\w+|\[[^\]]*\])\s*(?:[-+*/%&|^]?=(?!=)|\+\+|--)/,
    /(?:\+\+|--)\s*shown\s*[.[]/,
    /delete\s+shown\s*[.[]/,
    /Object\.(?:assign|defineProperty|defineProperties|setPrototypeOf)\(\s*shown\b/,
  ]) {
    assert.equal(mutation.test(mainSource), false, `main.js muda um campo de shown: ${mutation}`);
  }
});

// Trava de regressão (texto exato), não prova de comportamento: o comportamento do rearme é o do
// vetor "mesmo id com rearm true"; aqui só se garante que os eventos continuam ligados a ele.
test('toda reexibição rearma o relógio do main', () => {
  for (const hook of [
    "island.on('show', () => refresh('rearm'))",
    "island.on('restore', () => refresh('rearm'))",
    "['display-added', 'display-removed', 'display-metrics-changed']",
    "screen.on(eventName, () => refresh('rearm'))",
  ]) {
    assert.ok(mainSource.includes(hook), `main.js sem o gancho de rearme: ${hook}`);
  }
});

// Predicados puros do renderer. O index.html em sandbox não carrega state.js e a CSP não aceita
// script externo, então as regras ficam inline entre dois marcadores e este teste executa
// exatamente esse texto. O contexto vazio é a prova de pureza: um predicado que tocasse DOM,
// performance ou window lançaria ReferenceError.
const rendererSource = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const RULES_START = '// regras-do-gate:inicio';
const RULES_END = '// regras-do-gate:fim';

// Extrai o texto entre dois marcadores do index.html e o executa num contexto vazio, devolvendo só os
// nomes pedidos. Serve a todo bloco puro inline (regras do gate, mola).
function loadInlineBlock(startMarker, endMarker, exported) {
  for (const marker of [startMarker, endMarker]) {
    assert.equal(rendererSource.split(marker).length - 1, 1, `marcador ausente ou repetido no index.html: ${marker}`);
  }
  const start = rendererSource.indexOf(startMarker) + startMarker.length;
  const block = rendererSource.slice(start, rendererSource.indexOf(endMarker));
  return vm.runInNewContext(`${block}\n({ ${exported.join(', ')} })`, Object.create(null));
}

function loadRendererRules() {
  return loadInlineBlock(RULES_START, RULES_END, [
    'PERMISSION_ARM_MS', 'SETTLE_STABLE_MS', 'PRESS_DWELL_MS', 'WHEEL_SETTLE_MS', 'READ_TOLERANCE_PX',
    'settleStep', 'canPress', 'isValidRelease', 'isWheelSettled', 'canMarkRead', 'canArm',
  ]);
}

// O bloco das regras roda isolado acima; isto compila o script inteiro. Erro de sintaxe na cola ou
// const repetida fora do bloco derrubariam o renderer sem botões, e o main seguiria com o batimento
// no ar: o permission-hook esperaria um clique que não pode acontecer.
test('o script inline do index.html compila inteiro', () => {
  const scripts = [...rendererSource.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new vm.Script(scripts[0], { filename: 'index.html' }));
});

test('as constantes do bloco do renderer são as do fixture', () => {
  const rules = loadRendererRules();
  assert.equal(rules.PERMISSION_ARM_MS, PERMISSION_ARM_MS);
  assert.equal(rules.PERMISSION_ARM_MS, vectors.armMs);
  assert.equal(rules.SETTLE_STABLE_MS, vectors.settleStableMs);
  assert.equal(rules.PRESS_DWELL_MS, vectors.pressDwellMs);
  assert.equal(rules.WHEEL_SETTLE_MS, vectors.wheelSettleMs);
});

for (const vector of vectors.settleStep) {
  test(`settleStep: ${vector.name}`, () => {
    // O objeto nasce noutro realm (vm), então o deepEqual estrito pede uma cópia no realm do teste.
    assert.deepEqual({ ...loadRendererRules().settleStep(vector.input) }, vector.expect);
  });
}

for (const vector of vectors.canPress) {
  test(`canPress: ${vector.name}`, () => {
    assert.equal(loadRendererRules().canPress(vector.input), vector.expect);
  });
}

for (const vector of vectors.isValidRelease) {
  test(`isValidRelease: ${vector.name}`, () => {
    assert.equal(loadRendererRules().isValidRelease(vector.input), vector.expect);
  });
}

for (const vector of vectors.isWheelSettled) {
  test(`isWheelSettled: ${vector.name}`, () => {
    const { contentChangedAt, now } = vector.input;
    assert.equal(loadRendererRules().isWheelSettled(contentChangedAt, now), vector.expect);
  });
}

for (const vector of vectors.canMarkRead) {
  test(`canMarkRead: ${vector.name}`, () => {
    assert.equal(loadRendererRules().canMarkRead(vector.input), vector.expect);
  });
}

for (const vector of vectors.canArm) {
  test(`canArm: ${vector.name}`, () => {
    assert.equal(loadRendererRules().canArm(vector.input), vector.expect);
  });
}

for (const vector of vectors.effectiveOpacity) {
  test(`effectiveOpacity: ${vector.name}`, () => {
    const { preferredOpacity, hasPermission } = vector.input;
    assert.equal(effectiveOpacity(preferredOpacity, hasPermission), vector.expect);
  });
}

// Trava de regressão (texto exato): afrouxar a CSP é o jeito mais barato de quebrar o gate.
test('a CSP do renderer continua sem fonte de script nova', () => {
  assert.ok(rendererSource.includes(
    `content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'"`,
  ));
});

// O corpo MIT do mod é idêntico ao nosso LICENSE exceto a linha do titular (conferido por diff na
// pesquisa, blob 30ee69c1c1d2c6804f4e845e303f59d4ef1a96e6), então comparar com o nosso LICENSE
// prova o texto completo sem rede.
test('o aviso de terceiros credita o mod com o texto MIT completo', () => {
  const toLf = (text) => text.replace(/\r\n/g, '\n');
  const notices = toLf(fs.readFileSync(path.join(__dirname, 'THIRD_PARTY_NOTICES.md'), 'utf8'));
  const license = toLf(fs.readFileSync(path.join(__dirname, 'LICENSE'), 'utf8'));
  const mitBody = license.slice(license.indexOf('Permission is hereby granted')).trim();
  assert.ok(mitBody.startsWith('Permission is hereby granted'));
  assert.ok(notices.includes(mitBody), 'o corpo MIT do LICENSE não está inteiro no aviso');
  for (const expected of [
    'Copyright (c) 2026 devcode90',
    '1.4.0',
    'https://github.com/devcode90/Dynamic-Island-for-Windows',
    'Copyright (c) 2016-present Sven Greb',
  ]) {
    assert.ok(notices.includes(expected), `aviso sem: ${expected}`);
  }
});

test('SECURE_WEB_PREFERENCES é exatamente o trio seguro e está congelado', () => {
  assert.deepEqual({ ...SECURE_WEB_PREFERENCES }, { contextIsolation: true, sandbox: true, nodeIntegration: false });
  assert.ok(Object.isFrozen(SECURE_WEB_PREFERENCES));
});

// Trava de regressão por regex (frágil por natureza, barata): não prova comportamento. Ligar
// nodeIntegration desligaria o sandbox em silêncio, então o spread seguro fica por último.
test('webPreferences de main.js termina no spread seguro e não tem valor inseguro', () => {
  assert.match(mainSource, /webPreferences:\s*\{[^}]*\.\.\.SECURE_WEB_PREFERENCES,?\s*\}/);
  assert.equal(/nodeIntegration:\s*true|sandbox:\s*false|contextIsolation:\s*false/.test(mainSource), false);
});

// Trava do invariante I9 para as Fases 4 e 5: canal novo, inclusive um futuro canal de preferência,
// exige editar este teste de propósito. Os canais de posição (drag-end, reset-position) gravam
// valores calculados no main a partir de getBounds(), não uma preferência vinda do renderer.
function collectChannels(source, objectName) {
  const calls = [...source.matchAll(new RegExp(`${objectName}\\.(\\w+)\\(\\s*(['"\`])([^'"\`]+)\\2`, 'g'))];
  // Toda menção além da do require tem de ser uma chamada com canal literal: alias, renomear no
  // require, acesso por colchete ou canal numa variável ficam fora da contagem e quebram o teste.
  const mentions = (source.match(new RegExp(`\\b${objectName}\\b`, 'g')) || []).length;
  assert.equal(mentions, calls.length + 1, `${objectName} usado fora de uma chamada com canal literal`);
  assert.equal(new RegExp(`\\b${objectName}\\s*:`).test(source), false, `${objectName} renomeado no require`);
  return { methods: new Set(calls.map((call) => call[1])), channels: new Set(calls.map((call) => call[3])) };
}

const preloadSource = fs.readFileSync(path.join(__dirname, 'preload.js'), 'utf8');

// A IPC por webContents (webContents.ipc, evento ipc-message) recebe mensagens sem passar por ipcMain.
test('nenhum canal escapa pela IPC por webContents', () => {
  for (const source of [mainSource, preloadSource]) {
    assert.equal(/\.ipc\b|ipc-message/.test(source), false);
  }
});

const RENDERER_CHANNELS = [
  'island:state', 'island:cursor', 'island:capture', 'island:focus', 'island:decide', 'island:drag', 'island:drag-end',
  'island:reset-position', 'island:menu', 'island:select', 'island:wheel',
];
// Canais que o main envia e o renderer só escuta: o main não registra handler para eles.
const MAIN_TO_RENDERER_CHANNELS = ['island:state', 'island:cursor'];

test('o preload usa só send e on, nos onze canais conhecidos', () => {
  const { methods, channels } = collectChannels(preloadSource, 'ipcRenderer');
  assert.deepEqual([...methods].sort(), ['on', 'send']);
  assert.deepEqual([...channels].sort(), [...RENDERER_CHANNELS].sort());
});

// Trava de regressão (texto): arrastar um link ou arquivo para a ilha navegaria a janela, e a página
// nova herdaria o preload. Bloquear a navegação é a primeira camada; recusar remetente que não é o
// index.html no frame principal é a segunda, e vale para todo handler, não só para island:decide.
test('a janela da ilha não navega nem abre janela, e todo canal confere o remetente', () => {
  for (const guard of [
    "island.webContents.on('will-navigate', (event) => event.preventDefault())",
    "island.webContents.on('will-redirect', (event) => event.preventDefault())",
    "island.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))",
    'island.loadURL(ISLAND_URL)',
  ]) {
    assert.ok(mainSource.includes(guard), `main.js sem a proteção: ${guard}`);
  }
  assert.equal(mainSource.includes('loadFile('), false, 'a ilha carrega pela mesma URL que confere');
  assert.match(mainSource, /const islandOf = \(event\) => \{[^}]*isIslandSender\(/);
  const handlers = mainSource.split('ipcMain.on(').slice(1);
  assert.equal(handlers.length, 9);
  for (const handler of handlers) {
    const body = handler.slice(0, handler.indexOf('\n  });'));
    assert.match(body, /islandOf\(event\)/, `canal sem conferir o remetente: ${body.split(',')[0]}`);
  }
});

// Trava de regressão (texto): recusa silenciosa deixava Permitir e Negar travados para aquele pedido.
// O main responde a recusa pelo island:state (canal que já existe) e o renderer solta a trava local.
test('recusa do main destrava os botões sem o renderer reenviar a decisão', () => {
  const decide = mainSource.slice(mainSource.indexOf("ipcMain.on('island:decide'"));
  assert.match(decide, /if \(!verdict\.accept\) \{\s*sendState\(island\);\s*return;\s*\}/);
  assert.match(decide, /console\.error\('Não foi possível gravar a decisão[^\n]*\n\s*sendState\(island\);/);
  const onState = rendererSource.slice(rendererSource.indexOf('window.island.onState('));
  assert.match(onState, /^[^]*?current = next;\s*(\/\/[^\n]*\n\s*)*answeredPermissionId = null;/);
  assert.equal(rendererSource.split('window.island.decide(').length - 1, 1, 'a decisão sai de um só lugar: o clique');
});

// Trava de regressão (texto): medir #actions deixava passar botões que andam dentro dele (has-window).
// O assentamento mede os próprios botões, guarda onde armaram, e render e pointerdown rearmam se eles saíram dali.
test('o armamento acompanha o retângulo dos próprios botões', () => {
  assert.equal(rendererSource.includes('actions.getBoundingClientRect()'), false);
  assert.match(rendererSource, /function buttonsRect\(\) \{[^}]*allowButton\.getBoundingClientRect\(\)[^}]*denyButton\.getBoundingClientRect\(\)/);
  assert.match(rendererSource, /const rect = buttonsRect\(\);/);
  assert.match(rendererSource, /armedAt = now;\s*armedRect = rect;/);
  const moved = 'if (armed && !isSameRect(armedRect, buttonsRect())) restartArming();';
  assert.equal(rendererSource.split(moved).length - 1, 2, 'render e pointerdown conferem o retângulo armado');
  const pointerdown = rendererSource.slice(rendererSource.indexOf("button.addEventListener('pointerdown'"));
  assert.ok(pointerdown.indexOf(moved) < pointerdown.indexOf('canPress('), 'a conferência vem antes de canPress');
});

test('o main escuta só com ipcMain.on, nos nove canais do renderer', () => {
  const { methods, channels } = collectChannels(mainSource, 'ipcMain');
  assert.deepEqual([...methods], ['on']);
  assert.deepEqual(
    [...channels].sort(),
    RENDERER_CHANNELS.filter((channel) => !MAIN_TO_RENDERER_CHANNELS.includes(channel)).sort(),
  );
});

// Trava de regressão (texto): a captura do mouse nunca usa a opção forward (para sob janela elevada,
// UIPI) e só nasce de um booleano. Arraste e menu a seguram, e todo caminho que esconde ou ociosa a
// ilha a solta, senão a janela transparente de 520 × 410 engole cliques de outras janelas (T-04-06, T-04-08).
test('a captura vem só de um booleano, sem a opção forward, e o arraste e o menu a seguram', () => {
  assert.ok(mainSource.includes("ipcMain.on('island:capture', (event, capture) => {"));
  assert.ok(mainSource.includes("typeof capture !== 'boolean'"));
  assert.ok(mainSource.includes("if (capture && lastPickedState.state === 'idle') return;"), 'captura pedida com a ilha ociosa');
  assert.equal(/forward\s*:/.test(mainSource), false, 'main.js com a opção forward de setIgnoreMouseEvents');
  const bodyOf = (opening, closing = '\n}') => {
    assert.equal(mainSource.split(opening).length - 1, 1, `ausente ou repetido no main.js: ${opening}`);
    const rest = mainSource.slice(mainSource.indexOf(opening));
    return rest.slice(0, rest.indexOf(closing));
  };
  const apply = bodyOf('function applyCapture(');
  for (const needle of [
    'captureRequests.get(island) === true', 'dragStartPositions.has(island)', 'island === menuIsland',
    'island.setIgnoreMouseEvents(!capture);',
  ]) assert.ok(apply.includes(needle), `applyCapture sem: ${needle}`);
  const dragEnd = bodyOf("ipcMain.on('island:drag-end'", '\n  });');
  assert.ok(dragEnd.includes('applyCapture(island);'), 'o fim do arraste reaplica a captura');
  assert.ok(bodyOf("menu.on('menu-will-close'", '\n  });').includes('applyCapture('), 'o fim do menu reaplica a captura');
  assert.equal(mainSource.split('setInterval(cursorTick, CURSOR_TICK_MS)').length - 1, 1);
  const update = bodyOf('function updateCursorTick(');
  for (const needle of ["lastPickedState.state !== 'idle'", 'island.isVisible()', 'releaseCapture(']) {
    assert.ok(update.includes(needle), `updateCursorTick sem: ${needle}`);
  }
  const release = bodyOf('function releaseCapture(');
  assert.ok(release.includes('captureRequests.delete(island);') && release.includes('applyCapture(island);'));
  const hide = bodyOf("island.on('hide', () => {", '\n  });');
  assert.ok(hide.includes('releaseCapture(island);') && hide.includes('updateCursorTick();'), 'esconder solta a captura');
  assert.ok(bodyOf('function refresh(reason)').includes('updateCursorTick();'), 'o refresh religa e desliga o timer');
});

// Trava de regressão (texto): a âncora escolhe a posição padrão, a folga lateral (a mesma no clamp, no
// fitsWorkArea e no gate) e invalida os deslocamentos salvos, que eram relativos à âncora antiga (T-04-11, T-04-13).
test('a âncora escolhe a posição, a folga e zera os deslocamentos', () => {
  const bodyOf = (opening, closing = '\n}') => {
    assert.equal(mainSource.split(opening).length - 1, 1, `ausente ou repetido no main.js: ${opening}`);
    const rest = mainSource.slice(mainSource.indexOf(opening));
    return rest.slice(0, rest.indexOf(closing));
  };
  const anchored = 'anchorPosition(preferences.anchor, display.workArea, WINDOW_SIZE)';
  assert.ok(bodyOf("ipcMain.on('island:drag-end'", '\n  });').includes(`const standard = ${anchored};`), 'o arraste mede o deslocamento a partir da âncora');
  assert.ok(bodyOf("ipcMain.on('island:reset-position'", '\n  });').includes(`moveIsland(island, ${anchored}, display.workArea);`), 'o duplo clique volta à âncora');
  assert.ok(bodyOf('function moveIsland(').includes('horizontalSlackFor(preferences.anchor)'), 'o clamp usa a folga da âncora');
  assert.ok(bodyOf('function savedPosition(').includes('positionFromSavedOffset(display.workArea, WINDOW_SIZE, savedOffsets[display.id], preferences.anchor)'));
  const apply = bodyOf('function applyPreference(');
  // Trocar a âncora ou escolher de novo a que já está marcada zera: é o jeito do menu de voltar à posição padrão.
  assert.ok(apply.includes("JSON.stringify(next) === JSON.stringify(preferences) && key !== 'anchor') return;"), 'reescolher a âncora não sai cedo');
  assert.ok(apply.includes("if (key === 'anchor') {"), 'trocar ou reescolher a âncora zera');
  assert.ok(apply.includes('savedOffsets = {};') && apply.includes('persistSavedOffsets();'), 'zera e grava os deslocamentos');
  assert.ok(apply.indexOf('savedOffsets = {};') < apply.indexOf('preferences = next;'), 'zera antes de valer a âncora nova');
  const sync = apply.indexOf('syncIslands();');
  assert.ok(sync > apply.indexOf('writePreferences();') && sync < apply.indexOf("refresh('rearm');"), 'reposiciona antes de rearmar');
});

// Pedido do autor: clicar de novo na âncora marcada no menu leva a ilha à posição padrão, como o duplo clique.
// Roda o applyPreference do main.js de verdade, com os efeitos registrados.
test('escolher de novo a âncora marcada zera os deslocamentos, reposiciona e rearma; outra opção igual não faz nada', () => {
  const run = (key, value) => {
    const calls = [];
    const context = {
      normalizePreferences: require('./state').normalizePreferences,
      preferences: require('./state').normalizePreferences({ anchor: 'bottom-left' }),
      savedOffsets: { 1: { x: 0, y: 300, edge: 'top' }, 2: { x: 40, y: 0 } },
      persistSavedOffsets: () => calls.push('persist'),
      writePreferences: () => calls.push('write'),
      syncIslands: () => calls.push('sync'),
      refresh: (reason) => calls.push(`refresh:${reason}`),
    };
    vm.runInNewContext(`${mainFunctionBody('applyPreference')}\n}\napplyPreference(${JSON.stringify(key)}, ${JSON.stringify(value)});`, context);
    // JSON tira o protótipo do outro contexto do vm, que o deepEqual estrito recusaria.
    return { calls, savedOffsets: JSON.parse(JSON.stringify(context.savedOffsets)), anchor: context.preferences.anchor };
  };
  const reselected = run('anchor', 'bottom-left');
  assert.deepEqual(reselected.savedOffsets, {});
  assert.equal(reselected.anchor, 'bottom-left');
  assert.deepEqual(reselected.calls, ['persist', 'write', 'sync', 'refresh:rearm']);
  const changed = run('anchor', 'top-right');
  assert.deepEqual(changed.savedOffsets, {});
  assert.equal(changed.anchor, 'top-right');
  assert.deepEqual(changed.calls, ['persist', 'write', 'sync', 'refresh:rearm']);
  // outra preferência sem mudança segue sem efeito: não mexe na posição nem rearma
  const same = run('theme', require('./state').normalizePreferences({}).theme);
  assert.deepEqual(same.calls, []);
  assert.equal(Object.keys(same.savedOffsets).length, 2);
});

// Trava de regressão (texto): no modo de uma ilha só a troca de monitor nunca acontece com pedido na tela
// (o botão pararia sob o cursor) e sempre rearma; a ilha sobrando é destruída com a limpeza completa e o
// timer do cursor reavaliado (T-04-10).
test('uma ilha só nunca troca de monitor com pedido na tela e rearma ao trocar', () => {
  const bodyOf = (opening) => {
    assert.equal(mainSource.split(opening).length - 1, 1, `ausente ou repetido no main.js: ${opening}`);
    const rest = mainSource.slice(mainSource.indexOf(opening));
    return rest.slice(0, rest.indexOf('\n}'));
  };
  const sync = bodyOf('function syncIslands(');
  assert.ok(sync.includes('islandDisplays({'), 'syncIslands decide os monitores por islandDisplays');
  assert.ok(sync.includes('hasPermission: Boolean(lastPickedState.permission)'), 'o pedido na tela vem do estado do main');
  assert.ok(sync.includes('mode: preferences.islandMode'));
  const destroyAt = sync.indexOf('.destroy()');
  assert.ok(destroyAt >= 0, 'syncIslands destrói a ilha sobrando');
  const leftovers = sync.slice(sync.lastIndexOf('for (', destroyAt), destroyAt);
  for (const cleanup of ['dragStartPositions.delete(', 'captureRequests.delete(', 'nearIslands.delete(']) {
    assert.ok(leftovers.includes(cleanup), `a ilha destruída fica sem a limpeza: ${cleanup}`);
  }
  assert.ok(sync.indexOf('updateCursorTick();') > destroyAt, 'o timer do cursor é reavaliado depois de destruir');
  const tick = bodyOf('function cursorTick(');
  for (const needle of ["preferences.islandMode === 'cursor'", '!lastPickedState.permission', 'dragStartPositions.size === 0', "refresh('rearm');"]) {
    assert.ok(tick.includes(needle), `cursorTick sem: ${needle}`);
  }
});

// Trava de nomes (execução do texto): a casca Tauri do spike não pode ficar com um nome velho quando o
// preload muda. Roda os dois arquivos com um electron e um window de mentira e compara as chaves.
test('o shim da casca Tauri expõe os mesmos nomes do preload', () => {
  let exposed;
  const fakeElectron = {
    contextBridge: { exposeInMainWorld: (name, api) => { assert.equal(name, 'island'); exposed = api; } },
    ipcRenderer: {},
  };
  vm.runInNewContext(preloadSource, { require: () => fakeElectron });
  const shimWindow = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'spike/tauri/src-tauri/src/shim.js'), 'utf8'), { window: shimWindow });
  assert.deepEqual(Object.keys(shimWindow.island).sort(), Object.keys(exposed).sort());
});

// Travas da cola (texto): as regras puras têm vetores, mas a ligação dos argumentos que as chama
// não. Trocar um argumento (eco vindo do main, alvo vindo do eco, fato da janela fixo) passava na
// suíte. Lê o objeto literal da chamada, uma chave por linha, ignorando comentários e o fim de linha.
function objectArgument(source, opening) {
  assert.equal(source.split(opening).length - 1, 1, `chamada ausente ou repetida: ${opening}`);
  const start = source.indexOf(opening) + opening.length;
  const body = source.slice(start, start + source.slice(start).search(/\n\s*\}\)/));
  return body.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('//')).map((line) => {
    const entry = line.match(/^(\w+)(?::\s*(.+?))?,?$/);
    assert.ok(entry, `linha fora do formato chave: valor: ${line}`);
    return [entry[1], entry[2] ?? entry[1]];
  });
}

test('island:decide: o eco vem do renderer, o alvo e o relógio do main, os fatos da janela real', () => {
  assert.ok(mainSource.includes("ipcMain.on('island:decide', (event, behavior, pressedId) => {"));
  assert.deepEqual(objectArgument(mainSource, 'acceptDecision({'), [
    ['behavior', 'behavior'],
    ['echoedId', 'pressedId'],
    ['shownId', 'shown.id'],
    ['shownSince', 'shown.since'],
    ['now', 'performance.now()'],
    ['decidedId', 'decidedPermissionId'],
    ['windowVisible', 'island.isVisible() && !island.isMinimized()'],
    ['coveredByFullscreen', 'display ? fullscreenByDisplay.has(display.id) : true'],
    ['withinVisibleArea', 'fitsVisibleArea(island, display)'],
  ]);
  // O renderer manda o eco como o segundo argumento do preload; sem ele toda decisão seria recusada.
  assert.ok(preloadSource.includes("decide: (behavior, pressedId) => ipcRenderer.send('island:decide', behavior, pressedId),"));
});

test('island:decide grava o veredito antes de marcar o pedido como decidido', () => {
  const decide = mainSource.slice(mainSource.indexOf("ipcMain.on('island:decide'"));
  // Grava o id e o comportamento do veredito (nunca os do renderer) e só então marca: marcar antes
  // impediria tentar de novo se a gravação falhasse.
  assert.match(decide, /try \{\s*writeDecision\(verdict\.permissionId, verdict\.behavior\);\s*(\/\/[^\n]*\n\s*)*decidedPermissionId = verdict\.permissionId;/);
  const assignments = mainSource.match(/(?<![\w.])decidedPermissionId\s*=(?!=)/g) || [];
  assert.equal(assignments.length, 2, 'decidedPermissionId só muda na declaração e depois de gravar');
  assert.match(mainSource, /^let decidedPermissionId = null;/m);
});

test('refresh não engole o rearme e o estado enviado leva answeredId, armEpoch e as preferências', () => {
  for (const glue of [
    "nextShownPermission(shown, permissionId, performance.now(), reason === 'rearm')",
    'if (serialized === lastSent && nextShown.epoch === shown.epoch) return;',
    '{ ...lastPickedState, answeredId: decidedPermissionId, armEpoch: shown.epoch, preferences, fitsWorkArea, stageEdge }',
    // o lado do palco é o do arraste em curso, senão o salvo com a âncora
    'const stageEdge = drag ? drag.edge : stageEdgeOf(display && savedOffsets[display.id], preferences.anchor);',
    // a mesma conferência do gate (fitsVisibleArea), nunca uma mais frouxa
    'const fitsWorkArea = fitsVisibleArea(island, display);',
  ]) {
    assert.ok(mainSource.includes(glue), `main.js sem a cola: ${glue}`);
  }
});

// Ampliar o botão no hover (ou a pílula inteira) move o alvo sob o cursor: o clique a caminho cai
// no botão que cresceu. Só regras de hover ou dos botões; as animações de estado da pílula ficam.
test('botões e hover sem transform, scale, translate, rotate ou zoom', () => {
  const style = rendererSource.slice(rendererSource.indexOf('<style>'), rendererSource.indexOf('</style>'));
  const rules = [...style.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const guarded = rules.filter(([, selector]) => /button|#allow|#deny|#actions|:hover/.test(selector));
  assert.ok(guarded.some(([, selector]) => selector.includes('#actions button:hover')));
  for (const [, selector, body] of guarded) {
    assert.equal(/(?:^|[;\s])(?:transform|scale|translate|rotate|zoom)\s*:/.test(body), false, `regra que move o botão: ${selector.trim()}`);
  }
});

test('a roda sobre o bloco do pedido não vaza e não rola na janela depois da troca', () => {
  assert.match(rendererSource, /permissionBox\.addEventListener\('wheel', \(event\) => \{\s*event\.stopPropagation\(\);\s*if \(!isWheelSettled\(contentChangedAt, performance\.now\(\)\)\) event\.preventDefault\(\);\s*\}, \{ passive: false \}\);/);
});

test('o clique só decide com o press validado e ecoa o id capturado no pointerdown', () => {
  for (const glue of [
    'const valid = event.button === 0 && canPress({',
    'press = valid ? { behavior, id: current.permission.id, armToken } : null;',
  ]) {
    assert.ok(rendererSource.includes(glue), `index.html sem a cola: ${glue}`);
  }
  assert.deepEqual(objectArgument(rendererSource, 'if (!isValidRelease({'), [
    ['pressedBehavior', 'pressed?.behavior'],
    ['releasedBehavior', 'behavior'],
    ['pressedId', 'pressed?.id'],
    ['currentId', 'current.permission?.id'],
    ['armed', 'armed'],
    ['pressedArmToken', 'pressed?.armToken'],
    ['currentArmToken', 'armToken'],
  ]);
  const click = rendererSource.slice(rendererSource.indexOf('if (!isValidRelease({'));
  assert.match(click, /^[^]*?\}\)\) return;\s*answeredPermissionId = pressed\.id;\s*(\/\/[^\n]*\n\s*)*window\.island\.decide\(behavior, pressed\.id\);/);
});

test('render trava pelo answeredId e só libera Permitir lido; id ou época nova rearma', () => {
  for (const glue of [
    'const wasRead = readPermissionId === permission.id;',
    'const locked = !armed || permission.id === answeredPermissionId || permission.id === current.answeredId;',
    'denyButton.disabled = locked;',
    'allowButton.disabled = locked || !wasRead;',
  ]) {
    assert.ok(rendererSource.includes(glue), `index.html sem a cola: ${glue}`);
  }
  assert.match(rendererSource, /if \(epochChanged \|\| \(permissionId && permissionId !== previousPermissionId\)\) \{\s*lastArmEpoch = next\.armEpoch;\s*restartArming\(\);/);
});

// Palco maior que a área útil: o gate recusa toda decisão (isWithinWorkArea não muda), e o renderer
// só deixa de oferecer os botões. A trava só desabilita: nenhuma linha dela atribui disabled = false.
test('com o palco fora da área útil o renderer desabilita os botões e manda responder no terminal', () => {
  for (const glue of [
    'const cannotDecideHere = current.fitsWorkArea === false;',
    "const hintText = cannotDecideHere ? 'Responda no terminal' : 'Role até o fim para poder permitir';",
    'permissionHint.hidden = wasRead && !cannotDecideHere;',
    'if (cannotDecideHere) denyButton.disabled = allowButton.disabled = true;',
  ]) {
    assert.ok(rendererSource.includes(glue), `index.html sem a cola: ${glue}`);
  }
  const render = rendererSource.slice(rendererSource.indexOf('const cannotDecideHere'), rendererSource.indexOf('function render()'));
  assert.equal(/disabled\s*=\s*false/.test(render), false, 'a trava do palco não pode liberar botão');
});

// Travas de regressão (texto) das preferências visuais: o main só lê o arquivo, uma vez, sem
// vigiá-lo nem gravá-lo (a gravação, o menu e a migração são da Fase 4), e o renderer só aplica o
// que veio no payload. Canal novo para o renderer escolher preferência quebraria RENDERER_CHANNELS.
// A gravação passou a existir na Fase 4, só pelo menu nativo, e sempre por .tmp + rename.
test('o main lê as preferências uma vez, não as vigia e só as grava pelo menu, por .tmp e rename', () => {
  assert.ok(mainSource.includes('preferences = normalizePreferences(JSON.parse(text));'), 'main.js sem a leitura normalizada do preferences.json');
  // Leitura tolerante (D-07): teto de tamanho e quarentena com carimbo de tempo, que nunca sobrescreve outra.
  assert.ok(mainSource.includes('PREFERENCES_MAX_BYTES'), 'main.js sem o teto do arquivo de preferências');
  assert.ok(mainSource.includes('quarantinePath(PREFERENCES_FILE, Date.now())'), 'main.js sem a quarentena com carimbo');
  assert.equal(
    mainSource.includes('writeFileAtomic(positionsFile(), JSON.stringify(savedOffsets))'), true,
    'positions.json grava por .tmp + rename',
  );
  assert.equal(mainSource.includes('writeFileSync(positionsFile()'), false, 'main.js grava o positions.json direto');
  assert.equal(mainSource.split('loadPreferences()').length - 1, 2, 'loadPreferences: definição e uma só chamada');
  assert.equal(/\.watch(?:File)?\(/.test(mainSource), false, 'main.js vigia um arquivo');
  assert.equal(/writeFileSync\(\s*PREFERENCES_FILE/.test(mainSource), false, 'main.js grava o preferences.json direto');
  assert.equal(mainSource.split('writeFileAtomic(PREFERENCES_FILE').length - 1, 1, 'uma só gravação das preferências');
  assert.equal(mainSource.split('writePreferences()').length - 1, 2, 'writePreferences: definição e a chamada de applyPreference');
  const atomic = mainSource.slice(mainSource.indexOf('function writeFileAtomic('));
  const atomicBody = atomic.slice(0, atomic.indexOf('\n}'));
  assert.ok(atomicBody.includes('fs.writeFileSync(temporaryFile, text);'), 'grava o temporário');
  assert.ok(atomicBody.includes('fs.renameSync(temporaryFile, file);'), 'e renomeia para o arquivo final');
});

// Trava de regressão (texto): o menu abre sobre Permitir e Negar, e o clique que o fecha pode cair num
// botão, então abrir e fechar rearmam. O renderer só pede "abrir", sem argumentos, e um menu por vez.
test('o menu só abre por pedido sem argumentos, um por vez, e rearma ao abrir e ao fechar', () => {
  assert.ok(preloadSource.includes("openMenu: () => ipcRenderer.send('island:menu'),"));
  for (const glue of [
    "ipcMain.on('island:menu', (event) => {",
    'if (!island || menuIsland) return;',
    "menu.on('menu-will-show', () => refresh('rearm'));",
    'menu.popup({ window: island });',
  ]) {
    assert.ok(mainSource.includes(glue), `main.js sem a cola do menu: ${glue}`);
  }
  assert.equal(mainSource.split('Menu.buildFromTemplate(').length - 1, 1, 'um só menu montado');
  const willClose = mainSource.slice(mainSource.indexOf("menu.on('menu-will-close'"));
  const willCloseBody = willClose.slice(0, willClose.indexOf('\n  });'));
  assert.ok(willCloseBody.includes('menuIsland = null;') && willCloseBody.includes("refresh('rearm');"));
  const popupCall = 'menu.popup({ window: island });';
  const popup = mainSource.slice(mainSource.indexOf(popupCall) + popupCall.length);
  assert.match(mainSource.slice(0, mainSource.indexOf(popupCall)), /try \{[^}]*$/);
  assert.match(popup, /^[^}]*\}\s*catch \(error\) \{[^}]*menuIsland = null;/);
  assert.equal(rendererSource.split('window.island.openMenu()').length - 1, 1, 'o menu abre de um só lugar: o contextmenu');
});

// Trava de regressão (texto): preferência só muda pelo clique no menu nativo, nunca por mensagem.
test('nenhum handler de IPC muda preferência', () => {
  for (const handler of mainSource.split('ipcMain.on(').slice(1)) {
    const body = handler.slice(0, handler.indexOf('\n  });'));
    assert.equal(body.includes('applyPreference'), false, `canal que muda preferência: ${body.split(',')[0]}`);
  }
});

test('o renderer aplica as preferências do payload e rearma se mudaram com pedido na tela', () => {
  const onState = rendererSource.slice(rendererSource.indexOf('window.island.onState('));
  assert.ok(onState.indexOf('answeredPermissionId = null;') >= 0);
  assert.ok(
    onState.indexOf('applyPreferences(next.preferences, next.stageEdge);') > onState.indexOf('answeredPermissionId = null;'),
    'applyPreferences vem depois de soltar a trava local',
  );
  const apply = rendererSource.slice(rendererSource.indexOf('function applyPreferences('));
  assert.ok(apply.slice(0, apply.indexOf('\n  }\n')).includes('if (changed && current.permission) restartArming();'));
});

// Bloco puro da mola: inline como o das regras do gate, extraído e executado num contexto
// vazio. A prova de comportamento é a simulação da própria função que a ilha roda.
const SPRING_START = '// mola:inicio';
const SPRING_END = '// mola:fim';

function loadSpringRules() {
  return loadInlineBlock(SPRING_START, SPRING_END, [
    'SPRING_STEP_MS', 'SPRING_MAX_FRAME_MS', 'SPRING_GROW', 'SPRING_SHRINK', 'SPRING_NEUTRAL', 'SPRING_STYLE_FACTORS',
    'REST_DISTANCE_PX', 'REST_SPEED_PX_S', 'springParams', 'retargetSpring', 'springStep', 'snapSpring', 'isSpringAtRest',
    'NUDGE_OFFSET_PX', 'NUDGE_MIN_INTERVAL_MS', 'HOVER_SCALE', 'NUDGE_STATES', 'HOVER_SCALE_STATES',
    'SCALE_REST_DISTANCE', 'SCALE_REST_SPEED', 'shouldNudge', 'hoverScaleTarget',
  ]);
}

const spring = loadSpringRules();

// Mola parada em `from` que recebe o alvo `to`: é o que a ilha faz ao crescer ou encolher.
function movingSpring(from, to) {
  const resting = {
    position: from, velocity: 0, target: from, direction: 'grow',
    restDistance: spring.REST_DISTANCE_PX, restSpeed: spring.REST_SPEED_PX_S,
  };
  return spring.retargetSpring(resting, to);
}

// Roda springStep em quadros de `frameMs` até a mola repousar (limite de 10 s simulados).
function simulate(rules, from, to, style, speed, frameMs = 16) {
  let current = movingSpring(from, to);
  let peak = from;
  let min = from;
  let elapsedMs = 0;
  while (!rules.isSpringAtRest(current) && elapsedMs < 10_000) {
    current = rules.springStep(current, frameMs, style, speed);
    peak = Math.max(peak, current.position);
    min = Math.min(min, current.position);
    elapsedMs += frameMs;
  }
  return { peak, min, elapsedMs };
}

const plain = (value) => ({ ...value });

test('springParams: valores do mod, fator de estilo e encolher no mínimo crítico', () => {
  assert.deepEqual(plain(spring.springParams('grow', 'default')), { stiffness: 380, damping: 26 });
  assert.deepEqual(plain(spring.springParams('grow', 'bouncy')), { stiffness: 380 * 1.1, damping: 26 * 0.7 });
  assert.deepEqual(plain(spring.springParams('grow', 'estilo-inventado')), { stiffness: 380, damping: 26 });
  assert.deepEqual(plain(spring.springParams('grow', 'toString')), { stiffness: 380, damping: 26 });
  assert.deepEqual(plain(spring.springParams('shrink', 'default')), { stiffness: 200, damping: 2 * Math.sqrt(200) });
  // 200 × 1,1 não é exatamente 220 em ponto flutuante: o esperado repete a conta do mod.
  assert.deepEqual(plain(spring.springParams('shrink', 'bouncy')), { stiffness: 200 * 1.1, damping: 2 * Math.sqrt(200 * 1.1) });
  // Snappy já está acima do crítico (35 > 34,64): o fator do mod fica.
  assert.deepEqual(plain(spring.springParams('shrink', 'snappy')), { stiffness: 300, damping: 35 });
  assert.deepEqual(plain(spring.springParams('neutral', 'bouncy')), { stiffness: 280, damping: 24 });
  assert.deepEqual(plain(spring.springParams('sideways', 'snappy')), { stiffness: 280, damping: 24 });
  for (const style of ANIMATION_STYLES) {
    const { stiffness, damping } = spring.springParams('shrink', style);
    assert.ok(damping >= 2 * Math.sqrt(stiffness), `encolher ${style} abaixo do crítico`);
  }
});

test('os estilos da mola são os de ANIMATION_STYLES e o padrão é um deles', () => {
  assert.deepEqual(Object.keys(spring.SPRING_STYLE_FACTORS).sort(), [...ANIMATION_STYLES].sort());
  assert.ok(Object.hasOwn(spring.SPRING_STYLE_FACTORS, DEFAULT_PREFERENCES.animationStyle));
});

test('mola Padrão ao crescer passa do alvo entre 4% e 8% e assenta em menos de 2 s', () => {
  const { peak, elapsedMs } = simulate(spring, 200, 400, 'default', 1);
  const overshoot = (peak - 400) / 200;
  assert.ok(overshoot >= 0.04 && overshoot <= 0.08, `passagem ${overshoot}`);
  assert.ok(elapsedMs < 2000, `assentou em ${elapsedMs} ms`);
});

test('mola ao encolher não balança em nenhum estilo nem velocidade', () => {
  for (const style of ANIMATION_STYLES) {
    for (const speed of [0.5, 1, 2]) {
      const { min, elapsedMs } = simulate(spring, 400, 200, style, speed);
      assert.ok((200 - min) / 200 < 0.005, `${style} a ${speed}×: passou ${(200 - min) / 200}`);
      assert.ok(elapsedMs < 3000, `${style} a ${speed}×: assentou em ${elapsedMs} ms`);
    }
  }
});

test('os quatro estilos ao crescer são distinguíveis', () => {
  const overshoot = (style) => (simulate(spring, 200, 400, style, 1).peak - 400) / 200;
  assert.ok(overshoot('smooth') < 0.01, `smooth ${overshoot('smooth')}`);
  assert.ok(overshoot('default') >= 0.04 && overshoot('default') <= 0.08);
  assert.ok(overshoot('bouncy') > 0.15, `bouncy ${overshoot('bouncy')}`);
  assert.ok(simulate(spring, 200, 400, 'snappy', 1).elapsedMs < simulate(spring, 200, 400, 'default', 1).elapsedMs);
});

test('a velocidade escala o tempo e preserva o pico', () => {
  const slow = simulate(spring, 200, 400, 'default', 0.5);
  const normal = simulate(spring, 200, 400, 'default', 1);
  const fast = simulate(spring, 200, 400, 'default', 2);
  assert.ok(fast.elapsedMs / normal.elapsedMs >= 0.4 && fast.elapsedMs / normal.elapsedMs <= 0.6, `2×: ${fast.elapsedMs / normal.elapsedMs}`);
  assert.ok(slow.elapsedMs / normal.elapsedMs >= 1.8 && slow.elapsedMs / normal.elapsedMs <= 2.2, `0,5×: ${slow.elapsedMs / normal.elapsedMs}`);
  assert.ok(Math.abs(fast.peak - normal.peak) <= 2, 'pico a 2× difere do de 1×');
  assert.ok(Math.abs(slow.peak - normal.peak) <= 2, 'pico a 0,5× difere do de 1×');
});

test('retargetSpring mantém posição e velocidade e só recalcula a direção', () => {
  const moving = { position: 300, velocity: 150, target: 400, direction: 'grow', restDistance: 0.05, restSpeed: 0.5 };
  assert.deepEqual(plain(spring.retargetSpring(moving, 250)), { ...moving, target: 250, direction: 'shrink' });
  assert.deepEqual(plain(spring.retargetSpring({ ...moving, direction: 'shrink' }, 500)), { ...moving, target: 500, direction: 'grow' });
  // Alvo igual à posição atual: a direção anterior continua.
  assert.deepEqual(plain(spring.retargetSpring(moving, 300)), { ...moving, target: 300 });
  assert.deepEqual(plain(spring.retargetSpring({ ...moving, direction: 'neutral' }, 250)), { ...moving, target: 250, direction: 'neutral' });
  // Alvo inválido ou igual ao atual: sem mudança, e a entrada não é mutada.
  assert.deepEqual(plain(spring.retargetSpring(moving, NaN)), moving);
  assert.deepEqual(plain(spring.retargetSpring(moving, 400)), moving);
  assert.deepEqual(plain(moving), { position: 300, velocity: 150, target: 400, direction: 'grow', restDistance: 0.05, restSpeed: 0.5 });
});

test('springStep: quadro atrasado é limitado, entrada inválida não anda e nunca devolve NaN', () => {
  const moving = movingSpring(200, 400);
  const warm = spring.springStep(moving, 16, 'default', 1);
  assert.deepEqual(plain(spring.springStep(warm, 1000, 'default', 1)), plain(spring.springStep(warm, 50, 'default', 1)));
  for (const frameMs of [NaN, -5, Infinity, undefined]) {
    assert.deepEqual(plain(spring.springStep(warm, frameMs, 'default', 1)), plain(warm), `frameMs ${String(frameMs)}`);
  }
  for (const speed of [NaN, 0, -1, undefined, '2']) {
    assert.deepEqual(plain(spring.springStep(warm, 16, 'default', speed)), plain(spring.springStep(warm, 16, 'default', 1)), `speed ${String(speed)}`);
  }
  for (const broken of [
    { ...warm, position: NaN }, { ...warm, velocity: NaN }, { ...warm, target: NaN }, { ...warm, position: Infinity },
  ]) {
    const result = spring.springStep(broken, 16, 'default', 1);
    for (const field of ['position', 'velocity', 'target']) assert.ok(Number.isFinite(result[field]), `${field} não finito`);
    assert.equal(result.velocity, 0);
    assert.equal(spring.isSpringAtRest(result), true);
  }
  assert.deepEqual(plain(spring.springStep({ ...warm, position: NaN, target: 400 }, 16, 'default', 1)), { ...warm, position: 400, velocity: 0, target: 400 });
  // A entrada pode estar congelada: springStep devolve cópia.
  assert.doesNotThrow(() => spring.springStep(Object.freeze({ ...warm }), 16, 'default', 1));
});

test('springStep assenta exatamente no alvo, sem velocidade', () => {
  let current = movingSpring(200, 400);
  for (let frame = 0; frame < 1000 && !spring.isSpringAtRest(current); frame += 1) current = spring.springStep(current, 16, 'default', 1);
  assert.equal(current.position, 400);
  assert.equal(current.velocity, 0);
  assert.equal(spring.isSpringAtRest(current), true);
});

test('snapSpring leva ao alvo parada e isSpringAtRest só vale com posição no alvo e velocidade zero', () => {
  const snapped = spring.snapSpring(movingSpring(200, 400));
  assert.equal(snapped.position, 400);
  assert.equal(snapped.velocity, 0);
  assert.equal(spring.isSpringAtRest(snapped), true);
  assert.equal(spring.isSpringAtRest({ ...snapped, position: 399.99 }), false);
  assert.equal(spring.isSpringAtRest({ ...snapped, velocity: 0.001 }), false);
  assert.equal(spring.isSpringAtRest(movingSpring(200, 400)), false);
});

// Travas da cola das molas de tamanho (texto): a física tem simulação, mas a ligação dela à tela não.
// Aqui se garante que o laço só abre com algo em movimento, que o alvo vem do layout medido, que os
// botões só armam com as molas paradas e que movimento reduzido e janela escondida pulam a animação.
const rendererLf = rendererSource.replace(/\r\n/g, '\n');

// Corpo de uma função do renderer: do `function nome(` até o fecha-chaves recuado de 2 espaços.
function functionBody(name) {
  const start = rendererLf.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `função ausente: ${name}`);
  return rendererLf.slice(start, rendererLf.indexOf('\n  }\n', start));
}

test('o tamanho da pílula sai da transição CSS: a regra base e a ociosa não animam width, height nem transform', () => {
  const base = rendererLf.match(/\n\s*#pill \{([^}]*)\}/)[1];
  assert.equal(/transition:[^;]*\b(?:width|height|transform)\b/.test(base), false, 'a transição base ainda anima o tamanho');
  const idle = rendererLf.match(/#pill\[data-state="idle"\] \{([^}]*)\}/)[1];
  assert.ok(idle.includes('scale: .6;') && idle.includes('translate: 0 -12px;'), 'o idle usa as propriedades individuais');
  assert.equal(/\btransform\s*:/.test(idle), false, 'o idle não pode disputar o transform com as molas');
  assert.equal(rendererLf.includes('interpolate-size'), false);
});

test('o laço das molas só abre com algo em movimento e movimento reduzido ou janela escondida pulam ao alvo', () => {
  const body = functionBody('startSpringLoop');
  const guard = 'if (springLoopRunning || allSpringsAtRest()) return;';
  assert.equal(rendererLf.split(guard).length - 1, 1);
  const skip = body.indexOf('if (reducedMotion.matches || document.hidden) {');
  assert.ok(skip >= 0 && skip < body.indexOf(guard), 'o salto direto vem antes do laço');
  assert.match(body.slice(skip, body.indexOf(guard)), /snapAllSprings\(\);\s*return;/);
  assert.match(body, /requestAnimationFrame\(springFrame\)/);
  assert.match(rendererLf, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
  assert.match(rendererLf, /reducedMotion\.addEventListener\('change', \(\) => \{\s*if \(reducedMotion\.matches\) snapAllSprings\(\);\s*\}\);/);
  assert.ok(rendererLf.includes("document.addEventListener('visibilitychange', () => { if (document.hidden) snapAllSprings(); });"));
  // O listener que grava data-hidden e o que rearma continuam, cada um no seu lugar.
  assert.equal(rendererLf.split("addEventListener('visibilitychange'").length - 1, 3);
});

test('o quadro da mola lê estilo e velocidade das preferências e para quando tudo repousa', () => {
  const body = functionBody('springFrame');
  assert.match(body, /current\.preferences/);
  assert.match(body, /springStep\(/);
  assert.match(body, /if \(allSpringsAtRest\(\)\) \{\s*springLoopRunning = false;\s*return;\s*\}/);
});

test('render mede o alvo no DOM com o conteúdo final e liga as molas', () => {
  const body = functionBody('render');
  assert.match(body, /renderContent\(\);/);
  assert.match(body, /setSizeTarget\(measurePillTarget\(\), !pillVisible\);/);
  assert.match(body, /startSpringLoop\(\);/);
  assert.match(body, /current\.state === 'idle'[^]*?snapAllSprings\(\);/);
  const measure = functionBody('measurePillTarget');
  assert.ok(measure.includes('pill.offsetWidth') && measure.includes('pill.offsetHeight'), 'o alvo é o tamanho de layout');
  assert.match(rendererLf, /--content-width/);
});

test('os botões só armam com o retângulo assentado e todas as molas paradas', () => {
  const wait = functionBody('waitUntilSettled');
  assert.ok(wait.includes('if (canArm({ settled: step.settled, springsAtRest: allSpringsAtRest() })) {'));
  assert.equal(wait.includes('if (step.settled) {'), false, 'armar só pelo retângulo deixa botão recortado armar');
  assert.match(wait, /armed = true;\s*armedAt = now;\s*armedRect = rect;\s*render\(\);\s*return;/);
});

// Nudge e ampliação no hover: as duas decisões são puras e a tabela de casos é a
// prova de que nunca valem com pedido na tela (SEG-03) nem com movimento reduzido.
test('nudge e hover: as constantes são as do mod', () => {
  assert.equal(spring.NUDGE_OFFSET_PX, -6);
  assert.equal(spring.NUDGE_MIN_INTERVAL_MS, 450);
  assert.equal(spring.HOVER_SCALE, 1.025);
  assert.deepEqual([...spring.NUDGE_STATES], ['running', 'waiting', 'done']);
  assert.deepEqual([...spring.HOVER_SCALE_STATES], ['running', 'waiting']);
});

const NUDGE_BASE = {
  previousState: 'running', nextState: 'waiting', hasPermission: false, reducedMotion: false, lastNudgeAt: null, now: 1000,
};

test('shouldNudge: só na troca entre running, waiting e done, sem pedido e sem movimento reduzido', () => {
  const nudge = (change) => spring.shouldNudge({ ...NUDGE_BASE, ...change });
  assert.equal(nudge({}), true);
  assert.equal(nudge({ previousState: 'idle' }), false, 'vindo de idle é a primeira exibição');
  assert.equal(nudge({ nextState: 'idle' }), false);
  assert.equal(nudge({ nextState: 'running' }), false, 'mesmo estado');
  assert.equal(nudge({ hasPermission: true }), false);
  assert.equal(nudge({ hasPermission: undefined }), false);
  assert.equal(nudge({ reducedMotion: true }), false);
  assert.equal(nudge({ reducedMotion: undefined }), false);
  assert.equal(nudge({ nextState: 'pensando' }), false);
  assert.equal(nudge({ previousState: 'pensando' }), false);
  assert.equal(nudge({ lastNudgeAt: 1000, now: 1449 }), false);
  assert.equal(nudge({ lastNudgeAt: 1000, now: 1450 }), true);
  assert.equal(nudge({ lastNudgeAt: 1000, now: 900 }), false, 'relógio para trás');
  assert.equal(nudge({ lastNudgeAt: NaN }), false);
  assert.equal(nudge({ now: NaN }), false);
  assert.equal(nudge({ now: undefined }), false);
  assert.equal(spring.shouldNudge(null), false);
  assert.equal(spring.shouldNudge(undefined), false);
});

test('hoverScaleTarget: só em Trabalhando e Precisa de você, com o cursor, sem pedido e sem movimento reduzido', () => {
  const base = { hovering: true, hasPermission: false, reducedMotion: false, state: 'running' };
  const target = (change) => spring.hoverScaleTarget({ ...base, ...change });
  assert.equal(target({}), spring.HOVER_SCALE);
  assert.equal(target({ state: 'waiting' }), spring.HOVER_SCALE);
  assert.equal(target({ state: 'done' }), 1, 'o Abrir compacto fica parado sob o mouse');
  assert.equal(target({ state: 'idle' }), 1);
  assert.equal(target({ state: undefined }), 1);
  assert.equal(target({ hasPermission: true }), 1);
  assert.equal(target({ hasPermission: undefined }), 1);
  assert.equal(target({ reducedMotion: true }), 1);
  assert.equal(target({ hovering: false }), 1);
  assert.equal(target({ hovering: 'true' }), 1);
  assert.equal(spring.hoverScaleTarget(null), 1);
  assert.equal(spring.hoverScaleTarget(undefined), 1);
});

// Mola neutra (nudge e escala) parada em `from` que recebe o alvo `to`, com os limiares de cada uma.
function neutralSpring(from, to, restDistance, restSpeed) {
  return spring.retargetSpring(
    { position: from, velocity: 0, target: from, direction: 'neutral', restDistance, restSpeed },
    to,
  );
}

function simulateNeutral(start, style = 'default', speed = 1, frameMs = 16) {
  let current = start;
  let peak = current.position;
  let elapsedMs = 0;
  while (!spring.isSpringAtRest(current) && elapsedMs < 10_000) {
    current = spring.springStep(current, frameMs, style, speed);
    peak = Math.max(peak, current.position);
    elapsedMs += frameMs;
  }
  return { peak, elapsedMs, final: current };
}

test('o nudge volta a 0 em menos de 1 s com rebote menor que 1 px', () => {
  const { peak, elapsedMs } = simulateNeutral(neutralSpring(spring.NUDGE_OFFSET_PX, 0, spring.REST_DISTANCE_PX, spring.REST_SPEED_PX_S));
  assert.ok(peak < 1, `rebote de ${peak} px acima de 0`);
  assert.ok(elapsedMs < 1000, `assentou em ${elapsedMs} ms`);
});

test('a escala do hover assenta exatamente em HOVER_SCALE em menos de 1 s', () => {
  const { final, elapsedMs } = simulateNeutral(neutralSpring(1, spring.HOVER_SCALE, spring.SCALE_REST_DISTANCE, spring.SCALE_REST_SPEED));
  assert.equal(final.position, spring.HOVER_SCALE);
  assert.ok(elapsedMs < 1000, `assentou em ${elapsedMs} ms`);
});

test('a cola liga o nudge e o hover às molas neutras, nunca com pedido na tela', () => {
  const onState = rendererLf.slice(rendererLf.indexOf('window.island.onState('));
  const call = onState.indexOf('shouldNudge({');
  assert.ok(call >= 0 && call < onState.indexOf('current = next;'), 'o nudge decide antes de o estado novo virar o atual');
  assert.deepEqual(objectArgument(rendererLf, 'shouldNudge({'), [
    ['previousState', 'current.state'],
    ['nextState', 'next.state'],
    ['hasPermission', 'Boolean(next.permission)'],
    ['reducedMotion', 'reducedMotion.matches'],
    ['lastNudgeAt', 'lastNudgeAt'],
    ['now', 'stateChangedAt'],
  ]);
  assert.ok(onState.includes('springs.nudge = { ...springs.nudge, position: NUDGE_OFFSET_PX, velocity: 0, target: 0 };'));
  assert.ok(onState.includes('lastNudgeAt = stateChangedAt;'));
  assert.deepEqual(objectArgument(rendererLf, 'hoverScaleTarget({'), [
    ['hovering', 'hovering'],
    ['hasPermission', 'Boolean(current.permission)'],
    ['reducedMotion', 'reducedMotion.matches'],
    ['state', 'current.state'],
  ]);
  const render = functionBody('render');
  assert.ok(render.includes('springs.scale = retargetSpring(springs.scale, hoverScaleTarget({'));
  assert.ok(render.indexOf('hoverScaleTarget({') < render.indexOf("current.state === 'idle'"), 'o alvo da escala vem antes do ramo do idle');
  assert.match(rendererLf, /const springs = \{\s*nudge: \{[^}]*direction: 'neutral'[^}]*\},\s*scale: \{[^}]*direction: 'neutral'[^}]*SCALE_REST_DISTANCE[^}]*\},\s*\};/);
  assert.match(functionBody('applySprings'), /pill\.style\.transform = `translateY\(\$\{springs\.nudge\.position\}px\) scale\(\$\{springs\.scale\.position\}\)`;/);
  assert.match(rendererLf, /#pill \{[^}]*transform-origin: 50% 0;/);
});

// Palco fixo: a janela nunca muda de tamanho durante a animação, então ela tem de caber o pico
// das molas no pior caso. As medidas da pílula saem do CSS do próprio index.html: um número estimado
// à mão envelheceria calado quando uma regra mudasse.
const styleRules = rendererLf.slice(rendererLf.indexOf('<style>'), rendererLf.indexOf('</style>')).replace(/\/\*[^]*?\*\//g, '');

function cssDeclarations(selector) {
  const found = [...styleRules.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, foundSelector]) => foundSelector.trim() === selector);
  assert.ok(found.length > 0, `regra ausente no CSS do index.html: ${selector}`);
  const entries = found.flatMap(([, , body]) => body.split(';').map((entry) => entry.trim()).filter(Boolean).map((entry) => {
    const colon = entry.indexOf(':');
    return [entry.slice(0, colon).trim(), entry.slice(colon + 1).trim()];
  }));
  return Object.fromEntries(entries);
}

function cssPixels(value, what) {
  const match = /^(-?\d+(?:\.\d+)?)px$/.exec(String(value).trim());
  assert.ok(match, `${what}: esperava um valor em px, veio ${value}`);
  return Number(match[1]);
}

// Cima e baixo do atalho `padding` (1 a 4 valores).
function verticalPadding(value, what) {
  const parts = String(value).trim().split(/\s+/).map((part) => cssPixels(part, what));
  return parts[0] + (parts[2] ?? parts[0]);
}

// Tamanho da fonte e altura de linha (multiplicador) do atalho `font: 15px/1.3 …`.
function fontMetrics(value, what) {
  const match = /^(\d+(?:\.\d+)?)px\/(\d+(?:\.\d+)?)/.exec(String(value).trim());
  assert.ok(match, `${what}: esperava font: <px>/<altura de linha>, veio ${value}`);
  return { size: Number(match[1]), lineHeight: Number(match[2]) };
}

const lineHeightOfBody = fontMetrics(cssDeclarations('body').font, 'font do body').lineHeight;
const textLine = (selector) => cssPixels(cssDeclarations(selector)['font-size'], `font-size de ${selector}`) * lineHeightOfBody;

// Largura útil do rótulo da ferramenta: a pílula expandida menos o padding dela e o do bloco de pedido.
function horizontalPadding(value, what) {
  // O "0" sem unidade é válido no atalho (`padding: 0 17px`); o resto precisa estar em px.
  const parts = String(value).trim().split(/\s+/).map((part) => (part === '0' ? 0 : cssPixels(part, what)));
  return (parts[1] ?? parts[0]) + (parts[3] ?? parts[1] ?? parts[0]);
}
// Largura média de um caractere do rótulo (negrito, sem serifa), em múltiplos do tamanho da fonte.
// Suposição: 0,6 cobre nome misto com sublinhados; um nome de 100 'W' passaria disso e teria uma linha a mais.
const TOOL_CHAR_WIDTH_EM = 0.6;

// Regra que reserva a faixa da coluna de sessões na expandida: com pontos visíveis ou com pedido na tela.
const SESSIONS_GUTTER_RULE = '#pill.expanded:is(.has-permission, :has(> #sessions:not([hidden])))';

// Linhas que o rótulo da ferramenta ocupa no pior caso: PERMISSION_TOOL_LIMIT caracteres. O modelo
// só vale porque o rótulo quebra em qualquer ponto (overflow-wrap: anywhere): sem isso um nome sem
// espaço, como mcp__servidor__ferramenta, passaria da caixa e seria cortado.
function toolLabelLines() {
  assert.equal(cssDeclarations('#permission-tool')['overflow-wrap'], 'anywhere', 'o rótulo da ferramenta precisa quebrar em qualquer ponto');
  const expanded = cssDeclarations('#pill.expanded');
  // A expandida pode ter respiro lateral próprio (padding-inline), maior que o da compacta. Com pedido na tela
  // o lado direito é sempre a faixa da coluna de sessões (SESSIONS_GUTTER_RULE).
  const pillPadding = (expanded['padding-inline']
    ? cssPixels(expanded['padding-inline'], 'padding-inline da expandida')
    : horizontalPadding(cssDeclarations('#pill').padding, 'padding de #pill') / 2)
    + cssPixels(cssDeclarations(SESSIONS_GUTTER_RULE)['padding-right'], 'faixa da coluna de sessões');
  const labelWidth = cssPixels(expanded.width, 'largura da expandida') - pillPadding
    - horizontalPadding(cssDeclarations('#permission').padding, 'padding de #permission');
  const fontSize = cssPixels(cssDeclarations('#permission-tool')['font-size'], 'font-size de #permission-tool');
  // O cabeçalho é "projeto · ferramenta": o projeto ocupa no máximo o max-width dele (corta com reticências)
  // e o separador " · " conta três caracteres. Com fila, o "N de M" flutua à direita na mesma altura: no
  // pior caso "99 de 99" (8 caracteres) mais a margem dele tiram essa largura da linha.
  const projectWidth = cssPixels(cssDeclarations('#permission-project')['max-width'], 'max-width de #permission-project');
  const queueWidth = 8 * TOOL_CHAR_WIDTH_EM * fontSize + cssPixels(cssDeclarations('#permission-queue')['margin-left'], 'margin-left de #permission-queue');
  return Math.ceil((PERMISSION_TOOL_LIMIT * TOOL_CHAR_WIDTH_EM * fontSize + projectWidth + 3 * TOOL_CHAR_WIDTH_EM * fontSize + queueWidth) / labelWidth);
}

// Altura da pílula com o pior pedido, somada das regras do CSS (hoje 46 + 15,6 + 194,2 + 40,9 + 16 ≈ 312,7):
//   barra (#bar) ........................ 46
//   detalhe (#detail): 1 linha de 12 px .. 12 × 1,3 = 15,6 (com pedido na tela, #pill.has-permission #detail)
//   pedido (#permission) ................ margem 8 + padding 16 + título (3 linhas de 11 × 1,3, + 3) + texto com
//                                         max-height 105 + dica (5 + 11 × 1,3) = 194,2
//   ações (#actions) .................... margem 8 + botão (13 × 1,3 + 8 × 2) = 40,9
//   respiro de baixo (has-permission) ... 16
function pillMaxHeight() {
  const bar = cssPixels(cssDeclarations('#bar').height, 'altura de #bar');
  const detail = textLine('#detail') * Number(cssDeclarations('#pill.has-permission #detail')['-webkit-line-clamp']);
  const permission = cssDeclarations('#permission');
  const tool = cssDeclarations('#permission-tool');
  const hint = cssDeclarations('#permission-hint');
  const permissionHeight = cssPixels(permission['margin-top'], 'margin-top de #permission')
    + verticalPadding(permission.padding, 'padding de #permission')
    + textLine('#permission-tool') * toolLabelLines() + cssPixels(tool['margin-bottom'], 'margin-bottom de #permission-tool')
    + cssPixels(cssDeclarations('#permission-text')['max-height'], 'max-height de #permission-text')
    + cssPixels(hint['margin-top'], 'margin-top de #permission-hint') + textLine('#permission-hint');
  const button = cssDeclarations('#actions button');
  const actions = cssPixels(cssDeclarations('#actions')['margin-top'], 'margin-top de #actions')
    + textLine('#actions button') + verticalPadding(button.padding, 'padding de #actions button');
  const bottom = cssPixels(cssDeclarations('#pill.expanded.has-permission')['padding-bottom'], 'padding-bottom do pedido');
  return bar + detail + permissionHeight + actions + bottom;
}

const expandedWidth = cssPixels(cssDeclarations('#pill.expanded').width, 'largura da expandida');
const windowHeight = cssPixels(cssDeclarations('#pill.expanded.has-window').height, 'altura com a janela');
// O respiro do topo é o maior --stage-top declarado: o notch o zera, as outras formas usam o do :root.
const stageTop = Math.max(...[...styleRules.matchAll(/--stage-top:\s*(\d+(?:\.\d+)?)px/g)].map((match) => Number(match[1])));

// Abaixo da menor pílula compacta (~137×46): conservador, porque quanto maior a viagem, maior a passagem.
const PILL_MIN = { width: 120, height: 36 };
// Sombra estática: espalhamento de 14 px mais deslocamento de 5 px, arredondado para cima.
const SHADOW_MARGIN_PX = 20;
// Alcance da sombra para cima: desfoque de 14 px menos o deslocamento de 5 px (D-21). Na âncora de baixo a
// pílula encosta na base do palco e a sombra de cima é a que pode ser recortada.
const SHADOW_TOP_REACH_PX = 9;

// Maior posição que a mola de `from` a `to` alcança, em dois casos: (a) crescer de `from` até `to` e
// (b) encolher de `to` até `from` com um alvo novo (`to`) em cada quadro de 16 ms do encolhimento,
// que é o pior caso de uma pílula interrompida.
function worstPeak(rules, from, to, style, speed, frameMs = 16) {
  const settle = (start) => {
    let current = start;
    let peak = current.position;
    for (let elapsed = 0; !rules.isSpringAtRest(current) && elapsed < 10_000; elapsed += frameMs) {
      current = rules.springStep(current, frameMs, style, speed);
      peak = Math.max(peak, current.position);
    }
    return peak;
  };
  let worst = settle(movingSpring(from, to));
  let shrinking = movingSpring(to, from);
  for (let elapsed = 0; !rules.isSpringAtRest(shrinking) && elapsed < 10_000; elapsed += frameMs) {
    shrinking = rules.springStep(shrinking, frameMs, style, speed);
    worst = Math.max(worst, settle(rules.retargetSpring(shrinking, to)));
  }
  return worst;
}

test('o palco cobre o pico das molas, com hover, nudge e sombra, em todo estilo e velocidade (ANIM-04)', () => {
  const hoverPeak = Math.max(spring.HOVER_SCALE, simulateNeutral(neutralSpring(1, spring.HOVER_SCALE, spring.SCALE_REST_DISTANCE, spring.SCALE_REST_SPEED)).peak);
  const nudgeRebound = Math.max(0, simulateNeutral(neutralSpring(spring.NUDGE_OFFSET_PX, 0, spring.REST_DISTANCE_PX, spring.REST_SPEED_PX_S)).peak);
  const maxHeight = pillMaxHeight();
  assert.ok(maxHeight > windowHeight, `o pior pedido (${maxHeight} px) deveria passar da pílula com a janela (${windowHeight} px)`);
  for (const style of ANIMATION_STYLES) {
    for (const speed of [0.5, 1, 2]) {
      const widthPeak = worstPeak(spring, PILL_MIN.width, expandedWidth, style, speed);
      const permissionPeak = worstPeak(spring, PILL_MIN.height, maxHeight, style, speed);
      const windowPeak = worstPeak(spring, PILL_MIN.height, windowHeight, style, speed);
      const heightPeak = Math.max(permissionPeak, windowPeak);
      // A escala amplia a partir do centro do topo: a largura cresce dos dois lados e a altura só para baixo.
      const neededWidth = widthPeak * hoverPeak + 2 * SHADOW_MARGIN_PX;
      const neededHeight = stageTop + heightPeak * hoverPeak + nudgeRebound + SHADOW_MARGIN_PX;
      // Âncoras de baixo: a pílula cresce para cima a partir da base do palco, que guarda só a margem da
      // sombra (STAGE_SHADOW_PX). O nudge sobe a pílula 6 px, sem o respiro do --stage-top para absorver, e em
      // cima só cabe o alcance da sombra para cima. As âncoras de canto pedem a mesma largura do centro (a
      // margem da sombra dos dois lados), já coberta pela conta de neededWidth.
      // Hover e nudge só existem sem pedido na tela (shouldNudge e hoverScaleTarget), e o pedido é a pílula
      // mais alta: a sombra inteira cabe no pedido sozinho e na pílula comum com hover e nudge. O produto do
      // maior pico pelo hover e pelo nudge (pior caso combinado, que só se sobreporia na passagem do pedido
      // chegando com o hover assentando) estoura em 6 px a sombra de cima do Elástico a 0,5×, e por isso o
      // que se exige dele é só a pílula inteira dentro do palco.
      const bottomAnchorShadow = {
        permission: STAGE_SHADOW_PX + permissionPeak + SHADOW_TOP_REACH_PX,
        hoverAndNudge: STAGE_SHADOW_PX + windowPeak * hoverPeak + Math.abs(spring.NUDGE_OFFSET_PX) + SHADOW_TOP_REACH_PX,
      };
      const bottomAnchorPill = STAGE_SHADOW_PX + heightPeak * hoverPeak + Math.abs(spring.NUDGE_OFFSET_PX);
      const where = `${style} a ${speed}×: pico ${widthPeak.toFixed(1)}×${heightPeak.toFixed(1)}, precisa de ${neededWidth.toFixed(1)}×${neededHeight.toFixed(1)}, palco ${WINDOW_SIZE.width}×${WINDOW_SIZE.height}`;
      assert.ok(WINDOW_SIZE.width >= neededWidth, `largura do palco curta: ${where}`);
      assert.ok(WINDOW_SIZE.height >= neededHeight, `altura do palco curta: ${where}`);
      for (const [situation, needed] of Object.entries(bottomAnchorShadow)) {
        assert.ok(WINDOW_SIZE.height >= needed, `altura do palco curta na âncora de baixo (${situation}, ${needed.toFixed(1)}): ${where}`);
      }
      assert.ok(WINDOW_SIZE.height >= bottomAnchorPill, `a pílula sairia do palco na âncora de baixo (${bottomAnchorPill.toFixed(1)}): ${where}`);
    }
  }
});

test('a folga horizontal é o que sobra de cada lado da pílula expandida e o palco é congelado', () => {
  assert.equal(HORIZONTAL_SLACK, (WINDOW_SIZE.width - expandedWidth) / 2);
  assert.equal(EXPANDED_PILL_WIDTH_PX, expandedWidth, 'o state.js repete a largura de #pill.expanded');
  assert.ok(Object.isFrozen(WINDOW_SIZE));
  assert.ok(Number.isInteger(WINDOW_SIZE.width) && Number.isInteger(WINDOW_SIZE.height));
});

// Trava de regressão (texto): a 125% a janela nasce 6 DIP mais alta (520×416 medido) e só o setBounds com o
// tamanho explícito a corrige; setPosition também muda o tamanho. Sem isto a borda de baixo recusa toda
// decisão (T-04-12).
test('a ilha é posicionada só por setBounds, inclusive logo depois de criada', () => {
  const start = mainSource.indexOf('function createIsland(');
  assert.ok(start >= 0);
  const createBody = mainSource.slice(start, mainSource.indexOf('\nfunction ', start + 1));
  const created = createBody.indexOf('new BrowserWindow(');
  const placed = createBody.indexOf('moveIsland(island, savedPosition(display), display.workArea);');
  assert.ok(created >= 0 && placed > created, 'createIsland não reposiciona por moveIsland depois de new BrowserWindow(');
  const code = mainSource.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
  assert.equal(/\.setPosition\(/.test(code), false, 'main.js posiciona por setPosition');
});

// Trava de regressão (texto): o atalho e o menu escondem e mostram a ilha, e nenhum dos dois decide nada.
// O gate recusa com a janela escondida (windowVisible), então esconder só precisa nunca aprovar; reexibir
// tem de passar pelo evento 'show', que rearma (T-04-14, T-04-15, TELA-02).
test('esconder nunca decide, reexibir passa pelo rearme e o atalho é registrado uma vez', () => {
  const bodyOf = (opening, closing = '\n}') => {
    assert.equal(mainSource.split(opening).length - 1, 1, `ausente ou repetido no main.js: ${opening}`);
    const rest = mainSource.slice(mainSource.indexOf(opening));
    return rest.slice(0, rest.indexOf(closing));
  };
  const code = mainSource.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
  const occurrences = (needle) => code.split(needle).length - 1;
  assert.equal(occurrences('globalShortcut.register('), 1, 'o atalho é registrado uma vez');
  assert.ok(
    /registerShortcut\(\s*\(accelerator, onPress\) => globalShortcut\.register\(accelerator, onPress\)/.test(code),
    'o registro passa por registerShortcut',
  );
  assert.ok(bodyOf("app.on('will-quit'", '\n  });').includes('globalShortcut.unregisterAll();'), 'o atalho é liberado em will-quit');
  const hide = bodyOf('function setUserHidden(');
  const visibility = bodyOf('function applyVisibility(');
  assert.equal(occurrences('showInactive('), 1, 'showInactive só em applyVisibility');
  assert.ok(visibility.includes('showInactive('));
  assert.ok(hide.includes('applyVisibility();'), 'setUserHidden esconde e mostra por applyVisibility');
  assert.equal(/\.show\(\)/.test(code), false, 'main.js mostra a ilha por show()');
  for (const forbidden of ['writeDecision', 'acceptDecision', 'decidedPermissionId']) {
    assert.equal(hide.includes(forbidden), false, `setUserHidden toca em ${forbidden}`);
  }
  assert.ok(
    bodyOf('function createIsland(').includes('show: isIslandVisible({ userHidden, covered: fullscreenByDisplay.has(display.id) }),'),
    'a ilha nova nasce escondida se o usuário a escondeu ou se o monitor está coberto',
  );
  const hideListener = bodyOf("island.on('hide', () => {", '\n  });');
  assert.ok(hideListener.includes('releaseCapture(island);') && hideListener.includes('updateCursorTick();'), 'esconder solta a captura e reavalia o timer');
  assert.ok(mainSource.includes("island.on('show', () => refresh('rearm'))"));
  assert.ok(bodyOf('function openMenu(').includes('menuTemplate(preferences, shortcutStatus)'));
  // toMenuItem agora vive no state.js e tem teste de comportamento em prefs.test.js; aqui só a ligação.
  assert.equal(code.includes('function toMenuItem('), false, 'toMenuItem voltou para o main.js');
  const openMenu = bodyOf('function openMenu(');
  assert.ok(openMenu.includes('onHide: () => setUserHidden(true)') && openMenu.includes('toMenuItem(item, effects)'));
});

// Trava de regressão (texto): todo caminho que move a janela sem passar por 'show' rearma os botões,
// porque o renderer não percebe o movimento (WR-01, SEG-02). Cobre os handlers de arraste e de duplo
// clique e todo chamador de syncIslands que reposiciona fora do arranque.
test('todo caminho que move a ilha termina em refresh rearm', () => {
  const afterMove = (opening, mover) => {
    const start = mainSource.indexOf(opening);
    assert.ok(start >= 0, `ausente no main.js: ${opening}`);
    const body = mainSource.slice(start, mainSource.indexOf('\n  });', start));
    const moved = body.indexOf(mover);
    assert.ok(moved >= 0, `${opening} não chama ${mover}`);
    return body.slice(moved).includes("refresh('rearm');");
  };
  assert.ok(afterMove("ipcMain.on('island:reset-position'", 'moveIsland('), 'duplo clique move sem rearmar');
  assert.ok(afterMove("ipcMain.on('island:drag-end'", 'persistSavedOffsets();'), 'soltar o arraste não rearma');
  const sync = (opening) => {
    const start = mainSource.indexOf(opening);
    assert.ok(start >= 0, `ausente no main.js: ${opening}`);
    const body = mainSource.slice(start, mainSource.indexOf('\n}', start));
    return body.indexOf("refresh('rearm')") > body.indexOf('syncIslands()') && body.includes('syncIslands()');
  };
  assert.ok(sync('function applyPreference('), 'applyPreference reposiciona sem rearmar');
  assert.ok(sync('function cursorTick('), 'a troca de monitor do cursor reposiciona sem rearmar');
  assert.ok(
    mainSource.includes("for (const eventName of ['display-added', 'display-removed', 'display-metrics-changed']) screen.on(eventName, () => refresh('rearm'));"),
    'os eventos de monitor rearmam',
  );
});

// Trava de regressão (texto): fechar o menu depois de syncIslands destruir a ilha dona não pode lançar nem
// deixar menuIsland preso (WR-02).
test('a ilha destruída com o menu aberto não quebra o fechamento do menu', () => {
  const start = mainSource.indexOf('function applyCapture(');
  assert.ok(start >= 0, 'applyCapture ausente no main.js');
  const capture = mainSource.slice(start, mainSource.indexOf('\n}', start));
  assert.ok(capture.indexOf('island.isDestroyed()') >= 0 && capture.indexOf('island.isDestroyed()') < capture.indexOf('setIgnoreMouseEvents('));
  const sync = mainSource.slice(mainSource.indexOf('function syncIslands('), mainSource.indexOf('\nfunction registerIpcHandlers('));
  const nulled = sync.indexOf('if (island === menuIsland) menuIsland = null;');
  assert.ok(nulled >= 0 && nulled < sync.indexOf('island.destroy();'), 'syncIslands não solta menuIsland antes de destruir');
});

// Trava de regressão (texto): o main é dono do fato "há pedido", então a opacidade sai do mesmo passo do
// refresh que decide o pedido exibido e chega antes do estado ao renderer; nenhum outro caminho mexe nela
// (invariante I5, T-04-16).
test('a transparência sai do mesmo passo do refresh e nunca vale com pedido na tela', () => {
  const code = mainSource.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
  const line = 'island.setOpacity(effectiveOpacity(preferences.opacity, Boolean(lastPickedState.permission)));';
  assert.equal(code.split(line).length - 1, 1, 'a linha de applyOpacity aparece uma vez');
  assert.equal(code.split('setOpacity(').length - 1, 1, 'nenhum outro caminho muda a opacidade');
  const bodyOf = (opening) => {
    const start = mainSource.indexOf(opening);
    assert.ok(start >= 0, `ausente no main.js: ${opening}`);
    return mainSource.slice(start, mainSource.indexOf('\nfunction ', start + 1));
  };
  assert.match(bodyOf('function applyOpacity('), /^function applyOpacity\(island\) \{\s*island\.setOpacity\(/);
  assert.match(
    bodyOf('function refresh('),
    /for \(const island of islands\.values\(\)\) \{\s*applyOpacity\(island\);\s*sendState\(island, userSwitched\);\s*\}/,
  );
  assert.ok(bodyOf('function createIsland(').includes('applyOpacity(island);'), 'a ilha nova já nasce com a opacidade efetiva');
});

// Trava de regressão (texto): só o main esconde e mostra, combinando o usuário com a tela cheia por monitor,
// e o atalho respeita a tela cheia (T-04-21, T-04-22, D-12, D-19).
test('esconder combina o usuário e a tela cheia, só no main, e o atalho respeita a tela cheia', () => {
  const start = mainSource.indexOf('function applyVisibility(');
  assert.ok(start >= 0, 'applyVisibility ausente no main.js');
  const visibility = mainSource.slice(start, mainSource.indexOf('\n}', start));
  assert.ok(visibility.includes('isIslandVisible({ userHidden, covered: fullscreenByDisplay.has(displayId) })'));
  assert.equal(visibility.includes('updateCursorTick'), false, 'applyVisibility deixa o timer para o evento hide/show');
  assert.ok(mainSource.includes(
    'nextUserHidden({ userHidden, displayIds: [...islands.keys()], coveredDisplayIds: [...fullscreenByDisplay.keys()] })',
  ), 'o atalho passa por nextUserHidden');
  assert.ok(mainSource.includes("island.on('hide', () => {"), 'o ouvinte de hide continua');
});

// Trava de regressão (texto): D-17 e D-20, com a autorização do autor de 2026-11-22 para o pacote nativo.
// Só o fullscreen.js o carrega, de forma preguiçosa, dentro da guarda win32 e de um try; os hooks, que rodam
// dentro da sessão do Claude Code, nunca o citam nem o carregam (T-04-19, T-04-20, T-03w-01, T-03w-SC).
test('só o fullscreen.js carrega o pacote nativo, e a sondagem a 2 Hz liga o sensor ao mapa', () => {
  const native = 'koffi';
  const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
  for (const file of ['hook.js', 'permission-hook.js', 'window.js', 'state.js', 'install.js', 'preload.js']) {
    assert.equal(read(file).includes(native), false, `${file} cita o pacote nativo`);
    assert.equal(read(file).includes('./fullscreen'), false, `${file} carrega o sensor`);
  }
  assert.equal(mainSource.includes(`require('${native}`), false, 'main.js carrega o pacote nativo');
  assert.ok(mainSource.includes("require('./fullscreen')"), 'main.js carrega o sensor');

  const sensor = read('fullscreen.js');
  const requires = sensor.split(/\r?\n/).filter((line) => line.includes(`require('${native}')`));
  assert.equal(requires.length, 1, 'fullscreen.js faz exatamente um require do pacote nativo');
  assert.match(requires[0], /^\s+\S/, 'o require do pacote nativo fica indentado (dentro de função)');
  const requireAt = sensor.indexOf(`require('${native}')`);
  const guarded = sensor.slice(sensor.lastIndexOf('function ', requireAt), requireAt);
  assert.ok(guarded.includes("'win32'"), 'o require do pacote nativo vem depois da guarda win32');
  assert.ok(/\btry\s*\{/.test(guarded), 'o require do pacote nativo fica dentro de um try');

  const bodyOf = (opening, closing = '\n}') => {
    const start = mainSource.indexOf(opening);
    assert.ok(start >= 0, `${opening} ausente no main.js`);
    return mainSource.slice(start, mainSource.indexOf(closing, start));
  };
  const probe = bodyOf('function probeFullscreen(');
  // O mapa anterior entra como previous, os HWND lembrados vão ao sensor (para soltar o que sumiu) e o
  // resultado troca o conteúdo do mesmo Map, que o gate e o atalho leem.
  for (const needle of [
    'process.pid', 'screen.dipToScreenRect(null, display.bounds)', 'nextFullscreen(', 'applyVisibility(',
    'previous: fullscreenByDisplay,', 'probeForeground([...fullscreenByDisplay.values()])',
    'fullscreenByDisplay.clear();', 'fullscreenByDisplay.set(id, hwnd)',
  ]) {
    assert.ok(probe.includes(needle), `probeFullscreen não contém ${needle}`);
  }
  const startBody = bodyOf('function start(');
  assert.ok(startBody.includes("process.platform === 'win32'"), 'start só liga a sondagem no Windows');
  assert.ok(startBody.includes('setInterval(probeFullscreen, FULLSCREEN_PROBE_MS)'), 'start liga a sondagem a 2 Hz');

  const lines = mainSource.split(/\r?\n/);
  const declaration = lines.findIndex((line) => line.startsWith('const fullscreenByDisplay = new Map();'));
  assert.ok(declaration > 0, 'fullscreenByDisplay ausente no main.js');
  let first = declaration;
  while (first > 0 && lines[first - 1].startsWith('//')) first -= 1;
  assert.ok(lines.slice(first, declaration).join(' ').includes('ponytail:'), 'o mapa leva um comentário ponytail:');

  const manifest = JSON.parse(read('package.json'));
  assert.equal(manifest.dependencies?.[native], '3.3.8', 'o pacote nativo fica exato em dependencies');
  assert.equal(native in (manifest.devDependencies ?? {}), false, 'o pacote nativo não vai em devDependencies');
  assert.ok('electron' in (manifest.devDependencies ?? {}), 'electron segue em devDependencies');
  const workspace = read('pnpm-workspace.yaml');
  assert.match(workspace, /^\s+koffi: false\s*$/m, 'o build do pacote nativo fica negado');
  assert.match(workspace, /^\s+electron: true\s*$/m, 'o build do Electron segue liberado');
});

// Trava de comportamento: carregar o sensor não carrega o pacote nativo (a carga é preguiçosa), então um
// require('./fullscreen') por engano num hook não pesa nem quebra a sessão (T-03w-01).
test('require do fullscreen.js não carrega o pacote nativo', () => {
  const script = "require('./fullscreen'); process.stdout.write(JSON.stringify(Object.keys(require.cache)));";
  const loaded = JSON.parse(execFileSync(process.execPath, ['-e', script], { cwd: __dirname, encoding: 'utf8' }));
  assert.deepEqual(loaded.filter((file) => /[\\/]koffi[\\/]/.test(file)), []);
});

// O sensor nunca lança, mesmo com entrada fora do contrato (T-03w-02). Fora do Windows devolve null; no
// Windows devolve a amostra no formato que o nextFullscreen espera.
test('probeForeground nunca lança e devolve a amostra no contrato do nextFullscreen', () => {
  const { probeForeground } = require('./fullscreen');
  const sample = probeForeground([0, 'x', 1.5]);
  assert.doesNotThrow(() => probeForeground());
  if (process.platform !== 'win32') {
    assert.equal(sample, null);
    assert.equal(probeForeground(), null);
    return;
  }
  assert.ok(sample && typeof sample === 'object', 'no Windows o pacote é dependência instalada');
  assert.deepEqual(sample.gone, [0]);
  assert.deepEqual(probeForeground().gone, []);
  const { foreground } = sample;
  if (foreground === null) return;
  assert.ok(Number.isInteger(foreground.hwnd) && foreground.hwnd > 0);
  assert.equal(typeof foreground.className, 'string');
  assert.ok(Number.isInteger(foreground.pid) && Number.isInteger(foreground.exStyle));
  assert.equal(typeof foreground.visible, 'boolean');
  assert.equal(typeof foreground.minimized, 'boolean');
  assert.ok(foreground.cloaked === null || typeof foreground.cloaked === 'boolean');
  for (const rect of [foreground.clientRect, foreground.monitorRect]) {
    if (rect === null) continue;
    for (const side of ['left', 'top', 'right', 'bottom']) assert.ok(Number.isFinite(rect[side]));
  }
});

// Ao lado da ilha do sistema, numa área útil estreita, o clamp põe a nossa janela sob a pílula do mod: a janela
// ainda cabe na área útil, então só besideFits recusa. Reproduz a conta do main com as funções puras.
for (const vector of vectors.besideDecision) {
  test(`besideDecision: ${vector.name}`, () => {
    const { anchor, workArea } = vector.input;
    const slack = horizontalSlackFor(anchor);
    const position = clampIslandPosition(anchorPosition(anchor, workArea, WINDOW_SIZE), workArea, WINDOW_SIZE, slack);
    const bounds = { ...position, ...WINDOW_SIZE };
    const verdict = acceptDecision({
      behavior: 'allow',
      echoedId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      shownId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      shownSince: 1000,
      now: 1800,
      decidedId: null,
      windowVisible: true,
      coveredByFullscreen: false,
      withinVisibleArea: isWithinWorkArea(bounds, workArea, slack) && besideFits(anchor, workArea),
    });
    assert.deepEqual(verdict, vector.expect);
  });
}

test('o renderer e o gate conferem a área visível pela mesma função, com a âncora ao lado', () => {
  const mainLf = mainSource.replace(/\r\n/g, '\n');
  const start = mainLf.indexOf('function fitsVisibleArea(');
  assert.ok(start >= 0, 'função ausente: fitsVisibleArea');
  const body = mainLf.slice(start, mainLf.indexOf('\n}\n', start));
  assert.ok(body.includes('isWithinWorkArea(island.getBounds(), display.workArea, horizontalSlackFor(preferences.anchor))'));
  assert.ok(body.includes('besideFits(preferences.anchor, display.workArea)'));
  // definição e as duas chamadas (sendState e island:decide); comentário não conta
  const code = mainLf.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
  assert.equal(code.split('fitsVisibleArea(island, display)').length - 1, 3);
});

for (const vector of vectors.besideFits) {
  test(`besideFits: ${vector.name}`, () => {
    assert.equal(besideFits(vector.input.anchor, vector.input.workArea), vector.expect);
  });
}

test('a largura mínima ao lado é a soma das duas distâncias ao centro e é a do fixture', () => {
  assert.equal(BESIDE_MIN_WORK_AREA_WIDTH_PX, 2 * (BESIDE_GAP_PX + EXPANDED_PILL_WIDTH_PX));
  assert.equal(BESIDE_MIN_WORK_AREA_WIDTH_PX, 1220);
  assert.equal(BESIDE_MIN_WORK_AREA_WIDTH_PX, vectors.besideMinWorkAreaWidthPx);
});

// --- Fase 5: várias sessões (travas de texto, baratas e frágeis de propósito) ---

const mainLf = mainSource.replace(/\r\n/g, '\n');
const preloadLf = preloadSource.replace(/\r\n/g, '\n');

// Corpo de uma função do main: do `function nome(` até o fecha-chaves da coluna 0.
function mainFunctionBody(name) {
  const start = mainLf.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `função ausente no main.js: ${name}`);
  return mainLf.slice(start, mainLf.indexOf('\n}\n', start));
}

test('o canal island:select só leva um índice, conferido no main, e passa por refresh', () => {
  const start = mainLf.indexOf("ipcMain.on('island:select', (event, index) => {");
  assert.ok(start >= 0, 'handler de island:select ausente');
  const handler = mainLf.slice(start, mainLf.indexOf('\n  });', start));
  for (const piece of [
    'islandOf(event)',
    'Number.isInteger(index)',
    "lastPickedState.state === 'idle'",
    "nextSelection(selection, lastSessionList, { type: 'select', index })",
    "refresh('select')",
  ]) {
    assert.ok(handler.includes(piece), `handler sem: ${piece}`);
  }
  assert.ok(preloadLf.includes("selectSession: (index) => ipcRenderer.send('island:select', index),"));
});

test('a seleção só muda por nextSelection e o refresh a calcula antes de escolher a sessão', () => {
  const body = mainFunctionBody('refresh');
  const order = [
    'const heldKey = isCursorOverIsland() ? selection.key : null;',
    'sessionList(sessions, now, heldKey)',
    "nextSelection(selection, list, {\n    type: 'poll'",
    'lastSessionList = list;',
    'pickState(sessions, now, selection, heldKey)',
  ].map((piece) => {
    const at = body.indexOf(piece);
    assert.ok(at >= 0, `refresh sem: ${piece}`);
    return at;
  });
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'ordem do refresh');
  // D-22: o concluído só é segurado com o cursor sobre a pílula, e esse fato vem só do pedido de captura (hover).
  assert.ok(mainLf.includes('const isCursorOverIsland = () => [...captureRequests.values()].some((capture) => capture === true);'));
  assert.equal(mainLf.split('isCursorOverIsland()').length - 1, 1, 'só o refresh pergunta pelo cursor');
  assert.match(mainLf, /^let selection = \{ key: null, requests: \[\] \};/m);
  const code = mainLf.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
  const assignments = [...code.matchAll(/(?<![\w.])(let\s+)?selection\s*=(?!=)([^;]*);/g)].filter((match) => !match[1]);
  assert.ok(assignments.length >= 2, 'refresh e island:select atribuem a seleção');
  for (const [, , right] of assignments) assert.ok(right.includes('nextSelection('), `selection recebe algo que não é nextSelection: ${right}`);
});

test('readSessions sobrescreve a chave e a ordem depois do parse e guarda o statSync por sessão nova', () => {
  const body = mainFunctionBody('readSessions');
  const parse = body.indexOf('JSON.parse(');
  assert.ok(parse >= 0);
  assert.ok(body.indexOf('session.key = key;') > parse, 'a chave vem do nome do arquivo, depois do parse');
  assert.ok(body.indexOf('session.firstSeenAt =') > parse, 'a ordem vem da ilha, depois do parse');
  assert.ok(body.includes('birthtimeMs'));
  const guard = body.indexOf('firstSeenAtByKey.has(key)');
  assert.ok(guard >= 0 && guard < body.indexOf('statSync('), 'um statSync por sessão nova, não por ciclo');
  assert.ok(body.includes('firstSeenAtByKey.delete('), 'a chave sai do mapa quando o arquivo some');
});

test('o clique no ponto manda só o índice, o pedido novo zera a leitura e a pílula não ganha botão fora do lugar', () => {
  assert.equal(rendererLf.split('window.island.selectSession(').length - 1, 1);
  assert.ok(rendererLf.includes('window.island.selectSession(Number(button.dataset.index))'));
  const click = rendererLf.slice(rendererLf.indexOf("sessionsStrip.addEventListener('click'"));
  assert.ok(click.slice(0, click.indexOf('\n  });')).includes('aria-current'), 'o ponto da exibida não faz nada');
  assert.ok(rendererLf.includes('id="sessions"'));
  const onState = rendererLf.slice(rendererLf.indexOf('window.island.onState('));
  assert.match(onState, /if \(permissionId !== previousPermissionId\) \{[^}]*readPermissionId = null;[^}]*permissionText\.scrollTop = 0;[^}]*\}/);
});

test('sessionSwitchDirection dá a direção da troca e MAX_SESSION_DOTS é 8', () => {
  const block = loadInlineBlock('// sessoes:inicio', '// sessoes:fim', ['MAX_SESSION_DOTS', 'sessionSwitchDirection']);
  assert.equal(block.MAX_SESSION_DOTS, 8);
  const at = (index, size) => Array.from({ length: size }, (_, position) => ({ current: position === index }));
  assert.equal(block.sessionSwitchDirection(at(0, 2), at(1, 2)), 1);
  assert.equal(block.sessionSwitchDirection(at(1, 2), at(0, 2)), -1);
  assert.equal(block.sessionSwitchDirection(at(0, 4), at(3, 4)), 1);
  assert.equal(block.sessionSwitchDirection(at(2, 3), at(2, 3)), 0);
  assert.equal(block.sessionSwitchDirection(at(0, 2), at(0, 3)), 0);
  assert.equal(block.sessionSwitchDirection(at(0, 1), at(0, 1)), 0);
  assert.equal(block.sessionSwitchDirection([{}, {}], [{}, {}]), 0);
  assert.equal(block.sessionSwitchDirection([{ current: true }, {}], [{}, {}]), 0);
  for (const value of [undefined, null, 'ab', {}, 3]) {
    assert.equal(block.sessionSwitchDirection(value, at(1, 2)), 0);
    assert.equal(block.sessionSwitchDirection(at(0, 2), value), 0);
  }
});

test('a pílula compacta tem teto na largura da expandida e os pontos são uma coluna na lateral da expandida', () => {
  assert.equal(cssDeclarations('#pill:not(.expanded)')['max-width'], cssDeclarations('#pill.expanded').width);
  // Na expandida não há teto: ele cortaria a passagem da mola ao crescer (ANIM-01).
  assert.equal(cssDeclarations('#pill')['max-width'], undefined);
  for (const [, selector, body] of styleRules.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (selector.trim().startsWith('#pill.multi-session')) {
      assert.equal(/(?<![-\w])width\s*:/.test(body), false, `a regra ${selector.trim()} não pode fixar a largura da pílula`);
    }
  }
  const side = rendererLf.slice(rendererLf.indexOf('<span id="side">'), rendererLf.indexOf('\n    </span>\n    </div>'));
  // Fora da barra: último filho da pílula, depois de #actions, posto na lateral sem entrar no grid.
  assert.ok(side.includes('id="open-compact"'));
  assert.equal(side.includes('id="sessions"'), false, 'os pontos não moram mais na barra');
  const afterActions = rendererLf.slice(rendererLf.indexOf('<div id="actions">'), rendererLf.indexOf('<script>'));
  const lines = afterActions.split('\n').map((line) => line.trim()).filter(Boolean);
  assert.deepEqual(lines.slice(-3), ['</div>', '<span id="sessions" role="group" aria-label="Sessões" hidden></span>', '</div>']);
  const column = cssDeclarations('#sessions');
  assert.equal(column.position, 'absolute');
  assert.equal(column['flex-direction'], 'column');
  // Só na expandida (pedido do autor), e o contador de mais de 8 sessões segue a mesma regra.
  assert.equal(cssDeclarations('#pill:not(.expanded) #sessions, #sessions[hidden]').display, 'none');
  assert.equal(cssDeclarations('#pill:not(.expanded) #count').display, 'none');
  // O conteúdo cede a faixa da coluna e a largura da expandida não muda: a conta do palco segue valendo. Com
  // pedido na tela a faixa vale mesmo sem pontos, para mudar o número de sessões nunca mover Permitir e Negar.
  const gutter = cssDeclarations(SESSIONS_GUTTER_RULE);
  assert.deepEqual(Object.keys(gutter), ['padding-right']);
  const right = cssPixels(column.right, 'right de #sessions');
  const button = cssDeclarations('#sessions button');
  const buttonWidth = cssPixels(button.width, 'largura do ponto');
  assert.ok(buttonWidth >= 16, 'alvo de pelo menos 16 px (D-12)');
  assert.equal(button.flex, `0 1 ${button.width}`);
  // Entre o conteúdo e a coluna sobra pelo menos a distância da coluna à borda, e o ponto fica a 20 px da borda.
  assert.ok(cssPixels(gutter['padding-right'], 'padding-right') - right - buttonWidth >= right, 'folga entre o conteúdo e a coluna');
  assert.equal(right + buttonWidth / 2, 20);
  // A coluna tem altura fixa (a pílula crescer não move os pontos), cabe na expandida mais baixa com a mesma
  // margem em cima e embaixo, e 8 pontos no tamanho mínimo cabem nela.
  assert.equal(column.bottom, undefined);
  const top = cssPixels(column.top, 'top de #sessions');
  const height = cssPixels(column.height, 'altura de #sessions');
  assert.equal(top + height + top, cssPixels(cssDeclarations('#pill.expanded').height, 'altura da expandida'));
  assert.ok(8 * cssPixels(button['min-height'], 'min-height') <= height);
  const render = functionBody('renderContent');
  assert.ok(render.includes("pill.classList.toggle('multi-session', "));
  assert.ok(render.includes('current.sessions.length >= 2'));
});

test('com várias sessões o título tem largura fixa e corta com reticências, então o projeto não muda a largura da pílula', () => {
  const title = cssDeclarations('#pill.multi-session #title');
  assert.equal(title.flex, '0 1 140px');
  assert.equal(title['min-width'], '0');
  assert.equal(title['text-overflow'], 'ellipsis');
  assert.equal(title.overflow, 'hidden');
  assert.equal(cssDeclarations('#lead')['min-width'], '0');
  assert.ok(functionBody('renderContent').includes("pill.classList.toggle('multi-session', "));
});

test('o cabeçalho do pedido corta só o projeto: a ferramenta quebra em qualquer ponto e nunca leva reticências', () => {
  assert.equal(cssDeclarations('#permission-tool')['overflow-wrap'], 'anywhere');
  for (const [, selector, body] of styleRules.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (['#permission-tool', '#permission-tool-name'].includes(selector.trim())) {
      assert.equal(body.includes('text-overflow'), false, `a regra ${selector.trim()} não pode cortar com reticências`);
    }
  }
  const project = cssDeclarations('#permission-project');
  assert.equal(project['text-overflow'], 'ellipsis');
  assert.equal(project['white-space'], 'nowrap');
  cssPixels(project['max-width'], 'max-width de #permission-project');
  const render = functionBody('renderContent');
  assert.match(render, /permissionToolName\.textContent = [^\n]*permission\.tool[^\n]*;/);
  assert.equal(render.includes('.slice('), false, 'o nome da ferramenta não pode ser fatiado');
  assert.ok(rendererLf.includes('id="permission-project"') && rendererLf.includes('id="permission-tool-name"'));
});

test('o título é o projeto só com várias sessões e a pílula compacta, senão o do estado', () => {
  const render = functionBody('renderContent');
  assert.ok(render.includes("const multiSession = Array.isArray(current.sessions) && current.sessions.length >= 2;"));
  assert.ok(render.includes("title.textContent = multiSession && !pill.classList.contains('expanded') && current.project ? current.project : TITLES[current.state];"));
  assert.equal(render.split('current.project').length - 1 >= 3, true, 'título, cabeçalho do pedido e detalhe usam o projeto');
});

test('o ponto de quem pede permissão pulsa por opacidade e para com movimento reduzido', () => {
  assert.match(rendererLf, /@keyframes session-pulse \{[^{}]*\{[^{}]*\}\s*\}/);
  assert.equal(cssDeclarations('#sessions [data-pending="true"] i').animation.includes('session-pulse'), true);
  const reduced = rendererLf.match(/@media \(prefers-reduced-motion: reduce\) \{([^{}]*)\{/);
  assert.ok(reduced, 'regra de movimento reduzido não encontrada');
  assert.ok(reduced[1].includes('#sessions i'));
  // o anel parado vive dentro do @media de movimento reduzido, que é o último bloco do CSS
  const media = rendererLf.slice(rendererLf.indexOf('@media (prefers-reduced-motion: reduce) {'), rendererLf.indexOf('</style>'));
  assert.ok(media.includes('#sessions [data-pending="true"] i { box-shadow: 0 0 0 2px '));
});

// --- Fase 5: roda do mouse (acumulador do mod, passo na lista e canal island:wheel) ---

const WHEEL_START = Object.freeze({ accumulated: 0, lastEventAt: null, lastStepAt: null });

test('wheelStep: um entalhe anda uma sessão, para cima a anterior e para baixo a seguinte', () => {
  assert.deepEqual(wheelStep(WHEEL_START, 120, 1000), { gesture: { accumulated: 0, lastEventAt: 1000, lastStepAt: 1000 }, step: -1 });
  assert.deepEqual(wheelStep(WHEEL_START, -120, 1000), { gesture: { accumulated: 0, lastEventAt: 1000, lastStepAt: 1000 }, step: 1 });
  assert.equal(wheelStep(WHEEL_START, 119, 1000).step, 0);
});

test('wheelStep: o touchpad soma deltas menores que um entalhe e anda quando o gesto chega a 120', () => {
  const first = wheelStep(WHEEL_START, 40, 1000);
  const second = wheelStep(first.gesture, 40, 1016);
  const third = wheelStep(second.gesture, 40, 1032);
  assert.deepEqual([first.step, second.step, third.step], [0, 0, -1]);
  assert.equal(second.gesture.accumulated, 80);
  assert.equal(third.gesture.accumulated, 0);
});

test('wheelStep: mais de 220 ms de pausa ou a inversão de direção recomeçam o gesto', () => {
  const pause = wheelStep(wheelStep(WHEEL_START, 60, 1000).gesture, 60, 1300);
  assert.deepEqual(pause, { gesture: { accumulated: 60, lastEventAt: 1300, lastStepAt: null }, step: 0 });
  const stillSame = wheelStep(wheelStep(WHEEL_START, 60, 1000).gesture, 60, 1220);
  assert.equal(stillSame.step, -1, '220 ms exatos ainda é o mesmo gesto: 60 + 60 fecha um entalhe');
  const reverse = wheelStep(wheelStep(WHEEL_START, 60, 1000).gesture, -60, 1010);
  assert.deepEqual(reverse, { gesture: { accumulated: -60, lastEventAt: 1010, lastStepAt: null }, step: 0 });
});

test('wheelStep: o intervalo entre passos é 85 ms com roda e 200 ms com touchpad, e só um entalhe fica pendente', () => {
  const stepped = wheelStep(WHEEL_START, 120, 1000).gesture;
  const held = wheelStep(stepped, 120, 1050);
  assert.deepEqual([held.step, held.gesture.accumulated], [0, 120]);
  assert.equal(wheelStep(held.gesture, 120, 1090).step, -1);
  const burst = wheelStep(stepped, 360, 1050);
  assert.deepEqual([burst.step, burst.gesture.accumulated], [0, 120]);
  const burstDown = wheelStep(stepped, -360, 1050);
  assert.deepEqual([burstDown.step, burstDown.gesture.accumulated], [0, -120]);
  assert.equal(wheelStep(stepped, 120, 1085).step, -1, 'com roda, 85 ms já bastam');
  // touchpad: o delta menor que um entalhe que fecha os 120 espera 200 ms do passo anterior
  const slow = wheelStep(stepped, 60, 1100);
  const slowSecond = wheelStep(slow.gesture, 60, 1150);
  assert.deepEqual([slowSecond.step, slowSecond.gesture.accumulated], [0, 120], 'a 150 ms do passo, dentro dos 200 ms');
  assert.equal(wheelStep(slowSecond.gesture, 60, 1210).step, -1, 'a 210 ms do passo anda');
});

test('wheelStep nunca lança nem muta, ignora entrada inválida e as constantes são as do mod', () => {
  const gesture = Object.freeze({ accumulated: 40, lastEventAt: 500, lastStepAt: 100 });
  for (const delta of [0, NaN, Infinity, -Infinity, '120', null, undefined, {}]) {
    const result = wheelStep(gesture, delta, 600);
    assert.deepEqual(result, { gesture, step: 0 });
    assert.notEqual(result.gesture, gesture, 'devolve cópia');
  }
  for (const now of [NaN, Infinity, '600', null, undefined]) assert.deepEqual(wheelStep(gesture, 120, now), { gesture, step: 0 });
  for (const bad of [null, undefined, 'x', 3, {}, { accumulated: 'a', lastEventAt: null, lastStepAt: null },
    { accumulated: 0, lastEventAt: 'x', lastStepAt: null }, { accumulated: 0, lastEventAt: null }]) {
    assert.deepEqual(wheelStep(bad, 120, 1000), wheelStep(WHEEL_START, 120, 1000));
  }
  assert.deepEqual(WHEEL_START, { accumulated: 0, lastEventAt: null, lastStepAt: null });
  assert.deepEqual(
    [WHEEL_NOTCH_DELTA, WHEEL_GESTURE_PAUSE_MS, WHEEL_STEP_MS, WHEEL_PRECISE_STEP_MS, WHEEL_DELTA_MAX],
    [120, 220, 85, 200, 1200],
  );
});

test('nextSelection scroll anda um vizinho na lista, sem dar a volta', () => {
  const list = [{ key: 'a' }, { key: 'b' }, { key: 'c' }];
  const at = (key) => ({ key, requests: [] });
  assert.equal(nextSelection(at('b'), list, { type: 'scroll', step: 1 }).key, 'c');
  assert.equal(nextSelection(at('b'), list, { type: 'scroll', step: -1 }).key, 'a');
  assert.equal(nextSelection(at('c'), list, { type: 'scroll', step: 1 }).key, 'c', 'sem volta no fim');
  assert.equal(nextSelection(at('a'), list, { type: 'scroll', step: -1 }).key, 'a', 'sem volta no começo');
  for (const step of [2, 0, '1', -2, NaN, undefined, null]) assert.equal(nextSelection(at('b'), list, { type: 'scroll', step }).key, 'b');
  assert.equal(nextSelection(at('z'), list, { type: 'scroll', step: 1 }).key, 'z', 'chave fora da lista mantém');
  assert.equal(nextSelection(at('b'), list, { type: 'scroll', step: 1 }).snapped, false);
});

test('o canal island:wheel só leva um número finito e limitado, acumula no main e passa por refresh', () => {
  const start = mainLf.indexOf("ipcMain.on('island:wheel', (event, delta) => {");
  assert.ok(start >= 0, 'handler de island:wheel ausente');
  const handler = mainLf.slice(start, mainLf.indexOf('\n  });', start));
  for (const piece of [
    'islandOf(event)',
    'Number.isFinite(delta)',
    'Math.abs(delta) > WHEEL_DELTA_MAX',
    "lastPickedState.state === 'idle'",
    'const now = performance.now();',
    'wheelStep(wheelGesture, delta, now)',
    "{ type: 'scroll', step }",
    "refresh('wheel')",
  ]) {
    assert.ok(handler.includes(piece), `handler sem: ${piece}`);
  }
  assert.ok(preloadLf.includes("wheel: (delta) => ipcRenderer.send('island:wheel', delta),"));
  assert.equal(rendererLf.split('window.island.wheel(').length - 1, 1, 'a roda sai de um só lugar');
  const listener = rendererLf.slice(rendererLf.indexOf("pill.addEventListener('wheel'"));
  const body = listener.slice(0, listener.indexOf('\n  }, '));
  for (const piece of ["closest('#permission')", 'wheelDeltaY', 'WHEEL_PIXELS_TO_DELTA']) assert.ok(body.includes(piece), `ouvinte sem: ${piece}`);
  assert.ok(listener.slice(0, listener.indexOf('\n\n')).includes('{ passive: true }'));
  assert.equal(body.includes('preventDefault'), false, 'a pílula nunca segura a rolagem');
});

test('só o bloco do pedido e a pílula ouvem a roda, e o comentário da pílula diz de que a roda depende', () => {
  const listeners = [...rendererLf.matchAll(/(\w+)\.addEventListener\('wheel'/g)].map((match) => match[1]);
  assert.deepEqual(listeners.sort(), ['permissionBox', 'pill']);
  assert.equal(rendererLf.includes('permissionText.addEventListener(\'wheel\''), false, 'o texto não tem ouvinte próprio de roda');
  const above = rendererLf.slice(0, rendererLf.indexOf("pill.addEventListener('wheel'"));
  const comment = above.slice(above.lastIndexOf('\n\n'));
  assert.ok(comment.includes('Rolar janelas inativas'), 'o comentário da pílula cita a configuração do Windows');
  assert.ok(comment.includes('captura'), 'o comentário da pílula cita a captura ligada pelo hover');
});

test('o README explica que a roda chega pela rolagem de janelas inativas do Windows', () => {
  const readme = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8');
  assert.ok(readme.includes('Rolar janelas inativas ao passar o mouse sobre elas'));
});

// --- Fase 5: snap do pedido novo (cola do main) ---

test('o refresh leva os fatos ao poll, trava a roda depois do snap e nunca reexibe a ilha; a roda ignorada ainda é gesto', () => {
  const body = mainFunctionBody('refresh');
  for (const piece of [
    'shownPermissionId: shown.id',
    "const userSwitched = reason === 'wheel' || reason === 'select';",
    'lastWheelAt',
    'if (selection.snapped) wheelLockedUntil =',
    'SNAP_WHEEL_LOCK_MS',
  ]) {
    assert.ok(body.includes(piece), `refresh sem: ${piece}`);
  }
  for (const forbidden of ['showInactive', 'applyVisibility', 'setUserHidden']) {
    assert.equal(body.includes(forbidden), false, `refresh não pode chamar ${forbidden}: o snap só muda a seleção`);
  }
  const start = mainLf.indexOf("ipcMain.on('island:wheel', (event, delta) => {");
  assert.ok(start >= 0, 'handler de island:wheel ausente');
  const handler = mainLf.slice(start, mainLf.indexOf('\n  });', start));
  const recorded = handler.indexOf('lastWheelAt = now;');
  const locked = handler.indexOf('if (now < wheelLockedUntil) return;');
  const stepped = handler.indexOf('wheelStep(');
  assert.ok(recorded >= 0 && locked > recorded && stepped > locked, 'lastWheelAt, trava e wheelStep, nesta ordem');
});

test('o "N de M" é o primeiro filho do cabeçalho do pedido, flutua à direita e só aparece com fila', () => {
  const html = rendererLf;
  const header = html.slice(html.indexOf('<span id="permission-tool">'), html.indexOf('</span>\n', html.indexOf('<span id="permission-tool">')));
  assert.ok(header.startsWith('<span id="permission-tool"><span id="permission-queue" hidden></span><span id="permission-project">'), 'a fila é o primeiro filho do cabeçalho');
  const queue = cssDeclarations('#permission-queue');
  assert.equal(queue.float, 'right');
  assert.match(queue['margin-left'], /^\d+px$/);
  assert.equal(cssDeclarations('#permission-queue[hidden]').display, 'none');
  assert.ok(html.includes("const permissionQueue = document.getElementById('permission-queue');"));
  assert.ok(html.includes('permissionQueue.hidden = !current.queue;'));
  assert.ok(html.includes('${current.queue.position} de ${current.queue.total}'));
});

test('a conferência de vida só envia o sinal 0 e só ESRCH conta como morto (SESS-07)', () => {
  const code = mainLf.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
  assert.equal(code.split('process.kill(').length - 1, 1, 'process.kill aparece uma vez só');
  assert.ok(code.includes('process.kill(pid, 0)'), 'o único process.kill é o de sinal 0');
  const body = mainFunctionBody('isPidAlive');
  assert.ok(body.includes('process.kill(pid, 0)'), 'o sinal 0 está dentro de isPidAlive');
  assert.ok(body.includes("return error.code !== 'ESRCH';"), 'só ESRCH conta como processo inexistente');
});

test('readSessions apaga a sessão morta antes de ela ganhar chave e ordem, e só ali (SESS-07)', () => {
  const body = mainFunctionBody('readSessions');
  const dead = body.indexOf('isSessionDead(session, now, isPidAlive)');
  const removal = body.indexOf("fs.rmSync(path.join(STATE_DIR, file), { force: true })");
  const keyed = body.indexOf('session.key = key;');
  assert.ok(dead >= 0 && removal > dead && keyed > removal, 'morta, remoção e chave, nesta ordem');
  assert.equal(body.split('fs.rmSync(').length - 1, 1, 'readSessions só remove um arquivo, o da sessão morta');
  assert.ok(body.includes('const now = Date.now();'));
});

// Roda o readSessions de verdade, com um disco de mentira: `disk` mapeia nome do arquivo para o texto dele.
function runReadSessions(disk, { alive = () => true, firstSeen = new Map(), lastGood = new Map() } = {}) {
  const { isSessionFile, isSessionDead } = require('./state');
  const removed = [];
  const stubs = {
    fs: {
      readdirSync: () => Object.keys(disk),
      readFileSync: (file) => disk[path.basename(file)],
      statSync: () => ({ birthtimeMs: 500 }),
      rmSync: (file) => { removed.push(path.basename(file)); delete disk[path.basename(file)]; },
    },
    path, STATE_DIR: '/estado', isSessionFile, isSessionDead, isPidAlive: alive, readContextPercent: () => null,
    firstSeenAtByKey: firstSeen, lastGoodSessionByKey: lastGood, Date: { now: () => 10_000 },
  };
  const readSessions = vm.runInNewContext(`${mainFunctionBody('readSessions')}\n}\nreadSessions`, stubs);
  return { read: () => [...readSessions()].map((session) => session.key), removed, firstSeen, lastGood };
}

test('readSessions: arquivo pela metade num ciclo mantém o último estado lido, sem a sessão sair da lista', () => {
  const live = JSON.stringify({ state: 'waiting', updatedAt: 9_000, windowPid: 4242 });
  const disk = { 'a.json': live, 'b.json': live };
  const { read } = runReadSessions(disk);
  assert.deepEqual(read(), ['a', 'b']);
  disk['a.json'] = '{"state":"wai'; // hook gravando agora
  disk['b.json'] = '';
  assert.deepEqual(read(), ['a', 'b'], 'JSON cortado e arquivo vazio contam como a sessão ainda aqui');
  disk['a.json'] = live;
  assert.deepEqual(read(), ['a', 'b']);
});

test('readSessions: a sessão que sumiu, morreu ou venceu sai mesmo quando o arquivo está ilegível', () => {
  const live = JSON.stringify({ state: 'running', updatedAt: 9_000, windowPid: 4242 });
  const gone = runReadSessions({ 'a.json': live });
  assert.deepEqual(gone.read(), ['a']);
  const { lastGood } = gone;
  // arquivo apagado: nada para ler, a sessão sai e a última leitura boa também
  const disk = { 'b.json': live };
  const afterDelete = runReadSessions(disk, { lastGood, firstSeen: gone.firstSeen });
  assert.deepEqual(afterDelete.read(), ['b']);
  assert.equal(lastGood.has('a'), false, 'a última leitura de um arquivo que sumiu é podada');

  // terminal fechado enquanto o arquivo estava ilegível: não ressuscita pelo cache
  let terminalOpen = true;
  const diskDead = { 'c.json': live };
  const dead = runReadSessions(diskDead, { alive: () => terminalOpen });
  assert.deepEqual(dead.read(), ['c']);
  diskDead['c.json'] = '{';
  terminalOpen = false;
  assert.deepEqual(dead.read(), [], 'a leitura boa antiga não vale para sessão de terminal fechado');

  // sessão com mais de 12 h: o caminho normal apaga o arquivo e a lista não a guarda
  const old = JSON.stringify({ state: 'running', updatedAt: 10_000 - 13 * 60 * 60_000 });
  const expired = runReadSessions({ 'd.json': old });
  assert.deepEqual(expired.read(), []);
  assert.deepEqual(expired.removed, ['d.json']);
});

// --- Fase 5: mola da troca de sessão (D-17) ---

const tabRules = loadInlineBlock(SPRING_START, SPRING_END, [
  'SPRING_TAB', 'TAB_SWITCH_OFFSET_PX', 'TAB_SWITCH_SCALE', 'springParams', 'springStep', 'isSpringAtRest',
  'REST_DISTANCE_PX', 'REST_SPEED_PX_S', 'tabSwitchFrame',
]);

test('springParams: a direção tab devolve a mola da troca do mod, sem fator de estilo, e a desconhecida segue neutra', () => {
  for (const style of ['default', 'bouncy', 'estilo-inventado']) {
    assert.deepEqual(plain(tabRules.springParams('tab', style)), { stiffness: 250, damping: 31 });
  }
  assert.deepEqual(plain(tabRules.SPRING_TAB), { stiffness: 250, damping: 31 });
  assert.equal(tabRules.TAB_SWITCH_OFFSET_PX, 34);
  assert.equal(tabRules.TAB_SWITCH_SCALE, 0.965);
  assert.notEqual(tabRules.springParams('tab', 'default'), tabRules.SPRING_TAB, 'cópia, nunca o objeto da constante');
  assert.deepEqual(plain(tabRules.springParams('sideways', 'snappy')), { stiffness: 280, damping: 24 });
});

test('tabSwitchFrame: escala e fade seguem o deslocamento, sem passar do deslocamento da troca e sem NaN', () => {
  const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
  for (const offset of [34, -34, 100, -100]) {
    assert.deepEqual(plain(tabRules.tabSwitchFrame(offset)), { scale: 0.965, opacity: 0 });
  }
  assert.deepEqual(plain(tabRules.tabSwitchFrame(0)), { scale: 1, opacity: 1 });
  const half = tabRules.tabSwitchFrame(17);
  near(half.scale, 0.9825);
  near(half.opacity, 0.5);
  for (const invalid of [NaN, undefined, '34', null, Infinity]) {
    assert.deepEqual(plain(tabRules.tabSwitchFrame(invalid)), { scale: 1, opacity: 1 }, `entrada ${String(invalid)}`);
  }
});

test('a mola da troca assenta em menos de 1 s a 1x e nunca passa de 1 px além do alvo, para os dois lados', () => {
  for (const start of [34, -34]) {
    for (const speed of [0.5, 1, 2]) {
      let current = {
        position: start, velocity: 0, target: 0, direction: 'tab',
        restDistance: tabRules.REST_DISTANCE_PX, restSpeed: tabRules.REST_SPEED_PX_S,
      };
      let elapsedMs = 0;
      let overshoot = 0;
      while (!tabRules.isSpringAtRest(current) && elapsedMs < 10_000) {
        current = tabRules.springStep(current, 16, 'default', speed);
        overshoot = Math.max(overshoot, current.position * -Math.sign(start));
        elapsedMs += 16;
      }
      assert.ok(tabRules.isSpringAtRest(current), `${start} a ${speed}×: não assentou`);
      assert.ok(overshoot <= 1, `${start} a ${speed}×: passou ${overshoot} px`);
      if (speed === 1) assert.ok(elapsedMs < 1000, `${start} a 1×: assentou em ${elapsedMs} ms`);
    }
  }
});

test('a cola liga a mola da troca ao laço, ao canArm e ao onState, antes de o estado novo virar o atual', () => {
  const literal = rendererLf.indexOf('const springs = {');
  const tab = rendererLf.indexOf('springs.tab = {');
  assert.ok(literal >= 0 && tab > literal, 'springs.tab entra depois do literal travado');
  assert.match(rendererLf.slice(tab, rendererLf.indexOf('};', tab)), /direction: 'tab'/);
  const apply = functionBody('applySprings');
  assert.ok(apply.includes('const tab = tabSwitchFrame(springs.tab.position);'));
  for (const piece of [
    "pill.style.setProperty('--tab-offset', `${springs.tab.position}px`);",
    "pill.style.setProperty('--tab-scale', String(tab.scale));",
    "pill.style.setProperty('--tab-fade', String(tab.opacity));",
  ]) {
    assert.ok(apply.includes(piece), `applySprings sem: ${piece}`);
  }
  const writers = apply.match(/\.style\.(?:transform|translate|scale)\b/g) || [];
  assert.equal(writers.length, 1, 'applySprings só escreve o transform da pílula, na linha travada');
  assert.ok(apply.includes('pill.style.transform = '));
  assert.ok(rendererLf.includes('const allSpringsAtRest = () => Object.values(springs).every(isSpringAtRest);'));
  assert.ok(rendererLf.includes('canArm({ settled: step.settled, springsAtRest: allSpringsAtRest() })'));
  const onState = rendererLf.slice(rendererLf.indexOf('window.island.onState('));
  const push = onState.indexOf('switchDirection * TAB_SWITCH_OFFSET_PX');
  assert.ok(push >= 0 && push < onState.indexOf('current = next;'), 'o empurrão decide antes de current = next');
  assert.ok(onState.includes('if (switchDirection !== 0) springs.tab = { ...springs.tab, position: switchDirection * TAB_SWITCH_OFFSET_PX, velocity: 0, target: 0 };'));
});

test('a mola da troca nunca alcança um botão da pílula: só #lead, #detail e #permission, sem botão dentro', () => {
  const rules = [...styleRules.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, , body]) => body.includes('var(--tab-'));
  assert.ok(rules.length >= 2, 'a regra da troca existe');
  const selectors = new Set();
  for (const [, selector] of rules) {
    for (const part of selector.split(',')) selectors.add(part.trim());
    assert.equal(/button|#sessions|#side|#bar|#open|#actions|#allow|#deny|#pill/.test(selector), false, `a troca alcança: ${selector.trim()}`);
  }
  assert.deepEqual([...selectors].sort(), ['#detail', '#lead', '#permission']);
  const between = (from, to) => rendererLf.slice(rendererLf.indexOf(from), rendererLf.indexOf(to));
  for (const [from, to] of [['id="lead"', 'id="side"'], ['id="detail"', 'id="permission"'], ['id="permission"', 'id="actions"']]) {
    const html = between(from, to);
    assert.ok(html.length > from.length, `trecho vazio: ${from}`);
    assert.equal(html.includes('<button'), false, `${from} contém botão`);
    assert.equal(html.includes('id="sessions"'), false, `${from} contém os pontos`);
  }
  assert.equal(rendererLf.split("createElement('button')").length - 1, 1, 'só um lugar cria botão');
  assert.ok(functionBody('renderSessions').includes("createElement('button')"), 'e é renderSessions');
});

test('o acento é uma cor registrada e a transição base da pílula o interpola sem animar o tamanho', () => {
  const property = rendererLf.match(/@property --accent \{([^{}]*)\}/);
  assert.ok(property, '@property --accent ausente');
  assert.match(property[1], /syntax:\s*'<color>'/);
  assert.match(property[1], /inherits:\s*true/);
  assert.match(property[1], /initial-value:\s*\S/);
  const transition = cssDeclarations('#pill').transition;
  assert.match(transition, /--accent \.18s ease-out/);
  assert.equal(/\b(?:width|height|transform)\b/.test(transition), false, 'a transição base não anima o tamanho');
  const media = rendererLf.slice(rendererLf.indexOf('@media (prefers-reduced-motion: reduce) {'), rendererLf.indexOf('</style>'));
  assert.match(media, /#pill,[^{]*\{[^}]*transition: opacity \.2s;/, 'com movimento reduzido a transição da pílula é só a opacidade, sem acento');
});

test('o bloco do pedido não usa o acento: tem tokens próprios e opacos', () => {
  const rules = [...styleRules.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, selector]) => selector.trim().startsWith('#permission'));
  assert.ok(rules.length >= 5, 'regras do pedido encontradas');
  for (const [, selector, body] of rules) {
    assert.equal(body.includes('var(--accent)'), false, `${selector.trim()} usa o acento`);
  }
  assert.match(rendererLf, /--perm-label: var\(--waiting\);/);
});

// Cada vetor de sessionSwitch encadeia as funções puras na mesma ordem do main (nextSelection no handler ou
// no poll, nextShownPermission no refresh, acceptDecision no island:decide). A cola em si, quem chama quem,
// é coberta pelas travas de texto abaixo: o main.js carrega o Electron e não roda no node --test.
const switchFacts = { behavior: 'allow', decidedId: null, windowVisible: true, coveredByFullscreen: false, withinVisibleArea: true };
for (const vector of vectors.sessionSwitch) {
  test(`sessionSwitch: ${vector.name}`, () => {
    const { selection, list, wheel, shownBefore, switchAt } = vector.input;
    const event = wheel ? { type: 'scroll', step: wheelStep(wheel.gesture, wheel.delta, wheel.now).step } : vector.input.event;
    const next = nextSelection(selection, list, event);
    const permissionId = list.find((entry) => entry.key === next.key)?.permissionId ?? null;
    const shown = nextShownPermission(shownBefore, permissionId, switchAt, false);
    const decide = (echoedId, now) => acceptDecision({ ...switchFacts, echoedId, shownId: shown.id, shownSince: shown.since, now });
    assert.equal(next.key, vector.expect.key);
    assert.equal(shown.id, vector.expect.shownId);
    assert.equal(shown.epoch, vector.expect.epoch);
    assert.deepEqual(decide(shown.id, switchAt + 799), vector.expect.before);
    assert.deepEqual(decide(shown.id, switchAt + 800), vector.expect.after);
    assert.deepEqual(decide(shownBefore.id, switchAt + 800), vector.expect.oldEcho);
  });
}

for (const vector of vectors.wheelStep) {
  test(`wheelStep: ${vector.name}`, () => {
    const { gesture, delta, now } = vector.input;
    assert.deepEqual(wheelStep(gesture, delta, now), vector.expect);
  });
}

for (const vector of vectors.nextSelection) {
  test(`nextSelection: ${vector.name}`, () => {
    const { selection, list, event } = vector.input;
    assert.deepEqual(nextSelection(selection, list, event), vector.expect);
  });
}

test('o nome inteiro do projeto vai no tooltip do título e do cabeçalho do pedido, onde o CSS o corta no fim', () => {
  assert.ok(rendererLf.includes('permissionProject.title = permissionProjectName;'));
  assert.ok(rendererLf.includes("title.title = title.textContent === current.project ? current.project : '';"));
  // o tooltip não pode virar texto da página nem mexer na largura reservada ao nome
  assert.match(rendererLf, /#permission-project \{[^}]*max-width: 140px;/);
  assert.match(rendererLf, /#pill\.multi-session #title \{ flex: 0 1 140px;/);
});

test('sendState: o aviso sonoro é da primeira ilha e nunca de uma troca feita pela roda ou pelo clique', () => {
  const sent = [];
  const makeIsland = (name) => ({ webContents: { getURL: () => 'file:///ilha', send: (...args) => sent.push([name, args[2]]) } });
  const first = makeIsland('primeira');
  const second = makeIsland('segunda');
  const sendState = vm.runInNewContext(`${mainFunctionBody('sendState')}\n}\nsendState`, {
    isIslandSender: () => true, ISLAND_URL: 'file:///ilha', islands: new Map([[1, first], [2, second]]),
    displayOf: () => ({}), fitsVisibleArea: () => true, lastPickedState: {}, decidedPermissionId: null,
    shown: { epoch: 1 }, preferences: {}, dragStartPositions: new Map(), savedOffsets: {}, stageEdgeOf: () => 'top',
  });
  sendState(first);
  sendState(second);
  sendState(first, false);
  sendState(first, true);
  sendState(second, true);
  assert.deepEqual(sent, [
    ['primeira', true], ['segunda', false], ['primeira', true], ['primeira', false], ['segunda', false],
  ]);
  // o aviso que falha não pode impedir o renderer de aplicar o estado novo
  const onState = rendererLf.slice(rendererLf.indexOf('window.island.onState('));
  const guarded = onState.indexOf('chime(CHIMES[next.state]);');
  assert.ok(guarded >= 0 && onState.lastIndexOf('try {', guarded) > onState.indexOf('if (shouldChime'), 'o chime roda dentro de try');
  assert.ok(onState.indexOf('} catch {', guarded) < onState.indexOf('current = next;'), 'o catch fecha antes de current = next');
});

test('as constantes de gesto e de snap do state.js são as do fixture', () => {
  assert.equal(SNAP_GESTURE_GAP_MS, vectors.snapGestureGapMs);
  assert.equal(SNAP_WHEEL_LOCK_MS, vectors.snapWheelLockMs);
  assert.equal(WHEEL_NOTCH_DELTA, vectors.wheelNotchDelta);
  assert.equal(WHEEL_GESTURE_PAUSE_MS, vectors.wheelGesturePauseMs);
  assert.equal(WHEEL_STEP_MS, vectors.wheelStepMs);
  assert.equal(WHEEL_PRECISE_STEP_MS, vectors.wheelPreciseStepMs);
  assert.equal(WHEEL_DELTA_MAX, vectors.wheelDeltaMax);
});
