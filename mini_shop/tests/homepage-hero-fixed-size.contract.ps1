$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$path = Join-Path $root "pages/index/index.vue"
$source = Get-Content -Raw -Encoding utf8 -LiteralPath $path

function Assert-Marker([string]$marker, [string]$message) {
  if ($source.IndexOf($marker, [StringComparison]::Ordinal) -lt 0) {
    throw $message
  }
}

Assert-Marker "const heroHeightStyle = '960rpx'" 'hero height must use the fixed 750x960 design ratio'
Assert-Marker ':style="{ height: heroHeightStyle }"' 'hero media must use the fixed height style'
Assert-Marker '.hero-skeleton { width: 100%; min-height: 960rpx;' 'hero skeleton must reserve the fixed 960rpx height'

if ($source.Contains('@animationfinish="handleHeroAnimationFinish"')) {
  throw 'fixed-size hero must not resize after slide animation finishes'
}
if ($source.Contains('uni.getImageInfo')) {
  throw 'fixed-size hero must not measure remote image dimensions at runtime'
}

Write-Output "homepage hero fixed size contract: PASS (750x960)"
