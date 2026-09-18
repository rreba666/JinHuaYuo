<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Delete, Edit, Plus, Refresh, Search } from '@element-plus/icons-vue'
import { getUsers } from '@/api/user'
import { useProfitStore } from '@/stores/profit'
import type { LeaderboardPeriod, PromotionBinding, PromotionBindingSource } from '@/types/profit'
import type { User } from '@/types/user'

/**
 * 推广管理页（原「推广资金」拆分而来）。
 * 仅保留「待推广金」与「推广关系」两个能力；红包相关能力已迁至「红包管理」页（仅超级管理员可见）。
 */
const store = useProfitStore()
const activeTab = ref('promotion')
const rebindVisible = ref(false)
const rebindRow = ref<PromotionBinding | null>(null)
const promoterId = ref('')

/** 推广关系筛选条件：关键词（双向绑定 store，翻页/搜索后保持）。 */
const relationKeyword = computed({ get: () => store.relationFilters.keyword, set: (value: string) => { store.relationFilters.keyword = value } })
/** 推广关系筛选条件：绑定来源（双向绑定 store）。 */
const relationSource = computed<PromotionBindingSource | ''>({ get: () => store.relationFilters.source, set: (value) => { store.relationFilters.source = value } })

/** 金额展示格式化。 */
function money(value: number): string { return `¥ ${Number(value || 0).toFixed(2)}` }
/** 绑定状态 → 标签样式。 */
function statusType(status: string): 'success' | 'warning' | 'info' | 'danger' { return /CONFIRMED|SETTLED|SUCCESS|BOUND/i.test(status) ? 'success' : /REJECT|BLOCK|FAIL/i.test(status) ? 'danger' : /PENDING|WAIT/i.test(status) ? 'warning' : 'info' }
/** 绑定状态 → 中文文案（后端有 statusDesc 时优先展示 statusDesc）。 */
function statusText(status: string): string { return ({ PENDING: '待处理', CONFIRMED: '已确认', SETTLED: '已结算', BOUND: '已绑定' } as Record<string, string>)[status] || status || '未知' }
/** 统一错误提示（后端 message 优先）。 */
function showError(error: unknown, fallback: string): void { ElMessage.error(error instanceof Error ? error.message : fallback) }

/** 加载待推广金列表。 */
async function load(): Promise<void> { try { await store.fetchPendingPromotion() } catch (error) { showError(error, '待推广金加载失败') } }
/** 加载推广绑定关系列表。 */
async function loadRelations(): Promise<void> { try { await store.fetchRelations() } catch (error) { showError(error, '推广关系加载失败') } }
/** 待推广金翻页。 */
function pendingPageChange(page: number): void { store.pendingPage = page; void load() }
/** 待推广金切换每页条数（回到第一页）。 */
function pendingSizeChange(size: number): void { store.pendingSize = size; store.pendingPage = 1; void load() }
/** 推广关系搜索（回到第一页）。 */
function searchRelations(): void { store.relationPage = 1; void loadRelations() }
/** 推广关系翻页。 */
function relationPageChange(page: number): void { store.relationPage = page; void loadRelations() }
/** 推广关系切换每页条数（回到第一页）。 */
function relationSizeChange(size: number): void { store.relationSize = size; store.relationPage = 1; void loadRelations() }

/** 新增绑定弹窗：买家支持「搜索选择」或「直接输入用户 ID」，推广员直接输入用户 ID。 */
const bindVisible = ref(false)
const bindFormRef = ref<FormInstance>()
const bindForm = reactive({ buyerUserId: '', promoterId: '' })
const bindRules: FormRules = {
  buyerUserId: [{ required: true, message: '请选择或输入买家用户 ID', trigger: 'change' }],
  promoterId: [{ required: true, message: '请输入推广员用户 ID', trigger: 'blur' }],
}
/** 买家搜索关键词与候选列表。 */
const buyerKeyword = ref('')
const buyerOptions = ref<User[]>([])
const buyerLoading = ref(false)

/** 远程搜索买家：复用后台用户列表接口（纯数字按用户 ID 精确匹配，否则按昵称/手机号模糊匹配）。 */
async function searchBuyers(keyword: string): Promise<void> {
  const trimmed = keyword.trim()
  buyerKeyword.value = trimmed
  if (!trimmed) { buyerOptions.value = []; return }
  buyerLoading.value = true
  try {
    const result = await getUsers({ page: 1, pageSize: 20, keyword: trimmed })
    buyerOptions.value = result.list
  } catch (error) { showError(error, '用户搜索失败') } finally { buyerLoading.value = false }
}

/** 打开「新增绑定」弹窗（清空上一次的输入与候选）。 */
function openBind(): void {
  bindForm.buyerUserId = ''
  bindForm.promoterId = ''
  buyerKeyword.value = ''
  buyerOptions.value = []
  bindVisible.value = true
}

/** 提交「新增绑定」：仅对尚未绑定推广关系的买家生效，买家已有关系时后端会拒绝并提示改用重新绑定。 */
async function submitBind(): Promise<void> {
  if (!(await bindFormRef.value?.validate().catch(() => false))) return
  if (!/^[1-9]\d*$/.test(bindForm.buyerUserId) || !/^[1-9]\d*$/.test(bindForm.promoterId)) { ElMessage.warning('买家和推广员都必须是正整数用户 ID'); return }
  if (bindForm.buyerUserId === bindForm.promoterId) { ElMessage.warning('买家和推广员不能是同一个用户'); return }
  const matched = buyerOptions.value.find((user) => user.id === bindForm.buyerUserId)
  const buyerLabel = matched ? `${matched.nickname || '未命名用户'}（ID ${bindForm.buyerUserId}）` : `ID ${bindForm.buyerUserId}`
  try {
    await ElMessageBox.confirm(`将为买家 ${buyerLabel} 绑定推广员 ID ${bindForm.promoterId}。绑定只影响之后下单的推广归属，历史账务不回滚。确认继续吗？`, '确认新增绑定', { type: 'warning' })
    await store.createRelation(bindForm.buyerUserId, bindForm.promoterId)
    bindVisible.value = false
    ElMessage.success('推广关系已绑定')
  } catch (error) { if (error !== 'cancel' && error !== 'close') showError(error, '新增推广绑定失败') }
}

/** 打开「重新绑定推广员」弹窗，默认填入当前推广员 ID。 */
function openRebind(row: PromotionBinding): void { rebindRow.value = row; promoterId.value = row.promoterUserId; rebindVisible.value = true }
/** 提交重新绑定：仅影响后续订单，历史账务不回滚。 */
async function rebindPromotionRelation(): Promise<void> {
  if (!rebindRow.value || !/^[1-9]\d*$/.test(promoterId.value)) { ElMessage.warning('推广员 ID 必须为正整数'); return }
  try {
    await ElMessageBox.confirm('重绑仅影响后续订单，历史账务不回滚。确认继续吗？', '确认重新绑定', { type: 'warning' })
    await store.rebindRelation(rebindRow.value.buyerUserId, promoterId.value)
    rebindVisible.value = false
    ElMessage.success('推广关系已重新绑定')
  } catch (error) { if (error !== 'cancel' && error !== 'close') showError(error, '重新绑定失败') }
}
/** 解除绑定：仅影响后续订单，历史账务不回滚。 */
async function unbindPromotionRelation(row: PromotionBinding): Promise<void> {
  try {
    await ElMessageBox.confirm('解除绑定仅影响后续订单，历史账务不回滚。确认继续吗？', '确认解除绑定', { type: 'warning' })
    await store.unbindRelation(row.buyerUserId)
    ElMessage.success('推广关系已解除')
  } catch (error) { if (error !== 'cancel' && error !== 'close') showError(error, '解除绑定失败') }
}

/** 排行榜周期选项（与后端 period 枚举一致，默认本周与后端默认值对齐）。 */
const leaderboardPeriods: { label: string; value: LeaderboardPeriod }[] = [
  { label: '今日', value: 'DAY' },
  { label: '本周', value: 'WEEK' },
  { label: '本月', value: 'MONTH' },
  { label: '本年', value: 'YEAR' },
]

/** 排行榜轮询间隔（60s）：榜单按自然周期滚动统计、随支付实时变化，页签可见时定时刷新。 */
const LEADERBOARD_POLL_INTERVAL = 60 * 1000
/** 轮询定时器：切走页签或离开页面时清理，避免后台空跑请求。 */
let leaderboardTimer: ReturnType<typeof setInterval> | null = null

/** 当前周期区间文案（如「2026-09-14 ~ 2026-09-20」），让自然周/月/年覆盖哪几天一目了然。 */
const periodRange = computed(() => {
  const board = store.leaderboard
  if (!board) return ''
  const from = String(board.periodStart || '').slice(0, 10)
  const to = String(board.periodEnd || '').slice(0, 10)
  if (!from || !to) return ''
  return from === to ? from : `${from} ~ ${to}`
})

/**
 * 加载推广排行榜（B 端）。与 C 端同源同口径，但不返回「我的排名」。
 * @param silent 轮询触发时为 true：失败不弹提示、保留上一份数据，避免每分钟打扰。
 */
async function loadLeaderboard(silent = false): Promise<void> {
  try { await store.fetchLeaderboard() } catch (error) { if (!silent) showError(error, '推广排行榜加载失败') }
}

/** 停止排行榜轮询。 */
function stopLeaderboardPolling(): void {
  if (leaderboardTimer !== null) { clearInterval(leaderboardTimer); leaderboardTimer = null }
}

/** 启动排行榜轮询（仅在「推广排行榜」页签可见时；重复调用不会叠加定时器）。 */
function startLeaderboardPolling(): void {
  stopLeaderboardPolling()
  leaderboardTimer = setInterval(() => { if (activeTab.value === 'leaderboard') void loadLeaderboard(true) }, LEADERBOARD_POLL_INTERVAL)
}

/** 切页签：进入排行榜才加载并开始轮询，切走立即停止（懒加载 + 省请求）。 */
function handleTabChange(name: string | number): void {
  if (name === 'leaderboard') { void loadLeaderboard(); startLeaderboardPolling(); return }
  stopLeaderboardPolling()
}

/** 名次标签样式：前三名用醒目色，其余为普通信息色（B 端名次唯一、无并列）。 */
function rankType(rank: number): 'danger' | 'warning' | 'success' | 'info' {
  if (rank === 1) return 'danger'
  if (rank === 2) return 'warning'
  if (rank === 3) return 'success'
  return 'info'
}

/** 累计数据缺失时用「—」占位（后端尚未下发累计字段，避免显示成 0）。 */
function totalText(value: number | null | undefined, suffix = ''): string {
  return value == null ? '—' : `${value}${suffix}`
}

onMounted(() => { void load(); void loadRelations() })
/** 离开页面清理轮询定时器。 */
onUnmounted(() => stopLeaderboardPolling())
</script>

<template>
  <section class="page-container page-enter">
    <div class="page-heading"><div><h1>推广管理</h1><p>待推广金明细与用户推广绑定关系；红包相关功能请前往「红包管理」。</p></div><el-button :loading="store.loading" @click="load"><el-icon><Refresh /></el-icon>刷新</el-button></div>
    <el-tabs v-model="activeTab" class="module-tabs" @tab-change="handleTabChange">
      <el-tab-pane label="待推广金" name="promotion">
        <el-card shadow="never" class="content-card"><div class="toolbar"><div><strong>待推广金</strong><span class="toolbar-count">共 {{ store.pendingTotal }} 条</span></div></div>
          <el-table :data="store.pendingPromotion" v-loading="store.loading" border stripe><el-table-column prop="id" label="记录 ID" width="110" /><el-table-column prop="orderNo" label="订单号" min-width="180" /><el-table-column prop="promoterUserId" label="推广用户" width="120" /><el-table-column prop="buyerUserId" label="购买用户" width="120" /><el-table-column label="金额" width="120"><template #default="{ row }">{{ money(row.amount) }}</template></el-table-column><el-table-column prop="createdAt" label="创建时间" min-width="180" /></el-table>
          <div class="table-pagination"><span>共 {{ store.pendingTotal }} 条</span><el-pagination background layout="total, sizes, prev, pager, next" :current-page="store.pendingPage" :page-size="store.pendingSize" :total="store.pendingTotal" @current-change="pendingPageChange" @size-change="pendingSizeChange" /></div>
        </el-card>
      </el-tab-pane>
      <el-tab-pane label="推广关系" name="relations">
        <el-card shadow="never" class="content-card"><div class="toolbar"><div><strong>推广关系</strong><span class="toolbar-count">共 {{ store.relationTotal }} 条</span></div><div class="toolbar-actions"><el-input v-model="relationKeyword" placeholder="买家或推广员关键词" clearable class="relationKeyword" @keyup.enter="searchRelations" /><el-select v-model="relationSource" clearable placeholder="来源" class="relationSource"><el-option label="扫码绑定" value="SCAN" /><el-option label="手动绑定" value="MANUAL" /><el-option label="未知来源" value="UNKNOWN" /></el-select><el-button :icon="Search" @click="searchRelations">搜索</el-button><el-button type="primary" :icon="Plus" :loading="store.relationActionLoading" @click="openBind">新增绑定</el-button></div></div>
          <el-table :data="store.relations" v-loading="store.relationLoading" border stripe><el-table-column prop="buyerUserId" label="买家 ID" width="110" /><el-table-column prop="buyerName" label="买家" min-width="130" /><el-table-column prop="promoterUserId" label="推广员 ID" width="120" /><el-table-column prop="promoterName" label="推广员" min-width="130" /><el-table-column prop="bindTime" label="绑定时间" min-width="170" /><el-table-column prop="sourceDesc" label="来源" width="110" /><el-table-column label="状态" width="95"><template #default="{ row }"><el-tag :type="statusType(row.status)">{{ row.statusDesc || statusText(row.status) }}</el-tag></template></el-table-column><el-table-column label="操作" width="190" fixed="right"><template #default="{ row }"><div class="operator-actions"><el-button size="small" type="primary" :loading="store.relationActionLoading" @click="openRebind(row)"><el-icon><Edit /></el-icon>重新绑定</el-button><el-button size="small" type="danger" :loading="store.relationActionLoading" @click="unbindPromotionRelation(row)"><el-icon><Delete /></el-icon>解除绑定</el-button></div></template></el-table-column></el-table>
          <div class="table-pagination"><span>共 {{ store.relationTotal }} 条</span><el-pagination background layout="total, sizes, prev, pager, next" :current-page="store.relationPage" :page-size="store.relationSize" :total="store.relationTotal" @current-change="relationPageChange" @size-change="relationSizeChange" /></div>
        </el-card>
      </el-tab-pane>
      <el-tab-pane label="推广排行榜" name="leaderboard">
        <el-card shadow="never" class="content-card"><div class="toolbar"><div><strong>推广排行榜</strong><span class="toolbar-count">{{ store.leaderboard?.periodLabel || '' }}按本周期推广人数排名</span></div><div class="toolbar-actions"><el-radio-group v-model="store.leaderboardPeriod" @change="() => loadLeaderboard()"><el-radio-button v-for="opt in leaderboardPeriods" :key="opt.value" :value="opt.value">{{ opt.label }}</el-radio-button></el-radio-group><el-button :loading="store.leaderboardLoading" @click="loadLeaderboard()"><el-icon><Refresh /></el-icon>刷新</el-button></div></div>
          <p class="leaderboard-tip">只统计「推广金已生成」（被推广人支付成功）且未退款作废的推广，按去重人数排名，时间锚点为支付时间。<template v-if="store.leaderboard">{{ store.leaderboard.periodLabel }}（{{ periodRange }}）· 数据截至 {{ store.leaderboard.asOf }}；按自然周/月/年统计，含尚未走完的当前周期，排名随支付实时变化（页面每 60 秒自动刷新）。</template></p>
          <el-table :data="store.leaderboard?.list || []" v-loading="store.leaderboardLoading" border stripe empty-text="本周期暂无推广数据"><el-table-column label="名次" width="90"><template #default="{ row }"><el-tag :type="rankType(row.rank)" effect="dark" round>{{ row.rank }}</el-tag></template></el-table-column><el-table-column label="用户" min-width="180"><template #default="{ row }"><div class="leaderboard-user"><el-avatar :size="28" :src="row.avatarUrl || undefined">{{ (row.nickname || '用').slice(0, 1) }}</el-avatar><span>{{ row.nickname || '微信用户' }}</span></div></template></el-table-column><el-table-column prop="promoterUserId" label="用户 ID" width="110" /><el-table-column label="本周期推广人数" width="140"><template #default="{ row }">{{ row.promotedUserCount }} 人</template></el-table-column><el-table-column label="本周期推广金" width="140"><template #default="{ row }">{{ money(row.promotionAmount) }}</template></el-table-column><el-table-column label="累计推广人数" width="130"><template #default="{ row }">{{ totalText(row.totalPromotedUserCount, ' 人') }}</template></el-table-column><el-table-column label="累计推广金" width="130"><template #default="{ row }">{{ row.totalPromotionAmount == null ? '—' : money(row.totalPromotionAmount) }}</template></el-table-column></el-table>
        </el-card>
      </el-tab-pane>
    </el-tabs>
    <el-dialog v-model="rebindVisible" title="重新绑定推广员" width="460px" append-to-body><p v-if="rebindRow" class="dialog-context">买家：{{ rebindRow.buyerName || rebindRow.buyerUserId }}</p><el-input v-model="promoterId" placeholder="请输入推广员 ID" inputmode="numeric" /><template #footer><el-button @click="rebindVisible = false">取消</el-button><el-button type="primary" :loading="store.relationActionLoading" @click="rebindPromotionRelation">重新绑定</el-button></template></el-dialog>
    <el-dialog v-model="bindVisible" title="新增推广绑定" width="540px" append-to-body>
      <el-alert title="只能给「尚未绑定推广关系」的买家绑定" description="买家已有推广关系时请用列表里的「重新绑定」；绑定只影响之后下单的推广归属，历史账务不回滚。" type="info" :closable="false" show-icon class="bind-alert" />
      <el-form ref="bindFormRef" :model="bindForm" :rules="bindRules" label-width="96px">
        <el-form-item label="买家" prop="buyerUserId">
          <el-select v-model="bindForm.buyerUserId" class="bind-buyer-select" filterable remote allow-create default-first-option clearable reserve-keyword placeholder="搜索用户 ID / 昵称 / 手机号，或直接输入用户 ID" :remote-method="searchBuyers" :loading="buyerLoading">
            <el-option v-for="user in buyerOptions" :key="user.id" :label="`${user.nickname || '未命名用户'}（ID ${user.id}${user.phone ? ` · ${user.phone}` : ''}）`" :value="user.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="推广员 ID" prop="promoterId">
          <el-input v-model="bindForm.promoterId" placeholder="请输入推广员用户 ID（正整数）" inputmode="numeric" />
        </el-form-item>
      </el-form>
      <p class="bind-tip">提示：买家的「当前推广关系」以列表为准；绑定成功后该买家会出现在列表里。</p>
      <template #footer><el-button @click="bindVisible = false">取消</el-button><el-button type="primary" :loading="store.relationActionLoading" @click="submitBind">确认绑定</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.module-tabs { min-width: 0; }
.module-tabs :deep(.el-tabs__content) { overflow: visible; }
.operator-actions { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.operator-actions :deep(.el-button) { margin-left: 0; padding: 5px 8px; }
.operator-actions :deep(.el-icon) { margin-right: 4px; }
.toolbar-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.relationKeyword { width: 220px; }
.relationSource { width: 140px; }
.table-pagination { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding-top: 16px; }
.dialog-context { color: var(--el-text-color-secondary); margin: 0 0 12px; }
.bind-alert { margin-bottom: 16px; }
.bind-buyer-select { width: 100%; }
.bind-tip { margin: 0; color: var(--el-text-color-secondary); font-size: 12px; line-height: 18px; }
.leaderboard-tip { margin: 0 0 12px; color: var(--el-text-color-secondary); font-size: 12px; line-height: 18px; }
.leaderboard-user { display: flex; align-items: center; gap: 8px; }
@media (max-width: 900px) { .toolbar-actions, .table-pagination { align-items: stretch; flex-direction: column; } .relationKeyword, .relationSource { width: 100%; } }
</style>
