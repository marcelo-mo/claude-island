// Registra (ou remove, com --uninstall) os hooks da ilha no ~/.claude/settings.json.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { PERMISSION_WAIT_MS } = require('./state');

const EVENTS = ['UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Notification', 'Stop', 'SessionEnd'];
const HOOK_SCRIPT = path.join(__dirname, 'hook.js');
const PERMISSION_SCRIPT = path.join(__dirname, 'permission-hook.js');
const commandFor = (script) => `"${process.execPath}" "${script}"`;
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

const isOurs = (entry) => (entry.hooks || []).some((hook) => {
  const command = hook.command || '';
  return command.includes(HOOK_SCRIPT) || command.includes(PERMISSION_SCRIPT);
});

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

if (require.main === module) {
  const settingsFile = path.join(os.homedir(), '.claude', 'settings.json');
  const install = !process.argv.includes('--uninstall');
  // Se o JSON estiver inválido, o parse estoura aqui e nada é sobrescrito.
  const settings = fs.existsSync(settingsFile) ? JSON.parse(fs.readFileSync(settingsFile, 'utf8')) : {};
  if (fs.existsSync(settingsFile)) fs.copyFileSync(settingsFile, `${settingsFile}.island-backup`);
  fs.writeFileSync(settingsFile, `${JSON.stringify(applyHooks(settings, install), null, 2)}\n`);
  console.log(`${install ? 'Hooks instalados em' : 'Hooks removidos de'} ${settingsFile} (backup: settings.json.island-backup)`);
}

module.exports = { applyHooks, COMMAND, PERMISSION_COMMAND, PERMISSION_TIMEOUT_SECONDS };
