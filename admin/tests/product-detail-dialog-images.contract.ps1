$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$products = Get-Content -Raw -Encoding utf8 -LiteralPath (Join-Path $root "src/views/products/index.vue")

function Assert-Marker([string]$source, [string]$marker, [string]$message) {
  if ($source.IndexOf($marker, [StringComparison]::Ordinal) -lt 0) {
    throw $message
  }
}

Assert-Marker $products '.detail-images { display: flex; flex-direction: column; gap: 12px; width: 100%; }' 'detail image container must span the available dialog width'
Assert-Marker $products '.detail-image { display: block; width: 100%; height: auto; max-height: none; }' 'detail images must scale proportionally without a fixed height limit'
Assert-Marker $products '.detail-image :deep(.el-image__inner) {' 'detail image inner element must be constrained explicitly'
Assert-Marker $products 'object-fit: contain;' 'detail image inner element must preserve the complete image'

$detailImageStyle = [regex]::Match($products, '(?s)\.detail-image \{.*?\}')
if (-not $detailImageStyle.Success) {
  throw 'detail image style block is missing'
}
if ($detailImageStyle.Value -match 'max-height:\s*480px') {
  throw 'detail images must not use the old fixed max-height'
}

Write-Output "product detail dialog images contract: PASS"
