$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$path = Join-Path $root "subpkg-wallet/withdraw/withdraw.vue"
$source = Get-Content -Raw -Encoding utf8 -LiteralPath $path

foreach ($marker in @(
  '<image class="back-button" src="/static/left_arrow.png" mode="aspectFit" @click="goBack" />',
  'background: #f5f6f8'
)) {
  if ($source.IndexOf($marker, [StringComparison]::Ordinal) -lt 0) {
    throw "wallet transfer header marker missing: $marker"
  }
}

if ($source.Contains('<view class="back-button" @click="goBack" />')) {
  throw 'wallet transfer header must not draw the old CSS-only back arrow'
}
if ($source -match '\.nav \{[^}]*background: #fff') {
  throw 'wallet transfer navigation must match the page background'
}

Write-Output "wallet transfer header contract: PASS"
