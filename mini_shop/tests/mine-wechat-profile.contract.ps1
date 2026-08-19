$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$minePath = Join-Path $root "pages/mine/mine.vue"
$loginPath = Join-Path $root "pages/login/login.vue"
$profilePath = Join-Path $root "utils/wechat-profile.ts"
$mineSource = Get-Content -Raw -Encoding utf8 -LiteralPath $minePath
$loginSource = Get-Content -Raw -Encoding utf8 -LiteralPath $loginPath
$profileSource = Get-Content -Raw -Encoding utf8 -LiteralPath $profilePath

function Assert-Marker([string]$source, [string]$marker, [string]$message) {
  if ($source.IndexOf($marker, [StringComparison]::Ordinal) -lt 0) {
    throw $message
  }
}

Assert-Marker $profileSource 'getUserProfile' 'wechat profile helper must use the official user profile API'
Assert-Marker $profileSource 'nickName' 'wechat profile helper must map the WeChat nickname field'
Assert-Marker $profileSource 'avatarUrl' 'wechat profile helper must map the WeChat avatar field'

Assert-Marker $loginSource "import { getWechatProfile } from '@/utils/wechat-profile'" 'login must request the WeChat profile after authentication'
Assert-Marker $loginSource 'await updateUserProfile(profile)' 'login must persist the WeChat profile to the backend'
Assert-Marker $loginSource 'catch (profileUpdateError)' 'profile persistence failure must not block a successful login'
$profileRequestIndex = $loginSource.IndexOf('const profilePromise = getWechatProfile()', [StringComparison]::Ordinal)
$loginRequestIndex = $loginSource.IndexOf('const loginResult = await getWechatLoginCode()', [StringComparison]::Ordinal)
if ($profileRequestIndex -lt 0 -or $loginRequestIndex -lt 0 -or $profileRequestIndex -gt $loginRequestIndex) {
  throw 'login must start the WeChat profile request before awaiting the login request'
}

Assert-Marker $mineSource "import { getWechatProfile } from '@/utils/wechat-profile'" 'mine page must support syncing the WeChat profile'
Assert-Marker $mineSource 'async function syncWechatProfile' 'mine page must expose a profile sync action for existing users'
Assert-Marker $mineSource 'class="profile-sync"' 'mine page must provide a profile sync button'
Assert-Marker $mineSource 'nickname: profile.nickname' 'mine page must persist the WeChat nickname'
Assert-Marker $mineSource 'avatarUrl: profile.avatarUrl' 'mine page must persist the WeChat avatar'

Write-Output "mine WeChat profile contract: PASS"
