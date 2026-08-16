$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$path = Join-Path $root "pages/index/index.vue"
$source = Get-Content -Raw -Encoding utf8 -LiteralPath $path

if (-not (Select-String -InputObject $source -Pattern '<view class="price-group">' -SimpleMatch)) {
  throw "homepage price group wrapper missing"
}
if (-not (Select-String -InputObject $source -Pattern '.price-group' -SimpleMatch)) {
  throw "homepage price group style missing"
}
if (-not (Select-String -InputObject $source -Pattern 'gap: 6rpx' -SimpleMatch)) {
  throw "homepage price symbol gap must be compact"
}
if (-not (Select-String -InputObject $source -Pattern '{{ item.descriptionTitle ||' -SimpleMatch)) {
  throw "homepage descriptionTitle binding missing"
}
if (Select-String -InputObject $source -Pattern "植萃寡肽 赋能肌底胶原" -SimpleMatch) {
  throw "homepage must not show an unrelated hard-coded description"
}
if (Select-String -InputObject $source -Pattern 'item.descriptionTitle || item.tag' -SimpleMatch) {
  throw "homepage tag must not replace descriptionTitle"
}

Write-Output "homepage card contract: PASS"
