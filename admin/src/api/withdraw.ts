import { request } from './request'
import type {
  WithdrawPage,
  WithdrawRecord,
  WithdrawRecordPage,
  WithdrawRecordQuery,
  WithdrawResponse,
  Withdrawal,
} from '@/types/withdraw'

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
    // 审核/打款需要的信息（后端 AdminWithdrawVO 已返回；银行卡提现必须有卡号，财务才能人工转账）
    maskedName: row.maskedName ?? null,
    maskedCertNo: row.maskedCertNo ?? null,
    phone: String(row.phone ?? ''),
    realnameSnapshot: row.realnameSnapshot ?? null,
    bankCardSnapshot: row.bankCardSnapshot ?? null,
    wxTransferBillNo: row.wxTransferBillNo ?? null,
    reviewedBy: row.reviewedBy ?? null,
    reviewedAt: row.reviewedAt ?? null,
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

// ===== 提现交易记录（B 端全量提现单，对账用） =====

/** 归一化提现交易记录（字段与待审核/异常列表同源，复用同一套归一化）。 */
function normalizeWithdrawRecord(value: unknown): WithdrawRecord {
  return normalizeWithdrawal(value)
}

/**
 * 查询**全量提现交易记录**（`GET /api/admin/withdraw/records`，按申请时间倒序）。
 * 覆盖所有状态，支持状态（逗号分隔多值）/类型/收款方式/用户ID/提现单号/手机号/申请时间区间筛选；
 * `total` 与筛选条件完全一致（可直接用于对账核对条数）。
 */
export async function getWithdrawRecords(params: WithdrawRecordQuery): Promise<WithdrawRecordPage> {
  const query: Record<string, string | number> = { page: params.page, size: params.size }
  if (params.status) query.status = params.status
  if (params.type) query.type = params.type
  if (params.withdrawMethod) query.withdrawMethod = params.withdrawMethod
  if (params.userId) query.userId = params.userId
  if (params.withdrawNo) query.withdrawNo = params.withdrawNo
  if (params.phone) query.phone = params.phone
  if (params.startTime) query.startTime = params.startTime
  if (params.endTime) query.endTime = params.endTime
  const data = unwrap(await request.get<WithdrawResponse<unknown>>('/api/admin/withdraw/records', { params: query }), '提现交易记录查询失败')
  const raw = (data || {}) as Record<string, unknown>
  const list = Array.isArray(raw.list) ? raw.list : []
  return {
    total: Number(raw.total ?? list.length) || 0,
    page: Number(raw.page ?? params.page) || params.page,
    pageSize: Number(raw.pageSize ?? params.size) || params.size,
    list: list.map(normalizeWithdrawRecord),
  }
}
