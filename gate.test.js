const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {
  acceptDecision, isWithinWorkArea, nextShownPermission, PERMISSION_ARM_MS, SECURE_WEB_PREFERENCES,
  effectiveOpacity, isIslandSender, ANIMATION_STYLES, DEFAULT_PREFERENCES, WINDOW_SIZE, HORIZONTAL_SLACK,
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
  'island:state', 'island:hover', 'island:focus', 'island:decide', 'island:drag', 'island:drag-end', 'island:reset-position',
];

test('o preload usa só send e on, nos sete canais conhecidos', () => {
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
  assert.equal(handlers.length, 6);
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

test('o main escuta só com ipcMain.on, nos seis canais do renderer', () => {
  const { methods, channels } = collectChannels(mainSource, 'ipcMain');
  assert.deepEqual([...methods], ['on']);
  assert.deepEqual([...channels].sort(), RENDERER_CHANNELS.filter((channel) => channel !== 'island:state').sort());
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
    ['coveredByFullscreen', 'false'],
    ['withinVisibleArea', 'Boolean(display) && isWithinWorkArea(island.getBounds(), display.workArea, HORIZONTAL_SLACK)'],
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
    '{ ...lastPickedState, answeredId: decidedPermissionId, armEpoch: shown.epoch, preferences }',
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

test('a roda sobre o texto não vaza e não rola na janela depois da troca', () => {
  assert.match(rendererSource, /permissionText\.addEventListener\('wheel', \(event\) => \{\s*event\.stopPropagation\(\);\s*if \(!isWheelSettled\(contentChangedAt, performance\.now\(\)\)\) event\.preventDefault\(\);\s*\}, \{ passive: false \}\);/);
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

// Travas de regressão (texto) das preferências visuais: o main só lê o arquivo, uma vez, sem
// vigiá-lo nem gravá-lo (a gravação, o menu e a migração são da Fase 4), e o renderer só aplica o
// que veio no payload. Canal novo para o renderer escolher preferência quebraria RENDERER_CHANNELS.
test('o main lê as preferências uma única vez e nunca as vigia nem as grava', () => {
  assert.ok(mainSource.includes(
    "preferences = normalizePreferences(JSON.parse(fs.readFileSync(PREFERENCES_FILE, 'utf8')));",
  ), 'main.js sem a leitura normalizada do preferences.json');
  assert.equal(mainSource.split('loadPreferences()').length - 1, 2, 'loadPreferences: definição e uma só chamada');
  assert.equal(/\.watch(?:File)?\(/.test(mainSource), false, 'main.js vigia um arquivo');
  assert.equal(/writeFileSync\(\s*PREFERENCES_FILE/.test(mainSource), false, 'main.js grava o preferences.json');
});

test('o renderer aplica as preferências do payload e rearma se mudaram com pedido na tela', () => {
  const onState = rendererSource.slice(rendererSource.indexOf('window.island.onState('));
  assert.ok(onState.indexOf('answeredPermissionId = null;') >= 0);
  assert.ok(
    onState.indexOf('applyPreferences(next.preferences);') > onState.indexOf('answeredPermissionId = null;'),
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

// Altura da pílula com o pior pedido, somada das regras do CSS (hoje 46 + 31,2 + 165,6 + 40,9 + 16 ≈ 299,7):
//   barra (#bar) ........................ 46
//   detalhe (#detail): 2 linhas de 12 px . 12 × 1,3 × 2 = 31,2
//   pedido (#permission) ................ margem 8 + padding 16 + título (11 × 1,3 + 3) + texto com max-height 105
//                                         + dica (5 + 11 × 1,3) = 165,6
//   ações (#actions) .................... margem 8 + botão (13 × 1,3 + 8 × 2) = 40,9
//   respiro de baixo (has-permission) ... 16
function pillMaxHeight() {
  const bar = cssPixels(cssDeclarations('#bar').height, 'altura de #bar');
  const detail = textLine('#detail') * Number(cssDeclarations('#detail')['-webkit-line-clamp']);
  const permission = cssDeclarations('#permission');
  const tool = cssDeclarations('#permission-tool');
  const hint = cssDeclarations('#permission-hint');
  const permissionHeight = cssPixels(permission['margin-top'], 'margin-top de #permission')
    + verticalPadding(permission.padding, 'padding de #permission')
    + textLine('#permission-tool') + cssPixels(tool['margin-bottom'], 'margin-bottom de #permission-tool')
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
      const heightPeak = Math.max(
        worstPeak(spring, PILL_MIN.height, maxHeight, style, speed),
        worstPeak(spring, PILL_MIN.height, windowHeight, style, speed),
      );
      // A escala amplia a partir do centro do topo: a largura cresce dos dois lados e a altura só para baixo.
      const neededWidth = widthPeak * hoverPeak + 2 * SHADOW_MARGIN_PX;
      const neededHeight = stageTop + heightPeak * hoverPeak + nudgeRebound + SHADOW_MARGIN_PX;
      const where = `${style} a ${speed}×: pico ${widthPeak.toFixed(1)}×${heightPeak.toFixed(1)}, precisa de ${neededWidth.toFixed(1)}×${neededHeight.toFixed(1)}, palco ${WINDOW_SIZE.width}×${WINDOW_SIZE.height}`;
      assert.ok(WINDOW_SIZE.width >= neededWidth, `largura do palco curta: ${where}`);
      assert.ok(WINDOW_SIZE.height >= neededHeight, `altura do palco curta: ${where}`);
    }
  }
});

test('a folga horizontal é o que sobra de cada lado da pílula expandida e o palco é congelado', () => {
  assert.equal(HORIZONTAL_SLACK, (WINDOW_SIZE.width - expandedWidth) / 2);
  assert.ok(Object.isFrozen(WINDOW_SIZE));
  assert.ok(Number.isInteger(WINDOW_SIZE.width) && Number.isInteger(WINDOW_SIZE.height));
});
