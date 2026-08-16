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

function Assert-MarkerAbsent([string]$relativePath, [string[]]$markers) {
  $path = Join-Path $root $relativePath
  if (-not (Test-Path -LiteralPath $path)) { throw "file missing: $relativePath" }
  $source = Get-Content -Raw -Encoding utf8 -LiteralPath $path
  foreach ($marker in $markers) {
    if ($source.IndexOf($marker, [StringComparison]::Ordinal) -ge 0) { throw "unexpected marker in $relativePath`: $marker" }
  }
}

Assert-Marker 'src/stores/order.ts' @('pickupType: filters.pickupType', 'updateAddress')
Assert-Marker 'src/stores/order.ts' @('refunding', 'traceLoading', 'trace', 'refund(', 'fetchTrace(')
Assert-Marker 'src/views/orders/index.vue' @('store.filters.pickupType = isPickupOrder.value ? 1 : 0', 'addressVisible', 'submitAddress')
Assert-Marker 'src/views/orders/index.vue' @('pickup-order-actions', 'restoreSelected', 'removeSelected', "type: 'warning'", 'confirmButtonText', 'cancelButtonText')
Assert-Marker 'src/views/orders/index.vue' @('operator-actions', 'View', 'CircleCheck', 'Delete', 'RefreshLeft', 'size="small"')
$manualRefundLabel = ([char[]](0x5BA2, 0x670D, 0x4EBA, 0x5DE5, 0x9000, 0x6B3E) -join '')
$asyncWechatLabel = ([char[]](0x5FAE, 0x4FE1, 0x5F02, 0x6B65, 0x5230, 0x8D26) -join '')
$traceLabel = ([char[]](0x7269, 0x6D41, 0x8F68, 0x8FF9) -join '')
Assert-Marker 'src/views/orders/index.vue' @($manualRefundLabel, $asyncWechatLabel, $traceLabel, 'maxlength="200"', 'el-empty')
Assert-Marker 'src/views/orders/index.vue' @('isTraceable', 'order.status >= 2', ':disabled="!isTraceable(store.detail) || store.traceLoading"', 'v-if="isTraceable(store.detail)"')
Assert-MarkerAbsent 'src/views/orders/index.vue' @('order.status !== 1')
$traceNodeEmpty = ([char[]](0x6682, 0x65E0, 0x7269, 0x6D41, 0x8282, 0x70B9) -join '')
Assert-Marker 'src/views/orders/index.vue' @('v-else-if="store.trace"', 'store.trace && !store.trace.traces.length', $traceNodeEmpty)
Assert-Marker 'src/views/users/index.vue' @('delFlag', 'removeSelected', 'restoreUser')
Assert-Marker 'src/views/users/index.vue' @('user-status-tabs', 'statusTab', 'type="success"', 'type="info"', 'type="danger"')
Assert-Marker 'src/views/categories/index.vue' @('row.enabled', 'category.enabled', 'form.enabled', 'category-status-button', 'category-status-label', 'CircleCheck', 'CircleClose')
Assert-MarkerAbsent 'src/views/categories/index.vue' @('row.status', 'category.status', 'form.status')
Assert-Marker 'src/api/category.ts' @('raw.enabled')
Assert-Marker 'src/types/category.ts' @('enabled: CategoryStatus')
Assert-Marker 'src/views/products/index.vue' @('getMinSkuPrice', 'getDefaultPromotionFund', 'getDefaultDividendFund', 'form.promotionFund = getDefaultPromotionFundForSku()', 'form.dividendFund = getDefaultDividendFundForSku()')
Assert-Marker 'src/views/products/index.vue' @('form.promotionFund === previousDefaultPromotionFund.value', '@change="markPromotionFundTouched"')
Assert-Marker 'src/views/products/index.vue' @('skuList.map((sku) => sku.price)', 'getDefaultDividendFundForSku')
Assert-Marker 'src/views/products/index.vue' @('promotionEnabled: normalizeBinary(form.promotionEnabled)', 'dividendEnabled: normalizeBinary(form.dividendEnabled)')
Assert-Marker 'src/api/product.ts' @('normalizeProductBinary', 'promotionEnabled: normalizeProductBinary', 'dividendEnabled: normalizeProductBinary')
Assert-MarkerAbsent 'src/views/products/index.vue' @('v-model="row.specs"')
Assert-Marker 'src/stores/shop.ts' @('runBatch', 'removeBatch', 'restoreBatch')
Assert-Marker 'src/stores/staff.ts' @('runBatch', 'removeBatch', 'restoreBatch')
Assert-Marker 'src/views/shops/index.vue' @('delFlag', 'removeSelected', 'restoreSelected', 'Delete', 'RefreshLeft', ':disabled="!deletableSelected.length || store.actionLoading"', ':disabled="!restorableSelected.length || store.actionLoading"')
Assert-MarkerAbsent 'src/views/shops/index.vue' @('v-if="deletableSelected.length"', 'v-if="restorableSelected.length"')
Assert-Marker 'src/views/staff/index.vue' @('delFlag', 'removeSelected', 'restoreSelected', 'Delete', 'RefreshLeft', ':disabled="!deletableSelected.length || store.actionLoading"', ':disabled="!restorableSelected.length || store.actionLoading"')
Assert-MarkerAbsent 'src/views/staff/index.vue' @('v-if="deletableSelected.length"', 'v-if="restorableSelected.length"')
Assert-Marker 'src/views/invoices/index.vue' @("keyword", "filteredList", "invoice-status-tabs", "statusTab", "handleStatusTabChange", "confirmRedFlush", "ElMessageBox.confirm", "status === 2")
Assert-Marker 'src/api/product.ts' @('resolvePromotionFund', 'promotionFund: resolvePromotionFund')
Assert-Marker 'src/utils/productPricing.ts' @('getDefaultPromotionFund', 'minPrice', '0.2', 'getDefaultDividendFund', '0.26')
Assert-MarkerAbsent 'src/views/dashboard/index.vue' @('sortField', 'sortOrder', 'table-sort-field', 'table-sort-order')
Assert-MarkerAbsent 'src/stores/dashboard.ts' @('DashboardSortField', 'DashboardSortOrder', 'sortSalesRecords', 'getTableSalesRecords', 'sortField', 'sortOrder', 'setSortField', 'setSortOrder')
Assert-MarkerAbsent 'src/utils/dashboardAnalytics.ts' @('DashboardSortField', 'DashboardSortOrder', 'sortSalesRecords', 'getTableSalesRecords')
Assert-MarkerAbsent 'src/types/dashboard.ts' @('DashboardSortField', 'DashboardSortOrder')
Assert-Marker 'src/views/dashboard/index.vue' @('fetchSalesRecords', 'productName', 'DataTable')
foreach ($relativePath in @(
  'src/views/users/index.vue',
  'src/views/products/index.vue',
  'src/views/categories/index.vue',
  'src/views/homepage/index.vue',
  'src/views/homepage/hero.vue',
  'src/views/homepage/bottom-recommendation.vue',
  'src/views/shops/index.vue',
  'src/views/staff/index.vue'
)) {
  Assert-Marker $relativePath @('operator-actions', 'size=')
}
Assert-Marker 'src/router/index.ts' @('path:', 'dashboard', 'Dashboard', 'orders/pickup', 'shops', 'staff', 'logs/verify', 'logs/audit')
Assert-Marker 'src/layouts/AdminLayout.vue' @('/orders', '/orders/pickup', '/shops', '/staff', '/logs/verify', '/logs/audit')
Assert-Marker 'src/layouts/AdminLayout.vue' @('/dashboard', 'DataBoard')
Assert-Marker 'src/style.css' @('admin-menu', 'padding-left:', 'width:', 'scrollbar-gutter:')

Assert-Marker 'src/types/admin.ts' @('delFlag: AdminDeleteFlag')
Assert-Marker 'src/api/admin.ts' @('/api/admin/role/me', 'deleteAdmin', 'restoreAdmin')
$deleteAdminLabel = ([char[]](0x5220, 0x9664, 0x7BA1, 0x7406, 0x5458) -join '')
$restoreAdminLabel = ([char[]](0x6062, 0x590D, 0x7BA1, 0x7406, 0x5458) -join '')
Assert-Marker 'src/views/admin/index.vue' @($deleteAdminLabel, $restoreAdminLabel, 'row.delFlag')
Assert-Marker 'src/layouts/AdminLayout.vue' @('refreshCurrentAdmin')
Assert-Marker 'src/api/request.ts' @('skipAuthRedirect', 'error.config?.skipAuthRedirect')
Assert-Marker 'src/api/admin.ts' @('skipAuthRedirect: true')
Assert-Marker 'src/stores/auth.ts' @('const requestToken = token.value', 'token.value !== requestToken', 'if (!admin.id.trim())')
Assert-Marker 'src/views/admin/index.vue' @('v-else size="small" type="success" plain :disabled="store.actionLoading"')

Write-Output "admin management contract: PASS"
