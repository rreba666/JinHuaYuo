/**
 * 用户头像工具：用户未设置头像时统一用平台 logo 兜底。
 *
 * 后端约定：`avatarUrl` 未设置时为 `null`（见 api-docs 中 `LeaderboardRow` 等字段说明），
 * 因此「默认头像」由**展示层**承担 —— 不写回用户资料、也不需要上传 logo。
 */
export const DEFAULT_AVATAR = '/static/logo.png'

/**
 * 已知的「微信默认灰头像」地址（**精确匹配**）。
 *
 * 用户没设置微信头像时，微信下发的是一张**固定的灰头像**（同一张图、同一个地址），
 * 所以只能按完整地址精确比对：**不能用模式匹配**——真实用户头像的地址同样以尺寸段
 * （`/132`、`/0`、`/64` 等）结尾，用模式匹配会把正常头像一起换掉。
 *
 * 后续遇到新的默认头像形态，把完整地址追加进来即可（小程序与后台保持一致）。
 */
const DEFAULT_WECHAT_AVATAR_URLS: string[] = []

/** 是否为已知的微信默认灰头像（等价于「用户没设置头像」）。 */
export function isDefaultWechatAvatar(url?: string | null): boolean {
  const value = String(url || '').trim().toLowerCase()
  if (!value) return false
  return DEFAULT_WECHAT_AVATAR_URLS.some((item) => item.toLowerCase() === value)
}

/** 头像展示兜底：为空、或为已知的微信默认灰头像时返回平台 logo。 */
export function resolveAvatar(url?: string | null): string {
  const value = String(url || '').trim()
  if (!value || isDefaultWechatAvatar(value)) return DEFAULT_AVATAR
  return value
}
