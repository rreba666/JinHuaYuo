import { request } from './request'
import { normalizeLegacyWording } from '@/utils/wording'
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
 * ⚠️ **契约来源**：`docs/B端-自提线下退款冲账-接口方案与风险说明-20260921.md`（业务口径解释）
 * + `E:\work\JJ\project\api-docs.json`（**字段名权威**）。
 * **2026-09-21 15:27 起 api-docs.json 已收录这两个接口**（schema：`OfflineRefundCommitDTO` /
 * `OfflineRefundPreviewVO` / `ChangeItem` / `ContributionBrief` / `Money` / `Reconcile`），
 * 已按它逐字段复核并补齐 `executedInfo` / `plan[].desc`。
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
 * 安全取**可空**字符串：缺失 / `null` / 空串 → `null`，否则 `String(value)`。
 * 用在 `executedInfo` / `plan[].desc` 这类「有值才展示」的字段上：
 * 页面靠 `null` 判断"不显示这一行"，用 `toText` 的空串会丢掉这个语义。
 */
function toNullableText(value: unknown): string | null {
  if (value == null) return null
  const text = String(value)
  return text === '' ? null : text
}

/**
 * **展示层文案归一化**（项目硬性口径，务必保留）。
 *
 * 后端下发的文案里可能出现**项目已弃用的旧称**（`api-docs.json` 里这两个接口的描述就是通篇用的旧称，
 * 如 `branchDesc` 的示例、`ContributionBrief.poolId` 的"归属 XX 池"），
 * 而产品规定：**代码注释与所有用户可见文案统一用「红包」，不得出现旧称**（见 CLAUDE.md 与 `utils/wording.ts`，
 * 后者用 `\u` 转义写出旧称，所以这里也不便明文写出）。
 * 所以凡是**给人看的字符串**（`branchDesc` / `warnings` / `blockers` / `plan[].desc` / `executedInfo`）
 * 都必须在接口层过一遍这个函数 —— 放在这里而不是页面里，是为了**一处生效、不依赖每个展示点自觉**。
 *
 * ⚠️ **不要**用它处理 `plan[].table` / `plan[].field`：那是表名与字段名（如 `order_dividend_contribution`），
 * 属于技术标识，翻译了就对不上库了。
 */
function normalizeWordingText(value: unknown): string {
  return normalizeLegacyWording(toText(value))
}

/** 可空版本的文案归一化：`null` / 空串保持 `null`（给「有值才展示」的字段用）。 */
function normalizeWordingNullableText(value: unknown): string | null {
  const text = toNullableText(value)
  return text === null ? null : normalizeLegacyWording(text)
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
 * 归一化 `plan` 变更计划：逐行补齐 `table` / `id` / `field` / `desc`，并**显式判断 `from` / `to` 是否存在**——
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
      // 后端 ChangeItem.desc（api-docs 2026-09-21 收录）：缺失/空串按 null 落地，表格显示「—」；
      // 文案同样要过"旧称→红包"归一化（后端可能下发已弃用的旧称）
      desc: normalizeWordingNullableText(raw.desc),
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
 * **为什么仍然要做**：接口虽已进 `api-docs.json`（2026-09-21），但契约里可空语义用得很重
 * （`executedInfo` 可能是 null、`plan` 行里的 `from` / `to` 本身就是快照值），
 * 财务页面一旦因为某个字段缺失就白屏，等于把不可逆操作的入口彻底堵死。
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
    // ⚠️ 下面这些是**后端下发的展示文案**（branchDesc / warnings / blockers / executedInfo）：
    // 统一在接口层过"旧称→红包"归一化，避免旧称漏到财务眼前（见 normalizeWordingText 的说明）
    branchDesc: normalizeWordingText(raw.branchDesc),
    executed: raw.executed === true,
    // 已冲账信息（操作人/时间/凭证号）：有值才展示，故按可空落地（api-docs 2026-09-21 补的字段）
    executedInfo: normalizeWordingNullableText(raw.executedInfo),
    contribution: normalizeContribution(raw.contribution),
    plan: normalizePlan(raw.plan),
    money: normalizeMoney(raw.money),
    warnings: toStringArray(raw.warnings).map(normalizeWordingText),
    blockers: toStringArray(raw.blockers).map(normalizeWordingText),
    // 异常预判/实际（2026-09-21 新增）：预演阶段是"预判"、提交后是"实际发生"，两段共用同一字段；
    // 明细同样是后端下发的展示文案 → 一并过"旧称→红包"归一化
    exceptionFlag: toNullableNumber(raw.exceptionFlag),
    exceptionReasons: toStringArray(raw.exceptionReasons).map(normalizeWordingText),
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
 * **为什么用文案匹配**：api-docs 未给该接口定义专门的业务错误码，
 * 只能按 message 关键词识别；识别失败时也不阻断用户——页面仍会给出"可重新预演"的引导按钮。
 */
export function isOfflineRefundTokenExpired(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /(令牌|token|过期|失效|expired|invalid)/i.test(message)
}

/**
 * 判断提交失败是否属于「必须重新预演才能继续」——即**可以自动重跑一次 preview** 的场景。
 *
 * **为什么要扩展判定**（api-docs `POST /offline-refund/commit` 描述原文）：
 * 服务端第 4 步是「池计划额**守卫式**冲减（`AND total_amount=期望值`，**不匹配即中止并提示重新预演**，天然幂等）」，
 * 也就是说提交失败**不一定**是令牌过期，还可能是**预演之后账务已变化**（池额守卫不匹配），
 * 此时后端的提示文案里带「预演」字样而不带 token/过期关键词。若只按令牌关键词识别，
 * 财务会卡在表单页手动点「返回预演 → 重新预演」，多两步且容易误以为接口坏了。
 *
 * 命中任一条即返回 `true`：
 * 1. {@link isOfflineRefundTokenExpired}（令牌过期 / 失效 / invalid）；
 * 2. 文案含「预演」二字（覆盖"请重新预演"，也是后端守卫失败的主口径）；
 * 3. 文案含「计划（已/发生）变化|变更|不一致」——即便后端改写措辞不带"预演"也能兜住。
 *
 * **安全性**：重跑 preview 是**只读**接口（不写库），误判的代价仅是白屏一次加载，因此判定偏宽松。
 */
export function isOfflineRefundNeedRepreview(error: unknown): boolean {
  if (isOfflineRefundTokenExpired(error)) return true
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /(预演|计划.{0,6}(变化|变更|已修改|不一致)|账务.{0,6}(变化|变更))/.test(message)
}
