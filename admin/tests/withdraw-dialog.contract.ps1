$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$source = Get-Content -Raw -Encoding utf8 (Join-Path $root "src/views/withdraw/index.vue")
if ($source -notmatch '<el-dialog[^>]*append-to-body') {
  throw 'withdraw reason dialog must append to body'
}

Write-Output "withdraw dialog contract: PASS"
