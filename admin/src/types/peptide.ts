/**
 * 肽金券模块（B 端）类型定义。
 *
 * 命名约定：产品中文名统一叫「**肽金券**」（平台虚拟货币，不可提现，仅可用于下单抵扣）；
 * 英文标识符保持后端原样（`peptide` / `PeptideCoin*`），前端**不**改写成 `peptideCoin` 之类的自造名。
 */

/** 肽金券流水类型：EARN=红包获得 / USE=下单抵扣 / REFUND=订单关闭或退款返还 / ADMIN_ADJUST=后台调整。 */
export type PeptideLogType = 'EARN' | 'USE' | 'REFUND' | 'ADMIN_ADJUST'

/** 流水变动方向：IN=增加，OUT=减少。金额字段恒为正数，判断增减**只看 direction**。 */
export type PeptideDirection = 'IN' | 'OUT'

/** 肽金券总览（GET /api/admin/peptide/summary）。 */
export interface PeptideSummary {
  /** 持有账户数（含余额为 0 的历史账户）。 */
  accountCount: number
  /** 全平台未使用余额合计（元）= 平台待履约负债。 */
  balanceSum: number
  /** 全平台累计发放（元）。 */
  earnedSum: number
  /** 全平台累计使用（元）。 */
  usedSum: number
  /** 当前每单金额（元），来自配置 dividend_peptide_amount。 */
  perOrderAmount: number
  /** 发放是否启用，来自配置 dividend_peptide_enabled。 */
  enabled: boolean
  /** 生效起始成交日（yyyy-MM-dd），成交日早于该日期的订单不切肽金券。 */
  startDate: string
}

/** 肽金券账户行（GET /api/admin/peptide/accounts，按余额倒序）。 */
export interface PeptideAccount {
  /** 账户 ID（后端 BIGINT，前端按字符串承载，避免精度丢失）。 */
  id: string
  userId: string
  nickname: string
  /** 手机号（后端已脱敏，可直接展示）。 */
  phone: string
  /** 可用肽金券余额（元）。 */
  balance: number
  /** 累计获得（元）。 */
  totalEarned: number
  /** 累计使用（元）。 */
  totalUsed: number
  /** 最近变动时间。 */
  updateTime: string
  /** 账户创建时间。 */
  createTime: string
}

/** 肽金券流水行（GET /api/admin/peptide/logs，时间倒序）。 */
export interface PeptideLog {
  id: string
  userId: string
  /** 流水类型枚举值（未知类型按原样展示）。 */
  type: PeptideLogType | string
  /** 后端下发的类型中文名（展示前需过 normalizeLegacyWording 归一化）。 */
  typeText: string
  /** 变动金额（元，**恒为正数**）。 */
  amount: number
  /** 变动方向（增减只看该字段）。 */
  direction: PeptideDirection | string
  /** 变动后可用余额（元）。 */
  balanceAfter: number
  /** 关联订单 ID（USE/REFUND 时有值）。 */
  orderId: string
  /** 关联订单号（USE/REFUND 时有值）。 */
  orderNo: string
  /** 肽金券来源订单号（EARN 时有值）。 */
  sourceOrderNo: string
  /** 备注（展示前需过 normalizeLegacyWording 归一化）。 */
  remark: string
  createTime: string
}

/** 通用分页结果（后端 total/page/pageSize/list）。 */
export interface PeptidePage<T> {
  total: number
  page: number
  pageSize: number
  list: T[]
}

/** 账户列表查询参数（userId 精确匹配，可空）。 */
export interface PeptideAccountQuery {
  userId?: string
  page: number
  pageSize: number
}

/** 全平台流水查询参数（userId/type/orderNo 均可选，可组合）。 */
export interface PeptideLogQuery {
  userId?: string
  type?: string
  orderNo?: string
  page: number
  pageSize: number
}

/** 人工调整参数（POST /api/admin/peptide/adjust）：amount **带符号**，正数=赠送、负数=回收，不可为 0。 */
export interface PeptideAdjustDTO {
  userId: string
  amount: number
  /** 调整原因（写入流水，便于审计）。 */
  remark: string
}

/** 人工调整结果：调整后余额（元）。 */
export interface PeptideAdjustResult {
  userId: string
  amount: number
  balance: number
}

/**
 * 发放配置（对应后端 `DividendPeptideConfigVO`，走专用接口 `GET|POST /api/admin/setting/dividend-peptide`）。
 * ⚠️ `enabled` 只决定**是否发放**肽金券；「能不能用肽金券抵扣」由商品的 `peptideEnabled` 控制，两者独立。
 */
export interface PeptideGrantConfig {
  /** 发放开关（dividend_peptide_enabled）。 */
  enabled: boolean
  /** 每单切出的金额（元，dividend_peptide_amount，默认 52.80）；后端要求 > 0 且最多 2 位小数。 */
  amount: number
  /** 生效起始成交日（yyyy-MM-dd，dividend_peptide_start_date）。 */
  startDate: string
  /** 生效日是否已到（仅 GET 返回，按服务器当天判断）；false 表示「配置已保存但尚未生效」。 */
  started?: boolean
}

/** 后端业务码：回收时用户余额不足（HTTP 200 + code=7100）。 */
export const PEPTIDE_INSUFFICIENT_BALANCE_CODE = 7100
