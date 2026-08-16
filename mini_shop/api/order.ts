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
  totalQuantity: number
  firstProductImage: string
  createTime: string
  pickupType: PickupType
  buyerName?: string
  buyerPhone?: string
  shopName?: string
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
  receiverName?: string
  receiverPhone?: string
  receiverAddress?: string
  remark?: string
  pickupShopId?: number
  pickupStatus?: number
  /** 自提码（12 位，自提订单支付后生成，用于到店核销）。 */
  pickupCode?: string
  /** 自提二维码内容（形如 {PICKUP_BASE_URL}?c=自提码），前端据此生成二维码。 */
  pickupUrl?: string
  items?: OrderDetailItem[]
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

/** 查询当前用户订单列表，支持多状态筛选（后端 statuses 数组参数）。 */
export function getOrderList(params: { page?: number; pageSize?: number; statuses?: OrderStatus[] } = {}): Promise<OrderPageResult> {
  const query = [
    `page=${encodeURIComponent(String(params.page || 1))}`,
    `pageSize=${encodeURIComponent(String(params.pageSize || 10))}`,
  ]
  if (params.statuses && params.statuses.length) {
    for (const status of params.statuses) query.push(`statuses=${encodeURIComponent(String(status))}`)
  }
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
