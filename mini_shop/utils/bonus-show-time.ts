/** 红包展示时间控制（已取消 9 点前隐藏）：红包后台发放后前端实时展示，不再限制展示时间。 */

/** 当前是否已到红包展示时间（>= 9:00）。已取消限制，恒为 true，保留函数避免旧调用报错。 */
export function isBonusShowTime(now: Date = new Date()): boolean {
  void now
  return true
}

/** 当前是否在红包展示时间之前（< 9:00）。已取消限制，恒为 false。 */
export function isBeforeBonusShowTime(now: Date = new Date()): boolean {
  void now
  return false
}
