import { request } from '@/utils/request'

/**
 * 肽金券账户（对应后端 PeptideCoinAccountVO）。
 * 肽金券是平台虚拟货币：**不可提现、不可转赠**，只能在下单时抵扣「启用肽金券」的商品，无门槛、无上限。
 */
export interface PeptideAccount {
  /** 可用余额（元）。 */
  balance: number
  /** 累计获得（元），仅展示。 */
  totalEarned: number
  /** 累计使用（元），仅展示。 */
  totalUsed: number
  /** 平台是否启用发放：false=暂停发放，但**已获得的余额仍可继续抵扣**。 */
  enabled: boolean
  /** 当前每单可获得金额（元），后台可调。 */
  perOrderAmount: number
  /** 是否可提现：**恒为 false**（肽金券不可提现）。 */
  withdrawable: boolean
}

/** 肽金券流水类型：EARN=分红获得 / USE=下单抵扣 / REFUND=订单关闭或退款返还 / ADMIN_ADJUST=后台调整。 */
export type PeptideLogType = 'EARN' | 'USE' | 'REFUND' | 'ADMIN_ADJUST'

/** 肽金券流水（对应后端 PeptideCoinLogVO）。 */
export interface PeptideLog {
  id: number
  userId: number
  type: PeptideLogType | string
  /** 流水类型中文名（后端下发，展示前用 normalizePeptideWording 归一化文案）。 */
  typeText: string
  /** 变动金额（元，**恒为正数**）。 */
  amount: number
  /** 变动方向：`IN`=增加 / `OUT`=减少 —— **判断增减只看 direction，不要用正负号**。 */
  direction: 'IN' | 'OUT' | string
  /** 变动后可用余额（元）。 */
  balanceAfter: number
  orderId?: number | null
  orderNo?: string | null
  /** 来源订单号（EARN 时有值）。 */
  sourceOrderNo?: string | null
  remark?: string | null
  createTime: string
}

/** 肽金券流水分页结果。 */
export interface PeptideLogPageResult {
  total: number
  list: PeptideLog[]
  page: number
  pageSize: number
}

/** 下单页肽金券可用额度（对应后端 PeptideCoinUsableVO）。 */
export interface PeptideUsable {
  /** 用户可用余额（元）。 */
  balance: number
  /** 本单**允许**抵扣的商品小计（元）= Σ(启用肽金券的商品单价 × 数量)。 */
  peptideEnabledAmount: number
  /** 本单**最多**可抵扣金额（元）= min(余额, 允许抵扣的商品小计)；抵满即为 0 元购。 */
  usableAmount: number
  /** 平台是否启用肽金券：false 时前端应隐藏抵扣入口（已获得的余额仍可在启用后使用）。 */
  enabled: boolean
  /** 是否可提现：恒为 false。 */
  withdrawable: boolean
  /** 使用说明（后端下发，展示前用 normalizePeptideWording 归一化文案）。 */
  usageTip: string
}

/** 使用 uni-app 可兼容的方式构造查询字符串，避免依赖浏览器 Web API。 */
function buildQuery(params: Record<string, string | number | undefined>): string {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
}

/**
 * 展示层文案归一化：后端文案里的「肽金」统一显示为「肽金券」。
 * 用负向断言 `肽金(?!券)`，避免把已经是「肽金券」的文案变成「肽金券券」。
 */
export function normalizePeptideWording(text?: string | null): string {
  if (!text) return ''
  return String(text).replace(/肽金(?!券)/g, '肽金券')
}

/** 我的肽金券账户（余额 / 累计 / 开关状态）。 */
export function getPeptideAccount(): Promise<PeptideAccount> {
  return request<PeptideAccount>({ url: '/api/peptide/account', method: 'GET' })
}

/** 我的肽金券流水（分页，按时间倒序）。 */
export function getPeptideLogs(page = 1, pageSize = 10): Promise<PeptideLogPageResult> {
  const query = buildQuery({ page, pageSize })
  return request<PeptideLogPageResult>({ url: `/api/peptide/logs?${query}`, method: 'GET' })
}

/**
 * 下单页肽金券可用额度。
 * @param peptideEnabledAmount 本单中「启用肽金券」的商品小计（元）；不传按 0 处理（仅余额可供展示）。
 */
export function getPeptideUsable(peptideEnabledAmount?: number): Promise<PeptideUsable> {
  const query = buildQuery({ peptideEnabledAmount })
  return request<PeptideUsable>({ url: `/api/peptide/usable${query ? `?${query}` : ''}`, method: 'GET' })
}
