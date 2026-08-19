import { request } from './request'
import type { Staff, StaffCreateDTO, StaffDeleteFlag, StaffPageResult, StaffResetPasswordDTO, StaffResponse, StaffStatus, StaffUpdateDTO } from '@/types/staff'

function unwrap<T>(response: { data: StaffResponse<T> }, fallback: string): T {
  const result = response.data
  if (result.code !== 0 || result.success === false) throw new Error(result.message || fallback)
  return result.data as T
}

/** 兼容 records 和 list 两种分页返回结构。 */
function normalizePage(value: unknown, page: number, pageSize: number): StaffPageResult {
  const raw = (value || {}) as Record<string, unknown>
  const records = Array.isArray(raw.records) ? raw.records : Array.isArray(raw.list) ? raw.list : Array.isArray(value) ? value : []
  return {
    total: Number(raw.total ?? records.length) || 0,
    page: Number(raw.current ?? raw.page ?? page) || page,
    pageSize: Number(raw.size ?? raw.pageSize ?? pageSize) || pageSize,
    list: records.map((item) => {
      const staff = item as Partial<Staff>
      const delFlag: StaffDeleteFlag = Number(staff.delFlag) === 1 ? 1 : 0
      return { ...staff, id: String(staff.id ?? ''), shopId: String(staff.shopId ?? ''), status: Number(staff.status) === 1 ? 1 : 0, delFlag } as Staff
    }),
  }
}

/** 查询店员分页列表。keyword 纯数字按店员 ID 精确匹配，否则按姓名/工号模糊匹配。 */
export async function getStaff(page: number, pageSize: number, keyword?: string): Promise<StaffPageResult> {
  const params: Record<string, string | number> = { page, pageSize }
  if (keyword && keyword.trim()) params.keyword = keyword.trim()
  const response = await request.get<StaffResponse<unknown>>('/api/admin/staff/list', { params })
  return normalizePage(unwrap(response, '店员列表查询失败'), page, pageSize)
}

/** 新增店员。 */
export async function createStaff(payload: StaffCreateDTO): Promise<void> {
  unwrap(await request.post<StaffResponse<null>>('/api/admin/staff', payload), '店员新增失败')
}

/** 修改店员。 */
export async function updateStaff(id: string, payload: StaffUpdateDTO): Promise<void> {
  unwrap(await request.put<StaffResponse<null>>(`/api/admin/staff/${id}`, payload), '店员修改失败')
}

/** 切换店员启用状态。 */
export async function updateStaffStatus(id: string, status: StaffStatus): Promise<void> {
  unwrap(await request.put<StaffResponse<null>>(`/api/admin/staff/${id}/status`, null, { params: { status } }), '店员状态更新失败')
}

/** 重置店员密码。 */
export async function resetStaffPassword(id: string, payload: StaffResetPasswordDTO): Promise<void> {
  unwrap(await request.put<StaffResponse<null>>(`/api/admin/staff/${id}/reset-password`, payload), '店员密码重置失败')
}

/** 软删除店员。 */
export async function deleteStaff(id: string): Promise<void> {
  unwrap(await request.delete<StaffResponse<null>>(`/api/admin/staff/${id}`), '店员删除失败')
}

/** 恢复已删除店员。 */
export async function restoreStaff(id: string): Promise<void> {
  unwrap(await request.put<StaffResponse<null>>(`/api/admin/staff/${id}/restore`), '店员恢复失败')
}
