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

function T([int[]]$codes) {
  return -join ($codes | ForEach-Object { [char]$_ })
}

$promotionGateMessage = T 0x5B8C,0x6210,0x8BA2,0x5355,0x540E,0x5F00,0x653E,0x63A8,0x5E7F,0x529F,0x80FD

Assert-Marker 'api/user.ts' @('identity', "0 | 1 | '0' | '1'", 'getUserProfile')
Assert-Marker 'utils/auth.ts' @('isRegisteredUser', 'Number(identity) === 1')
Assert-Marker 'pages/mine/mine.vue' @('getUserProfile', 'isRegisteredUser', 'registeredUser', 'v-if="registeredUser"', 'wallet-entry', 'income-strip')
Assert-Marker 'pages/dividend/dividend.vue' @('getUserProfile', 'isRegisteredUser', 'registeredUser', $promotionGateMessage, '/pages/mine/mine')
Assert-Marker 'pages/wallet/withdraw.vue' @('getUserProfile', 'isRegisteredUser', 'registeredUser', $promotionGateMessage, '/pages/mine/mine')
Assert-Marker 'pages/product/detail.vue' @('getUserProfile', 'isRegisteredUser', 'promotionVisible')

Write-Output "user identity contract: PASS"
