$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$path = Join-Path $root "pages/mine/mine.vue"
$asset = Join-Path $root "static/bg/个人bg.jpg"
$source = Get-Content -Raw -Encoding utf8 -LiteralPath $path

if (-not (Test-Path -LiteralPath $asset)) {
  throw 'mine profile background asset is missing'
}
if ($source.IndexOf('<image class="hero-bg" src="/static/bg/个人bg.jpg"', [StringComparison]::Ordinal) -lt 0) {
  throw 'mine hero must render the supplied profile background image as an image layer'
}
foreach ($marker in @("url('/static/bg/个人bg.jpg')", "url('../../static/bg/个人bg.jpg')")) {
  if ($source.IndexOf($marker, [StringComparison]::Ordinal) -ge 0) {
    throw 'mine hero background image must not be loaded through WXSS'
  }
}
if ($source -match '\.hero::(before|after)') {
  throw 'mine hero must not layer the old generated stripe decorations over the supplied image'
}

Write-Output "mine profile background contract: PASS"
