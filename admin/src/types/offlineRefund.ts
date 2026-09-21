/**
 * 自提订单「线下退款冲账」类型定义（B 端后台）。
 *
 * ⚠️ **契约来源（两个，分工不同）**：
 * 1. `docs/B端-自提线下退款冲账-接口方案与风险说明-20260921.md`（2026-09-21）—— **业务口径解释来源**
 *    （分支矩阵、为什么必须人工冲账、异常如何处置）；
 * 2. `E:\work\JJ\project\api-docs.json` —— **字段名的权威来源**：
 *    **2026-09-21 15:27 起 api-docs.json 已收录这两个接口**
 *    （`GET /api/admin/profit/offline-refund/preview` / `POST /api/admin/profit/offline-refund/commit`），
 *    相关 schema：`OfflineRefundCommitDTO` / `OfflineRefundPreviewVO` / `ChangeItem` / `ContributionBrief` / `Money` / `Reconcile`。
 *    本节字段已按它**逐字段复核**：结论是字段名基本吻合，本次补齐此前漏掉的 3 处
 *    —— `OfflineRefundPreviewVO.executedInfo`、`ChangeItem.desc`、DTO 可选 `operatorName`（仅声明，前端不传）。
 *
 * 仍然保留 api 层的 `normalizePreview` 兜底（见 `src/api/offlineRefund.ts`）：
 * 后端字段微调**不会白屏**，但若改了字段名，页面会显示兜底值（0 / 空）。
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
  /**
   * 该行变更的说明（后端 `ChangeItem.desc`，api-docs 2026-09-21 收录），可能为空。
   * 展示时必须安全转换（复用 `formatPlanValue`），空值以「—」占位。
   */
  desc: string | null
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
  /**
   * 应急池抽取额；未开启应急池为 `null`。
   * ⚠️ api-docs `ContributionBrief.emergencyAmount` 标为 `number`（**没有** nullable），
   * 但后端实际可能下发 `null`（md 示例即 `null`）—— 前端按可空容错，保持宽松更安全。
   */
  emergencyAmount: number | null
  /**
   * 肽金计提额（新口径才有，老口径数据为 `null`）。
   * ⚠️ 同 `emergencyAmount`：api-docs 标为 `number`，前端仍按可空容错。
   */
  peptideAmount: number | null
  /** 贡献状态：`PENDING` / `CONFIRMING` / `CONFIRMED` / `VOIDED`。 */
  status: string
  /** 用户层：`NEW`=新用户层 / `OLD`=老用户层。 */
  userSegment: string
}

/**
 * 冲账后对账块（仅在 `commit` 响应里返回）。
 * 字段名与数量已按 api-docs `Reconcile`（2026-09-21 收录）核对：**正好 11 个**
 * （poolTotal / poolNew / poolOld / poolDistributed / poolRemaining / poolNewOrderCount /
 * nonVoidedCount / nonVoidedAmount / emergencyBalance / emergencyTotalDeducted / emergencyTotalInjected）。
 * 此前注释写的「12 个字段」来自 md 示例，是错的，已修正。
 */
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
  /**
   * 已冲账信息（操作人 / 时间 / 凭证号），后端拼好的整串字符串，前端**原样展示**。
   * 契约：api-docs `OfflineRefundPreviewVO.executedInfo`（2026-09-21 收录），类型 `string`；
   * `executed=true` 时后端下发，但仍可能为 `null`（老数据 / 审计台账缺字段），所以按可空处理。
   */
  executedInfo: string | null
  /**
   * 贡献记录快照（后端 `ContributionBrief`）；**订单无红包痕迹时为 `null`**。
   * 这是「无需冲账」的判定依据（api-docs 原文：「订单无分红痕迹时为 null」，项目内文案统一称「红包」）。
   */
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
  /** 冲账原因（必填，写入审计台账）。api-docs `required` 含 `reason`。 */
  reason: string
  /**
   * 线下退款凭证号（如微信/支付宝转账单号）。
   * ⚠️ 契约差异说明：api-docs `required` 只有 `["confirmToken","orderNo","reason"]`，
   * `voucherNo` 描述是「建议填写，便于事后对账」。**前端仍按必填校验**（比后端更严）——
   * 财务凭证号是事后对账/追责的唯一凭据，留档价值高，故不放宽。
   */
  voucherNo: string
  /** 线下实际退款金额（元；与订单实付不一致时前端会二次确认）。api-docs：不填默认取订单实付。 */
  offlineRefundAmount: number
  /** 预演拿到的确认令牌（10 分钟有效）。api-docs `required` 含 `confirmToken`。 */
  confirmToken: string
  /**
   * 操作人（可选）。后端口径：「不填则取当前登录管理员昵称」—— 所以前端**保持不传**，
   * 由后端按登录态填充，避免前端伪造操作人。这里声明它是为了对齐契约与留档。
   */
  operatorName?: string
}
