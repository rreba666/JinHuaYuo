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

/** 应急红包池流水记录（后端 `DividendEmergencyPoolLogEntity`）。 */
export interface EmergencyPoolLog {
  id: string
  /**
   * 流水类型：
   * `DEDUCT`=订单抽取 / `INJECT`=后台注入 / `INJECT_SETTLE`=注入随结算入父奖池 / `REMAINDER`=发放均分余数。
   */
  type: 'DEDUCT' | 'INJECT' | 'INJECT_SETTLE' | 'REMAINDER' | string
  /**
   * 后端下发的**中文类型名**（2026-09-19 新增，优先直接展示）。
   * 未下发时前端按 `type` 兜底映射，保持兼容。
   */
  typeDesc?: string
  amount: number
  /** 来源订单号（仅 `DEDUCT`）。 */
  orderNo?: string
  /** 来源商品 ID（仅 `DEDUCT`）。 */
  productId?: number | string
  /** 来源商品名称（仅 `DEDUCT`；历史空白的记录后端会用 `orderNo` 反查订单首个明细补全）。 */
  productName?: string
  /** 操作管理员 ID（仅 `INJECT`）。 */
  operatorId?: number | string
  remark?: string
  createTime: string
}

/**
 * 流水汇总（2026-09-19 新增）。
 * **在当前筛选范围内聚合，与分页无关** —— 用来回答「这段时间一共抽了多少、多少笔」。
 */
export interface EmergencyPoolLogSummary {
  /** 抽取合计（元）。 */
  deductAmount: number
  /** 抽取笔数。 */
  deductCount: number
  /** 注入合计（元）。 */
  injectAmount: number
  /** 注入笔数。 */
  injectCount: number
  /** 发放均分余数合计（元）。 */
  remainderAmount: number
  /** 发放均分余数笔数。 */
  remainderCount: number
  /** 流水总条数（= `total`）。 */
  totalCount: number
  /**
   * 抽取人均额（= `deductAmount` ÷ `deductCount`），**口径校验用**。
   * 业务规则是「每单抽取 100」，所以正常恒为 `100`；**无抽取时为 `null`**（此时页面应显示「—」，不要当成 0 或 100）。
   */
  deductPerOrder: number | null
}

/** 应急红包池流水查询参数（2026-09-19 新增 type / 日期区间）。 */
export interface EmergencyPoolLogQuery {
  page: number
  pageSize: number
  /** 流水类型筛选；**不传 = 全部**。 */
  type?: string
  /** 发生日期区间（**含当天**，`yyyy-MM-dd`）。 */
  startDate?: string
  endDate?: string
}

/** 应急红包池流水分页结果。 */
export interface EmergencyPoolLogPageResult {
  total: number
  list: EmergencyPoolLog[]
  page: number
  pageSize: number
  /** 当前筛选范围的汇总；后端未下发时为 `null`（前端隐藏汇总区）。 */
  summary?: EmergencyPoolLogSummary | null
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
