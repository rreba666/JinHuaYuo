/** 红包每日 9 点后才展示/检测：9 点前不向用户展示红包，保证用户基本在 9 点后看到红包。 */

/** 红包每日展示起始时间（本地 9:00）。 */
const BONUS_SHOW_HOUR = 9

/** 当前是否已到红包展示时间（>= 9:00）。未到返回 false。 */
export function isBonusShowTime(now: Date = new Date()): boolean {
  return now.getHours() >= BONUS_SHOW_HOUR
}

/** 当前是否在红包展示时间之前（< 9:00）。 */
export function isBeforeBonusShowTime(now: Date = new Date()): boolean {
  return !isBonusShowTime(now)
}
