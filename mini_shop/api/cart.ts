import { request } from '@/utils/request'

/** 购物车商品条目（对应 CartListVO） */
export interface CartItem {
  cartId: number
  productId: number
  skuId: number
  productName: string
  productImage: string
  skuName: string
  specs: string
  price: number
  /** 划线价/原价（订前价，元），纯展示不参与扣款，为空=无划线价。 */
  originalPrice?: number
  quantity: number
  checked: boolean
  stock: number
}

/** 加入购物车请求体（对应 CartAddDTO） */
export interface CartAddDTO {
  productId: number
  skuId?: number
  quantity?: number
}

/** 获取当前用户购物车列表 */
export function getCartList(): Promise<CartItem[]> {
  return request<CartItem[]>({ url: '/api/cart/list', method: 'GET' })
}

/** 切换单条购物车商品的选中状态 */
export function toggleChecked(cartId: number): Promise<void> {
  return request<void>({ url: `/api/cart/${cartId}/toggle`, method: 'PUT' })
}

/** 修改购物车商品数量 */
export function updateQuantity(cartId: number, quantity: number): Promise<void> {
  return request<void>({ url: `/api/cart/${cartId}/quantity/${quantity}`, method: 'PUT' })
}

/** 全选或取消全选购物车商品 */
export function checkAll(checked: boolean): Promise<void> {
  return request<void>({ url: `/api/cart/check-all?checkAll=${checked}`, method: 'PUT' })
}

/** 删除单条购物车记录 */
export function removeCartItem(cartId: number): Promise<void> {
  return request<void>({ url: `/api/cart/${cartId}`, method: 'DELETE' })
}

/** 批量删除购物车记录（传入 cartId 数组） */
export function removeCartBatch(cartIds: number[]): Promise<void> {
  return request<void>({ url: '/api/cart/batch', method: 'DELETE', data: cartIds })
}

/** 加入购物车（商品详情页使用） */
export function addToCart(dto: CartAddDTO): Promise<void> {
  return request<void>({ url: '/api/cart/add', method: 'POST', data: dto })
}
