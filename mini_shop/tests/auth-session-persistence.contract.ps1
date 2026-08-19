$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$path = Join-Path $root "pages/login/login.vue"
$source = Get-Content -Raw -Encoding utf8 -LiteralPath $path

function Assert-Marker([string]$marker, [string]$message) {
  if ($source.IndexOf($marker, [StringComparison]::Ordinal) -lt 0) {
    throw $message
  }
}

Assert-Marker "import { isLoggedIn, saveAuth } from '@/utils/auth'" 'login page must read the persisted session'
Assert-Marker 'const restoringSession = ref(true)' 'login page must keep the form hidden while restoring a session'
Assert-Marker 'if (isLoggedIn())' 'login page must detect an existing session before showing login'
Assert-Marker "uni.reLaunch({ url: '/pages/index/index' })" 'existing session must return directly to the homepage'
Assert-Marker 'v-if="!restoringSession"' 'login form must only render after session restoration'

Write-Output "auth session persistence contract: PASS"
