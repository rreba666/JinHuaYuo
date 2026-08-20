/** 后端订单状态码：0-7 常规状态，8 已核销。 */
export type OrderStatus = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
export type OrderDeleteFlag = 0 | 1
export type OrderPickupType = 0 | 1

export interface OrderItem {
  id: string
  productName: string
  skuName: string
  skuSpecs: string
  price: number
  quantity: number
  subtotal: number
  productImage?: string
}

/** 后台订单列表返回的数据结构。 */
export interface Order {
  id: string
  orderNo: string
  status: OrderStatus
  statusDesc: string
  payAmount: number
  totalQuantity: number
  firstProductImage: string
  createTime: string
  delFlag: OrderDeleteFlag
  pickupType: OrderPickupType
  /** 自提门店名称（pickup_type=1 时有值，物流订单为 null）。 */
  shopName?: string
  /** 买家微信昵称。 */
  buyerName?: string
  /** 买家手机号。 */
  buyerPhone?: string
}

/** 后台订单详情返回的数据结构。 */
export interface OrderDetail extends Order {
  receiverName: string
  receiverPhone: string
  receiverAddress: string
  totalAmount: number
  discountAmount: number
  freightAmount: number
  items: OrderItem[]
  expressCompany?: string
  expressNo?: string
  payTime?: string
  shipTime?: string
  completeTime?: string
  /** 自提码（自提订单支付后生成，用于到店核销）。 */
  pickupCode?: string
  /** 自提门店 ID。 */
  pickupShopId?: string
}

export interface OrderPageResult {
  total: number
  list: Order[]
  page: number
  pageSize: number
}

export interface OrderQueryParams {
  page: number
  pageSize: number
  /** 后端支持重复的 statuses 查询参数，可同时筛选多个订单状态。 */
  statuses?: OrderStatus[]
  pickupType?: OrderPickupType
  startTime?: string
  endTime?: string
  /** 订单号筛选（精确匹配，后端 /api/admin/order/list 支持）。 */
  orderNo?: string
}

export interface OrderAddressUpdateDTO {
  receiverName: string
  receiverPhone: string
  receiverAddress: string
}

export interface OrderShipDTO {
  expressCompany: string
  expressCompanyCode: string
  expressNo: string
}

/** 客服人工退款请求参数，原因允许为空但最长 200 个字符。 */
export interface OrderRefundDTO {
  reason?: string | null
}

/** 物流轨迹节点，后端返回顺序即为展示顺序。 */
export interface TraceItem {
  time: string
  context: string
}

/** 快递查询结果；无物流数据时接口 data 为 null。 */
export interface ExpressTrace {
  com: string
  nu: string
  state: string
  stateDesc: string
  isCheck: 0 | 1
  traces: TraceItem[]
}

export interface ManualVerifyDTO {
  code: string
}

export interface OrderResponse<T> {
  code: number
  message: string
  data?: T | null
  success?: boolean
}
