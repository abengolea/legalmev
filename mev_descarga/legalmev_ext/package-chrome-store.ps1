# Genera LegalMev-<version>.zip para subir a Chrome Web Store (sin node_modules ni dev).
# Uso (PowerShell):  cd ...\mev_exporter_ext ; .\package-chrome-store.ps1
# Si ExecutionPolicy bloquea:  powershell -ExecutionPolicy Bypass -File .\package-chrome-store.ps1

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$manifestPath = Join-Path $root 'manifest.json'
if (-not (Test-Path $manifestPath)) {
  throw "manifest.json no encontrado en $root"
}
$ver = (Get-Content $manifestPath -Raw | ConvertFrom-Json).version
$parent = Split-Path $root -Parent
$outPath = Join-Path $parent "LegalMev-$ver.zip"

$tmp = Join-Path $env:TEMP "legalmev-chrome-pack-$([guid]::NewGuid().ToString('n'))"
try {
  New-Item -ItemType Directory -Path $tmp | Out-Null
  $null = & robocopy $root $tmp /E `
    /XD node_modules scripts .git `
    /XF manifest.dev.json package.json package-lock.json package-chrome-store.ps1 `
    /NFL /NDL /NJH /NJS
  # robocopy: 0-7 = OK para nuestro caso (archivos copiados o nada que copiar)
  if ($LASTEXITCODE -ge 8) {
    throw "robocopy falló con código $LASTEXITCODE"
  }

  # P1-A: no incluir en el ZIP de tienda (docs dev, artefactos macOS, zips viejos, readme de iconos).
  foreach ($rel in @(
      'BUILD.md', 'INTEGRATION.md', 'icons\README.md',
      'legalmev1.0.zip', 'legalmev2.0.zip', 'LegalMev-1.0.0.zip', 'LegalMev-2.0.0.zip'
    )) {
    $p = Join-Path $tmp $rel
    if (Test-Path $p) { Remove-Item $p -Force -Recurse -ErrorAction SilentlyContinue }
  }
  Get-ChildItem -Path $tmp -Filter '.DS_Store' -Recurse -Force -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
  Get-ChildItem -Path $tmp -Filter '_*' -Recurse -Force -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
  $macosx = Join-Path $tmp '__MACOSX'
  if (Test-Path $macosx) { Remove-Item $macosx -Recurse -Force }

  if (Test-Path $outPath) {
    Remove-Item $outPath -Force
  }
  Compress-Archive -Path (Join-Path $tmp '*') -DestinationPath $outPath -Force
  $sizeMb = [math]::Round((Get-Item $outPath).Length / 1MB, 2)
  Write-Host "ZIP generado: $outPath ($sizeMb MB)"
} finally {
  if (Test-Path $tmp) {
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
  }
}
