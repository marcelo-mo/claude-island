const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const renderer = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const preloadSource = fs.readFileSync(path.join(__dirname, 'preload.js'), 'utf8').replace(/\r\n/g, '\n');

const HOVER_START = '// hover:inicio';
const HOVER_END = '// hover:fim';

// ponytail: duplicada de gate.test.js (8 linhas) em vez de um helper compartilhado; extrair para um
// arquivo comum se um terceiro teste precisar.
function loadInlineBlock(startMarker, endMarker, exported) {
  for (const marker of [startMarker, endMarker]) {
    assert.equal(renderer.split(marker).length - 1, 1, `marcador ausente ou repetido no index.html: ${marker}`);
  }
  const start = renderer.indexOf(startMarker) + startMarker.length;
  const block = renderer.slice(start, renderer.indexOf(endMarker));
  return vm.runInNewContext(`${block}\n({ ${exported.join(', ')} })`, Object.create(null));
}

// Corpo de uma função do renderer: do `function nome(` até o fecha-chaves recuado de 2 espaços.
function functionBody(name) {
  const start = renderer.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `função ausente: ${name}`);
  return renderer.slice(start, renderer.indexOf('\n  }\n', start));
}

const hover = () => loadInlineBlock(HOVER_START, HOVER_END, ['HOVER_ENTER_PX', 'HOVER_LEAVE_PX', 'hoverStep', 'shouldExpand']);

test('as constantes da histerese são 2 px para entrar e 8 px para sair', () => {
  const { HOVER_ENTER_PX, HOVER_LEAVE_PX } = hover();
  assert.equal(HOVER_ENTER_PX, 2);
  assert.equal(HOVER_LEAVE_PX, 8);
});

// Retângulo de 200 × 46 px; o centro vertical é y 31.
const RECT = { left: 60, top: 8, right: 260, bottom: 54 };

test('hoverStep: histerese contra o retângulo vivo da pílula', () => {
  const { hoverStep } = hover();
  const step = (inside, x, y = 31, rect = RECT) => hoverStep({ inside, point: { x, y }, rect });
  // fora: só entra 2 px para dentro
  assert.equal(step(false, 160), true, 'fora, no centro');
  assert.equal(step(false, 60), false, 'fora, exatamente na borda esquerda');
  assert.equal(step(false, 62), true, 'fora, 2 px dentro');
  assert.equal(step(false, 61), false, 'fora, 1 px dentro');
  assert.equal(step(false, 258), true, 'fora, 2 px dentro da borda direita');
  assert.equal(step(false, 259), false, 'fora, 1 px dentro da borda direita');
  assert.equal(step(false, 160, 10), true, 'fora, 2 px dentro da borda de cima');
  assert.equal(step(false, 160, 9), false, 'fora, 1 px dentro da borda de cima');
  assert.equal(step(false, 160, 52), true, 'fora, 2 px dentro da borda de baixo');
  assert.equal(step(false, 160, 53), false, 'fora, 1 px dentro da borda de baixo');
  // dentro: só sai 8 px para fora
  assert.equal(step(true, 52), true, 'dentro, 8 px fora');
  assert.equal(step(true, 51), false, 'dentro, 9 px fora');
  assert.equal(step(true, 57), true, 'dentro, 3 px fora (deriva a 125%)');
  assert.equal(step(true, 60), true, 'dentro, na borda');
  assert.equal(step(true, 268), true, 'dentro, 8 px fora da borda direita');
  assert.equal(step(true, 269), false, 'dentro, 9 px fora da borda direita');
  assert.equal(step(true, 160, 0), true, 'dentro, 8 px acima');
  assert.equal(step(true, 160, -1), false, 'dentro, 9 px acima');
  assert.equal(step(true, 160, 62), true, 'dentro, 8 px abaixo');
  assert.equal(step(true, 160, 63), false, 'dentro, 9 px abaixo');
  // retângulo fracionário, como o da mola
  const fractional = { left: 59.5, top: 8, right: 260.75, bottom: 54 };
  assert.equal(step(false, 61.5, 31, fractional), true, 'fracionário, 2 px dentro');
  assert.equal(step(false, 61.4, 31, fractional), false, 'fracionário, menos de 2 px dentro');
});

test('hoverStep: entrada inválida é não capturar, sem lançar', () => {
  const { hoverStep } = hover();
  const base = { inside: true, point: { x: 160, y: 31 }, rect: RECT };
  assert.equal(hoverStep(base), true);
  assert.equal(hoverStep({ ...base, point: null }), false);
  assert.equal(hoverStep({ ...base, rect: null }), false);
  assert.equal(hoverStep({ ...base, point: { x: NaN, y: 31 } }), false);
  assert.equal(hoverStep({ ...base, point: { x: 160, y: '31' } }), false);
  assert.equal(hoverStep({ ...base, point: { x: Infinity, y: 31 } }), false);
  assert.equal(hoverStep({ ...base, rect: { ...RECT, right: NaN } }), false);
  assert.equal(hoverStep({ ...base, rect: { ...RECT, top: '8' } }), false);
  assert.equal(hoverStep({ ...base, rect: { left: 60 } }), false);
  assert.equal(hoverStep(null), false);
  assert.equal(hoverStep(undefined), false);
  assert.equal(hoverStep(), false);
});

test('hoverStep: só inside exatamente true usa a margem de saída', () => {
  const { hoverStep } = hover();
  const point = { x: 52, y: 31 }; // 8 px fora
  assert.equal(hoverStep({ inside: true, point, rect: RECT }), true);
  assert.equal(hoverStep({ inside: 'true', point, rect: RECT }), false);
  assert.equal(hoverStep({ inside: 1, point, rect: RECT }), false);
  assert.equal(hoverStep({ point, rect: RECT }), false);
});

// Travas da cola (texto): as regras puras têm tabela, mas a ligação delas ao DOM e ao main não.
test('o hover vem só do cursor do main: nenhum evento de mouse do DOM na pílula nem o setter antigo', () => {
  assert.equal(renderer.split(HOVER_START).length - 1, 1);
  assert.equal(/pill\.addEventListener\('mouse(enter|leave|move|over|out)'/.test(renderer), false);
  assert.equal(/setHover/.test(renderer), false, 'index.html com o setter de hover antigo');
  assert.equal(/setHover/.test(preloadSource), false, 'preload.js com o setter de hover antigo');
  assert.equal(renderer.includes('island:hover'), false);
  assert.equal(renderer.split('window.island.onCursor(').length - 1, 1);
  assert.ok(renderer.includes('window.island.onCursor((point) => { lastCursorPoint = point; updateHover(); });'));
  assert.ok(preloadSource.includes("onCursor: (callback) => ipcRenderer.on('island:cursor', (_event, point) => callback(point)),"));
  assert.ok(preloadSource.includes("setCapture: (capture) => ipcRenderer.send('island:capture', capture),"));
});

test('updateHover não arma, não desarma nem decide: só hover e captura (D-04)', () => {
  const body = functionBody('updateHover');
  for (const needle of ['if (drag) return;', "current.state !== 'idle' && hoverStep({", 'window.island.setCapture(hovering);']) {
    assert.ok(body.includes(needle), `updateHover sem: ${needle}`);
  }
  assert.ok(body.includes('rect: pill.getBoundingClientRect()'), 'o retângulo é o da pílula viva');
  for (const forbidden of ['restartArming', 'armed', 'decide']) {
    assert.equal(body.includes(forbidden), false, `updateHover não pode tocar: ${forbidden}`);
  }
});

test('o fim do arraste reavalia o hover pelo último ponto e o armamento dos botões segue', () => {
  const listener = renderer.slice(renderer.indexOf("pill.addEventListener('lostpointercapture'"));
  const body = listener.slice(0, listener.indexOf('\n  });'));
  assert.ok(body.includes('updateHover();'));
  assert.equal(body.includes('clientX'), false, 'o hover não sai mais do ponteiro do DOM');
  assert.ok(renderer.includes("actions.addEventListener('pointermove', () => { lastPointerMoveAt = performance.now(); });"));
  assert.equal(renderer.split("document.addEventListener('visibilitychange'").length - 1, 3);
});

// ---- Expandir no hover ou no clique, e fixar aberta (D-04, D-05) ----

test('shouldExpand: Precisa de você abre sozinho, com qualquer combinação', () => {
  const { shouldExpand } = hover();
  for (const hovering of [true, false]) {
    for (const clickExpanded of [true, false]) {
      for (const expandOn of ['hover', 'click', 'tap', undefined]) {
        for (const pinExpanded of [true, false]) {
          assert.equal(shouldExpand({ state: 'waiting', hovering, clickExpanded, expandOn, pinExpanded }), true);
        }
      }
    }
  }
});

test('shouldExpand: Trabalhando segue a preferência', () => {
  const { shouldExpand } = hover();
  const running = (change) => shouldExpand({
    state: 'running', hovering: false, clickExpanded: false, expandOn: 'hover', pinExpanded: false, ...change,
  });
  assert.equal(running({ hovering: true }), true, 'hover, com o cursor');
  assert.equal(running({ hovering: false }), false, 'hover, sem o cursor');
  assert.equal(running({ hovering: 'true' }), false, 'hovering de texto não vale');
  assert.equal(running({ expandOn: 'click', hovering: true }), false, 'clique: o cursor sozinho não expande');
  assert.equal(running({ expandOn: 'click', hovering: true, clickExpanded: true }), true, 'clique: depois do clique');
  assert.equal(running({ expandOn: 'click', hovering: true, clickExpanded: 'true' }), false, 'clickExpanded de texto não vale');
  assert.equal(running({ pinExpanded: true }), true, 'fixada, sem hover nem clique');
  assert.equal(running({ pinExpanded: true, expandOn: 'click' }), true, 'fixada, no modo clique');
  assert.equal(running({ pinExpanded: 'true' }), false, 'pinExpanded de texto não vale');
  assert.equal(running({ expandOn: 'tap', hovering: true }), true, 'valor desconhecido segue a regra do hover');
  assert.equal(running({ expandOn: 'tap', hovering: false }), false);
  assert.equal(running({ expandOn: undefined, hovering: true }), true);
});

test('shouldExpand: Concluído e ociosa nunca expandem, nem fixadas', () => {
  const { shouldExpand } = hover();
  for (const state of ['done', 'idle', 'bogus', undefined]) {
    assert.equal(shouldExpand({ state, hovering: true, clickExpanded: true, expandOn: 'hover', pinExpanded: true }), false);
    assert.equal(shouldExpand({ state, hovering: true, clickExpanded: true, expandOn: 'click', pinExpanded: true }), false);
  }
});

test('shouldExpand: entrada ausente é false', () => {
  const { shouldExpand } = hover();
  assert.equal(shouldExpand(null), false);
  assert.equal(shouldExpand(undefined), false);
  assert.equal(shouldExpand(), false);
});

test('a cola da expansão: uma chamada só em renderContent, o clique expande e sair do hover desfaz o clique', () => {
  const body = functionBody('renderContent');
  assert.ok(body.includes(
    "pill.classList.toggle('expanded', shouldExpand({ state: current.state, hovering, clickExpanded, "
      + 'expandOn: current.preferences?.expandOn, pinExpanded: current.preferences?.pinExpanded }));',
  ));
  assert.equal(body.includes('expandsOnHover'), false, 'o cálculo antigo da expansão saiu');
  const update = functionBody('updateHover');
  assert.ok(update.includes('clickExpanded = false;'), 'sair do hover recolhe o modo clique');
  const listener = renderer.slice(renderer.indexOf("pill.addEventListener('lostpointercapture'"));
  const listenerBody = listener.slice(0, listener.indexOf('\n  });'));
  assert.ok(listenerBody.includes('clickExpanded = true;'));
  assert.ok(listenerBody.includes("current.preferences?.expandOn === 'click'"));
  assert.ok(listenerBody.indexOf('updateHover();') < listenerBody.indexOf('clickExpanded = true;'), 'reavalia o hover antes de expandir');
  for (const forbidden of ['restartArming', 'armed', 'decide(']) {
    assert.equal(listenerBody.includes(forbidden), false, `o clique de expandir não pode tocar: ${forbidden}`);
  }
});
