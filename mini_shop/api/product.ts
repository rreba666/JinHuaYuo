import { request } from '@/utils/request'

export interface ProductDetail {
  id: string
  name: string
  mainImage: string
  /** 当前用户是否已收藏该商品（未登录恒为 false） */
  favorite?: boolean
  images?: string[]
  /** 商品详情海报（商品素材页用的长图）。 */
  detailPosterUrl?: string
  videoUrl?: string
  description: string
  descriptionTitle?: string
  detailImages?: string[]
  promotionFund?: number
  promotionEnabled?: 0 | 1 | '0' | '1' | boolean
  dividendFund?: number
  dividendEnabled?: 0 | 1 | '0' | '1' | boolean
  /**
   * 是否支持用「肽金券」抵扣：0=否 / 1=是（兼容字符串与布尔）。
   * ⚠️ 只有**商品详情**接口返回该字段，商品列表/购物车列表不返回，所以只在详情页做标识。
   */
  peptideEnabled?: 0 | 1 | '0' | '1' | boolean
  /**
   * 是否「特殊商品」（复购专区）。
   *
   * ⚠️ 2026-09-23 新增。**两个接口的类型不同**（api-docs 实测）：
   * - `ProductDetailVO.specialEnabled` = `boolean`；
   * - `ProductListVO.specialEnabled`   = `integer`（`0` / `1`）。
   * ⇒ 这里按**兼容**写法声明，取值时一律用 `isSpecialProduct()` 归一，别直接当布尔用。
   *
   * ⚠️ 它**只是展示标识**（加「复购专区」标签），**不要**拿它做门禁 ——
   * 后端已按身份过滤/拦截（游客根本拿不到该商品，详情会 `1004`）。
   */
  specialEnabled?: 0 | 1 | '0' | '1' | boolean
  minPrice: number
  maxPrice: number
  /** 商品最低划线价/原价（订前价，元），纯展示不参与扣款，为 null 表示无划线价。 */
  minOriginalPrice?: number
  totalStock: number
  soldCount: number
  skuList: Array<{ id: string; skuName: string; specs: string; price: number; originalPrice?: number; stock: number; enabled: number }>
}

export interface ProductCard {
  id: string | number
  name: string
  descriptionTitle?: string
  mainImage: string
  price: number
  minPrice?: number
  /** 划线价/原价（订前价，元），纯展示，为 null 表示无划线价。 */
  originalPrice?: number
  /** 兼容字段：部分接口返回 minOriginalPrice。 */
  minOriginalPrice?: number
  tag?: string
  soldCount: number
  totalStock?: number
  originPlace?: string
  /**
   * 是否「特殊商品」（复购专区）。⚠️ 列表侧后端给的是 `integer`（`0`/`1`），
   * 详情侧是 `boolean` ⇒ 一律用 `isSpecialProduct()` 归一后再用。
   */
  specialEnabled?: 0 | 1 | '0' | '1' | boolean
}

/**
 * 判断是否「特殊商品」（复购专区）。
 *
 * ⚠️ 后端在**列表**里给 `integer 0/1`、在**详情**里给 `boolean`，还有可能给字符串 ⇒ 统一归一。
 * 用途**仅限展示**（加「复购专区」标签）；门禁由后端负责。
 */
export function isSpecialProduct(value: { specialEnabled?: 0 | 1 | '0' | '1' | boolean } | null | undefined): boolean {
  if (!value) return false
  const flag = value.specialEnabled
  return flag === true || flag === 1 || flag === '1'
}

export interface ProductPageResult {
  total: number
  list: ProductCard[]
  page: number
  pageSize: number
}

/** 查询商品详情，为首页商品卡片提供真实跳转目标。 */
export function getProductDetail(productId: string): Promise<ProductDetail> {
  return request<ProductDetail>({ url: `/api/product/detail/${productId}`, method: 'GET' })
}

/**
 * 复购专区（特殊商品）列表 —— `GET /api/product/special-zone`。
 *
 * - **需登录**；入参与 `/api/product/list` **完全一致**（categoryId / originPlace / keyword / sortBy / page / pageSize）；
 * - 返回结构与 `/api/product/list` **完全一致**，所以复用同一个 `ProductPageResult` 与归一化逻辑；
 * - ⚠️ 游客（`identity=0`，即"登录了但还不是注册用户"）会拿到 **`200 + code=1004`**「仅注册用户可见」，
 *   **不是 401**（401 只在未登录/token 失效时出现）⇒ 调用方要分别处理。
 * - ⚠️ 专区数据**只走这个接口**：`/api/product/list` 按设计**永远不返回**特殊商品。
 */
export async function getSpecialZoneProducts(params: {
  keyword?: string
  categoryId?: string | number
  originPlace?: string
  sortBy?: string
  page?: number
  pageSize?: number
} = {}): Promise<ProductPageResult> {
  const query: string[] = [
    `page=${encodeURIComponent(String(params.page || 1))}`,
    `pageSize=${encodeURIComponent(String(params.pageSize || 10))}`,
  ]
  if (params.keyword?.trim()) query.push(`keyword=${encodeURIComponent(params.keyword.trim())}`)
  if (params.categoryId !== undefined && params.categoryId !== '') query.push(`categoryId=${encodeURIComponent(String(params.categoryId))}`)
  if (params.originPlace?.trim()) query.push(`originPlace=${encodeURIComponent(params.originPlace.trim())}`)
  if (params.sortBy) query.push(`sortBy=${encodeURIComponent(params.sortBy)}`)
  const result = await request<ProductPageResult>({ url: `/api/product/special-zone?${query.join('&')}`, method: 'GET' })
  return {
    ...result,
    list: (result.list || []).map((item) => {
      const raw = item as ProductCard & { minPrice?: number }
      return {
        ...raw,
        id: String(raw.id),
        price: Number(raw.price ?? raw.minPrice ?? 0),
      }
    }),
  }
}

/** 查询小程序商品列表，支持关键词、分类、产地和排序。 */
export async function getProductList(params: { keyword?: string; categoryId?: string | number; originPlace?: string; sortBy?: string; page?: number; pageSize?: number } = {}): Promise<ProductPageResult> {
  const query: string[] = [
    `page=${encodeURIComponent(String(params.page || 1))}`,
    `pageSize=${encodeURIComponent(String(params.pageSize || 10))}`,
  ]
  if (params.keyword?.trim()) query.push(`keyword=${encodeURIComponent(params.keyword.trim())}`)
  if (params.categoryId !== undefined && params.categoryId !== '') query.push(`categoryId=${encodeURIComponent(String(params.categoryId))}`)
  if (params.originPlace?.trim()) query.push(`originPlace=${encodeURIComponent(params.originPlace.trim())}`)
  if (params.sortBy) query.push(`sortBy=${encodeURIComponent(params.sortBy)}`)
  const result = await request<ProductPageResult>({ url: `/api/product/list?${query.join('&')}`, method: 'GET' })
  return {
    ...result,
    list: (result.list || []).map((item) => {
      const raw = item as ProductCard & { minPrice?: number }
      return {
        ...raw,
        id: String(raw.id),
        price: Number(raw.price ?? raw.minPrice ?? 0),
      }
    }),
  }
}
