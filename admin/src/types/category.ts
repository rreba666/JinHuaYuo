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
  /**
   * **是否「复购专区」分类**（2026-09-23 新增）：`0`=普通 / `1`=复购专区。
   *
   * ⚠️ 它是特殊商品的**唯一容器**：商品是不是特殊商品，完全由"在不在这个分类里"决定
   * （`special_enabled` 只是物化缓存，保存时按分类推导，不听入参）。
   * ⚠️ **全库最多一个**；专区分类**不允许取消勾选、不允许删除**，只能**停用**。
   */
  special?: CategoryStatus
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
  /** 是否「复购专区」：0=普通 / 1=复购专区（⚠️ 专区分类不允许改成 0，后端会返回 1000） */
  special?: CategoryStatus
}

export interface CategoryResponse<T> {
  code: number
  message: string
  data?: T | null
  success?: boolean
}
