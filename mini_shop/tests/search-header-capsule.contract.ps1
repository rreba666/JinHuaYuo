$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$path = Join-Path $root "subpkg-goods/search/index.vue"
$source = Get-Content -Raw -Encoding utf8 -LiteralPath $path

function Assert-Marker([string]$marker, [string]$message) {
  if ($source.IndexOf($marker, [StringComparison]::Ordinal) -lt 0) {
    throw $message
  }
}

Assert-Marker 'const navStyle = computed' 'search header must derive its layout from capsule metrics'
Assert-Marker 'uni.getMenuButtonBoundingClientRect' 'search page must read the WeChat capsule position'
Assert-Marker ':style="navStyle"' 'search header must apply the capsule-aligned layout'
Assert-Marker 'paddingRight' 'search header must reserve space for the capsule on the right'
Assert-Marker 'onMounted' 'search page must initialize capsule metrics when mounted'

if ($source -match '\.nav \{[^}]*height: 104rpx') {
  throw 'search header must not use the old fixed height'
}

Write-Output "search header capsule contract: PASS"
