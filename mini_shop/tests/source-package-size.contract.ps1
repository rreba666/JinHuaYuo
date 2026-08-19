$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $root "project.config.json"
$config = Get-Content -Raw -Encoding utf8 -LiteralPath $configPath | ConvertFrom-Json
$ignoredFiles = @($config.packOptions.ignore | Where-Object { $_.type -eq 'file' } | ForEach-Object { $_.value.Replace('/', '\') })
$files = Get-ChildItem -LiteralPath $root -Recurse -File | Where-Object { $_.FullName -notmatch '\\unpackage\\' }
$includedBytes = ($files | Where-Object {
  $relative = $_.FullName.Substring($root.Length + 1)
  $ignoredFiles -notcontains $relative
} | Measure-Object Length -Sum).Sum

if ($includedBytes -ge 2MB) {
  throw "included mini program source exceeds 2MB: $([math]::Round($includedBytes / 1KB, 1))KB"
}

$largeDesignFiles = @($ignoredFiles | Where-Object { $_ -like '*@2x.png' })
if ($largeDesignFiles.Count -lt 1) {
  throw 'unused @2x design assets must be excluded from the development package'
}

Write-Output "mini program source package contract: PASS ($([math]::Round($includedBytes / 1KB, 1))KB)"
