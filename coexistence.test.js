// Fase 6: convivência com a ilha do mod Dynamic Island for Windows (Windhawk).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  ANCHORS, anchorPosition, horizontalSlackFor, clampIslandPosition, isWithinWorkArea, positionFromSavedOffset,
  normalizePreferences, menuTemplate, WINDOW_SIZE, STAGE_SHADOW_PX, EXPANDED_PILL_WIDTH_PX,
  BESIDE_GAP_PX, BESIDE_TOP_OFFSET_PX,
} = require('./state');

// Os dois monitores do autor: o principal (onde fica o mod) e o de 125%, em DIP.
const PRIMARY_WORK_AREA = { x: 0, y: 30, width: 2560, height: 990 };
const SECONDARY_125_WORK_AREA = { x: -1536, y: 0, width: 1536, height: 824 };
// Largura ímpar: o centro cai em meio pixel e os dois lados têm de continuar à mesma distância.
const ODD_WORK_AREA = { x: 0, y: 0, width: 1919, height: 1040 };
const BOTH_WORK_AREAS = [PRIMARY_WORK_AREA, SECONDARY_125_WORK_AREA];
const centerOf = (workArea) => Math.round(workArea.x + workArea.width / 2);

// ---- Âncoras ao lado da ilha do sistema (CONV-01) ----

test('as âncoras ao lado entram depois das seis da Fase 4 e não têm sufixo de lado', () => {
  assert.deepEqual(ANCHORS.slice(-2), ['right-of-island', 'left-of-island']);
  assert.equal(ANCHORS.length, 8);
  // O sufixo -left/-right quer dizer "encosta nesse lado do palco" no CSS e no state.js (D-02).
  for (const anchor of ['right-of-island', 'left-of-island']) {
    assert.equal(anchor.endsWith('-left') || anchor.endsWith('-right') || anchor.startsWith('bottom-'), false, anchor);
  }
});

test('a borda interna da pílula fica a 210 px do centro da área útil, dos dois lados e nos dois monitores', () => {
  assert.equal(BESIDE_GAP_PX, 210);
  for (const workArea of [...BOTH_WORK_AREAS, ODD_WORK_AREA]) {
    const right = anchorPosition('right-of-island', workArea, WINDOW_SIZE);
    // À direita do mod a pílula encosta no lado esquerdo do palco, depois da margem da sombra.
    assert.equal(right.x + STAGE_SHADOW_PX, centerOf(workArea) + BESIDE_GAP_PX);
    const left = anchorPosition('left-of-island', workArea, WINDOW_SIZE);
    assert.equal(left.x + WINDOW_SIZE.width - STAGE_SHADOW_PX, centerOf(workArea) - BESIDE_GAP_PX);
    // Espelho: as duas pílulas ficam à mesma distância do centro.
    assert.equal((right.x + STAGE_SHADOW_PX) - centerOf(workArea), centerOf(workArea) - (left.x + WINDOW_SIZE.width - STAGE_SHADOW_PX));
  }
});

test('a janela ao lado nunca chega ao centro: invade a pílula expandida do mod em no máximo 5 px', () => {
  // Pílula expandida do mod: 380 px de largura com hover de 1,025 (MIT, ver THIRD_PARTY_NOTICES.md).
  const modHalfWidth = (380 * 1.025) / 2;
  for (const workArea of BOTH_WORK_AREAS) {
    const right = anchorPosition('right-of-island', workArea, WINDOW_SIZE);
    const left = anchorPosition('left-of-island', workArea, WINDOW_SIZE);
    assert.ok(right.x - centerOf(workArea) >= modHalfWidth - 5);
    assert.ok(centerOf(workArea) - (left.x + WINDOW_SIZE.width) >= modHalfWidth - 5);
  }
});

test('o topo desce 17 px para alinhar o centro da pílula compacta com a faixa ociosa do mod', () => {
  assert.equal(BESIDE_TOP_OFFSET_PX, 17);
  // Mod: palco 8 px abaixo da área útil, pílula 22 px dentro dele, faixa de 36 px. Nossa: --stage-top de 8
  // e pílula de 46. Centros: 8 + 22 + 18 = 48 e 8 + 23 = 31.
  assert.equal(8 + 22 + 36 / 2 - (8 + 46 / 2), BESIDE_TOP_OFFSET_PX);
  for (const workArea of BOTH_WORK_AREAS) {
    for (const anchor of ['right-of-island', 'left-of-island']) {
      assert.equal(anchorPosition(anchor, workArea, WINDOW_SIZE).y, workArea.y + BESIDE_TOP_OFFSET_PX, anchor);
    }
  }
});

test('a folga do lado interno é só a margem da sombra, e a folga mais a pílula expandida somam o palco', () => {
  const free = WINDOW_SIZE.width - STAGE_SHADOW_PX - EXPANDED_PILL_WIDTH_PX;
  assert.deepEqual({ ...horizontalSlackFor('right-of-island') }, { left: STAGE_SHADOW_PX, right: free });
  assert.deepEqual({ ...horizontalSlackFor('left-of-island') }, { left: free, right: STAGE_SHADOW_PX });
});

test('ao lado, a janela está dentro da área útil e o clamp não a mexe, nos dois monitores', () => {
  for (const workArea of BOTH_WORK_AREAS) {
    for (const anchor of ['right-of-island', 'left-of-island']) {
      const position = anchorPosition(anchor, workArea, WINDOW_SIZE);
      const slack = horizontalSlackFor(anchor);
      assert.equal(isWithinWorkArea({ ...position, ...WINDOW_SIZE }, workArea, slack), true, anchor);
      assert.deepEqual(clampIslandPosition(position, workArea, WINDOW_SIZE, slack), position, anchor);
    }
  }
});

test('abaixo de 1220 DIP de área útil o clamp puxa a janela ao lado para o centro (limite conhecido)', () => {
  // A janela à direita termina em centro + 190 + 520, e a folga de fora é de 100 px: cabe com largura/2 + 100 >= 710.
  const pulled = (width) => {
    const workArea = { x: 0, y: 0, width, height: 768 };
    const position = anchorPosition('right-of-island', workArea, WINDOW_SIZE);
    return clampIslandPosition(position, workArea, WINDOW_SIZE, horizontalSlackFor('right-of-island')).x - position.x;
  };
  assert.equal(pulled(1220), 0);
  assert.ok(pulled(1218) < 0);
  // 1366×768 a 125% (1093 DIP): a janela anda 64 px para o centro e a borda interna da pílula fica a 146 px dele,
  // dentro da pílula expandida do mod (meia-largura de ~195 com hover).
  assert.equal(pulled(1093), -64);
});

test('o deslocamento do arraste soma à posição ao lado: é o ajuste fino do encaixe', () => {
  for (const anchor of ['right-of-island', 'left-of-island']) {
    const base = anchorPosition(anchor, PRIMARY_WORK_AREA, WINDOW_SIZE);
    assert.deepEqual(positionFromSavedOffset(PRIMARY_WORK_AREA, WINDOW_SIZE, { x: -12, y: 5 }, anchor), { x: base.x - 12, y: base.y + 5 });
  }
});

test('o preferences.json aceita as âncoras ao lado e o resto continua voltando ao topo centro', () => {
  assert.equal(normalizePreferences({ anchor: 'right-of-island' }).anchor, 'right-of-island');
  assert.equal(normalizePreferences({ anchor: 'left-of-island' }).anchor, 'left-of-island');
  for (const anchor of ['beside-right', 'right-of', 'RIGHT-OF-ISLAND', ' right-of-island']) {
    assert.equal(normalizePreferences({ anchor }).anchor, 'top-center', anchor);
  }
});

test("o menu de âncora termina com 'Ao lado da ilha do sistema', direita e esquerda, e marca a escolhida", () => {
  const anchorMenu = menuTemplate({ anchor: 'left-of-island' }, 'ok').find((item) => item.label === 'Âncora');
  assert.deepEqual(anchorMenu.submenu.slice(-2).map(({ label, value }) => ({ label, value })), [
    { label: 'Ao lado da ilha do sistema, à direita', value: 'right-of-island' },
    { label: 'Ao lado da ilha do sistema, à esquerda', value: 'left-of-island' },
  ]);
  assert.deepEqual(anchorMenu.submenu.filter((item) => item.checked).map((item) => item.value), ['left-of-island']);
});

// ---- CSS: borda interna parada, crescimento para fora ----

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const style = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
const ruleBody = (selector) => {
  const start = style.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `regra de ${selector}`);
  assert.equal(style.indexOf(`${selector} {`, start + 1), -1, `uma regra só de ${selector}`);
  return style.slice(start + selector.length + 2, style.indexOf('}', start)).trim();
};

test('à direita do mod a pílula encosta à esquerda do palco e cresce a partir da borda esquerda', () => {
  assert.equal(ruleBody(':root[data-anchor="right-of-island"]'), '--origin-x: 0%;');
  assert.equal(ruleBody(':root[data-anchor="right-of-island"] body'), 'justify-content: flex-start; padding-left: var(--stage-shadow);');
});

test('à esquerda do mod a pílula encosta à direita do palco e cresce a partir da borda direita', () => {
  assert.equal(ruleBody(':root[data-anchor="left-of-island"]'), '--origin-x: 100%;');
  assert.equal(ruleBody(':root[data-anchor="left-of-island"] body'), 'justify-content: flex-end; padding-right: var(--stage-shadow);');
});

// ---- Nunca disputar o "sempre no topo" (CONV-02) ----

const mainSource = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
const functionBody = (opening) => {
  const start = mainSource.indexOf(opening);
  assert.notEqual(start, -1, opening);
  return mainSource.slice(start, mainSource.indexOf('\n}', start));
};

test('o topo só é pedido ao criar a janela: um único setAlwaysOnTop, dentro de createIsland, e nenhum moveTop', () => {
  // \b também pega espaço antes do parêntese e acesso por colchete ('setAlwaysOnTop' entre aspas).
  assert.equal(/moveTop\b/.test(mainSource), false);
  assert.equal((mainSource.match(/setAlwaysOnTop\b/g) || []).length, 1);
  assert.ok(/setAlwaysOnTop\s*\(/.test(functionBody('function createIsland(')));
  // createIsland só é chamado pela reconciliação de monitores: uma janela nova (monitor plugado, ou o monitor do
  // cursor no modo 'cursor') sobe ao nascer, o que é criação e não reafirmação de uma janela que já existe.
  assert.equal((mainSource.match(/createIsland\(/g) || []).length, 2, 'a definição e uma chamada');
  assert.ok(functionBody('function syncIslands(').includes('createIsland('));
});

// Argumentos de uma chamada, do parêntese de abertura ao que fecha, contando parênteses: pega corpo em bloco.
const callArguments = (openIndex) => {
  let depth = 0;
  for (let index = openIndex; index < mainSource.length; index += 1) {
    if (mainSource[index] === '(') depth += 1;
    if (mainSource[index] === ')') depth -= 1;
    if (depth === 0) return mainSource.slice(openIndex + 1, index);
  }
  return mainSource.slice(openIndex + 1);
};

test('nenhum timer do main mostra, restaura ou foca a janela', () => {
  // setAlwaysOnTop e moveTop já estão travados acima; aqui ficam as outras chamadas que um timer usaria para
  // trazer a janela de volta à frente.
  const forbidden = ['.focus(', 'showInactive(', '.show(', '.restore('];
  const timers = [...mainSource.matchAll(/set(?:Interval|Timeout)\s*\(/g)];
  assert.ok(timers.length >= 3, 'cursor, batimento e polling');
  for (const match of timers) {
    const args = callArguments(match.index + match[0].length - 1);
    for (const call of forbidden) assert.equal(args.includes(call), false, `timer com ${call}: ${args}`);
    // Função agendada por nome (declarada com function ou const): o corpo dela também não pode.
    const named = args.match(/^\s*(\w+)\s*,/);
    if (!named) continue;
    const opening = [`function ${named[1]}(`, `const ${named[1]} =`].find((candidate) => mainSource.includes(candidate));
    assert.ok(opening, `declaração de ${named[1]}`);
    const body = functionBody(opening);
    for (const call of forbidden) assert.equal(body.includes(call), false, `${named[1]} com ${call}`);
  }
});
