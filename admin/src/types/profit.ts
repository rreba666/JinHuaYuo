import type { PaginationResult } from './common'

export interface PendingPromotionRecord {
  id: string
  orderId: string
  orderNo: string
  promoterUserId: string
  buyerUserId: string
  amount: number
  status: string
  confirmedBy: string
  confirmedAt: string
  remark: string
  createdAt: string
  updateTime: string
}

export type PromotionBindingSource = 'SCAN' | 'MANUAL' | 'UNKNOWN'

export interface PromotionBinding {
  buyerUserId: string
  buyerName: string
  buyerAvatar: string
  promoterUserId: string
  promoterName: string
  promoterAvatar: string
  bindTime: string
  source: PromotionBindingSource
  sourceDesc: string
  status: 'BOUND'
  statusDesc: string
}

export interface PromotionBindingQuery {
  keyword?: string
  source?: PromotionBindingSource
  page: number
  size: number
}

export interface SevenDayBonusPool {
  id: string
  startDate: string
  endDate: string
  totalAmount: number
  settledUserCount: number
  settleTime: string
  createTime: string
  updateTime: string
}

export interface SevenDayBonusDetail {
  id: string
  poolId: string
  poolDate: string
  dailyAmount: number
  dailyUserCount: number
  /** 累计参与人数（截至该支付日去重，随滚动递增：如 8/29=17、8/30=18）。 */
  cumulativeUserCount?: number
  /** 是否已结算：0=未结算 / 1=已结算（该支付日已实发金额）。 */
  settledFlag?: number
  /** 已发放实发金额（元；区别于 dailyAmount 当天应发，未结算为 null）。 */
  settledAmount?: number | null
  /** 结算版本（如 V2）。 */
  settlementVersion?: string
  createTime: string
  updateTime: string
}

export interface DividendContribution {
  id: string
  orderNo: string
  userId: string
  userName: string
  amount: number
  paidAt: string
  matureAt: string
  status: string
  statusDesc: string
  confirmedAt: string
  poolId: string
}

export interface UserDividendLimit {
  id: string
  userId: string
  /** 当前可用购买机会数（初始 3，槽位锁死返还 1）。 */
  availablePurchase: number
  /** 累计购买红包商品件数。 */
  totalPurchases: number
  createTime: string
  updateTime: string
}

/** 后台「用户分红资格」槽位（对应 DividendSlotEntity，GET /api/admin/profit/slots）。 */
export interface AdminDividendSlot {
  id: string
  userId: string
  orderId: string
  orderNo: string
  productId: string
  productName: string
  productPrice: number
  /** 分红上限（元）= 商品价格 × 1.5。 */
  capAmount: number
  /** 本槽位累计已领分红（元）。 */
  totalReceived: number
  /** 是否满额锁死：0=活跃 / 1=满额锁死（赚够 1.5 倍）。 */
  locked: number
  /** 是否退款作废：0=正常 / 1=退款作废（与 locked 区分）。 */
  invalidFlag: number
  /** 作废原因（REFUND=退款）。 */
  invalidReason: string | null
  /** 锁死时间（满额锁死时写入；未锁死为 null）。 */
  lockedAt: string | null
}

export interface ProfitResponse<T> {
  code: number
  message: string
  data?: T | null
  success?: boolean
}

export type PromotionPage = PaginationResult<PendingPromotionRecord> & { page: number; pageSize: number }
export type PromotionBindingPage = PaginationResult<PromotionBinding> & { page: number; pageSize: number }
export type DividendContributionPage = PaginationResult<DividendContribution> & { page: number; pageSize: number }

export interface ProfitAdjustPoolDTO {
  totalAmount: number
  userCount: number
}

export interface ProfitAdjustDailyDTO {
  dailyAmount: number
  dailyUserCount: number
}

export interface BonusInjectDTO {
  poolDate?: string
  amount: number
}

export interface WalletTestResult {
  balance: number
  pendingPromotion: number
  pendingBonus: number
  totalIncome: number
}

export interface DividendSlotTestItem {
  id: string
  productName: string
  productPrice: number
  capAmount: number
  totalReceived: number
  locked: number
  lockedAt: string
  createTime: string
}

export interface DividendSlotTestResult {
  availablePurchase: number
  totalPurchases: number
  slots: DividendSlotTestItem[]
}

export interface DividendRecordTestItem {
  id: string
  productName: string
  amount: number
  createTime: string
}

export interface DividendRecordTestResult {
  total: number
  page: number
  pageSize: number
  list: DividendRecordTestItem[]
}
