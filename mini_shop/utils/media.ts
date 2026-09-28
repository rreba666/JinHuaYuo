import { API_BASE_URL } from './request'

/**
 * 把后端返回的媒体地址解析成可直接给 `<image src>` 用的**绝对地址**。
 *
 * ⚠️ 2026-09-28 修（"个人资料里数据库/后台都有头像昵称，小程序却全是默认，重新上传一次才显示"）：
 * 后端 `GET /api/user/profile` 返回的 `avatarUrl` 可能是**以 `/` 开头的相对路径**，
 * 而 `UserUpdateDTO`（上传头像时提交的）里是**完整 URL**
 * ⇒ 于是刚上传完能显示（用的是自己提交的那个完整地址），重进页面就变回空/裂图。
 *
 * 后台一直有这层解析（`admin/src/api/media.ts` 的 `resolveMediaUrl`），**小程序此前缺这一层**。
 * 本实现与后台保持同一口径：**只给以 `/` 开头的值拼 base**；
 * 已是 `http(s)://`、`//`、`data:`、`blob:` 或其它形态（如 OSS key）一律原样返回，不擅自改写。
 */
export function resolveMediaUrl(value: unknown): string {
  const url = typeof value === 'string' ? value.trim() : ''
  if (!url || /^(?:data:|blob:|https?:\/\/|\/\/)/i.test(url) || !url.startsWith('/')) return url
  return API_BASE_URL ? `${API_BASE_URL}${url}` : url
}

/** 兼容接口返回字符串 / 对象 / 数组形式的媒体地址（与后台 `extractMediaUrl` 同口径）。 */
export function extractMediaUrl(value: unknown): string {
  if (typeof value === 'string') return resolveMediaUrl(value)
  if (!value || typeof value !== 'object') return ''
  const record = value as Record<string, unknown>
  for (const key of ['url', 'fileUrl', 'objectUrl', 'path']) {
    const url = resolveMediaUrl(record[key])
    if (url) return url
  }
  return ''
}
