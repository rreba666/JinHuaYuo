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
  /** 划线价/原价（元），纯展示，为 null 表示无划线价。 */
  minOriginalPrice?: number
  /** 兼容字段：部分接口返回 originalPrice 而非 minOriginalPrice。 */
  originalPrice?: number
  tag?: string
  soldCount?: number
  descriptionTitle?: string
  recommendTextEnabled?: 0 | 1 | '0' | '1' | boolean
}

export interface HomepageData {
  mediaList: HomepageMediaItem[]
  recommendedProducts: HomepageProduct[]
}

/** 保留底部推荐两个固定位置，避免缺失图片后下标发生位移。 */
export function normalizeBottomRecommendationSlots(value: unknown): string[] {
  const source = Array.isArray(value) ? value : []
  return [0, 1].map((index) => (typeof source[index] === 'string' ? source[index] : ''))
}

/** 获取小程序首页聚合数据。 */
export async function getHomepageData(): Promise<HomepageData> {
  const data = await request<HomepageData>({ url: '/api/homepage', method: 'GET' })
  return {
    ...data,
    mediaList: (data.mediaList || []).map((item) => ({
      ...item,
      bottomImageUrl: normalizeBottomRecommendationSlots(item.bottomImageUrl),
      bottomLinkTarget: normalizeBottomRecommendationSlots(item.bottomLinkTarget),
    })),
  }
}

/** 获取商品分类树。 */
export function getCategoryList<T = unknown>(): Promise<T> {
  return request<T>({ url: '/api/category/list', method: 'GET' })
}
