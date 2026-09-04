/** 奖品（对应 LuckyPrizeVO，config 返回；无 type 字段，全部按实物自提处理）。 */
export interface LuckyPrizeVO {
  /** 奖品 ID。 */
  prizeId: number
  /** 奖品名称。 */
  name: string
  /** 奖品图片 URL（可空）。 */
  image?: string | null
  /** 奖项等级（如"一等奖"/"谢谢参与"）。 */
  level?: string | null
}

/** 活动配置（对应 LuckyConfigVO，匿名可访问，返回当前启用且在时间窗口内的活动）。 */
export interface LuckyConfigVO {
  /** 活动 ID。 */
  activityId: number
  /** 活动名称。 */
  name: string
  /** 活动描述（可空）。 */
  description?: string | null
  /** 开始时间 yyyy-MM-dd HH:mm:ss。 */
  startTime: string
  /** 结束时间 yyyy-MM-dd HH:mm:ss。 */
  endTime: string
  /** 每人每日抽奖次数限制（null=不限）。 */
  dailyLimitPerUser: number | null
  /** 每人总抽奖次数限制（null=不限）。 */
  totalLimitPerUser: number | null
  /** 奖品列表（后端按 sortOrder 排序返回，数组顺序即转盘格位顺序）。 */
  prizes: LuckyPrizeVO[]
}

/** 抽奖结果（对应 LuckyDrawVO）。 */
export interface LuckyDrawVO {
  /** 是否中奖。 */
  won: boolean
  /** 中奖奖品 ID（未中奖为 null）。 */
  prizeId: number | null
  /** 中奖奖品名称（未中奖为 null）。 */
  prizeName: string | null
  /** 奖项等级（未中奖为 null）。 */
  level: string | null
  /** 核销码（8 位大写字母数字，中奖后到店出示；未中奖为 null）。 */
  verifyCode: string | null
  /** 提示文案（如"恭喜中奖！"/"很遗憾，未中奖"）。 */
  message: string
}

/** 中奖/抽奖记录（对应 LuckyRecordVO）。 */
export interface LuckyRecord {
  /** 记录 ID。 */
  id: number
  /** 所属活动 ID。 */
  activityId?: number
  /** 所属活动名称。 */
  activityName?: string | null
  /** 是否中奖。 */
  won: boolean
  /** 奖品名称（未中奖为 null）。 */
  prizeName: string | null
  /** 奖项等级（未中奖为 null）。 */
  level: string | null
  /** 状态：WON=待核销 VERIFIED=已核销（未中奖为 null）。 */
  status: 'WON' | 'VERIFIED' | null
  /** 核销码（中奖展示，未中奖为 null）。 */
  verifyCode: string | null
  /** 时间 yyyy-MM-dd HH:mm:ss。 */
  createTime: string
}

/** 记录分页结果。 */
export interface LuckyRecordPage {
  total: number
  list: LuckyRecord[]
  page: number
  pageSize: number
}
