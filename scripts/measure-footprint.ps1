# Mede o consumo de uma variante da ilha (Electron ou Tauri) em cenários fixos (BASE-01).
# Soma private working set e CPU da árvore de processos inteira e confere onde estão as janelas.
#
# Uso (Windows PowerShell 5.1; rode da raiz do repositório):
#   Electron, o próprio checkout como app:
#     powershell -NoProfile -File scripts/measure-footprint.ps1 -Label e1 -App . -Source <sha>
#   Electron com argumento extra do Chromium (E2):
#     powershell -NoProfile -File scripts/measure-footprint.ps1 -Label e2 -App <pasta> -ArgumentList '--in-process-gpu'
#   Tauri (T0), cache do WebView2 apagado antes de cada execução:
#     powershell -NoProfile -File scripts/measure-footprint.ps1 -Label t0 -Exe <exe> -ExtraEnv 'ISLAND_WINDOWS=1' `
#       -CleanDirs <exe>.WebView2
#
# {home} em -ArgumentList vira a pasta descartável da execução. Cada execução usa um USERPROFILE próprio (a ilha
# lê as sessões de os.homedir()), então nada é lido nem gravado no ~/.claude real. Nunca liga porta de depuração,
# nunca roda install.js e só encerra processos pelo PID que ele mesmo lançou (a ilha viva também é electron.exe).
param(
  [Parameter(Mandatory)][string]$Label,
  [string]$App = '',
  [string]$Exe = '',
  [string]$ArgumentList = '',
  [string[]]$ExtraEnv = @(),
  [string[]]$CleanDirs = @(),
  [string]$Source = '',
  [string[]]$Scenarios = @('idle', 'running', 'waiting'),
  [int]$Runs = 3,
  [int]$WarmupSeconds = 30,
  [int]$Seconds = 60,
  [int]$IntervalSeconds = 5,
  [string]$OutDir = (Join-Path $PSScriptRoot '..\spike\results'),
  [string]$CaptureDir = ''
)
$ErrorActionPreference = 'Stop'
# powershell -File entrega listas separadas por vírgula como uma única string.
$Scenarios = @($Scenarios | ForEach-Object { $_ -split ',' } | Where-Object { $_ })
$ExtraEnv = @($ExtraEnv | ForEach-Object { $_ -split ',' } | Where-Object { $_ })
$CleanDirs = @($CleanDirs | ForEach-Object { $_ -split ',' } | Where-Object { $_ })
# O Windows do autor é pt-BR: sem a cultura invariante os números saem com vírgula ("103,3").
$inv = [Globalization.CultureInfo]::InvariantCulture
$utf8 = New-Object Text.UTF8Encoding $false

if (-not $App -and -not $Exe) { throw 'informe -App (pasta de um app Electron) ou -Exe' }
foreach ($scenario in $Scenarios) {
  if (@('idle', 'running', 'waiting') -notcontains $scenario) { throw "cenário desconhecido: $scenario" }
}

function Get-FullPath([string]$path) {
  # GetFullPath usa o diretório do processo; ancorar no local do PowerShell evita surpresa.
  if (-not [IO.Path]::IsPathRooted($path)) { $path = Join-Path (Get-Location).Path $path }
  [IO.Path]::GetFullPath($path)
}

$repoRoot = Get-FullPath (Join-Path $PSScriptRoot '..')
$resultsDir = (Get-FullPath (Join-Path $repoRoot 'spike\results')).TrimEnd('\')
$OutDir = (Get-FullPath $OutDir).TrimEnd('\')
$writesToRepoResults = $OutDir -ieq $resultsDir

# D-08: nenhum número entra em spike/results antes de a regra de decisão estar commitada.
if ($writesToRepoResults) {
  $ruleCommit = (& git -C $repoRoot log -1 --format=%H -- spike/REGRA-DE-DECISAO.md) -join ''
  if (-not $ruleCommit) { throw 'spike/REGRA-DE-DECISAO.md ainda não foi commitada: a regra vem antes dos números (D-08)' }
}

# -CleanDirs só apaga sob %LOCALAPPDATA% ou %TEMP%: um caminho errado aqui não pode levar uma pasta de verdade.
$safeRoots = @($env:LOCALAPPDATA, $env:TEMP) | Where-Object { $_ } |
  ForEach-Object { (Get-FullPath $_).TrimEnd('\') + '\' }
$CleanDirs = @($CleanDirs | ForEach-Object {
  # Sem a barra final, "%LOCALAPPDATA%\" não vira a própria raiz segura; o StartsWith com a raiz terminada em '\'
  # só aceita subpastas estritas.
  $full = (Get-FullPath $_).TrimEnd('\')
  $allowed = $false
  foreach ($root in $safeRoots) { if ($full.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) { $allowed = $true } }
  if (-not $allowed) { throw "-CleanDirs só aceita caminhos sob %LOCALAPPDATA% ou %TEMP%: $full" }
  $full
})

# Executável e argumentos. O Electron do checkout principal serve também de dentro de um worktree (que não tem node_modules).
if ($App) {
  $appDir = (Resolve-Path $App).Path
  if (-not $Exe) {
    $commonGitDir = (& git -C $repoRoot rev-parse --path-format=absolute --git-common-dir) -join ''
    $Exe = Join-Path (Split-Path $commonGitDir) 'node_modules\.pnpm\electron@45.4.1\node_modules\electron\dist\electron.exe'
  }
  $argumentTemplate = ('"{0}" --user-data-dir="{{home}}\ud" {1}' -f $appDir, $ArgumentList).Trim()
} else {
  $argumentTemplate = $ArgumentList
}
if (-not (Test-Path $Exe)) { throw "executável não encontrado: $Exe" }

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Text;

public class IslandWindowInfo {
  public uint pid;
  public int x, y, width, height;
  public uint dpi;
  public int widthDip, heightDip;
  public string exStyle;
  public bool topmost, toolWindow, appWindow;
  public int workX, workY, workWidth, workHeight;
}

public static class IslandWindows {
  delegate bool EnumProc(IntPtr hwnd, IntPtr lParam);
  [StructLayout(LayoutKind.Sequential)] struct RECT { public int Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential)] struct MONITORINFO { public int cbSize; public RECT rcMonitor; public RECT rcWork; public uint dwFlags; }
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback, IntPtr lParam);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd, StringBuilder name, int max);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
  [DllImport("user32.dll")] static extern uint GetDpiForWindow(IntPtr hwnd);
  [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint flags);
  [DllImport("user32.dll")] static extern bool GetMonitorInfo(IntPtr monitor, ref MONITORINFO info);
  [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] static extern IntPtr GetWindowLongPtr(IntPtr hwnd, int index);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
  [DllImport("user32.dll")] static extern bool PrintWindow(IntPtr hwnd, IntPtr hdc, uint flags);

  const int GWL_EXSTYLE = -20;
  const long WS_EX_TOPMOST = 0x8, WS_EX_TOOLWINDOW = 0x80, WS_EX_APPWINDOW = 0x40000;

  // Dono da janela em primeiro plano (0 se nenhuma). Lido com a mesma thread, antes de qualquer captura.
  public static uint ForegroundPid() {
    uint pid; GetWindowThreadProcessId(GetForegroundWindow(), out pid); return pid;
  }

  // Janelas visíveis de tamanho não nulo dos PIDs dados, em pixels FÍSICOS (thread em DPI por monitor).
  // Com captureBase (vazio ou nulo = sem captura), grava também {captureBase}-{n}.png por PrintWindow (flag 2 = renderiza o conteúdo).
  public static List<IslandWindowInfo> ForPids(uint[] pids, string captureBase) {
    // -4 = DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2; restaura o anterior no fim.
    IntPtr previous = SetThreadDpiAwarenessContext(new IntPtr(-4));
    var found = new List<IslandWindowInfo>();
    try {
      int n = 0;
      EnumWindows((hwnd, lParam) => {
        uint pid; GetWindowThreadProcessId(hwnd, out pid);
        if (Array.IndexOf(pids, pid) < 0 || !IsWindowVisible(hwnd)) return true;
        // Janela de mensagens interna do Tao (16x16, nunca desenha): não é a ilha e invalidaria a validade da D-10.
        var className = new StringBuilder(256); GetClassName(hwnd, className, 256);
        if (className.ToString() == "Tao Thread Event Target") return true;
        RECT rect; GetWindowRect(hwnd, out rect);
        int width = rect.Right - rect.Left, height = rect.Bottom - rect.Top;
        if (width <= 0 || height <= 0) return true;
        uint dpi = GetDpiForWindow(hwnd);
        long style = GetWindowLongPtr(hwnd, GWL_EXSTYLE).ToInt64();
        var info = new IslandWindowInfo {
          pid = pid, x = rect.Left, y = rect.Top, width = width, height = height, dpi = dpi,
          widthDip = (int)Math.Round(width * 96.0 / dpi, MidpointRounding.AwayFromZero),
          heightDip = (int)Math.Round(height * 96.0 / dpi, MidpointRounding.AwayFromZero),
          exStyle = "0x" + style.ToString("x"),
          topmost = (style & WS_EX_TOPMOST) != 0,
          toolWindow = (style & WS_EX_TOOLWINDOW) != 0,
          appWindow = (style & WS_EX_APPWINDOW) != 0,
        };
        MONITORINFO monitor = new MONITORINFO(); monitor.cbSize = Marshal.SizeOf(typeof(MONITORINFO));
        if (GetMonitorInfo(MonitorFromWindow(hwnd, 2), ref monitor)) {
          info.workX = monitor.rcWork.Left; info.workY = monitor.rcWork.Top;
          info.workWidth = monitor.rcWork.Right - monitor.rcWork.Left;
          info.workHeight = monitor.rcWork.Bottom - monitor.rcWork.Top;
        }
        found.Add(info);
        if (!string.IsNullOrEmpty(captureBase)) {
          using (var bitmap = new Bitmap(width, height, PixelFormat.Format32bppArgb)) {
            using (var graphics = Graphics.FromImage(bitmap)) {
              IntPtr hdc = graphics.GetHdc(); PrintWindow(hwnd, hdc, 2); graphics.ReleaseHdc(hdc);
            }
            bitmap.Save(captureBase + "-" + (n++) + ".png", ImageFormat.Png);
          }
        }
        return true;
      }, IntPtr.Zero);
    } finally {
      SetThreadDpiAwarenessContext(previous);
    }
    return found;
  }
}
'@

function Get-TreeSnapshot([int]$root) {
  $all = Get-CimInstance Win32_Process -Property ProcessId, ParentProcessId, Name, KernelModeTime, UserModeTime
  $ids = New-Object 'System.Collections.Generic.HashSet[int]'
  [void]$ids.Add($root)
  do {
    $before = $ids.Count
    foreach ($p in $all) { if ($ids.Contains([int]$p.ParentProcessId)) { [void]$ids.Add([int]$p.ProcessId) } }
  } while ($ids.Count -ne $before)
  @($all | Where-Object { $ids.Contains([int]$_.ProcessId) })
}

# Get-Counter usa nomes de contador localizados (falha no Windows pt-BR); a classe CIM tem nomes fixos.
function Get-PrivateWorkingSetMB($tree) {
  $ids = @{}; foreach ($p in $tree) { $ids[[uint32]$p.ProcessId] = $true }
  $sum = 0.0
  Get-CimInstance Win32_PerfFormattedData_PerfProc_Process -Property IDProcess, WorkingSetPrivate |
    ForEach-Object { if ($ids.ContainsKey([uint32]$_.IDProcess)) { $sum += [double]$_.WorkingSetPrivate } }
  $sum / 1MB
}

function Get-Median([double[]]$values) {
  $sorted = @($values | Sort-Object)
  $mid = [int][math]::Floor($sorted.Count / 2)
  if ($sorted.Count % 2) { $sorted[$mid] } else { ($sorted[$mid - 1] + $sorted[$mid]) / 2 }
}

# A CPU soma os deltas por PID a cada amostra: processo que nasce ou morre na janela não distorce.
function Measure-Window([int]$root) {
  $cpuLast = @{}; $cpuTicks = 0.0; $mem = New-Object System.Collections.Generic.List[double]
  $t0 = $null; $tn = $null; $count = 0
  $steps = [math]::Floor($Seconds / $IntervalSeconds)
  for ($i = 0; $i -le $steps; $i++) {
    $tree = Get-TreeSnapshot $root
    $tn = [DateTime]::UtcNow; if (-not $t0) { $t0 = $tn }
    foreach ($p in $tree) {
      $ticks = [double]$p.KernelModeTime + [double]$p.UserModeTime   # unidades de 100 ns
      if ($cpuLast.ContainsKey($p.ProcessId)) { $cpuTicks += $ticks - $cpuLast[$p.ProcessId] }
      elseif ($i -gt 0) { $cpuTicks += $ticks }   # nasceu dentro da janela
      $cpuLast[$p.ProcessId] = $ticks
    }
    $count = $tree.Count
    $mem.Add((Get-PrivateWorkingSetMB $tree))
    if ($i -lt $steps) { Start-Sleep -Seconds $IntervalSeconds }
  }
  $elapsed = ($tn - $t0).TotalSeconds
  [pscustomobject]@{
    processes = $count
    privateWsMb = [math]::Round(($mem | Measure-Object -Average).Average, 1)
    cpuPercentTotal = [math]::Round($cpuTicks / 1e7 / $elapsed / [Environment]::ProcessorCount * 100, 4)
    cpuPercentOfOneCore = [math]::Round($cpuTicks / 1e7 / $elapsed * 100, 3)
    seconds = [math]::Round($elapsed, 1)
  }
}

# Janelas da árvore em pixels físicos, lidas só depois da janela de medição: forçar o desenho (PrintWindow)
# durante a medição sujaria a CPU medida.
function Get-WindowReport([int[]]$treeIds, [string]$captureBase) {
  $foreground = [IslandWindows]::ForegroundPid()
  $found = [IslandWindows]::ForPids([uint32[]]$treeIds, $(if ($captureBase) { $captureBase } else { $null }))
  $windows = @($found | ForEach-Object {
    [pscustomobject]@{
      pid = [int]$_.pid; x = $_.x; y = $_.y; width = $_.width; height = $_.height
      dpi = [int]$_.dpi; widthDip = $_.widthDip; heightDip = $_.heightDip
      exStyle = $_.exStyle; topmost = $_.topmost; toolWindow = $_.toolWindow; appWindow = $_.appWindow
      monitorWork = [pscustomobject]@{ x = $_.workX; y = $_.workY; width = $_.workWidth; height = $_.workHeight }
    }
  })
  [pscustomobject]@{ windows = $windows; foregroundInTree = ($treeIds -contains [int]$foreground) }
}

# Sessão falsa: o mesmo JSON que o hook.js grava. Id fixo e HOME descartável.
function Write-FakeSession([string]$home1, [string]$scenario) {
  $dir = Join-Path $home1 '.claude\island'; New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $file = Join-Path $dir 'spike-fake.json'
  if ($scenario -eq 'idle') { Remove-Item $file -ErrorAction SilentlyContinue; return }
  $session = @{ state = $scenario; detail = 'Bash'; project = 'spike'; windowPid = $null
                updatedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() }
  if ($scenario -eq 'waiting') {
    # 20 linhas de 28 caracteres = 579: acima de 600 o state.js recusa o pedido em silêncio e a caixa não aparece.
    $text = (0..19 | ForEach-Object { 'step {0:D2}: {1}' -f $_, ('x' * 19) }) -join "`n"
    $session.detail = 'Precisa da sua resposta'
    $session.permission = @{ id = '00000000-0000-4000-8000-000000000001'; tool = 'Bash'; text = $text }
  }
  [IO.File]::WriteAllText($file, ($session | ConvertTo-Json -Depth 5), $utf8)
}

function Save-Attempt([string]$file, $record) {
  [IO.File]::WriteAllText($file, ($record | ConvertTo-Json -Depth 8), $utf8)
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
if ($CaptureDir) { New-Item -ItemType Directory -Force -Path $CaptureDir | Out-Null }
$exeVersion = (Get-Item $Exe).VersionInfo.ProductVersion
$osVersion = (Get-CimInstance Win32_OperatingSystem).Version

foreach ($scenario in $Scenarios) {
  # D-12a: cada tentativa tem o próprio arquivo e nunca sobrescreve outra.
  $attempt = 1 + @(Get-ChildItem -Path $OutDir -Filter ("{0}-{1}-a*.json" -f $Label, $scenario) -ErrorAction SilentlyContinue).Count
  if ($writesToRepoResults -and $attempt -gt 3) { throw "limite de remedições (D-12a): $Label $scenario já tem 3 tentativas" }
  $file = Join-Path $OutDir ("{0}-{1}-a{2}.json" -f $Label, $scenario, $attempt)

  $record = [ordered]@{
    label = $Label; scenario = $scenario; attempt = $attempt; status = 'started'; error = $null
    source = $Source; exe = $Exe; arguments = $argumentTemplate; env = $ExtraEnv
    measuredAt = (Get-Date).ToUniversalTime().ToString('o')
    versions = [pscustomobject]@{ exe = $exeVersion; os = $osVersion; powershell = $PSVersionTable.PSVersion.ToString() }
    logicalProcessors = [Environment]::ProcessorCount
    warmupSeconds = $WarmupSeconds; windowSeconds = $Seconds
    runs = @(); median = $null
  }
  # Gravada antes de medir: uma tentativa interrompida (timeout, Ctrl+C) continua contando.
  Save-Attempt $file $record

  $runsOut = @(); $failure = $null
  for ($run = 1; $run -le $Runs; $run++) {
    foreach ($dir in $CleanDirs) { if (Test-Path $dir) { Remove-Item $dir -Recurse -Force -ErrorAction SilentlyContinue } }
    $home1 = Join-Path $env:TEMP ("island-measure-{0}" -f [guid]::NewGuid().ToString('N'))
    Write-FakeSession $home1 $scenario
    $names = @('USERPROFILE') + ($ExtraEnv | ForEach-Object { $_.Split('=')[0] })
    $saved = @{}; foreach ($name in $names) { $saved[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
    $env:USERPROFILE = $home1
    foreach ($pair in $ExtraEnv) { $k, $v = $pair.Split('=', 2); [Environment]::SetEnvironmentVariable($k, $v, 'Process') }
    # Start-Process rejeita -ArgumentList vazio (o Tauri sobe sem argumentos): só passa quando há algo.
    $launchArgs = @{}
    if ($argumentTemplate) { $launchArgs.ArgumentList = $argumentTemplate.Replace('{home}', $home1) }
    $proc = Start-Process -FilePath $Exe @launchArgs -PassThru `
      -RedirectStandardOutput (Join-Path $home1 'out.txt') -RedirectStandardError (Join-Path $home1 'err.txt')
    foreach ($name in $saved.Keys) { [Environment]::SetEnvironmentVariable($name, $saved[$name], 'Process') }
    try {
      Start-Sleep -Seconds $WarmupSeconds
      if ($proc.HasExited) {
        $failure = "a variante $Label encerrou durante o aquecimento (execução $run)"
      } else {
        $m = Measure-Window $proc.Id
        # Um PID que morre não volta: vivo no fim da janela = vivo a janela inteira.
        $rootAlive = -not $proc.HasExited
        if (-not $rootAlive) {
          $failure = "a variante $Label encerrou durante a janela de medição (execução $run)"
        } else {
          $treeIds = @(Get-TreeSnapshot $proc.Id | ForEach-Object { [int]$_.ProcessId })
          $captureBase = if ($CaptureDir) { Join-Path $CaptureDir ("{0}-{1}-a{2}-{3}" -f $Label, $scenario, $attempt, $run) } else { '' }
          $report = Get-WindowReport $treeIds $captureBase
          $runsOut += [pscustomobject]@{
            processes = $m.processes; privateWsMb = $m.privateWsMb; cpuPercentTotal = $m.cpuPercentTotal
            cpuPercentOfOneCore = $m.cpuPercentOfOneCore; seconds = $m.seconds; rootAlive = $rootAlive
            windows = $report.windows; foregroundInTree = $report.foregroundInTree
          }
          Write-Host ("{0} {1} a{2} #{3}: {4} MB, {5}% do total ({6} processos, {7} janelas)" -f $Label, $scenario, $attempt, $run,
            $m.privateWsMb.ToString($inv), $m.cpuPercentTotal.ToString($inv), $m.processes, @($report.windows).Count)
        }
      }
      if ($failure) {
        $errFile = Join-Path $home1 'err.txt'
        if (Test-Path $errFile) { $tail = (Get-Content $errFile -Raw); if ($tail) { $failure += ': ' + $tail.Substring(0, [Math]::Min(300, $tail.Length)) } }
      }
    } finally {
      # Raiz que já saiu: o PID pode ter sido reaproveitado, então não se mata nada. Com 'Stop', o stderr do taskkill
      # (PID inexistente) viraria erro terminante no PowerShell 5.1 e interromperia este finally (a pasta vazaria e
      # a tentativa 'crashed' não seria gravada); por isso o 'Continue' ao redor da chamada.
      if (-not $proc.HasExited) {
        $previousPreference = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
        & taskkill.exe /PID $proc.Id /T /F 2>&1 | Out-Null   # por PID, nunca por nome: a ilha viva também é electron.exe
        $ErrorActionPreference = $previousPreference
      }
      Start-Sleep -Seconds 2
      Remove-Item $home1 -Recurse -Force -ErrorAction SilentlyContinue
    }
    if ($failure) { break }
  }

  $record.runs = $runsOut
  if ($runsOut.Count -gt 0) {
    $record.median = [pscustomobject]@{
      privateWsMb = [math]::Round((Get-Median ($runsOut | ForEach-Object { [double]$_.privateWsMb })), 1)
      cpuPercentTotal = [math]::Round((Get-Median ($runsOut | ForEach-Object { [double]$_.cpuPercentTotal })), 4)
      processes = Get-Median ($runsOut | ForEach-Object { [double]$_.processes })
    }
  }
  if ($failure) {
    $record.status = 'crashed'; $record.error = $failure
    Save-Attempt $file $record
    Write-Host "CAIU: $failure (gravado em $file)"
    exit 2
  }
  $record.status = 'ok'
  Save-Attempt $file $record
  Write-Host "gravado em $file"
}
