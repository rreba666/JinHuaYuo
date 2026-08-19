$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$minePath = Join-Path $root "pages/mine/mine.vue"
$posterPath = Join-Path $root "components/PromotionCodePoster.vue"
$mineSource = Get-Content -Raw -Encoding utf8 -LiteralPath $minePath

foreach ($marker in @(
  'function formatIncome(value?: number): string',
  'incomeValueClass(item.value)',
  "import PromotionCodePoster from '@/components/PromotionCodePoster.vue'",
  '<PromotionCodePoster v-model="promotionCodeVisible"'
)) {
  if ($mineSource.IndexOf($marker, [StringComparison]::Ordinal) -lt 0) {
    throw "mine page marker missing: $marker"
  }
}

if (-not (Test-Path -LiteralPath $posterPath)) {
  throw 'promotion code action component is missing'
}
$posterSource = Get-Content -Raw -Encoding utf8 -LiteralPath $posterPath
foreach ($marker in @(
  'uni.saveImageToPhotosAlbum',
  'showShareImageMenu',
  'uni.canvasToTempFilePath',
  'class="poster-action poster-save"',
  'class="poster-action poster-share"'
)) {
  if ($posterSource.IndexOf($marker, [StringComparison]::Ordinal) -lt 0) {
    throw "promotion poster action marker missing: $marker"
  }
}

Write-Output "mine income and promotion actions contract: PASS"
