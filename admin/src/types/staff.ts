export type StaffStatus = 0 | 1
export type StaffGender = 0 | 1 | 2
export type StaffDeleteFlag = 0 | 1

/** 后台店员列表记录。 */
export interface Staff {
  id: string
  username: string
  name: string
  phone: string
  idCard: string
  gender: StaffGender
  shopId: string
  shopName: string
  status: StaffStatus
  delFlag: StaffDeleteFlag
  createTime: string
}

export interface StaffCreateDTO {
  username: string
  password: string
  name: string
  phone: string
  idCard: string
  gender: StaffGender
  shopId: string
}

export interface StaffUpdateDTO {
  name: string
  phone: string
  idCard: string
  gender: StaffGender
  shopId: string
}

export interface StaffResetPasswordDTO {
  newPassword: string
}

export interface StaffPageResult {
  total: number
  list: Staff[]
  page: number
  pageSize: number
}

export interface StaffResponse<T> {
  code: number
  message: string
  data?: T | null
  success?: boolean
}
