<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute } from 'vue-router'
import DataTable from '@/components/DataTable.vue'
import { useWithdrawStore } from '@/stores/withdraw'
import { useTodoStore } from '@/stores/todo'
import { getWithdrawRecords } from '@/api/withdraw'
import type { WithdrawRecord, Withdrawal } from '@/types/withdraw'
import { copyToClipboard } from '@/utils/clipboard'
import { normalizeLegacyWording } from '@/utils/wording'
import { CircleCheck, CircleClose, CopyDocument, Download, Refresh, Search, Warning } from '@element-plus/icons-vue'

const store = useWithdrawStore()
const route = useRoute()
const todoStore = useTodoStore()
const activeTab = ref('pending')
const reasonVisible = ref(false)
const reasonTitle = ref('')
const reasonValue = ref('')
const reasonAction = ref<((reason: string) => Promise<void>) | null>(null)

function money(value: number): string { return `¥ ${Number(value || 0).toFixed(2)}` }
function statusText(status: string, statusDesc = ''): string { return normalizeLegacyWording(statusDesc) || ({ PENDING_REVIEW: '待审核', APPROVED: '审核通过，等待财务打款', SUCCESS: '提现成功', FAILED: '提现失败，金额已退回', REJECTED: '已拒绝，金额已退回', STUCK: '处理异常，等待人工核对' } as Record<string, string>)[status] || status || '未知' }
function statusType(status: string): 'success' | 'warning' | 'danger' | 'info' { return status === 'SUCCESS' ? 'success' : status === 'FAILED' || status === 'REJECTED' || status === 'STUCK' ? 'danger' : status === 'PENDING_REVIEW' || status === 'APPROVED' ? 'warning' : 'info' }
/**
 * 展示后端下发文案前的兜底归一化入口（见 @/utils/wording）。
 * 提现记录的 typeDesc（扣款来源）等字段由后端下发，历史数据可能仍是旧词，
 * 这里统一归一化为「红包」，保证页面无论后端返回什么都不会出现旧词。
 */
function sourceText(row: Withdrawal): string { return normalizeLegacyWording(row.typeDesc) || ({ PROMOTION: '推广金', BONUS: '红包', BALANCE: '余额' } as Record<string, string>)[row.type] || row.type || '未知来源' }
/** 提现交易记录 / 详情弹窗的「扣款来源」文案（后端 typeDesc 优先，含旧词兜底）。 */
function recordSourceText(row: WithdrawRecord): string { return normalizeLegacyWording(row.typeDesc) || ({ PROMOTION: '推广金提现', BONUS: '红包提现', BALANCE: '余额提现' } as Record<string, string>)[row.type] || row.type || '未知来源' }
function methodText(row: Withdrawal): string { return normalizeLegacyWording(row.withdrawMethodDesc) || (row.withdrawMethod === 'BANK_CARD' ? '银行卡' : row.withdrawMethod === 'WECHAT_BALANCE' ? '微信零钱' : '未知方式') }
function methodHint(row: Withdrawal): string { return row.withdrawMethod === 'BANK_CARD' ? '审核通过后由财务人工银行转账，到账后还需手动确认。' : '审核通过后进入微信零钱处理流程，审核通过不代表已到账。' }
/** HTML 转义：卡号/姓名来自接口与用户输入，拼进确认框前必须转义，避免被当成标签解析。 */
function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[char] || char) }
/** 银行卡提现的收款信息（列表列展示用；后端未返回卡号时明确提示，避免财务盲转）。 */
function bankCardText(row: Withdrawal): string {
  const card = String(row.bankCardSnapshot || '').trim()
  const holder = String(row.realnameSnapshot || row.maskedName || '').trim()
  return `${card || '（未返回卡号）'}${holder ? ` · 持卡人 ${holder}` : ''}`
}
/** 审核 / 手动确认前的银行卡收款信息（多行 HTML，已转义）。 */
function bankAccountConfirmHtml(row: Withdrawal): string {
  if (row.withdrawMethod !== 'BANK_CARD') return ''
  const lines = [
    '收款方式：银行卡（财务人工转账）',
    `收款卡号：${String(row.bankCardSnapshot || '').trim() || '（后端未返回卡号，请先与用户核对）'}`,
    `持卡人：${String(row.realnameSnapshot || row.maskedName || '').trim() || '（未实名）'}`,
  ]
  const phone = String(row.phone || '').trim()
  if (phone) lines.push(`手机号：${phone}`)
  return lines.map((line) => escapeHtml(line)).join('<br/>')
}
function displayTime(value: string): string { return value || '未完成' }
function openReason(title: string, action: (reason: string) => Promise<void>): void { reasonTitle.value = title; reasonValue.value = ''; reasonAction.value = action; reasonVisible.value = true }
async function submitReason(): Promise<void> { if (!reasonValue.value.trim() || !reasonAction.value) return; try { await reasonAction.value(reasonValue.value.trim()); reasonVisible.value = false; ElMessage.success('操作成功') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '操作失败') } }
async function approveWithdraw(row: Withdrawal): Promise<void> {
  const account = bankAccountConfirmHtml(row)
  try {
    // 银行卡提现：确认框里带上卡号/持卡人/手机号，财务按此人工转账（避免只看金额转错卡）
    await ElMessageBox.confirm(
      `${escapeHtml(`确认通过提现 ${row.withdrawNo} 吗？${methodHint(row)}`)}${account ? `<br/><br/>${account}` : ''}`,
      '审核通过',
      { type: 'warning', dangerouslyUseHTMLString: true },
    )
    await store.approve(row.withdrawNo)
    ElMessage.success(row.withdrawMethod === 'BANK_CARD' ? '已审核通过，请财务按收款卡号人工银行转账' : '已审核通过，进入微信零钱处理流程')
  } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '审核失败') }
}
function rejectWithdraw(row: Withdrawal): void { openReason('拒绝提现', (reason) => store.reject(row.withdrawNo, reason)) }
async function retry(row: Withdrawal): Promise<void> { try { await ElMessageBox.confirm(`确认重试查询 ${row.withdrawNo} 的微信打款结果吗？`, '重试打款查询', { type: 'warning' }); await store.retry(row.withdrawNo); ElMessage.success('已提交重试') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '重试失败') } }
async function manualSuccess(row: Withdrawal): Promise<void> {
  const account = bankAccountConfirmHtml(row)
  try {
    await ElMessageBox.confirm(
      `${escapeHtml(`确认提现 ${row.withdrawNo} 已按${methodText(row)}实际完成转账吗？`)}${account ? `<br/><br/>${account}` : ''}`,
      '手动确认成功',
      { type: 'warning', dangerouslyUseHTMLString: true },
    )
    await store.manualSuccess(row.withdrawNo)
    ElMessage.success('已手动确认提现成功')
  } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '确认失败') }
}
function manualFail(row: Withdrawal): void { openReason('手动确认失败', (reason) => store.manualFail(row.withdrawNo, reason)) }
async function load(): Promise<void> { try { await store.fetchAll() } catch (error) { ElMessage.error(error instanceof Error ? error.message : '提现数据加载失败') } }
function pageChange(value: number): void { store.page = value; void load() }
function sizeChange(value: number): void { store.size = value; store.page = 1; void load() }
/** 按 URL query 打开对应页签（待办铃铛跳 `/withdraw?status=0`，后端口径 PENDING_REVIEW）。 */
function applyQuery(): void {
  const status = route.query.status
  if (status === '0' || status === 'PENDING_REVIEW') {
    activeTab.value = 'pending'
    store.page = 1
  }
}

/** 重新套用 URL 条件并刷新（待办铃铛信号；200ms 去重避免与路由变化重复请求）。 */
let lastTodoApply = 0
function applyTodoAndReload(): void {
  const now = Date.now()
  if (now - lastTodoApply < 200) return
  lastTodoApply = now
  applyQuery()
  void load()
}

// 同一模块内点不同待办/重复点同一待办都要有反应：query 变化 + 铃铛点击信号 双保险
watch(() => route.query.status, () => { applyTodoAndReload() })
watch(() => todoStore.clickTick, () => { applyTodoAndReload() })

onMounted(() => {
  applyQuery()
  void load()
})

// ===== 提现交易记录（全量提现单，对账用） =====
/** 记录列表状态（独立于待审核/异常列表的分页）。 */
const records = ref<WithdrawRecord[]>([])
const recordsLoading = ref(false)
const recordsLoaded = ref(false)
const recordsTotal = ref(0)
const recordsPage = ref(1)
const recordsSize = ref(20)
/** 申请时间区间（界面上是日期，提交时补 00:00:00 / 23:59:59）。 */
const recordsDateRange = ref<[string, string] | null>(null)
const recordsFilters = ref<{ status: string[]; type: string; withdrawMethod: string; userId: string; withdrawNo: string; phone: string }>({
  status: [],
  type: '',
  withdrawMethod: '',
  userId: '',
  withdrawNo: '',
  phone: '',
})
/** 详情弹窗里的当前记录。 */
const recordDetail = ref<WithdrawRecord | null>(null)
const recordDetailVisible = ref(false)
/** 接口尚未发版（404 / 接口不存在）时置 true，页面改为显示说明而不是反复报错。 */
const recordsUnavailable = ref(false)

/** 状态选项（与后端口径一致）。 */
const RECORD_STATUS_OPTIONS = [
  { label: '待审核', value: 'PENDING_REVIEW' },
  { label: '打款中', value: 'APPROVED' },
  { label: '提现成功', value: 'SUCCESS' },
  { label: '提现失败', value: 'FAILED' },
  { label: '已拒绝', value: 'REJECTED' },
  { label: '处理异常', value: 'STUCK' },
]
/** 扣款来源选项。 */
const RECORD_TYPE_OPTIONS = [
  { label: '推广金提现', value: 'PROMOTION' },
  { label: '红包提现', value: 'BONUS' },
  { label: '余额提现', value: 'BALANCE' },
]
/** 收款方式选项。 */
const RECORD_METHOD_OPTIONS = [
  { label: '微信零钱（自动转账）', value: 'WECHAT_BALANCE' },
  { label: '银行卡（财务人工转账）', value: 'BANK_CARD' },
]

/** 查询全量提现交易记录（分页）。 */
async function loadRecords(): Promise<void> {
  recordsLoading.value = true
  try {
    const filters = recordsFilters.value
    const range = recordsDateRange.value
    const result = await getWithdrawRecords({
      status: filters.status.length ? filters.status.join(',') : undefined,
      type: filters.type || undefined,
      withdrawMethod: filters.withdrawMethod || undefined,
      userId: filters.userId.trim() || undefined,
      withdrawNo: filters.withdrawNo.trim() || undefined,
      phone: filters.phone.trim() || undefined,
      startTime: range?.[0] ? `${range[0]} 00:00:00` : undefined,
      endTime: range?.[1] ? `${range[1]} 23:59:59` : undefined,
      page: recordsPage.value,
      size: recordsSize.value,
    })
    records.value = result.list
    recordsTotal.value = result.total
    recordsLoaded.value = true
    recordsUnavailable.value = false
  } catch (error) {
    const message = error instanceof Error ? error.message : '提现交易记录查询失败'
    // 后端「提现交易记录」接口（/api/admin/withdraw/records）2026-09-15 开发完成、**随下次发版生效**；
    // 未发版的环境会返回 404，这里给出明确说明，不再反复弹错误。
    if (/404|不存在|not\s*found/i.test(message)) {
      recordsUnavailable.value = true
      recordsLoaded.value = true
      records.value = []
      recordsTotal.value = 0
    } else {
      ElMessage.error(message)
    }
  } finally {
    recordsLoading.value = false
  }
}

/** 搜索（回到第 1 页）。 */
function searchRecords(): void {
  recordsPage.value = 1
  void loadRecords()
}

/** 重置全部筛选条件。 */
function resetRecords(): void {
  recordsFilters.value = { status: [], type: '', withdrawMethod: '', userId: '', withdrawNo: '', phone: '' }
  recordsDateRange.value = null
  searchRecords()
}

/** 记录状态文案（接口未返回 statusDesc 时用中文兜底）。 */
function recordStatusText(record: WithdrawRecord): string {
  return normalizeLegacyWording(record.statusDesc) || ({ PENDING_REVIEW: '待审核', APPROVED: '打款中', SUCCESS: '提现成功', FAILED: '提现失败', REJECTED: '已拒绝', STUCK: '处理异常' } as Record<string, string>)[record.status] || record.status || '未知'
}

/** 记录状态标签颜色。 */
function recordStatusType(status: string): 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'SUCCESS') return 'success'
  if (status === 'FAILED' || status === 'REJECTED' || status === 'STUCK') return 'danger'
  if (status === 'PENDING_REVIEW' || status === 'APPROVED') return 'warning'
  return 'info'
}

/**
 * 详情里是否有"对账增强字段"。
 * ⚠️ 后端 `WithdrawRecordVO` 目前只有 12 个字段（无手机号/实名快照/银行卡/微信转账单号/审核人），
 * 这些字段都在后端 `AdminWithdrawVO`（待审核/异常列表用）里 —— 已反馈请后端补齐；补上后本页自动显示。
 */
const hasRecordExtras = computed(() => {
  const record = recordDetail.value
  if (!record) return false
  return Boolean(
    record.phone || record.userId || record.realnameSnapshot || record.maskedName
    || record.maskedCertNo || record.bankCardSnapshot || record.wxTransferBillNo || record.reviewedBy,
  )
})

/** 打开记录详情（对账时看实名快照/银行卡/微信单号）。 */
function openRecordDetail(record: WithdrawRecord): void {
  recordDetail.value = record
  recordDetailVisible.value = true
}

/** 复制文本（对账时把单号/微信转账单号贴到对账表）。 */
async function copyRecordField(value: string | null | undefined, label: string): Promise<void> {
  const text = String(value || '').trim()
  if (!text) {
    ElMessage.warning(`没有可复制的${label}`)
    return
  }
  const ok = await copyToClipboard(text)
  if (ok) ElMessage.success(`${label}已复制`)
  else ElMessage.error('复制失败，请手动选中文本复制')
}

/** 导出当前页为 CSV（无导出接口，前端生成；对账可先按条件缩小范围再导）。 */
function exportRecords(): void {
  if (!records.value.length) {
    ElMessage.warning('当前没有可导出的记录')
    return
  }
  const header = ['提现单号', '申请时间', '用户ID', '手机号', '扣款来源', '收款方式', '申请金额', '手续费', '实际到账', '状态', '完成时间', '失败原因', '微信转账单号', '审核人', '审核时间', '实名姓名', '脱敏身份证', '银行卡快照']
  const rows = records.value.map((item) => [
    item.withdrawNo,
    item.createdAt,
    item.userId,
    item.phone || '',
    recordSourceText(item),
    normalizeLegacyWording(item.withdrawMethodDesc) || (item.withdrawMethod === 'BANK_CARD' ? '银行卡' : '微信零钱'),
    Number(item.amount || 0).toFixed(2),
    Number(item.feeAmount || 0).toFixed(2),
    Number(item.netAmount || 0).toFixed(2),
    recordStatusText(item),
    item.finishedAt || '',
    normalizeLegacyWording(item.failReason),
    item.wxTransferBillNo || '',
    item.reviewedBy || '',
    item.reviewedAt || '',
    item.realnameSnapshot || item.maskedName || '',
    item.maskedCertNo || '',
    item.bankCardSnapshot || '',
  ])
  const escape = (cell: string) => `"${String(cell).replace(/"/g, '""')}"`
  const csv = [header, ...rows].map((line) => line.map(escape).join(',')).join('\r\n')
  // BOM 保证 Excel 正确识别 UTF-8 中文
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `提现交易记录_${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
  ElMessage.success(`已导出当前页 ${records.value.length} 条`)
}

/** 首次切到「提现交易记录」页签时懒加载。 */
watch(activeTab, (tab) => {
  if (tab === 'records' && !recordsLoaded.value) void loadRecords()
})
</script>

<template>
  <section class="page-container page-enter">
    <div class="page-heading"><div><h1>提现审核</h1><p>审核用户提现申请、处理微信打款异常；「提现交易记录」页签可查全部提现单用于对账。</p></div><el-button :loading="store.loading" @click="load"><el-icon><Refresh /></el-icon>刷新</el-button></div>
    <el-tabs v-model="activeTab">
      <el-tab-pane label="待审核提现" name="pending"><el-card shadow="never" class="content-card"><div class="toolbar"><div><strong>待审核提现</strong><span class="toolbar-count">共 {{ store.pendingTotal }} 条</span><span class="toolbar-hint">银行卡提现请在「收款账户」列核对卡号后再点通过</span></div></div><DataTable :data="store.pendingWithdrawals" :loading="store.loading" :total="store.pendingTotal" :page="store.page" :page-size="store.size" empty-text="暂无待审核提现" @page-change="pageChange" @size-change="sizeChange"><el-table-column prop="id" label="记录 ID" width="110" /><el-table-column prop="withdrawNo" label="提现单号" min-width="220" /><el-table-column prop="userId" label="用户 ID" width="110" /><el-table-column label="手机号" width="130"><template #default="{ row }">{{ row.phone || '—' }}</template></el-table-column><el-table-column label="扣款来源" width="110"><template #default="{ row }">{{ sourceText(row) }}</template></el-table-column><el-table-column label="收款账户" min-width="250"><template #default="{ row }"><div class="pay-account"><span>{{ methodText(row) }}</span><span v-if="row.withdrawMethod === 'BANK_CARD'" class="pay-card">{{ bankCardText(row) }}<el-button v-if="row.bankCardSnapshot" link type="primary" :icon="CopyDocument" @click="copyRecordField(row.bankCardSnapshot, '银行卡号')">复制</el-button></span></div></template></el-table-column><el-table-column label="申请金额（冻结）" width="145"><template #default="{ row }">{{ money(row.amount) }}</template></el-table-column><el-table-column label="手续费" width="110"><template #default="{ row }">{{ money(row.feeAmount) }}</template></el-table-column><el-table-column label="预计到账" width="125"><template #default="{ row }">{{ money(row.netAmount) }}</template></el-table-column><el-table-column label="状态" min-width="170"><template #default="{ row }"><el-tag :type="statusType(row.status)">{{ statusText(row.status, row.statusDesc) }}</el-tag></template></el-table-column><el-table-column prop="createdAt" label="申请时间" min-width="180" /><el-table-column label="操作" width="220" fixed="right"><template #default="{ row }"><div class="operator-actions"><el-button size="small" type="success" :loading="store.actionLoading" @click="approveWithdraw(row)"><el-icon><CircleCheck /></el-icon>通过</el-button><el-button size="small" type="danger" :loading="store.actionLoading" @click="rejectWithdraw(row)"><el-icon><CircleClose /></el-icon>拒绝</el-button></div></template></el-table-column></DataTable></el-card></el-tab-pane>
      <el-tab-pane label="异常提现" name="stuck"><el-card shadow="never" class="content-card"><div class="toolbar"><div><strong>异常提现</strong><span class="toolbar-count">共 {{ store.stuckTotal }} 条</span><span class="toolbar-hint">手动成功前请核对「收款账户」卡号与实际打款卡一致</span></div></div><DataTable :data="store.stuckWithdrawals" :loading="store.loading" :total="store.stuckTotal" :page="store.page" :page-size="store.size" empty-text="暂无异常提现" @page-change="pageChange" @size-change="sizeChange"><el-table-column prop="id" label="记录 ID" width="110" /><el-table-column prop="withdrawNo" label="提现单号" min-width="220" /><el-table-column prop="userId" label="用户 ID" width="110" /><el-table-column label="手机号" width="130"><template #default="{ row }">{{ row.phone || '—' }}</template></el-table-column><el-table-column label="扣款来源" width="110"><template #default="{ row }">{{ sourceText(row) }}</template></el-table-column><el-table-column label="收款账户" min-width="250"><template #default="{ row }"><div class="pay-account"><span>{{ methodText(row) }}</span><span v-if="row.withdrawMethod === 'BANK_CARD'" class="pay-card">{{ bankCardText(row) }}<el-button v-if="row.bankCardSnapshot" link type="primary" :icon="CopyDocument" @click="copyRecordField(row.bankCardSnapshot, '银行卡号')">复制</el-button></span></div></template></el-table-column><el-table-column label="申请金额（冻结）" width="145"><template #default="{ row }">{{ money(row.amount) }}</template></el-table-column><el-table-column label="手续费" width="110"><template #default="{ row }">{{ money(row.feeAmount) }}</template></el-table-column><el-table-column label="预计到账" width="125"><template #default="{ row }">{{ money(row.netAmount) }}</template></el-table-column><el-table-column label="状态" min-width="170"><template #default="{ row }"><el-tag :type="statusType(row.status)"><el-icon><Warning /></el-icon>{{ statusText(row.status, row.statusDesc) }}</el-tag></template></el-table-column><el-table-column label="失败/异常原因" min-width="190"><template #default="{ row }">{{ normalizeLegacyWording(row.failReason) || '—' }}</template></el-table-column><el-table-column prop="createdAt" label="申请时间" min-width="180" /><el-table-column prop="finishedAt" label="完成时间" min-width="170" /><el-table-column label="操作" width="330" fixed="right"><template #default="{ row }"><div class="operator-actions"><el-button size="small" type="primary" :loading="store.actionLoading" @click="retry(row)"><el-icon><Refresh /></el-icon>重试</el-button><el-button size="small" type="success" :loading="store.actionLoading" @click="manualSuccess(row)">手动成功</el-button><el-button size="small" type="danger" :loading="store.actionLoading" @click="manualFail(row)">手动失败</el-button></div></template></el-table-column></DataTable></el-card></el-tab-pane>
      <!-- 提现交易记录：全量提现单（所有状态），面向后台对账；数据源 GET /api/admin/withdraw/records -->
      <el-tab-pane label="提现交易记录" name="records">
        <el-card shadow="never" class="content-card">
          <el-alert
            v-if="recordsUnavailable"
            type="warning"
            :closable="false"
            show-icon
            class="records-alert"
            title="当前环境的「提现交易记录」接口尚未发版（后端 2026-09-15 开发完成，随下次发版生效），这里暂时查不到数据；发版后本页即可对账。"
          />
          <el-form inline @submit.prevent="searchRecords">
            <el-form-item label="状态">
              <el-select v-model="recordsFilters.status" multiple collapse-tags clearable placeholder="全部状态" style="width: 260px">
                <el-option v-for="item in RECORD_STATUS_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="扣款来源">
              <el-select v-model="recordsFilters.type" clearable placeholder="全部" style="width: 150px">
                <el-option v-for="item in RECORD_TYPE_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="收款方式">
              <el-select v-model="recordsFilters.withdrawMethod" clearable placeholder="全部" style="width: 210px">
                <el-option v-for="item in RECORD_METHOD_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="申请时间">
              <el-date-picker v-model="recordsDateRange" type="daterange" value-format="YYYY-MM-DD" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" />
            </el-form-item>
            <el-form-item label="用户 ID"><el-input v-model="recordsFilters.userId" clearable placeholder="精确匹配" style="width: 140px" /></el-form-item>
            <el-form-item label="提现单号"><el-input v-model="recordsFilters.withdrawNo" clearable placeholder="精确匹配" style="width: 210px" /></el-form-item>
            <el-form-item label="手机号"><el-input v-model="recordsFilters.phone" clearable placeholder="精确匹配" style="width: 150px" /></el-form-item>
            <el-form-item>
              <el-button type="primary" :icon="Search" :loading="recordsLoading" @click="searchRecords">查询</el-button>
              <el-button @click="resetRecords">重置</el-button>
              <el-button :icon="Download" :disabled="!records.length" @click="exportRecords">导出当前页</el-button>
            </el-form-item>
          </el-form>
          <DataTable
            :data="records"
            :loading="recordsLoading"
            :total="recordsTotal"
            :page="recordsPage"
            :page-size="recordsSize"
            row-key="withdrawNo"
            empty-text="暂无提现交易记录"
            @page-change="recordsPage = $event; void loadRecords()"
            @size-change="recordsSize = $event; recordsPage = 1; void loadRecords()"
          >
            <el-table-column prop="withdrawNo" label="提现单号" min-width="200" />
            <el-table-column prop="createdAt" label="申请时间" min-width="180" />
            <el-table-column prop="userId" label="用户 ID" width="110" />
            <el-table-column label="手机号" width="140"><template #default="{ row }">{{ row.phone || '—' }}</template></el-table-column>
            <el-table-column label="扣款来源" width="120"><template #default="{ row }">{{ recordSourceText(row) }}</template></el-table-column>
            <el-table-column label="收款方式" width="130"><template #default="{ row }">{{ methodText(row) }}</template></el-table-column>
            <el-table-column label="申请金额" width="120"><template #default="{ row }">{{ money(row.amount) }}</template></el-table-column>
            <el-table-column label="手续费" width="100"><template #default="{ row }">{{ money(row.feeAmount) }}</template></el-table-column>
            <el-table-column label="实际到账" width="120"><template #default="{ row }">{{ money(row.netAmount) }}</template></el-table-column>
            <el-table-column label="状态" width="120"><template #default="{ row }"><el-tag :type="recordStatusType(row.status)">{{ recordStatusText(row) }}</el-tag></template></el-table-column>
            <el-table-column label="完成时间" min-width="170"><template #default="{ row }">{{ row.finishedAt || '未完成' }}</template></el-table-column>
            <el-table-column label="微信转账单号" min-width="220">
              <template #default="{ row }">
                <span v-if="row.wxTransferBillNo">{{ row.wxTransferBillNo }}</span>
                <span v-else class="muted">—（银行卡提现无微信单号）</span>
              </template>
            </el-table-column>
            <el-table-column label="审核人" width="120"><template #default="{ row }">{{ row.reviewedBy || '未审核' }}</template></el-table-column>
            <el-table-column label="操作" width="90" fixed="right"><template #default="{ row }"><el-button link type="primary" @click="openRecordDetail(row)">详情</el-button></template></el-table-column>
          </DataTable>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <!-- 提现记录详情（对账：实名快照 / 银行卡 / 微信转账单号 / 审核人） -->
    <el-dialog v-model="recordDetailVisible" title="提现记录详情" width="680px" append-to-body>
      <el-descriptions v-if="recordDetail" :column="2" border size="small">
        <el-descriptions-item label="提现单号">
          {{ recordDetail.withdrawNo }}
          <el-button link type="primary" :icon="CopyDocument" @click="copyRecordField(recordDetail?.withdrawNo, '提现单号')">复制</el-button>
        </el-descriptions-item>
        <el-descriptions-item label="状态"><el-tag :type="recordStatusType(recordDetail.status)">{{ recordStatusText(recordDetail) }}</el-tag></el-descriptions-item>
        <el-descriptions-item label="用户 ID">{{ recordDetail.userId }}</el-descriptions-item>
        <el-descriptions-item label="手机号">
          {{ recordDetail.phone || '—' }}
          <el-button v-if="recordDetail.phone" link type="primary" :icon="CopyDocument" @click="copyRecordField(recordDetail?.phone, '手机号')">复制</el-button>
        </el-descriptions-item>
        <el-descriptions-item label="扣款来源">{{ recordSourceText(recordDetail) }}</el-descriptions-item>
        <el-descriptions-item label="收款方式">{{ methodText(recordDetail) }}</el-descriptions-item>
        <el-descriptions-item label="申请金额">{{ money(recordDetail.amount) }}</el-descriptions-item>
        <el-descriptions-item label="手续费">{{ money(recordDetail.feeAmount) }}</el-descriptions-item>
        <el-descriptions-item label="实际到账">{{ money(recordDetail.netAmount) }}</el-descriptions-item>
        <!-- 以下为"对账增强字段"：后端返回才有值（当前 WithdrawRecordVO 只有 12 字段，可能不返回） -->
        <el-descriptions-item v-if="recordDetail.wxTransferBillNo" label="微信转账单号">
          {{ recordDetail.wxTransferBillNo }}
          <el-button link type="primary" :icon="CopyDocument" @click="copyRecordField(recordDetail?.wxTransferBillNo, '微信转账单号')">复制</el-button>
        </el-descriptions-item>
        <el-descriptions-item v-if="recordDetail.realnameSnapshot || recordDetail.maskedName" label="实名姓名">{{ recordDetail.realnameSnapshot || recordDetail.maskedName }}</el-descriptions-item>
        <el-descriptions-item v-if="recordDetail.maskedCertNo" label="脱敏身份证">{{ recordDetail.maskedCertNo }}</el-descriptions-item>
        <el-descriptions-item v-if="recordDetail.bankCardSnapshot" label="银行卡快照" :span="2">{{ recordDetail.bankCardSnapshot }}</el-descriptions-item>
        <el-descriptions-item label="申请时间">{{ recordDetail.createdAt || '—' }}</el-descriptions-item>
        <el-descriptions-item label="完成时间">{{ recordDetail.finishedAt || '未完成' }}</el-descriptions-item>
        <el-descriptions-item v-if="recordDetail.reviewedBy" label="审核人">{{ recordDetail.reviewedBy }}</el-descriptions-item>
        <el-descriptions-item v-if="recordDetail.reviewedAt" label="审核时间">{{ recordDetail.reviewedAt }}</el-descriptions-item>
        <el-descriptions-item label="失败/拒绝原因" :span="2">{{ normalizeLegacyWording(recordDetail.failReason) || '—' }}</el-descriptions-item>
      </el-descriptions>
      <p v-if="recordDetail && !hasRecordExtras" class="muted">
        当前接口未返回对账增强字段（手机号 / 实名快照 / 银行卡 / 微信转账单号 / 审核人）；如需按这些字段对账，请后端在「提现交易记录」出参中补上。
      </p>
      <template #footer><el-button @click="recordDetailVisible = false">关闭</el-button></template>
    </el-dialog>

    <el-dialog v-model="reasonVisible" :title="reasonTitle" width="460px" append-to-body><el-input v-model="reasonValue" type="textarea" :rows="4" placeholder="请输入原因" /><template #footer><el-button @click="reasonVisible = false">取消</el-button><el-button type="primary" :loading="store.actionLoading" @click="submitReason">确定</el-button></template></el-dialog>
  </section>
</template>

<style scoped>
.operator-actions { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.operator-actions :deep(.el-button) { margin-left: 0; padding: 5px 8px; }
.operator-actions :deep(.el-icon) { margin-right: 4px; }
/* 提现交易记录 */
.muted { color: var(--el-text-color-secondary); font-size: 12px; }
/* 收款账户列：银行卡提现展示卡号 + 持卡人（财务人工转账前核对） */
.pay-account { display: flex; flex-direction: column; gap: 2px; line-height: 18px; }
.pay-card { color: var(--el-color-primary); word-break: break-all; }
.toolbar-hint { margin-left: 12px; color: var(--el-text-color-secondary); font-size: 12px; }
.records-alert { margin-bottom: 12px; }
.content-card :deep(.el-form-item) { margin-bottom: 12px; }
</style>
