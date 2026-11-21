# Extrai as variantes E0, E1 e E3 do spike para fora do repositorio, por commit (D-06).
# E0 = Electron antes do BASE-05; E1 = commit do BASE-05 (fixado, nao o HEAD); E3 = E1 com uma janela so.
# O main.js do repositorio nunca muda: o patch de E3 existe apenas na copia.
# Uso: powershell -NoProfile -File spike/prepare-variants.ps1 [-OutRoot <pasta>] [-BaselineCommit <sha>] [-OptimizedCommit <sha>]
# Imprime um JSON { e0, e1, e3 } com dir, commit e indexBlob (e patch no e3).
param(
  [string]$OutRoot = (Join-Path $env:LOCALAPPDATA 'claude-island\spike-variants'),
  [string]$BaselineCommit = '2530f30',
  [string]$OptimizedCommit = ''
)
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$utf8NoBom = New-Object Text.UTF8Encoding $false

function Invoke-Git {
  $output = & git -C $repoRoot @args
  if ($LASTEXITCODE -ne 0) { throw "git $($args -join ' ') falhou" }
  ($output -join "`n").Trim()
}

if (-not $OptimizedCommit) { $OptimizedCommit = Invoke-Git log -1 --format=%H -- index.html }
$e0Sha = Invoke-Git rev-parse "$BaselineCommit^{commit}"
$e1Sha = Invoke-Git rev-parse "$OptimizedCommit^{commit}"

# So apaga pasta sob %LOCALAPPDATA%: um parametro errado nao pode levar uma pasta de verdade.
$OutRoot = [IO.Path]::GetFullPath($OutRoot).TrimEnd('\')
$safeRoot = [IO.Path]::GetFullPath($env:LOCALAPPDATA).TrimEnd('\') + '\'
if (-not ($OutRoot + '\').StartsWith($safeRoot, [StringComparison]::OrdinalIgnoreCase)) {
  throw "-OutRoot so aceita caminhos sob %LOCALAPPDATA%: $OutRoot"
}

function New-CleanDir([string]$path) {
  if (Test-Path $path) { Remove-Item $path -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $path | Out-Null
}

# git archive em zip + Expand-Archive: o tar do Git Bash quebra caminho do Windows.
function Expand-Commit([string]$sha, [string]$destination) {
  New-CleanDir $destination
  $zip = Join-Path $env:TEMP ("variant-{0}.zip" -f [guid]::NewGuid().ToString('N'))
  try {
    Invoke-Git archive --format=zip -o $zip $sha package.json main.js preload.js state.js window.js index.html | Out-Null
    Expand-Archive -LiteralPath $zip -DestinationPath $destination -Force
  } finally {
    Remove-Item $zip -ErrorAction SilentlyContinue
  }
}

# O blob do git normaliza CRLF: a comparacao nao depende de como o arquivo ficou no disco.
function Get-IndexBlob([string]$dir) {
  (& git -C $repoRoot hash-object --path=index.html (Join-Path $dir 'index.html')) -join ''
}

$e0Dir = Join-Path $OutRoot 'e0'
$e1Dir = Join-Path $OutRoot 'e1'
$e3Dir = Join-Path $OutRoot 'e3'
Expand-Commit $e0Sha $e0Dir
Expand-Commit $e1Sha $e1Dir

# E3: copia de E1 com uma unica janela (monitor principal).
New-CleanDir $e3Dir
Copy-Item -Path (Join-Path $e1Dir '*') -Destination $e3Dir -Recurse -Force
$mainPath = Join-Path $e3Dir 'main.js'
$mainText = [IO.File]::ReadAllText($mainPath, $utf8NoBom)
$before = 'const displays = screen.getAllDisplays();'
$after = 'const displays = [screen.getPrimaryDisplay()];'
$occurrences = ([regex]::Matches($mainText, [regex]::Escape($before))).Count
if ($occurrences -ne 1) { throw "patch de E3: esperava 1 ocorrencia de '$before', achei $occurrences" }
$patched = $mainText.Replace($before, $after)
if (([regex]::Matches($patched, [regex]::Escape($before))).Count -ne 0) { throw 'patch de E3: a linha original continua no main.js' }
[IO.File]::WriteAllText($mainPath, $patched, $utf8NoBom)

$e0Blob = Get-IndexBlob $e0Dir
$e1Blob = Get-IndexBlob $e1Dir
$e3Blob = Get-IndexBlob $e3Dir
$e1Expected = Invoke-Git rev-parse "${e1Sha}:index.html"
$headBlob = Invoke-Git rev-parse 'HEAD:index.html'
if ($e1Blob -ne $e1Expected) { throw "index.html de E1 ($e1Blob) difere do commit $e1Sha ($e1Expected)" }
if ($e1Blob -ne $headBlob) { throw "index.html de E1 ($e1Blob) difere da do HEAD ($headBlob): algo mudou depois do BASE-05" }
if ($e1Blob -eq $e0Blob) { throw 'index.html de E1 igual a de E0: o BASE-05 tem de estar em E1 e nao em E0' }
if ($e3Blob -ne $e1Blob) { throw 'index.html de E3 difere da de E1' }

[pscustomobject]@{
  e0 = [pscustomobject]@{ dir = $e0Dir; commit = $e0Sha; indexBlob = $e0Blob }
  e1 = [pscustomobject]@{ dir = $e1Dir; commit = $e1Sha; indexBlob = $e1Blob }
  e3 = [pscustomobject]@{ dir = $e3Dir; commit = $e1Sha; indexBlob = $e3Blob; patch = "$before -> $after" }
} | ConvertTo-Json -Depth 4
