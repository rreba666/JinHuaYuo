<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Edit, Refresh, Search } from '@element-plus/icons-vue'
import { PeptideApiError } from '@/api/peptide'
import { useAuthStore } from '@/stores/auth'
import { usePeptideStore } from '@/stores/peptide'
import { PEPTIDE_INSUFFICIENT_BALANCE_CODE } from '@/types/peptide'
import type { PeptideAccount, PeptideGrantConfig, PeptideLog, PeptideLogType } from '@/types/peptide'
import type { AdminRole } from '@/types/auth'
import { isSuperAdmin } from '@/utils/permission'
import { normalizeLegacyWording } from '@/utils/wording'

/**
 * 肽金券管理页（一级菜单，超管 / 财务可见）。
 *
 * 肽金券是平台虚拟货币：**不可提现、不可转赠**，仅可用于下单抵扣（无门槛、无上限）。
 * 页面覆盖四个接口：总览（summary）、账户列表（accounts）、全平台流水（logs）、人工调整（adjust，仅超管）；
 * 发放配置（开关 / 每单金额 / 生效起始成交日）走通用系统配置接口写入。
 */
const store = usePeptideStore()
const authStore = useAuthStore()
/** 是否超级管理员：人工调整按钮仅超管可见（接口本身也只允许超管）。 */
const isSuper = computed(() => isSuperAdmin(authStore.role as AdminRole))

const activeTab = ref('accounts')

/** 金额展示格式化：缺失值用「—」占位，避免显示成 ¥ 0.00 误导。 */
function money(value: number | null | undefined): string {
  return value == null || !Number.isFinite(Number(value)) ? '—' : `¥ ${Number(value).toFixed(2)}`
}

/** 统一错误提示：后端 message 优先，并归一化其中的旧写法（不带「券」字的旧币种名 →「肽金券」）。 */
function showError(error: unknown, fallback: string): void {
  const message = error instanceof Error ? normalizeLegacyWording(error.message) : ''
  ElMessage.error(message || fallback)
}

// ===== 总览卡片 =====
/** 总览卡片项：账户数 / 未使用余额合计（平台待履约负债）/ 累计发放 / 累计使用 / 每单金额 / 发放开关 / 生效起始成交日。 */
interface OverviewStat { label: string; value: string; hint?: string }

const overviewStats = computed<OverviewStat[]>(() => {
  const summary = store.summary
  return [
    { label: '持有账户数', value: summary ? String(summary.accountCount) : '—', hint: '含余额为 0 的历史账户' },
    { label: '未使用余额合计', value: money(summary?.balanceSum), hint: '平台待履约负债' },
    { label: '累计发放', value: money(summary?.earnedSum) },
    { label: '累计使用', value: money(summary?.usedSum) },
    { label: '每单金额', value: money(summary?.perOrderAmount) },
    {
      label: '发放开关',
      value: summary ? (summary.enabled ? '已启用' : '已停用') : '—',
      hint: '停用不影响用户已获得余额，仍可继续抵扣',
    },
    { label: '生效起始成交日', value: summary?.startDate || '—', hint: '成交日早于该日期不切肽金券' },
  ]
})

// ===== 发放配置 =====
/** 发放配置表单（默认值与后端约定默认值一致：启用 / 52.80 元 / 2026-09-21）。 */
const grantForm = reactive<PeptideGrantConfig>({ enabled: true, amount: 52.8, startDate: '2026-09-21' })

/** 用专用接口返回的配置值回填表单（含 `started` 生效状态，用于提示「已保存但未生效」）。 */
function syncGrantForm(): void {
  const config = store.grantConfig
  if (!config) return
  grantForm.enabled = config.enabled
  grantForm.amount = config.amount
  grantForm.startDate = config.startDate || grantForm.startDate
}

/** 加载总览与发放配置并回填表单。 */
async function loadSummary(): Promise<void> {
  try {
    await Promise.all([store.fetchSummary(), store.fetchGrantConfig()])
    syncGrantForm()
  } catch (error) {
    showError(error, '肽金券总览加载失败')
  }
}

/** 保存发放配置（开关 / 每单金额 / 生效起始成交日）——一次提交三项，后端原子写入。 */
async function saveConfig(): Promise<void> {
  // 生效起始成交日后端有格式校验，前端先校验一次，避免无谓的失败请求
  if (!/^\d{4}-\d{2}-\d{2}$/.test(grantForm.startDate)) {
    ElMessage.warning('生效起始成交日必须为 yyyy-MM-dd 格式')
    return
  }
  const amount = Number(grantForm.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    ElMessage.warning('每单肽金券金额必须大于 0')
    return
  }
  try {
    await ElMessageBox.confirm(
      `将保存发放配置：发放${grantForm.enabled ? '启用' : '停用'}、每单 ¥ ${amount.toFixed(2)}、生效起始成交日 ${grantForm.startDate}。\n注意：改金额会同步改变进分红大池的金额（用户现金红包随之变化）。确认保存吗？`,
      '确认保存发放配置',
      { type: 'warning' },
    )
  } catch (error) {
    // 用户取消保存
    if (error === 'cancel' || error === 'close') return
  }
  try {
    await store.saveGrantConfig({ enabled: grantForm.enabled, amount, startDate: grantForm.startDate })
    syncGrantForm()
    ElMessage.success('发放配置已保存')
  } catch (error) {
    showError(error, '发放配置保存失败')
  }
}

// ===== 账户列表 =====
/** 账户列表查询（回到第一页）。 */
function searchAccounts(): void {
  store.accountPage = 1
  void loadAccounts()
}

/** 重置账户筛选（清空 userId 并回到第一页）。 */
function resetAccounts(): void {
  store.accountUserId = ''
  store.accountPage = 1
  void loadAccounts()
}

/** 加载账户列表。 */
async function loadAccounts(): Promise<void> {
  try {
    await store.fetchAccounts()
  } catch (error) {
    showError(error, '肽金券账户列表加载失败')
  }
}

/** 账户翻页。 */
function accountPageChange(page: number): void {
  store.accountPage = page
  void loadAccounts()
}

/** 账户切换每页条数（回到第一页）。 */
function accountSizeChange(size: number): void {
  store.accountSize = size
  store.accountPage = 1
  void loadAccounts()
}

// ===== 全平台流水 =====
/** 流水类型下拉选项（与后端枚举一致）。 */
const logTypes: Array<{ label: string; value: PeptideLogType }> = [
  { label: '红包获得', value: 'EARN' },
  { label: '下单抵扣', value: 'USE' },
  { label: '退款返还', value: 'REFUND' },
  { label: '后台调整', value: 'ADMIN_ADJUST' },
]

/** 流水类型兜底中文名（后端未下发 typeText 时使用）。 */
const LOG_TYPE_TEXTS: Record<string, string> = {
  EARN: '红包获得',
  USE: '下单抵扣',
  REFUND: '退款返还',
  ADMIN_ADJUST: '后台调整',
}

/** 流水类型展示：优先后端 typeText（过归一化），缺失时用本地兜底文案。 */
function logTypeText(row: PeptideLog): string {
  return normalizeLegacyWording(row.typeText) || LOG_TYPE_TEXTS[row.type] || row.type || '未知'
}

/** 流水方向前缀：增减只看 direction 字段（amount 恒为正数）。 */
function directionSign(row: PeptideLog): string {
  return row.direction === 'OUT' ? '-' : '+'
}

/** 流水方向标签样式：增加为成功色，减少为危险色。 */
function directionTagType(row: PeptideLog): 'success' | 'danger' {
  return row.direction === 'OUT' ? 'danger' : 'success'
}

/** 流水搜索（回到第一页）。 */
function searchLogs(): void {
  store.logPage = 1
  void loadLogs()
}

/** 重置流水筛选（三个条件全部清空并回到第一页）。 */
function resetLogs(): void {
  store.logFilters.userId = ''
  store.logFilters.type = ''
  store.logFilters.orderNo = ''
  store.logPage = 1
  void loadLogs()
}

/** 加载全平台流水。 */
async function loadLogs(): Promise<void> {
  try {
    await store.fetchLogs()
  } catch (error) {
    showError(error, '肽金券流水加载失败')
  }
}

/** 流水翻页。 */
function logPageChange(page: number): void {
  store.logPage = page
  void loadLogs()
}

/** 流水切换每页条数（回到第一页）。 */
function logSizeChange(size: number): void {
  store.logSize = size
  store.logPage = 1
  void loadLogs()
}

/** 切页签：进入流水页签才懒加载流水数据。 */
function handleTabChange(name: string | number): void {
  if (name === 'logs') void loadLogs()
}

// ===== 人工调整弹窗（仅超管） =====
const adjustVisible = ref(false)
const adjustFormRef = ref<FormInstance>()
/** 调整表单：amount 为**带符号**金额（正数=赠送，负数=回收）。 */
const adjustForm = reactive<{ userId: string; amount: number | undefined; remark: string }>({ userId: '', amount: undefined, remark: '' })
const adjustRules: FormRules = {
  userId: [
    { required: true, message: '请输入用户 ID', trigger: 'blur' },
    { pattern: /^[1-9]\d*$/, message: '用户 ID 必须为正整数', trigger: 'blur' },
  ],
  amount: [{ required: true, message: '请输入调整金额（正数=赠送，负数=回收）', trigger: 'blur' }],
  remark: [{ required: true, message: '请填写调整原因（会写入流水，便于审计）', trigger: 'blur' }],
}

/** 打开调整弹窗：从账户行预填用户 ID，金额与原因留空。 */
function openAdjust(row: PeptideAccount): void {
  adjustForm.userId = row.userId
  adjustForm.amount = undefined
  adjustForm.remark = ''
  adjustVisible.value = true
}

/** 打开调整弹窗（不预填用户 ID，用于手工输入任意用户）。 */
function openAdjustBlank(): void {
  adjustForm.userId = ''
  adjustForm.amount = undefined
  adjustForm.remark = ''
  adjustVisible.value = true
}

/**
 * 提交人工调整：先表单校验 → 手动校验金额（不可为 0）→ 二次确认 → 调用接口。
 * 回收时余额不足后端返回 code=7100，这里给出可读提示。
 */
async function submitAdjust(): Promise<void> {
  if (!(await adjustFormRef.value?.validate().catch(() => false))) return
  const amount = Number(adjustForm.amount)
  if (!Number.isFinite(amount) || amount === 0) {
    ElMessage.warning('调整金额不能为 0（正数=赠送，负数=回收）')
    return
  }
  const rounded = Number(amount.toFixed(2))
  if (rounded === 0) {
    ElMessage.warning('调整金额四舍五入后不能为 0')
    return
  }
  const actionText = rounded > 0 ? '赠送' : '回收'
  const userId = adjustForm.userId.trim()
  const remark = adjustForm.remark.trim()
  try {
    await ElMessageBox.confirm(
      `确认向用户 ${userId} ${actionText}肽金券 ¥ ${Math.abs(rounded).toFixed(2)}？\n原因：${remark}\n调整会写入流水且不可撤销，请再次确认。`,
      '确认人工调整',
      { type: 'warning', confirmButtonText: `确认${actionText}` },
    )
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
  }
  try {
    await store.adjust({ userId, amount: rounded, remark })
    adjustVisible.value = false
    ElMessage.success(`已${actionText}肽金券 ¥ ${Math.abs(rounded).toFixed(2)}，账户与总览已刷新`)
  } catch (error) {
    // 余额不足（code=7100）单独给出可读提示，其余错误沿用后端 message
    if (error instanceof PeptideApiError && error.code === PEPTIDE_INSUFFICIENT_BALANCE_CODE) {
      const message = normalizeLegacyWording(error.message)
      ElMessage.error(message ? `无法回收：${message}` : '该用户肽金券余额不足，无法回收')
      return
    }
    showError(error, '肽金券人工调整失败')
  }
}

/** 页面挂载：并行加载总览与账户列表（流水页签懒加载）。 */
onMounted(() => {
  void loadSummary()
  void loadAccounts()
})
</script>

<template>
  <section class="page-container page-enter">
    <div class="page-heading">
      <div>
        <h1>肽金券管理</h1>
        <p>肽金券是平台虚拟货币，不可提现、不可转赠，仅可用于下单抵扣；「未使用余额合计」即平台待履约负债。</p>
      </div>
      <div class="heading-actions">
        <el-button v-if="isSuper" type="primary" :icon="Edit" @click="openAdjustBlank">人工调整</el-button>
        <el-button :loading="store.summaryLoading" @click="loadSummary"><el-icon><Refresh /></el-icon>刷新总览</el-button>
      </div>
    </div>

    <!-- 总览卡片：账户数 / 待履约负债 / 累计发放 / 累计使用 / 每单金额 / 发放开关 / 生效起始成交日 -->
    <el-card shadow="never" class="content-card overview-card" v-loading="store.summaryLoading">
      <div class="overview-grid">
        <div v-for="stat in overviewStats" :key="stat.label" class="overview-item">
          <span class="overview-label">{{ stat.label }}</span>
          <strong class="overview-value">{{ stat.value }}</strong>
          <span v-if="stat.hint" class="overview-hint">{{ stat.hint }}</span>
        </div>
      </div>
    </el-card>

    <!-- 发放配置：开关 / 每单金额 / 生效起始成交日（写入通用系统配置） -->
    <el-card shadow="never" class="content-card">
      <div class="toolbar">
        <div>
          <strong>发放配置</strong>
          <span class="toolbar-count">停用只影响新发放，用户已获得余额仍可继续抵扣</span>
        </div>
        <div class="toolbar-actions">
          <el-button v-if="isSuper" type="primary" :loading="store.configSaving" @click="saveConfig">保存配置</el-button>
          <span v-else class="grant-readonly-hint">发放配置仅超级管理员可修改</span>
        </div>
      </div>
      <el-form class="grant-form" label-width="140px" @submit.prevent>
        <el-form-item label="发放开关">
          <el-switch v-model="grantForm.enabled" :disabled="!isSuper" active-text="启用发放" inactive-text="停用发放" />
        </el-form-item>
        <el-form-item label="每单金额（元）">
          <el-input-number v-model="grantForm.amount" :min="0.01" :max="100000" :precision="2" :step="10" :disabled="!isSuper" />
          <span class="form-hint">默认 52.80；实际切出 min(本值, 该单红包资金)。改金额会同步改变进分红大池的金额</span>
        </el-form-item>
        <el-form-item label="生效起始成交日">
          <el-date-picker v-model="grantForm.startDate" type="date" value-format="YYYY-MM-DD" placeholder="yyyy-MM-dd" :disabled="!isSuper" />
          <span class="form-hint">成交日早于该日期的订单不切肽金券；需为 yyyy-MM-dd 的真实日期</span>
        </el-form-item>
      </el-form>
      <!-- 生效状态提示：生效日未到时说明「已保存但未生效」，避免误以为配置没生效 -->
      <el-alert v-if="store.grantConfig && store.grantConfig.started === false" class="grant-alert" type="warning" :closable="false" show-icon :title="`配置已保存，将于成交日 ${store.grantConfig.startDate} 起生效；在此之前成交的订单不切肽金券`" />
    </el-card>

    <el-tabs v-model="activeTab" class="module-tabs" @tab-change="handleTabChange">
      <el-tab-pane label="账户列表" name="accounts">
        <el-card shadow="never" class="content-card">
          <div class="toolbar">
            <div><strong>账户列表</strong><span class="toolbar-count">共 {{ store.accountTotal }} 个账户，按余额倒序</span></div>
            <div class="toolbar-actions">
              <el-input v-model="store.accountUserId" placeholder="用户 ID（精确匹配）" clearable class="filter-user" @keyup.enter="searchAccounts" />
              <el-button :icon="Search" @click="searchAccounts">查询</el-button>
              <el-button @click="resetAccounts">重置</el-button>
            </div>
          </div>
          <el-table :data="store.accounts" v-loading="store.accountLoading" border stripe empty-text="暂无肽金券账户">
            <el-table-column prop="userId" label="用户 ID" width="120" />
            <el-table-column prop="nickname" label="昵称" min-width="140" />
            <el-table-column label="手机号" width="140">
              <template #default="{ row }">{{ row.phone || '—' }}</template>
            </el-table-column>
            <el-table-column label="余额" width="120">
              <template #default="{ row }">{{ money(row.balance) }}</template>
            </el-table-column>
            <el-table-column label="累计获得" width="120">
              <template #default="{ row }">{{ money(row.totalEarned) }}</template>
            </el-table-column>
            <el-table-column label="累计使用" width="120">
              <template #default="{ row }">{{ money(row.totalUsed) }}</template>
            </el-table-column>
            <el-table-column prop="updateTime" label="最近变动时间" min-width="180" />
            <el-table-column v-if="isSuper" label="操作" width="110" fixed="right">
              <template #default="{ row }">
                <el-button size="small" type="primary" @click="openAdjust(row)"><el-icon><Edit /></el-icon>调整</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="table-pagination">
            <span>共 {{ store.accountTotal }} 条</span>
            <el-pagination
              background
              layout="total, sizes, prev, pager, next"
              :current-page="store.accountPage"
              :page-size="store.accountSize"
              :total="store.accountTotal"
              @current-change="accountPageChange"
              @size-change="accountSizeChange"
            />
          </div>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="全平台流水" name="logs">
        <el-card shadow="never" class="content-card">
          <div class="toolbar">
            <div><strong>全平台流水</strong><span class="toolbar-count">共 {{ store.logTotal }} 条，按下单/发放时间倒序</span></div>
            <div class="toolbar-actions">
              <el-input v-model="store.logFilters.userId" placeholder="用户 ID" clearable class="filter-user" @keyup.enter="searchLogs" />
              <el-select v-model="store.logFilters.type" clearable placeholder="类型" class="filter-type">
                <el-option v-for="option in logTypes" :key="option.value" :label="option.label" :value="option.value" />
              </el-select>
              <el-input v-model="store.logFilters.orderNo" placeholder="订单号" clearable class="filter-order" @keyup.enter="searchLogs" />
              <el-button :icon="Search" @click="searchLogs">查询</el-button>
              <el-button @click="resetLogs">重置</el-button>
            </div>
          </div>
          <el-table :data="store.logs" v-loading="store.logLoading" border stripe empty-text="暂无肽金券流水">
            <el-table-column prop="userId" label="用户 ID" width="120" />
            <el-table-column label="类型" width="120">
              <template #default="{ row }"><el-tag type="info">{{ logTypeText(row) }}</el-tag></template>
            </el-table-column>
            <el-table-column label="金额（带方向）" width="140">
              <template #default="{ row }">
                <el-tag :type="directionTagType(row)" effect="plain">{{ directionSign(row) }} {{ money(row.amount) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="变动后余额" width="130">
              <template #default="{ row }">{{ money(row.balanceAfter) }}</template>
            </el-table-column>
            <el-table-column label="关联订单号" min-width="170">
              <template #default="{ row }">{{ row.orderNo || '—' }}</template>
            </el-table-column>
            <el-table-column label="来源订单号" min-width="170">
              <template #default="{ row }">{{ row.sourceOrderNo || '—' }}</template>
            </el-table-column>
            <el-table-column label="备注" min-width="200">
              <template #default="{ row }">{{ normalizeLegacyWording(row.remark) || '—' }}</template>
            </el-table-column>
            <el-table-column prop="createTime" label="时间" min-width="180" />
          </el-table>
          <div class="table-pagination">
            <span>共 {{ store.logTotal }} 条</span>
            <el-pagination
              background
              layout="total, sizes, prev, pager, next"
              :current-page="store.logPage"
              :page-size="store.logSize"
              :total="store.logTotal"
              @current-change="logPageChange"
              @size-change="logSizeChange"
            />
          </div>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <!-- 人工调整弹窗（仅超管可见入口）：金额允许负数表示回收 -->
    <el-dialog v-model="adjustVisible" title="人工调整肽金券" width="520px" append-to-body>
      <el-alert
        title="人工调整仅限超级管理员，且会写入「后台调整」流水"
        description="正数=赠送账户（计入累计获得），负数=回收账户（需余额充足）；调整记录含原因，便于审计。"
        type="info"
        :closable="false"
        show-icon
        class="adjust-alert"
      />
      <el-form ref="adjustFormRef" :model="adjustForm" :rules="adjustRules" label-width="96px">
        <el-form-item label="用户 ID" prop="userId">
          <el-input v-model="adjustForm.userId" placeholder="目标用户 ID（正整数；账户不存在时后端自动创建）" inputmode="numeric" />
        </el-form-item>
        <el-form-item label="调整金额" prop="amount">
          <el-input-number v-model="adjustForm.amount" :precision="2" :step="10" :controls="false" placeholder="正数=赠送，负数=回收" />
          <span class="form-hint">单位：元。正数=赠送，负数=回收；不可为 0，精确到分</span>
        </el-form-item>
        <el-form-item label="调整原因" prop="remark">
          <el-input v-model="adjustForm.remark" type="textarea" :rows="3" maxlength="200" show-word-limit placeholder="例如：客服补偿 / 误发放回收，会写入流水备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adjustVisible = false">取消</el-button>
        <el-button type="primary" :loading="store.actionLoading" @click="submitAdjust">提交调整</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.heading-actions { display: flex; gap: 8px; align-items: center; }
.overview-card { margin-bottom: 16px; }
.overview-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; }
.overview-item { display: flex; flex-direction: column; gap: 4px; min-width: 0; padding: 12px 16px; border: 1px solid var(--el-border-color-lighter); border-radius: 8px; background: var(--el-fill-color-blank); }
.overview-label { color: var(--el-text-color-secondary); font-size: 13px; }
.overview-value { font-size: 20px; line-height: 28px; color: var(--el-text-color-primary); }
.overview-hint { color: var(--el-text-color-placeholder); font-size: 12px; line-height: 16px; }
.module-tabs { min-width: 0; }
.module-tabs :deep(.el-tabs__content) { overflow: visible; }
.toolbar-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.filter-user { width: 180px; }
.filter-type { width: 140px; }
.filter-order { width: 200px; }
.table-pagination { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding-top: 16px; }
.grant-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); column-gap: 24px; }
.grant-readonly-hint { color: var(--el-text-color-secondary); font-size: 12px; }
.grant-alert { margin-top: 12px; }
.grant-form :deep(.el-form-item__content) { flex-wrap: wrap; gap: 8px; }
.form-hint { color: var(--el-text-color-secondary); font-size: 12px; line-height: 18px; }
.adjust-alert { margin-bottom: 16px; }
@media (max-width: 900px) {
  .toolbar-actions, .table-pagination { align-items: stretch; flex-direction: column; }
  .filter-user, .filter-type, .filter-order { width: 100%; }
}
</style>
