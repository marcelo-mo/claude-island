# Compila a casca Tauri do spike fora do repositório (o target passa de 1 GB) e embute a index.html da raiz.
# Uso: powershell -NoProfile -File spike/tauri/build.ps1 [-Features <lista separada por vírgula>]
# Com -Features o build vai para uma pasta de target própria: um build com feature de teste nunca
# substitui o .exe que foi medido.
param([string[]]$Features = @())
$ErrorActionPreference = 'Stop'
# powershell -File entrega listas separadas por vírgula como uma única string.
$Features = @($Features | ForEach-Object { $_ -split ',' } | Where-Object { $_ })

$tauriDir = $PSScriptRoot
$repoRoot = [IO.Path]::GetFullPath((Join-Path $tauriDir '..\..'))
$manifest = Join-Path $tauriDir 'src-tauri\Cargo.toml'

$targetName = 'spike-tauri-target'
if ($Features.Count -gt 0) { $targetName += '-' + ($Features -join '-') }
$env:CARGO_TARGET_DIR = Join-Path $env:LOCALAPPDATA "claude-island\$targetName"

# O Tauri embute a pasta ui/; a cópia é ignorada pelo git.
$uiDir = Join-Path $tauriDir 'ui'
New-Item -ItemType Directory -Force -Path $uiDir | Out-Null
$source = Join-Path $repoRoot 'index.html'
$copy = Join-Path $uiDir 'index.html'
Copy-Item -LiteralPath $source -Destination $copy -Force

# O blob do git normaliza CRLF, então a comparação não depende de como o arquivo está no disco.
$sourceBlob = (& git hash-object --path=index.html $source) -join ''
$copyBlob = (& git hash-object --path=index.html $copy) -join ''
if (-not $sourceBlob -or $sourceBlob -ne $copyBlob) { throw "a index.html embutida difere da raiz ($sourceBlob x $copyBlob)" }

# Limpar só o pacote força reembutir a index.html sem recompilar as ~430 crates.
& cargo clean --release -p claude-island-spike --manifest-path $manifest
if ($LASTEXITCODE -ne 0) { throw "cargo clean falhou ($LASTEXITCODE)" }
# Sem custom-protocol o release tenta carregar devUrl em vez dos arquivos embutidos.
$cargoFeatures = (@('tauri/custom-protocol') + $Features) -join ','
& cargo build --release --quiet --features $cargoFeatures --manifest-path $manifest
if ($LASTEXITCODE -ne 0) { throw "cargo build falhou ($LASTEXITCODE)" }

$exe = Join-Path $env:CARGO_TARGET_DIR 'release\claude-island-spike.exe'
if (-not (Test-Path -LiteralPath $exe)) { throw "o executável não foi gerado: $exe" }
# Carimbo conferido pelas medições: prova qual index.html está dentro do .exe.
[IO.File]::WriteAllText((Join-Path $env:CARGO_TARGET_DIR 'release\ui-index.blob'), $sourceBlob)
Write-Output $exe
