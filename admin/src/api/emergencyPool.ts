import { request } from './request'
import type { EmergencyPoolInjectDTO, EmergencyPoolLog, EmergencyPoolLogPageResult, EmergencyPoolLogQuery, EmergencyPoolOverview, EmergencyPoolResponse } from '@/types/emergencyPool'

function unwrap<T>(response: { data: EmergencyPoolResponse<T> }, fallback: string): T {
  const result = response.data
  if (result.code !== 0 || result.success === false) throw new Error(result.message || fallback)
  return result.data as T
}

/** 查询应急红包池总账（仅超管）。 */
export async function getEmergencyPool(): Promise<EmergencyPoolOverview> {
  const response = await request.get<EmergencyPoolResponse<EmergencyPoolOverview>>('/api/admin/profit/emergency-pool', { skipAuthRedirect: true })
  const data = unwrap(response, '应急红包池查询失败') || {} as EmergencyPoolOverview
  return {
    balance: Number(data.balance) || 0,
    totalDeduct: Number(data.totalDeduct) || 0,
    totalInject: Number(data.totalInject) || 0,
    pendingInject: Number(data.pendingInject) || 0,
  }
}

/**
 * 查询应急红包池流水分页。
 * 2026-09-19 起支持 `type`（流水类型）与 `startDate`/`endDate`（发生日期区间，含当天）筛选；
 * 响应里新增 `summary`（当前筛选范围的汇总，与分页无关）—— 后端未下发时返回 null，页面隐藏汇总区。
 */
export async function getEmergencyPoolLogs(query: EmergencyPoolLogQuery): Promise<EmergencyPoolLogPageResult> {
  const params: Record<string, string | number> = { page: query.page, pageSize: query.pageSize }
  if (query.type) params.type = query.type
  if (query.startDate) params.startDate = query.startDate
  if (query.endDate) params.endDate = query.endDate

  const response = await request.get<EmergencyPoolResponse<EmergencyPoolLogPageResult>>('/api/admin/profit/emergency-pool/logs', { params, skipAuthRedirect: true })
  const data = unwrap(response, '应急红包池流水查询失败') || {} as EmergencyPoolLogPageResult
  const list = ((data.list || []) as EmergencyPoolLog[]).map((item) => ({ ...item, id: String(item.id ?? '') }))
  return {
    total: Number(data.total) || 0,
    list,
    page: Number(data.page) || query.page,
    pageSize: Number(data.pageSize) || query.pageSize,
    summary: data.summary ?? null,
  }
}

/** 注入应急红包池（下次结算加入父奖池，仅超管）。 */
export async function injectEmergencyPool(amount: number): Promise<void> {
  const payload: EmergencyPoolInjectDTO = { amount }
  unwrap(await request.post<EmergencyPoolResponse<null>>('/api/admin/profit/emergency-pool/inject', payload, { skipAuthRedirect: true }), '应急红包池注入失败')
}
