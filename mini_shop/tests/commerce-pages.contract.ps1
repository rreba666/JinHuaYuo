$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

function T([int[]]$codes) {
  return -join ($codes | ForEach-Object { [char]$_ })
}

$pagesJson = Get-Content -Raw -Encoding utf8 (Join-Path $root "pages.json")
foreach ($path in @("pages/dividend/dividend", "pages/wallet/withdraw")) {
  if (-not (Select-String -InputObject $pagesJson -Pattern $path -SimpleMatch)) { throw "$path route missing" }
}

$mineSource = Get-Content -Raw -Encoding utf8 (Join-Path $root "pages/mine/mine.vue")
foreach ($marker in @(
  (T 0x6211,0x7684,0x4F59,0x989D),
  (T 0x8F6C,0x4F59,0x989D),
  "/pages/wallet/withdraw"
)) {
  if (-not (Select-String -InputObject $mineSource -Pattern $marker -SimpleMatch)) { throw "mine page marker missing: $marker" }
}

$dividendSource = Get-Content -Raw -Encoding utf8 (Join-Path $root "pages/dividend/dividend.vue")
foreach ($marker in @(
  (T 0x6211,0x7684,0x63A8,0x5E7F,0x79EF,0x5206),
  (T 0x8F6C,0x4F59,0x989D),
  (T 0x7D2F,0x8BA1,0x63A8,0x5E7F,0x79EF,0x5206),
  "/pages/wallet/withdraw",
  "goWallet",
  "wallet-button"
)) {
  if (-not (Select-String -InputObject $dividendSource -Pattern $marker -SimpleMatch)) { throw "dividend page marker missing: $marker" }
}
foreach ($marker in @("withdraw-button", "openWithdraw", "handleWithdraw", "withdrawHistoryVisible", "showWithdrawHistory", "loadMoreWithdrawals", "getWithdrawals")) {
  if (Select-String -InputObject $dividendSource -Pattern $marker -SimpleMatch) { throw "dividend page still exposes old withdraw marker: $marker" }
}

$walletSource = Get-Content -Raw -Encoding utf8 (Join-Path $root "pages/wallet/withdraw.vue")
foreach ($marker in @(
  (T 0x4F59,0x989D),
  (T 0x53EF,0x8F6C,0x8D26,0x4F59,0x989D),
  (T 0x63D0,0x73B0,0x65B9,0x5F0F),
  (T 0x96F6,0x94B1,0x63D0,0x73B0),
  (T 0x8F6C,0x8D60,0x4ED6,0x4EBA),
  (T 0x6211,0x77E5,0x9053,0x4E86),
  "walletNoticeVisible",
  "walletNoticeSeen",
  "handleWithdraw",
  "handleTransfer"
)) {
  if (-not (Select-String -InputObject $walletSource -Pattern $marker -SimpleMatch)) { throw "wallet page marker missing: $marker" }
}

Write-Output "commerce pages contract: PASS"
