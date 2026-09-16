export type UserIdentity = 0 | 1
export type UserBanStatus = 0 | 1
export type UserBanStatusValue = UserBanStatus | '0' | '1'

export interface User {
  id: string
  nickname: string
  avatarUrl: string
  phone: string
  identity: UserIdentity
  banStatus: UserBanStatusValue
  delFlag: 0 | 1
  createTime: string
}

export interface UserDetail extends User {
  pendingPromotion: number
  pendingBonus: number
  /** 余额（独立账户，可消费可提现）。 */
  balance: number
}

export interface AdminWalletUpsertDTO {
  pendingPromotion?: number
  pendingBonus?: number
  /** 余额（独立账户，可消费可提现）。 */
  balance?: number
}

/** 用户列表查询参数（后端仅支持 keyword/page/pageSize，状态筛选可选传 delFlag/banStatus）。 */
export interface UserListQueryParams {
  page: number
  pageSize: number
  keyword?: string
  /** 状态筛选：0=正常，1=已删除（可选）。 */
  delFlag?: 0 | 1
  /** 状态筛选：0=正常，1=封禁（可选，delFlag=0 时参与）。 */
  banStatus?: 0 | 1
}

export interface UserFilters {
  keyword: string
  phone: string
  banStatus: '' | UserBanStatusValue
}

export interface UserPageResult {
  total: number
  list: User[]
  page: number
  pageSize: number
}

export interface UserResponse<T> {
  code: number
  message: string
  data?: T | null
  success?: boolean
}
