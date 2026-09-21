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

/**
 * 推广排行榜统计周期：`DAY`=今日 / `WEEK`=本周 / `MONTH`=本月 / `YEAR`=本年 / `ALL`=**总榜（全时段）**。
 * ⚠️ `ALL` 时后端返回 `periodLabel="总榜"`、`periodStart`/`periodEnd` **为 null**（去掉周期起点下界，上界仍为 `asOf`）。
 */
export type LeaderboardPeriod = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'ALL'

/** 推广排行榜单行（B 端，对应后端 LeaderboardRow）。 */
export interface ProfitLeaderboardRow {
  /** 名次，从 1 开始；后端口径下名次唯一、没有并列。 */
  rank: number
  /** 推广员用户 ID（B 端专用，供后台核对用户；接口不返回手机号）。 */
  promoterUserId: string
  nickname: string
  /** 头像地址；未设置时为 null。 */
  avatarUrl: string | null
  /** 周期内推广的人数（去重：同一人下多单只算 1 人）。 */
  promotedUserCount: number
  /** 周期内产生的推广金（元）。 */
  promotionAmount: number
  /**
   * 该推广员**累计**推广人数（全时段去重，不受 `period` 影响）。
   * ⚠️ 后端尚未下发（已提需求），缺失时为 null，页面用「—」占位。
   */
  totalPromotedUserCount?: number | null
  /** 该推广员**累计**推广金（元，全时段）；同样待后端下发。 */
  totalPromotionAmount?: number | null
  /** 仅 C 端有意义，B 端恒为 false。 */
  isMe: boolean
}

/**
 * 推广排行榜（B 端，对应后端 PromotionLeaderboardVO）。
 * 与 C 端 `GET /api/promotion/leaderboard` **同源同口径**，差别：
 * - B 端 `myRank` / `myPromotedUserCount` / `myPromotionAmount` 恒为空（管理员不是推广员），`myRankInList` 恒 false；
 * - 接口**不返回手机号**（两端同结构，放进 C 端会泄漏）。
 */
export interface ProfitLeaderboard {
  period: LeaderboardPeriod
  /** 周期中文标签（如「本周」），直接取后端下发值展示。 */
  periodLabel: string
  /** 周期起点（含）。 */
  periodStart: string
  /** 周期**理论**终点（含）；滚动口径下真实数据上界是 `asOf`。 */
  periodEnd: string
  /** 统计截止时刻（= 请求时刻），页面据此标注「数据截至」。 */
  asOf: string
  /** 恒为 false（滚动口径含尚未走完的当前周期）。 */
  periodComplete: boolean
  /** 本次返回的榜单条数上限。 */
  limit: number
  myRank: number | null
  myPromotedUserCount: number
  myPromotionAmount: number
  myRankInList: boolean
  list: ProfitLeaderboardRow[]
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

/** 每日红包「某支付日累计用户贡献」明细（对应 OrderDividendContributionEntity，GET /api/admin/profit/daily/users/{asOfDate}）。 */
export interface DailyContributionUser {
  id: string
  orderId: string
  orderNo: string
  userId: string
  poolDate: string
  /** 该用户贡献金额（进大池部分，元）。 */
  amount: number
  /** 应急池抽取金额（元；未开启应急池为 null）。 */
  emergencyAmount?: number | null
  /** 贡献状态（CONFIRMED=已入池 / PENDING=待满7天 / VOIDED=退款作废）。 */
  status: string
  statusDesc: string
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

/** 后台「用户红包资格」槽位（对应 DividendSlotEntity，GET /api/admin/profit/slots）。 */
export interface AdminDividendSlot {
  id: string
  userId: string
  orderId: string
  orderNo: string
  productId: string
  productName: string
  productPrice: number
  /** 红包上限（元）= 商品价格 × 1.5。 */
  capAmount: number
  /** 本槽位累计已领红包（元）。 */
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

/**
 * 红包发放批次（`GET /api/admin/profit/dividend-packets`，2026-09-19 新增）。
 * 一行 = 一个发放批次（一个「红包」），详情用它。
 */
export interface DividendPacket {
  /** 红包 ID（= 发放批次 id）。 */
  id: string
  /** 发放日期（= 成交日 + 7）。 */
  distributionDate: string
  /**
   * 发放金额（元）—— **真值**，取「逐用户明细合计」。
   * ⚠️ **不是**批次表登记值：9/21 那次事故正是「登记值 = 0 但钱已实发」，
   * 所以这个字段以后端算出的真值为准，对账请看 `recordedAmount`。
   */
  distributedAmount: number
  /** 发放人数（**去重**）。 */
  userCount: number
  /**
   * 明细条数 —— **与 `userCount` 不相等**：
   * 同一用户当日会同时出现在「新用户层」和「老用户层」，产生两条明细。
   */
  recordCount: number
  /** 批次表登记值（元，**仅对账用**）；与 `distributedAmount` 不等 = **账实不符**。 */
  recordedAmount: number
  /** 新用户层发放金额（元）。 */
  newUserAmount: number
  /** 老用户层发放金额（元）。 */
  oldUserAmount: number
  /** 奖池 ID。 */
  poolId?: number | string
  /** 批次号。 */
  batchNo?: string
  /** 批次状态（后端未给枚举，按原值展示；未发的批次也会返回，前端可按状态分组）。 */
  status?: string
  /** 状态中文名（后端若下发则优先展示）。 */
  statusDesc?: string
  /** 完成时间。 */
  completedAt?: string
}

/** 批次成员（详情响应里的 `members[]`）。 */
export interface DividendPacketMember {
  userId: number
  /** 用户名字；**取不到为 null**，前端回退「用户[id]」。 */
  nickname?: string | null
  /** 该用户在本批的发放金额（元，与钱包入账、红包流水一致）。 */
  amount: number
  /** 用户层：`NEW`=新用户层 / `OLD`=老用户层；**历史数据为 null**。 */
  userSegment?: 'NEW' | 'OLD' | string | null
  /** 本批参与分配的订单数。 */
  orderCount: number
}

/** 批次详情：红包头信息 + `members[]`（后端已按「金额降序 → 用户ID升序」排序）。 */
export interface DividendPacketDetail {
  id: string
  distributionDate?: string
  distributedAmount?: number
  userCount?: number
  recordCount?: number
  recordedAmount?: number
  newUserAmount?: number
  oldUserAmount?: number
  poolId?: number | string
  batchNo?: string
  status?: string
  statusDesc?: string
  completedAt?: string
  members: DividendPacketMember[]
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
