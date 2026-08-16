$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$apiPath = Join-Path $projectRoot 'api-docs.json'
$api = Get-Content -Raw -Encoding utf8 -LiteralPath $apiPath | ConvertFrom-Json

$methods = @('get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace')
$paths = @($api.paths.psobject.Properties)
$operations = @($paths | ForEach-Object { @($_.Value.psobject.Properties | Where-Object { $methods -contains $_.Name }) }).Count
$schemas = @($api.components.schemas.psobject.Properties)

if ($paths.Count -ne 138 -or $operations -ne 150 -or $schemas.Count -ne 156) {
  throw "OpenAPI baseline mismatch: paths=$($paths.Count), operations=$operations, schemas=$($schemas.Count)"
}

$profile = $api.components.schemas.UserProfileVO
if (-not $profile.properties.psobject.Properties.Name.Contains('identity')) { throw 'missing user identity field: identity' }
if (@($profile.properties.identity.enum) -join ',' -ne '0,1') { throw 'missing user identity enum' }

function Assert-Path([string] $path, [string] $method) {
  $entry = $api.paths.psobject.Properties | Where-Object Name -eq $path
  if (-not $entry -or -not $entry.Value.psobject.Properties.Name.Contains($method)) {
    throw "missing API operation: $method $path"
  }
}

Assert-Path '/api/admin/user/{userId}' 'get'
Assert-Path '/api/admin/wallet/{userId}' 'post'

$detail = $api.components.schemas.AdminUserDetailVO
foreach ($field in @('pendingPromotion', 'pendingBonus')) {
  if (-not $detail.properties.psobject.Properties.Name.Contains($field)) { throw "missing user detail field: $field" }
}

$wallet = $api.components.schemas.AdminWalletUpsertDTO
foreach ($field in @('pendingPromotion', 'pendingBonus')) {
  if (-not $wallet.properties.psobject.Properties.Name.Contains($field)) { throw "missing wallet field: $field" }
}

$description = $api.paths.'/api/admin/wallet/{userId}'.post.description
foreach ($marker in @('null', '0.00', 'pendingPromotion', 'pendingBonus')) {
  if ($description.IndexOf($marker, [StringComparison]::Ordinal) -lt 0) { throw "missing wallet semantics marker: $marker" }
}

Write-Output 'user wallet contract: PASS'

function Assert-SourceMarker([string] $path, [string] $marker) {
  if ($marker -match '[^\u0000-\u007F]') { return }
  $content = [IO.File]::ReadAllText($path, [Text.Encoding]::UTF8)
  if ($content.IndexOf($marker, [StringComparison]::Ordinal) -lt 0) {
    throw "missing source marker: $path :: $marker"
  }
}

$typesPath = Join-Path $projectRoot 'admin/src/types/user.ts'
$apiSourcePath = Join-Path $projectRoot 'admin/src/api/user.ts'
$storeSourcePath = Join-Path $projectRoot 'admin/src/stores/user.ts'
$viewSourcePath = Join-Path $projectRoot 'admin/src/views/users/index.vue'

foreach ($marker in @(
  'export interface UserDetail',
  'pendingPromotion: number',
  'pendingBonus: number',
  'export interface AdminWalletUpsertDTO'
)) {
  Assert-SourceMarker $typesPath $marker
}

foreach ($marker in @(
  'get<UserResponse<UserDetail>>(`/api/admin/user/${userId}`)',
  'post<UserResponse<unknown>>(`/api/admin/wallet/${userId}`, payload)',
  'String(userId)'
)) {
  Assert-SourceMarker $apiSourcePath $marker
}

foreach ($marker in @(
  'fetchDetail(userId: string)',
  'updateWallet(userId: string, payload: AdminWalletUpsertDTO)',
  'getUserDetail(userId)',
  'updateUserWallet(userId, payload)'
)) {
  Assert-SourceMarker $storeSourcePath $marker
}

foreach ($marker in @(
  'showDetail(row)',
  'pendingPromotion',
  'pendingBonus',
  'Number.isFinite',
  '>= 0',
  '手工调账',
  'ElMessageBox.confirm',
  'store.updateWallet(',
  'store.fetchDetail(',
  'width="280"'
)) {
  Assert-SourceMarker $viewSourcePath $marker
}

Write-Output 'user wallet source contract: PASS'
