/** 应急红包池总账（对应后端 EmergencyPoolVO）。 */
export interface EmergencyPoolOverview {
  /** 当前应急红包池余额（元）。 */
  balance: number
  /** 累计抽取（元）。 */
  totalDeduct: number
  /** 累计注入（元）。 */
  totalInject: number
  /** 待注入（元，下次结算加入父奖池）。 */
  pendingInject: number
}

/** 应急红包池流水记录。 */
export interface EmergencyPoolLog {
  id: string
  /** 流水类型：DEDUCT=抽取，INJECT=注入，INJECT_SETTLE=注入结算。 */
  type: 'DEDUCT' | 'INJECT' | 'INJECT_SETTLE' | string
  amount: number
  /** 关联信息（如订单号/结算日期）。 */
  remark?: string
  createTime: string
}

/** 应急红包池流水分页结果。 */
export interface EmergencyPoolLogPageResult {
  total: number
  list: EmergencyPoolLog[]
  page: number
  pageSize: number
}

/** 注入应急红包池请求体。 */
export interface EmergencyPoolInjectDTO {
  amount: number
}

export interface EmergencyPoolResponse<T> {
  code: number
  message: string
  data?: T | null
  success?: boolean
}
