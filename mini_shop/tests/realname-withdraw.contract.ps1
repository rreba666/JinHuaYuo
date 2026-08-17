$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

function Assert-Marker([string] $relativePath, [string[]] $markers) {
  $path = Join-Path $root $relativePath
  if (-not (Test-Path -LiteralPath $path)) { throw "missing file: $relativePath" }
  $source = Get-Content -LiteralPath $path -Raw -Encoding utf8
  foreach ($marker in $markers) {
    if (-not $source.Contains($marker)) { throw "marker missing in ${relativePath}: $marker" }
  }
  return $source
}

function T([int[]]$codes) {
  return -join ($codes | ForEach-Object { [char]$_ })
}

$requestSource = Assert-Marker 'utils/request.ts' @(
  'class ApiRequestError',
  'body.code',
  'isApiRequestError',
  'new ApiRequestError'
)
if ($requestSource.Contains('console.log') -or $requestSource.Contains('console.error')) {
  throw 'request layer must not log identity data'
}

$null = Assert-Marker 'api/realname.ts' @(
  '/api/realname/status',
  '/api/realname/ocr',
  '/api/realname/ocr-verify',
  'getRealnameStatus',
  'ocrRealname',
  'ocrVerifyRealname',
  'RealnameStatus',
  'RealnameOcrDTO',
  'RealnameOcrVerifyDTO'
)
$realnameApiSource = Get-Content -LiteralPath (Join-Path $root 'api/realname.ts') -Raw -Encoding utf8
foreach ($marker in @('maskedName: string | null', 'maskedCertNo: string | null', 'image: string', 'url?: string')) {
  if (-not $realnameApiSource.Contains($marker)) { throw "realname type marker missing: $marker" }
}

$withdrawApiSource = Assert-Marker 'api/user.ts' @(
  'export interface WithdrawDTO',
  "url: '/api/wallet/withdraw'",
  'data: { amount, type }',
  "type: WithdrawType = 'BALANCE'"
)
foreach ($marker in @('/api/wallet/convert', '/api/wallet/transfer', '/api/user/search', 'convertWallet', 'transferWallet', 'searchUser')) {
  if (-not $withdrawApiSource.Contains($marker)) { throw "wallet API marker missing: $marker" }
}
if ($withdrawApiSource.Contains('certName') -or $withdrawApiSource.Contains('certNo')) {
  throw 'withdraw API must not receive identity fields'
}

$sheetSource = Assert-Marker 'components/RealnameVerifySheet.vue' @(
  'chooseImage',
  'ocrVerifyRealname',
  'RealnameOcrVerifyDTO',
  'v-model',
  '@verified'
)
foreach ($marker in @('certName', 'certNo', 'CERT_NO_PATTERN')) {
  if ($sheetSource.Contains($marker)) { throw "realname sheet must not keep old manual field: $marker" }
}
foreach ($marker in @('pickIdCardPhoto', 'submitPhoto', 'photoPreview')) {
  if (-not $sheetSource.Contains($marker)) { throw "realname sheet photo marker missing: $marker" }
}
if ($sheetSource.Contains('setStorageSync') -or $sheetSource.Contains('console.log') -or $sheetSource.Contains('console.error')) {
  throw 'realname sheet must not cache or log complete identity data'
}

foreach ($relativePath in @(
  'api/realname.ts',
  'components/RealnameVerifySheet.vue',
  'pages/dividend/dividend.vue',
  'pages/wallet/withdraw.vue',
  'pages/mine/mine.vue'
)) {
  $source = Get-Content -LiteralPath (Join-Path $root $relativePath) -Raw -Encoding utf8
  if ($source -match 'console\.(log|error|warn|info)') { throw "identity flow must not log: $relativePath" }
  if ($source.Contains('setStorageSync') -or $source.Contains('getStorageSync')) {
    throw "identity flow must not cache: $relativePath"
  }
}

foreach ($page in @('pages/wallet/withdraw.vue')) {
  $null = Assert-Marker $page @(
    'getRealnameStatus', 'RealnameVerifySheet',
    'realnameVisible', 'error.code === 8601',
    'searchUser', 'transferWallet', 'withdrawWallet'
  )
}

$dividendSource = Assert-Marker 'pages/dividend/dividend.vue' @(
  'function handleConvertPromotion()',
  '/api/wallet/convert',
  'convertWallet',
  'loadWallet()',
  'loadPromotionSummary()'
)

$mineSource = Assert-Marker 'pages/mine/mine.vue' @(
  '/pages/wallet/withdraw',
  'if (index === 0)',
  'goWallet()'
)
if ($mineSource.Contains('wallet-entry')) { throw 'mine page should not expose the standalone wallet entry panel' }
if ($mineSource.Contains('RealnameVerifySheet') -or $mineSource.Contains('getRealnameStatus') -or $mineSource.Contains('walletEditorVisible')) {
  throw 'mine page should no longer own wallet modal realname flow'
}

Write-Output "realname base contract: PASS"
