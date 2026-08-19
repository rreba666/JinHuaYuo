import { request } from '@/utils/request'

export type OrderStatus = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
export type PickupType = 0 | 1

export interface OrderItemDTO {
  skuId: number
  quantity: number
}

export interface CreateOrderDTO {
  cartIds?: number[]
  items?: OrderItemDTO[]
  receiverName?: string
  receiverPhone?: string
  receiverAddress?: string
  remark?: string
  pickupType: PickupType
  pickupShopId?: number
}

export interface OrderSummary {
  id: number
  orderNo: string
  status: OrderStatus
  statusDesc: string
  payAmount: number
  /** 商品总额（原价合计，元），支付页小计展示。 */
  totalAmount?: number
  /** 减免额（优惠券抵扣，元），支付页优惠券行展示。 */
  discountAmount?: number
  totalQuantity: number
  firstProductImage: string
  createTime: string
  pickupType: PickupType
  buyerName?: string
  buyerPhone?: string
  shopName?: string
  /** 收货人姓名（物流订单，待后端在列表接口补字段） */
  receiverName?: string
  /** 收货人电话（物流订单） */
  receiverPhone?: string
  /** 收货地址（物流订单） */
  receiverAddress?: string
  /** 商品明细列表（列表接口补字段后展示设计稿商品卡片） */
  items?: OrderDetailItem[]
  /** 配送费（元） */
  freightAmount?: number
  /** 支付截止时间（格式 yyyy-MM-dd HH:mm:ss，仅待付款订单有值，前端据此倒计时） */
  payExpireTime?: string
  /** 第一件商品名（列表卡片标题，待后端在列表接口补字段） */
  firstProductName?: string
  /** 物流送达状态（待收货订单）：0=已发货(运输中)，1=已送达(待确认收货) */
  deliveryStatus?: number
}

export interface OrderDetailItem {
  productName?: string
  productImage?: string
  skuName?: string
  price?: number
  quantity?: number
  subtotal?: number
}

export interface OrderDetail extends OrderSummary {
  remark?: string
  pickupShopId?: number
  pickupStatus?: number
  /** 自提码（12 位，自提订单支付后生成，用于到店核销）。 */
  pickupCode?: string
  /** 自提二维码内容（形如 {PICKUP_BASE_URL}?c=自提码），前端据此生成二维码。 */
  pickupUrl?: string
}

/** 自提二维码信息（独立接口 GET /api/order/pickup-code/{orderId} 返回）。 */
export interface PickupCodeVO {
  pickupType: PickupType
  status: OrderStatus
  pickupCode: string | null
  pickupUrl: string | null
  pickupTime: string | null
}

export interface OrderPageResult {
  total: number
  list: OrderSummary[]
  page: number
  pageSize: number
}

export interface CreateOrderResult {
  id?: number | string
  orderId?: number | string
  orderNo?: string
}

/** 创建订单，购物车结算时传 cartIds，直接购买时传 items。 */
export function createOrder(data: CreateOrderDTO): Promise<CreateOrderResult> {
  return request<CreateOrderResult>({ url: '/api/order/create', method: 'POST', data })
}

/** 查询当前用户订单列表，支持多状态筛选（后端 statuses 数组参数）与配送方式筛选。 */
export function getOrderList(params: { page?: number; pageSize?: number; statuses?: OrderStatus[]; pickupType?: PickupType } = {}): Promise<OrderPageResult> {
  const query = [
    `page=${encodeURIComponent(String(params.page || 1))}`,
    `pageSize=${encodeURIComponent(String(params.pageSize || 10))}`,
  ]
  if (params.statuses && params.statuses.length) {
    for (const status of params.statuses) query.push(`statuses=${encodeURIComponent(String(status))}`)
  }
  if (params.pickupType !== undefined) query.push(`pickupType=${encodeURIComponent(String(params.pickupType))}`)
  return request<OrderPageResult>({ url: `/api/order/list?${query.join('&')}`, method: 'GET' })
}

/** 查询订单详情。 */
export function getOrderDetail(orderId: number | string): Promise<OrderDetail> {
  return request<OrderDetail>({ url: `/api/order/detail/${orderId}`, method: 'GET' })
}

/** 获取自提二维码信息（独立接口，核销/退款/超期关闭后 pickupCode 置 null）。 */
export function getPickupCode(orderId: number | string): Promise<PickupCodeVO> {
  return request<PickupCodeVO>({ url: `/api/order/pickup-code/${orderId}`, method: 'GET' })
}

/** 取消待支付订单。 */
export function cancelOrder(orderId: number | string): Promise<void> {
  return request<void>({ url: `/api/order/cancel/${orderId}`, method: 'POST' })
}

/** 确认收货，仅物流订单使用。 */
export function receiveOrder(orderId: number | string): Promise<void> {
  return request<void>({ url: `/api/order/receive/${orderId}`, method: 'POST' })
}

/** 申请订单退款。 */
export function refundOrder(orderId: number | string, reason?: string): Promise<void> {
  return request<void>({ url: `/api/order/refund/${orderId}`, method: 'POST', data: reason ? { reason } : {} })
}
