import { getPromotionRecords, type PromotionRecord } from '@/api/promotion'

/**
 * 推广金冻结天数 = **订单支付后 10 天提现锁**（后端口径，见 api-docs：
 * `GET /api/user/profile` 的「提现权限由实名认证、余额、10 天提现锁决定」、
 * 提现配置里的「测试用户是否跳过支付后 10 天提现锁」）。
 *
 * ⚠️ 历史坑：这里原先写的是 **7 天**（与后端 10 天不一致），导致第 8~10 天的收益被前端
 * 误判为"已解冻"，用户看着能转余额/能提现却会被后端拒绝。2026-09-15 已按后端口径改为 10 天。
 *
 * 🆕 2026-09-16 后端口径更新（以 api-docs 为准）：
 * - 锁定期为**支付时刻起精确 N×24 小时**（`payLockDays=10` 即 240 小时），不再按自然日零点解锁；
 * - 钱包 `GET /api/wallet/info` 与推广汇总 `GET /api/promotion/summary` **直接下发 `unsettledPromotion`**（待到账），
 *   展示合计口径 = `pendingPromotion + unsettledPromotion`，**前端不再需要自行汇总**；
 * - 推广明细新增 `promotionStatus`（PENDING / PROCESSING / CONFIRMED）与同名过滤参数。
 * 因此本文件的时间口径**只在上游未下发上述字段时兜底**，不再是主口径。
 */
export const PROMOTION_FREEZE_DAYS = 10
export const PROMOTION_FREEZE_MS = PROMOTION_FREEZE_DAYS * 24 * 60 * 60 * 1000

/**
 * 「尚未结算到账」的查询窗口：60 天。
 *
 * 正常记录会在「支付后 7 天退款窗口」结束后由后端定时任务入账（进入钱包 `pendingPromotion`）；
 * 但实测存在**超过 10 天仍未入账**的记录 —— 用户反馈：转余额后那笔推广金直接不显示了，
 * 要等后端约 1 小时的定时任务才恢复。因此这里用 60 天窗口兜住这类延迟，避免漏算用户已产生的推广金。
 */
export const PROMOTION_SETTLEMENT_QUERY_DAYS = 60
export const PROMOTION_SETTLEMENT_QUERY_MS = PROMOTION_SETTLEMENT_QUERY_DAYS * 24 * 60 * 60 * 1000

/** 「尚未结算到账」分页拉取的每页条数与最大页数（防止异常数据量拖慢页面）。 */
export const PROMOTION_SETTLEMENT_PAGE_SIZE = 100
export const PROMOTION_SETTLEMENT_MAX_PAGES = 5

/** 将本地时间格式化为推广记录接口要求的查询格式。 */
export function formatPromotionQueryDate(timestamp: number): string {
  const date = new Date(timestamp)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** 只有有效订单产生的推广金才进入统计与展示。 */
export function isActivePromotionRecord(record: PromotionRecord): boolean {
  return [1, 2, 3, 4, 8].includes(Number(record.status))
}

/** 判断推广记录在指定时间是否仍处于 10 天冻结期内（仅用于明细行「冻结」标记）。 */
export function isFrozenPromotion(record: PromotionRecord, now = Date.now()): boolean {
  if (!isActivePromotionRecord(record)) return false
  const createdAt = Date.parse(String(record.createTime || '').replace(' ', 'T'))
  if (!Number.isFinite(createdAt)) return false
  const age = now - createdAt
  return age >= 0 && age < PROMOTION_FREEZE_MS
}

/**
 * 是否为「平台尚未结算到账」的推广金。
 *
 * 优先使用后端 `promotionStatus`：
 * - `PENDING`：待到账，**金额尚未进入钱包 `pendingPromotion`**（因此必须单独展示）；
 * - `CONFIRMED`：已入账推广人钱包（此时已计入 `pendingPromotion`，不能重复计算）。
 *
 * 字段缺失（老数据 / 接口未返回）时，回退到「记录创建时间在 10 天内」的时间口径。
 *
 * ⚠️ 2026-09-16 修正：此前**一律**用 10 天时间口径估算，导致「已产生但后端仍未入账、
 * 且下单已超过 10 天」的那笔被漏算 —— 用户点「转余额」后 `pendingPromotion` 被后端清零，
 * 页面合计直接变成 0（要等后端定时任务入账才恢复），极易起纠纷。
 */
export function isPendingSettlementRecord(record: PromotionRecord, now = Date.now()): boolean {
  if (!isActivePromotionRecord(record)) return false
  const status = String(record.promotionStatus || '').toUpperCase()
  // PROCESSING = 入账占坑中间态（毫秒级），后端口径同样算「待到账」
  if (status === 'PENDING' || status === 'PROCESSING') return true
  if (status === 'CONFIRMED') return false
  return isFrozenPromotion(record, now)
}

/**
 * 汇总「平台尚未结算到账」的推广金。
 * 这些金额不在钱包 `pendingPromotion` 里，展示合计时必须加上，否则转余额后会凭空消失。
 */
export function getPendingSettlementAmount(records: PromotionRecord[], now = Date.now()): number {
  return records
    .filter((record) => isPendingSettlementRecord(record, now))
    .reduce((total, record) => {
      const amount = Number(record.amount)
      return total + (Number.isFinite(amount) && amount > 0 ? amount : 0)
    }, 0)
}

/** 查询近期推广记录，计算「尚未结算到账」的推广金（个人页与推广页统一使用）。 */
export async function loadPendingSettlementAmount(now = Date.now()): Promise<number> {
  const startTime = formatPromotionQueryDate(now - PROMOTION_SETTLEMENT_QUERY_MS)
  const endTime = formatPromotionQueryDate(now)
  const records: PromotionRecord[] = []
  let page = 1
  let total = 0
  try {
    do {
      const result = await getPromotionRecords({ startTime, endTime, page, pageSize: PROMOTION_SETTLEMENT_PAGE_SIZE })
      records.push(...(result.list || []))
      total = Number(result.total) || records.length
      page += 1
      if (!result.list?.length) break
    } while (records.length < total && page <= PROMOTION_SETTLEMENT_MAX_PAGES)
    return getPendingSettlementAmount(records, now)
  } catch {
    return 0
  }
}
