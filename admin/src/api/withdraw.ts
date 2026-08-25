import { request } from './request'
import type { WithdrawPage, WithdrawResponse, Withdrawal } from '@/types/withdraw'

function unwrap<T>(response: { data: WithdrawResponse<T> }, fallback: string): T {
  const result = response.data
  if (result.code !== 0 || result.success === false) throw new Error(result.message || fallback)
  return result.data as T
}

function normalizeWithdrawal(value: unknown): Withdrawal {
  const row = (value || {}) as Partial<Withdrawal>
  const withdrawMethod = String(row.withdrawMethod ?? '')
  return {
    ...row,
    id: String(row.id ?? ''),
    withdrawNo: String(row.withdrawNo ?? ''),
    userId: String(row.userId ?? ''),
    type: String(row.type ?? ''),
    withdrawMethod,
    typeDesc: String(row.typeDesc ?? ''),
    withdrawMethodDesc: String(row.withdrawMethodDesc ?? (withdrawMethod === 'BANK_CARD' ? '银行卡' : withdrawMethod === 'WECHAT_BALANCE' ? '微信零钱' : '')),
    amount: Number(row.amount ?? 0),
    feeAmount: Number(row.feeAmount ?? 0),
    netAmount: Number(row.netAmount ?? 0),
    status: String(row.status ?? ''),
    statusDesc: String(row.statusDesc ?? ''),
    createdAt: String(row.createdAt ?? ''),
    finishedAt: String(row.finishedAt ?? ''),
    failReason: String(row.failReason ?? ''),
  }
}

function normalizePage(value: unknown, page: number, pageSize: number): WithdrawPage {
  const raw = (value || {}) as Record<string, unknown>
  const list = Array.isArray(raw.list) ? raw.list : []
  return { total: Number(raw.total ?? list.length) || 0, page: Number(raw.page ?? page) || page, pageSize: Number(raw.pageSize ?? pageSize) || pageSize, list: list.map(normalizeWithdrawal) }
}

async function getList(path: string, params: { page: number; size: number }): Promise<WithdrawPage> { return normalizePage(unwrap(await request.get<WithdrawResponse<unknown>>(path, { params }), '提现列表查询失败'), params.page, params.size) }
export async function getPendingWithdrawals(params: { page: number; size: number }): Promise<WithdrawPage> { return getList('/api/admin/withdraw/pending', params) }
export async function getStuckWithdrawals(params: { page: number; size: number }): Promise<WithdrawPage> { return getList('/api/admin/withdraw/stuck', params) }
export async function approveWithdrawal(withdrawNo: string): Promise<void> { unwrap(await request.post<WithdrawResponse<null>>(`/api/admin/withdraw/approve/${withdrawNo}`), '提现审核通过失败') }
export async function rejectWithdrawal(withdrawNo: string, reason: string): Promise<void> { unwrap(await request.post<WithdrawResponse<null>>(`/api/admin/withdraw/reject/${withdrawNo}`, null, { params: { reason } }), '提现拒绝失败') }
export async function retryWithdrawal(withdrawNo: string): Promise<void> { unwrap(await request.post<WithdrawResponse<null>>(`/api/admin/withdraw/retry/${withdrawNo}`), '提现结果重试失败') }
export async function manualSuccessWithdrawal(withdrawNo: string): Promise<void> { unwrap(await request.post<WithdrawResponse<null>>(`/api/admin/withdraw/manual-success/${withdrawNo}`), '手动确认成功失败') }
export async function manualFailWithdrawal(withdrawNo: string, reason: string): Promise<void> { unwrap(await request.post<WithdrawResponse<null>>(`/api/admin/withdraw/manual-fail/${withdrawNo}`, null, { params: { reason } }), '手动确认失败') }
