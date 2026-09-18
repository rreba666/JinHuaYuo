import { request } from './request'
import type { ApiResponse } from './request'
import type {
  PeptideAccount,
  PeptideAccountQuery,
  PeptideAdjustDTO,
  PeptideAdjustResult,
  PeptideGrantConfig,
  PeptideLog,
  PeptideLogQuery,
  PeptidePage,
  PeptideSummary,
} from '@/types/peptide'

/**
 * 肽金券模块（B 端）接口层。
 *
 * 接口来源：api-docs.json 的 `peptide` 模块（中文 tag「肽金券模块（B端）」）。
 * - GET  /api/admin/peptide/summary   总览（超管 / 财务）
 * - GET  /api/admin/peptide/accounts  账户列表（超管 / 财务）
 * - GET  /api/admin/peptide/logs      全平台流水（超管 / 财务）
 * - POST /api/admin/peptide/adjust    人工调整（**仅超级管理员**）
 * - POST /api/admin/setting/{configKey} 发放配置写入（通用配置接口）
 */

/**
 * 肽金发放配置的专用接口路径（2026-09-18 后端新增）。
 * 一次读写「启用开关 / 每单金额 / 生效起始成交日」三项：
 * - 写入是**原子**的（任一校验失败则一个键都不落库），优于逐个键走通用接口；
 * - 读取会额外返回 `started`（生效日是否已到），便于提示「已保存但未生效」；
 * - 鉴权：`/api/admin/setting/**` **仅超级管理员**。
 */
const PEPTIDE_GRANT_PATH = '/api/admin/setting/dividend-peptide'

/** 生效起始成交日的格式（后端有格式校验，非法值会被直接拒绝）。 */
const START_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * 肽金券业务错误：额外保留后端业务码，便于页面区分可读场景
 * （例如 `code=7100` = 回收时余额不足、`code=1000` = 参数非法）。
 */
export class PeptideApiError extends Error {
  /** 后端业务码（网络层失败时为 -1）。 */
  readonly code: number

  constructor(code: number, message: string) {
    super(message)
    this.name = 'PeptideApiError'
    this.code = code
  }
}

/** 校验响应并返回业务数据；业务失败时抛出带 code 的 PeptideApiError。 */
function unwrap<T>(response: { data: ApiResponse<T> }, fallback: string): T {
  const result = response.data
  if (result.code !== 0 || result.success === false) {
    throw new PeptideApiError(Number(result.code ?? -1), result.message || fallback)
  }
  return result.data as T
}

/** 数值兜底：非有限值按 0 处理，避免表格渲染 undefined/NaN。 */
function toNumber(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

/** BIGINT 标识兜底：统一转字符串，null/undefined 转空串。 */
function toId(value: unknown): string {
  return value == null ? '' : String(value)
}

/** 归一化总览：字段缺失时按 0/false/空串兜底。 */
function normalizeSummary(value: unknown): PeptideSummary {
  const row = (value || {}) as Partial<PeptideSummary>
  return {
    accountCount: toNumber(row.accountCount),
    balanceSum: toNumber(row.balanceSum),
    earnedSum: toNumber(row.earnedSum),
    usedSum: toNumber(row.usedSum),
    perOrderAmount: toNumber(row.perOrderAmount),
    // 只有明确 true 才视为启用，避免后端返回字符串 'true' 之外的脏值误判
    enabled: row.enabled === true,
    startDate: String(row.startDate ?? ''),
  }
}

/** 归一化账户行：ID 转字符串，金额字段落地。 */
function normalizeAccount(value: unknown): PeptideAccount {
  const row = (value || {}) as Partial<PeptideAccount>
  return {
    id: toId(row.id),
    userId: toId(row.userId),
    nickname: String(row.nickname ?? ''),
    phone: String(row.phone ?? ''),
    balance: toNumber(row.balance),
    totalEarned: toNumber(row.totalEarned),
    totalUsed: toNumber(row.totalUsed),
    updateTime: String(row.updateTime ?? ''),
    createTime: String(row.createTime ?? ''),
  }
}

/** 归一化流水行：金额恒为正数（增减只看 direction），关联单号/备注缺失时按空串兜底。 */
function normalizeLog(value: unknown): PeptideLog {
  const row = (value || {}) as Partial<PeptideLog>
  return {
    id: toId(row.id),
    userId: toId(row.userId),
    type: String(row.type ?? ''),
    typeText: String(row.typeText ?? ''),
    amount: Math.abs(toNumber(row.amount)),
    direction: row.direction === 'OUT' ? 'OUT' : 'IN',
    balanceAfter: toNumber(row.balanceAfter),
    orderId: toId(row.orderId),
    orderNo: String(row.orderNo ?? ''),
    sourceOrderNo: String(row.sourceOrderNo ?? ''),
    remark: String(row.remark ?? ''),
    createTime: String(row.createTime ?? ''),
  }
}

/** 归一化分页结构：list 缺失按空列表兜底，total 缺失按列表长度兜底。 */
function normalizePage<T>(value: unknown, page: number, pageSize: number, mapRow: (row: unknown) => T): PeptidePage<T> {
  const raw = (value || {}) as Record<string, unknown>
  const list = Array.isArray(raw.list) ? raw.list : []
  return {
    total: toNumber(raw.total ?? list.length),
    page: toNumber(raw.page ?? page) || page,
    pageSize: toNumber(raw.pageSize ?? pageSize) || pageSize,
    list: list.map(mapRow),
  }
}

/**
 * 查询肽金券总览（GET /api/admin/peptide/summary）。
 * `balanceSum` 即平台待履约负债，`earnedSum`/`usedSum` 为累计口径。
 */
export async function getPeptideSummary(): Promise<PeptideSummary> {
  const data = unwrap(await request.get<ApiResponse<unknown>>('/api/admin/peptide/summary'), '肽金券总览查询失败')
  return normalizeSummary(data)
}

/** 查询肽金券账户列表（GET /api/admin/peptide/accounts，按余额倒序、支持 userId 精确筛选）。 */
export async function getPeptideAccounts(query: PeptideAccountQuery): Promise<PeptidePage<PeptideAccount>> {
  const params: Record<string, string | number> = { page: query.page, pageSize: query.pageSize }
  if (query.userId) params.userId = query.userId
  const data = unwrap(await request.get<ApiResponse<unknown>>('/api/admin/peptide/accounts', { params }), '肽金券账户查询失败')
  return normalizePage(data, query.page, query.pageSize, normalizeAccount)
}

/** 查询全平台肽金券流水（GET /api/admin/peptide/logs，时间倒序、支持 userId/type/orderNo 组合筛选）。 */
export async function getPeptideLogs(query: PeptideLogQuery): Promise<PeptidePage<PeptideLog>> {
  const params: Record<string, string | number> = { page: query.page, pageSize: query.pageSize }
  if (query.userId) params.userId = query.userId
  if (query.type) params.type = query.type
  if (query.orderNo) params.orderNo = query.orderNo
  const data = unwrap(await request.get<ApiResponse<unknown>>('/api/admin/peptide/logs', { params }), '肽金券流水查询失败')
  return normalizePage(data, query.page, query.pageSize, normalizeLog)
}

/**
 * 人工调整肽金券（POST /api/admin/peptide/adjust，**仅超级管理员**）。
 * `amount` 为带符号金额：正数=赠送、负数=回收，不可为 0；回收时余额不足后端返回 `code=7100`。
 * 账户不存在时后端会自动创建后再调整，因此这里不做「账户必须存在」的前置校验。
 */
export async function adjustPeptide(payload: PeptideAdjustDTO): Promise<PeptideAdjustResult> {
  const amount = Number(payload.amount)
  const userId = String(payload.userId || '').trim()
  const remark = String(payload.remark || '').trim()
  // 前端先做一次参数校验，避免无效请求（后端对应 code=1000）
  if (!/^[1-9]\d*$/.test(userId)) throw new PeptideApiError(1000, '用户 ID 必须为正整数')
  if (!Number.isFinite(amount) || amount === 0) throw new PeptideApiError(1000, '调整金额不能为 0（正数=赠送，负数=回收）')
  if (!remark) throw new PeptideApiError(1000, '请填写调整原因')
  const data = unwrap(
    await request.post<ApiResponse<unknown>>('/api/admin/peptide/adjust', { userId, amount: Number(amount.toFixed(2)), remark }),
    '肽金券人工调整失败',
  )
  const row = (data || {}) as Partial<PeptideAdjustResult>
  return { userId: toId(row.userId ?? userId), amount: toNumber(row.amount ?? amount), balance: toNumber(row.balance) }
}

/** 判断字符串是否为真实存在的日期（拦截 2026-02-31 这类格式合法但日期非法的值）。 */
function isRealDate(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

/**
 * 读取肽金发放配置（GET /api/admin/setting/dividend-peptide）。
 * 返回启用开关 / 每单金额 / 生效起始成交日，以及 `started`（生效日是否已到）。
 */
export async function getPeptideGrantConfig(): Promise<PeptideGrantConfig> {
  const data = unwrap(await request.get<ApiResponse<unknown>>(PEPTIDE_GRANT_PATH), '肽金发放配置查询失败')
  const row = (data || {}) as Record<string, unknown>
  return {
    enabled: row.enabled === true,
    amount: toNumber(row.amount),
    startDate: String(row.startDate ?? ''),
    started: row.started === true,
  }
}

/**
 * 保存肽金发放配置（POST /api/admin/setting/dividend-peptide，**一次提交三项且原子**）。
 * 前端先做一次校验（金额 > 0 且最多 2 位小数、生效日为真实日期），避免无效请求；
 * 后端校验失败返回 `code=1000` 且**一个键都不落库**（不会出现「开关改了、金额没改」的半成品状态）。
 */
export async function savePeptideGrantConfig(payload: PeptideGrantConfig): Promise<void> {
  const amount = Number(payload.amount)
  const startDate = String(payload.startDate || '').trim()
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('每单肽金券金额必须大于 0')
  }
  // 后端要求最多 2 位小数：比较「取整到分」的差值，避免浮点误差误判
  if (Math.abs(Math.round(amount * 100) - amount * 100) > 1e-6) {
    throw new Error('每单肽金券金额最多 2 位小数')
  }
  if (!START_DATE_PATTERN.test(startDate) || !isRealDate(startDate)) {
    throw new Error('生效起始成交日必须为 yyyy-MM-dd 格式的真实日期')
  }
  unwrap(
    await request.post<ApiResponse<null>>(PEPTIDE_GRANT_PATH, {
      enabled: payload.enabled,
      amount: Number(amount.toFixed(2)),
      startDate,
      remark: '肽金券管理页保存',
    }),
    '肽金发放配置保存失败',
  )
}
