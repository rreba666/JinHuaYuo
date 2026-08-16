import type { AdminRole } from './auth'

export type { AdminRole }

/** 管理员状态：0=禁用，1=启用。 */
export type AdminStatus = 0 | 1

/** 管理员删除标记：0=正常，1=已删除。 */
export type AdminDeleteFlag = 0 | 1

/** 后台管理员列表记录（对应 AdminInfoVO）。 */
export interface AdminInfo {
  id: string
  username: string
  nickname: string
  role: AdminRole
  status: AdminStatus
  delFlag: AdminDeleteFlag
  lastLoginTime: string
  createTime: string
  updateTime: string
}

/** 新增管理员请求体。 */
export interface AdminCreateDTO {
  username: string
  password: string
  nickname: string
  role: AdminRole
}

/** 修改管理员角色请求体。 */
export interface AdminRoleDTO {
  role: AdminRole
}

/** 启用/禁用管理员请求体。 */
export interface AdminStatusDTO {
  status: AdminStatus
}

/** 重置管理员密码请求体。 */
export interface AdminResetPasswordDTO {
  newPassword: string
}

/** 管理员分页结果。 */
export interface AdminPageResult {
  total: number
  list: AdminInfo[]
  page: number
  pageSize: number
}

/** 管理员接口统一响应结构。 */
export interface AdminResponse<T> {
  code: number
  message: string
  data?: T | null
  success?: boolean
}
