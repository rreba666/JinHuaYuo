$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$pages = @(
  "pages/login/login.vue",
  "pages/index/index.vue",
  "pages/category/category.vue",
  "pages/cart/cart.vue",
  "pages/mine/mine.vue",
  "subpkg-wallet/withdraw/withdraw.vue",
  "subpkg-goods/detail/detail.vue",
  "subpkg-order/payment/payment.vue",
  "subpkg-order/invoice/list.vue",
  "subpkg-goods/search/index.vue"
)

foreach ($relativePath in $pages) {
  $path = Join-Path $root $relativePath
  if (-not (Test-Path -LiteralPath $path)) { throw "page file missing: $relativePath" }

  $source = Get-Content -Raw -Encoding utf8 -LiteralPath $path
  if (-not ($source -match '<style>')) { throw "page style must be unscoped: $relativePath" }
  if ($source -match '<style\s+scoped>') { throw "scoped page style is not supported: $relativePath" }
}

Write-Output "page style contract: PASS"
