import { request } from '@/utils/request'

/** 推广中心汇总（对应 PromotionSummaryVO）。 */
export interface PromotionSummary {
  totalPromotion: number
  boundUserCount: number
  /** 待提现推广金（元）：已入账、可转余额或提现的部分。 */
  pendingPromotion: number
  /**
   * 待到账推广金（元）：已产生但未过 7 天退款窗口、尚未入账的部分（2026-09-16 后端新增）。
   * **展示合计 = pendingPromotion + unsettledPromotion**，无需前端再拉明细汇总。
   */
  unsettledPromotion?: number
  withdrawnPromotion: number
}

/** 推广明细记录（对应 PromotionRecordVO）。 */
export interface PromotionRecord {
  buyerName: string
  orderNo: string
  payAmount: number
  amount: number
  status: number
  statusDesc: string
  createTime: string
  /**
   * 推广金状态：
   * - `PENDING`：待到账（未过 7 天退款窗口，金额不在钱包 `pendingPromotion` 内）；
   * - `PROCESSING`：入账占坑中间态（毫秒级，**同样算待到账**）；
   * - `CONFIRMED`：已入账推广人钱包。
   * 后端 2026-09-16 起还会在钱包/汇总接口直接下发 `unsettledPromotion`，这里是兜底口径。
   */
  promotionStatus?: string
}

/** 推广明细分页结果。 */
export interface PromotionPageResult {
  total: number
  list: PromotionRecord[]
  page: number
  pageSize: number
}

export interface PromotionRecordQuery {
  startTime?: string
  endTime?: string
  /** 推广金状态过滤：`PENDING` / `PROCESSING` / `CONFIRMED`（2026-09-16 后端新增，可不传）。 */
  promotionStatus?: string
  page?: number
  pageSize?: number
}

/** 生成推广小程序码接口返回的数据。 */
export type PromotionCode = string

/** 使用 uni-app 可兼容的方式构造查询字符串，避免依赖浏览器 Web API。 */
function buildQuery(params: Record<string, string | number | undefined>): string {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
}

/** 获取当前用户的推广汇总。 */
export function getPromotionSummary(): Promise<PromotionSummary> {
  return request<PromotionSummary>({ url: '/api/promotion/summary', method: 'GET' })
}

/** 按下单时间分页获取当前用户的推广明细。 */
export function getPromotionRecords(params: PromotionRecordQuery = {}): Promise<PromotionPageResult> {
  const query = buildQuery({
    startTime: params.startTime,
    endTime: params.endTime,
    page: params.page || 1,
    pageSize: params.pageSize || 10,
  })
  return request<PromotionPageResult>({ url: `/api/promotion/records?${query}`, method: 'GET' })
}

/**
 * 排行榜统计周期：`DAY`=日 / `WEEK`=周 / `MONTH`=月 / `YEAR`=年 / `ALL`=**总榜**（全时段累计）。
 * ⚠️ `ALL` 需要后端支持（api-docs 当前仅 DAY/WEEK/MONTH/YEAR），需求见
 * `docs/后端文档/排行榜总榜-后端需求-2026-09-18.md`；后端上线后前端**无需改动**即生效。
 */
export type LeaderboardPeriod = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'ALL'

/** 排行榜单行（对应后端 LeaderboardRow）。 */
export interface LeaderboardRow {
  /** 名次，从 1 开始；后端口径下名次唯一、没有并列。 */
  rank: number
  promoterUserId: string
  nickname: string
  /** 头像地址；用户未设置头像时为 null，前端需兜底占位。 */
  avatarUrl: string | null
  /** 统计周期内推广的人数（去重：同一个人下多单只算 1 人）。 */
  promotedUserCount: number
  /** 统计周期内产生的推广金（元）。 */
  promotionAmount: number
  /**
   * 该推广员**累计**推广人数（全时段去重，不受 `period` 影响）。
   * ⚠️ 后端尚未下发该字段（已提需求），缺失时页面不展示累计行。
   */
  totalPromotedUserCount?: number | null
  /** 该推广员**累计**推广金（元，全时段）；同样待后端下发。 */
  totalPromotionAmount?: number | null
  /** 是否当前登录用户本人（用于列表高亮）。 */
  isMe: boolean
}

/**
 * 推广排行榜（对应后端 PromotionLeaderboardVO）。
 * 口径：只统计「推广金已生成」（被推广人支付成功）且未退款作废的记录，时间锚点 = 支付时间 `pay_time`。
 */
export interface PromotionLeaderboard {
  period: LeaderboardPeriod
  /** 周期中文标签（如「本周」），直接取后端下发值展示。 */
  periodLabel: string
  /** 周期起点（含）。 */
  periodStart: string
  /** 周期**理论**终点（含）；滚动口径下真实数据上界是 `asOf`，不要拿它当截止时间。 */
  periodEnd: string
  /** 统计截止时刻（= 请求时刻），页面需据此标注「数据截至 xx:xx」。 */
  asOf: string
  /** 当前周期是否已走完；滚动口径（含未走完的当前周期）下**恒为 false**。 */
  periodComplete: boolean
  /** 本次返回的榜单条数上限。 */
  limit: number
  /** 我的名次；本周期没有有效推广时为 null（人数与金额均为 0）。 */
  myRank: number | null
  /** 我本周期推广的人数（去重）。 */
  myPromotedUserCount: number
  /** 我本周期产生的推广金（元）。 */
  myPromotionAmount: number
  /** 我是否已出现在 list 中；false 表示我不在前 limit 名内，页面需单独展示「我的排名」。 */
  myRankInList: boolean
  list: LeaderboardRow[]
}

/**
 * 获取推广排行榜。
 * 滚动口径：周期终点恒为「此刻」，`periodComplete` 恒为 false，
 * 展示时必须用 `asOf` 标注「数据截至」，不要当成完整周期的定稿数字。
 */
export function getPromotionLeaderboard(period: LeaderboardPeriod = 'WEEK', limit = 20): Promise<PromotionLeaderboard> {
  const query = buildQuery({ period, limit })
  return request<PromotionLeaderboard>({ url: `/api/promotion/leaderboard?${query}`, method: 'GET' })
}

/** 推广码落地页：非 tabBar 中转页，扫码后解析推广关系再跳首页（tabBar 页不能直接作为小程序码 page）。 */
export const PROMOTION_LANDING_PAGE = 'pages/promo/landing'

/** 生成带当前推广者身份的小程序码，默认落地到非 tabBar 的推广中转页。 */
export function getPromotionCode(page = PROMOTION_LANDING_PAGE): Promise<PromotionCode> {
  const query = buildQuery({ page })
  return request<PromotionCode>({ url: `/api/promotion/code?${query}`, method: 'GET' })
}

/** 为已登录用户补绑定推广关系。 */
export function bindPromotion(promoterId: number): Promise<boolean> {
  const query = buildQuery({ promoterId })
  return request<boolean>({ url: `/api/promotion/bind?${query}`, method: 'POST' })
}
