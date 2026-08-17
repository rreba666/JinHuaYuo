$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$path = Join-Path $root "pages/index/index.vue"
$source = Get-Content -Raw -Encoding utf8 -LiteralPath $path

foreach ($marker in @('white-space: nowrap', 'overflow: hidden', 'text-overflow: ellipsis', 'width: 100%', 'box-sizing: border-box')) {
  if ($source.IndexOf($marker, [StringComparison]::Ordinal) -lt 0) {
    throw "homepage brand title marker missing: $marker"
  }
}

if ($source.IndexOf('margin: 48rpx 110rpx 0 144rpx', [StringComparison]::Ordinal) -ge 0) {
  throw 'homepage brand title must not reserve excessive asymmetric margins'
}

Write-Output "homepage brand title contract: PASS"
