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

/**
 * 老层发放模式（通用配置键 `dividend_old_layer_mode`）。
 *
 * - `ROTATION`：按名单 7 天轮转（历史口径，默认）—— 按 `7/7/7/8/8/8/9` 分到 7 天；
 * - `ONE_SHOT`：只在池首发放日（自然周口径下即**周一**）一次性把当周合格槽位发完，D2~D7 老层为 0。
 *
 * ⚠️ 两种模式**每人的钱与整周总额完全一样**，只是到账时点不同（对接文档 §1.2）。
 */
export type OldLayerMode = 'ROTATION' | 'ONE_SHOT'

/**
 * 老层发放模式配置。
 *
 * ⚠️ **后端读取端对非法值是静默回退 `ROTATION` 的**，所以前端提交前必须只允许这两个值
 * （写入端会硬校验，其它值返回 `code=400`）—— 否则会出现"后台显示改了、线上其实没生效"这种最难排查的情况。
 * ⚠️ **生效时点**：发放时读配置，**从下一个建池的池开始生效**；必须在建池前设置好，设晚了当周改不回来。
 */
export interface OldLayerModeConfig {
  mode: OldLayerMode
  remark: string
}
