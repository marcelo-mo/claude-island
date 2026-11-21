// Veredito da Etapa 1 da regra Electron × Tauri (spike/REGRA-DE-DECISAO.md).
// Ferramenta do spike, não lógica da ilha em execução; por isso mora em scripts/ e não no state.js.
// Uso: node scripts/spike-verdict.js <pasta de resultados> [--json | --stage1]
const fs = require('node:fs');
const path = require('node:path');

const SCENARIOS = ['idle', 'running', 'waiting'];
const SCENARIO_NAMES = { idle: 'ociosa', running: 'trabalhando', waiting: 'precisa de você' };
const LABELS = ['e0', 'e1', 'e3', 'e2', 't0'];
const RUNS_REQUIRED = 3;
const MAX_ATTEMPTS = 3;
const MEMORY_LIMIT_PERCENT = 60;
const REFERENCE_LABELS = ['e3', 'e2'];
const CANDIDATE_LABEL = 't0';
const ISLAND_SIZE_DIP = { width: 440, height: 324 };
// Errata da regra: o Electron abre a janela a 125% com 550×410 (esperado 405) por causa do arredondamento de
// escala fracionária. A tolerância ainda reprova janela retiliada por gerenciador de janelas em mosaico.
const SIZE_TOLERANCE_PERCENT = 2;

// Precisão da regra: WS em décimos de MB e CPU em 4 casas do "% do total", como o medidor arredonda.
const tenths = (megabytes) => Math.round(megabytes * 10);
const tenThousandths = (percent) => Math.round(percent * 1e4);
const matchesSize = (actual, dipSize, dpi) => {
  const expected = Math.round(dipSize * dpi / 96);
  return Math.abs(actual - expected) <= Math.ceil(expected * SIZE_TOLERANCE_PERCENT / 100);
};
const formatNumber = (value, digits) => value.toFixed(digits).replace('.', ',');

/**
 * Validade de execução (D-10): toda janela com TOPMOST ligado, APPWINDOW desligado e o tamanho esperado em
 * pixels físicos (DIP × dpi / 96, arredondado), com SIZE_TOLERANCE_PERCENT de folga. TOOLWINDOW não é exigido: o Electron não o usa.
 * Devolve false para execução sem janela ou com dado malformado.
 */
function hasValidWindows(run) {
  const windows = run && run.windows;
  if (!Array.isArray(windows) || windows.length === 0) return false;
  return windows.every((window) => window
    && window.topmost === true
    && window.appWindow === false
    && matchesSize(window.width, ISLAND_SIZE_DIP.width, window.dpi)
    && matchesSize(window.height, ISLAND_SIZE_DIP.height, window.dpi));
}

/** Motivo de a tentativa não valer, ou null se vale (status ok, 3 execuções, janelas válidas em todas). */
function invalidReason(attempt) {
  if (attempt.status !== 'ok') return `status ${attempt.status}`;
  if (!Array.isArray(attempt.runs) || attempt.runs.length !== RUNS_REQUIRED) {
    return `${Array.isArray(attempt.runs) ? attempt.runs.length : 0} de ${RUNS_REQUIRED} execuções`;
  }
  if (!attempt.runs.every(hasValidWindows)) return 'janela fora da validade (TOPMOST, APPWINDOW ou tamanho)';
  return null;
}

/** Lê os {label}-{cenario}-a{N}.json e o eligibility.json da pasta. É o único I/O deste módulo. */
function loadResults(dir) {
  const measurements = [];
  for (const file of fs.readdirSync(dir).sort()) {
    const match = /^([a-z0-9]+)-(idle|running|waiting)-a(\d+)\.json$/.exec(file);
    if (!match) continue;
    const [, label, scenario, attemptNumber] = match;
    let content;
    try {
      content = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    } catch {
      // arquivo cortado no meio (medição interrompida): conta como tentativa, mas nunca como válida
      content = { status: 'unreadable' };
    }
    measurements.push({ ...content, label, scenario, attempt: Number(attemptNumber) });
  }
  let eligibility = { e2: false };
  try {
    eligibility = JSON.parse(fs.readFileSync(path.join(dir, 'eligibility.json'), 'utf8'));
  } catch (error) {
    // ausente vale "E2 inelegível"; ilegível também, com o motivo dito
    if (error.code !== 'ENOENT') eligibility = { e2: false, reason: 'eligibility.json ilegível' };
  }
  return { measurements, eligibility };
}

/** A linha de um label × cenário: a primeira tentativa válida vale; as anteriores são descartadas. */
function rowFor(measurements, label, scenario, expected) {
  const attempts = measurements
    .filter((entry) => entry.label === label && entry.scenario === scenario)
    .sort((a, b) => a.attempt - b.attempt);
  if (attempts.length === 0) return { label, scenario, state: 'missing', expected, attempt: null, discarded: [] };
  const validIndex = attempts.findIndex((entry) => invalidReason(entry) === null);
  if (validIndex >= 0) {
    const discarded = attempts.slice(0, validIndex).map((entry) => ({ attempt: entry.attempt, reason: invalidReason(entry) }));
    return { label, scenario, state: 'ok', expected, attempt: attempts[validIndex], discarded };
  }
  const last = attempts[attempts.length - 1];
  const state = attempts.length >= MAX_ATTEMPTS ? 'invalid' : 'pending';
  return { label, scenario, state, expected, attempt: last, discarded: [], reason: invalidReason(last) };
}

/** Critério (a) de E2 conferido nos arquivos: uma única tentativa (a1) por cenário, sem queda e com janelas válidas. */
function e2KeepsRootAlive(measurements) {
  return SCENARIOS.every((scenario) => {
    const attempts = measurements.filter((entry) => entry.label === 'e2' && entry.scenario === scenario);
    return attempts.length === 1
      && attempts[0].attempt === 1
      && invalidReason(attempts[0]) === null
      && attempts[0].runs.every((run) => run.rootAlive === true);
  });
}

function e2Candidacy(measurements, eligibility) {
  if (!eligibility || eligibility.e2 !== true) {
    return { candidate: false, reason: (eligibility && eligibility.reason) || 'eligibility.json não declara E2 elegível' };
  }
  if (!e2KeepsRootAlive(measurements)) {
    return { candidate: false, reason: 'critério (a) não confirmado nos arquivos (PID vivo, validade ou tentativa única)' };
  }
  return { candidate: true, reason: null };
}

const median = (row, field) => row.attempt.median[field];

/**
 * Aplica a regra. measurements: tentativas lidas por loadResults. eligibility: { e2, reason }.
 * stage1: null se falta dado (t0, e3 ou e2 candidata com linha pendente ou ausente); false se t0 tem linha
 * INVÁLIDA ou não há referência válida (a base continua Electron); senão o resultado dos gates.
 */
function evaluateRule(measurements, eligibility) {
  const candidacy = e2Candidacy(measurements, eligibility);
  const expectedLabels = new Set(['e0', 'e1', 'e3', 't0']);
  if (candidacy.candidate) expectedLabels.add('e2');

  const rows = [];
  for (const label of LABELS) {
    for (const scenario of SCENARIOS) {
      const row = rowFor(measurements, label, scenario, expectedLabels.has(label));
      if (row.expected || row.state !== 'missing') rows.push(row);
    }
  }
  const rowOf = (label, scenario) => rows.find((row) => row.label === label && row.scenario === scenario);
  const rowsOf = (label) => SCENARIOS.map((scenario) => rowOf(label, scenario));
  const allOk = (label) => rowsOf(label).every((row) => row && row.state === 'ok');

  // Só o que decide a Etapa 1 conta como falta de dado: t0, e3 e (se candidata) e2.
  const deciding = [CANDIDATE_LABEL, ...REFERENCE_LABELS.filter((label) => label === 'e3' || candidacy.candidate)];
  const decidingRows = deciding.flatMap((label) => rowsOf(label));
  const candidateInvalid = rowsOf(CANDIDATE_LABEL).some((row) => row && row.state === 'invalid');
  const dataMissing = decidingRows.some((row) => !row || row.state === 'pending' || row.state === 'missing');

  let reference = null;
  for (const label of REFERENCE_LABELS) {
    if (label === 'e2' && !candidacy.candidate) continue;
    if (!allOk(label)) continue;
    // empate fica com e3: só troca se for estritamente menor
    if (reference === null || tenths(median(rowOf(label, 'idle'), 'privateWsMb')) < tenths(median(rowOf(reference, 'idle'), 'privateWsMb'))) {
      reference = label;
    }
  }

  const gates = [];
  let stage1;
  if (candidateInvalid) {
    stage1 = false;
  } else if (dataMissing) {
    stage1 = null;
  } else if (reference === null) {
    stage1 = false;
  } else {
    for (const scenario of SCENARIOS) {
      const candidateWs = median(rowOf(CANDIDATE_LABEL, scenario), 'privateWsMb');
      const referenceWs = median(rowOf(reference, scenario), 'privateWsMb');
      // inteiros em décimos: 0,6 × x em ponto flutuante erra no limite exato de 60%
      const pass = tenths(candidateWs) * 100 <= tenths(referenceWs) * MEMORY_LIMIT_PERCENT;
      gates.push({
        id: `N1-${scenario}`,
        pass,
        detail: `WS(${CANDIDATE_LABEL}) ${formatNumber(candidateWs, 1)} MB, limite ${MEMORY_LIMIT_PERCENT}% de WS(${reference}) ${formatNumber(referenceWs, 1)} MB`,
      });
    }
    const candidateCpu = median(rowOf(CANDIDATE_LABEL, 'idle'), 'cpuPercentTotal');
    const referenceCpu = median(rowOf(reference, 'idle'), 'cpuPercentTotal');
    gates.push({
      id: 'N2',
      pass: tenThousandths(candidateCpu) <= tenThousandths(referenceCpu), // D-02: estrito, sem tolerância
      detail: `CPU(${CANDIDATE_LABEL}) ${formatNumber(candidateCpu, 4)}%, CPU(${reference}) ${formatNumber(referenceCpu, 4)}% do total`,
    });
    stage1 = gates.every((gate) => gate.pass);
  }

  let idleCpuBelowCurrent = null;
  const e0Idle = rowOf('e0', 'idle');
  const e1Idle = rowOf('e1', 'idle');
  if (e0Idle && e1Idle && e0Idle.state === 'ok' && e1Idle.state === 'ok') {
    const e0 = tenThousandths(median(e0Idle, 'cpuPercentTotal'));
    const e1 = tenThousandths(median(e1Idle, 'cpuPercentTotal'));
    idleCpuBelowCurrent = { e0, e1, pass: e1 < e0 };
  }

  return {
    reference,
    rows,
    gates,
    stage1,
    idleCpuBelowCurrent,
    eligibility: { e2: candidacy.candidate, reason: candidacy.reason },
  };
}

const range = (runs, field, digits) => {
  const values = runs.map((run) => run[field]);
  return `${formatNumber(Math.min(...values), digits)}–${formatNumber(Math.max(...values), digits)}`;
};

const GATE_NAMES = {
  'N1-idle': 'N1 ociosa',
  'N1-running': 'N1 trabalhando',
  'N1-waiting': 'N1 precisa de você',
  N2: 'N2 CPU ociosa',
};

/** Relatório em markdown (pt-BR, vírgula decimal). Os ids crus (e0, idle...) ficam nas linhas da tabela para grep. */
function formatReport(results, verdict) {
  const lines = [
    '# Veredito da Etapa 1',
    '',
    '| Variante | Cenário | Tentativa | Private WS mediana (MB) | Faixa WS (mín–máx) | CPU mediana (% do total) | Faixa CPU | Processos |',
    '|---|---|---|---|---|---|---|---|',
  ];
  for (const row of verdict.rows) {
    if (!row.attempt) continue;
    const { attempt } = row;
    const attemptLabel = row.state === 'ok' ? `a${attempt.attempt}` : `a${attempt.attempt} (inválida)`;
    if (!attempt.median || !Array.isArray(attempt.runs) || attempt.runs.length === 0) {
      lines.push(`| ${row.label} | ${row.scenario} | ${attemptLabel} | – | – | – | – | – |`);
      continue;
    }
    lines.push(`| ${row.label} | ${row.scenario} | ${attemptLabel} | ${formatNumber(attempt.median.privateWsMb, 1)} | ${range(attempt.runs, 'privateWsMb', 1)} | ${formatNumber(attempt.median.cpuPercentTotal, 4)} | ${range(attempt.runs, 'cpuPercentTotal', 4)} | ${String(attempt.median.processes).replace('.', ',')} |`);
  }
  lines.push('', `Cenários: ${SCENARIOS.map((scenario) => `${scenario} = ${SCENARIO_NAMES[scenario]}`).join(', ')}.`, '');
  lines.push(`Referência: ${verdict.reference || 'nenhuma'}`);
  for (const gate of verdict.gates) lines.push(`${GATE_NAMES[gate.id]}: ${gate.pass ? 'PASSA' : 'REPROVA'} (${gate.detail})`);
  const stage = { true: 'PASSOU', false: 'REPROVOU', null: 'INCONCLUSIVA' }[String(verdict.stage1)];
  lines.push(`Etapa 1: ${stage}`);
  const cpu = verdict.idleCpuBelowCurrent;
  lines.push(cpu
    ? `CPU ociosa E1 × E0: E1 ${formatNumber(cpu.e1 / 1e4, 4)}% ${cpu.pass ? 'abaixo de' : 'não abaixo de'} E0 ${formatNumber(cpu.e0 / 1e4, 4)}%`
    : 'CPU ociosa E1 × E0: sem dado');
  lines.push('');
  for (const row of verdict.rows) {
    const where = `${row.label} ${row.scenario}`;
    if (row.expected && row.state === 'missing') lines.push(`FALTA: ${where}`);
    if (row.expected && row.state === 'pending') lines.push(`PROBLEMA: ${where} (${row.reason}); ainda cabe remedição`);
    if (row.expected && row.state === 'invalid') lines.push(`INVÁLIDA: ${where} (${row.reason}); teto de ${MAX_ATTEMPTS} tentativas atingido`);
    for (const discarded of row.discarded) lines.push(`TENTATIVA: ${where} a${discarded.attempt} descartada (${discarded.reason})`);
  }
  if (!verdict.eligibility.e2) lines.push(`EXCLUÍDA: e2 (${verdict.eligibility.reason})`);
  return `${lines.join('\n')}\n`;
}

module.exports = {
  evaluateRule, loadResults, formatReport, hasValidWindows,
  SCENARIOS, RUNS_REQUIRED, MAX_ATTEMPTS, MEMORY_LIMIT_PERCENT, REFERENCE_LABELS, CANDIDATE_LABEL, ISLAND_SIZE_DIP,
  SIZE_TOLERANCE_PERCENT,
};

if (require.main === module) {
  const [dir, flag] = process.argv.slice(2);
  if (!dir || !fs.existsSync(dir)) {
    console.error(`Pasta de resultados não encontrada: ${dir || '(não informada)'}`);
    process.exit(1);
  }
  const results = loadResults(dir);
  if (results.measurements.length === 0) {
    console.error(`Nenhuma medição {label}-{cenario}-a{N}.json em ${dir}`);
    process.exit(1);
  }
  const verdict = evaluateRule(results.measurements, results.eligibility);
  if (flag === '--json') console.log(JSON.stringify(verdict, null, 2));
  else if (flag === '--stage1') console.log(String(verdict.stage1));
  else process.stdout.write(formatReport(results, verdict));
}
