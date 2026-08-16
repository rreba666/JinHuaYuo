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

Assert-Marker 'src/api/product.ts' @(
  'normalizeProductBinaryOrNull',
  'missingFundStatusIds',
  'getAdminProductDetail',
  'fundStatusByProductId'
)
Assert-Marker 'src/views/products/index.vue' @(
  'formatFundEnabled',
  'row.promotionEnabled == null',
  'row.dividendEnabled == null'
)

Write-Output "product fund status contract: PASS"
