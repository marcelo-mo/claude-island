# Compara duas capturas PNG da ilha e imprime o percentual de pixels diferentes (elegibilidade de E2, D-12).
# Um pixel e diferente quando algum canal (A, R, G, B) difere em mais que -Tolerance; tamanhos diferentes = 100.
# Uso: powershell -NoProfile -File spike/compare-captures.ps1 -A <png> -B <png> [-Tolerance 8]
param(
  [Parameter(Mandatory)][string]$A,
  [Parameter(Mandatory)][string]$B,
  [int]$Tolerance = 8
)
$ErrorActionPreference = 'Stop'
foreach ($path in @($A, $B)) {
  if (-not (Test-Path -LiteralPath $path)) { Write-Error "arquivo nao encontrado: $path"; exit 1 }
}

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class CaptureCompare {
  static byte[] Pixels(string path, out int width, out int height) {
    using (var source = new Bitmap(path)) {
      width = source.Width; height = source.Height;
      var data = source.LockBits(new Rectangle(0, 0, width, height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      try {
        var bytes = new byte[Math.Abs(data.Stride) * height];
        Marshal.Copy(data.Scan0, bytes, 0, bytes.Length);
        return bytes;
      } finally { source.UnlockBits(data); }
    }
  }

  public static double DiffPercent(string pathA, string pathB, int tolerance) {
    int widthA, heightA, widthB, heightB;
    byte[] a = Pixels(pathA, out widthA, out heightA);
    byte[] b = Pixels(pathB, out widthB, out heightB);
    if (widthA != widthB || heightA != heightB) return 100.0;
    long different = 0;
    for (int i = 0; i < a.Length; i += 4) {
      if (Math.Abs(a[i] - b[i]) > tolerance || Math.Abs(a[i + 1] - b[i + 1]) > tolerance ||
          Math.Abs(a[i + 2] - b[i + 2]) > tolerance || Math.Abs(a[i + 3] - b[i + 3]) > tolerance) different++;
    }
    return different * 100.0 / (widthA * heightA);
  }
}
'@

$percent = [CaptureCompare]::DiffPercent((Resolve-Path -LiteralPath $A).Path, (Resolve-Path -LiteralPath $B).Path, $Tolerance)
# Cultura invariante: o Windows pt-BR do autor imprimiria virgula.
Write-Output $percent.ToString('F4', [Globalization.CultureInfo]::InvariantCulture)
