$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$path = Join-Path $root "pages/index/index.vue"
$source = Get-Content -Raw -Encoding utf8 -LiteralPath $path

function Assert-Marker([string]$marker, [string]$message) {
  if ($source.IndexOf($marker, [StringComparison]::Ordinal) -lt 0) {
    throw $message
  }
}

Assert-Marker 'onPageScroll' 'homepage must observe page scrolling for the top navigation state'
Assert-Marker 'const navScrolled = ref(false)' 'homepage navigation must be transparent at the top by default'
Assert-Marker 'background: navScrolled.value ?' 'homepage navigation must switch background after scrolling'
Assert-Marker 'navScrolled.value = scrollTop > 2' 'homepage navigation must return to transparent at the top'
Assert-Marker ':style="navBarStyle"' 'homepage navigation must apply the scroll-aware style'
Assert-Marker 'transition: background-color .2s ease' 'homepage navigation background transition must be smooth'

Write-Output "homepage scroll navigation contract: PASS"
