import { request } from './request'
import type { AdminCreateDTO, AdminInfo, AdminPageResult, AdminResetPasswordDTO, AdminResponse, AdminRole, AdminStatus } from '@/types/admin'

function unwrap<T>(response: { data: AdminResponse<T> }, fallback: string): T {
  const result = response.data
  if (result.code !== 0 || result.success === false) throw new Error(result.message || fallback)
  return result.data as T
}

/** 统一处理 BIGINT ID 及后端可能返回字符串的二值字段。 */
function normalizeAdmin(value: unknown): AdminInfo {
  const admin = (value || {}) as Partial<AdminInfo>
  return {
    ...admin,
    id: String(admin.id ?? ''),
    status: Number(admin.status) === 1 ? 1 : 0,
    delFlag: Number(admin.delFlag) === 1 ? 1 : 0,
  } as AdminInfo
}

/** 兼容 records 和 list 两种分页返回结构。 */
function normalizePage(value: unknown, page: number, pageSize: number): AdminPageResult {
  const raw = (value || {}) as Record<string, unknown>
  const records = Array.isArray(raw.records) ? raw.records : Array.isArray(raw.list) ? raw.list : Array.isArray(value) ? value : []
  return {
    total: Number(raw.total ?? records.length) || 0,
    page: Number(raw.current ?? raw.page ?? page) || page,
    pageSize: Number(raw.size ?? raw.pageSize ?? pageSize) || pageSize,
    list: records.map((item) => {
      const admin = item as Partial<AdminInfo>
      return normalizeAdmin(admin)
    }),
  }
}

/** 查询管理员分页列表。 */
export async function getAdminList(page: number, pageSize: number): Promise<AdminPageResult> {
  const response = await request.get<AdminResponse<unknown>>('/api/admin/role/list', { params: { page, pageSize } })
  return normalizePage(unwrap(response, '管理员列表查询失败'), page, pageSize)
}

/** 查询当前登录管理员。 */
export async function getCurrentAdmin(): Promise<AdminInfo> {
  const response = await request.get<AdminResponse<unknown>>('/api/admin/role/me', { skipAuthRedirect: true })
  return normalizeAdmin(unwrap(response, '当前管理员信息查询失败'))
}

/** 新增管理员。 */
export async function createAdmin(payload: AdminCreateDTO): Promise<void> {
  unwrap(await request.post<AdminResponse<null>>('/api/admin/role', payload), '管理员新增失败')
}

/** 修改管理员角色。 */
export async function updateAdminRole(id: string, role: AdminRole): Promise<void> {
  unwrap(await request.put<AdminResponse<null>>(`/api/admin/role/${id}/role`, { role }), '角色修改失败')
}

/** 启用/禁用管理员。 */
export async function updateAdminStatus(id: string, status: AdminStatus): Promise<void> {
  unwrap(await request.put<AdminResponse<null>>(`/api/admin/role/${id}/status`, { status }), '状态更新失败')
}

/** 重置管理员密码。 */
export async function resetAdminPassword(id: string, payload: AdminResetPasswordDTO): Promise<void> {
  unwrap(await request.put<AdminResponse<null>>(`/api/admin/role/${id}/reset-password`, payload), '密码重置失败')
}

/** 软删除管理员。 */
export async function deleteAdmin(id: string): Promise<void> {
  unwrap(await request.delete<AdminResponse<null>>(`/api/admin/role/${id}`), '管理员删除失败')
}

/** 恢复已软删除管理员。 */
export async function restoreAdmin(id: string): Promise<void> {
  unwrap(await request.put<AdminResponse<null>>(`/api/admin/role/${id}/restore`), '管理员恢复失败')
}
