const test = require('node:test');
const assert = require('node:assert/strict');
const {
  menuTemplate, PREFERENCE_LABELS, ANIMATION_SPEED_STEPS, DEFAULT_PREFERENCES, THEMES, SHAPES, ANIMATION_STYLES,
  ANIMATION_SPEED_MIN, ANIMATION_SPEED_MAX,
} = require('./state');

// Lista de valores que cada chave do menu deve oferecer. Os planos seguintes acrescentam linhas aqui.
const VALUES_BY_KEY = {
  theme: THEMES,
  shape: SHAPES,
  animationStyle: ANIMATION_STYLES,
  animationSpeed: ANIMATION_SPEED_STEPS,
};

const checkedValue = (submenu) => submenu.submenu.filter((item) => item.checked).map((item) => item.value);
const submenuOf = (template, label) => template.find((item) => item.label === label);

test('o menu padrão tem os quatro submenus, na ordem', () => {
  assert.deepEqual(
    menuTemplate(DEFAULT_PREFERENCES).map((item) => item.label),
    ['Tema', 'Forma', 'Estilo da animação', 'Velocidade da animação'],
  );
});

test('todo submenu com chave oferece exatamente a lista da chave, com um só marcado: o valor atual', () => {
  const template = menuTemplate(DEFAULT_PREFERENCES);
  for (const submenu of template.filter((item) => item.submenu)) {
    const keys = new Set(submenu.submenu.map((item) => item.key));
    assert.equal(keys.size, 1, `${submenu.label}: filhos com chaves diferentes`);
    const [key] = keys;
    assert.deepEqual(submenu.submenu.map((item) => item.value), [...VALUES_BY_KEY[key]], `${submenu.label}: valores`);
    assert.deepEqual(checkedValue(submenu), [DEFAULT_PREFERENCES[key]], `${submenu.label}: marcado`);
    for (const item of submenu.submenu) {
      assert.equal(item.type, 'radio');
      assert.ok(typeof item.label === 'string' && item.label !== '', `${submenu.label}: rótulo vazio`);
    }
  }
});

test('o valor atual vem das preferências recebidas', () => {
  const template = menuTemplate({ theme: 'nord', animationSpeed: 2 });
  assert.deepEqual(checkedValue(submenuOf(template, 'Tema')), ['nord']);
  assert.deepEqual(checkedValue(submenuOf(template, 'Velocidade da animação')), [2]);
  assert.equal(submenuOf(template, 'Tema').submenu.find((item) => item.checked).label, 'Nord');
  assert.equal(submenuOf(template, 'Velocidade da animação').submenu.find((item) => item.checked).label, '2×');
});

test('entrada inválida marca os padrões, sem lançar', () => {
  for (const input of [null, undefined, [], 'nord', { theme: 'x' }]) {
    const template = menuTemplate(input);
    assert.deepEqual(checkedValue(submenuOf(template, 'Tema')), [DEFAULT_PREFERENCES.theme]);
    assert.deepEqual(checkedValue(submenuOf(template, 'Forma')), [DEFAULT_PREFERENCES.shape]);
  }
});

test('o menu não muta a entrada e cada chamada devolve um array novo', () => {
  const input = Object.freeze({ theme: 'nord', shape: 'notch' });
  const first = menuTemplate(input);
  const second = menuTemplate(input);
  assert.notEqual(first, second);
  assert.notEqual(first[0], second[0]);
  assert.deepEqual(input, { theme: 'nord', shape: 'notch' });
});

test('todo valor de cada lista tem rótulo em pt-BR', () => {
  for (const [key, values] of Object.entries(VALUES_BY_KEY)) {
    for (const value of values) {
      const label = PREFERENCE_LABELS[key][String(value)];
      assert.ok(typeof label === 'string' && label !== '', `sem rótulo: ${key}=${value}`);
    }
  }
});

test('as velocidades do menu ficam na faixa aceita, incluem o padrão e estão congeladas', () => {
  assert.ok(Object.isFrozen(ANIMATION_SPEED_STEPS));
  assert.ok(Object.isFrozen(PREFERENCE_LABELS));
  assert.ok(ANIMATION_SPEED_STEPS.includes(DEFAULT_PREFERENCES.animationSpeed));
  for (const step of ANIMATION_SPEED_STEPS) {
    assert.ok(step >= ANIMATION_SPEED_MIN && step <= ANIMATION_SPEED_MAX, `fora da faixa: ${step}`);
  }
});
