$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot

function Assert-Marker([string]$relativePath, [string[]]$markers) {
  $path = Join-Path $root $relativePath
  if (-not (Test-Path -LiteralPath $path)) { throw "file missing: $relativePath" }

  $source = Get-Content -Raw -Encoding utf8 -LiteralPath $path
  foreach ($marker in $markers) {
    if ($source.IndexOf($marker, [StringComparison]::Ordinal) -lt 0) {
      throw "marker missing in $relativePath`: $marker"
    }
  }
}

function Assert-MarkerAbsent([string]$relativePath, [string[]]$markers) {
  $path = Join-Path $root $relativePath
  if (-not (Test-Path -LiteralPath $path)) { throw "file missing: $relativePath" }

  $source = Get-Content -Raw -Encoding utf8 -LiteralPath $path
  foreach ($marker in $markers) {
    if ($source.IndexOf($marker, [StringComparison]::Ordinal) -ge 0) {
      throw "unexpected marker in $relativePath`: $marker"
    }
  }
}

Assert-Marker 'src/api/profit.ts' @(
  '/api/admin/profit/relations',
  '/api/admin/profit/relations/{buyerUserId}',
  'rebindPromotionRelation',
  'unbindPromotionRelation'
)
Assert-MarkerAbsent 'src/api/profit.ts' @(
  '/api/admin/profit/confirm',
  '/api/admin/profit/reject/',
  '/api/admin/profit/pool/${poolId}/execute'
)
Assert-Marker 'src/types/profit.ts' @(
  'PromotionBinding', 'buyerName', 'promoterName',
  "'SCAN' | 'MANUAL' | 'UNKNOWN'"
)
$promotionRelation = ([char[]](0x63A8, 0x5E7F, 0x5173, 0x7CFB) -join '')
$rebindLabel = ([char[]](0x91CD, 0x65B0, 0x7ED1, 0x5B9A) -join '')
$unbindLabel = ([char[]](0x89E3, 0x9664, 0x7ED1, 0x5B9A) -join '')
$historyNotice = ([char[]](0x4EC5, 0x5F71, 0x54CD, 0x540E, 0x7EED, 0x8BA2, 0x5355, 0xFF0C, 0x5386, 0x53F2, 0x8D26, 0x52A1, 0x4E0D, 0x56DE, 0x6EDA) -join '')
Assert-Marker 'src/views/profit/index.vue' @(
  $promotionRelation, 'relationKeyword', 'relationSource',
  $rebindLabel, $unbindLabel, $historyNotice
)
Assert-Marker 'src/api/setting.ts' @(
  '/api/admin/setting/customer-service',
  '/api/admin/setting/dividend-cap',
  '/api/admin/setting/profit-rates',
  'getProfitRatesConfig',
  'saveProfitRatesConfig'
)
Assert-MarkerAbsent 'src/api/setting.ts' @(
  '/api/admin/setting/promotion-rate',
  '/api/admin/setting/dividend-rate',
  'getPromotionRateConfig',
  'savePromotionRateConfig',
  'getDividendRateConfig',
  'saveDividendRateConfig'
)
$customerServiceLabel = ([char[]](0x5BA2, 0x670D, 0x7535, 0x8BDD) -join '')
$dividendCapLabel = ([char[]](0x5206, 0x7EA2, 0x4E0A, 0x9650, 0x500D, 0x7387) -join '')
$historyNoticeSetting = ([char[]](0x4EC5, 0x5F71, 0x54CD, 0x4E4B, 0x540E, 0x65B0, 0x5F00, 0x7684, 0x69FD, 0x4F4D) -join '')
$settingsLabel = ([char[]](0x7CFB, 0x7EDF, 0x8BBE, 0x7F6E) -join '')
$fundSectionLabel = ([char[]](0x5546, 0x54C1, 0x8D44, 0x91D1, 0x9ED8, 0x8BA4, 0x6BD4, 0x4F8B) -join '')
$promotionRateLabel = ([char[]](0x63A8, 0x5E7F, 0x8D44, 0x91D1, 0x6BD4, 0x4F8B) -join '')
$dividendRateLabel = ([char[]](0x5206, 0x7EA2, 0x5956, 0x6C60, 0x6BD4, 0x4F8B) -join '')
Assert-Marker 'src/views/settings/index.vue' @(
  $customerServiceLabel, $dividendCapLabel, $fundSectionLabel, ':min="0.01"', ':max="100"',
  $historyNoticeSetting, $promotionRateLabel, $dividendRateLabel,
  'profitRatesForm', 'saveProfitRates', 'toDisplayFundRate', 'fromDisplayFundRate'
)
Assert-Marker 'src/types/setting.ts' @(
  'ProfitRatesConfig',
  'ProfitRatesSaveDTO',
  'promotionRate: number',
  'bonusPoolRate: number'
)
Assert-Marker 'src/stores/setting.ts' @(
  'profitRates',
  'loadProfitRates',
  'saveProfitRatesConfig',
  'setFundRates'
)
Assert-MarkerAbsent 'src/stores/setting.ts' @(
  'loadPromotionRate',
  'loadDividendRate'
)
Assert-Marker 'src/router/index.ts' @("path: 'settings'", 'roles: SUPER_ADMIN')
Assert-Marker 'src/layouts/AdminLayout.vue' @('index="/settings"', $settingsLabel)
Assert-Marker 'src/api/admin.ts' @('/api/admin/role/me', 'deleteAdmin', 'restoreAdmin')
Assert-Marker 'src/api/order.ts' @('/refund', '/api/admin/order/trace/')
Assert-Marker 'src/types/order.ts' @('OrderRefundDTO', 'ExpressTrace', 'TraceItem', 'reason?: string | null', 'stateDesc', 'isCheck: 0 | 1')
Assert-Marker 'src/api/order.ts' @('refundOrder', 'getOrderTrace', 'request.post', 'request.get')
Assert-Marker 'src/api/order.ts' @('/api/admin/order/${orderId}/refund', '/api/admin/order/trace/${orderId}')
$walletLabel = ([char[]](0x94B1, 0x5305, 0x7BA1, 0x7406) -join '')
$transferLabel = ([char[]](0x4F59, 0x989D, 0x8F6C, 0x8D26, 0x8BB0, 0x5F55) -join '')
$setBalanceLabel = ([char[]](0x8BBE, 0x7F6E, 0x4F59, 0x989D) -join '')
$refreshLabel = ([char[]](0x5237, 0x65B0) -join '')
Assert-Marker 'src/api/wallet.ts' @(
  '/api/admin/wallet/list',
  '/api/admin/wallet/${walletId}',
  '/api/admin/wallet/${userId}',
  'getWalletList',
  'saveWalletBalance',
  'deleteWallet'
)
Assert-Marker 'src/stores/wallet.ts' @(
  'fetchList',
  'updateBalance',
  'removeWallet'
)
Assert-Marker 'src/types/wallet.ts' @(
  'WalletRecord',
  'balance',
  'WalletBalanceSaveDTO'
)
Assert-Marker 'src/views/wallet/index.vue' @(
  $walletLabel,
  'balanceVisible',
  'balanceTitle',
  'updateBalance',
  'removeWallet',
  'balance',
  $setBalanceLabel
)
Assert-Marker 'src/router/index.ts' @("path: 'wallets'", "name: 'Wallets'")
Assert-Marker 'src/layouts/AdminLayout.vue' @('index="/wallets"', $walletLabel)
Assert-Marker 'src/utils/permission.ts' @("'/wallets': '$walletLabel'")
Assert-Marker 'src/api/transfer.ts' @(
  '/api/admin/transfer/list',
  'getTransferList',
  'transferNo',
  'fromNickname',
  'toNickname'
)
Assert-Marker 'src/stores/transfer.ts' @(
  'list',
  'fetchList'
)
Assert-Marker 'src/views/transfers/index.vue' @(
  $transferLabel,
  'transferNo',
  'fromNickname',
  'toNickname',
  $refreshLabel
)
Assert-Marker 'src/router/index.ts' @("path: 'transfers'", "name: 'Transfers'")
Assert-Marker 'src/layouts/AdminLayout.vue' @('index="/transfers"', $transferLabel)
Assert-Marker 'src/utils/permission.ts' @("'/transfers': '$transferLabel'")
$manualRefundLabel = ([char[]](0x5BA2, 0x670D, 0x4EBA, 0x5DE5, 0x9000, 0x6B3E) -join '')
$asyncWechatLabel = ([char[]](0x5FAE, 0x4FE1, 0x5F02, 0x6B65, 0x5230, 0x8D26) -join '')
$traceLabel = ([char[]](0x7269, 0x6D41, 0x8F68, 0x8FF9) -join '')
Assert-Marker 'src/views/orders/index.vue' @($manualRefundLabel, $asyncWechatLabel, $traceLabel, 'stateDesc')

Write-Output 'OpenAPI alignment contract: PASS'
