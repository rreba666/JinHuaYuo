$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$path = Join-Path $root "pages/index/index.vue"
$source = Get-Content -Raw -Encoding utf8 -LiteralPath $path

function Assert-Marker([string]$marker, [string]$message) {
  if ($source.IndexOf($marker, [StringComparison]::Ordinal) -lt 0) {
    throw $message
  }
}

Assert-Marker ':style="{ height: heroHeightStyle }"' 'hero carousel must use an adaptive height'
Assert-Marker 'mode="widthFix"' 'hero images must preserve their complete aspect ratio'
Assert-Marker 'function updateHeroHeight' 'hero height must be recalculated from the active image'
Assert-Marker 'uni.getImageInfo' 'hero image dimensions must be read before calculating the carousel height'
Assert-Marker '@change="handleHeroChange"' 'hero carousel must recalculate height when the slide changes'
Assert-Marker '.hero-image { width: 100%; height: auto; display: block; }' 'hero image must fill width without a fixed crop height'

if ($source -match '\.hero-swiper \{ width: 100%; height: 720rpx;') {
  throw 'hero carousel must not keep the old fixed 720rpx height'
}

Write-Output "homepage hero image contract: PASS"
