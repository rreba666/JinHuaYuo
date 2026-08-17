$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$path = Join-Path $root "src/views/products/index.vue"
$typesPath = Join-Path $root "src/types/product.ts"
$source = Get-Content -Raw -Encoding utf8 -LiteralPath $path
$types = Get-Content -Raw -Encoding utf8 -LiteralPath $typesPath

function Assert-Marker([string]$content, [string]$marker, [string]$message) {
  if ($content.IndexOf($marker, [StringComparison]::Ordinal) -lt 0) {
    throw $message
  }
}

Assert-Marker $source 'recommendTextEnabled: 0' 'new product form must default recommendation text to disabled'
Assert-Marker $source 'recommendTextEnabled: status === 1 && normalizeBinary(detail.isRecommended) === 1 ? normalizeBinary(detail.recommendTextEnabled) : 0' 'editing form must load the recommendation text switch'
Assert-Marker $source 'form.recommendTextEnabled = 0' 'recommendation text must be cleared when homepage recommendation is disabled'
Assert-Marker $source 'recommendTextEnabled: normalizeBinary(form.status) === 1 && normalizeBinary(form.isRecommended) === 1 ? normalizeBinary(form.recommendTextEnabled) : 0' 'save payload must gate recommendation text by homepage recommendation'
Assert-Marker $source 'v-model="form.recommendTextEnabled"' 'product form must expose a recommendation text switch'
Assert-Marker $source ':disabled="normalizeBinary(form.status) === 0 || normalizeBinary(form.isRecommended) === 0"' 'recommendation text switch must be disabled when homepage recommendation is off'
Assert-Marker $types 'recommendTextEnabled: ProductStatusValue' 'product models must include the recommendation text status'

Write-Output "product recommendation text contract: PASS"
