import { request } from './request'
import type { ProfitAdjustDailyDTO, ProfitAdjustPoolDTO, ProfitResponse, PromotionBinding, PromotionBindingPage, PromotionBindingQuery, PromotionPage, PendingPromotionRecord, SevenDayBonusDetail, SevenDayBonusPool, UserDividendLimit } from '@/types/profit'

function unwrap<T>(response: { data: ProfitResponse<T> }, fallback: string): T {
  const result = response.data
  if (result.code !== 0 || result.success === false) throw new Error(result.message || fallback)
  return result.data as T
}

function normalizePendingRecord(value: unknown): PendingPromotionRecord {
  const row = (value || {}) as Partial<PendingPromotionRecord>
  return { ...row, id: String(row.id ?? ''), orderId: String(row.orderId ?? ''), orderNo: String(row.orderNo ?? ''), promoterUserId: String(row.promoterUserId ?? ''), buyerUserId: String(row.buyerUserId ?? ''), amount: Number(row.amount ?? 0), status: String(row.status ?? ''), confirmedBy: String(row.confirmedBy ?? ''), confirmedAt: String(row.confirmedAt ?? ''), remark: String(row.remark ?? ''), createdAt: String(row.createdAt ?? ''), updateTime: String(row.updateTime ?? '') }
}

function normalizeBinding(value: unknown): PromotionBinding {
  const row = (value || {}) as Partial<PromotionBinding>
  const source = row.source === 'SCAN' || row.source === 'MANUAL' ? row.source : 'UNKNOWN'
  return { ...row, buyerUserId: String(row.buyerUserId ?? ''), buyerName: String(row.buyerName ?? ''), buyerAvatar: String(row.buyerAvatar ?? ''), promoterUserId: String(row.promoterUserId ?? ''), promoterName: String(row.promoterName ?? ''), promoterAvatar: String(row.promoterAvatar ?? ''), bindTime: String(row.bindTime ?? ''), source, sourceDesc: String(row.sourceDesc ?? ''), status: 'BOUND', statusDesc: String(row.statusDesc ?? '') }
}

function normalizePage(value: unknown, page: number, pageSize: number): PromotionPage {
  const raw = (value || {}) as Record<string, unknown>
  const list = Array.isArray(raw.list) ? raw.list : []
  return { total: Number(raw.total ?? list.length) || 0, page: Number(raw.page ?? page) || page, pageSize: Number(raw.pageSize ?? pageSize) || pageSize, list: list.map(normalizePendingRecord) }
}

function normalizeBindingPage(value: unknown, page: number, pageSize: number): PromotionBindingPage {
  const raw = (value || {}) as Record<string, unknown>
  const list = Array.isArray(raw.list) ? raw.list : []
  return { total: Number(raw.total ?? list.length) || 0, page: Number(raw.page ?? page) || page, pageSize: Number(raw.pageSize ?? pageSize) || pageSize, list: list.map(normalizeBinding) }
}

function normalizePool(value: unknown): SevenDayBonusPool {
  const row = (value || {}) as Partial<SevenDayBonusPool>
  return { ...row, id: String(row.id ?? ''), totalAmount: Number(row.totalAmount ?? 0), settledUserCount: Number(row.settledUserCount ?? 0), startDate: String(row.startDate ?? ''), endDate: String(row.endDate ?? ''), settleTime: String(row.settleTime ?? ''), createTime: String(row.createTime ?? ''), updateTime: String(row.updateTime ?? '') }
}

function normalizeDetail(value: unknown): SevenDayBonusDetail {
  const row = (value || {}) as Partial<SevenDayBonusDetail>
  return { ...row, id: String(row.id ?? ''), poolId: String(row.poolId ?? ''), poolDate: String(row.poolDate ?? ''), dailyAmount: Number(row.dailyAmount ?? 0), dailyUserCount: Number(row.dailyUserCount ?? 0), createTime: String(row.createTime ?? ''), updateTime: String(row.updateTime ?? '') }
}

function normalizeLimit(value: unknown): UserDividendLimit {
  const row = (value || {}) as Partial<UserDividendLimit>
  return { ...row, id: String(row.id ?? ''), userId: String(row.userId ?? ''), productPrice: Number(row.productPrice ?? 0), capAmount: Number(row.capAmount ?? 0), totalReceived: Number(row.totalReceived ?? 0), milestoneHit: Number(row.milestoneHit ?? 0), blocked: Number(row.blocked ?? 0), purchaseLimit: Number(row.purchaseLimit ?? 0), totalPurchases: Number(row.totalPurchases ?? 0), unlockCount: Number(row.unlockCount ?? 0), createTime: String(row.createTime ?? ''), updateTime: String(row.updateTime ?? '') }
}

const relationDetailPath = '/api/admin/profit/relations/{buyerUserId}'
function getRelationDetailPath(buyerUserId: string): string { return relationDetailPath.replace('{buyerUserId}', buyerUserId) }

export async function getPendingPromotion(params: { page: number; size: number }): Promise<PromotionPage> {
  return normalizePage(unwrap(await request.get<ProfitResponse<unknown>>('/api/admin/profit/pending', { params }), '待确认推广金查询失败'), params.page, params.size)
}

export async function getPromotionRelations(query: PromotionBindingQuery): Promise<PromotionBindingPage> {
  return normalizeBindingPage(unwrap(await request.get<ProfitResponse<unknown>>('/api/admin/profit/relations', { params: query }), '推广关系查询失败'), query.page, query.size)
}

export async function rebindPromotionRelation(buyerUserId: string, promoterId: string): Promise<void> {
  unwrap(await request.put<ProfitResponse<null>>(getRelationDetailPath(buyerUserId), null, { params: { promoterId } }), '推广关系重绑失败')
}

export async function unbindPromotionRelation(buyerUserId: string): Promise<void> {
  unwrap(await request.delete<ProfitResponse<null>>(getRelationDetailPath(buyerUserId)), '推广关系解绑失败')
}

export async function getBonusPools(): Promise<SevenDayBonusPool[]> {
  const data = unwrap(await request.get<ProfitResponse<unknown>>('/api/admin/profit/pools'), '奖池查询失败')
  return Array.isArray(data) ? data.map(normalizePool) : []
}

export async function getBonusDetails(poolId: string): Promise<SevenDayBonusDetail[]> {
  const data = unwrap(await request.get<ProfitResponse<unknown>>(`/api/admin/profit/detail/${poolId}`), '奖池明细查询失败')
  return Array.isArray(data) ? data.map(normalizeDetail) : []
}

export async function getUnsettledDailyDetails(): Promise<SevenDayBonusDetail[]> {
  const data = unwrap(await request.get<ProfitResponse<unknown>>('/api/admin/profit/daily/unsettled'), '未结算奖池查询失败')
  return Array.isArray(data) ? data.map(normalizeDetail) : []
}

export async function getDividendLimits(): Promise<UserDividendLimit[]> {
  const data = unwrap(await request.get<ProfitResponse<unknown>>('/api/admin/profit/limits'), '用户分红额度查询失败')
  return Array.isArray(data) ? data.map(normalizeLimit) : []
}

export async function settleProfit(startDate: string, endDate: string): Promise<void> { unwrap(await request.post<ProfitResponse<null>>('/api/admin/profit/settle', null, { params: { startDate, endDate } }), '奖池结算失败') }
export async function confirmPool(poolId: string): Promise<void> { unwrap(await request.post<ProfitResponse<null>>(`/api/admin/profit/pool/${poolId}/confirm`), '奖池确认失败') }
export async function adjustPool(poolId: string, payload: ProfitAdjustPoolDTO): Promise<void> { unwrap(await request.put<ProfitResponse<null>>(`/api/admin/profit/pool/${poolId}/adjust`, payload), '奖池调整失败') }
export async function adjustDaily(detailId: string, payload: ProfitAdjustDailyDTO): Promise<void> { unwrap(await request.put<ProfitResponse<null>>(`/api/admin/profit/daily/${detailId}/adjust`, payload), '每日奖池调整失败') }
export async function resetDividendLimit(userId: string): Promise<void> { unwrap(await request.put<ProfitResponse<null>>(`/api/admin/profit/limit/${userId}/reset`), '分红额度重置失败') }
