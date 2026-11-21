const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { acceptDecision, isWithinWorkArea, nextShownPermission, PERMISSION_ARM_MS } = require('./state');
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

// Os testes de fonte abaixo são travas de regressão baratas e assumidamente frágeis (leem texto):
// não provam comportamento. Se um comentário em main.js quebrar a contagem, ajuste o comentário.
const mainSource = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');

test('o pedido exibido só é atribuído na declaração e dentro de refresh (invariante I2)', () => {
  const assignments = mainSource.match(/(?<![\w.])shown\s*=(?!=)/g) || [];
  assert.equal(assignments.length, 2);
  assert.ok(mainSource.includes('function refresh(reason)'));
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

function loadRendererRules() {
  for (const marker of [RULES_START, RULES_END]) {
    assert.equal(rendererSource.split(marker).length - 1, 1, `marcador ausente ou repetido no index.html: ${marker}`);
  }
  const start = rendererSource.indexOf(RULES_START) + RULES_START.length;
  const block = rendererSource.slice(start, rendererSource.indexOf(RULES_END));
  const exported = [
    'PERMISSION_ARM_MS', 'SETTLE_STABLE_MS', 'PRESS_DWELL_MS', 'WHEEL_SETTLE_MS', 'READ_TOLERANCE_PX',
    'settleStep', 'canPress', 'isValidRelease', 'isWheelSettled', 'canMarkRead',
  ];
  return vm.runInNewContext(`${block}\n({ ${exported.join(', ')} })`, Object.create(null));
}

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
