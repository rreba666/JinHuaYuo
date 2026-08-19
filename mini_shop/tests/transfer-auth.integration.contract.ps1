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

$unsupportedPayoutLabel = T 0x94F6,0x884C,0x5361,0x63D0,0x73B0

$envSource = Get-Content -Raw -Encoding utf8 -LiteralPath (Join-Path $root '.env')
$envAppId = (($envSource -split '\r?\n' | Where-Object { $_ -like 'VITE_MERCHANT_TRANSFER_APP_ID=*' }) -replace '^VITE_MERCHANT_TRANSFER_APP_ID=', '').Trim()
$projectConfig = Get-Content -Raw -Encoding utf8 -LiteralPath (Join-Path $root 'project.config.json') | ConvertFrom-Json
if ($projectConfig.appid -ne $envAppId) {
  throw "mini program appid mismatch: project=$($projectConfig.appid), env=$envAppId"
}
$manifestSource = Get-Content -Raw -Encoding utf8 -LiteralPath (Join-Path $root 'manifest.json')
$manifestMatch = [regex]::Match($manifestSource, '(?s)"mp-weixin"\s*:\s*\{.*?"appid"\s*:\s*"(?<appid>wx[^"]+)"')
if (-not $manifestMatch.Success -or $manifestMatch.Groups['appid'].Value -ne $envAppId) {
  throw "manifest mp-weixin appid mismatch: manifest=$($manifestMatch.Groups['appid'].Value), env=$envAppId"
}

Assert-Marker 'subpkg-wallet/withdraw/withdraw.vue' @(
  'errMsg',
  'getSystemInfoSync',
  '3.7.9',
  'packageInfo === null',
  'authStatusError',
  'refreshTransferAuth',
  '7005',
  '9000'
)
Assert-Marker 'api/transfer-auth.ts' @(
  '/api/wallet/transfer-auth/status',
  '/api/wallet/transfer-auth/apply',
  'packageInfo: string | null'
)

$withdrawSource = Get-Content -Raw -Encoding utf8 -LiteralPath (Join-Path $root 'subpkg-wallet/withdraw/withdraw.vue')
if ($withdrawSource.IndexOf('packageInfo.trim()', [StringComparison]::Ordinal) -ge 0) {
  throw 'packageInfo must be passed to wx unchanged'
}
foreach ($marker in @($unsupportedPayoutLabel, 'withdrawType')) {
  if ($withdrawSource.IndexOf($marker, [StringComparison]::Ordinal) -ge 0) {
    throw "withdraw page still exposes unsupported payout marker: $marker"
  }
}

Write-Output "transfer auth integration contract: PASS"
