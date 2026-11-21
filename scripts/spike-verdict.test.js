const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { evaluateRule, loadResults, formatReport, hasValidWindows, SCENARIOS } = require('./spike-verdict');

const validWindow = { topmost: true, toolWindow: false, appWindow: false, dpi: 96, width: 440, height: 324 };

// Uma tentativa gravada como o medidor grava: 3 execuções com janela válida, salvo o que o teste sobrescreve.
function attemptOf(label, scenario, { attempt = 1, ws = 10, cpu = 0.5, status = 'ok', runs, window = validWindow, rootAlive = true } = {}) {
  const run = (index) => ({
    processes: 4, privateWsMb: ws + index * 0.1, cpuPercentTotal: cpu, cpuPercentOfOneCore: cpu * 16, seconds: 60,
    rootAlive, windows: [window], foregroundInTree: false,
  });
  return {
    label, scenario, attempt, status,
    runs: runs || [0, 1, 2].map(run),
    median: { privateWsMb: ws, cpuPercentTotal: cpu, processes: 4 },
  };
}

// Uma variante com a1 nos 3 cenários; values = { idle: [ws, cpu], running: [...], waiting: [...] }.
function variant(label, values, extra = {}) {
  return SCENARIOS.map((scenario) => {
    const [ws, cpu] = values[scenario];
    return attemptOf(label, scenario, { ws, cpu, ...extra });
  });
}

const flat = (ws, cpu = 0.5) => ({ idle: [ws, cpu], running: [ws, cpu], waiting: [ws, cpu] });
const ELIGIBLE = { e2: true };

test('T0 em exatamente 60% nos 3 cenários e CPU igual passa a Etapa 1 (D-01, D-02)', () => {
  const verdict = evaluateRule([...variant('e3', flat(10)), ...variant('t0', flat(6.0))], { e2: false });
  assert.equal(verdict.stage1, true);
  assert.equal(verdict.reference, 'e3');
  assert.deepEqual(verdict.gates.map((gate) => gate.id), ['N1-idle', 'N1-running', 'N1-waiting', 'N2']);
});

test('T0 a 61% só no cenário precisa de você reprova por N1-waiting (D-01)', () => {
  const t0 = { idle: [6.0, 0.5], running: [6.0, 0.5], waiting: [6.1, 0.5] };
  const verdict = evaluateRule([...variant('e3', flat(10)), ...variant('t0', t0)], { e2: false });
  assert.equal(verdict.stage1, false);
  assert.deepEqual(verdict.gates.filter((gate) => !gate.pass).map((gate) => gate.id), ['N1-waiting']);
});

test('CPU ociosa do T0 0,0001 acima da referência reprova por N2, sem tolerância (D-02)', () => {
  const t0 = { ...flat(6.0), idle: [6.0, 0.5001] };
  const verdict = evaluateRule([...variant('e3', flat(10)), ...variant('t0', t0)], { e2: false });
  assert.equal(verdict.stage1, false);
  assert.deepEqual(verdict.gates.filter((gate) => !gate.pass).map((gate) => gate.id), ['N2']);
});

test('referência 3,0 MB e T0 1,8 MB passa apesar do ponto flutuante', () => {
  // 0,6 × 3,0 dá 1,7999999999999998 em ponto flutuante: a regra compara inteiros em décimos
  const verdict = evaluateRule([...variant('e3', flat(3.0)), ...variant('t0', flat(1.8))], { e2: false });
  assert.equal(verdict.stage1, true);
});

test('E2 elegível com ociosa menor que a de E3 vira a referência', () => {
  const e2 = { ...flat(8), idle: [8, 0.5] };
  const verdict = evaluateRule([...variant('e3', flat(10)), ...variant('e2', e2), ...variant('t0', flat(4.8))], ELIGIBLE);
  assert.equal(verdict.reference, 'e2');
  assert.equal(verdict.stage1, true);
});

test('E2 com ociosa menor mas eligibility.e2 falso: a referência é E3 (D-12)', () => {
  const measurements = [...variant('e3', flat(10)), ...variant('e2', flat(8)), ...variant('t0', flat(6.0))];
  const verdict = evaluateRule(measurements, { e2: false, reason: 'captura difere mais de 1%' });
  assert.equal(verdict.reference, 'e3');
  assert.equal(verdict.eligibility.e2, false);
  assert.match(formatReport({}, verdict), /EXCLUÍDA: e2 \(captura difere mais de 1%\)/);
});

test('E2 elegível com uma tentativa que caiu é excluída e a referência é E3', () => {
  const e2 = [...variant('e2', flat(8)).slice(0, 2), attemptOf('e2', 'waiting', { status: 'crashed', runs: [] })];
  const verdict = evaluateRule([...variant('e3', flat(10)), ...e2, ...variant('t0', flat(6.0))], ELIGIBLE);
  assert.equal(verdict.reference, 'e3');
  assert.equal(verdict.eligibility.e2, false);
});

test('E2 elegível com uma execução de PID raiz morto é excluída', () => {
  const e2 = [...variant('e2', flat(8)).slice(0, 2), attemptOf('e2', 'waiting', { ws: 8, rootAlive: false })];
  const verdict = evaluateRule([...variant('e3', flat(10)), ...e2, ...variant('t0', flat(6.0))], ELIGIBLE);
  assert.equal(verdict.reference, 'e3');
  assert.equal(verdict.eligibility.e2, false);
});

test('E2 elegível com uma a2 em algum cenário é excluída: E2 nunca é remedida', () => {
  const e2 = [...variant('e2', flat(8)), attemptOf('e2', 'idle', { attempt: 2, ws: 8 })];
  const verdict = evaluateRule([...variant('e3', flat(10)), ...e2, ...variant('t0', flat(6.0))], ELIGIBLE);
  assert.equal(verdict.reference, 'e3');
  assert.equal(verdict.eligibility.e2, false);
});

test('janela sem TOPMOST ou com APPWINDOW invalida a execução (D-10)', () => {
  assert.equal(hasValidWindows({ windows: [validWindow] }), true);
  assert.equal(hasValidWindows({ windows: [{ ...validWindow, topmost: false }] }), false);
  assert.equal(hasValidWindows({ windows: [{ ...validWindow, appWindow: true }] }), false);
  assert.equal(hasValidWindows({ windows: [] }), false);
  assert.equal(hasValidWindows({}), false);
});

test('o tamanho esperado vale em pixels físicos: 550×405 a 120 dpi é válido e 440×324 não (D-10)', () => {
  assert.equal(hasValidWindows({ windows: [{ ...validWindow, dpi: 120, width: 550, height: 405 }] }), true);
  assert.equal(hasValidWindows({ windows: [{ ...validWindow, dpi: 120, width: 440, height: 324 }] }), false);
});

test('o Electron a 125% sai com 550×410 e vale; janela retiliada de 1091×466 não (errata de D-10)', () => {
  assert.equal(hasValidWindows({ windows: [{ ...validWindow, dpi: 120, width: 550, height: 410 }] }), true);
  assert.equal(hasValidWindows({ windows: [{ ...validWindow, dpi: 120, width: 550, height: 420 }] }), false);
  assert.equal(hasValidWindows({ windows: [{ ...validWindow, width: 1091, height: 466 }] }), false);
});

test('janela sem TOOLWINDOW mas com TOPMOST é válida: é o caso do Electron (D-10)', () => {
  assert.equal(hasValidWindows({ windows: [{ ...validWindow, toolWindow: false }] }), true);
});

test('a1 inválida e a2 válida: vale a a2 e a linha é ok (D-12a)', () => {
  const badWindow = { ...validWindow, topmost: false };
  const idle = [attemptOf('t0', 'idle', { attempt: 1, ws: 5, window: badWindow }), attemptOf('t0', 'idle', { attempt: 2, ws: 6.0 })];
  const t0 = [...idle, ...variant('t0', flat(6.0)).slice(1)];
  const verdict = evaluateRule([...variant('e3', flat(10)), ...t0], { e2: false });
  const row = verdict.rows.find((entry) => entry.label === 't0' && entry.scenario === 'idle');
  assert.equal(row.state, 'ok');
  assert.equal(row.attempt.attempt, 2);
  assert.equal(verdict.stage1, true);
  assert.match(formatReport({}, verdict), /TENTATIVA: t0 idle a1 descartada/);
});

test('T0 com a1, a2 e a3 inválidas: a linha é INVÁLIDA e a Etapa 1 reprova (D-12a)', () => {
  const bad = { ...validWindow, topmost: false };
  const idle = [1, 2, 3].map((attempt) => attemptOf('t0', 'idle', { attempt, ws: 1, window: bad }));
  const verdict = evaluateRule([...variant('e3', flat(10)), ...idle, ...variant('t0', flat(6.0)).slice(1)], { e2: false });
  assert.equal(verdict.rows.find((row) => row.label === 't0' && row.scenario === 'idle').state, 'invalid');
  assert.equal(verdict.stage1, false);
  assert.match(formatReport({}, verdict), /INVÁLIDA: t0 idle/);
});

test('T0 só com a1 inválida: falta dado, a Etapa 1 é inconclusiva', () => {
  const bad = { ...validWindow, topmost: false };
  const t0 = [attemptOf('t0', 'idle', { window: bad }), ...variant('t0', flat(6.0)).slice(1)];
  const verdict = evaluateRule([...variant('e3', flat(10)), ...t0], { e2: false });
  assert.equal(verdict.stage1, null);
  assert.match(formatReport({}, verdict), /PROBLEMA: t0 idle/);
});

test('sem medição do T0 a Etapa 1 é inconclusiva', () => {
  const verdict = evaluateRule(variant('e3', flat(10)), { e2: false });
  assert.equal(verdict.stage1, null);
  assert.match(formatReport({}, verdict), /FALTA: t0 idle/);
});

test('sem referência válida a base continua Electron: Etapa 1 reprova', () => {
  const bad = { ...validWindow, topmost: false };
  const e3 = [1, 2, 3].map((attempt) => attemptOf('e3', 'idle', { attempt, window: bad }));
  const verdict = evaluateRule([...e3, ...variant('e3', flat(10)).slice(1), ...variant('t0', flat(1))], { e2: false });
  assert.equal(verdict.reference, null);
  assert.equal(verdict.stage1, false);
});

test('a CPU ociosa de E1 abaixo da de E0 é registrada como evidência', () => {
  const base = [...variant('e3', flat(10)), ...variant('t0', flat(6.0))];
  const below = evaluateRule([...base, ...variant('e0', flat(10, 0.4)), ...variant('e1', flat(10, 0.1))], { e2: false });
  assert.equal(below.idleCpuBelowCurrent.pass, true);
  const equal = evaluateRule([...base, ...variant('e0', flat(10, 0.4)), ...variant('e1', flat(10, 0.4))], { e2: false });
  assert.equal(equal.idleCpuBelowCurrent.pass, false);
  assert.equal(evaluateRule(base, { e2: false }).idleCpuBelowCurrent, null);
});

test('loadResults lê a pasta e o relatório mostra a linha de cada variante com vírgula decimal', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spike-verdict-'));
  try {
    for (const entry of [...variant('e3', flat(10)), ...variant('t0', flat(6.0)), ...variant('e0', flat(10, 0.4))]) {
      fs.writeFileSync(path.join(dir, `${entry.label}-${entry.scenario}-a${entry.attempt}.json`), JSON.stringify(entry));
    }
    fs.writeFileSync(path.join(dir, 'eligibility.json'), JSON.stringify({ e2: false, reason: 'sem E2' }));
    fs.writeFileSync(path.join(dir, 'e1-idle-a1.json'), '{"status":'); // cortado no meio: tentativa sem valor
    const results = loadResults(dir);
    assert.equal(results.measurements.length, 10);
    assert.deepEqual(results.eligibility, { e2: false, reason: 'sem E2' });
    const report = formatReport(results, evaluateRule(results.measurements, results.eligibility));
    assert.match(report, /\| e0 \| idle \| a1 \| 10,0 \|/);
    assert.match(report, /\| t0 \| waiting \| a1 \| 6,0 \|/);
    assert.match(report, /Etapa 1: PASSOU/);
    assert.match(report, /PROBLEMA: e1 idle/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
