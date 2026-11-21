const test = require('node:test');
const assert = require('node:assert/strict');
const { acceptDecision, PERMISSION_ARM_MS } = require('./state');
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
