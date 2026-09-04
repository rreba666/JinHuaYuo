import type { LuckyConfigVO, LuckyDrawVO, LuckyRecord } from '@/types/lucky'

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

/** 本地演示中奖记录：含自提码/状态/活动名，用于页面展示（实物奖品体现自提码）。 */
export const LUCKY_MOCK_RECORDS: LuckyRecord[] = [
  {
    id: 'mock-1',
    prizeName: '一等奖',
    prizeIndex: 0,
    prizeType: 'REAL',
    status: 'WON',
    statusDesc: '待自提',
    activityName: '大转盘活动',
    verifyCode: 'A1B2C3D4',
    createTime: '2026-09-04 12:30:00',
  },
  {
    id: 'mock-2',
    prizeName: '10积分',
    prizeIndex: 4,
    prizeType: 'INTEGRAL',
    status: 'VERIFIED',
    statusDesc: '已核销',
    activityName: '大转盘活动',
    createTime: '2026-09-04 11:00:00',
  },
]
