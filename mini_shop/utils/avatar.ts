import { uploadFile } from '@/utils/request'

/**
 * 用户头像工具：统一「用户没设置头像就用平台 logo」的口径。
 *
 * 背景：用户可能从未设置头像（微信授权不带头像、或资料里留空），此时：
 * - **展示**：一律回落到平台 logo，避免出现空白或破图；
 * - **保存**：编辑资料时若用户没上传头像，把 logo 上传到后端换回永久 URL 再提交，
 *   保证后台与其他用户能看到的地方都有头像（而不是空字符串）。
 */

/** 默认头像：平台 logo（本地静态路径，可直接用于 image 展示，也可直接上传）。 */
export const DEFAULT_AVATAR = '/static/logo.png'

/** 默认头像上传后的永久 URL 缓存键（避免每次保存资料都重复上传同一个文件）。 */
const DEFAULT_AVATAR_URL_KEY = 'default_avatar_url'

/** 头像展示兜底：为空（或只有空白字符）时返回平台 logo。 */
export function resolveAvatar(url?: string | null): string {
  const value = String(url || '').trim()
  return value || DEFAULT_AVATAR
}

/**
 * 取默认头像的永久 URL（用户没上传头像时用于提交资料）。
 * 优先读本地缓存；没有缓存时把 logo 上传到后端换回 URL 并写入缓存。
 * 调用方可自行决定上传失败时的降级（例如仍按空提交，展示端有兜底）。
 */
export async function resolveDefaultAvatarUrl(): Promise<string> {
  const cached = String(uni.getStorageSync(DEFAULT_AVATAR_URL_KEY) || '').trim()
  if (cached) return cached
  const url = String(await uploadFile(DEFAULT_AVATAR)).trim()
  if (url) uni.setStorageSync(DEFAULT_AVATAR_URL_KEY, url)
  return url
}
