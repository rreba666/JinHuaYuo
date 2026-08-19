$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$asset = Join-Path $root "static/bg/推广码背景.png"
$componentPath = Join-Path $root "components/PromotionCodePoster.vue"
$pages = @(
  "pages/mine/mine.vue",
  "subpkg-goods/detail/detail.vue",
  "subpkg-wallet/dividend/dividend.vue"
)

if (-not (Test-Path -LiteralPath $asset)) {
  throw 'promotion code poster background asset is missing'
}
if (-not (Test-Path -LiteralPath $componentPath)) {
  throw 'promotion code poster component is missing'
}
$componentSource = Get-Content -Raw -Encoding utf8 -LiteralPath $componentPath

foreach ($relativePath in $pages) {
  $path = Join-Path $root $relativePath
  $source = Get-Content -Raw -Encoding utf8 -LiteralPath $path
  foreach ($marker in @(
    "import PromotionCodePoster from '@/components/PromotionCodePoster.vue'",
    '<PromotionCodePoster v-model="promotionCodeVisible"'
  )) {
    if ($source.IndexOf($marker, [StringComparison]::Ordinal) -lt 0) {
      throw "promotion poster marker missing in ${relativePath}: $marker"
    }
  }
  if ($source -match 'promotion-code-sheet') {
    throw "promotion code poster markup must be centralized in ${relativePath}"
  }
}

foreach ($marker in @(
  '<image class="promotion-code-bg" src="/static/bg/推广码背景.png"',
  '<image v-show="!loading && codeUrl" class="promotion-code-image"',
  'width: 621rpx; height: 1200rpx;',
  'width: 392rpx; height: 392rpx;',
  'top: 686rpx; left: 114rpx;',
  'uni.saveImageToPhotosAlbum',
  'showShareImageMenu',
  'uni.canvasToTempFilePath'
)) {
  if ($componentSource.IndexOf($marker, [StringComparison]::Ordinal) -lt 0) {
    throw "promotion poster component marker missing: $marker"
  }
}
if ($componentSource -match 'width: 460rpx; height: 460rpx' -or $componentSource -match 'background[^;]*url\(') {
  throw 'promotion poster component contains the old layout or a WXSS local background'
}

Write-Output "promotion code poster contract: PASS"
