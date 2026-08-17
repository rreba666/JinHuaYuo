$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$path = Join-Path $root "pages/index/index.vue"
$source = Get-Content -Raw -Encoding utf8 -LiteralPath $path
$apiPath = Join-Path $root "api/homepage.ts"
$apiSource = Get-Content -Raw -Encoding utf8 -LiteralPath $apiPath

function Assert-Marker([string]$marker) {
  if ($source.IndexOf($marker, [StringComparison]::Ordinal) -lt 0) {
    throw "homepage bottom navigation marker missing: $marker"
  }
}

function T([int[]]$codes) {
  return -join ($codes | ForEach-Object { [char]$_ })
}

Assert-Marker 'handleWelfareImageTap'
Assert-Marker 'bottomLinkTarget?.[0]'
Assert-Marker 'uni.navigateToMiniProgram'
Assert-Marker 'appId'
Assert-Marker (T 0x6682,0x672A,0x914D,0x7F6E,0x8DF3,0x8F6C,0x5C0F,0x7A0B,0x5E8F)
Assert-Marker '@click="handleWelfareImageTap(welfareTab)"'
Assert-Marker 'welfareTab === 0'
Assert-Marker 'if (index !== 0) return'

if ($apiSource.IndexOf('normalizeBottomRecommendationSlots', [StringComparison]::Ordinal) -lt 0) {
  throw 'homepage bottom images must be normalized into fixed slots'
}
if ($apiSource.IndexOf('bottomImageUrl: normalizeBottomRecommendationSlots', [StringComparison]::Ordinal) -lt 0) {
  throw 'homepage bottom image response must use fixed-slot normalization'
}

Write-Output "homepage bottom recommendation contract: PASS"
