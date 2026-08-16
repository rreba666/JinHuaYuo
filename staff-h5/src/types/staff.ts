/** 店员登录请求体。 */
export interface StaffLoginDTO {
  /** 工号/账号。 */
  username: string
  /** 密码。 */
  password: string
}

/** 店员登录返回。 */
export interface StaffLoginVO {
  /** Staff JWT，30 分钟有效。 */
  token: string
  /** 店员姓名。 */
  staffName: string
  /** 过期时间戳（毫秒）。 */
  expireAt: number
}

/** 店员核销请求体。 */
export interface StaffVerifyDTO {
  /** 12 位自提码。 */
  code: string
  /** 核销方式：0=扫码，1=手动输码（默认 0）。 */
  verifyType?: 0 | 1
}

/** 核销结果中的商品明细。 */
export interface StaffVerifyItem {
  productName: string
  quantity: number
}

/** 店员核销返回。 */
export interface StaffVerifyVO {
  orderId: number | string
  orderNo: string
  payAmount: number
  verifyTime: string
  items: StaffVerifyItem[]
}

/** 后端统一响应结构。 */
export interface StaffResponse<T> {
  code: number
  message: string
  data?: T | null
  success?: boolean
}
