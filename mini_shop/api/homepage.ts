import { request } from '@/utils/request'

export interface HomepageMediaItem {
  id: string
  description: string
  imageUrl: string[]
  videoUrl: string[]
  coverUrl: string[]
  linkTarget: string[]
  bottomImageUrl: string[]
  bottomLinkTarget: string[]
  bottomTitle: string
  isEnabled: number
}

export interface HomepageProduct {
  id: string
  name: string
  mainImage: string
  price: number
  tag?: string
  soldCount?: number
  descriptionTitle?: string
}

export interface HomepageData {
  mediaList: HomepageMediaItem[]
  recommendedProducts: HomepageProduct[]
}

/** 获取小程序首页聚合数据。 */
export function getHomepageData(): Promise<HomepageData> {
  return request<HomepageData>({ url: '/api/homepage', method: 'GET' })
}

/** 获取商品分类树。 */
export function getCategoryList<T = unknown>(): Promise<T> {
  return request<T>({ url: '/api/category/list', method: 'GET' })
}
