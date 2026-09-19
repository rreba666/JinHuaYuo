export type CategoryStatus = 0 | 1

/** 后台分类列表数据。字段与 AdminCategoryListVO 对齐。 */
export interface AdminCategory {
  id: string
  parentId: string
  name: string
  icon: string
  sortOrder: number
  enabled: CategoryStatus
  /**
   * 该分类下商品是否**默认**支持肽金券抵扣：0=否（默认）/ 1=是。
   *
   * 商品保存（`POST /api/admin/product/save`）时若**未显式传** `peptideEnabled`，
   * 后端取本字段作为默认值**并落库到商品**（显式传 0/1 可让单商品覆盖分类默认）。
   * ⚠️ 本开关从 1 改为 0 **不联动已保存商品**，只影响之后保存的商品。
   */
  peptideEnabled: CategoryStatus
  children?: AdminCategory[]
}

/** 后台分类新增和修改请求。enabled / peptideEnabled 对齐后端 AdminCategorySaveDTO 字段名。 */
export interface AdminCategorySaveDTO {
  name: string
  parentId: string
  icon: string
  sortOrder: number
  enabled: CategoryStatus
  /** 该分类下商品是否默认支持肽金券抵扣：0=否 / 1=是（口径见 AdminCategory.peptideEnabled） */
  peptideEnabled: CategoryStatus
}

export interface CategoryResponse<T> {
  code: number
  message: string
  data?: T | null
  success?: boolean
}
