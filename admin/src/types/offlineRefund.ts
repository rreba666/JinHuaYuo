/**
 * 自提订单「线下退款冲账」类型定义（B 端后台）。
 *
 * ⚠️ **契约来源**：`docs/B端-自提线下退款冲账-接口方案与风险说明-20260921.md`（2026-09-21）。
 * 该文档是本次契约的**唯一权威**：字段名 / 分支枚举 / 对账块全部抄自它。
 *
 * ⚠️ **api-docs.json 尚未同步**：`E:\work\JJ\project\api-docs.json` 里 `grep offline-refund` 零命中，
 * 即后端 OpenAPI 还没有这两个接口（接口本身已上线生产：`GET .../preview` → 401、`GET .../commit` → 405、
 * `POST .../commit` → 401）。**后端补文档后需复核本文件字段名**，尤其是：
 * - `contribution.userSegment` / `contribution.peptideAmount` 只在 md 的示例里出现（示例值为 `"NEW"` / `null`）；
 * - `reconcile` 的 12 个字段全部来自 md §2.2 的响应示例，文档未给完整 schema。
 * 因此 api 层做了 `normalizePreview` 兜底（见 `src/api/offlineRefund.ts`），
 * 后端字段微调**不会白屏**，但若改了字段名，页面会显示兜底值（0 / 空），需按后端补的文档复核。
 */

/** 冲账分支：服务端判定，前端**只展示不判定**（见 md §三 分支矩阵）。 */
export type OfflineRefundBranch =
  | 'NO_CONTRIBUTION'
  | 'BEFORE_CONFIRM'
  | 'AFTER_CONFIRM_NOT_PAID'
  | 'AFTER_CONFIRM_PAID'
  | 'POOL_COMPLETED'

/**
 * 分支中文文案（从 md §三「分支矩阵」表格逐行提炼）。
 * `Record<string, string>` 而不是 `Record<OfflineRefundBranch, string>`：
 * 后端若新增分支，前端按"未知分支原样展示"兜底，不因类型收窄而崩。
 */
export const OFFLINE_REFUND_BRANCH_TEXT: Record<string, string> = {
  NO_CONTRIBUTION: '无红包贡献（无需冲账）',
  BEFORE_CONFIRM: '贡献未确认入池（成交日 +7 之前）',
  AFTER_CONFIRM_NOT_PAID: '贡献已入池、本单尚未发放',
  AFTER_CONFIRM_PAID: '红包已发到用户钱包',
  POOL_COMPLETED: '红包池已结算完成',
}

/** 冲账分支的标签颜色（与 Element Plus 语义色一致，供 el-tag 使用）。 */
export const OFFLINE_REFUND_BRANCH_TAG: Record<string, 'info' | 'warning' | 'danger' | 'success'> = {
  NO_CONTRIBUTION: 'info',
  BEFORE_CONFIRM: 'success',
  AFTER_CONFIRM_NOT_PAID: 'warning',
  AFTER_CONFIRM_PAID: 'danger',
  POOL_COMPLETED: 'danger',
}

/**
 * 变更计划单行：「哪张表、哪一行、哪个字段、从什么变成什么」。
 * `from` / `to` 是**数据库快照值**，可能是 `null` / 数字 / 字符串 / JSON，
 * 所以类型是 `unknown`，展示前必须经 `formatPlanValue` 安全转换（**不要**直接插值，会出 "undefined"）。
 */
export interface OfflineRefundPlanRow {
  /** 数据库表名（如 `order_dividend_contribution`）。 */
  table: string
  /** 行主键（**按字符串处理**，避免 BIGINT 精度丢失）。 */
  id: string
  /** 被修改的列名（如 `status` / `total_amount`）。 */
  field: string
  /** 修改前快照值。 */
  from: unknown
  /** 修改后目标值。 */
  to: unknown
}

/**
 * 金额影响（md §2.1 响应示例里的 `money` 块，6 个 delta）。
 * 负值 = 冲减；0 = 该分支不动这一项（如 `BEFORE_CONFIRM` 的 `emergencyDelta`）。
 */
export interface OfflineRefundMoney {
  /** 红包池总额变化。 */
  poolTotalDelta: number
  /** 新用户层变化。 */
  newLayerDelta: number
  /** 老用户层变化。 */
  oldLayerDelta: number
  /** 应急红包池变化。 */
  emergencyDelta: number
  /** 推广金变化。 */
  promotionDelta: number
  /** 肽金变化。 */
  peptideDelta: number
}

/** 贡献记录快照（`NO_CONTRIBUTION` 分支为 `null`）。 */
export interface OfflineRefundContribution {
  /** 贡献记录 ID（按字符串处理，防 BIGINT 精度丢失）。 */
  id: string
  /** 奖池 ID（按字符串处理）。 */
  poolId: string
  /** 归属支付日（`pool_date`）。 */
  poolDate: string
  /** 进池额（已扣应急池与肽金）。 */
  amount: number
  /** 应急池抽取额；未开启应急池为 `null`。 */
  emergencyAmount: number | null
  /** 肽金计提额（新口径才有，老口径数据为 `null`）。 */
  peptideAmount: number | null
  /** 贡献状态：`PENDING` / `CONFIRMING` / `CONFIRMED` / `VOIDED`。 */
  status: string
  /** 用户层：`NEW`=新用户层 / `OLD`=老用户层。 */
  userSegment: string
}

/** 冲账后对账块（仅在 `commit` 响应里返回；md §2.2 示例的 12 个字段）。 */
export interface OfflineRefundReconcile {
  /** 池总额（冲减后）。 */
  poolTotal: number
  /** 新用户层金额（冲减后）。 */
  poolNew: number
  /** 老用户层金额（冲减后）。 */
  poolOld: number
  /** 池内已发放金额。 */
  poolDistributed: number
  /** 池内剩余待发金额。 */
  poolRemaining: number
  /** 池内非作废订单数。 */
  poolNewOrderCount: number
  /** 非作废贡献条数。 */
  nonVoidedCount: number
  /** 非作废贡献金额合计。 */
  nonVoidedAmount: number
  /** 应急池余额。 */
  emergencyBalance: number
  /** 应急池累计抽取。 */
  emergencyTotalDeducted: number
  /** 应急池累计注入。 */
  emergencyTotalInjected: number
}

/**
 * 预演 / 提交响应 VO（后端 `OfflineRefundPreviewVO`）。
 * `commit` 的响应是**同一结构** + `executed: true` + `reconcile`。
 */
export interface OfflineRefundPreviewVO {
  /** 订单 ID（按字符串处理）。 */
  orderId: string
  orderNo: string
  /** 下单用户 ID（按字符串处理）。 */
  userId: string
  /** 订单状态（自提终态为 8 = 已核销）。 */
  orderStatus: number
  /** 配送方式（1 = 自提）。 */
  pickupType: number
  /** 订单实付金额（元）。 */
  payAmount: number
  /** 冲账分支（服务端判定）。 */
  branch: OfflineRefundBranch | string
  /** 分支中文说明，**直接展示后端下发值**（前端不重写口径）。 */
  branchDesc: string
  /** 是否已执行过冲账（`true` = 该单已冲账，表单必须隐藏）。 */
  executed: boolean
  /** 贡献记录快照；`NO_CONTRIBUTION` 时为 `null`。 */
  contribution: OfflineRefundContribution | null
  /** 逐行变更计划（"哪张表哪一行从什么变成什么"）。 */
  plan: OfflineRefundPlanRow[]
  /** 金额影响。 */
  money: OfflineRefundMoney
  /** 风险提示（**必须原样红字展示**，不得省略/折叠）。 */
  warnings: string[]
  /** 阻断项（**非空即禁止提交**）。 */
  blockers: string[]
  /** 二次确认令牌，10 分钟有效，绑定「订单 + 变更计划摘要」。 */
  confirmToken: string
  /** 对账块：仅 `commit` 成功时返回。 */
  reconcile?: OfflineRefundReconcile | null
}

/** 提交请求体（后端 `OfflineRefundCommitDTO`）。 */
export interface OfflineRefundCommitDTO {
  orderNo: string
  /** 退款原因（必填）。 */
  reason: string
  /** 线下退款凭证号（必填，如微信/支付宝转账单号）。 */
  voucherNo: string
  /** 线下实际退款金额（元；与订单实付不一致时前端会二次确认）。 */
  offlineRefundAmount: number
  /** 预演拿到的确认令牌（10 分钟有效）。 */
  confirmToken: string
}
