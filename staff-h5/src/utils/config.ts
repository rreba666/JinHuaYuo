/**
 * 多品牌配置拉取层（staff-h5 核销端）
 * ------------------------------------------------------------
 * 依据：docs/plan/frontend-types.ts（契约）+ api-integration.md
 * 职责：
 *  1. 拉取当前品牌模块开关（单商户下恒全启用，见 getModules 注释）
 *  2. 提供 isModuleEnabled 兜底（配置为空/异常 → 全功能开启，兼容线上）
 */

/** 模块配置项 */
export interface ModuleConfig {
  key: string
  name: string
  enabled: 0 | 1
  sort: number
}

/**
 * 拉取当前品牌模块启停；失败返回 null，调用方按全部启用兜底。
 * ------------------------------------------------------------
 * 单商户独立部署：无多品牌模块开关接口，恒返回 null（全部功能启用），
 * 避免对不存在的后端接口 /api/v2/modules 发请求造成 404 噪音。
 */
export function getModules(): Promise<ModuleConfig[] | null> {
  return Promise.resolve(null)
}

/** 模块是否启用；配置缺失/为空时兜底 true（默认全部启用，兼容线上）。 */
export function isModuleEnabled(modules: ModuleConfig[] | undefined | null, key: string): boolean {
  if (!modules || modules.length === 0) return true
  const m = modules.find((x) => x.key === key)
  return m ? m.enabled === 1 : true
}
