const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// O arquivo no disco pode ser CRLF (core.autocrlf): as regexes abaixo assumem LF.
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').replace(/\r\n/g, '\n');

// Corpo de cada @keyframes, respeitando as chaves aninhadas.
function keyframeBlocks(css) {
  const blocks = [];
  const open = /@keyframes\s+([\w-]+)\s*\{/g;
  let match;
  while ((match = open.exec(css))) {
    let depth = 1;
    let end = open.lastIndex;
    while (depth > 0 && end < css.length) {
      if (css[end] === '{') depth += 1;
      if (css[end] === '}') depth -= 1;
      end += 1;
    }
    blocks.push({ name: match[1], body: css.slice(open.lastIndex, end - 1), start: match.index, end });
  }
  return blocks;
}

// Seletores das regras (sem aninhamento) cujo corpo satisfaz o teste; os @keyframes ficam de fora.
function selectorsWhere(css, bodyTest) {
  let flat = css;
  for (const block of keyframeBlocks(css).reverse()) flat = flat.slice(0, block.start) + flat.slice(block.end);
  return [...flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, , body]) => bodyTest(body))
    .map(([, selector]) => selector.trim());
}

test('animações contínuas só mexem em opacity e transform (nada que repinte)', () => {
  const blocks = keyframeBlocks(html);
  assert.ok(blocks.length > 0);
  for (const { name, body } of blocks) {
    const properties = [...body.matchAll(/([\w-]+)\s*:/g)].map((found) => found[1]);
    assert.deepEqual(properties.filter((p) => p !== 'opacity' && p !== 'transform'), [], `@keyframes ${name}`);
  }
});

test('o estado base de #pill (ilha parada) não declara animation', () => {
  assert.doesNotMatch(html, /\n\s*#pill\s*\{[^}]*\banimation\s*:/);
});

test('o brilho só anima fora do estado ocioso, numa camada própria', () => {
  const animatingGlow = selectorsWhere(html, (body) => /\banimation\s*:[^;]*\bglow\b/.test(body));
  assert.deepEqual(animatingGlow, ['#pill:not([data-state="idle"])::before']);
});

test('a página escondida pausa toda animação, e o listener de visibilitychange marca o estado', () => {
  const pausing = selectorsWhere(html, (body) => /animation-play-state\s*:\s*paused/.test(body));
  assert.ok(pausing.some((selector) => selector.includes('html[data-hidden="true"]')), 'sem pausa sob data-hidden');
  assert.match(html, /addEventListener\('visibilitychange',.*document\.documentElement\.dataset\.hidden = document\.hidden/);
});

test('com movimento reduzido o brilho também fica parado', () => {
  const reduced = html.match(/@media \(prefers-reduced-motion: reduce\) \{([^{}]*)\{/);
  assert.ok(reduced, 'regra de reduced-motion não encontrada');
  assert.ok(reduced[1].includes('#pill::before'));
});
