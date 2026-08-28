export type ProductStatus = 0 | 1
export type ProductStatusValue = ProductStatus | '0' | '1'
export type ProductFundStatusValue = ProductStatusValue | null

export interface ProductListItem {
  id: string
  name: string
  mainImage: string
  minPrice: number
  /** 商品最低划线价/原价（元），纯展示不参与扣款。 */
  minOriginalPrice?: number
  /** 推广资金（元）。列表接口可能不返回，此时为 undefined，需详情查看。 */
  promotionFund?: number
  promotionEnabled: ProductFundStatusValue
  /** 平台红包（红包资金，元）。列表接口可能不返回，此时为 undefined。 */
  dividendFund?: number
  dividendEnabled: ProductFundStatusValue
  soldCount: number
  totalStock: number
  originPlace: string
  status: ProductStatusValue
  isRecommended: ProductStatusValue
  recommendTextEnabled: ProductStatusValue
  sortOrder: number
}

export interface ProductSku {
  id?: string
  skuName: string
  specs: string
  skuImage: string
  price: number
  /** 划线价/原价（元），纯展示不参与扣款，为空=无划线价。 */
  originalPrice?: number
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
  /** 商品详情海报（B端编辑/回显，C端详情页海报）。 */
  detailPosterUrl?: string
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
  detailPosterUrl?: string
  promotionFund: number
  promotionEnabled: ProductStatus
  dividendFund: number
  dividendEnabled: ProductStatus
  status: ProductStatus
  isRecommended: ProductStatus
  recommendTextEnabled: ProductStatus
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
