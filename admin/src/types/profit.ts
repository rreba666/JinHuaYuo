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
  createTime: string
  updateTime: string
}

export interface UserDividendLimit {
  id: string
  userId: string
  productPrice: number
  capAmount: number
  totalReceived: number
  milestoneHit: number
  blocked: number
  purchaseLimit: number
  totalPurchases: number
  unlockCount: number
  createTime: string
  updateTime: string
}

export interface ProfitResponse<T> {
  code: number
  message: string
  data?: T | null
  success?: boolean
}

export type PromotionPage = PaginationResult<PendingPromotionRecord> & { page: number; pageSize: number }
export type PromotionBindingPage = PaginationResult<PromotionBinding> & { page: number; pageSize: number }

export interface ProfitAdjustPoolDTO {
  totalAmount: number
  userCount: number
}

export interface ProfitAdjustDailyDTO {
  dailyAmount: number
  dailyUserCount: number
}
