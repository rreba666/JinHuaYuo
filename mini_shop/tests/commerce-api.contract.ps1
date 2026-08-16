$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

$apiFiles = @{
  order = Join-Path $root "api/order.ts"
  auth = Join-Path $root "api/auth.ts"
  payment = Join-Path $root "api/payment.ts"
  shop = Join-Path $root "api/shop.ts"
}

foreach ($entry in $apiFiles.GetEnumerator()) {
  if (-not (Test-Path -LiteralPath $entry.Value)) { throw "missing API file: $($entry.Key)" }
}

$orderSource = Get-Content -Raw -Encoding utf8 $apiFiles.order
foreach ($marker in @(
  '/api/order/create',
  '/api/order/list',
  '/api/order/detail/',
  '/api/order/cancel/',
  '/api/order/receive/',
  '/api/order/refund/',
  'createOrder',
  'getOrderList',
  'getOrderDetail'
)) {
  if (-not (Select-String -InputObject $orderSource -Pattern $marker -SimpleMatch)) { throw "order API marker missing: $marker" }
}
if (Select-String -InputObject $orderSource -Pattern 'promoterUserId' -SimpleMatch) { throw 'order API must not send deprecated promoterUserId' }

$authSource = Get-Content -Raw -Encoding utf8 $apiFiles.auth
foreach ($marker in @('/api/auth/login', 'loginByWechat', 'promoterId')) {
  if (-not (Select-String -InputObject $authSource -Pattern $marker -SimpleMatch)) { throw "auth API marker missing: $marker" }
}

$paymentSource = Get-Content -Raw -Encoding utf8 $apiFiles.payment
foreach ($marker in @('/api/pay/prepay', 'requestPayment', 'createPrepay')) {
  if (-not (Select-String -InputObject $paymentSource -Pattern $marker -SimpleMatch)) { throw "payment API marker missing: $marker" }
}

$shopSource = Get-Content -Raw -Encoding utf8 $apiFiles.shop
foreach ($marker in @('/api/shop/all', 'getEnabledShops')) {
  if (-not (Select-String -InputObject $shopSource -Pattern $marker -SimpleMatch)) { throw "shop API marker missing: $marker" }
}

$userSource = Get-Content -Raw -Encoding utf8 (Join-Path $root "api/user.ts")
foreach ($marker in @('/api/wallet/info', '/api/wallet/withdraw', 'getWalletInfo', 'withdrawWallet', 'pendingPromotion', 'pendingBonus', "type: WithdrawType")) {
  if (-not (Select-String -InputObject $userSource -Pattern $marker -SimpleMatch)) { throw "wallet API marker missing: $marker" }
}
if (-not (Select-String -InputObject $userSource -Pattern "type WithdrawType = 'PROMOTION' | 'BONUS'" -SimpleMatch)) { throw "wallet withdraw type missing" }
foreach ($marker in @('/api/wallet/withdrawals', 'getWithdrawals', 'WithdrawRecord', 'statusDesc', 'createdAt', 'finishedAt', 'failReason')) {
  if (-not (Select-String -InputObject $userSource -Pattern $marker -SimpleMatch)) { throw "withdrawal API marker missing: $marker" }
}

$promotionPath = Join-Path $root "api/promotion.ts"
if (-not (Test-Path -LiteralPath $promotionPath)) { throw "promotion API file missing" }
$promotionSource = Get-Content -Raw -Encoding utf8 $promotionPath
foreach ($marker in @('/api/promotion/summary', '/api/promotion/records', 'getPromotionSummary', 'getPromotionRecords', 'totalPromotion', 'boundUserCount', 'buyerName', 'payAmount', 'createTime', 'pageSize')) {
  if (-not (Select-String -InputObject $promotionSource -Pattern $marker -SimpleMatch)) { throw "promotion API marker missing: $marker" }
}
foreach ($marker in @('/api/promotion/code', 'getPromotionCode', '/api/promotion/bind', 'bindPromotion', 'promoterId')) {
  if (-not (Select-String -InputObject $promotionSource -Pattern $marker -SimpleMatch)) { throw "promotion attribution API marker missing: $marker" }
}

foreach ($source in @($orderSource, $productSource, $promotionSource)) {
  if (Select-String -InputObject $source -Pattern 'URLSearchParams' -SimpleMatch) { throw 'mini program API must not use URLSearchParams' }
}

$productSource = Get-Content -Raw -Encoding utf8 (Join-Path $root "api/product.ts")
foreach ($marker in @('/api/product/detail/', 'getProductDetail', 'detailImages', 'promotionEnabled', 'dividendEnabled')) {
  if (-not (Select-String -InputObject $productSource -Pattern $marker -SimpleMatch)) { throw "product detail API marker missing: $marker" }
}
foreach ($marker in @('/api/product/list', 'getProductList', 'keyword', 'sortBy', 'minPrice')) {
  if (-not (Select-String -InputObject $productSource -Pattern $marker -SimpleMatch)) { throw "product list API marker missing: $marker" }
}

$invoiceSource = Get-Content -Raw -Encoding utf8 (Join-Path $root "api/invoice.ts")
foreach ($marker in @('/api/invoice/submit', '/api/invoice/list', '/api/invoice/detail/', 'submitInvoice', 'getInvoiceList', 'getInvoiceDetail', 'InvoiceStatus = 0 | 1 | 2 | 4')) {
  if (-not (Select-String -InputObject $invoiceSource -Pattern $marker -SimpleMatch)) { throw "invoice API marker missing: $marker" }
}

Write-Output "commerce API contract: PASS"
