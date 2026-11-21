# Mede a convivência da nossa ilha com a ilha do mod "Dynamic Island for Windows" (Windhawk) por um tempo fixo
# (CONV-02, CHK-61): nenhuma das duas pode sumir atrás da outra, a ordem entre elas não pode inverter e a nossa
# janela não pode cobrir a pílula do mod.
#
# Uso (Windows PowerShell 5.1; com as duas ilhas visíveis e sem mexer no mouse):
#   powershell -NoProfile -File scripts/measure-coexistence.ps1 -DurationSec 300
#
# Somente leitura: EnumWindows, GetClassNameW, GetWindowTextW, GetWindowRect, IsWindowVisible e
# GetWindowThreadProcessId, mais SetThreadDpiAwarenessContext, que só muda a thread do próprio script. Nunca move,
# mostra, esconde nem manda mensagem para janela alguma, e não lê nem grava o registro. Mostrar a ilha do mod é
# tarefa de quem roda (o atalho dele ou reiniciar o mod): o script só recusa se ela estiver escondida.
#
# Saída: 0 = convivência limpa; 1 = inversão de ordem, sumiço ou sobreposição em mais de 1 amostra;
#        2 = não dá para medir (ilha do mod ou a nossa não visível no início); 3 = o script falhou.
param(
  [int]$DurationSec = 300,
  [int]$IntervalMs = 500,
  [string]$OutCsv = (Join-Path $env:TEMP ("claude-island-coexistence-{0}.csv" -f (Get-Date -Format 'yyyyMMdd-HHmmss')))
)
$ErrorActionPreference = 'Stop'
# Erro inesperado sai com 3, separado do 1 de "convivência falhou".
trap { Write-Host "Falha do medidor: $_"; exit 3 }
# O console do Windows em pt-BR usa a página OEM: sem isto os acentos saem quebrados quando a saída é redirecionada.
[Console]::OutputEncoding = New-Object Text.UTF8Encoding $false
$inv = [Globalization.CultureInfo]::InvariantCulture
# Validado aqui, e não com ValidateRange: erro de parâmetro do -File sai com 1, que aqui quer dizer "falhou".
if ($DurationSec -lt 1 -or $IntervalMs -lt 100) {
  Write-Host 'Parâmetros inválidos: -DurationSec >= 1 e -IntervalMs >= 100.'
  exit 2
}

Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public static class Coexistence {
  public class Window {
    public long Hwnd; public int Z; public string Class; public bool Visible;
    public int L; public int T; public int R; public int B;
  }
  delegate bool EnumProc(IntPtr hwnd, IntPtr lParam);
  [StructLayout(LayoutKind.Sequential)] struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc proc, IntPtr lParam);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassNameW(IntPtr hwnd, StringBuilder text, int max);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowTextW(IntPtr hwnd, StringBuilder text, int max);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);

  // Janelas que interessam, na ordem de z (a primeira está acima de todas). Z é a posição na lista completa.
  public static List<Window> Snapshot() {
    // Coordenadas físicas: sem isto o retângulo de uma janela num monitor de 125% sai virtualizado.
    SetThreadDpiAwarenessContext(new IntPtr(-4));
    var found = new List<Window>();
    int z = 0;
    EnumWindows((hwnd, lParam) => {
      z++;
      var cls = new StringBuilder(256);
      GetClassNameW(hwnd, cls, cls.Capacity);
      string name = cls.ToString();
      var title = new StringBuilder(256);
      GetWindowTextW(hwnd, title, title.Capacity);
      bool ours = name == "Chrome_WidgetWin_1" && title.ToString() == "Claude Island";
      if (!ours && name != "Windhawk.DynamicIslandForWindows" && name != "DynamicIslandBackdrop") return true;
      RECT r; GetWindowRect(hwnd, out r);
      found.Add(new Window { Hwnd = hwnd.ToInt64(), Z = z, Class = name, Visible = IsWindowVisible(hwnd), L = r.L, T = r.T, R = r.R, B = r.B });
      return true;
    }, IntPtr.Zero);
    return found;
  }
}
'@

function Get-OverlapArea($a, $b) {
  $width = [Math]::Min($a.R, $b.R) - [Math]::Max($a.L, $b.L)
  $height = [Math]::Min($a.B, $b.B) - [Math]::Max($a.T, $b.T)
  if ($width -le 0 -or $height -le 0) { return 0 }
  return [long]$width * $height
}

# Sem a janela DynamicIslandBackdrop (blur do mod desligado, ou um instante em que ela some), a pílula é estimada
# pelo palco: o maior painel do mod (380×184 com hover de 1,025), centrado, 22 px abaixo do topo do palco. A escala
# sai da largura do palco (936 px a 100%). Valores do mod, MIT, ver THIRD_PARTY_NOTICES.md.
function Get-EstimatedPill($stage) {
  $scale = ($stage.R - $stage.L) / 936
  $halfWidth = 380 * 1.025 / 2 * $scale
  $center = ($stage.L + $stage.R) / 2
  $top = $stage.T + 22 * $scale
  [pscustomobject]@{ L = [int]($center - $halfWidth); R = [int]($center + $halfWidth); T = [int]$top; B = [int]($top + 184 * 1.025 * $scale) }
}

function Get-Sample {
  $windows = [Coexistence]::Snapshot()
  $mods = @($windows | Where-Object { $_.Class -eq 'Windhawk.DynamicIslandForWindows' })
  $mod = $mods | Select-Object -First 1
  # A janela DynamicIslandBackdrop acompanha a pílula viva com 1 px de recuo (.wh.cpp:3751).
  $backdrop = $windows | Where-Object { $_.Class -eq 'DynamicIslandBackdrop' -and $_.Visible } | Select-Object -First 1
  $pill = if ($backdrop) { $backdrop } elseif ($mod) { Get-EstimatedPill $mod } else { $null }
  [pscustomobject]@{
    Mod = $mod; ModCount = $mods.Count; Pill = $pill; PillSource = $(if ($backdrop) { 'backdrop' } else { 'estimada' })
    Ours = @($windows | Where-Object { $_.Class -eq 'Chrome_WidgetWin_1' })
  }
}

$first = Get-Sample
if (-not $first.Mod -or -not $first.Mod.Visible) {
  Write-Host 'Não dá para medir: a ilha do mod não está visível. Mostre-a (atalho do mod ou reinicie o mod) e rode de novo.'
  exit 2
}
$tracked = @($first.Ours | Where-Object { $_.Visible })
if ($tracked.Count -eq 0) {
  Write-Host 'Não dá para medir: nenhuma janela "Claude Island" visível. Suba a ilha com uma sessão na tela e rode de novo.'
  exit 2
}
if ($first.ModCount -gt 1) { Write-Host "Aviso: $($first.ModCount) janelas do mod; a medição usa a primeira na ordem de z." }
if ($first.PillSource -eq 'estimada') {
  Write-Host 'Aviso: sem a janela DynamicIslandBackdrop (blur do mod desligado); a pílula do mod é estimada pelo maior painel.'
}

# Relação de cada janela nossa com o mod: acima (z menor) ou abaixo. Uma inversão é uma troca dessa relação.
$lastAbove = @{}
foreach ($window in $tracked) { $lastAbove[$window.Hwnd] = $window.Z -lt $first.Mod.Z }

$rows = New-Object System.Collections.Generic.List[string]
$rows.Add('t_ms,mod_visible,mod_z,pill_source,pill_l,pill_t,pill_r,pill_b,ours_hwnd,ours_visible,ours_z,ours_above_mod,overlap_px2')
$inversions = 0; $disappearances = 0; $overlapSamples = 0; $maxOverlap = 0; $samples = 0
$clock = [Diagnostics.Stopwatch]::StartNew()
while ($clock.ElapsedMilliseconds -lt $DurationSec * 1000) {
  $sample = Get-Sample
  $samples++
  $elapsed = $clock.ElapsedMilliseconds
  $modVisible = [bool]($sample.Mod -and $sample.Mod.Visible)
  if (-not $modVisible) { $disappearances++ }
  $sampleOverlap = 0
  foreach ($window in $tracked) {
    $current = $sample.Ours | Where-Object { $_.Hwnd -eq $window.Hwnd } | Select-Object -First 1
    $visible = [bool]($current -and $current.Visible)
    if (-not $visible) { $disappearances++ }
    $above = $lastAbove[$window.Hwnd]; $overlap = 0; $z = -1
    if ($current -and $sample.Mod) {
      $z = $current.Z
      $above = $current.Z -lt $sample.Mod.Z
      if ($above -ne $lastAbove[$window.Hwnd]) { $inversions++; $lastAbove[$window.Hwnd] = $above }
      if ($visible -and $modVisible) { $overlap = Get-OverlapArea $current $sample.Pill }
    }
    $sampleOverlap = [Math]::Max($sampleOverlap, $overlap)
    $pill = $sample.Pill
    $rows.Add(('{0},{1},{2},{3},{4},{5},{6},{7},{8},{9},{10},{11},{12}' -f $elapsed, $modVisible, $(if ($sample.Mod) { $sample.Mod.Z } else { -1 }),
      $sample.PillSource, $pill.L, $pill.T, $pill.R, $pill.B, $window.Hwnd, $visible, $z, $above, $overlap))
  }
  if ($sampleOverlap -gt 0) { $overlapSamples++ }
  $maxOverlap = [Math]::Max($maxOverlap, $sampleOverlap)
  Start-Sleep -Milliseconds $IntervalMs
}

[IO.File]::WriteAllLines($OutCsv, $rows, (New-Object Text.UTF8Encoding $false))
$summary = 'amostras={0} duracao_s={1} janelas_nossas={2} inversoes={3} amostras_com_sumico={4} amostras_com_sobreposicao={5} maior_sobreposicao_px2={6} pilula_do_mod={7}' -f `
  $samples, ($clock.ElapsedMilliseconds / 1000).ToString('0.0', $inv), $tracked.Count, $inversions, $disappearances, $overlapSamples, $maxOverlap, $first.PillSource
Write-Host $summary
Write-Host "CSV: $OutCsv"
if ($inversions -gt 0 -or $disappearances -gt 0 -or $overlapSamples -gt 1) { exit 1 }
exit 0
