import { request } from '@/utils/request'

/** 分类节点 */
export interface CategoryNode {
  id: string
  name: string
  icon: string
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
