import { request } from './request'

/** 待办等级（决定下拉项颜色）。 */
export type TodoLevel = 'INFO' | 'WARN' | 'DANGER'

/** 待办项（后端 `AdminTodoKeyEnum` 驱动；新增类型前端无需发版）。 */
export interface TodoItem {
  /** 稳定标识（前端按 key 兜底图标/排序）。 */
  key: string
  /** 中文文案（**直接展示，前端不自拼**）。 */
  label: string
  /** 待办数量；**`0` 的项前端不展示**（后端照常返回便于统计）。 */
  count: number
  /** 点击跳转的后台路由（可带 query，直接 `router.push`）。 */
  route: string
  /** 颜色等级：INFO 蓝 / WARN 橙 / DANGER 红（缺省 INFO）。 */
  level?: TodoLevel
}

/** 待办汇总（`GET /api/admin/todo/summary`）。 */
export interface TodoSummary {
  /** 所有待办数量之和（徽标用；>99 显示 99+，=0 不显示徽标）。 */
  total: number
  items: TodoItem[]
}

interface TodoResponse {
  code: number
  message: string
  data?: TodoSummary | null
  success?: boolean
}

/**
 * 查询后台待办汇总（右上角铃铛数据源）。
 * - 后端按登录角色过滤（财务仅「提现待审核」；商户管理员/客服不看资金类）；
 * - 单类统计失败不影响整体（该项 `count=0`，接口仍 200）；
 * - 建议 **30~60s 轮询**，进入后台立即拉一次；
 * - 失败时前端**不报错**：不显示徽标、下拉显示「暂无待办」。
 */
export async function getTodoSummary(): Promise<TodoSummary> {
  const response = await request.get<TodoResponse>('/api/admin/todo/summary')
  const result = response.data
  if (result.code !== 0 || result.success === false) throw new Error(result.message || '待办汇总查询失败')
  const data = result.data
  return {
    total: Number(data?.total || 0),
    items: Array.isArray(data?.items) ? data.items : [],
  }
}
