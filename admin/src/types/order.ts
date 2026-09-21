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
  /** 下单用户 ID（B 端排查/对应到下单用户）。 */
  userId: string | number
  status: OrderStatus
  statusDesc: string
  payAmount: number
  /**
   * 支付渠道（后端 2026-09-21 新增）：0=微信支付 / 1=余额支付 / null=未选渠道（订单未支付或已关闭）。
   * 该字段是**退款分流依据** —— 微信支付退款调微信 API 原路退回零钱，余额支付直接退回钱包 balance。
   * ⚠️ 订单关闭时后端会清空 `pay_channel`（`OrderMapper#closeOrder`），所以**已关闭订单恒为 null**，
   * 前端按可空处理，不要当 0（0 是"微信支付"，含义完全不同）。
   */
  payChannel?: number | null
  /**
   * 支付渠道中文名「微信支付」/「余额支付」，未支付为 null。
   * 后端已按 `common.constant.PayChannel` 映射好，**前端直接展示，无需自己映射**。
   */
  payChannelDesc?: string | null
  /**
   * 红包/推广痕迹（后端 2026-09-21 新增）：该订单是否存在红包贡献 / 红包槽位 / 推广关系（任一存在即 true）。
   * 用途：决定「线下退款冲账」入口显隐 —— 前端**只在 `pickupType === 1 && status === 8 && hasDividendTrace === true`**
   * 时显示该入口（api-docs 原文："不再靠 pickupType+status 猜"，否则没有痕迹的自提单也会冒出入口）。
   * ⚠️ 只表示"有痕迹"，**不代表可冲账**（是否已冲账看冲账预演的 executed）；C 端订单接口不填充该字段（返回 null）。
   */
  hasDividendTrace?: boolean | null
  totalQuantity: number
  firstProductImage: string
  /** 第一件商品名称（下单时快照；后端 2026-09-15 新增，列表商品列直接展示）。 */
  firstProductName?: string
  /**
   * 物流订单配送状态：0=已发货 / 1=已送达（仅物流订单有值，自提/未发货/退款为 null）。
   * 注意与「同城配送」的 deliveryStatus（字符串枚举）不是一回事。
   */
  deliveryStatus?: number | null
  createTime: string
  delFlag: OrderDeleteFlag
  pickupType: OrderPickupType
  /** 自提门店名称（pickup_type=1 时有值，物流订单为 null）。 */
  shopName?: string
  /** 买家微信昵称。 */
  buyerName?: string
  /** 买家手机号（**两端均明文**，与收货人手机号不同，不做脱敏）。 */
  buyerPhone?: string
  /**
   * 按 `pickupType` 派生的状态展示名（后端 2026-09-15 新增，**推荐直接使用**）：
   * 物流 1→待发货 / 自提 1→**待核销** / 同城 1→履约中；`0/5/7` 三类一致。
   */
  statusTextByType?: string
  /** 微信发货信息上报状态：0 未上报 / 1 已上报 / 2 失败 / 3 无需上报（超 7 天或退款关闭豁免）。 */
  wxShippingStatus?: number
  /** 上报失败/豁免原因（`status=2/3` 时有值；成功时为"上报成功"）。 */
  wxShippingErrmsg?: string
  /** 最近一次上报成功时间。 */
  wxShippingUploadTime?: string
}

/** 后台订单详情返回的数据结构。 */
export interface OrderDetail extends Order {
  receiverName: string
  /**
   * 收货人/取货人电话。
   * **B 端后台一律明文**（物流发货/联系客户需要）；C 端物流订单脱敏、自提订单明文。
   * 口径见后端 `common.utils.PhoneMaskUtils`（2026-09-15 后端已实现，无需再做脱敏兜底）。
   */
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
  /**
   * 微信「发货信息管理」上报状态（后端提供后自动展示）：
   * 0 未上报 / 1 已上报 / 2 失败 / 3 无需上报（超期或退款关闭豁免）；字段未返回时前端不展示该区块。
   */
  wxShippingStatus?: number
  /** 微信上报失败/豁免原因（wxShippingStatus=2/3 时展示）。 */
  wxShippingErrmsg?: string
  /** 微信上报时间。 */
  wxShippingUploadTime?: string
}

/** 手动重试上报的返回（§3.2）。 */
export interface WxShippingRetryResult {
  orderId?: number
  /** 是否真的调用了微信（已上报过则为 false）。 */
  called?: boolean
  success?: boolean
  /** 结果说明：已上报微信 / 该订单已上报过，未重复调用微信 / 失败原因 / 跳过原因。 */
  message?: string
  wxShippingStatus?: number
  wxShippingStatusDesc?: string
  wxShippingErrmsg?: string
  wxShippingUploadTime?: string
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
  /**
   * 按用户 ID 查该用户全部订单（**2026-09-21 新增**，后端 int64）。
   * 不传=不筛选；可与 `orderNo` 同时传（同时生效）。
   * ⚠️ 这里按 string 传：id 类字段在本项目一律按字符串落地，避免 JS number 精度丢失（用户输入本就是字符串）。
   */
  userId?: string
  /** 微信发货上报状态筛选（2026-09-15 新增）：0 未上报 / 1 已上报 / 2 失败 / 3 无需上报；不传=全部。 */
  wxShippingStatus?: number
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

/** 轨迹接口响应外层（后端 ExpressTraceResponse）：status 为 AVAILABLE 时轨迹在 trace 子对象。 */
export interface ExpressTraceResponse {
  /** AVAILABLE=有轨迹；MISSING_CARRIER_CODE=无快递编码；NOT_SHIPPED=未发货；NOT_APPLICABLE_PICKUP=自提；TEMPORARILY_UNAVAILABLE=查不到。 */
  status: string
  trace: ExpressTrace | null
  retrievable: boolean
  source: string
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
