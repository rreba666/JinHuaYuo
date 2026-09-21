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
  /**
   * 是否允许该商品使用肽金券抵扣：0=否（默认）/ 1=是。
   * 与 dividendEnabled（是否发放红包，决定**能否获得**肽金券）是**两个独立开关**，不要合并。
   */
  peptideEnabled?: ProductFundStatusValue
  /** 是否开启抽应急红包池：0/1。 */
  emergencyPoolEnabled?: ProductFundStatusValue
  /** 每单抽取应急红包池金额（元）。 */
  emergencyPoolAmount?: number
  soldCount: number
  /** 可售库存（该商品下所有启用 SKU 的 `stock` 之和，查询时实时聚合，**不含**锁定）。 */
  totalStock: number
  /**
   * 锁定库存（所有启用 SKU 的 `locked_stock` 之和，实时聚合；已下单占用、货未出库，超时自动释放）。
   * ⚠️ 与 `totalStock` 口径不同：`totalStock` 是**可售**，本字段是**锁定**，两者之和才是账面在库。
   */
  lockedStock?: number
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
  /** 锁定库存（已下单占用、货未出库；仅商品详情回显返回，保存商品时不提交该字段）。 */
  lockedStock?: number
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
  /** 是否允许该商品使用肽金券抵扣：0=否（默认）, 1=是。肽金券不可提现，仅可用于下单抵扣。 */
  peptideEnabled: ProductStatus
  /** 是否开启抽应急红包池：0/1。 */
  emergencyPoolEnabled: ProductStatus
  /** 每单抽取应急红包池金额（元）。 */
  emergencyPoolAmount: number
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
  /**
   * 该分类下商品是否**默认**支持肽金券抵扣（0=否 / 1=是）。
   * 商品表单选择分类时据此带出「肽金券抵扣」开关的默认值；后端保存商品时也会做同样兜底。
   */
  peptideEnabled?: number
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
