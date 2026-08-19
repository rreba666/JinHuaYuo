$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$path = Join-Path $root "src/views/users/index.vue"
$source = Get-Content -Raw -Encoding utf8 -LiteralPath $path

if ($source -notmatch '<el-drawer[\s\S]*?append-to-body') {
  throw 'user detail drawer must append to body so its mask covers the full viewport'
}

Write-Output "user drawer overlay contract: PASS"
