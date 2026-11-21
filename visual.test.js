const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SHAPES } = require('./state');

// O arquivo no disco pode ser CRLF (core.autocrlf): as regexes abaixo assumem LF.
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const style = html.slice(html.indexOf('<style>') + '<style>'.length, html.indexOf('</style>'));
const script = html.slice(html.indexOf('<script>') + '<script>'.length, html.indexOf('</script>'));

// Regras planas do <style> (sem comentários): seletor sem espaços nas pontas e corpo como texto. Regra
// dentro de @media entra pelo seletor próprio; o @media em si não é plano e fica de fora.
const rules = [...style.replace(/\/\*[^]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(([, selector, body]) => ({ selector: selector.trim(), body }));

// Propriedade → valor de um corpo de regra.
function declarations(body) {
  return Object.fromEntries(
    body.split(';').map((entry) => entry.trim()).filter(Boolean).map((entry) => {
      const colon = entry.indexOf(':');
      return [entry.slice(0, colon).trim(), entry.slice(colon + 1).trim()];
    }),
  );
}

const rulesFor = (selector) => rules.filter((rule) => rule.selector === selector).map((rule) => declarations(rule.body));

// Raios do mod Dynamic Island for Windows (MIT; ver THIRD_PARTY_NOTICES.md). A pílula (o padrão) não
// tem regra própria: o raio vem de --radius, metade da altura-alvo limitada a PILL_MAX_RADIUS_PX.
const SHAPE_RADII = { win11: '8px', notch: '0 0 16px 16px' };

test('cada forma de SHAPES, fora a pílula, tem a sua regra de raio', () => {
  assert.deepEqual(Object.keys(SHAPE_RADII).sort(), SHAPES.filter((shape) => shape !== 'pill').sort(), 'forma nova pede raio aqui');
  for (const [shape, radius] of Object.entries(SHAPE_RADII)) {
    const found = rulesFor(`:root[data-shape="${shape}"] #pill`);
    assert.equal(found.length, 1, `regra de ${shape}`);
    assert.equal(found[0]['border-radius'], radius, `raio de ${shape}`);
  }
});

test('nenhuma regra mira uma forma que o main não aceita', () => {
  const named = [...style.matchAll(/\[data-shape="([^"]*)"\]/g)].map((match) => match[1]);
  assert.ok(named.length > 0);
  for (const shape of named) assert.ok(SHAPES.includes(shape), `forma fora de SHAPES: ${shape}`);
});

test('o notch cola a pílula no topo do palco e as outras formas deixam o respiro de 8 px', () => {
  assert.ok(rulesFor(':root').some((found) => found['--stage-top'] === '8px'), 'o :root base declara --stage-top: 8px');
  const notch = rulesFor(':root[data-shape="notch"]');
  assert.equal(notch.length, 1);
  assert.match(notch[0]['--stage-top'], /^0(px)?$/);
  assert.equal(rulesFor('body')[0]['padding-top'], 'var(--stage-top)');
});

test('o raio da pílula vem de --radius e nenhuma regra o fixa em 30 px', () => {
  assert.match(rulesFor('#pill')[0]['border-radius'], /^var\(--radius\b/);
  assert.equal(rulesFor('#pill.expanded')[0]['border-radius'], undefined, 'a expandida usa o mesmo raio');
  for (const { selector, body } of rules) {
    assert.equal(/border-radius:\s*30px/.test(body), false, `raio fixo de 30 px em ${selector}`);
  }
  assert.equal(rulesFor('#pill::before')[0]['border-radius'], 'inherit', 'o brilho segue o raio da pílula');
});

test('o script grava --radius com metade da altura-alvo limitada a 44 px', () => {
  assert.match(script, /const PILL_MAX_RADIUS_PX = 44;/);
  assert.ok(script.includes("pill.style.setProperty('--radius', `${Math.min(target.height / 2, PILL_MAX_RADIUS_PX)}px`);"));
});

test('a forma só vem do payload e trocá-la com pedido na tela rearma', () => {
  const apply = script.slice(script.indexOf('function applyPreferences('));
  const body = apply.slice(0, apply.indexOf('\n  }\n'));
  assert.ok(body.includes('root.dataset.shape = shape;'));
  assert.ok(body.includes('if (changed && current.permission) restartArming();'));
});
