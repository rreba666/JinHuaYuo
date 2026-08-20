import { getPromotionRecords, type PromotionRecord } from '@/api/promotion'

export const PROMOTION_FREEZE_DAYS = 7
export const PROMOTION_FREEZE_MS = PROMOTION_FREEZE_DAYS * 24 * 60 * 60 * 1000

/** 将本地时间格式化为推广记录接口要求的查询格式。 */
export function formatPromotionQueryDate(timestamp: number): string {
  const date = new Date(timestamp)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** 只有有效订单产生的推广金才进入冻结展示。 */
export function isActivePromotionRecord(record: PromotionRecord): boolean {
  return [1, 2, 3, 4, 8].includes(Number(record.status))
}

/** 判断推广记录在指定时间是否仍处于七天冻结期内。 */
export function isFrozenPromotion(record: PromotionRecord, now = Date.now()): boolean {
  if (!isActivePromotionRecord(record)) return false
  const createdAt = Date.parse(String(record.createTime || '').replace(' ', 'T'))
  if (!Number.isFinite(createdAt)) return false
  const age = now - createdAt
  return age >= 0 && age < PROMOTION_FREEZE_MS
}

/** 汇总指定推广记录中的冻结金额。 */
export function getFrozenPromotionAmount(records: PromotionRecord[], now = Date.now()): number {
  return records
    .filter((record) => isFrozenPromotion(record, now))
    .reduce((total, record) => {
      const amount = Number(record.amount)
      return total + (Number.isFinite(amount) && amount > 0 ? amount : 0)
    }, 0)
}

/** 查询最近七天的推广记录，供个人页和推广页统一计算展示金额。 */
export async function loadFrozenPromotionAmount(now = Date.now()): Promise<number> {
  const startTime = formatPromotionQueryDate(now - PROMOTION_FREEZE_MS)
  const endTime = formatPromotionQueryDate(now)
  const recentRecords: PromotionRecord[] = []
  let page = 1
  let total = 0
  try {
    do {
      const result = await getPromotionRecords({ startTime, endTime, page, pageSize: 100 })
      recentRecords.push(...(result.list || []))
      total = Number(result.total) || recentRecords.length
      page += 1
      if (!result.list?.length) break
    } while (recentRecords.length < total)
    return getFrozenPromotionAmount(recentRecords, now)
  } catch {
    return 0
  }
}
