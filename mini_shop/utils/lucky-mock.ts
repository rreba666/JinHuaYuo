import type { LuckyConfigVO, LuckyDrawVO } from '@/types/lucky'

/** 本地演示配置：后端就绪前用；活动开启、每人 3 次、6 格。 */
export const LUCKY_MOCK_CONFIG: LuckyConfigVO = {
  id: 'mock',
  enabled: 1,
  startTime: '2026-09-04 00:00:00',
  endTime: '2026-09-30 23:59:59',
  dailyCount: 3,
  remainCount: 3,
  rule: '每人每日可抽 3 次，点击中心按钮开始；本页为演示版本，奖品以实际活动为准。',
  prizes: [
    { index: 0, name: '一等奖', type: 'REAL', weight: 1 },
    { index: 1, name: '谢谢参与', type: 'NONE', weight: 40, isDefault: true },
    { index: 2, name: '50积分', type: 'INTEGRAL', weight: 30 },
    { index: 3, name: '谢谢参与', type: 'NONE', weight: 20, isDefault: true },
    { index: 4, name: '10积分', type: 'INTEGRAL', weight: 25 },
    { index: 5, name: '谢谢参与', type: 'NONE', weight: 10, isDefault: true },
  ],
}

/** 本地假抽奖：按权重返回命中格位（演示用，仅做动画）。 */
export function mockLuckyDraw(): LuckyDrawVO {
  const prizes = LUCKY_MOCK_CONFIG.prizes
  const total = prizes.reduce((sum, prize) => sum + (prize.weight || 1), 0)
  let rand = Math.random() * total
  let hit = prizes[0]
  for (const prize of prizes) {
    rand -= prize.weight || 1
    if (rand <= 0) { hit = prize; break }
  }
  return {
    prizeIndex: hit.index,
    prizeName: hit.name,
    prizeType: hit.type || 'NONE',
    recordId: String(Date.now()),
  }
}
