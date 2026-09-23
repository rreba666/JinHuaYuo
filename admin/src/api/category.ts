import { request } from './request'
import { resolveMediaUrl } from './media'
import type { AdminCategory, AdminCategorySaveDTO, CategoryResponse } from '@/types/category'

/** 校验分类管理接口响应。 */
function unwrapResponse<T>(response: { data: CategoryResponse<T> }, fallbackMessage: string): T {
  const result = response.data
  if (result.code !== 0 || result.success === false) throw new Error(result.message || fallbackMessage)
  return result.data as T
}

/** 兼容后台分类列表直接返回数组或分页包装结构。 */
function normalizeList(value: unknown): AdminCategory[] {
  const source = Array.isArray(value)
    ? value
    : Array.isArray((value as { list?: unknown } | null)?.list)
      ? (value as { list: unknown[] }).list
      : []
  return source.map((item) => {
    const raw = item as Partial<AdminCategory> & { status?: number | string }
    return {
      id: String(raw.id ?? ''),
      parentId: String(raw.parentId ?? '0'),
      name: String(raw.name ?? ''),
      icon: resolveMediaUrl(raw.icon),
      sortOrder: Number(raw.sortOrder) || 0,
      enabled: String(raw.enabled ?? raw.status) === '1' ? 1 : 0,
      // 该分类下商品是否默认支持肽金券抵扣（0/1）；后端为 2026-09-19 新增字段，缺失时按 0 兜底
      peptideEnabled: String(raw.peptideEnabled) === '1' || raw.peptideEnabled === 1 ? 1 : 0,
      /**
       * 是否「复购专区」分类（2026-09-23 新增）。
       *
       * ⚠️⚠️ 这里**必须显式重建本字段**：本函数是白名单式重建，漏一个字段就等于把它丢掉
       * （曾因此出现"保存成功了、再打开开关又是关的"——后端存住了，是前端自己丢的）。
       * ⚠️ 兼容后端三种下发形态：boolean `true` / number `1` / string `'1'`。
       */
      special: (() => { const v = raw.special as unknown; return v === true || String(v) === '1' ? 1 : 0 })(),
      children: Array.isArray(raw.children) ? normalizeList(raw.children) : [],
    }
  })
}

/** 查询后台分类列表，包含禁用分类。 */
export async function getAdminCategories(): Promise<AdminCategory[]> {
  const response = await request.get<CategoryResponse<unknown>>('/api/admin/category/list')
  return normalizeList(unwrapResponse(response, '分类列表查询失败'))
}

/** 新增后台分类。 */
export async function createAdminCategory(payload: AdminCategorySaveDTO): Promise<void> {
  const response = await request.post<CategoryResponse<null>>('/api/admin/category', payload)
  unwrapResponse(response, '分类新增失败')
}

/** 修改后台分类。 */
export async function updateAdminCategory(id: string, payload: AdminCategorySaveDTO): Promise<void> {
  const response = await request.put<CategoryResponse<null>>(`/api/admin/category/${id}`, payload)
  unwrapResponse(response, '分类修改失败')
}

/** 软删除后台分类。 */
export async function deleteAdminCategory(id: string): Promise<void> {
  const response = await request.delete<CategoryResponse<null>>(`/api/admin/category/${id}`)
  unwrapResponse(response, '分类删除失败')
}
