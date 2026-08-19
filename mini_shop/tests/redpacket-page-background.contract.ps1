$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$path = Join-Path $root "subpkg-wallet/redpacket/redpacket.vue"
$source = Get-Content -Raw -Encoding utf8 -LiteralPath $path

if ($source.IndexOf('<image class="packet-bg" src="/static/bg/红包页背景.jpg"', [StringComparison]::Ordinal) -lt 0) {
  throw 'red packet page must use the updated background asset'
}
if ($source.IndexOf('width: 720rpx; max-width: calc(100% - 32rpx); height: 340rpx;', [StringComparison]::Ordinal) -lt 0) {
  throw 'red packet page background box must keep the 720x340 design size'
}

Write-Output "red packet page background contract: PASS"
