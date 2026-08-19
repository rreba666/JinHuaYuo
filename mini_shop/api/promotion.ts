import { request } from '@/utils/request'

/** 推广中心汇总（对应 PromotionSummaryVO）。 */
export interface PromotionSummary {
  totalPromotion: number
  boundUserCount: number
  pendingPromotion: number
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
