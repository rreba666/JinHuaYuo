import { request } from './request'
import type {
  RefundRestockGap,
  RefundRestockGapPage,
  RefundRestockGapQuery,
  StockLedger,
  StockLedgerDetail,
  StockLedgerQuery,
  StockLedgerSummaryItem,
} from '@/types/stock'

/**
 * 库存对账接口层（今华有肽后台）。
 *
 * 对应后端 2026-09-16 新增的两个**只读**接口（不会修改任何数据）：
 * - `GET /api/admin/stock/ledger`
 * - `GET /api/admin/stock/refund-restock-gaps`
 *
 * 统一返回 `{ code, message, data, traceId }`，HTTP 恒为 200，业务失败看 `code`（参数错 1000）。
 */

interface StockResponse<T> {
  code: number
  message: string
  data?: T | null
  success?: boolean
}

/** 统一拆包并校验业务码。 */
function unwrap<T>(response: { data: StockResponse<T> }, fallback: string): T {
  const result = response.data
  if (result.code !== 0 || result.success === false) throw new Error(result.message || fallback)
  return result.data as T
}

/** 数字归一化（后端可能返回字符串数字或 null）。 */
function toNumber(value: unknown, fallback = 0): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

/** 可空数字：null / 非法 → null。 */
function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

/** 可空字符串：null / undefined → null。 */
function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const text = String(value)
  return text === '' ? null : text
}

/** 归一化单条变动明细（int64 主键统一转字符串，避免精度丢失）。 */
function normalizeDetail(value: unknown): StockLedgerDetail {
  const row = (value || {}) as Record<string, unknown>
  return {
    createTime: String(row.createTime ?? ''),
    changeType: String(row.changeType ?? ''),
    changeTypeName: String(row.changeTypeName ?? ''),
    changeQty: toNumber(row.changeQty),
    lockedChangeQty: toNumber(row.lockedChangeQty),
    stockBefore: toNumber(row.stockBefore),
    stockAfter: toNumber(row.stockAfter),
    lockedBefore: toNumber(row.lockedBefore),
    lockedAfter: toNumber(row.lockedAfter),
    bizType: String(row.bizType ?? ''),
    bizNo: toNullableString(row.bizNo),
    operatorType: String(row.operatorType ?? ''),
    operatorId: row.operatorId === null || row.operatorId === undefined ? null : String(row.operatorId),
    reason: String(row.reason ?? ''),
    remark: String(row.remark ?? ''),
  }
}

/** 归一化按来源汇总项。 */
function normalizeSummary(value: unknown): StockLedgerSummaryItem {
  const row = (value || {}) as Record<string, unknown>
  return {
    changeType: String(row.changeType ?? ''),
    changeTypeName: String(row.changeTypeName ?? ''),
    count: toNumber(row.count),
    totalChangeQty: toNumber(row.totalChangeQty),
    totalLockedChangeQty: toNumber(row.totalLockedChangeQty),
  }
}

/** 归一化库存台账（含断言字段与明细分页）。 */
function normalizeLedger(value: unknown, query: StockLedgerQuery): StockLedger {
  const row = (value || {}) as Record<string, unknown>
  const details = (row.details || {}) as Record<string, unknown>
  const list = Array.isArray(details.list) ? details.list : []
  const summary = Array.isArray(row.summary) ? row.summary : []
  return {
    skuId: String(row.skuId ?? query.skuId ?? ''),
    productId: row.productId === null || row.productId === undefined ? null : String(row.productId),
    resolvedFromProduct: Boolean(row.resolvedFromProduct),
    productName: toNullableString(row.productName),
    startTime: toNullableString(row.startTime),
    endTime: toNullableString(row.endTime),
    openingStock: toNullableNumber(row.openingStock),
    openingTime: toNullableString(row.openingTime),
    openingUnavailable: Boolean(row.openingUnavailable),
    openingSource: toNullableString(row.openingSource),
    openingNote: toNullableString(row.openingNote),
    // 以下 5 个字段后端在「无流水 / SKU 已软删」时返回 null，必须保持 null（转 0 会把"查不到"伪装成"库存为 0"）
    closingStock: toNullableNumber(row.closingStock),
    closingLockedStock: toNullableNumber(row.closingLockedStock),
    closingTime: toNullableString(row.closingTime),
    currentStock: toNullableNumber(row.currentStock),
    lockedStock: toNullableNumber(row.lockedStock),
    currentStockAvailable: row.currentStockAvailable === undefined ? true : Boolean(row.currentStockAvailable),
    diff: toNullableNumber(row.diff),
    consistent: row.consistent === null || row.consistent === undefined ? null : Boolean(row.consistent),
    totalChangeQty: toNumber(row.totalChangeQty),
    expectedClosing: toNullableNumber(row.expectedClosing),
    assertionPassed: row.assertionPassed === null || row.assertionPassed === undefined ? null : Boolean(row.assertionPassed),
    assertionNote: toNullableString(row.assertionNote),
    rangeClosingStock: toNullableNumber(row.rangeClosingStock),
    rangeClosingTime: toNullableString(row.rangeClosingTime),
    summary: summary.map(normalizeSummary),
    summaryComplete: row.summaryComplete === undefined ? true : Boolean(row.summaryComplete),
    details: {
      total: toNumber(details.total, list.length),
      page: toNumber(details.page, query.page),
      pageSize: toNumber(details.pageSize, query.size),
      list: list.map(normalizeDetail),
    },
  }
}

/** 归一化应补未补行。 */
function normalizeGap(value: unknown): RefundRestockGap {
  const row = (value || {}) as Record<string, unknown>
  return {
    afterSaleNo: String(row.afterSaleNo ?? ''),
    orderNo: String(row.orderNo ?? ''),
    afterSaleType: toNumber(row.afterSaleType),
    afterSaleTypeName: String(row.afterSaleTypeName ?? ''),
    refundAmount: toNumber(row.refundAmount),
    refundNo: String(row.refundNo ?? ''),
    refundTime: String(row.refundTime ?? ''),
    pickupType: toNumber(row.pickupType),
    goodsLeftShop: Boolean(row.goodsLeftShop),
    shipTime: toNullableString(row.shipTime),
    pickupTime: toNullableString(row.pickupTime),
    skuId: String(row.skuId ?? ''),
    productName: String(row.productName ?? ''),
    quantity: toNumber(row.quantity),
    refundRestockRows: toNumber(row.refundRestockRows),
    returnRestockRows: toNumber(row.returnRestockRows),
    needRestock: Boolean(row.needRestock),
  }
}

/**
 * 库存台账（只读）：某 SKU 一段时间的库存变动明细、按来源汇总，以及期初/期末自动断言。
 * `page`/`size` 只影响 `details`，`summary` 始终是整区间聚合。
 */
export async function getStockLedger(query: StockLedgerQuery): Promise<StockLedger> {
  const params: Record<string, string | number> = { page: query.page, size: query.size }
  // skuId / productId 二选一（至少一个）：同时传时后端以 skuId 为准，且不校验两者是否匹配
  if (query.skuId) params.skuId = query.skuId
  if (query.productId) params.productId = query.productId
  if (query.startTime) params.startTime = query.startTime
  if (query.endTime) params.endTime = query.endTime
  const data = unwrap(await request.get<StockResponse<unknown>>('/api/admin/stock/ledger', { params }), '库存台账查询失败')
  return normalizeLedger(data, query)
}

/**
 * 退款应补未补核对（只读）：已退款但库存未回补的订单项。
 * 默认只返回"真问题"（已退款 + 货未离店 + 无回补流水）；`includeNonActionable=true` 时口径放宽。
 */
export async function getRefundRestockGaps(query: RefundRestockGapQuery): Promise<RefundRestockGapPage> {
  const params: Record<string, string | number | boolean> = { page: query.page, size: query.size }
  if (query.startTime) params.startTime = query.startTime
  // ⚠️ 刻意不传 endTime：该接口（文档 §3.1 与 api-docs）没有这个参数，传了会被后端忽略，
  // 却会让调用方以为"已按区间筛选"。后端补上 endTime 后再启用。
  if (query.includeNonActionable) params.includeNonActionable = true
  const data = unwrap(await request.get<StockResponse<unknown>>('/api/admin/stock/refund-restock-gaps', { params }), '退款应补未补核对失败')
  const raw = (data || {}) as Record<string, unknown>
  const list = Array.isArray(raw.list) ? raw.list : []
  return {
    total: toNumber(raw.total, list.length),
    page: toNumber(raw.page, query.page),
    pageSize: toNumber(raw.pageSize, query.size),
    list: list.map(normalizeGap),
  }
}
