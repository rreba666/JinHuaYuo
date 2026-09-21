/** 后台产品购买记录。接口只返回已付款且未退款的有效订单明细。 */
export interface SalesRecord {
  orderNo: string
  productName: string
  nickname: string
  quantity: number
  price: number
  subtotal: number
  createTime: string
  payTime?: string
  status: number
  statusDesc: string
  /**
   * 支付渠道（后端 2026-09-21 新增）：0=微信支付 / 1=余额支付 / null=未选渠道（未支付或已关闭）。
   * 财务导出对账时可按该列区分两种收款渠道。
   */
  payChannel?: number | null
  /** 支付渠道中文名「微信支付」/「余额支付」，未支付为 null（后端已映射好，直接展示）。 */
  payChannelDesc?: string | null
}

export interface SalesRecordQueryParams {
  productName?: string
}

export type DashboardTimeRange = '7' | '30' | '90' | 'all'

export interface ProductSales {
  name: string
  quantity: number
  amount: number
}

export interface DailySales {
  date: string
  quantity: number
  amount: number
}

export interface DashboardAnalytics {
  totalRecords: number
  totalQuantity: number
  totalAmount: number
  averagePrice: number
  productSales: ProductSales[]
  dailySales: DailySales[]
}

export interface DashboardResponse<T = unknown> {
  code: number
  message: string
  data?: T | null
  success?: boolean
}
