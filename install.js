// Registra (ou remove, com --uninstall) os hooks da ilha no ~/.claude/settings.json.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { PERMISSION_WAIT_MS } = require('./state');

// SessionStart não muda estado nenhum: é ele que sobe a ilha quando ela não está no ar.
const EVENTS = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Notification', 'Stop', 'SessionEnd'];
const HOOK_SCRIPT = path.join(__dirname, 'hook.js');
const PERMISSION_SCRIPT = path.join(__dirname, 'permission-hook.js');
// A marca identifica o hook da ilha mesmo depois de a pasta do repo mudar de lugar ou o Node
// mudar de caminho; os hooks ignoram argumentos, então ela não altera nada na execução.
const MARKER = '--claude-island';
const commandFor = (script) => `"${process.execPath}" "${script}" ${MARKER}`;
const COMMAND = commandFor(HOOK_SCRIPT);
const PERMISSION_COMMAND = commandFor(PERMISSION_SCRIPT);
// Folga sobre a espera do permission-hook: quem encerra é ele, em silêncio, e não o Claude
// Code matando o processo por timeout.
const PERMISSION_TIMEOUT_SECONDS = PERMISSION_WAIT_MS / 1000 + 30;

// Hook de cada evento. O PermissionRequest tem script próprio porque espera o clique do usuário.
const HOOKS_BY_EVENT = {
  ...Object.fromEntries(EVENTS.map((event) => [event, { type: 'command', command: COMMAND }])),
  PermissionRequest: { type: 'command', command: PERMISSION_COMMAND, timeout: PERMISSION_TIMEOUT_SECONDS },
};

// Pela marca, ou pelo caminho absoluto para instalações de antes dela. Nunca só pelo nome
// "hook.js": outra ferramenta pode ter um arquivo com o mesmo nome.
const isOurs = (entry) => (entry.hooks || []).some((hook) => {
  const command = hook.command || '';
  return command.split(/\s+/).includes(MARKER) || command.includes(HOOK_SCRIPT) || command.includes(PERMISSION_SCRIPT);
});

const hasIslandHooks = (settings) =>
  Object.values(settings.hooks || {}).some((entries) => Array.isArray(entries) && entries.some(isOurs));

/** Devolve um novo objeto de settings com os hooks da ilha removidos e, se `install`, recolocados. */
function applyHooks(settings, install) {
  const hooks = { ...(settings.hooks || {}) };
  for (const [event, hook] of Object.entries(HOOKS_BY_EVENT)) {
    const others = (hooks[event] || []).filter((entry) => !isOurs(entry));
    if (install) others.push({ matcher: '', hooks: [hook] });
    if (others.length) hooks[event] = others;
    else delete hooks[event];
  }
  return { ...settings, hooks };
}

/** Aplica os hooks da ilha (ou os remove) no settings.json indicado, sem nunca deixá-lo pela metade. */
function updateSettingsFile(settingsFile, install) {
  const exists = fs.existsSync(settingsFile);
  // Se o JSON estiver inválido, o parse estoura aqui e nada é sobrescrito.
  const settings = exists ? JSON.parse(fs.readFileSync(settingsFile, 'utf8')) : {};
  // O backup é a última versão sem a ilha: reinstalar ou desinstalar não pode trocá-lo por uma
  // cópia já modificada, que apagaria o único registro do settings.json original.
  if (exists && !hasIslandHooks(settings)) fs.copyFileSync(settingsFile, `${settingsFile}.island-backup`);
  // Grava no alvo real: renomear sobre um link (settings.json versionado em dotfiles) o trocaria
  // por um arquivo comum.
  const target = exists ? fs.realpathSync(settingsFile) : settingsFile;
  // Temporário + rename: uma queda no meio não deixa o settings.json do Claude truncado.
  const temporaryFile = `${target}.island-tmp`;
  fs.writeFileSync(temporaryFile, `${JSON.stringify(applyHooks(settings, install), null, 2)}\n`);
  fs.renameSync(temporaryFile, target);
}

if (require.main === module) {
  const settingsFile = path.join(os.homedir(), '.claude', 'settings.json');
  const install = !process.argv.includes('--uninstall');
  updateSettingsFile(settingsFile, install);
  console.log(`${install ? 'Hooks instalados em' : 'Hooks removidos de'} ${settingsFile} (backup: settings.json.island-backup)`);
}

module.exports = { applyHooks, updateSettingsFile, COMMAND, PERMISSION_COMMAND, PERMISSION_TIMEOUT_SECONDS };
