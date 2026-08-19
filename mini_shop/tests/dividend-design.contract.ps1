$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$pagePath = Join-Path $root "subpkg-wallet/dividend/dividend.vue"
$source = Get-Content -Raw -Encoding utf8 -LiteralPath $pagePath

function Assert-Marker([string]$marker) {
  if (-not $source.Contains($marker)) { throw "dividend design marker missing: $marker" }
}

foreach ($marker in @(
  'class="promotion-background"',
  'class="stat-icon-image"',
  'height: 176rpx',
  'width: 756rpx',
  'height: 136rpx',
  'width: 340rpx',
  'margin-top: 52rpx',
  'background: #f6f6f6'
)) {
  Assert-Marker $marker
}

$promotionAssets = @(Get-ChildItem -Recurse -File -Path (Join-Path $root "static/Promotion") -Filter *.png |
  Where-Object { $_.Name -notlike "*@2x.png" })
if ($promotionAssets.Count -lt 3) {
  throw "expected at least 3 Promotion assets, found $($promotionAssets.Count)"
}

$assetReferences = [regex]::Matches($source, '/static/Promotion/[^" ]+\.png')
if ($assetReferences.Count -lt 3) {
  throw "expected at least 3 Promotion asset references, found $($assetReferences.Count)"
}

if ($source.Contains('class="stat-icon" />')) {
  throw 'dividend page should not render placeholder statistic icons'
}

Write-Output "dividend design contract: PASS"
