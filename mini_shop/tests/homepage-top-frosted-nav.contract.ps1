$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$path = Join-Path $root "pages/index/index.vue"
$source = Get-Content -Raw -Encoding utf8 -LiteralPath $path

function Assert-Marker([string]$marker, [string]$message) {
  if ($source.IndexOf($marker, [StringComparison]::Ordinal) -lt 0) {
    throw $message
  }
}

Assert-Marker 'const navBackdropStyle = computed' 'homepage must derive the frosted backdrop from capsule metrics'
Assert-Marker 'const navGlassStyle = computed' 'homepage must define one shared frosted glass state'
Assert-Marker 'const navSearchHeightPx = computed' 'homepage must calculate the search box height in px'
Assert-Marker 'height: `${menuTop.value + navSearchHeightPx.value}px`' 'homepage frosted backdrop must cover the full search box'
Assert-Marker '<view class="nav-backdrop" :style="navBackdropStyle" />' 'homepage must render a separate top backdrop layer'
Assert-Marker '<input class="nav-search-input" value="" placeholder="搜索商品" readonly />' 'homepage must render the search input'
Assert-Marker "background: navScrolled.value ? 'rgba(255,255,255,.82)' : 'transparent'" 'homepage glass must be transparent at the top and translucent after scrolling'
Assert-Marker "backdropFilter: navScrolled.value ? 'blur(14px)' : 'none'" 'homepage glass must enable blur only after scrolling'
Assert-Marker 'background: rgba(255,255,255,.22);' 'homepage search box must remain visible over changing hero images'
Assert-Marker 'border: 1rpx solid rgba(255,255,255,.78);' 'homepage search box must have a clear border'
Assert-Marker 'color: #5d5956;' 'homepage search text must have sufficient contrast'
$navBarMatch = [regex]::Match($source, 'const navBarStyle = computed\(\(\) => \(\{(?<body>.*?)\}\)\)', [Text.RegularExpressions.RegexOptions]::Singleline)
if (!$navBarMatch.Success -or $navBarMatch.Groups['body'].Value -match 'background:') {
  throw 'homepage navigation content layer must remain transparent'
}

Write-Output "homepage top frosted navigation contract: PASS"
