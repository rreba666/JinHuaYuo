import type { LuckyConfigVO, LuckyDrawVO, LuckyRecord, LuckyPrizeVO } from '@/types/lucky'

/** 本地演示配置：后端就绪前用。6 格、每人每日 3 次、总 3 次。 */
export const LUCKY_MOCK_CONFIG: LuckyConfigVO = {
  activityId: 1,
  name: '开业大抽奖',
  description: '每人每日可抽 3 次，点击中心按钮开始；本页为演示版本，奖品以实际活动为准。',
  startTime: '2026-09-04 00:00:00',
  endTime: '2026-09-30 23:59:59',
  dailyLimitPerUser: 3,
  totalLimitPerUser: 3,
  prizes: [
    { prizeId: 1, name: '一等奖-免单券', level: '一等奖' },
    { prizeId: 2, name: '谢谢参与', level: '谢谢参与' },
    { prizeId: 3, name: '50 积分', level: '二等奖' },
    { prizeId: 4, name: '谢谢参与', level: '谢谢参与' },
    { prizeId: 5, name: '10 积分', level: '三等奖' },
    { prizeId: 6, name: '谢谢参与', level: '谢谢参与' },
  ],
}

/** 本地假抽奖：按 prizes 顺序随机返回一个命中（演示用，仅做动画停格在对应格位）。 */
export function mockLuckyDraw(): LuckyDrawVO {
  const prizes = LUCKY_MOCK_CONFIG.prizes
  const idx = Math.floor(Math.random() * prizes.length)
  const hit = prizes[idx]
  const won = !/谢谢参与/.test(hit.level || '') && !/谢谢参与/.test(hit.name || '')
  return {
    won,
    prizeId: won ? hit.prizeId : null,
    prizeName: won ? hit.name : null,
    level: won ? hit.level ?? null : null,
    verifyCode: won ? generateVerifyCode() : null,
    message: won ? '恭喜中奖！' : '很遗憾，未中奖，感谢参与',
  }
}

/** 生成 8 位大写字母数字核销码（演示与后端约定一致）。 */
function generateVerifyCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

/** 本地演示中奖记录：含核销码/状态/活动名。 */
export const LUCKY_MOCK_RECORDS: LuckyRecord[] = [
  {
    id: 1,
    activityId: 1,
    activityName: '开业大抽奖',
    won: true,
    prizeName: '一等奖-免单券',
    level: '一等奖',
    status: 'WON',
    verifyCode: 'A1B2C3D4',
    createTime: '2026-09-04 12:30:00',
  },
  {
    id: 2,
    activityId: 1,
    activityName: '开业大抽奖',
    won: true,
    prizeName: '10 积分',
    level: '三等奖',
    status: 'VERIFIED',
    verifyCode: 'X9Y8Z7W6',
    createTime: '2026-09-04 11:00:00',
  },
]
