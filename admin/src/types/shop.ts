export type ShopStatus = 0 | 1
export type ShopDeleteFlag = 0 | 1

/** 后台门店列表记录。 */
export interface Shop {
  id: string
  name: string
  address: string
  phone: string
  status: ShopStatus
  delFlag: ShopDeleteFlag
  createTime: string
}

export interface ShopCreateDTO {
  name: string
  address: string
  phone: string
}

export type ShopUpdateDTO = ShopCreateDTO

export interface ShopPageResult {
  total: number
  list: Shop[]
  page: number
  pageSize: number
}

export interface ShopResponse<T> {
  code: number
  message: string
  data?: T | null
  success?: boolean
}
