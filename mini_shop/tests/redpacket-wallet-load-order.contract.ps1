$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$path = Join-Path $root "subpkg-wallet/redpacket/redpacket.vue"
$source = Get-Content -Raw -Encoding utf8 -LiteralPath $path

$loadDataMatch = [regex]::Match($source, '(?s)async function loadData\(\): Promise<void> \{(?<body>.*?)\n\}')
if (-not $loadDataMatch.Success) {
  throw 'red packet page loadData function is missing'
}

$body = $loadDataMatch.Groups['body'].Value
$ensureIndex = $body.IndexOf('await ensureUser()', [StringComparison]::Ordinal)
$registeredIndex = $body.IndexOf('if (!registeredUser.value) return', [StringComparison]::Ordinal)
if ($ensureIndex -lt 0 -or $registeredIndex -lt 0 -or $ensureIndex -gt $registeredIndex) {
  throw 'red packet page must resolve the user before checking registration and loading wallet data'
}

Write-Output "red packet wallet load order contract: PASS"
