import { request } from '@/utils/request'

/** 分类节点 */
export interface CategoryNode {
  id: string
  name: string
  icon: string
  /**
   * **是否「复购专区」分类**（2026-09-23 新增）：`0`=普通分类 / `1`=复购专区。
   *
   * ⚠️ api-docs 明确写着：**前端只能用本字段判断，不要用分类名或固定 ID**（改名/换环境即失效）。
   * 全库最多一个；游客/未登录时后端**不会返回**该分类。
   * ⚠️ 若 `special === 1`，该分类的商品**不能**走 `/api/product/list?categoryId=`（后端恒不返回），
   * 必须走 `GET /api/product/special-zone`。
   */
  special?: number
  children?: CategoryNode[]
}

/** 分类商品 */
export interface CategoryProduct {
  id: string
  name: string
  mainImage: string
  minPrice: number
}

/** 分类商品分页 */
export interface CategoryProductPage {
  total: number
  page: number
  pageSize: number
  list: CategoryProduct[]
}

/** 查询商品分类列表 */
export function getCategoryList(): Promise<CategoryNode[]> {
  return request<CategoryNode[]>({ url: '/api/category/list', method: 'GET' })
}

/** 按分类ID分页查询商品 */
export function getCategoryProducts(categoryId: string, page?: number, pageSize?: number): Promise<CategoryProductPage> {
  const p = page ?? 1
  const ps = pageSize ?? 20
  return request<CategoryProductPage>({
    url: `/api/product/list?categoryId=${categoryId}&page=${p}&pageSize=${ps}`,
    method: 'GET',
  })
}
