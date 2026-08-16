import { request } from '@/utils/request'

export interface EnabledShop {
  id: number
  name: string
  address: string
  phone?: string
  status?: number
  createTime?: string
}

/** 查询 C 端可选的启用门店。 */
export function getEnabledShops(): Promise<EnabledShop[]> {
  return request<EnabledShop[]>({ url: '/api/shop/all', method: 'GET' })
}
