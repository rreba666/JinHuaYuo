import { request } from './request'
import type { ProfitResponse } from '@/types/profit'
import type {
  OfflineRefundCommitDTO,
  OfflineRefundContribution,
  OfflineRefundMoney,
  OfflineRefundPlanRow,
  OfflineRefundPreviewVO,
  OfflineRefundReconcile,
} from '@/types/offlineRefund'

/**
 * 自提订单「线下退款冲账」接口（B 端）。
 *
 * ⚠️ **契约来源**：`docs/B端-自提线下退款冲账-接口方案与风险说明-20260921.md`（2026-09-21）。
 * ⚠️ **api-docs 未同步**：`api-docs.json` 里 `grep offline-refund` 零命中，后端补 OpenAPI 后需复核字段名。
 *
 * 权限：`/api/admin/profit/**` → 超管（SUPER_ADMIN）/ 财务（FINANCE），未授权 403。
 * 写法与 `src/api/profit.ts` 保持一致（同一个 `request` 封装、同一套 `unwrap` 错误处理）。
 */

/** 与 profit.ts 同款解包：业务码非 0 或 success=false 时抛后端 message。 */
function unwrap<T>(response: { data: ProfitResponse<T> }, fallback: string): T {
  const result = response.data
  if (result.code !== 0 || result.success === false) throw new Error(result.message || fallback)
  return result.data as T
}

/** 安全取对象：`null` / 非对象一律兜底成空对象，避免读属性时报错。 */
function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

/** 安全取字符串数组：缺失 / 非数组 / 含非字符串元素都兜底，保证 `v-for` 不会拿到 undefined。 */
function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => (item == null ? '' : String(item))).filter((item) => item !== '')
}

/** 安全取数字：非有限数（含 `null` / `''` / `'abc'`）一律兜底为 0，避免 `toFixed` 报错。 */
function toNumber(value: unknown, fallback = 0): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

/** 安全取可空数字：缺失 / 非有限数返回 `null`（与 0 区分，页面对 `null` 用「—」占位）。 */
function toNullableNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

/** 安全取字符串：`null` / `undefined` 一律空串（页面统一用「—」占位）。 */
function toText(value: unknown): string {
  return value == null ? '' : String(value)
}

/**
 * 归一化 `money` 金额影响块：
 * 未知字段用 `Record<string, unknown>` 兜底保留（后端加字段时**不丢信息**、不影响类型），
 * 6 个已知字段缺一个就补 0 —— 报表类页面「少一个字段就白屏」是不可接受的。
 */
function normalizeMoney(value: unknown): OfflineRefundMoney {
  const raw = toRecord(value)
  return {
    ...(raw as Partial<OfflineRefundMoney>),
    poolTotalDelta: toNumber(raw.poolTotalDelta),
    newLayerDelta: toNumber(raw.newLayerDelta),
    oldLayerDelta: toNumber(raw.oldLayerDelta),
    emergencyDelta: toNumber(raw.emergencyDelta),
    promotionDelta: toNumber(raw.promotionDelta),
    peptideDelta: toNumber(raw.peptideDelta),
  }
}

/** 归一化 `contribution` 贡献快照：整个块缺失（`NO_CONTRIBUTION`）返回 `null`，ID 类字段转字符串。 */
function normalizeContribution(value: unknown): OfflineRefundContribution | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  return {
    // ⚠️ id / poolId 按字符串落地：后端示例是数字，但 BIGINT 直传会丢精度（与项目既有做法一致）
    id: toText(raw.id),
    poolId: toText(raw.poolId),
    poolDate: toText(raw.poolDate),
    amount: toNumber(raw.amount),
    emergencyAmount: toNullableNumber(raw.emergencyAmount),
    peptideAmount: toNullableNumber(raw.peptideAmount),
    status: toText(raw.status),
    userSegment: toText(raw.userSegment),
  }
}

/**
 * 归一化 `plan` 变更计划：逐行补齐 `table` / `id` / `field`，并**显式判断 `from` / `to` 是否存在**——
 * 这两个键的值本身可能就是 `null`，不能用 `??` 兜底（否则真值 null 会被替换，变成假信息）。
 */
function normalizePlan(value: unknown): OfflineRefundPlanRow[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const raw = toRecord(item)
    return {
      table: toText(raw.table),
      id: toText(raw.id),
      field: toText(raw.field),
      from: 'from' in raw ? raw.from : null,
      to: 'to' in raw ? raw.to : null,
    }
  })
}

/**
 * 归一化 `reconcile` 对账块：仅在 `commit` 响应里出现，缺失返回 `null`（页面据此不渲染对账区）。
 * 金额字段一律 `toNumber` 落地，避免出现 `NaN` 或 `undefined.toFixed`。
 */
function normalizeReconcile(value: unknown): OfflineRefundReconcile | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  return {
    poolTotal: toNumber(raw.poolTotal),
    poolNew: toNumber(raw.poolNew),
    poolOld: toNumber(raw.poolOld),
    poolDistributed: toNumber(raw.poolDistributed),
    poolRemaining: toNumber(raw.poolRemaining),
    poolNewOrderCount: toNumber(raw.poolNewOrderCount),
    nonVoidedCount: toNumber(raw.nonVoidedCount),
    nonVoidedAmount: toNumber(raw.nonVoidedAmount),
    emergencyBalance: toNumber(raw.emergencyBalance),
    emergencyTotalDeducted: toNumber(raw.emergencyTotalDeducted),
    emergencyTotalInjected: toNumber(raw.emergencyTotalInjected),
  }
}

/**
 * 归一化预演 / 提交响应。
 *
 * **为什么必须做**：这两个接口**尚未进 `api-docs.json`**（契约只来自那份 md），字段名属于"文档推断"，
 * 后端随时可能微调；财务页面一旦因为某个字段缺失就白屏，等于把不可逆操作的入口彻底堵死。
 * 所以这里把 `plan` / `money` / `warnings` / `blockers` / `reconcile` 全部兜底成安全值。
 */
export function normalizePreview(value: unknown): OfflineRefundPreviewVO {
  const raw = toRecord(value)
  return {
    orderId: toText(raw.orderId),
    orderNo: toText(raw.orderNo),
    userId: toText(raw.userId),
    orderStatus: toNumber(raw.orderStatus),
    pickupType: toNumber(raw.pickupType),
    payAmount: toNumber(raw.payAmount),
    branch: raw.branch == null ? '' : String(raw.branch),
    branchDesc: toText(raw.branchDesc),
    executed: raw.executed === true,
    contribution: normalizeContribution(raw.contribution),
    plan: normalizePlan(raw.plan),
    money: normalizeMoney(raw.money),
    warnings: toStringArray(raw.warnings),
    blockers: toStringArray(raw.blockers),
    confirmToken: toText(raw.confirmToken),
    reconcile: normalizeReconcile(raw.reconcile),
  }
}

/**
 * 预演（只读，不写库）：`GET /api/admin/profit/offline-refund/preview?orderNo=...`。
 * 该接口是财务提交前的**唯一事实来源**：`plan` / `money` / `warnings` / `blockers` 全部由它下发。
 */
export async function previewOfflineRefund(orderNo: string): Promise<OfflineRefundPreviewVO> {
  const normalizedOrderNo = orderNo.trim()
  if (!normalizedOrderNo) throw new Error('缺少订单号，无法预演线下退款冲账')
  const response = await request.get<ProfitResponse<unknown>>('/api/admin/profit/offline-refund/preview', {
    params: { orderNo: normalizedOrderNo },
  })
  return normalizePreview(unwrap(response, '线下退款冲账预演失败'))
}

/**
 * 提交（**单事务、不可逆**）：`POST /api/admin/profit/offline-refund/commit`。
 * 返回值 = 同一 VO + `executed: true` + `reconcile` 对账块；失败时单事务回滚，**不会产生部分写入**。
 */
export async function commitOfflineRefund(payload: OfflineRefundCommitDTO): Promise<OfflineRefundPreviewVO> {
  const response = await request.post<ProfitResponse<unknown>>('/api/admin/profit/offline-refund/commit', {
    orderNo: payload.orderNo.trim(),
    reason: payload.reason.trim(),
    voucherNo: payload.voucherNo.trim(),
    offlineRefundAmount: Number(payload.offlineRefundAmount),
    confirmToken: payload.confirmToken,
  })
  return normalizePreview(unwrap(response, '线下退款冲账提交失败'))
}

/**
 * 判断提交失败是否为「预演令牌失效」（10 分钟过期 / 账务变更导致摘要不匹配）。
 *
 * **为什么用文案匹配**：后端未定义专门的业务错误码（md 未给、api-docs 也没有这个接口），
 * 只能按 message 关键词识别；识别失败时也不阻断用户——页面仍会给出"可重新预演"的引导按钮。
 */
export function isOfflineRefundTokenExpired(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /(令牌|token|过期|失效|expired|invalid)/i.test(message)
}
