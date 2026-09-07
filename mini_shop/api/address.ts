import { request } from '@/utils/request'

/** 收货地址（对应设置页后端接口清单：user_address）。 */
export interface Address {
  id: number | string
  receiverName: string
  receiverPhone: string
  province?: string
  city?: string
  district?: string
  detail: string
  isDefault: number
}

/** 新增/修改地址请求。 */
export interface AddressPayload {
  receiverName: string
  receiverPhone: string
  province?: string
  city?: string
  district?: string
  detail: string
  isDefault?: number
}

/** 查询当前用户地址列表（默认地址在前）。 */
export function getAddressList(): Promise<Address[]> {
  return request<Address[]>({ url: '/api/user/address/list', method: 'GET' })
}

/** 新增地址。 */
export function createAddress(payload: AddressPayload): Promise<Address> {
  return request<Address>({ url: '/api/user/address', method: 'POST', data: payload })
}

/** 修改地址。 */
export function updateAddress(id: number | string, payload: AddressPayload): Promise<Address> {
  return request<Address>({ url: `/api/user/address/${id}`, method: 'PUT', data: payload })
}

/** 删除地址（软删）。 */
export function deleteAddress(id: number | string): Promise<void> {
  return request<void>({ url: `/api/user/address/${id}`, method: 'DELETE' })
}

/** 设为默认地址（取消其他默认）。 */
export function setDefaultAddress(id: number | string): Promise<void> {
  return request<void>({ url: `/api/user/address/${id}/default`, method: 'PUT' })
}
