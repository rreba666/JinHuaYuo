export type HomepageEnabled = 0 | 1
export type HomepageEnabledValue = HomepageEnabled | '0' | '1' | boolean

export interface HomepageConfigSaveDTO {
  description: string
  imageUrl: string[]
  videoUrl: string[]
  coverUrl: string[]
  linkTarget: string[]
  bottomImageUrl: string[]
  bottomLinkTarget: string[]
  bottomTitle: string
  isEnabled: HomepageEnabled
}

export type HomepageConfigUpdateDTO = Partial<HomepageConfigSaveDTO>

export interface HomepageMediaItem {
  id: number | string
  description: string
  imageUrl: string[]
  videoUrl: string[]
  coverUrl: string[]
  linkTarget: string[]
  bottomImageUrl: string[]
  bottomLinkTarget: string[]
  bottomTitle: string
  isEnabled?: HomepageEnabledValue
}

export interface HomepageConfigVO extends HomepageMediaItem {
  isEnabled?: HomepageEnabledValue
}

export interface HomepageProductCard {
  id?: number
  name?: string
  mainImage?: string
  price?: number
  tag?: string
  soldCount?: number
  descriptionTitle?: string
  recommendTextEnabled?: HomepageEnabledValue
}

export interface HomepageVO {
  mediaList: HomepageMediaItem[]
  recommendedProducts: HomepageProductCard[]
}

export interface HomepageResponse<T> {
  code: number
  message: string
  data: T
  success?: boolean
}
