/** 系统配置实体。 */
export interface SysConfig {
  id: string
  configKey: string
  configValue: string
  remark: string
  createTime: string
  updateTime: string
  delFlag: number
}

/** 系统配置保存参数。 */
export interface SysConfigSaveDTO {
  configKey: string
  configValue: string
  remark?: string
}

/** 红包上限倍率配置。 */
export interface DividendCap {
  multiplier: number
  remark: string
}

/** 红包上限倍率保存参数。 */
export interface DividendCapSaveDTO {
  multiplier: number
  remark?: string
}

/** 每日随机红包配置（金额下限/上限，元）。 */
export interface RandomDividendConfig {
  minAmount: number
  maxAmount: number
  remark: string
}

/** 红包随机浮动幅度配置（池2起：每人分到的金额 = 均分基准 ± 浮动幅度，元）。 */
export interface RandomFloatConfig {
  floatAmount: number
  remark: string
}

/** 红包槽位数量上限配置（每用户最多活跃槽位数，默认 3）。 */
export interface SlotCountConfig {
  slotCount: number
  remark: string
}

/**
 * 排行榜显示人数配置（后台控制 C 端小程序与后台榜单显示前几名）。
 * 未配置时默认 20（与后端接口 limit 默认值一致），取值范围 1~100。
 */
export interface LeaderboardLimitConfig {
  /** 榜单显示前几名（1~100）。 */
  limit: number
  remark: string
}

/** 商品资金比例配置。 */
export interface ProfitRatesConfig {
  promotionRate: number
  bonusPoolRate: number
  remark: string
}

/** 商品资金比例保存参数。 */
export interface ProfitRatesSaveDTO {
  promotionRate: number
  bonusPoolRate: number
  remark?: string
}

export interface WithdrawRulesConfig {
  minAmount: number
  dailyAmountLimit: number
  dailyCountLimit: number
  feeRate: number
  testUserMinAmount: number
  testUserId: number | null
  testSkipLock: boolean
  maxConcurrent: number
  frozenLimit: number
  remark: string
  /**
   * 支付后锁定期天数（`WithdrawRuleVO.payLockDays`）：最近 N 天有订单支付的用户不可提现。
   * ⚠️ **只读** —— 保存用的 `WithdrawRuleSaveDTO` 里没有这个字段（2026-09-16 api-docs 确认），
   * 所以界面上只展示、提交时不带它（避免后端严格校验未知字段时报错）。
   */
  payLockDays: number
}

/** 保存用 DTO：不含只读的 `payLockDays`。 */
export type WithdrawRulesSaveDTO = Omit<WithdrawRulesConfig, 'payLockDays'>

/** 兼容旧版单项比例类型。 */
export interface FundRateConfig {
  rate: number
  remark: string
}

/** 兼容旧版单项比例保存参数。 */
export interface FundRateSaveDTO {
  rate: number
  remark?: string
}
