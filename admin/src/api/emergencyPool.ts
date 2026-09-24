import { request } from './request'
import type { EmergencyPoolLog, EmergencyPoolLogPageResult, EmergencyPoolLogQuery, EmergencyPoolOverview, EmergencyPoolResponse } from '@/types/emergencyPool'

function unwrap<T>(response: { data: EmergencyPoolResponse<T> }, fallback: string): T {
  const result = response.data
  if (result.code !== 0 || result.success === false) throw new Error(result.message || fallback)
  return result.data as T
}

/**
 * 总账字段白名单（用于下面的缺失告警）。
 * ⚠️ 名字必须与后端 `DividendEmergencyPoolEntity` **逐字一致**（注意是 `totalDeducted` / `totalInjected`）。
 */
const OVERVIEW_FIELDS = ['balance', 'totalDeducted', 'totalInjected', 'pendingInject'] as const

/**
 * 字段缺失告警（防呆）。
 *
 * ⚠️ 这个白名单映射给每个字段都写了 `|| 0`：好处是后端返回 `null` 时页面不会崩，
 * 坏处是**字段名写错时会被静默变成 0，页面上看起来就像「真的是 0」**。
 * 2026-09-24 的线上事故正是如此：`totalDeduct` / `totalInject` 少了 `ed`，
 * 导致「累计抽取 / 累计注入」恒显示 ¥0.00，并让总账自检恒等式永远不通过、**把注入功能彻底堵死**
 * —— 排查时最难的一点就是「这个 0 到底是真值，还是字段没取到」。
 *
 * 所以这里只在字段**整个缺失**（`undefined` / `null`）时告警一条：后端合法的 0 不会触发。
 */
function warnMissingOverviewFields(data: Record<string, unknown>): void {
  const missing = OVERVIEW_FIELDS.filter((key) => data[key] == null)
  if (missing.length) {
    console.warn('[应急红包池] 后端未下发字段（已按 0 兜底，请核对 api-docs.json 的 DividendEmergencyPoolEntity）:', missing.join(', '))
  }
}

/** 查询应急红包池总账（仅超管）。 */
export async function getEmergencyPool(): Promise<EmergencyPoolOverview> {
  const response = await request.get<EmergencyPoolResponse<EmergencyPoolOverview>>('/api/admin/profit/emergency-pool', { skipAuthRedirect: true })
  const data = (unwrap(response, '应急红包池查询失败') || {}) as unknown as Record<string, unknown>
  warnMissingOverviewFields(data)
  return {
    balance: Number(data.balance) || 0,
    totalDeducted: Number(data.totalDeducted) || 0,
    totalInjected: Number(data.totalInjected) || 0,
    pendingInject: Number(data.pendingInject) || 0,
  }
}

/**
 * 查询应急红包池流水分页。
 * 2026-09-19 起支持 `type`（流水类型）与 `startDate`/`endDate`（发生日期区间，含当天）筛选；
 * 响应里新增 `summary`（当前筛选范围的汇总，与分页无关）—— 后端未下发时返回 null，页面隐藏汇总区。
 */
export async function getEmergencyPoolLogs(query: EmergencyPoolLogQuery): Promise<EmergencyPoolLogPageResult> {
  const params: Record<string, string | number> = { page: query.page, pageSize: query.pageSize }
  if (query.type) params.type = query.type
  if (query.startDate) params.startDate = query.startDate
  if (query.endDate) params.endDate = query.endDate

  const response = await request.get<EmergencyPoolResponse<EmergencyPoolLogPageResult>>('/api/admin/profit/emergency-pool/logs', { params, skipAuthRedirect: true })
  const data = unwrap(response, '应急红包池流水查询失败') || {} as EmergencyPoolLogPageResult
  const list = ((data.list || []) as EmergencyPoolLog[]).map((item) => ({ ...item, id: String(item.id ?? '') }))
  return {
    total: Number(data.total) || 0,
    list,
    page: Number(data.page) || query.page,
    pageSize: Number(data.pageSize) || query.pageSize,
    summary: data.summary ?? null,
  }
}

// ⚠️ 本文件**不再**导出 `injectEmergencyPool`（2026-09-24 删除）。
// 原因：应急池注入在 2026-09-24 由「只传金额」升级为「传注入层 / 目标池 / 备注 / 是否允许同日」，
// 请求体类型与服务端校验都变了。旧签名 `injectEmergencyPool(amount: number)` 与
// `@/api/profit` 的新签名**同名不同参**，留着极易被后人 import 错（编译期不报错、运行时后端报错）。
// 注入请统一用：`import { injectEmergencyPool } from '@/api/profit'`（入参 `BonusInjectDTO`）。
