$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$cartPath = Join-Path $root "pages/cart/cart.vue"
$pagesPath = Join-Path $root "pages.json"
$paymentPath = Join-Path $root "pages/payment/payment.vue"

if (-not (Test-Path -LiteralPath $paymentPath)) { throw "payment page file missing" }
if (-not (Select-String -LiteralPath $cartPath -Pattern "pages/payment/payment" -SimpleMatch)) { throw "cart entry missing" }
if (-not (Select-String -LiteralPath $cartPath -Pattern "cartIds" -SimpleMatch)) { throw "cartIds missing" }
if (-not (Select-String -LiteralPath $pagesPath -Pattern "pages/payment/payment" -SimpleMatch)) { throw "route missing" }
foreach ($marker in @("pickupType", "invoiceType", "pay-now", "safe-area-inset-bottom", "back-button", "backToCart", "navigateBack", "switchTab")) {
  if (-not (Select-String -LiteralPath $paymentPath -Pattern $marker -SimpleMatch)) { throw "payment marker missing: $marker" }
}
foreach ($marker in @(
  'v-show="pickupType === 0"',
  'v-show="pickupType === 1"',
  'v-show="invoiceExpanded"',
  'v-if="invoiceDrawerVisible"',
  '@tap="closeInvoiceDrawer"',
  '@tap.stop'
)) {
  if (-not (Select-String -LiteralPath $paymentPath -Pattern $marker -SimpleMatch)) { throw "interaction marker missing: $marker" }
}
if (-not (Select-String -LiteralPath $paymentPath -Pattern '@click="backToCart"' -SimpleMatch)) { throw "back button click handler missing" }
Write-Output "payment page contract: PASS"
