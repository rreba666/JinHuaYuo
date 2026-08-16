$ErrorActionPreference = "Stop"

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
  if (Test-Path -LiteralPath $path) { throw "unexpected file: $relativePath" }
}

function Assert-MarkerNotFound([string]$relativePath, [string[]]$markers) {
  $path = Join-Path $root $relativePath
  if (-not (Test-Path -LiteralPath $path)) { throw "file missing: $relativePath" }
  $source = Get-Content -Raw -Encoding utf8 -LiteralPath $path
  foreach ($marker in $markers) {
    if ($source.IndexOf($marker, [StringComparison]::Ordinal) -ge 0) {
      throw "unexpected marker in $relativePath`: $marker"
    }
  }
}

Assert-Marker 'src/api/shop.ts' @(
  '/api/admin/shop/list',
  '/api/admin/shop/all',
  '/api/admin/shop/',
  'deleteShop',
  'restoreShop',
  '/restore',
  '/status'
)
Assert-Marker 'src/api/staff.ts' @(
  '/api/admin/staff/list',
  '/api/admin/staff/',
  'deleteStaff',
  'restoreStaff',
  '/restore',
  '/reset-password'
)
Assert-Marker 'src/api/log.ts' @(
  '/api/admin/verify-log/list',
  '/api/admin/audit-log/list'
)
Assert-Marker 'src/api/order.ts' @(
  'pickupType',
  'statuses',
  '/address'
)
Assert-Marker 'src/api/user.ts' @(
  '/restore',
  'deleteUser'
)
Assert-Marker 'src/types/order.ts' @('pickupType', 'OrderAddressUpdateDTO')
Assert-Marker 'src/types/order.ts' @('statuses?: OrderStatus[]')
Assert-Marker 'src/stores/order.ts' @('statuses: [filters.status]')
Assert-Marker 'src/api/request.ts' @('paramsSerializer', 'indexes: null')
Assert-MarkerNotFound 'src/stores/order.ts' @('status: filters.status')
Assert-Marker 'src/types/shop.ts' @('Shop', 'ShopCreateDTO', 'delFlag')
Assert-Marker 'src/types/staff.ts' @('Staff', 'StaffCreateDTO', 'delFlag')
Assert-Marker 'src/types/log.ts' @('VerifyLog', 'AuditLog')
Assert-Marker 'src/api/category.ts' @('/api/admin/category/list', 'enabled')
Assert-Marker 'src/types/category.ts' @('AdminCategory', 'AdminCategorySaveDTO', 'enabled')
Assert-Marker 'src/types/invoice.ts' @('InvoiceStatus = 0 | 1 | 2 | 4', 'AdminInvoiceProcessDTO')
Assert-Marker 'src/api/invoice.ts' @('/api/admin/invoice/list', '/api/admin/invoice/detail/', '/confirm-red-flush', 'status === 2')
Assert-Marker 'src/api/dashboard.ts' @('/api/admin/order/sales-records', 'productName')
Assert-Marker 'src/types/dashboard.ts' @('SalesRecord', 'SalesRecordQueryParams')
Assert-Marker 'src/stores/dashboard.ts' @('fetchSalesRecords', 'productName')

$projectRoot = Split-Path -Parent $root
$envRoot = Join-Path $projectRoot 'mini_shop'
foreach ($envFile in @('.env', '.env.production')) {
  $envPath = Join-Path $envRoot $envFile
  if (-not (Test-Path -LiteralPath $envPath)) { throw "mini_shop env file missing: $envFile" }
  $envSource = Get-Content -Raw -Encoding utf8 -LiteralPath $envPath
  if ($envSource.IndexOf('VITE_API_BASE_URL', [StringComparison]::Ordinal) -lt 0) { throw "VITE_API_BASE_URL missing in $envFile" }
}
Assert-Marker 'vite.config.ts' @('envDir', '../mini_shop')
Assert-MarkerAbsent 'vite.config.js' @('defineConfig')

Write-Output "admin API contract: PASS"
