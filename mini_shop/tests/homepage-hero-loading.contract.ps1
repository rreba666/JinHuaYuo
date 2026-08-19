$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$path = Join-Path $root "pages/index/index.vue"
$source = Get-Content -Raw -Encoding utf8 -LiteralPath $path

function Assert-Marker([string]$marker, [string]$message) {
  if ($source.IndexOf($marker, [StringComparison]::Ordinal) -lt 0) {
    throw $message
  }
}

Assert-Marker '<view v-if="loading" class="hero-skeleton"' 'homepage must show a hero skeleton during the initial load'
Assert-Marker 'v-else-if="heroImages.length"' 'hero carousel must wait until the initial loading state is complete'
Assert-Marker "const heroHeightStyle = '960rpx'" 'homepage loading must reserve the fixed hero height'
Assert-Marker '.hero-skeleton {' 'hero skeleton must have a dedicated layout style'
Assert-Marker 'min-height: 960rpx' 'hero skeleton must reserve the full 750x960 image height'

Write-Output "homepage hero loading contract: PASS"
