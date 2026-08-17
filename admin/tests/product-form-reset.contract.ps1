$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$path = Join-Path $root "src/views/products/index.vue"
$source = Get-Content -Raw -Encoding utf8 -LiteralPath $path

if ($source.IndexOf('fillForm(product ? store.detail || undefined : undefined)', [StringComparison]::Ordinal) -lt 0) {
  throw 'new product form must not reuse the previous product detail'
}

if ($source.IndexOf('fillForm(store.detail || undefined)', [StringComparison]::Ordinal) -ge 0) {
  throw 'product form still uses stale store.detail for new products'
}

Write-Output "product form reset contract: PASS"
