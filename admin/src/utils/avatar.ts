import logoUrl from '@/assets/logo.png'

/**
 * 用户头像工具：用户未设置头像时统一用平台 logo 兜底。
 *
 * 后端约定：`avatarUrl` 未设置时为 `null`（见 api-docs 中 `LeaderboardRow` 等字段说明），
 * 因此「默认头像」由**展示层**承担 —— 不写回用户资料、也不需要上传。
 */
export const DEFAULT_AVATAR = logoUrl

/** 头像展示兜底：为空（或纯空白）时返回平台 logo。 */
export function resolveAvatar(url?: string | null): string {
  const value = String(url || '').trim()
  return value || DEFAULT_AVATAR
}
