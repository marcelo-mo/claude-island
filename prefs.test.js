const test = require('node:test');
const assert = require('node:assert/strict');
const {
  menuTemplate, PREFERENCE_LABELS, ANIMATION_SPEED_STEPS, DEFAULT_PREFERENCES, THEMES, SHAPES, ANIMATION_STYLES,
  ANIMATION_SPEED_MIN, ANIMATION_SPEED_MAX, normalizePreferences, quarantinePath, isSessionFile, EXPAND_ON, OPACITY_LEVELS,
  ANCHORS, ISLAND_MODES, DEFAULT_SHORTCUT, PREFERENCES_VERSION, PREFERENCES_MAX_BYTES, PREFERENCE_VALIDATORS,
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

// ---- Esquema completo e quarentena (D-06, D-07) ----

const SCHEMA_KEYS = [
  'theme', 'shape', 'animationStyle', 'animationSpeed', 'expandOn', 'pinExpanded', 'opacity', 'anchor',
  'islandMode', 'shortcut', 'version',
];
const normalizeKey = (key, value) => normalizePreferences({ [key]: value })[key];

test('entrada que não é objeto devolve um objeto novo igual ao padrão', () => {
  for (const input of [undefined, null, [], 'nord', 7, true]) {
    const result = normalizePreferences(input);
    assert.deepEqual(result, DEFAULT_PREFERENCES);
    assert.notEqual(result, DEFAULT_PREFERENCES);
  }
});

test('o formato da Fase 3 devolve as 11 chaves: as 4 antigas e o padrão nas outras', () => {
  const phase3 = { theme: 'nord', shape: 'notch', animationStyle: 'bouncy', animationSpeed: 2 };
  assert.deepEqual(normalizePreferences(phase3), { ...DEFAULT_PREFERENCES, ...phase3 });
  assert.equal(Object.keys(normalizePreferences(phase3)).length, 11);
});

test('expandOn: só hover e click', () => {
  assert.equal(normalizeKey('expandOn', 'click'), 'click');
  for (const value of ['Click', 'tap', 1]) assert.equal(normalizeKey('expandOn', value), 'hover');
});

test('pinExpanded: só booleano', () => {
  assert.equal(normalizeKey('pinExpanded', true), true);
  for (const value of ['true', 1, null]) assert.equal(normalizeKey('pinExpanded', value), false);
});

test('opacity: só os degraus, a ilha nunca fica invisível', () => {
  for (const value of [1, 0.85, 0.7, 0.55]) assert.equal(normalizeKey('opacity', value), value);
  for (const value of [0, 0.5, 0.851, '0.85', NaN, -1, 2]) assert.equal(normalizeKey('opacity', value), 1, String(value));
});

test('anchor: só as seis âncoras', () => {
  for (const value of ANCHORS) assert.equal(normalizeKey('anchor', value), value);
  for (const value of ['top', 'TOP-LEFT', 'constructor']) assert.equal(normalizeKey('anchor', value), 'top-center');
});

test('islandMode: perDisplay, primary e cursor', () => {
  for (const value of ['perDisplay', 'primary', 'cursor']) assert.equal(normalizeKey('islandMode', value), value);
  assert.equal(normalizeKey('islandMode', 'per-display'), 'perDisplay');
});

test('shortcut: só letras, números e +, até 64 caracteres', () => {
  for (const value of ['Control+Alt+Shift+C', 'F12', 'CommandOrControl+Shift+Z']) {
    assert.equal(normalizeKey('shortcut', value), value);
  }
  for (const value of ['', 'Control+Alt+&', 'Control++C', 'a'.repeat(65), 7, 'Control+Alt+Shift+C\n']) {
    assert.equal(normalizeKey('shortcut', value), DEFAULT_SHORTCUT, JSON.stringify(value));
  }
});

test('version: inteiro a partir de 1', () => {
  for (const value of [1, 2]) assert.equal(normalizeKey('version', value), value);
  for (const value of [0, 1.5, '1', -1]) assert.equal(normalizeKey('version', value), PREFERENCES_VERSION);
});

test('animationSpeed 0 vira 1: a ilha nunca fica parada', () => {
  assert.equal(normalizeKey('animationSpeed', 0), 1);
  assert.equal(normalizeKey('animationSpeed', 0.5), 0.5);
  assert.equal(normalizeKey('animationSpeed', 2), 2);
});

test('__proto__ e herança não entram: só chave própria do esquema conta', () => {
  const hostile = normalizePreferences(JSON.parse('{"__proto__":{"opacity":0.55},"theme":"nord"}'));
  assert.equal(hostile.theme, 'nord');
  assert.equal(hostile.opacity, 1);
  assert.equal(normalizePreferences(Object.create({ opacity: 0.55 })).opacity, 1);
});

test('o resultado tem exatamente as chaves do esquema, na ordem, sem chave extra nem mutar a entrada', () => {
  const input = { theme: 'slate', cor: 'vermelho' };
  const snapshot = JSON.stringify(input);
  const result = normalizePreferences(input);
  assert.deepEqual(Object.keys(result), SCHEMA_KEYS);
  assert.deepEqual(Object.keys(DEFAULT_PREFERENCES), SCHEMA_KEYS);
  assert.equal(JSON.stringify(input), snapshot);
  assert.deepEqual(Object.keys(PREFERENCE_VALIDATORS), SCHEMA_KEYS);
});

test('DEFAULT_PREFERENCES e as listas novas estão congelados, e normalizar o padrão devolve o padrão', () => {
  assert.ok(Object.isFrozen(DEFAULT_PREFERENCES));
  assert.deepEqual(normalizePreferences(DEFAULT_PREFERENCES), DEFAULT_PREFERENCES);
  assert.ok(Object.isFrozen(PREFERENCE_VALIDATORS));
  for (const [list, key] of [[EXPAND_ON, 'expandOn'], [OPACITY_LEVELS, 'opacity'], [ANCHORS, 'anchor'], [ISLAND_MODES, 'islandMode']]) {
    assert.ok(Object.isFrozen(list), key);
    assert.ok(list.includes(DEFAULT_PREFERENCES[key]), key);
  }
});

test('o atalho padrão leva Shift e não é Control+Alt mais C, E, Q ou W', () => {
  // Medido no ABNT2 do autor: AltGr+C produz ¢ (e AltGr+E, Q e W também produzem caractere), e o
  // register() do Electron não enxerga esse conflito. Com Ctrl+Alt+Shift nenhuma letra produz caractere.
  assert.equal(DEFAULT_SHORTCUT, 'Control+Alt+Shift+C');
  assert.ok(DEFAULT_SHORTCUT.includes('Shift'));
  assert.equal(/^Control\+Alt\+[CEQW]$/.test(DEFAULT_SHORTCUT), false);
});

test('o teto do arquivo de preferências é 64 KB', () => {
  assert.equal(PREFERENCES_MAX_BYTES, 65536);
});

test('quarentena e temporário nunca são lidos como sessão', () => {
  for (const name of ['preferences.json.bad', 'preferences.json.tmp', 'preferences.json.1732200000000.bad']) {
    assert.equal(isSessionFile(name), false, name);
  }
});

test('quarantinePath leva o carimbo de tempo e nunca repete caminho', () => {
  assert.equal(quarantinePath('/x/preferences.json', 1732200000000), '/x/preferences.json.1732200000000.bad');
  assert.notEqual(quarantinePath('/x/preferences.json', 1), quarantinePath('/x/preferences.json', 2));
  const named = quarantinePath('/x/preferences.json', 1732200000000);
  assert.ok(named.endsWith('.bad'));
  assert.equal(isSessionFile(named.split('/').pop()), false);
  for (const now of [NaN, undefined, '1']) assert.equal(quarantinePath('/x/preferences.json', now), '/x/preferences.json.bad');
  assert.equal(quarantinePath('/x/preferences.json', 1.9), '/x/preferences.json.1.bad');
});
