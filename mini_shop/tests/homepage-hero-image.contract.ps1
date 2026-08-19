$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$path = Join-Path $root "pages/index/index.vue"
$source = Get-Content -Raw -Encoding utf8 -LiteralPath $path

function Assert-Marker([string]$marker, [string]$message) {
  if ($source.IndexOf($marker, [StringComparison]::Ordinal) -lt 0) {
    throw $message
  }
}

Assert-Marker "const heroHeightStyle = '960rpx'" 'hero carousel must use the fixed 750x960 design ratio'
Assert-Marker ':style="{ height: heroHeightStyle }"' 'hero carousel must use the fixed height style'
Assert-Marker 'mode="widthFix"' 'hero images must preserve their complete aspect ratio'
Assert-Marker '.hero-image { width: 100%; height: auto; display: block; }' 'hero image must fill width without a fixed crop height'
Assert-Marker '.hero-swiper-item { width: 100%; overflow: hidden; }' 'hero slide must keep a stable layout box during transitions'

if ($source.Contains('uni.getImageInfo')) {
  throw 'hero carousel must not measure image dimensions at runtime'
}

Write-Output "homepage hero image contract: PASS"
