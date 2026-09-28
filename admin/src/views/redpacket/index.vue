<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Refresh, Search, Setting, View } from '@element-plus/icons-vue'
import { cancelPoolHoldPlan, createPoolHoldPlan, getDividendRecordTestResult, getDividendSlotTestResult, getPoolHoldPlans, getPoolHoldPreview, getWalletTestResult, holdPool, releasePool } from '@/api/profit'
import { useProfitStore } from '@/stores/profit'
import { normalizeLegacyWording } from '@/utils/wording'
import DividendPacketPanel from '@/components/profit/DividendPacketPanel.vue'
import EmergencyPoolPanel from '@/components/profit/EmergencyPoolPanel.vue'
import OldLayerPanel from '@/components/profit/OldLayerPanel.vue'
import type { HoldPreview, DividendPoolHoldPlan, DividendRecordTestResult, DividendSlotTestResult, ProfitAdjustDailyDTO, ProfitAdjustPoolDTO, SevenDayBonusDetail, SevenDayBonusPool, UserDividendLimit, WalletTestResult } from '@/types/profit'

/**
 * 红包管理页（原「推广资金」拆分而来，仅超级管理员可见）。
 * 包含：红包贡献、红包测试、周红包、用户购买机会、用户红包槽位、应急红包池。
 */
const store = useProfitStore()
const activeTab = ref('contributions')
const poolDetailVisible = ref(false)
const adjustPoolVisible = ref(false)
const adjustDailyVisible = ref(false)
const adjustPoolFormRef = ref<FormInstance>()
const adjustDailyFormRef = ref<FormInstance>()
const adjustPoolForm = reactive<ProfitAdjustPoolDTO>({ totalAmount: 0, userCount: 0 })
const adjustDailyForm = reactive<ProfitAdjustDailyDTO>({ dailyAmount: 0, dailyUserCount: 0 })
const poolFormRules: FormRules = { totalAmount: [{ required: true, message: '请输入红包总金额', trigger: 'blur' }], userCount: [{ required: true, message: '请输入用户数', trigger: 'blur' }] }
const dailyFormRules: FormRules = { dailyAmount: [{ required: true, message: '请输入每日金额', trigger: 'blur' }], dailyUserCount: [{ required: true, message: '请输入每日用户数', trigger: 'blur' }] }
const poolId = ref('')
const dailyId = ref('')
const testInjectForm = reactive({ poolDate: '', amount: 1000 })
const testPoolId = ref('')
const userToken = ref('')
const testResultLoading = ref(false)
const walletTestResult = ref<WalletTestResult | null>(null)
const dividendSlotTestResult = ref<DividendSlotTestResult | null>(null)
const dividendRecordTestResult = ref<DividendRecordTestResult | null>(null)
const slotSearchUserId = ref('')
const dailyUsersDialogVisible = ref(false)
const dailyUsersAsOfDate = ref('')

/** 红包测试第 4 步选中的父红包。 */
const selectedTestPool = computed(() => store.sevenDayPools.find((pool) => pool.id === testPoolId.value) || null)

/** 金额展示格式化。 */
function money(value: number): string { return `¥ ${Number(value || 0).toFixed(2)}` }
/** 红包槽位状态文案。 */
function slotStatus(row: { locked?: number; invalidFlag?: number }): string { return Number(row.invalidFlag) === 1 ? '退款作废' : Number(row.locked) === 1 ? '满额锁死' : '活跃' }
/** 红包槽位状态标签样式。 */
function slotType(row: { locked?: number; invalidFlag?: number }): 'success' | 'warning' | 'info' { return Number(row.invalidFlag) === 1 ? 'info' : Number(row.locked) === 1 ? 'warning' : 'success' }
/** 红包贡献状态文案（后端有 statusDesc 时优先展示；下发文案含历史用词时统一兜底归一化）。 */
function contributionStatusText(status: string, statusDesc = ''): string { return normalizeLegacyWording(statusDesc) || ({ PENDING: '待确认（7天后自动确认）', CONFIRMING: '系统确认中', CONFIRMED: '已进入红包池', VOIDED: '订单退款，红包作废' } as Record<string, string>)[status] || status || '未知' }
/** 红包贡献状态标签样式。 */
function contributionStatusType(status: string): 'success' | 'warning' | 'info' | 'danger' { return status === 'CONFIRMED' ? 'success' : status === 'VOIDED' ? 'danger' : status === 'PENDING' ? 'warning' : 'info' }
/** 时间展示（空值显示未完成）。 */
function displayTime(value: string): string { return value || '未完成' }
/** 统一错误提示（后端 message 优先）。 */
function showError(error: unknown, fallback: string): void { ElMessage.error(error instanceof Error ? error.message : fallback) }

/** 加载红包池 / 每日明细 / 用户购买机会 / 红包槽位。 */
async function load(): Promise<void> { try { await store.fetchRedPacketData() } catch (error) { showError(error, '红包数据加载失败') } }
/** 加载红包贡献记录。 */
async function loadContributions(): Promise<void> { try { await store.fetchContributions() } catch (error) { showError(error, '红包贡献加载失败') } }
/** 切换 tab 时按需加载红包贡献（首次进入才请求）。 */
function handleTabChange(name: string | number): void { if (String(name) === 'contributions' && !store.contributions.length) void loadContributions() }
/** 红包贡献状态筛选（回到第一页）。 */
function contributionStatusChange(): void { store.contributionPage = 1; void loadContributions() }
/** 红包贡献翻页。 */
function contributionPageChange(page: number): void { store.contributionPage = page; void loadContributions() }
/** 红包贡献切换每页条数（回到第一页）。 */
function contributionSizeChange(size: number): void { store.contributionSize = size; store.contributionPage = 1; void loadContributions() }

/** 红包测试第 2 步：向指定日期的每日红包注入金额（不立即发放）。 */
async function injectTestPool(): Promise<void> {
  const amount = Number(testInjectForm.amount)
  if (!Number.isFinite(amount) || amount <= 0) { ElMessage.warning('注入金额必须大于 0'); return }
  try {
    await ElMessageBox.confirm(`将向 ${testInjectForm.poolDate || '今天'} 的每日红包追加 ${money(amount)}，不会立即发放给用户。确认继续吗？`, '确认注入红包', { type: 'warning' })
    await store.inject({ poolDate: testInjectForm.poolDate || undefined, amount })
    ElMessage.success('红包金额已注入，请继续查看未结算红包')
  } catch (error) { if (error !== 'cancel' && error !== 'close') showError(error, '红包注入失败') }
}

/** 红包测试第 5 步：用 C 端 Token 核验钱包 / 槽位 / 红包流水。 */
async function verifyUserDividend(): Promise<void> {
  if (!userToken.value.trim()) { ElMessage.warning('请输入 C 端用户 Token'); return }
  testResultLoading.value = true
  try {
    const [wallet, slots, records] = await Promise.all([
      getWalletTestResult(userToken.value),
      getDividendSlotTestResult(userToken.value),
      getDividendRecordTestResult(userToken.value),
    ])
    walletTestResult.value = wallet
    dividendSlotTestResult.value = slots
    dividendRecordTestResult.value = records
    ElMessage.success('C 端红包结果已刷新')
  } catch (error) { showError(error, 'C 端红包结果查询失败') } finally { testResultLoading.value = false }
}
/** 清空 C 端核验结果与 Token（不落库）。 */
function clearUserDividendResult(): void {
  userToken.value = ''
  walletTestResult.value = null
  dividendSlotTestResult.value = null
  dividendRecordTestResult.value = null
}
/** 查看父红包下的每日红包明细。 */
async function showPoolDetails(pool: SevenDayBonusPool): Promise<void> { try { await store.fetchPoolDetails(pool.id); poolDetailVisible.value = true } catch (error) { showError(error, '红包明细加载失败') } }
/** 打开父红包调整弹窗。 */
function openPoolAdjust(pool: SevenDayBonusPool): void { poolId.value = pool.id; Object.assign(adjustPoolForm, { totalAmount: pool.totalAmount, userCount: pool.settledUserCount }); adjustPoolVisible.value = true }
/** 提交父红包调整。 */
async function submitPoolAdjust(): Promise<void> { if (!(await adjustPoolFormRef.value?.validate().catch(() => false))) return; try { await store.adjust(poolId.value, { ...adjustPoolForm }); adjustPoolVisible.value = false; ElMessage.success('红包已调整') } catch (error) { showError(error, '红包调整失败') } }
/** 打开每日红包调整弹窗。 */
function openDailyAdjust(detail: SevenDayBonusDetail): void { dailyId.value = detail.id; Object.assign(adjustDailyForm, { dailyAmount: detail.dailyAmount, dailyUserCount: detail.dailyUserCount }); adjustDailyVisible.value = true }
/** 提交每日红包调整。 */
// ===== 暂停发放 / 释放（2026-09-28 后端新增；放假期间让某周红包一分不发、节后顺延补发）=====
const holdPlanVisible = ref(false)
const holdPlanSubmitting = ref(false)
const holdPlans = ref<DividendPoolHoldPlan[]>([])
const holdPlanForm = reactive({ poolStartDate: '', reason: '' })
const holdPreview = ref<HoldPreview | null>(null)
const holdPreviewLoading = ref(false)
const releaseVisible = ref(false)
const releaseSubmitting = ref(false)
const releaseForm = reactive({ poolId: '', releaseDate: '' })

/** 释放目标池（用于弹窗里显示"未发金额"等上下文）。 */
const releaseTarget = computed(() => store.sevenDayPools.find((pool) => pool.id === releaseForm.poolId) || null)

/** 格式化日期为 yyyy-MM-dd。 */
function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * 预约的默认目标周：**本周一**；若该周的池**已经建出**，则顺延一周。
 * ⚠️ 预约只能停「**还没建出**」的池（建池那一刻才自动生效）——已建出的池要用「立即暂停」。
 */
function defaultHoldWeekStart(): string {
  const now = new Date()
  const weekday = now.getDay() || 7 // 周一=1 … 周日=7
  const monday = new Date(now)
  monday.setDate(now.getDate() - (weekday - 1))
  let week = formatDate(monday)
  if (store.sevenDayPools.some((pool) => pool.startDate === week)) {
    monday.setDate(monday.getDate() + 7)
    week = formatDate(monday)
  }
  return week
}

/** 暂停状态文案（⚠️ 用户可见，禁用旧词）。 */
function holdStatusText(pool: SevenDayBonusPool): string {
  if (pool.holdStatus === 'HELD' || pool.held) return '已暂停发放'
  if (pool.holdStatus === 'RELEASED') return '已释放补发'
  return '正常发放'
}

/** 暂停状态标签类型。 */
function holdStatusType(pool: SevenDayBonusPool): 'success' | 'warning' | 'info' {
  if (pool.holdStatus === 'HELD' || pool.held) return 'warning'
  if (pool.holdStatus === 'RELEASED') return 'info'
  return 'success'
}

/** 该池是否处于「已暂停待释放」（只有这种状态才能点释放）。 */
function isPoolHeld(pool: SevenDayBonusPool): boolean {
  return pool.holdStatus === 'HELD' || pool.held === true
}

/** 该池是否已经开始发放（前端粗判，最终以后端 hold-preview 的 blockers 为准）。 */
function isPoolStarted(pool: SevenDayBonusPool): boolean {
  return Number(pool.totalAmount || 0) > 0 && pool.settleTime !== '' && !isPoolHeld(pool)
}

/** 加载预约记录列表。 */
async function loadHoldPlans(): Promise<void> {
  try {
    holdPlans.value = await getPoolHoldPlans()
  } catch (error) {
    // 预约列表只是辅助信息，失败不打断主流程
    console.warn('[redpacket] 预约列表加载失败：', error)
    holdPlans.value = []
  }
}

/** 打开「预约暂停」弹窗。 */
function openHoldPlan(): void {
  holdPlanForm.poolStartDate = defaultHoldWeekStart()
  holdPlanForm.reason = ''
  holdPreview.value = null
  holdPlanVisible.value = true
}

/** 预约前先调 hold-preview：拿未发金额、受影响批次与阻断原因（blockers）。 */
async function previewHoldPlan(): Promise<void> {
  if (!holdPlanForm.poolStartDate) return
  holdPreviewLoading.value = true
  try {
    holdPreview.value = await getPoolHoldPreview({ poolStartDate: holdPlanForm.poolStartDate })
  } catch (error) {
    showError(error, '暂停预览失败')
    holdPreview.value = null
  } finally {
    holdPreviewLoading.value = false
  }
}

/** 提交预约暂停。 */
async function submitHoldPlan(): Promise<void> {
  if (!holdPlanForm.poolStartDate) { ElMessage.warning('请填写成交周起始日（周一）'); return }
  holdPlanSubmitting.value = true
  try {
    await createPoolHoldPlan({ poolStartDate: holdPlanForm.poolStartDate, reason: holdPlanForm.reason || undefined })
    ElMessage.success('预约已提交：该周建池时将自动暂停发放')
    holdPlanVisible.value = false
    await loadHoldPlans()
    await load()
  } catch (error) {
    showError(error, '预约暂停失败')
  } finally {
    holdPlanSubmitting.value = false
  }
}

/** 取消预约。 */
async function cancelPlan(plan: DividendPoolHoldPlan): Promise<void> {
  try {
    await ElMessageBox.confirm(`确认取消「${plan.poolStartDate} 当周」的暂停预约？`, '取消预约', { type: 'warning' })
  } catch { return }
  try {
    await cancelPoolHoldPlan(plan.id)
    ElMessage.success('预约已取消')
    await loadHoldPlans()
  } catch (error) {
    showError(error, '取消预约失败')
  }
}

/** 立即暂停（用于**已经建出**的池；要求该池一分未发，否则后端拒绝）。 */
async function applyHoldNow(pool: SevenDayBonusPool): Promise<void> {
  try {
    const reason = await ElMessageBox.prompt(
      `确认立即暂停「${pool.startDate} 至 ${pool.endDate}」这一周的红包发放？暂停后该周一分不发、金额冻结在池内，需手动「释放发放」。`,
      '立即暂停发放',
      { type: 'warning', inputPlaceholder: '暂停原因（选填）', confirmButtonText: '确认暂停', cancelButtonText: '取消' },
    )
    await holdPool(pool.id, { reason: reason.value || undefined })
    ElMessage.success('已暂停发放')
    await load()
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    showError(error, '暂停发放失败')
  }
}

/** 打开「释放发放」弹窗（默认首日 = 今天）。 */
function openRelease(pool: SevenDayBonusPool): void {
  releaseForm.poolId = pool.id
  releaseForm.releaseDate = formatDate(new Date())
  releaseVisible.value = true
}

/** 提交释放发放：7 个批次重排为该日 +0…+6 逐日补发。 */
async function submitRelease(): Promise<void> {
  releaseSubmitting.value = true
  try {
    await releasePool(releaseForm.poolId, { releaseDate: releaseForm.releaseDate || undefined })
    ElMessage.success('已释放：7 个批次将从所选首日起逐日补发')
    releaseVisible.value = false
    await load()
  } catch (error) {
    showError(error, '释放发放失败')
  } finally {
    releaseSubmitting.value = false
  }
}

/** 页面挂载后补拉预约记录（失败静默）。 */
onMounted(() => { void loadHoldPlans() })
async function submitDailyAdjust(): Promise<void> { if (!(await adjustDailyFormRef.value?.validate().catch(() => false))) return; try { await store.adjustDetail(dailyId.value, { ...adjustDailyForm }); adjustDailyVisible.value = false; ElMessage.success('每日红包已调整') } catch (error) { showError(error, '每日红包调整失败') } }

/** 查询后台「用户红包资格」槽位（按 userId 过滤，留空查全部；只读）。 */
async function searchSlots(): Promise<void> {
  try {
    await store.fetchAdminSlots(slotSearchUserId.value.trim() || undefined)
  } catch (error) {
    showError(error, '用户红包槽位加载失败')
  }
}

/** 查看某支付日的累计用户贡献明细。 */
async function viewDailyUsers(detail: SevenDayBonusDetail): Promise<void> {
  try {
    await store.fetchDailyUsers(detail.poolDate)
    dailyUsersAsOfDate.value = detail.poolDate
    dailyUsersDialogVisible.value = true
  } catch (error) {
    showError(error, '累计用户明细加载失败')
  }
}

onMounted(() => { void load(); void loadContributions() })
</script>

<template>
  <section class="page-container page-enter">
    <div class="page-heading"><div><h1>红包管理</h1><p>红包贡献记录、发放与结算、用户购买机会及红包槽位。</p></div><el-button :loading="store.loading" @click="load"><el-icon><Refresh /></el-icon>刷新</el-button></div>
    <el-tabs v-model="activeTab" class="module-tabs" @tab-change="handleTabChange">
      <el-tab-pane label="红包贡献" name="contributions">
        <el-alert title="红包贡献记录只读，不能人工确认" description="PENDING 记录表示已记录红包金额，等待系统自动确认；订单退款后会标记为作废。" type="info" :closable="false" show-icon class="contribution-alert" />
        <el-card shadow="never" class="content-card">
          <div class="toolbar"><div><strong>红包贡献记录</strong><span class="toolbar-count">共 {{ store.contributionTotal }} 条</span></div><div class="toolbar-actions"><el-select v-model="store.contributionStatus" clearable placeholder="全部状态" class="contribution-status" @change="contributionStatusChange"><el-option label="待确认" value="PENDING" /><el-option label="系统确认中" value="CONFIRMING" /><el-option label="已进入红包池" value="CONFIRMED" /><el-option label="订单退款，红包作废" value="VOIDED" /></el-select><el-button :loading="store.contributionLoading" @click="loadContributions"><el-icon><Refresh /></el-icon>刷新</el-button></div></div>
          <el-table :data="store.contributions" v-loading="store.contributionLoading" border stripe empty-text="暂无红包贡献记录"><el-table-column prop="orderNo" label="订单号" min-width="190" /><el-table-column label="用户" min-width="150"><template #default="{ row }"><div>{{ row.userName || '未命名用户' }}</div><small class="muted-text">ID：{{ row.userId || '—' }}</small></template></el-table-column><el-table-column label="贡献金额" width="130"><template #default="{ row }">{{ money(row.amount) }}</template></el-table-column><el-table-column prop="paidAt" label="支付时间" min-width="170" /><el-table-column label="预计成熟时间" min-width="170"><template #default="{ row }">{{ displayTime(row.matureAt) }}</template></el-table-column><el-table-column label="状态" min-width="170"><template #default="{ row }"><el-tag :type="contributionStatusType(row.status)">{{ contributionStatusText(row.status, row.statusDesc) }}</el-tag></template></el-table-column><el-table-column label="确认时间" min-width="170"><template #default="{ row }">{{ displayTime(row.confirmedAt) }}</template></el-table-column><el-table-column prop="poolId" label="红包 ID" width="110" /></el-table>
          <div class="table-pagination"><span>共 {{ store.contributionTotal }} 条</span><el-pagination background layout="total, sizes, prev, pager, next" :current-page="store.contributionPage" :page-size="store.contributionSize" :total="store.contributionTotal" @current-change="contributionPageChange" @size-change="contributionSizeChange" /></div>
        </el-card>
      </el-tab-pane>
      <el-tab-pane label="红包测试" name="test">
        <el-alert title="测试流程：先确认用户有有效订单和活跃红包槽位，再注入红包、结算、选择父红包并确认发放。结算不会直接给用户加钱。" type="info" :closable="false" show-icon class="test-alert" />
        <div class="test-step-grid">
          <el-card shadow="never" class="content-card test-step-card">
            <div class="test-step-heading"><div><span class="step-index">1</span><strong>准备资格</strong></div><el-button size="small" :loading="store.loading" @click="load"><el-icon><Refresh /></el-icon>刷新资格</el-button></div>
            <p class="test-help">用户必须有有效订单和未锁死的红包槽位。当前购买机会列表共 {{ store.dividendLimits.length }} 条。</p>
            <el-table :data="store.dividendLimits.slice(0, 5)" v-loading="store.loading" border stripe size="small"><el-table-column prop="userId" label="用户 ID" width="100" /><el-table-column prop="availablePurchase" label="可用机会" /><el-table-column prop="totalPurchases" label="累计购买" /></el-table>
          </el-card>
          <el-card shadow="never" class="content-card test-step-card">
            <div class="test-step-heading"><div><span class="step-index">2</span><strong>注入红包金额</strong></div></div>
            <p class="test-help">只累加指定日期的每日红包，不会立即发放。注入后可在未结算红包中确认金额。</p>
            <div class="test-form-row"><el-date-picker v-model="testInjectForm.poolDate" type="date" value-format="YYYY-MM-DD" placeholder="注入日期（默认今天）" /><el-input-number v-model="testInjectForm.amount" :min="0.01" :precision="2" controls-position="right" /><el-button type="primary" :loading="store.actionLoading" @click="injectTestPool">注入红包金额</el-button></div>
            <el-table :data="store.unsettledDaily" v-loading="store.loading" border stripe size="small" class="test-table"><el-table-column prop="poolDate" label="日期" /><el-table-column label="每日金额"><template #default="{ row }">{{ money(row.dailyAmount) }}</template></el-table-column><el-table-column prop="dailyUserCount" label="用户数" /></el-table>
          </el-card>
          <el-card shadow="never" class="content-card test-step-card">
            <div class="test-step-heading"><div><span class="step-index">3</span><strong>结算每日红包</strong></div></div>
            <p class="test-help">手动结算已由系统自动完成（每日 00:00 定时结算），此处仅查看，不支持手动结算。</p>
          </el-card>
          <el-card shadow="never" class="content-card test-step-card">
            <div class="test-step-heading"><div><span class="step-index">4</span><strong>查看并发放父红包</strong></div></div>
            <p class="test-help">父红包已由系统自动发放（每日 00:00 定时发放）。此处仅查看明细，不支持手动发放。</p>
            <div class="test-form-row"><el-select v-model="testPoolId" placeholder="选择父红包" class="test-pool-select"><el-option v-for="pool in store.sevenDayPools" :key="pool.id" :label="`${pool.id}：${pool.startDate} 至 ${pool.endDate}，${money(pool.totalAmount)}`" :value="pool.id" /></el-select><el-button :disabled="!selectedTestPool" @click="selectedTestPool && showPoolDetails(selectedTestPool)"><el-icon><View /></el-icon>查看明细</el-button></div>
            <el-descriptions v-if="selectedTestPool" :column="3" border size="small" class="test-summary"><el-descriptions-item label="红包 ID">{{ selectedTestPool.id }}</el-descriptions-item><el-descriptions-item label="总金额">{{ money(selectedTestPool.totalAmount) }}</el-descriptions-item><el-descriptions-item label="结算人数">{{ selectedTestPool.settledUserCount }}</el-descriptions-item></el-descriptions>
          </el-card>
          <el-card shadow="never" class="content-card test-step-card test-result-card">
            <div class="test-step-heading"><div><span class="step-index">5</span><strong>C 端核验红包结果</strong></div><el-button text @click="clearUserDividendResult">清空</el-button></div>
            <p class="test-help">粘贴对应用户的 C 端 Token，仅用于本次查询，不会保存，也不会影响当前管理员登录。</p>
            <div class="test-form-row test-token-row"><el-input v-model="userToken" type="textarea" :rows="2" clearable placeholder="请输入 C 端用户 Token" /><el-button type="primary" :loading="testResultLoading" @click="verifyUserDividend">查询结果</el-button></div>
            <div v-if="walletTestResult || dividendSlotTestResult || dividendRecordTestResult" class="test-result-grid">
              <el-descriptions v-if="walletTestResult" title="钱包信息" :column="4" border size="small"><el-descriptions-item label="余额">{{ money(walletTestResult.balance) }}</el-descriptions-item><el-descriptions-item label="待提现推广金">{{ money(walletTestResult.pendingPromotion) }}</el-descriptions-item><el-descriptions-item label="待提现红包">{{ money(walletTestResult.pendingBonus) }}</el-descriptions-item><el-descriptions-item label="累计收入">{{ money(walletTestResult.totalIncome) }}</el-descriptions-item></el-descriptions>
              <el-descriptions v-if="dividendSlotTestResult" title="红包槽位" :column="3" border size="small"><el-descriptions-item label="可用购买机会">{{ dividendSlotTestResult.availablePurchase }}</el-descriptions-item><el-descriptions-item label="累计购买">{{ dividendSlotTestResult.totalPurchases }}</el-descriptions-item><el-descriptions-item label="槽位数量">{{ dividendSlotTestResult.slots.length }}</el-descriptions-item></el-descriptions>
              <el-table v-if="dividendSlotTestResult" :data="dividendSlotTestResult.slots" border stripe size="small"><el-table-column prop="id" label="槽位 ID" width="90" /><el-table-column prop="productName" label="商品" min-width="160" /><el-table-column label="累计红包"><template #default="{ row }">{{ money(row.totalReceived) }}</template></el-table-column><el-table-column label="上限"><template #default="{ row }">{{ money(row.capAmount) }}</template></el-table-column><el-table-column prop="locked" label="锁死" width="80"><template #default="{ row }">{{ row.locked ? '是' : '否' }}</template></el-table-column></el-table>
              <el-table v-if="dividendRecordTestResult" :data="dividendRecordTestResult.list" border stripe size="small"><el-table-column prop="id" label="流水 ID" width="100" /><el-table-column prop="productName" label="红包来源" min-width="180" /><el-table-column label="金额" width="130"><template #default="{ row }">{{ money(row.amount) }}</template></el-table-column><el-table-column prop="createTime" label="到账时间" min-width="170" /></el-table>
            </div>
          </el-card>
        </div>
      </el-tab-pane>
      <el-tab-pane label="周红包" name="pools">
        <el-card shadow="never" class="content-card"><div class="toolbar"><div><strong>周红包</strong><span class="toolbar-count">按周期管理红包</span></div><div class="toolbar-actions"><el-button type="warning" plain :icon="Setting" @click="openHoldPlan">预约暂停下一池</el-button><el-button :loading="store.loading" :icon="Refresh" @click="load">刷新</el-button></div></div>
          <el-table :data="store.sevenDayPools" v-loading="store.loading" border stripe><el-table-column prop="id" label="红包 ID" width="110" /><el-table-column label="周期" min-width="200"><template #default="{ row }">{{ row.startDate }} 至 {{ row.endDate }}</template></el-table-column><el-table-column label="总金额" width="140"><template #default="{ row }">{{ money(row.totalAmount) }}</template></el-table-column><el-table-column prop="settledUserCount" label="已结算人数" width="120" /><el-table-column prop="settleTime" label="结算时间" min-width="180" /><el-table-column label="发放状态" width="130"><template #default="{ row }"><el-tag :type="holdStatusType(row)" size="small">{{ holdStatusText(row) }}</el-tag></template></el-table-column><el-table-column label="未发金额（暂停快照）" width="180"><template #default="{ row }">{{ row.heldAmount == null ? '—' : money(row.heldAmount) }}<div v-if="row.holdReason" class="hold-reason">{{ row.holdReason }}</div></template></el-table-column><el-table-column label="操作" width="290" fixed="right"><template #default="{ row }"><div class="operator-actions"><el-button size="small" @click="showPoolDetails(row)"><el-icon><View /></el-icon>明细</el-button><el-button size="small" @click="openPoolAdjust(row)"><el-icon><Setting /></el-icon>调整</el-button><el-button v-if="isPoolHeld(row)" size="small" type="warning" @click="openRelease(row)">释放发放</el-button><el-button v-else-if="!isPoolStarted(row)" size="small" type="danger" plain @click="applyHoldNow(row)">暂停</el-button></div></template></el-table-column></el-table>
        </el-card>
        <el-card shadow="never" class="content-card"><div class="toolbar"><strong>未结算每日红包</strong></div><el-table :data="store.unsettledDaily" v-loading="store.loading" border stripe><el-table-column prop="id" label="明细 ID" width="110" /><el-table-column prop="poolDate" label="日期" width="160" /><el-table-column label="每日金额" width="140"><template #default="{ row }">{{ money(row.dailyAmount) }}</template></el-table-column><el-table-column prop="dailyUserCount" label="参与人数" width="100" /><el-table-column label="累计人数" width="100"><template #default="{ row }">{{ row.cumulativeUserCount ?? row.dailyUserCount }}</template></el-table-column><el-table-column label="操作" width="110"><template #default="{ row }"><el-button size="small" @click="openDailyAdjust(row)"><el-icon><Setting /></el-icon>调整</el-button></template></el-table-column></el-table></el-card>
        <el-card shadow="never" class="content-card"><div class="toolbar"><strong>已结算每日红包</strong></div><el-table :data="store.settledDaily" v-loading="store.loading" border stripe><el-table-column prop="id" label="明细 ID" width="110" /><el-table-column prop="poolId" label="父红包 ID" width="120" /><el-table-column prop="poolDate" label="日期" width="160" /><el-table-column label="每日金额" width="140"><template #default="{ row }">{{ money(row.dailyAmount) }}</template></el-table-column><el-table-column label="实发金额" width="140"><template #default="{ row }">{{ row.settledAmount == null ? '--' : money(row.settledAmount) }}</template></el-table-column><el-table-column prop="dailyUserCount" label="参与人数" width="100" /><el-table-column label="累计人数" width="100"><template #default="{ row }">{{ row.cumulativeUserCount ?? row.dailyUserCount }}</template></el-table-column><el-table-column prop="settlementVersion" label="版本" width="90" /><el-table-column label="操作" width="110"><template #default="{ row }"><el-button size="small" @click="viewDailyUsers(row)"><el-icon><View /></el-icon>累计用户</el-button></template></el-table-column></el-table></el-card>
      </el-tab-pane>
      <el-tab-pane label="用户购买机会" name="limits"><el-card shadow="never" class="content-card"><div class="toolbar"><div><strong>用户购买机会</strong><span class="toolbar-count">共 {{ store.dividendLimits.length }} 条</span></div></div><el-table :data="store.dividendLimits" v-loading="store.loading" border stripe><el-table-column prop="userId" label="用户 ID" width="120" /><el-table-column prop="availablePurchase" label="可用购买机会" width="140" /><el-table-column prop="totalPurchases" label="累计购买" width="120" /><el-table-column prop="createTime" label="创建时间" min-width="170" /><el-table-column prop="updateTime" label="更新时间" min-width="170" /></el-table></el-card></el-tab-pane>
      <el-tab-pane label="用户红包槽位" name="slots">
        <el-card shadow="never" class="content-card">
          <div class="toolbar">
            <div class="toolbar-actions">
              <el-input v-model="slotSearchUserId" class="slot-user-input" placeholder="输入用户 ID（留空查全部）" clearable @keyup.enter="searchSlots" />
              <el-button type="primary" :loading="store.loading" :icon="Search" @click="searchSlots">查询</el-button>
            </div>
          </div>
          <el-table :data="store.adminSlots" v-loading="store.loading" border stripe>
            <el-table-column prop="id" label="槽位 ID" width="90" />
            <el-table-column prop="userId" label="用户 ID" width="110" />
            <el-table-column prop="orderNo" label="订单号" min-width="180" />
            <el-table-column prop="productName" label="商品" min-width="150" />
            <el-table-column label="商品价" width="110"><template #default="{ row }">{{ money(row.productPrice) }}</template></el-table-column>
            <el-table-column label="红包上限" width="110"><template #default="{ row }">{{ money(row.capAmount) }}</template></el-table-column>
            <el-table-column label="累计红包" width="110"><template #default="{ row }">{{ money(row.totalReceived) }}</template></el-table-column>
            <el-table-column label="状态" width="110"><template #default="{ row }"><el-tag :type="slotType(row)" size="small">{{ slotStatus(row) }}</el-tag></template></el-table-column>
            <el-table-column prop="lockedAt" label="锁死时间" min-width="150" />
          </el-table>
        </el-card>
      </el-tab-pane>
      <!-- 红包发放明细（2026-09-19 新增）：按批次看发放真值 vs 登记值、发放人员与用户层 -->
      <el-tab-pane label="红包明细" name="packets"><DividendPacketPanel /></el-tab-pane>
      <el-tab-pane label="应急红包池" name="emergency"><EmergencyPoolPanel /></el-tab-pane>
      <!-- 老层发放设置（2026-09-24 新增）：老层发放模式开关（ROTATION / ONE_SHOT），仅超管 -->
      <el-tab-pane label="老层发放" name="oldLayer"><OldLayerPanel /></el-tab-pane>
    </el-tabs>
    <el-dialog v-model="poolDetailVisible" title="每日红包明细" width="760px" append-to-body><el-table :data="store.poolDetails" border><el-table-column prop="poolDate" label="日期" /><el-table-column label="每日金额"><template #default="{ row }">{{ money(row.dailyAmount) }}</template></el-table-column><el-table-column prop="dailyUserCount" label="用户数" /><el-table-column prop="updateTime" label="更新时间" /></el-table></el-dialog>
    <el-dialog v-model="adjustPoolVisible" title="调整 周红包" width="460px" append-to-body><el-form ref="adjustPoolFormRef" :model="adjustPoolForm" :rules="poolFormRules" label-width="100px"><el-form-item label="总金额" prop="totalAmount"><el-input-number v-model="adjustPoolForm.totalAmount" :min="0" :precision="2" /></el-form-item><el-form-item label="用户数" prop="userCount"><el-input-number v-model="adjustPoolForm.userCount" :min="0" /></el-form-item></el-form><template #footer><el-button @click="adjustPoolVisible = false">取消</el-button><el-button type="primary" :loading="store.actionLoading" @click="submitPoolAdjust">保存</el-button></template></el-dialog>
    <el-dialog v-model="adjustDailyVisible" title="调整每日红包" width="460px" append-to-body><el-form ref="adjustDailyFormRef" :model="adjustDailyForm" :rules="dailyFormRules" label-width="110px"><el-form-item label="每日金额" prop="dailyAmount"><el-input-number v-model="adjustDailyForm.dailyAmount" :min="0" :precision="2" /></el-form-item><el-form-item label="每日用户数" prop="dailyUserCount"><el-input-number v-model="adjustDailyForm.dailyUserCount" :min="0" /></el-form-item></el-form><template #footer><el-button @click="adjustDailyVisible = false">取消</el-button><el-button type="primary" :loading="store.actionLoading" @click="submitDailyAdjust">保存</el-button></template></el-dialog>
    <!-- 预约暂停（2026-09-28）：停「还没建出」的池 —— 建池那一刻自动生效，该周一分不发 -->
<el-dialog v-model="holdPlanVisible" title="预约暂停发放" width="560px" append-to-body>
  <el-alert type="warning" :closable="false" show-icon title="预约只对「还没建出」的周池生效" description="建池那一刻自动暂停，该周红包一分不发、金额冻结在池内；需要发放时再到列表点「释放发放」，7 个批次会从释放日逐日补发。⚠️ 必须在建池日 00:00 之前完成预约。" />
  <el-form label-width="120px" style="margin-top: 16px">
    <el-form-item label="成交周起始日">
      <el-date-picker v-model="holdPlanForm.poolStartDate" type="date" value-format="YYYY-MM-DD" placeholder="必须是周一" style="width: 100%" @change="previewHoldPlan" />
    </el-form-item>
    <el-form-item label="暂停原因">
      <el-input v-model="holdPlanForm.reason" maxlength="60" placeholder="如：10-05 当周放假暂停收集" />
    </el-form-item>
  </el-form>
  <div v-loading="holdPreviewLoading" class="hold-preview">
    <template v-if="holdPreview">
      <div class="hold-preview-row"><span>能否暂停</span><strong :class="holdPreview.canHold ? 'ok' : 'bad'">{{ holdPreview.canHold ? '可以' : '不可暂停' }}</strong></div>
      <div class="hold-preview-row"><span>未发金额快照</span><strong>{{ holdPreview.heldAmount == null ? '—' : money(holdPreview.heldAmount) }}</strong></div>
      <div v-if="holdPreview.blockers && holdPreview.blockers.length" class="hold-blockers">
        <div v-for="(b, i) in holdPreview.blockers" :key="i" class="hold-blocker">{{ b }}</div>
      </div>
    </template>
    <div v-else class="hold-preview-empty">填写成交周起始日后会自动预演（查看未发金额与阻断原因）</div>
  </div>
  <template #footer>
    <el-button @click="holdPlanVisible = false">取消</el-button>
    <el-button type="primary" :loading="holdPlanSubmitting" :disabled="holdPreview ? holdPreview.canHold === false : false" @click="submitHoldPlan">确认预约</el-button>
  </template>
</el-dialog>

<!-- 释放发放（2026-09-28）：批次重排为 releaseDate + 0..+6 逐日补发 -->
<el-dialog v-model="releaseVisible" title="释放发放" width="520px" append-to-body>
  <el-alert type="info" :closable="false" show-icon title="释放后 7 个批次将从所选首日起逐日补发" :description="releaseTarget ? `当前暂停池：${releaseTarget.startDate} 至 ${releaseTarget.endDate}；未发金额快照 ${releaseTarget.heldAmount == null ? '—' : money(releaseTarget.heldAmount)}` : ''" />
  <el-form label-width="120px" style="margin-top: 16px">
    <el-form-item label="补发首日">
      <el-date-picker v-model="releaseForm.releaseDate" type="date" value-format="YYYY-MM-DD" placeholder="默认今天" style="width: 100%" />
    </el-form-item>
  </el-form>
  <template #footer>
    <el-button @click="releaseVisible = false">取消</el-button>
    <el-button type="warning" :loading="releaseSubmitting" @click="submitRelease">确认释放</el-button>
  </template>
</el-dialog>

<!-- 预约中的暂停（待生效）：让运营一眼看到"已排上但还没生效" -->
<div v-if="holdPlans.length" class="hold-plans">
  <div class="hold-plans-title">预约暂停（待生效）</div>
  <el-table :data="holdPlans" size="small" border>
    <el-table-column prop="poolStartDate" label="成交周起始日" width="150" />
    <el-table-column prop="reason" label="原因" min-width="180" show-overflow-tooltip />
    <el-table-column prop="status" label="状态" width="110" />
    <el-table-column label="操作" width="110"><template #default="{ row }"><el-button size="small" text type="danger" @click="cancelPlan(row)">取消</el-button></template></el-table-column>
  </el-table>
</div>
<el-dialog v-model="dailyUsersDialogVisible" :title="`累计用户明细（截至 ${dailyUsersAsOfDate}）`" width="760px" append-to-body><el-table :data="store.dailyUsers" v-loading="store.loading" border><el-table-column prop="userId" label="用户 ID" width="110" /><el-table-column prop="orderNo" label="订单号" min-width="180" /><el-table-column prop="poolDate" label="支付日" width="120" /><el-table-column label="贡献金额" width="130"><template #default="{ row }">{{ money(row.amount) }}</template></el-table-column><el-table-column label="应急抽取" width="130"><template #default="{ row }">{{ row.emergencyAmount == null ? '--' : money(row.emergencyAmount) }}</template></el-table-column><el-table-column label="状态" width="110"><template #default="{ row }">{{ normalizeLegacyWording(row.statusDesc) || '—' }}</template></el-table-column></el-table></el-dialog>
  </section>
</template>

<style scoped>
/* ===== 暂停发放 / 释放（2026-09-28）===== */
.hold-reason { margin-top: 2px; color: #909399; font-size: 12px; }
.hold-preview { margin-top: 8px; padding: 12px; border-radius: 6px; background: #f7f8fa; min-height: 68px; }
.hold-preview-row { display: flex; justify-content: space-between; padding: 3px 0; color: #606266; font-size: 13px; }
.hold-preview-row .ok { color: #67c23a; }
.hold-preview-row .bad { color: #f56c6c; }
.hold-blockers { margin-top: 8px; }
.hold-blocker { padding: 6px 8px; margin-top: 4px; border-left: 3px solid #e6a23c; background: #fdf6ec; color: #b88230; font-size: 12px; line-height: 18px; }
.hold-preview-empty { color: #909399; font-size: 12px; line-height: 20px; }
.hold-plans { margin-top: 16px; padding: 12px 16px; border: 1px solid #f0e0c0; border-radius: 6px; background: #fffbf0; }
.hold-plans-title { margin-bottom: 8px; color: #b88230; font-size: 13px; font-weight: 600; }
.module-tabs { min-width: 0; }
.module-tabs :deep(.el-tabs__content) { overflow: visible; }
.operator-actions { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.operator-actions :deep(.el-button) { margin-left: 0; padding: 5px 8px; }
.operator-actions :deep(.el-icon) { margin-right: 4px; }
.toolbar-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.slot-user-input { width: 220px; }
.contribution-status { width: 170px; }
.table-pagination { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding-top: 16px; }
.test-alert { margin-bottom: 16px; }
.test-step-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.test-step-card { min-width: 0; }
.test-step-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.test-step-heading > div { display: flex; align-items: center; gap: 9px; }
.step-index { display: inline-flex; width: 24px; height: 24px; align-items: center; justify-content: center; border-radius: 50%; color: #fff; background: var(--el-color-primary); font-size: 13px; font-weight: 700; }
.test-help { min-height: 40px; margin: 0 0 12px; color: var(--el-text-color-secondary); font-size: 13px; line-height: 20px; }
.test-form-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 12px; }
.test-form-row :deep(.el-input-number) { width: 150px; }
.test-pool-select { min-width: 260px; flex: 1; }
.test-table { margin-top: 8px; }
.test-summary { margin-top: 10px; }
.test-result-card { grid-column: 1 / -1; }
.test-token-row :deep(.el-textarea) { min-width: 0; flex: 1; }
.test-token-row :deep(.el-textarea__inner) { min-height: 52px; }
.test-result-grid { display: grid; gap: 12px; }
.test-result-grid :deep(.el-descriptions__title) { margin-top: 4px; font-size: 14px; }
.contribution-alert { margin-bottom: 16px; }
.muted-text { color: var(--el-text-color-secondary); font-size: 12px; }
@media (max-width: 900px) { .toolbar-actions, .table-pagination { align-items: stretch; flex-direction: column; } .slot-user-input, .contribution-status { width: 100%; } }
@media (max-width: 1100px) { .test-step-grid { grid-template-columns: 1fr; } .test-result-card { grid-column: auto; } }
</style>
