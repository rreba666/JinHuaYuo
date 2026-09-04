/** 幸运抽奖 B 端相关类型（对应 wxstore v1.6.0 / fengling-lucky 契约）。 */

/** 活动状态：0=停用 1=启用。 */
export type LuckyActivityStatus = 0 | 1

/** 奖品项（对应 LuckyPrizeDTO / LuckyPrizeVO）。 */
export interface LuckyPrize {
  /** 奖品 ID（编辑回显；新增时为空）。 */
  prizeId?: number | null
  /** 奖品名称。 */
  name: string
  /** 奖品图片 URL（可空）。 */
  image?: string | null
  /** 奖项等级（如"一等奖"/"谢谢参与"）。 */
  level?: string | null
  /** 中奖概率百分比（0~100，所有奖品含「谢谢参与」加总须=100）。 */
  probability: number
  /** 总库存。 */
  stock: number
  /** 展示排序（越小越靠前）。 */
  sortOrder?: number
  /** 剩余库存（回显用，新增忽略）。 */
  remainingStock?: number | null
}

/** 内定名单项（对应 LuckyRiggedVO）. */
export interface LuckyRigged {
  /** 内定用户 ID。 */
  userId: number
  /** 内定奖品 ID（须属于该活动）。 */
  prizeId: number
  /** 状态：UNUSED=未发放 USED=已发放。 */
  status?: 'UNUSED' | 'USED'
}

/** 创建/更新活动请求体（对应 LuckyActivityDTO）。 */
export interface LuckyActivitySaveDTO {
  name: string
  description?: string | null
  status: LuckyActivityStatus
  startTime: string
  endTime: string
  dailyLimitPerUser?: number | null
  totalLimitPerUser?: number | null
  prizes: LuckyPrize[]
}

/** 活动详情/列表元素（对应 LuckyActivityVO）。 */
export interface LuckyActivityVO {
  id: number
  name: string
  description?: string | null
  status: LuckyActivityStatus
  startTime: string
  endTime: string
  dailyLimitPerUser?: number | null
  totalLimitPerUser?: number | null
  prizes: LuckyPrize[]
  /** 内定名单（详情接口返回）。 */
  rigged?: LuckyRigged[]
  createTime?: string
}

/** 抽奖记录 VO（后台核销/查询用，与 C 端一致）。 */
export interface LuckyRecordVO {
  id: number
  activityId?: number
  activityName?: string | null
  won: boolean
  prizeName?: string | null
  level?: string | null
  status?: 'WON' | 'VERIFIED' | null
  verifyCode?: string | null
  createTime?: string
}

/** 分页结果. */
export interface PageResult<T> {
  list: T[]
  total: number
  page?: number
  pageSize?: number
}

/** 活动列表分页查询参数。 */
export interface LuckyActivityQuery {
  page?: number
  pageSize?: number
}

/** 抽奖记录分页查询参数。 */
export interface LuckyRecordQuery {
  page?: number
  pageSize?: number
}
