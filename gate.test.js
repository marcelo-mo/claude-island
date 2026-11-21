const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
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
