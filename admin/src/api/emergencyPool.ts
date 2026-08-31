import { request } from './request'
import type { EmergencyPoolInjectDTO, EmergencyPoolLog, EmergencyPoolLogPageResult, EmergencyPoolOverview, EmergencyPoolResponse } from '@/types/emergencyPool'

function unwrap<T>(response: { data: EmergencyPoolResponse<T> }, fallback: string): T {
  const result = response.data
  if (result.code !== 0 || result.success === false) throw new Error(result.message || fallback)
  return result.data as T
}

/** 查询应急缓存池总账（仅超管）。 */
export async function getEmergencyPool(): Promise<EmergencyPoolOverview> {
  const response = await request.get<EmergencyPoolResponse<EmergencyPoolOverview>>('/api/admin/profit/emergency-pool', { skipAuthRedirect: true })
  const data = unwrap(response, '应急池查询失败') || {} as EmergencyPoolOverview
  return {
    balance: Number(data.balance) || 0,
    totalDeduct: Number(data.totalDeduct) || 0,
    totalInject: Number(data.totalInject) || 0,
    pendingInject: Number(data.pendingInject) || 0,
  }
}

/** 查询应急池流水分页。 */
export async function getEmergencyPoolLogs(page: number, pageSize: number): Promise<EmergencyPoolLogPageResult> {
  const response = await request.get<EmergencyPoolResponse<EmergencyPoolLogPageResult>>('/api/admin/profit/emergency-pool/logs', { params: { page, pageSize }, skipAuthRedirect: true })
  const data = unwrap(response, '应急池流水查询失败') || {} as EmergencyPoolLogPageResult
  const list = ((data.list || []) as EmergencyPoolLog[]).map((item) => ({ ...item, id: String(item.id ?? '') }))
  return { total: Number(data.total) || 0, list, page: Number(data.page) || page, pageSize: Number(data.pageSize) || pageSize }
}

/** 注入应急池（下次结算加入父奖池，仅超管）。 */
export async function injectEmergencyPool(amount: number): Promise<void> {
  const payload: EmergencyPoolInjectDTO = { amount }
  unwrap(await request.post<EmergencyPoolResponse<null>>('/api/admin/profit/emergency-pool/inject', payload, { skipAuthRedirect: true }), '应急池注入失败')
}
