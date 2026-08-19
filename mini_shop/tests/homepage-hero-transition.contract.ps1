$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$path = Join-Path $root "pages/index/index.vue"
$source = Get-Content -Raw -Encoding utf8 -LiteralPath $path

function Assert-Marker([string]$marker, [string]$message) {
  if ($source.IndexOf($marker, [StringComparison]::Ordinal) -lt 0) {
    throw $message
  }
}

Assert-Marker "const heroHeightStyle = '960rpx'" 'hero transition must use the fixed 750x960 design ratio'
Assert-Marker ':style="{ height: heroHeightStyle }"' 'hero transition must keep a stable container height'

if ($source.Contains('@change="handleHeroChange"') -or $source.Contains('@animationfinish="handleHeroAnimationFinish"')) {
  throw 'hero transition must not resize the container during or after slide animation'
}
if ($source.Contains('heroHeightPx') -or $source.Contains('updateHeroHeight')) {
  throw 'hero transition must not use runtime height mutation'
}

Write-Output "homepage hero transition contract: PASS"
