/** 奖品类型：REAL=实物 INTEGRAL=积分 COUPON=优惠券 NONE=谢谢参与。 */
export type LuckyPrizeType = 'REAL' | 'INTEGRAL' | 'COUPON' | 'NONE'

/** 奖品（对应 LuckyPrizeVO）。 */
export interface LuckyPrizeVO {
  /** 格位索引（0 起）。 */
  index: number
  /** 奖品名称。 */
  name: string
  /** 奖品图片 URL（可空）。 */
  image?: string
  /** 概率权重（展示/配置用，抽奖由后端决定）。 */
  weight?: number
  /** 奖品类型。 */
  type?: LuckyPrizeType
  /** 是否谢谢参与兜底格。 */
  isDefault?: boolean
}

/** 活动配置（对应 LuckyConfigVO）。 */
export interface LuckyConfigVO {
  /** 活动 ID（字符串）。 */
  id: string
  /** 1=开启 0=关闭。 */
  enabled: number
  /** 开始时间 yyyy-MM-dd HH:mm:ss。 */
  startTime: string
  /** 结束时间 yyyy-MM-dd HH:mm:ss。 */
  endTime: string
  /** 每人每日抽奖次数上限。 */
  dailyCount: number
  /** 当前用户今日剩余次数。 */
  remainCount: number
  /** 活动规则文案。 */
  rule: string
  /** 奖品列表（按 index 排序）。 */
  prizes: LuckyPrizeVO[]
}

/** 抽奖结果（对应 LuckyDrawVO）。 */
export interface LuckyDrawVO {
  /** 命中的格位索引（驱动转盘指针）。 */
  prizeIndex: number
  /** 奖品名称。 */
  prizeName: string
  /** 奖品类型。 */
  prizeType: LuckyPrizeType
  /** 中奖记录 ID（字符串）。 */
  recordId: string
}

/** 中奖记录（对应 LuckyRecordVO）。 */
export interface LuckyRecord {
  /** 记录 ID（字符串）。 */
  id: string
  /** 奖品名称。 */
  prizeName: string
  /** 格位索引。 */
  prizeIndex: number
  /** 奖品类型。 */
  prizeType: LuckyPrizeType
  /** 状态：UNCLAIMED=待领取 CLAIMED=已领取 SHIPPED=已发奖 EXPIRE=已过期。 */
  status: string
  /** 时间 yyyy-MM-dd HH:mm:ss。 */
  createTime: string
}

/** 中奖记录分页结果。 */
export interface LuckyRecordPage {
  total: number
  list: LuckyRecord[]
  page: number
  pageSize: number
}
