import { request } from '@/utils/request'
import type { LuckyConfigVO, LuckyDrawVO, LuckyRecordPage } from '@/types/lucky'

/** 查询活动配置（返回配置与奖品，登录态下含今日剩余次数）。 */
export function getLuckyConfig(): Promise<LuckyConfigVO> {
  return request<LuckyConfigVO>({ url: '/api/lucky/config', method: 'GET' })
}

/** 抽奖：后端按权重/内定返回中奖格位索引。 */
export function drawLucky(): Promise<LuckyDrawVO> {
  return request<LuckyDrawVO>({ url: '/api/lucky/draw', method: 'POST', data: {} })
}

/** 分页查询当前用户的中奖记录。 */
export function getLuckyRecords(page = 1, pageSize = 10): Promise<LuckyRecordPage> {
  return request<LuckyRecordPage>({
    url: `/api/lucky/records?page=${page}&pageSize=${pageSize}`,
    method: 'GET',
  })
}
