// Descobrir e focar a janela do terminal de uma sessão. Tudo aqui depende do sistema
// operacional; por isso fica separado da lógica pura de state.js.
const { execFile, execFileSync } = require('node:child_process');
const fs = require('node:fs');

const MAX_ANCESTORS = 30;
// O hook espera a descoberta de forma síncrona: ela não pode travar a sessão do Claude.
const DISCOVERY_TIMEOUT_MS = 4_000;

const isPid = (value) => Number.isInteger(value) && value > 0;

// O PID vai por variável de ambiente, nunca interpolado no texto do script.
const WINDOWS_FIND = `
$parents = @{}
Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId | ForEach-Object { $parents[[int]$_.ProcessId] = [int]$_.ParentProcessId }
$current = [int]$env:ISLAND_PID
for ($i = 0; $i -lt ${MAX_ANCESTORS} -and $current; $i++) {
  $process = Get-Process -Id $current -ErrorAction SilentlyContinue
  if ($process -and $process.MainWindowHandle -ne 0) { $current; break }
  $current = $parents[$current]
}`;

const WINDOWS_FOCUS = `
Add-Type -Namespace Island -Name Native -MemberDefinition '
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
[DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr window, int command);
[DllImport("user32.dll")] public static extern bool IsIconic(IntPtr window);
[DllImport("user32.dll")] public static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extra);'
$window = (Get-Process -Id ([int]$env:ISLAND_PID) -ErrorAction Stop).MainWindowHandle
if ($window -eq 0) { exit 1 }
if ([Island.Native]::IsIconic($window)) { [Island.Native]::ShowWindowAsync($window, 9) | Out-Null } # 9 = SW_RESTORE
# O Windows só deixa trocar a janela ativa quem recebeu a última entrada do usuário, e este
# processo não recebeu (a ilha nem aceita foco). Um toque sintético em Alt conta como entrada.
[Island.Native]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero)
[Island.Native]::keybd_event(0x12, 0, 2, [UIntPtr]::Zero)
if (-not [Island.Native]::SetForegroundWindow($window)) { exit 2 }`;

const powershellArgs = (script) => ['-NoProfile', '-NonInteractive', '-Command', script];
const pidEnv = (pid) => ({ ...process.env, ISLAND_PID: String(pid) });

function parentOf(pid) {
  if (process.platform === 'linux') {
    // /proc/<pid>/stat: "pid (nome) estado ppid ..."; o nome pode conter espaços e parênteses.
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    return Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1]);
  }
  return Number(execFileSync('ps', ['-o', 'ppid=', '-p', String(pid)], { encoding: 'utf8', timeout: 1_000 }));
}

/**
 * Sobe a árvore de processos a partir de `startPid` e devolve o PID do primeiro ancestral
 * que é dono de uma janela (o terminal da sessão), ou null se não achar. Nunca lança.
 */
function findWindowPid(startPid) {
  try {
    if (!isPid(startPid)) return null;

    if (process.platform === 'win32') {
      const output = execFileSync('powershell.exe', powershellArgs(WINDOWS_FIND), {
        env: pidEnv(startPid), encoding: 'utf8', timeout: DISCOVERY_TIMEOUT_MS, windowsHide: true,
      });
      const found = Number(output.trim());
      return isPid(found) ? found : null;
    }

    let current = startPid;
    let topAncestor = null;
    for (let depth = 0; depth < MAX_ANCESTORS && current > 1; depth++) {
      if (process.platform === 'linux') {
        // Sem xdotool o execFileSync lança ENOENT e a função inteira devolve null.
        try {
          execFileSync('xdotool', ['search', '--onlyvisible', '--pid', String(current)], { timeout: 1_000, stdio: 'ignore' });
          return current;
        } catch (error) {
          if (error.code === 'ENOENT') return null;
          // código de saída 1 = este processo não tem janela; continua subindo
        }
      }
      topAncestor = current;
      current = parentOf(current);
    }
    // ponytail: no macOS o ancestral logo abaixo do launchd é o app do terminal na prática
    // (Terminal, iTerm2, VS Code). Se aparecer um caso que fuja disso, perguntar ao
    // System Events qual ancestral tem janela.
    return process.platform === 'darwin' ? topAncestor : null;
  } catch {
    return null;
  }
}

/** Traz para frente a janela do processo `pid`. `onDone(error)` é opcional. */
function focusWindow(pid, onDone = () => {}) {
  // O PID vem de um arquivo em disco: só segue adiante se for mesmo um inteiro.
  if (!isPid(pid)) return onDone(new Error('PID inválido'));
  const options = { timeout: 10_000, windowsHide: true };

  if (process.platform === 'win32') {
    execFile('powershell.exe', powershellArgs(WINDOWS_FOCUS), { ...options, env: pidEnv(pid) }, onDone);
  } else if (process.platform === 'darwin') {
    const script = `tell application "System Events" to set frontmost of (first process whose unix id is ${pid}) to true`;
    execFile('osascript', ['-e', script], options, onDone);
  } else {
    execFile('xdotool', ['search', '--onlyvisible', '--pid', String(pid), 'windowactivate'], options, onDone);
  }
}

module.exports = { findWindowPid, focusWindow };
