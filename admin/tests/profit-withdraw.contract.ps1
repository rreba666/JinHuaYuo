$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

function Assert-Marker([string]$relativePath, [string[]]$markers) {
  $path = Join-Path $root $relativePath
  if (-not (Test-Path -LiteralPath $path)) { throw "file missing: $relativePath" }
  $source = Get-Content -Raw -Encoding utf8 -LiteralPath $path
  foreach ($marker in $markers) {
    if ($source.IndexOf($marker, [StringComparison]::Ordinal) -lt 0) { throw "marker missing in $relativePath`: $marker" }
  }
}

Assert-Marker 'src/types/product.ts' @('promotionEnabled', 'dividendEnabled', 'dividendFund')
Assert-Marker 'src/utils/productPricing.ts' @('0.2', '0.26', 'getDefaultDividendFund', 'resolveDividendFund')
Assert-Marker 'src/views/products/index.vue' @('form.promotionEnabled', 'form.dividendEnabled', 'form.dividendFund', '20%', '26%')
Assert-Marker 'src/api/profit.ts' @('/api/admin/profit/pending', '/api/admin/profit/pools', '/api/admin/profit/relations', '/api/admin/profit/relations/{buyerUserId}', 'rebindPromotionRelation', 'unbindPromotionRelation', '/api/admin/profit/pool/${poolId}/confirm', '/api/admin/profit/settle')
Assert-Marker 'src/api/withdraw.ts' @('/api/admin/withdraw/pending', '/api/admin/withdraw/approve/', '/api/admin/withdraw/reject/')
Assert-Marker 'src/views/profit/index.vue' @('pendingPromotion', 'sevenDayPools', 'dividendLimits', 'rebindPromotionRelation', 'unbindPromotionRelation', 'confirmPool', 'settlePool')
Assert-Marker 'src/views/withdraw/index.vue' @('pendingWithdrawals', 'stuckWithdrawals', 'approveWithdraw', 'rejectWithdraw', 'manualSuccess')
Assert-Marker 'src/router/index.ts' @("path: 'profit'", "path: 'withdraw'")
Assert-Marker 'src/layouts/AdminLayout.vue' @('index="/profit"', 'index="/withdraw"')

Write-Output "profit and withdraw contract: PASS"
