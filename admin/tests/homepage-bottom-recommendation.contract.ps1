$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$path = Join-Path $root "src/views/homepage/bottom-recommendation.vue"
$source = Get-Content -Raw -Encoding utf8 -LiteralPath $path
$mediaPath = Join-Path $root "src/api/homepage.ts"
$mediaSource = Get-Content -Raw -Encoding utf8 -LiteralPath $mediaPath

function T([int[]]$codes) {
  return -join ($codes | ForEach-Object { [char]$_ })
}

function Assert-Marker([string]$marker) {
  if ($source.IndexOf($marker, [StringComparison]::Ordinal) -lt 0) {
    throw "homepage bottom recommendation marker missing: $marker"
  }
}

Assert-Marker 'moreWelfareImage'
Assert-Marker 'followImage'
Assert-Marker 'moreWelfareAppId'
Assert-Marker ':max="1"'
Assert-Marker "bottomImageUrl: [form.moreWelfareImage[0] || '', form.followImage[0] || '']"
Assert-Marker "bottomLinkTarget: [moreWelfareAppId, '']"
Assert-Marker 'row.bottomLinkTarget?.[0]'
Assert-Marker (T 0x66F4,0x591A,0x798F,0x5229)
Assert-Marker (T 0x5173,0x6CE8,0x91D1,0x534E,0x6709)
Assert-Marker (T 0x8DF3,0x8F6C,0x5C0F,0x7A0B,0x5E8F)
Assert-Marker 'field-hint'

if ($mediaSource.IndexOf('resolveMediaSlots(item.bottomImageUrl, 2)', [StringComparison]::Ordinal) -lt 0) {
  throw 'homepage bottom images must preserve two fixed slots'
}
if ($mediaSource.IndexOf('resolveMediaArray(item.bottomImageUrl)', [StringComparison]::Ordinal) -ge 0) {
  throw 'homepage bottom images must not use the filtering media normalizer'
}

$variableTargetMarker = T 0x65B0,0x589E,0x76EE,0x6807
$maxImageMarker = T 0x6700,0x591A,0x4E0A,0x4F20,0x35,0x5F20,0x56FE,0x7247
foreach ($marker in @($variableTargetMarker, 'bottomLinkTarget[i]', $maxImageMarker, 'followAppId')) {
  if ($source.IndexOf($marker, [StringComparison]::Ordinal) -ge 0) {
    throw "variable bottom recommendation marker must be absent: $marker"
  }
}

Write-Output "homepage bottom recommendation contract: PASS"
