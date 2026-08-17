$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$path = Join-Path $root "pages/index/index.vue"
$apiPath = Join-Path $root "api/homepage.ts"
$source = Get-Content -Raw -Encoding utf8 -LiteralPath $path
$api = Get-Content -Raw -Encoding utf8 -LiteralPath $apiPath

function Assert-Marker([string]$content, [string]$marker, [string]$message) {
  if ($content.IndexOf($marker, [StringComparison]::Ordinal) -lt 0) {
    throw $message
  }
}

Assert-Marker $source 'isRecommendTextEnabled(item.recommendTextEnabled)' 'homepage product text must be controlled by the recommendation text status'
Assert-Marker $source 'function isRecommendTextEnabled' 'homepage must normalize the recommendation text status'
Assert-Marker $source '<view v-if="isRecommendTextEnabled(item.recommendTextEnabled)" class="card-text">' 'homepage recommendation text switch must control the complete card text block'
Assert-Marker $api 'recommendTextEnabled?:' 'homepage product API model must expose the recommendation text status'

Write-Output "homepage recommendation text contract: PASS"
