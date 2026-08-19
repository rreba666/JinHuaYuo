$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$path = Join-Path $root "subpkg-wallet/withdraw/withdraw.vue"
$asset = Join-Path $root "static/bg/钱包页背景.png"
$source = Get-Content -Raw -Encoding utf8 -LiteralPath $path

if (-not (Test-Path -LiteralPath $asset)) {
  throw 'wallet card background asset is missing'
}
if ($source.IndexOf('<image class="hero-card-bg" src="/static/bg/钱包页背景.png"', [StringComparison]::Ordinal) -lt 0) {
  throw 'wallet balance card must render the supplied background image'
}
if ($source -match '\.hero-card::after') {
  throw 'wallet balance card must not layer the old generated circle decoration'
}
if ($source -match 'background:[^;]*url\(') {
  throw 'wallet card background must not be loaded through WXSS'
}

Write-Output "wallet card background contract: PASS"
