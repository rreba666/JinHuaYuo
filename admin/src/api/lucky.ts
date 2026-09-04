import { request } from './request'
import { extractMediaUrl } from './media'
import type { ApiResponse, PaginationResult } from '@/types/common'
import type {
  LuckyActivityQuery,
  LuckyActivitySaveDTO,
  LuckyActivityVO,
  LuckyPrize,
  LuckyRecordQuery,
  LuckyRecordVO,
  LuckyRigged,
} from '@/types/lucky'

/** 统一校验幸运抽奖接口的业务响应。 */
function ensureSuccess<T>(result: ApiResponse<T> | { data: ApiResponse<T> }, fallback: string): void {
  const data = 'data' in result && typeof result.data === 'object' && 'code' in (result.data as object)
    ? (result.data as ApiResponse<T>) : result as ApiResponse<T>
  if (data.code !== 0 || data.success === false) throw new Error(data.message || fallback)
}

/** 归一化奖品。 */
function normalizePrize(value: unknown): LuckyPrize {
  const row = (value || {}) as Partial<LuckyPrize>
  return {
    prizeId: row.prizeId ?? null,
    name: String(row.name ?? ''),
    image: extractMediaUrl(row.image) || '',
    level: row.level ?? '',
    probability: Number(row.probability ?? 0),
    stock: Number(row.stock ?? 0),
    sortOrder: Number(row.sortOrder ?? 0),
    remainingStock: row.remainingStock != null ? Number(row.remainingStock) : null,
  }
}

/** 归一化活动。 */
function normalizeActivity(value: unknown): LuckyActivityVO {
  const row = (value || {}) as Partial<LuckyActivityVO>
  return {
    id: Number(row.id),
    name: String(row.name ?? ''),
    description: row.description ?? '',
    status: Number(row.status) as 0 | 1,
    startTime: String(row.startTime ?? ''),
    endTime: String(row.endTime ?? ''),
    dailyLimitPerUser: row.dailyLimitPerUser != null ? Number(row.dailyLimitPerUser) : null,
    totalLimitPerUser: row.totalLimitPerUser != null ? Number(row.totalLimitPerUser) : null,
    prizes: Array.isArray(row.prizes) ? row.prizes.map(normalizePrize) : [],
    rigged: Array.isArray(row.rigged) ? row.rigged.map((r) => ({ ...(r as unknown as LuckyRigged) })) : [],
    createTime: String(row.createTime ?? ''),
  }
}

/** 活动列表（分页，创建倒序）。 */
export async function getLuckyActivities(query: LuckyActivityQuery = {}): Promise<PaginationResult<LuckyActivityVO>> {
  const params = { page: query.page ?? 1, pageSize: query.pageSize ?? 20 }
  const response = await request.get<ApiResponse<PaginationResult<LuckyActivityVO>>>('/api/admin/lucky/activities', { params })
  const result = response.data
  ensureSuccess(result, '活动列表查询失败')
  return { list: (result.data?.list || []).map(normalizeActivity), total: Number(result.data?.total ?? 0) }
}

/** 活动详情。 */
export async function getLuckyActivity(id: number): Promise<LuckyActivityVO> {
  const response = await request.get<ApiResponse<LuckyActivityVO>>(`/api/admin/lucky/activities/${id}`)
  const result = response.data
  ensureSuccess(result, '活动详情查询失败')
  return normalizeActivity(result.data)
}

/** 创建活动。 */
export async function createLuckyActivity(payload: LuckyActivitySaveDTO): Promise<LuckyActivityVO | null> {
  const response = await request.post<ApiResponse<LuckyActivityVO | null>>('/api/admin/lucky/activities', payload)
  const result = response.data
  ensureSuccess(result, '活动创建失败')
  return result.data ? normalizeActivity(result.data) : null
}

/** 更新活动（整体覆盖活动字段 + 奖品列表）。 */
export async function updateLuckyActivity(id: number, payload: LuckyActivitySaveDTO): Promise<void> {
  const response = await request.put<ApiResponse<null>>(`/api/admin/lucky/activities/${id}`, payload)
  ensureSuccess(response.data, '活动保存失败')
}

/** 删除活动（及其奖品/内定名单，记录保留）。 */
export async function deleteLuckyActivity(id: number): Promise<void> {
  const response = await request.delete<ApiResponse<null>>(`/api/admin/lucky/activities/${id}`)
  ensureSuccess(response.data, '活动删除失败')
}

/** 启用/停用活动。 */
export async function setLuckyActivityStatus(id: number, status: 0 | 1): Promise<void> {
  const response = await request.put<ApiResponse<null>>(`/api/admin/lucky/activities/${id}/status`, null, { params: { status } })
  ensureSuccess(response.data, '启停失败')
}

/** 配置抽奖次数。 */
export async function setLuckyTimes(id: number, payload: { dailyLimitPerUser?: number | null; totalLimitPerUser?: number | null }): Promise<void> {
  const response = await request.put<ApiResponse<null>>(`/api/admin/lucky/activities/${id}/times`, payload)
  ensureSuccess(response.data, '次数配置失败')
}

/** 设置内定名单（整体覆盖）。 */
export async function setLuckyRigged(id: number, items: { userId: number; prizeId: number }[]): Promise<void> {
  const response = await request.put<ApiResponse<null>>(`/api/admin/lucky/activities/${id}/rigged`, { items })
  ensureSuccess(response.data, '内定名单保存失败')
}

/** 查询内定名单（可按活动过滤）。 */
export async function getLuckyRigged(activityId?: number): Promise<LuckyRigged[]> {
  const response = await request.get<ApiResponse<LuckyRigged[]>>('/api/admin/lucky/rigged', { params: { activityId } })
  const result = response.data
  ensureSuccess(result, '内定名单查询失败')
  return Array.isArray(result.data) ? result.data.map((r) => ({ ...(r as unknown as LuckyRigged) })) : []
}

/** 抽奖记录列表（分页，抽奖时间倒序）。 */
export async function getLuckyRecords(query: LuckyRecordQuery = {}): Promise<PaginationResult<LuckyRecordVO>> {
  const params = { page: query.page ?? 1, pageSize: query.pageSize ?? 50 }
  const response = await request.get<ApiResponse<PaginationResult<LuckyRecordVO>>>('/api/admin/lucky/records', { params })
  const result = response.data
  ensureSuccess(result, '抽奖记录查询失败')
  return { list: (result.data?.list || []).map((r) => ({ ...(r as unknown as LuckyRecordVO) })), total: Number(result.data?.total ?? 0) }
}

/** 核销自提码。 */
export async function verifyLuckyCode(verifyCode: string): Promise<void> {
  const response = await request.post<ApiResponse<null>>('/api/admin/lucky/verify', { verifyCode })
  ensureSuccess(response.data, '核销失败')
}

/** 上传奖品图片，复用主页管理等通用上传接口，返回 URL。 */
export async function uploadLuckyImage(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await request.post<ApiResponse<string>>('/api/admin/homepage/upload', formData)
  const result = response.data
  ensureSuccess(result, '图片上传失败')
  const url = extractMediaUrl(result.data)
  if (!url) throw new Error('图片上传未返回地址')
  return url
}
