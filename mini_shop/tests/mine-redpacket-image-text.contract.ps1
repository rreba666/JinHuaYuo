$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$path = Join-Path $root "pages/mine/mine.vue"
$source = Get-Content -Raw -Encoding utf8 -LiteralPath $path

function Assert-Marker([string]$marker, [string]$message) {
  if ($source.IndexOf($marker, [StringComparison]::Ordinal) -lt 0) {
    throw $message
  }
}

Assert-Marker '<image class="redpacket-bg" src="/static/my/红包_slices/编组.png" mode="aspectFit" />' 'red packet popup must keep the designed background image'
Assert-Marker '<text class="redpacket-amount">{{ redPacketAmount }}</text>' 'red packet popup must keep the dynamic amount'
Assert-Marker '<view class="redpacket-action" @click="openRedPacketPage" />' 'red packet popup must keep an invisible action area over the image button'

foreach ($marker in @('class="redpacket-title"', 'class="redpacket-btn"', 'class="redpacket-tip"')) {
  if ($source.Contains($marker)) {
    throw "red packet popup must not overlay image text: $marker"
  }
}

Write-Output "mine red packet image text contract: PASS"
