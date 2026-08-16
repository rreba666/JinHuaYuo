$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$projectRoot = Split-Path -Parent $root

foreach ($envFile in @('.env', '.env.production')) {
  $path = Join-Path $root $envFile
  if (-not (Test-Path -LiteralPath $path)) { throw "environment file missing: $envFile" }
  $source = Get-Content -Raw -Encoding utf8 -LiteralPath $path
  if ($source -notmatch '(?m)^VITE_API_BASE_URL=https?://[^\r\n]+$') { throw "VITE_API_BASE_URL missing or invalid in $envFile" }
}

$devEnv = Get-Content -Raw -Encoding utf8 -LiteralPath (Join-Path $root '.env')
if ($devEnv -notmatch '(?m)^VITE_WALLET_WITHDRAW_MIN_AMOUNT=0\.01$') { throw 'development withdraw minimum missing or invalid' }
if ($devEnv -notmatch '(?m)^VITE_MERCHANT_TRANSFER_MCH_ID=\d+$') { throw 'development merchant transfer mchId missing or invalid' }
if ($devEnv -notmatch '(?m)^VITE_MERCHANT_TRANSFER_APP_ID=wx[0-9a-fA-F]+$') { throw 'development merchant transfer appId missing or invalid' }

$prodEnv = Get-Content -Raw -Encoding utf8 -LiteralPath (Join-Path $root '.env.production')
if ($prodEnv -notmatch '(?m)^VITE_WALLET_WITHDRAW_MIN_AMOUNT=1(?:\.0+)?$') { throw 'production withdraw minimum missing or invalid' }
if ($prodEnv -notmatch '(?m)^VITE_MERCHANT_TRANSFER_MCH_ID=\d+$') { throw 'production merchant transfer mchId missing or invalid' }
if ($prodEnv -notmatch '(?m)^VITE_MERCHANT_TRANSFER_APP_ID=wx[0-9a-fA-F]+$') { throw 'production merchant transfer appId missing or invalid' }

foreach ($envFile in @('.env.development', '.env.example')) {
  if (Test-Path -LiteralPath (Join-Path $root $envFile)) { throw "unnecessary mini_shop environment file remains: $envFile" }
  if (Test-Path -LiteralPath (Join-Path $projectRoot $envFile)) { throw "unnecessary workspace environment file remains: $envFile" }
}

$adminViteSource = Get-Content -Raw -Encoding utf8 -LiteralPath (Join-Path $projectRoot 'admin/vite.config.ts')
if ($adminViteSource -notmatch "new URL\('\.\./mini_shop'") { throw 'admin Vite must load env files from mini_shop' }

$requestSource = Get-Content -Raw -Encoding utf8 -LiteralPath (Join-Path $root 'utils/request.ts')
foreach ($marker in @("from '../.env?raw'", "from '../.env.production?raw'", 'import.meta.env.MODE', 'VITE_API_BASE_URL')) {
  if ($requestSource.IndexOf($marker, [StringComparison]::Ordinal) -lt 0) { throw "request.ts environment marker missing: $marker" }
}

$walletConfigSource = Get-Content -Raw -Encoding utf8 -LiteralPath (Join-Path $root 'utils/wallet-config.ts')
foreach ($marker in @("from '../.env?raw'", "from '../.env.production?raw'", 'import.meta.env.MODE', 'VITE_WALLET_WITHDRAW_MIN_AMOUNT', 'WITHDRAW_MIN_AMOUNT', 'TRANSFER_MIN_AMOUNT', 'VITE_MERCHANT_TRANSFER_MCH_ID', 'VITE_MERCHANT_TRANSFER_APP_ID', 'MERCHANT_TRANSFER_MCH_ID', 'MERCHANT_TRANSFER_APP_ID')) {
  if ($walletConfigSource.IndexOf($marker, [StringComparison]::Ordinal) -lt 0) { throw "wallet config marker missing: $marker" }
}
foreach ($ip in @('192.168.1.3', '192.168.1.4', '192.168.1.5')) {
  if ($requestSource.Contains($ip)) { throw "hardcoded backend IP remains in request.ts: $ip" }
}

Write-Output "mini shop environment contract: PASS"
