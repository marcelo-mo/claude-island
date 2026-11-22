const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SHAPES, THEMES, ANCHORS, STAGE_SHADOW_PX } = require('./state');

// O arquivo no disco pode ser CRLF (core.autocrlf): as regexes abaixo assumem LF.
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const style = html.slice(html.indexOf('<style>') + '<style>'.length, html.indexOf('</style>'));
const script = html.slice(html.indexOf('<script>') + '<script>'.length, html.indexOf('</script>'));

const styleNoComments = style.replace(/\/\*[^]*?\*\//g, '');

// O @media do esquema claro sai do texto por contagem de chaves (molde de keyframeBlocks em
// animation.test.js): a regra de dentro só vale no auto, e não pode se misturar às regras de topo.
const LIGHT_MEDIA = '@media (prefers-color-scheme: light) {';
const lightStart = styleNoComments.indexOf(LIGHT_MEDIA);
let lightEnd = lightStart + LIGHT_MEDIA.length;
for (let depth = 1; depth > 0 && lightEnd < styleNoComments.length; lightEnd += 1) {
  if (styleNoComments[lightEnd] === '{') depth += 1;
  if (styleNoComments[lightEnd] === '}') depth -= 1;
}
const lightBody = lightStart < 0 ? '' : styleNoComments.slice(lightStart + LIGHT_MEDIA.length, lightEnd - 1);
const topLevelStyle = lightStart < 0 ? styleNoComments : styleNoComments.slice(0, lightStart) + styleNoComments.slice(lightEnd);

// Regras planas do <style> (sem comentários): seletor sem espaços nas pontas e corpo como texto. Regra
// dentro de @media entra pelo seletor próprio; o @media em si não é plano e fica de fora.
const flatRules = (css) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(([, selector, body]) => ({ selector: selector.trim(), body }));
const rules = flatRules(topLevelStyle);
const lightRules = flatRules(lightBody);

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

// O teto é o raio do bloco de pedido mais o respiro lateral da expandida: cantos concêntricos, e a curva
// não encosta no conteúdo da linha de cima. Mudar um dos dois pede rever o outro.
test('o script grava --radius com metade da altura-alvo limitada ao raio concêntrico da expandida', () => {
  const ceiling = Number(/const PILL_MAX_RADIUS_PX = (\d+);/.exec(script)?.[1]);
  const permissionRadius = parseFloat(rulesFor('#permission')[0]['border-radius']);
  const expandedPadding = parseFloat(rulesFor('#pill.expanded')[0]['padding-inline']);
  assert.equal(ceiling, permissionRadius + expandedPadding);
  assert.ok(expandedPadding >= 24, 'respiro lateral da expandida');
  assert.ok(script.includes("pill.style.setProperty('--radius', `${Math.min(target.height / 2, PILL_MAX_RADIUS_PX)}px`);"));
});

test('a forma só vem do payload e trocá-la com pedido na tela rearma', () => {
  const apply = script.slice(script.indexOf('function applyPreferences('));
  const body = apply.slice(0, apply.indexOf('\n  }\n'));
  assert.ok(body.includes('root.dataset.shape = shape;'));
  assert.ok(body.includes('if (changed && current.permission) restartArming();'));
});

// ---------------------------------------------------------------------------------------------
// Temas e contraste. O teste resolve os tokens do próprio index.html (sem dependência: a conversão
// de cor é JS puro) para provar que o que o usuário lê antes de aprovar continua legível.
// ---------------------------------------------------------------------------------------------

const LIGHT_AUTO_SELECTOR = ':root:not([data-theme]), :root[data-theme="auto"]';

/**
 * Mapa propriedade → valor de um caso (tema + esquema do sistema), na ordem em que o CSS aplica:
 * toda regra de topo com seletor exatamente :root, depois a do auto claro (só com tema auto e esquema
 * claro) ou a do tema. Falha com mensagem clara se o tema não tiver regra.
 */
function themeVariables(theme, scheme) {
  const variables = {};
  for (const found of rulesFor(':root')) Object.assign(variables, found);
  if (theme === 'auto') {
    if (scheme === 'light') {
      const light = lightRules.filter((rule) => rule.selector === LIGHT_AUTO_SELECTOR);
      assert.equal(light.length, 1, `regra do auto claro (${LIGHT_AUTO_SELECTOR})`);
      Object.assign(variables, declarations(light[0].body));
    }
  } else {
    const themed = rulesFor(`:root[data-theme="${theme}"]`);
    assert.equal(themed.length, 1, `falta a regra :root[data-theme="${theme}"]`);
    Object.assign(variables, themed[0]);
  }
  return variables;
}

// Oklab de Björn Ottosson (domínio público): OKLCH → OKLab → LMS → sRGB linear → codificação gama.
function oklchToSrgb(lightness, chroma, hueDegrees) {
  const hue = (hueDegrees * Math.PI) / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return linear.map((value) => {
    const clipped = Math.min(1, Math.max(0, value));
    return clipped <= 0.0031308 ? 12.92 * clipped : 1.055 * clipped ** (1 / 2.4) - 0.055;
  });
}

// Divide nas vírgulas de nível zero (a de dentro de um var(), oklch() ou color-mix() aninhado não conta).
function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '(') depth += 1;
    if (text[index] === ')') depth -= 1;
    if (text[index] === ',' && depth === 0) {
      parts.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(text.slice(start).trim());
  return parts;
}

/**
 * Resolve um valor de cor do CSS para [r, g, b] em 0..1 (sRGB codificado). Só entende o que o index.html
 * usa nos tokens checados: var(--x), #rgb, #rrggbb, oklch(L C H) e color-mix(in srgb, A P%, B) com dois
 * operandos opacos. Qualquer outra coisa, inclusive transparent e rgb(...), lança: é o que também prova
 * que um token checado é opaco.
 */
function resolveColor(value, variables, depth = 0) {
  const text = String(value).trim();
  const unsupported = () => new Error(`formato de cor não suportado no teste de contraste: ${text}`);
  if (depth > 12) throw new Error(`ciclo ou aninhamento demais ao resolver a cor: ${text}`);
  const reference = text.match(/^var\(\s*(--[\w-]+)\s*\)$/);
  if (reference) {
    if (!(reference[1] in variables)) throw new Error(`token sem valor no caso: ${reference[1]}`);
    return resolveColor(variables[reference[1]], variables, depth + 1);
  }
  const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((digit) => digit + digit).join('') : hex[1];
    return [0, 2, 4].map((offset) => parseInt(digits.slice(offset, offset + 2), 16) / 255);
  }
  const oklch = text.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/);
  if (oklch) return oklchToSrgb(Number(oklch[1]), Number(oklch[2]), Number(oklch[3]));
  const mix = text.match(/^color-mix\(\s*in srgb\s*,(.*)\)$/);
  if (mix) {
    const [first, second, ...extra] = splitTopLevel(mix[1]);
    const weighted = first && first.match(/^(.*\S)\s+([\d.]+)%$/);
    if (!weighted || !second || extra.length > 0) throw unsupported();
    const weight = Number(weighted[2]) / 100;
    const one = resolveColor(weighted[1], variables, depth + 1);
    const other = resolveColor(second, variables, depth + 1);
    return one.map((channel, index) => channel * weight + other[index] * (1 - weight));
  }
  throw unsupported();
}

const channelToLinear = (channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
const luminance = ([r, g, b]) => 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);

/** Razão de contraste da WCAG 2.x entre duas cores [r, g, b] em 0..1. */
function contrastRatio(first, second) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

const to8Bit = (color) => color.map((channel) => Math.round(channel * 255));

test('o conversor de cor bate com os valores conhecidos e recusa o que não sabe medir', () => {
  const near = (actual, expected) => actual.every((channel, index) => Math.abs(channel - expected[index]) <= 1);
  assert.ok(near(to8Bit(resolveColor('oklch(0.646 0.222 41.116)', {})), [0xf5, 0x49, 0x00]));
  assert.ok(near(to8Bit(resolveColor('oklch(0.705 0.213 47.604)', {})), [0xff, 0x69, 0x00]));
  assert.ok(near(to8Bit(resolveColor('oklch(0.98 0.016 73.684)', {})), [0xff, 0xf7, 0xed]));
  assert.deepEqual(to8Bit(resolveColor('color-mix(in srgb, #000 50%, var(--x))', { '--x': '#fff' })), [128, 128, 128]);
  assert.ok(Math.abs(contrastRatio([0, 0, 0], [1, 1, 1]) - 21) < 1e-9);
  for (const value of ['transparent', 'rgb(0 0 0 / .5)', 'hsl(0 0% 0%)', 'color-mix(in srgb, #000 55%, transparent)']) {
    assert.throws(() => resolveColor(value, {}), /formato de cor não suportado no teste de contraste: .+/, value);
  }
});

const DARK_THEMES = THEMES.filter((theme) => theme !== 'auto' && theme !== 'porcelain');
const CASES = [
  ...DARK_THEMES.map((theme) => ({ theme, scheme: 'dark' })),
  { theme: 'porcelain', scheme: 'light' },
  { theme: 'auto', scheme: 'dark' },
  { theme: 'auto', scheme: 'light' },
];
const caseName = ({ theme, scheme }) => `${theme}/${scheme}`;

test('os 10 casos de tema são os 8 temas mais o auto claro e escuro', () => {
  assert.equal(CASES.length, 10);
  assert.equal(THEMES.length, 9, 'tema novo pede caso novo aqui');
});

test('cada tema de THEMES, fora o auto, tem a sua regra, e nenhuma regra mira tema desconhecido', () => {
  for (const theme of THEMES.filter((name) => name !== 'auto')) {
    assert.equal(rulesFor(`:root[data-theme="${theme}"]`).length, 1, `regra do tema ${theme}`);
  }
  const named = [...style.matchAll(/\[data-theme="([^"]*)"\]/g)].map((match) => match[1]);
  assert.ok(named.length > 0);
  for (const theme of named) assert.ok(THEMES.includes(theme), `tema fora de THEMES: ${theme}`);
});

test('as cores claras só valem no auto: um tema escuro num sistema claro não as herda', () => {
  assert.equal(lightRules.length, 1);
  assert.equal(lightRules[0].selector, LIGHT_AUTO_SELECTOR);
});

// Key Decision das cores (2026-11-21): cada cor de estado é um par escuro/claro e nenhum tema o troca.
const FIXED_DARK = {
  '--running': 'oklch(0.705 0.213 47.604)', '--waiting': '#ff9f0a', '--done': '#30d158',
  '--context-warn': '#ffd60a', '--context-critical': '#ff453a', '--icon-ink': '#000',
};
const FIXED_LIGHT = {
  '--running': 'oklch(0.646 0.222 41.116)', '--waiting': '#f08c00', '--done': '#248a3d',
  '--context-warn': '#c79200', '--context-critical': '#d70015', '--icon-ink': '#fff',
};
// Os botões têm um valor só, igual nos dois esquemas: o laranja escuro derrubaria o contraste do rótulo.
const FIXED_BUTTONS = {
  '--button': 'oklch(0.646 0.222 41.116)', '--button-text': 'oklch(0.98 0.016 73.684)', '--done-button': '#248a3d',
};

test('as cores de estado são o par escuro ou claro da Key Decision e os botões não mudam, nos 10 casos', () => {
  for (const found of CASES) {
    const variables = themeVariables(found.theme, found.scheme);
    const expected = found.scheme === 'light' ? FIXED_LIGHT : FIXED_DARK;
    for (const [token, value] of Object.entries({ ...expected, ...FIXED_BUTTONS })) {
      assert.equal(variables[token], value, `${caseName(found)}: ${token}`);
    }
  }
});

test('nenhuma regra :root declara token derivado do acento (ele seria resolvido no :root, sempre laranja)', () => {
  for (const { selector, body } of rules.filter((rule) => rule.selector.startsWith(':root'))) {
    for (const [property, value] of Object.entries(declarations(body))) {
      assert.equal(value.includes('var(--accent)'), false, `${selector} ${property}`);
    }
  }
});

test('contraste do bloco de permissão e dos controles nos 10 casos', () => {
  const failures = [];
  const check = (found, pair, foreground, background, minimum) => {
    const variables = themeVariables(found.theme, found.scheme);
    const ratio = contrastRatio(resolveColor(foreground, variables), resolveColor(background, variables));
    if (ratio < minimum) failures.push(`${caseName(found)}: ${pair} mede ${ratio.toFixed(2)}:1, mínimo ${minimum}:1`);
  };
  for (const found of CASES) {
    for (const token of ['--perm-text', '--perm-hint', '--perm-label']) {
      check(found, `${token} sobre --perm-bg`, `var(${token})`, 'var(--perm-bg)', 4.5);
    }
    check(found, '--muted sobre --surface', 'var(--muted)', 'var(--surface)', 4.5);
    check(found, '--button sobre --surface (controle)', 'var(--button)', 'var(--surface)', 3);
    check(found, '--perm-deny-border sobre --surface (controle)', 'var(--perm-deny-border)', 'var(--surface)', 3);
    // As duas cores são travadas pela Key Decision e medem ~3,38:1: cumprem controle, não texto de 13 px
    // (decisão registrada na UI-SPEC); o teste não deixa piorar.
    check(found, '--button-text sobre --button (controle)', 'var(--button-text)', 'var(--button)', 3);
  }
  assert.deepEqual(failures, []);
});

test('--perm-bg é uma cor opaca nos 10 casos', () => {
  for (const found of CASES) {
    const color = resolveColor('var(--perm-bg)', themeVariables(found.theme, found.scheme));
    assert.equal(color.length, 3, caseName(found));
    assert.ok(color.every((channel) => Number.isFinite(channel) && channel >= 0 && channel <= 1), caseName(found));
  }
});

test('o bloco de permissão lê os tokens próprios', () => {
  assert.equal(rulesFor('#permission')[0].background, 'var(--perm-bg)');
  assert.equal(rulesFor('#permission-tool')[0].color, 'var(--perm-label)');
  assert.equal(rulesFor('#permission-text')[0].color, 'var(--perm-text)');
  assert.equal(rulesFor('#permission-hint')[0].color, 'var(--perm-hint)');
  assert.equal(rulesFor('#actions #deny, #pill.has-permission #open')[0]['box-shadow'], 'inset 0 0 0 1px var(--perm-deny-border)');
});

// ---------------------------------------------------------------------------------------------
// Material da pílula e tipografia (VIS-03, VIS-05). Tudo estático: só o brilho da Fase 1 anima.
// ---------------------------------------------------------------------------------------------

const WASH_PATTERN = /radial-gradient\(ellipse 75% 56px at 50% 0, color-mix\(in srgb, var\(--accent\) ([\d.]+)%, transparent\), transparent\)/;
const pillBackgrounds = () => rulesFor('#pill').map((found) => found.background).filter(Boolean);

test('o fundo da pílula tem lavagem do acento de 56 px fixos, profundidade e o preenchimento do tema', () => {
  const backgrounds = pillBackgrounds();
  assert.equal(backgrounds.length, 1);
  const [background] = backgrounds;
  assert.match(background, WASH_PATTERN);
  assert.match(background, /linear-gradient\(to bottom, rgb\(0 0 0 \/ 0\), rgb\(0 0 0 \/ calc\(\.25 \* var\(--depth\)\)\) 45%, rgb\(0 0 0 \/ var\(--depth\)\)\)/);
  assert.ok(background.endsWith('var(--surface)'), 'o preenchimento é a camada de baixo');
  assert.ok(background.indexOf('radial-gradient') < background.indexOf('linear-gradient'), 'a lavagem fica por cima da profundidade');
});

test('contorno de 35% do acento e sombra estática; a transição não inclui o fundo', () => {
  const shadows = rulesFor('#pill').map((found) => found['box-shadow']).filter(Boolean);
  assert.deepEqual(shadows, ['0 0 0 1px var(--contour), var(--shadow)']);
  // --contour depende do acento do estado, então é declarado na #pill e nunca no :root.
  const contours = rulesFor('#pill').map((found) => found['--contour']).filter(Boolean);
  assert.deepEqual(contours, ['color-mix(in srgb, var(--accent) 35%, var(--border))']);
  assert.ok(rulesFor(':root').every((found) => !('--contour' in found)));
  assert.equal(style.includes('--ring'), false, 'o anel de 40% deu lugar ao contorno');
  const transition = rulesFor('#pill').map((found) => found.transition).find(Boolean);
  assert.ok(transition);
  for (const part of transition.split(',')) assert.ok(!part.trim().startsWith('background'), `transição de ${part.trim()}`);
});

test('profundidade e sombra são tokens por esquema, escuros no :root e claros nos dois casos claros', () => {
  const darkShadow = '0 5px 14px rgb(0 0 0 / .30), 0 1px 3px rgb(0 0 0 / .20)';
  const lightShadow = '0 5px 14px rgb(0 0 0 / .16), 0 1px 3px rgb(0 0 0 / .12)';
  for (const found of CASES) {
    const variables = themeVariables(found.theme, found.scheme);
    const light = found.scheme === 'light';
    assert.equal(variables['--depth'], light ? '.033' : '.06', `${caseName(found)}: --depth`);
    assert.equal(variables['--shadow'], light ? lightShadow : darkShadow, `${caseName(found)}: --shadow`);
  }
});

test('nenhum pseudo-elemento além do brilho da Fase 1', () => {
  const pseudo = new Set([...style.matchAll(/::[\w-]+/g)].map((match) => match[0]));
  assert.deepEqual([...pseudo], ['::before']);
  assert.equal(rulesFor('#pill::before').length, 1);
});

test('contraste com a profundidade no rodapé e com a lavagem do acento, nos 10 casos', () => {
  const wash = Number(pillBackgrounds()[0].match(WASH_PATTERN)[1]) / 100;
  const failures = [];
  for (const found of CASES) {
    const variables = themeVariables(found.theme, found.scheme);
    const resolve = (value) => resolveColor(value, variables);
    // O rodapé é o preto a --depth sobre a superfície (último ponto do gradiente de profundidade).
    const depth = parseFloat(variables['--depth']);
    const footer = resolve('var(--surface)').map((channel) => channel * (1 - depth));
    const check = (pair, foreground, background, minimum) => {
      const ratio = contrastRatio(foreground, background);
      if (ratio < minimum) failures.push(`${caseName(found)}: ${pair} mede ${ratio.toFixed(2)}:1, mínimo ${minimum}:1`);
    };
    check('--muted sobre o rodapé', resolve('var(--muted)'), footer, 4.5);
    check('--button sobre o rodapé (controle)', resolve('var(--button)'), footer, 3);
    check('--perm-deny-border sobre o rodapé (controle)', resolve('var(--perm-deny-border)'), footer, 3);
    for (const state of ['running', 'waiting', 'done']) {
      const accent = resolve(`var(--${state})`);
      const washed = resolve('var(--surface)').map((channel, index) => accent[index] * wash + channel * (1 - wash));
      check(`--text sobre a superfície com a lavagem de ${state}`, resolve('var(--text)'), washed, 4.5);
    }
  }
  assert.deepEqual(failures, []);
});

test('pesos só 400 e 600, contador em 12 px e fontes do sistema, sem fonte embarcada', () => {
  const weights = [...style.matchAll(/font-weight:\s*(\d+)/g)].map((match) => match[1]);
  assert.ok(weights.length > 0);
  for (const weight of weights) assert.ok(weight === '400' || weight === '600', `font-weight: ${weight}`);
  assert.equal(rulesFor('#count')[0]['font-size'], '12px');
  assert.match(rulesFor('body')[0].font, /^\d+px\/[\d.]+ system-ui\b/);
  assert.match(rulesFor('#permission-text')[0].font, /^\d+px\/[\d.]+ ui-monospace\b/);
  assert.equal(/@font-face|url\(/.test(style), false);
});

test('o tema só vem do payload e o script grava data-theme com auto como padrão', () => {
  const apply = script.slice(script.indexOf('function applyPreferences('));
  const body = apply.slice(0, apply.indexOf('\n  }\n'));
  assert.ok(body.includes("const theme = preferences?.theme || 'auto';"));
  assert.ok(body.includes('root.dataset.theme = theme;'));
  assert.ok(body.includes('if (changed && current.permission) restartArming();'));
});

// ---- Âncoras (D-13) ----

test('--stage-shadow do :root é a margem da sombra do state.js', () => {
  assert.ok(rulesFor(':root').some((found) => found['--stage-shadow'] === `${STAGE_SHADOW_PX}px`));
});

test('as regras de âncora alinham a pílula pelo lado ancorado e deixam a margem da sombra', () => {
  const only = (selector) => {
    const found = rulesFor(selector);
    assert.equal(found.length, 1, `regra de ${selector}`);
    return found[0];
  };
  assert.deepEqual(only(':root[data-anchor] #pill'), { 'transform-origin': 'var(--origin-x, 50%) var(--origin-y, 0)' });
  assert.deepEqual(only(':root[data-anchor$="-left"]'), { '--origin-x': '0%' });
  assert.deepEqual(only(':root[data-anchor$="-right"]'), { '--origin-x': '100%' });
  // O lado de cima ou de baixo vem do main (data-edge), não da âncora: a ilha arrastada para baixo também cresce
  // para cima.
  assert.deepEqual(only(':root[data-edge="bottom"]'), { '--origin-y': '100%' });
  assert.deepEqual(only(':root[data-anchor$="-left"] body'), { 'justify-content': 'flex-start', 'padding-left': 'var(--stage-shadow)' });
  assert.deepEqual(only(':root[data-anchor$="-right"] body'), { 'justify-content': 'flex-end', 'padding-right': 'var(--stage-shadow)' });
  assert.deepEqual(only(':root[data-edge="bottom"] body'), {
    'align-items': 'flex-end', 'padding-top': '0', 'padding-bottom': 'var(--stage-shadow)',
  });
  // As regras base do centro e do topo não mudam: sem âncora a pílula fica como na Fase 3.
  assert.equal(rulesFor('body')[0]['padding-top'], 'var(--stage-top)');
  assert.equal(rulesFor('#pill')[0]['transform-origin'], '50% 0');
});

test('nenhuma regra mira uma âncora que o main não aceita', () => {
  const named = [...style.matchAll(/\[data-anchor([\^$]?)="([^"]*)"\]/g)].map((match) => ({ operator: match[1], value: match[2] }));
  assert.ok(named.length >= 6);
  for (const { operator, value } of named) {
    const hit = ANCHORS.some((anchor) => (operator === '^' ? anchor.startsWith(value) : operator === '$' ? anchor.endsWith(value) : anchor === value));
    assert.ok(hit, `âncora fora de ANCHORS: [data-anchor${operator}="${value}"]`);
  }
});

test('o script grava data-anchor com topo centro como padrão e rearma se a âncora mudou', () => {
  const apply = script.slice(script.indexOf('function applyPreferences('));
  const body = apply.slice(0, apply.indexOf('\n  }\n'));
  assert.ok(body.includes("const anchor = preferences?.anchor || 'top-center';"));
  assert.ok(body.includes('root.dataset.anchor !== anchor'));
  assert.ok(body.includes('root.dataset.anchor = anchor;'));
});
