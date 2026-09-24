import type { WithdrawRules, WithdrawType, WithdrawTypeQuota } from '@/api/user'

/**
 * 提现额度（可提现 / 锁定中）的共用口径 —— 对应后端 2026-09-24「逐笔解锁」改造。
 *
 * 背景：旧口径是**账户级**锁定 —— 只要 240 小时内有已支付订单，**整个账户**（含早就赚到的历史收益）都提不出来。
 * 新口径是**每笔收益各自**解锁：解锁时刻 = **该笔收益来源订单**的支付时间 + `payLockDays`。
 * 于是「能提多少 / 还有多少锁着 / 什么时候解锁」必须按 `type` 分开看：
 * 余额页 `BALANCE`、推广金页 `PROMOTION`、红包页 `BONUS`。
 *
 * 抽到这里的理由：提现页、推广金页、红包页三处都要展示同一套口径，
 * 各写一份极易漂移（本项目已经在「白名单重建」上栽过 4 次），所以统一走这里。
 */

/** 金额格式化为两位小数（与各页 `formatMoney` 同口径），避免本模块依赖页面的私有函数。 */
function money(value: unknown): string {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount.toFixed(2) : '0.00'
}

/**
 * 从 `withdraw-rules` 响应中取出指定 `type` 的额度明细。
 *
 * 取值顺序：`byType[type]` → 顶层 flat 字段 → `null`。
 * ⚠️ 顶层 flat 字段只代表**它自己那个 type**（后端默认 `BALANCE`），
 * 所以 `rules.type` 与本页要的 `type` 不一致时**不能借用**，否则会把余额的口径错当成推广金的。
 * 返回 `null` 表示后端未下发新字段（旧后端）⇒ 调用方保持原样展示、不要显示额度提示、也不要做上限校验。
 */
export function pickWithdrawQuota(rules: WithdrawRules | null | undefined, type: WithdrawType): WithdrawTypeQuota | null {
  if (!rules) return null
  const fromByType = rules.byType?.[type]
  if (fromByType) return fromByType
  const flatType = rules.type || 'BALANCE'
  if (flatType !== type || rules.withdrawableAmount == null) return null
  return {
    type,
    withdrawableAmount: Number(rules.withdrawableAmount) || 0,
    lockedAmount: Number(rules.lockedAmount) || 0,
    nextUnlockAt: rules.nextUnlockAt ?? null,
    nextUnlockAmount: Number(rules.nextUnlockAmount) || 0,
    pendingAmount: Number(rules.withdrawableAmount) + Number(rules.lockedAmount || 0),
    message: null,
  }
}

/** 该口径下**当前可提现**金额（元）。 */
export function quotaWithdrawable(quota: WithdrawTypeQuota | null): number {
  return Math.max(0, Number(quota?.withdrawableAmount) || 0)
}

/** 该口径下**锁定中**金额（元）。 */
export function quotaLocked(quota: WithdrawTypeQuota | null): number {
  return Math.max(0, Number(quota?.lockedAmount) || 0)
}

/** 该口径下是否还有可动用的钱（用于决定「转余额」是否可点、是否提示暂无可转）。 */
export function hasWithdrawable(quota: WithdrawTypeQuota | null): boolean {
  return quotaWithdrawable(quota) > 0
}

/**
 * 额度提示文案：**始终**给出「当前可 X ¥Y」；有锁定时追加「另有 ¥Y 锁定中，Z 后解锁」。
 *
 * - `action` 用于适配不同页面措辞：提现页「提现」、推广金页/红包页「转余额」。
 * - ⚠️ 后端拼好的 `message` 是按「**提现**」措辞写的 ⇒ **只有默认措辞才直接采用它**，
 *   否则推广金页会出现「当前可提现 204.30」这种与页面动作不符的说法。
 * - 后端未下发额度（旧后端）⇒ 返回空串，调用方不展示该提示（而不是显示一个错的数）。
 */
export function buildQuotaHint(quota: WithdrawTypeQuota | null, action = '提现'): string {
  if (!quota) return ''
  if (action === '提现' && quota.message) return quota.message
  const available = money(quota.withdrawableAmount)
  const locked = quotaLocked(quota)
  if (locked <= 0) return `当前可${action} ¥${available}`
  const unlock = quota.nextUnlockAt ? `${quota.nextUnlockAt} 后解锁` : '到解锁时刻后可解锁'
  return `当前可${action} ¥${available}；另有 ¥${money(locked)} 锁定中，${unlock}`
}

/**
 * 转余额/提现后的补充提示：仍有锁定金额时给出「另有 ¥Y 锁定中，Z 后解锁」，否则返回空串。
 * 用于「一键转余额」这种**只转已解锁部分**的操作（旧后端/无锁定时不显示任何多余文案）。
 */
export function buildLockedRemainderHint(quota: WithdrawTypeQuota | null): string {
  const locked = quotaLocked(quota)
  if (locked <= 0) return ''
  const unlock = quota?.nextUnlockAt ? `${quota.nextUnlockAt} 后解锁` : '到解锁时刻后可解锁'
  return `另有 ¥${money(locked)} 锁定中，${unlock}`
}
