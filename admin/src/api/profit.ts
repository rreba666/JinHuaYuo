import { request } from './request'
import type { AdminDividendSlot, BonusInjectDTO, DailyContributionUser, DividendContribution, DividendContributionPage, DividendRecordTestItem, DividendRecordTestResult, DividendSlotTestItem, DividendSlotTestResult, ProfitAdjustDailyDTO, ProfitAdjustPoolDTO, ProfitResponse, PromotionBinding, PromotionBindingPage, PromotionBindingQuery, PromotionPage, PendingPromotionRecord, SevenDayBonusDetail, SevenDayBonusPool, UserDividendLimit, WalletTestResult } from '@/types/profit'

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
  return { ...row, id: String(row.id ?? ''), poolId: String(row.poolId ?? ''), poolDate: String(row.poolDate ?? ''), dailyAmount: Number(row.dailyAmount ?? 0), dailyUserCount: Number(row.dailyUserCount ?? 0), cumulativeUserCount: row.cumulativeUserCount == null ? undefined : Number(row.cumulativeUserCount), settledFlag: row.settledFlag == null ? undefined : Number(row.settledFlag), settledAmount: row.settledAmount == null ? null : Number(row.settledAmount), settlementVersion: row.settlementVersion ? String(row.settlementVersion) : '', createTime: String(row.createTime ?? ''), updateTime: String(row.updateTime ?? '') }
}

function normalizeContribution(value: unknown): DividendContribution {
  const row = (value || {}) as Record<string, unknown>
  const user = (row.user || {}) as Record<string, unknown>
  return {
    id: String(row.id ?? row.contributionId ?? ''),
    orderNo: String(row.orderNo ?? row.orderNumber ?? ''),
    userId: String(row.userId ?? row.buyerUserId ?? user.id ?? ''),
    userName: String(row.userName ?? row.buyerName ?? row.nickname ?? user.nickname ?? ''),
    amount: Number(row.amount ?? row.contributionAmount ?? 0),
    paidAt: String(row.paidAt ?? row.paymentTime ?? row.payTime ?? ''),
    matureAt: String(row.maturityAt ?? row.expectedMatureTime ?? ''),
    status: String(row.status ?? ''),
    statusDesc: String(row.statusDesc ?? row.statusName ?? ''),
    confirmedAt: String(row.confirmedAt ?? row.confirmTime ?? ''),
    poolId: String(row.poolId ?? row.bonusPoolId ?? ''),
  }
}

function normalizeContributionPage(value: unknown, page: number, size: number): DividendContributionPage {
  const raw = (value || {}) as Record<string, unknown>
  const list = Array.isArray(raw.list) ? raw.list : []
  return {
    total: Number(raw.total ?? list.length) || 0,
    page: Number(raw.page ?? page) || page,
    pageSize: Number(raw.pageSize ?? raw.size ?? size) || size,
    list: list.map(normalizeContribution),
  }
}

function normalizeLimit(value: unknown): UserDividendLimit {
  const row = (value || {}) as Partial<UserDividendLimit>
  return { ...row, id: String(row.id ?? ''), userId: String(row.userId ?? ''), availablePurchase: Number(row.availablePurchase ?? 0), totalPurchases: Number(row.totalPurchases ?? 0), createTime: String(row.createTime ?? ''), updateTime: String(row.updateTime ?? '') }
}

function normalizeWalletTest(value: unknown): WalletTestResult {
  const row = (value || {}) as Partial<WalletTestResult>
  return {
    balance: Number(row.balance ?? 0),
    pendingPromotion: Number(row.pendingPromotion ?? 0),
    pendingBonus: Number(row.pendingBonus ?? 0),
    totalIncome: Number(row.totalIncome ?? 0),
  }
}

function normalizeSlotTest(value: unknown): DividendSlotTestResult {
  const row = (value || {}) as Partial<DividendSlotTestResult>
  const slots = Array.isArray(row.slots) ? row.slots : []
  return {
    availablePurchase: Number(row.availablePurchase ?? 0),
    totalPurchases: Number(row.totalPurchases ?? 0),
    slots: slots.map((item) => {
      const slot = (item || {}) as Partial<DividendSlotTestItem>
      return {
        id: String(slot.id ?? ''),
        productName: String(slot.productName ?? ''),
        productPrice: Number(slot.productPrice ?? 0),
        capAmount: Number(slot.capAmount ?? 0),
        totalReceived: Number(slot.totalReceived ?? 0),
        locked: Number(slot.locked ?? 0),
        lockedAt: String(slot.lockedAt ?? ''),
        createTime: String(slot.createTime ?? ''),
      }
    }),
  }
}

function normalizeRecordTest(value: unknown): DividendRecordTestResult {
  const row = (value || {}) as Partial<DividendRecordTestResult>
  const list = Array.isArray(row.list) ? row.list : []
  return {
    total: Number(row.total ?? list.length) || 0,
    page: Number(row.page ?? 1) || 1,
    pageSize: Number(row.pageSize ?? 20) || 20,
    list: list.map((item) => {
      const record = (item || {}) as Partial<DividendRecordTestItem>
      return {
        id: String(record.id ?? ''),
        productName: String(record.productName ?? ''),
        amount: Number(record.amount ?? 0),
        createTime: String(record.createTime ?? ''),
      }
    }),
  }
}

function getUserTestToken(token: string): string {
  const normalized = token.trim()
  if (!normalized) throw new Error('请输入 C 端用户 Token')
  return normalized
}

async function getUserTestData<T>(token: string, url: string, params?: Record<string, string | number>): Promise<T> {
  const response = await request.get<ProfitResponse<T>>(url, {
    params,
    headers: { Authorization: `Bearer ${getUserTestToken(token)}` },
    skipAuthRedirect: true,
  })
  return unwrap(response, 'C 端结果查询失败')
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
  const data = unwrap(await request.get<ProfitResponse<unknown>>('/api/admin/profit/pools'), '红包查询失败')
  return Array.isArray(data) ? data.map(normalizePool) : []
}

export async function getBonusDetails(poolId: string): Promise<SevenDayBonusDetail[]> {
  const data = unwrap(await request.get<ProfitResponse<unknown>>(`/api/admin/profit/detail/${poolId}`), '红包明细查询失败')
  return Array.isArray(data) ? data.map(normalizeDetail) : []
}

export async function getUnsettledDailyDetails(): Promise<SevenDayBonusDetail[]> {
  const data = unwrap(await request.get<ProfitResponse<unknown>>('/api/admin/profit/daily/unsettled'), '未结算红包查询失败')
  return Array.isArray(data) ? data.map(normalizeDetail) : []
}

export async function getSettledDailyDetails(): Promise<SevenDayBonusDetail[]> {
  const data = unwrap(await request.get<ProfitResponse<unknown>>('/api/admin/profit/daily/settled'), '已结算红包查询失败')
  return Array.isArray(data) ? data.map(normalizeDetail) : []
}

/** 后台「用户分红资格」槽位列表（GET /api/admin/profit/slots，按 userId 过滤，只读）。 */
export async function getAdminDividendSlots(userId?: string): Promise<AdminDividendSlot[]> {
  const data = unwrap(await request.get<ProfitResponse<unknown>>('/api/admin/profit/slots', { params: userId ? { userId } : {} }), '用户分红槽位查询失败')
  return Array.isArray(data) ? data.map(normalizeSlot) : []
}

/** 某支付日的累计用户贡献明细（GET /api/admin/profit/daily/users/{asOfDate}，pool_date<=asOfDate 去重贡献）。 */
export async function getDailyUsers(asOfDate: string): Promise<DailyContributionUser[]> {
  const data = unwrap(await request.get<ProfitResponse<unknown>>(`/api/admin/profit/daily/users/${encodeURIComponent(asOfDate)}`), '累计用户明细查询失败')
  return Array.isArray(data) ? data.map(normalizeDailyUser) : []
}

/** 归一化累计用户贡献：BIGINT 字段转字符串，金额落地。 */
function normalizeDailyUser(value: unknown): DailyContributionUser {
  const row = (value || {}) as Partial<DailyContributionUser>
  return {
    id: String(row.id ?? ''),
    orderId: String(row.orderId ?? ''),
    orderNo: String(row.orderNo ?? ''),
    userId: String(row.userId ?? ''),
    poolDate: String(row.poolDate ?? ''),
    amount: Number(row.amount ?? 0),
    emergencyAmount: row.emergencyAmount == null ? null : Number(row.emergencyAmount),
    status: String(row.status ?? ''),
    statusDesc: String(row.statusDesc ?? ''),
    poolId: String(row.poolId ?? ''),
  }
}

/** 归一化后台槽位：BIGINT 字段转字符串，数值字段落地。 */
function normalizeSlot(value: unknown): AdminDividendSlot {
  const row = (value || {}) as Partial<AdminDividendSlot>
  return {
    id: String(row.id ?? ''),
    userId: String(row.userId ?? ''),
    orderId: String(row.orderId ?? ''),
    orderNo: String(row.orderNo ?? ''),
    productId: String(row.productId ?? ''),
    productName: String(row.productName ?? ''),
    productPrice: Number(row.productPrice ?? 0),
    capAmount: Number(row.capAmount ?? 0),
    totalReceived: Number(row.totalReceived ?? 0),
    locked: Number(row.locked ?? 0),
    invalidFlag: Number(row.invalidFlag ?? 0),
    invalidReason: row.invalidReason == null ? null : String(row.invalidReason),
    lockedAt: row.lockedAt == null ? null : String(row.lockedAt),
  }
}

export async function getProfitContributions(query: { status?: string; page: number; size: number }): Promise<DividendContributionPage> {
  return normalizeContributionPage(unwrap(await request.get<ProfitResponse<unknown>>('/api/admin/profit/contributions', { params: query }), '红包贡献查询失败'), query.page, query.size)
}

export async function getDividendLimits(): Promise<UserDividendLimit[]> {
  const data = unwrap(await request.get<ProfitResponse<unknown>>('/api/admin/profit/limits'), '用户红包额度查询失败')
  return Array.isArray(data) ? data.map(normalizeLimit) : []
}

export async function injectBonusPool(payload: BonusInjectDTO): Promise<void> {
  const amount = Number(payload.amount)
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('注入金额必须大于 0')
  unwrap(await request.post<ProfitResponse<null>>('/api/admin/profit/inject', { ...payload, amount }), '红包注入失败')
}

export async function settleProfit(startDate: string, endDate: string): Promise<void> { unwrap(await request.post<ProfitResponse<null>>('/api/admin/profit/settle', null, { params: { startDate, endDate } }), '红包结算失败') }
export async function confirmPool(poolId: string): Promise<void> { unwrap(await request.post<ProfitResponse<null>>(`/api/admin/profit/pool/${poolId}/confirm`), '红包确认失败') }
export async function adjustPool(poolId: string, payload: ProfitAdjustPoolDTO): Promise<void> { unwrap(await request.put<ProfitResponse<null>>(`/api/admin/profit/pool/${poolId}/adjust`, payload), '红包调整失败') }
export async function adjustDaily(detailId: string, payload: ProfitAdjustDailyDTO): Promise<void> { unwrap(await request.put<ProfitResponse<null>>(`/api/admin/profit/daily/${detailId}/adjust`, payload), '每日红包调整失败') }

export async function getWalletTestResult(token: string): Promise<WalletTestResult> {
  return normalizeWalletTest(await getUserTestData<unknown>(token, '/api/wallet/info'))
}

export async function getDividendSlotTestResult(token: string): Promise<DividendSlotTestResult> {
  return normalizeSlotTest(await getUserTestData<unknown>(token, '/api/wallet/dividend-slots'))
}

export async function getDividendRecordTestResult(token: string): Promise<DividendRecordTestResult> {
  return normalizeRecordTest(await getUserTestData<unknown>(token, '/api/wallet/dividend-records', { page: 1, pageSize: 20 }))
}
