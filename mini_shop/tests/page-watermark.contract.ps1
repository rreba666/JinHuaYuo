$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

function T([int[]]$codes) {
  return -join ($codes | ForEach-Object { [char]$_ })
}

function ReadSource([string]$relativePath) {
  $path = Join-Path $root $relativePath
  if (-not (Test-Path -LiteralPath $path)) { throw "source file missing: $relativePath" }
  return Get-Content -Raw -Encoding utf8 -LiteralPath $path
}

$component = ReadSource "components/PageWatermark.vue"
if (-not $component.Contains((T 0x4ECA,0x534E,0x6709,0x20,0x7C,0x20,0x6280,0x672F,0x652F,0x6301))) { throw "watermark copy missing" }
if (-not ($component -match "position:\s*relative")) { throw "watermark must stay in content flow" }
if ($component -match "position:\s*fixed") { throw "watermark must not be fixed" }

$included = @(
  "pages/category/category.vue",
  "pages/cart/cart.vue",
  "pages/mine/mine.vue",
  "pages/materials/materials.vue",
  "pages/settings/settings.vue"
)
foreach ($relativePath in $included) {
  $source = ReadSource $relativePath
  if (-not ($source -match "PageWatermark")) { throw "watermark missing from $relativePath" }
}

$excluded = @(
  "pages/index/index.vue",
  "subpkg-goods/detail/detail.vue",
  "pages/login/login.vue",
  "pages/promo/landing.vue",
  "subpkg-order/payment/payment.vue",
  "pages/settings/address/address.vue",
  "pages/settings/bank-card/bank-card.vue"
)
foreach ($relativePath in $excluded) {
  $source = ReadSource $relativePath
  if ($source -match "PageWatermark") { throw "watermark must not be added to $relativePath" }
}

$category = ReadSource "pages/category/category.vue"
if (-not ($category -match "watermark")) { throw "category must reserve watermark space" }

Write-Output "page watermark contract: PASS"
