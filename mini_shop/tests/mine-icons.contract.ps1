$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$minePath = Join-Path $root "pages/mine/mine.vue"
$source = Get-Content -Raw -Encoding utf8 -LiteralPath $minePath

function Assert-Marker([string]$marker) {
  if (-not $source.Contains($marker)) { throw "mine icon marker missing: $marker" }
}

foreach ($marker in @(
  "icon: '/static/my/",
  'v-if="entry.icon"',
  'v-if="item.icon"',
  'order-icon-image',
  'menu-icon-image',
  '/static/my/vip',
  'vip-avatar-badge',
  'member-card-background',
  "{ key: 'pickup'",
  "pickupType: 1",
  'all-arrow',
  'benefits-arrow',
  'benefits-arrow-white',
  ('color: ' + [char]35 + 'FFFFFF'),
  'height: 304rpx',
  'margin: -196rpx',
  'height: 196rpx',
  'width: 252rpx',
  'if (index === 0)',
  'income-item:nth-child(1) .income-label { left: 86rpx; width: 110rpx; text-align: center; }'
)) {
  Assert-Marker $marker
}

$iconDeclarationCount = ([regex]::Matches($source, "icon: '/static/my/")).Count
if ($iconDeclarationCount -lt 11) {
  throw "expected at least 11 mapped icon assets, found $iconDeclarationCount"
}

$assetCount = @(Get-ChildItem -Recurse -File -Path (Join-Path $root "static/my") -Filter *.png | Where-Object { $_.Name -notlike "*@2x.png" }).Count
if ($assetCount -lt 15) {
  throw "expected local my-page assets, found $assetCount"
}

$quotedAssetCount = ([regex]::Matches($source, 'src="/static/my/[^" ]+\.png"')).Count
if ($quotedAssetCount -lt 4) {
  throw "expected invoice and arrow asset references, found $quotedAssetCount"
}
if ($source.Contains('wallet-entry')) {
  throw 'mine page should not render the standalone wallet entry panel'
}

$vipPaths = [regex]::Matches($source, '"/static/my/vip[^"]+\.png"') | ForEach-Object { $_.Value.Trim('"') } | Select-Object -Unique
if ($vipPaths.Count -lt 2) {
  throw "expected vip background and avatar assets, found $($vipPaths.Count)"
}
foreach ($path in $vipPaths) {
  if (-not (Test-Path -LiteralPath (Join-Path $root ("." + $path)))) { throw "vip asset missing: $path" }
}

Write-Output "mine icons contract: PASS"
