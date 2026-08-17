$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

function T([int[]]$codes) {
  return -join ($codes | ForEach-Object { [char]$_ })
}

$pagesJson = Get-Content -Raw -Encoding utf8 (Join-Path $root "pages.json")
if (-not (Select-String -InputObject $pagesJson -Pattern "pages/wallet/withdraw" -SimpleMatch)) { throw "wallet route missing" }

$mineSource = Get-Content -Raw -Encoding utf8 (Join-Path $root "pages/mine/mine.vue")
foreach ($marker in @(
  'if (index === 0)',
  'goWallet()',
  "/pages/wallet/withdraw"
)) {
  if (-not (Select-String -InputObject $mineSource -Pattern $marker -SimpleMatch)) { throw "mine wallet marker missing: $marker" }
}
if ($mineSource.Contains('wallet-entry')) { throw 'mine page should not expose the standalone wallet entry panel' }
foreach ($marker in @("walletEditorVisible", "RealnameVerifySheet", "getRealnameStatus", "withdrawWallet(")) {
  if (Select-String -InputObject $mineSource -Pattern $marker -SimpleMatch) { throw "mine page still exposes old wallet modal marker: $marker" }
}

$dividendSource = Get-Content -Raw -Encoding utf8 (Join-Path $root "pages/dividend/dividend.vue")
foreach ($marker in @(
  (T 0x8F6C,0x4F59,0x989D),
  "/api/wallet/convert"
)) {
  if (-not (Select-String -InputObject $dividendSource -Pattern $marker -SimpleMatch)) { throw "dividend wallet marker missing: $marker" }
}
 $overlayMatch = [regex]::Match($dividendSource, '(?s)\.promotion-code-mask\s*\{(?<style>[^}]*)\}')
if (-not $overlayMatch.Success) { throw 'promotion code overlay rule missing' }
$overlayStyle = $overlayMatch.Groups['style'].Value
foreach ($marker in @("position: fixed", "inset: 0", "display: flex", "align-items: center", "justify-content: center")) {
  if ($overlayStyle.IndexOf($marker, [StringComparison]::Ordinal) -lt 0) { throw "promotion code overlay marker missing: $marker" }
}
foreach ($marker in @("withdraw-button", "openWithdraw", "handleWithdraw", "withdrawHistoryVisible", "showWithdrawHistory")) {
  if (Select-String -InputObject $dividendSource -Pattern $marker -SimpleMatch) { throw "dividend page still exposes old withdraw marker: $marker" }
}
foreach ($marker in @("convertWallet", "handleConvertPromotion", "loadPromotionSummary", "loadWallet")) {
  if (-not (Select-String -InputObject $dividendSource -Pattern $marker -SimpleMatch)) { throw "dividend convert marker missing: $marker" }
}

$walletPath = Join-Path $root "pages/wallet/withdraw.vue"
if (-not (Test-Path -LiteralPath $walletPath)) { throw "wallet page missing" }
$walletSource = Get-Content -Raw -Encoding utf8 $walletPath
foreach ($marker in @(
  (T 0x4F59,0x989D),
  (T 0x8F6C,0x8D60,0x4ED6,0x4EBA),
  (T 0x8F6C,0x8D60,0x4ED6,0x4EBA),
  (T 0x6211,0x77E5,0x9053,0x4E86),
  (T 0x67E5,0x627E),
  "WITHDRAW_MIN_AMOUNT",
  "walletNoticeVisible",
  "walletNoticeSeen",
  (T 0x96F6,0x94B1,0x63D0,0x73B0),
  "searchUser",
  "transferWallet",
  "withdrawWallet",
  "handleWithdraw",
  "handleTransfer",
  "RealnameVerifySheet",
  "realnameVisible",
  "wallet.value?.balance",
  "transferAuthState",
  "applyTransferAuth",
  "getTransferAuthStatus",
  "requestMerchantTransfer"
)) {
  if (-not (Select-String -InputObject $walletSource -Pattern $marker -SimpleMatch)) { throw "wallet page marker missing: $marker" }
}
foreach ($marker in @("balanceDelta", "pendingPromotion + wallet.value?.pendingBonus")) {
  if (Select-String -InputObject $walletSource -Pattern $marker -SimpleMatch) { throw "wallet page still uses demo balance marker: $marker" }
}
if ($walletSource -match 'shouldSimulateWithdraw') { throw 'wallet page should not auto-simulate normal withdraw' }
if ($walletSource -match 'amount < 1') { throw 'wallet page still hardcodes withdraw minimum to 1' }
if ($walletSource -match 'handleTestWithdraw|IS_DEV_WALLET_WITHDRAW_TEST') { throw 'wallet page should not expose a dev-only test button' }

$authSource = Get-Content -Raw -Encoding utf8 (Join-Path $root "utils/auth.ts")
foreach ($marker in @("mini_shop_wallet_notice_seen", "clearWalletNoticeSeen")) {
  if (-not (Select-String -InputObject $authSource -Pattern $marker -SimpleMatch)) { throw "auth notice marker missing: $marker" }
}

Write-Output "wallet flow contract: PASS"
