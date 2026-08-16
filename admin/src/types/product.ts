export type ProductStatus = 0 | 1
export type ProductStatusValue = ProductStatus | '0' | '1'
export type ProductFundStatusValue = ProductStatusValue | null

export interface ProductListItem {
  id: string
  name: string
  mainImage: string
  minPrice: number
  promotionFund: number
  promotionEnabled: ProductFundStatusValue
  dividendFund: number
  dividendEnabled: ProductFundStatusValue
  soldCount: number
  totalStock: number
  originPlace: string
  status: ProductStatusValue
  isRecommended: ProductStatusValue
  sortOrder: number
}

export interface ProductSku {
  id?: string
  skuName: string
  specs: string
  skuImage: string
  price: number
  stock: number
  enabled: ProductStatusValue
}

export interface ProductDetail extends ProductListItem {
  categoryId: string
  images: string[]
  videoUrl: string
  description: string
  descriptionTitle: string
  maxPrice: number
  detailImages: string[]
  skuList: ProductSku[]
}

export interface AdminProductSaveDTO {
  id?: string
  name: string
  categoryId: string
  mainImage: string
  images: string[]
  videoUrl: string
  description: string
  descriptionTitle: string
  originPlace: string
  detailImages: string[]
  promotionFund: number
  promotionEnabled: ProductStatus
  dividendFund: number
  dividendEnabled: ProductStatus
  status: ProductStatus
  isRecommended: ProductStatus
  sortOrder: number
  skuList: ProductSku[]
}

export interface CategoryNode {
  id: string
  name: string
  icon: string
  children: CategoryNode[]
}

export type ProductSortBy = 'sold_desc' | 'price_asc' | 'price_desc' | 'new_desc' | 'sort_order'

export interface ProductQueryParams {
  page: number
  pageSize: number
  categoryId?: string
  keyword?: string
  sortBy?: ProductSortBy
  originPlace?: string
}

export interface ProductPageResult {
  total: number
  list: ProductListItem[]
  page: number
  pageSize: number
}

export interface ProductResponse<T> {
  code: number
  message: string
  data?: T | null
  success?: boolean
}

export interface ProductFilters {
  keyword: string
  categoryId: string
  originPlace: string
  sortBy: ProductSortBy | ''
}

export type Product = ProductListItem
