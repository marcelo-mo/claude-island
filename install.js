// Registra (ou remove, com --uninstall) os hooks da ilha no ~/.claude/settings.json.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const EVENTS = ['UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Notification', 'Stop', 'SessionEnd'];
const HOOK_SCRIPT = path.join(__dirname, 'hook.js');
const COMMAND = `"${process.execPath}" "${HOOK_SCRIPT}"`;

const isOurs = (entry) => (entry.hooks || []).some((hook) => (hook.command || '').includes(HOOK_SCRIPT));

/** Devolve um novo objeto de settings com os hooks da ilha removidos e, se `install`, recolocados. */
function applyHooks(settings, install) {
  const hooks = { ...(settings.hooks || {}) };
  for (const event of EVENTS) {
    const others = (hooks[event] || []).filter((entry) => !isOurs(entry));
    if (install) others.push({ matcher: '', hooks: [{ type: 'command', command: COMMAND }] });
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

module.exports = { applyHooks, COMMAND };
