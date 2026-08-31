import { request } from './request'
import type { AdminResponse } from '@/types/admin'

/** 健康问卷记录（B 端后台，含用户信息）。 */
export interface AdminHealthSurveyRecord {
  id: string
  userId: string
  /** 用户昵称。 */
  userNickname?: string
  /** 10 题得分。 */
  scores: number[]
  /** 总分。 */
  totalScore: number
  /** 等级：1=良好，2=轻度亚健康，3=明显缺肽。 */
  level: number
  /** 等级描述。 */
  levelDesc: string
  createTime: string
}

/** 健康问卷分页结果。 */
export interface AdminHealthSurveyPageResult {
  total: number
  list: AdminHealthSurveyRecord[]
  page: number
  pageSize: number
}

function unwrap<T>(response: { data: AdminResponse<T> }, fallback: string): T {
  const result = response.data
  if (result.code !== 0 || result.success === false) throw new Error(result.message || fallback)
  return result.data as T
}

function normalizeRecord(value: unknown): AdminHealthSurveyRecord {
  const record = (value || {}) as Partial<AdminHealthSurveyRecord>
  return {
    ...record,
    id: String(record.id ?? ''),
    userId: String(record.userId ?? ''),
    scores: Array.isArray(record.scores) ? record.scores.map(Number) : [],
    totalScore: Number(record.totalScore) || 0,
    level: Number(record.level) || 0,
    createTime: String(record.createTime ?? ''),
  } as AdminHealthSurveyRecord
}

/** 兼容 records 和 list 两种分页返回结构。 */
function normalizePage(value: unknown, page: number, pageSize: number): AdminHealthSurveyPageResult {
  const raw = (value || {}) as Record<string, unknown>
  const records = Array.isArray(raw.records) ? raw.records : Array.isArray(raw.list) ? raw.list : Array.isArray(value) ? value : []
  return {
    total: Number(raw.total ?? records.length) || 0,
    page: Number(raw.current ?? raw.page ?? page) || page,
    pageSize: Number(raw.size ?? raw.pageSize ?? pageSize) || pageSize,
    list: records.map(normalizeRecord),
  }
}

/** 查询健康问卷分页列表（含用户昵称/总分/等级/每题得分）。 */
export async function getHealthSurveyList(page: number, pageSize: number): Promise<AdminHealthSurveyPageResult> {
  const response = await request.get<AdminResponse<unknown>>('/api/admin/health-survey/list', { params: { page, pageSize } })
  return normalizePage(unwrap(response, '健康问卷查询失败'), page, pageSize)
}
