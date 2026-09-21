<script setup lang="ts">
/**
 * 应急红包池面板（红包管理 → 应急红包池）
 *
 * 2026-09-19 改造：流水从「只有总量、看不到记录」升级为**可筛选的明细账**——
 * ① 支持 `type`（抽取 / 注入 / 注入结算 / 结余结转）与**发生日期区间**筛选；
 * ② 新增 `summary` 汇总（**按筛选范围聚合、与分页无关**）：抽取/注入/结转的合计与笔数，
 *    以及「单均抽取」——正常恒为 ¥100.00（业务规则是每单抽取 100），**不等于 100 就标红**，
 *    运营一眼就能发现某单抽取金额不对；
 * ③ 列表补齐来源信息：类型直接用后端下发的 `typeDesc`（中文），并展示**订单号 / 商品名**；
 *    历史 25 条商品名空白的记录，后端已用 `orderNo` 反查订单首个明细补全。
 */
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Search, TrendCharts } from '@element-plus/icons-vue'
import DataTable from '@/components/DataTable.vue'
import { getEmergencyPool, getEmergencyPoolLogs, injectEmergencyPool } from '@/api/emergencyPool'
import type { EmergencyPoolLog, EmergencyPoolLogSummary, EmergencyPoolOverview } from '@/types/emergencyPool'

const overview = ref<EmergencyPoolOverview | null>(null)
const logs = ref<EmergencyPoolLog[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const summary = ref<EmergencyPoolLogSummary | null>(null)
const injectVisible = ref(false)
const injectAmount = ref(0)
const injecting = ref(false)

/** 流水筛选（2026-09-19 新增）：type 不传=全部；日期区间含当天。 */
const filters = reactive<{ type: string; dateRange: [string, string] | [] }>({ type: '', dateRange: [] })

function money(value?: number): string { return `¥ ${Number(value || 0).toFixed(2)}` }

/** 类型文案：**优先用后端下发的 `typeDesc`**，未下发时按 type 兜底映射（兼容旧接口）。 */
function logTypeText(row: EmergencyPoolLog): string {
  if (row.typeDesc) return row.typeDesc
  return ({ DEDUCT: '订单抽取', INJECT: '后台注入', INJECT_SETTLE: '注入随结算入池', REMAINDER: '结余结转' } as Record<string, string>)[row.type] || row.type || '未知'
}
function logTypeTag(type: string): 'warning' | 'success' | 'info' { return type === 'DEDUCT' ? 'warning' : type === 'INJECT' ? 'success' : 'info' }

/** 单均抽取是否正常（业务规则：每单抽取 100）。 */
function deductPerOrderHealthy(): boolean { return Number(summary.value?.deductPerOrder ?? 100) === 100 }

async function load(): Promise<void> {
  loading.value = true
  try {
    const [ov, logResult] = await Promise.all([
      getEmergencyPool(),
      getEmergencyPoolLogs({
        page: page.value,
        pageSize: pageSize.value,
        type: filters.type || undefined,
        startDate: filters.dateRange?.[0] || undefined,
        endDate: filters.dateRange?.[1] || undefined,
      }),
    ])
    overview.value = ov
    logs.value = logResult.list
    total.value = logResult.total
    summary.value = logResult.summary ?? null
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '应急红包池数据加载失败')
  } finally {
    loading.value = false
  }
}

/** 查询：筛选条件变化后回到第一页。 */
function search(): void { page.value = 1; void load() }
/** 重置筛选。 */
function resetFilters(): void { filters.type = ''; filters.dateRange = []; search() }

function openInject(): void { injectAmount.value = 0; injectVisible.value = true }
async function submitInject(): Promise<void> {
  if (injecting.value) return
  if (!Number.isFinite(injectAmount.value) || injectAmount.value <= 0) {
    ElMessage.warning('请输入正整数金额')
    return
  }
  try {
    await ElMessageBox.confirm(`确认向应急红包池注入 ${money(injectAmount.value)} 吗？下次结算将加入父奖池。`, '应急红包池注入确认', { type: 'warning' })
    injecting.value = true
    await injectEmergencyPool(injectAmount.value)
    injectVisible.value = false
    ElMessage.success('应急红包池注入成功')
    await load()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '注入失败')
  } finally {
    injecting.value = false
  }
}

function pageChange(next: number): void { page.value = next; void load() }
function sizeChange(size: number): void { pageSize.value = size; page.value = 1; void load() }

onMounted(() => { void load() })
</script>

<template>
  <div class="emergency-pool">
    <el-card shadow="never" class="content-card overview-card">
      <div class="toolbar">
        <div><strong>应急红包池</strong></div>
        <div class="toolbar-actions">
          <el-button :loading="loading" @click="load"><el-icon><Refresh /></el-icon>刷新</el-button>
          <el-button type="primary" @click="openInject"><el-icon><TrendCharts /></el-icon>注入应急红包池</el-button>
        </div>
      </div>
      <el-descriptions :column="4" border>
        <el-descriptions-item label="当前余额">{{ money(overview?.balance) }}</el-descriptions-item>
        <el-descriptions-item label="累计抽取">{{ money(overview?.totalDeduct) }}</el-descriptions-item>
        <el-descriptions-item label="累计注入">{{ money(overview?.totalInject) }}</el-descriptions-item>
        <el-descriptions-item label="待注入">{{ money(overview?.pendingInject) }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card shadow="never" class="content-card">
      <div class="toolbar">
        <div><strong>流水明细</strong><span class="toolbar-count">共 {{ total }} 条</span></div>
        <div class="toolbar-actions">
          <el-select v-model="filters.type" clearable placeholder="全部类型" style="width: 170px" @change="search">
            <el-option label="订单抽取" value="DEDUCT" />
            <el-option label="后台注入" value="INJECT" />
            <el-option label="注入随结算入池" value="INJECT_SETTLE" />
            <el-option label="结余结转" value="REMAINDER" />
          </el-select>
          <el-date-picker
            v-model="filters.dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 260px"
            @change="search"
          />
          <el-button type="primary" :icon="Search" :loading="loading" @click="search">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </div>
      </div>

      <!-- 汇总（按当前筛选范围聚合，与分页无关）；后端未下发 summary 时整块隐藏 -->
      <el-descriptions v-if="summary" :column="4" border class="summary-card">
        <el-descriptions-item label="抽取合计">
          {{ money(summary.deductAmount) }}<span class="summary-sub">（{{ summary.deductCount }} 笔）</span>
        </el-descriptions-item>
        <el-descriptions-item label="注入合计">
          {{ money(summary.injectAmount) }}<span class="summary-sub">（{{ summary.injectCount }} 笔）</span>
        </el-descriptions-item>
        <el-descriptions-item label="结余结转">
          {{ money(summary.remainderAmount) }}<span class="summary-sub">（{{ summary.remainderCount }} 笔）</span>
        </el-descriptions-item>
        <el-descriptions-item label="单均抽取">
          <el-tag :type="deductPerOrderHealthy() ? 'success' : 'danger'" size="small">{{ money(summary.deductPerOrder) }}</el-tag>
          <span class="summary-sub">正常应为 ¥100.00</span>
        </el-descriptions-item>
      </el-descriptions>

      <DataTable :data="logs" :loading="loading" :total="total" :page="page" :page-size="pageSize" empty-text="暂无应急红包池流水" @page-change="pageChange" @size-change="sizeChange">
        <el-table-column prop="createTime" label="时间" min-width="170" />
        <el-table-column label="类型" width="150"><template #default="{ row }"><el-tag :type="logTypeTag(row.type)">{{ logTypeText(row) }}</el-tag></template></el-table-column>
        <el-table-column label="金额" width="120"><template #default="{ row }">{{ money(row.amount) }}</template></el-table-column>
        <el-table-column prop="orderNo" label="来源订单号" min-width="180"><template #default="{ row }">{{ row.orderNo || '—' }}</template></el-table-column>
        <el-table-column prop="productName" label="来源商品" min-width="150"><template #default="{ row }">{{ row.productName || '—' }}</template></el-table-column>
        <el-table-column prop="remark" label="说明" min-width="170"><template #default="{ row }">{{ row.remark || '—' }}</template></el-table-column>
      </DataTable>
    </el-card>

    <el-dialog v-model="injectVisible" title="注入应急红包池" width="460px" append-to-body>
      <el-form label-width="90px">
        <el-form-item label="注入金额"><el-input-number v-model="injectAmount" :min="0" :precision="2" :step="0.01" controls-position="right" /></el-form-item>
        <el-form-item label="说明"><span class="inject-tip">注入金额将在下次结算时加入父奖池参与分配。</span></el-form-item>
      </el-form>
      <template #footer><el-button @click="injectVisible = false">取消</el-button><el-button type="primary" :loading="injecting" @click="submitInject">确认注入</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped>
.overview-card { margin-bottom: 16px; }
.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.toolbar-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.toolbar-count { margin-left: 12px; color: var(--el-text-color-secondary); font-size: 13px; }
/* 汇总区：与上方筛选栏拉开距离，视觉上归为一组 */
.summary-card { margin: 12px 0 16px; }
.summary-sub { margin-left: 6px; color: var(--el-text-color-secondary); font-size: 12px; }
.inject-tip { color: var(--el-text-color-secondary); font-size: 13px; }
</style>
