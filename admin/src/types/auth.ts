/** 管理员登录请求参数。 */
export interface AdminLoginDTO {
  username: string
  password: string
}

/** 后端管理员角色枚举。 */
export type AdminRole = 'SUPER_ADMIN' | 'CUSTOMER_SERVICE' | 'FINANCE'

/** 后端返回的管理员登录信息。 */
export interface AdminLoginVO {
  token: string
  adminUserId: number
  nickname: string
  role: AdminRole
  /** 品牌范围：'ALL'（平台管理员）或品牌 key 数组（商户管理员）。 */
  brandScope?: 'ALL' | string[]
  expireAt: number
}

/** 管理员登录接口的完整响应结构。 */
export interface AdminLoginResponse {
  code: number
  message: string
  data: AdminLoginVO | null
  success?: boolean
}
