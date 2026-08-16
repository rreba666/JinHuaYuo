const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')

/** 将后端返回的相对媒体路径补全为当前 API 服务地址。 */
export function resolveMediaUrl(value: unknown): string {
  const url = typeof value === 'string' ? value.trim() : ''
  if (!url || /^(?:data:|blob:|https?:\/\/|\/\/)/i.test(url) || !url.startsWith('/')) return url
  return API_BASE_URL ? `${API_BASE_URL}${url}` : url
}

/** 兼容接口返回字符串、对象或数组形式的媒体地址。 */
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

/** 将媒体地址数组统一归一化，并过滤空值。 */
export function resolveMediaArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(resolveMediaUrl).filter(Boolean) : []
}
