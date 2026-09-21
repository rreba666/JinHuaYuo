<script setup lang="ts">
/**
 * 红包发放明细（红包管理 → 红包明细）
 *
 * 2026-09-19 新增。回答「这一批红包发给了谁、每人多少、新/老用户层各发多少、账实是否相符」。
 *
 * 三条关键口径（来自接口契约）：
 * ① 列表**不分页、也不过过滤状态**（未发的批次也会返回）→ 前端自己按 `status` 分组筛选；
 * ② `distributedAmount` 是**逐用户明细合计（真值）**，`recordedAmount` 是**批次表登记值（仅对账用）**
 *    —— **两者不等 = 账实不符**，表格里直接标红（9/21 那次事故正是「登记值 = 0 但钱已实发」）；
 * ③ `recordCount`（明细条数）**不等于** `userCount`（发放人数）：同一用户当日会同时出现在
 *    「新用户层」与「老用户层」，因此条数会比人数多。
 */
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, View } from '@element-plus/icons-vue'
import { getDividendPacketDetail, getDividendPackets } from '@/api/profit'
import type { DividendPacket, DividendPacketDetail } from '@/types/profit'

const packets = ref<DividendPacket[]>([])
const loading = ref(false)
const statusFilter = ref('')
const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<DividendPacketDetail | null>(null)
/** 当前查看的列表行（头信息兜底用，见 `detailView`）。 */
const detailRow = ref<DividendPacket | null>(null)

/**
 * 详情弹窗的头信息：**详情优先、列表行兜底**。
 *
 * ⚠️ 为什么不能只用详情：后端 `DividendPacketDetailVO` **不返回** `recordedAmount`（登记值）与
 * `recordCount`（明细条数），而这两个正是判断「账实是否相符」的关键字段 ——
 * 直接用详情会把它们显示成 `¥0.00` / 空。这份数据列表接口是有的，所以从列表行兜底取。
 */
const detailView = computed<Partial<DividendPacket & DividendPacketDetail>>(() => ({
  ...(detailRow.value || {}),
  ...(detail.value || {}),
}))

function money(value?: number): string { return `¥ ${Number(value || 0).toFixed(2)}` }

/** 批次状态文案（后端枚举：`PENDING`=待发放 / `PROCESSING`=发放中 / `COMPLETED`=已发放）。 */
function statusText(status?: string): string {
  if (!status) return '—'
  return ({ PENDING: '待发放', PROCESSING: '发放中', COMPLETED: '已发放' } as Record<string, string>)[status] || status
}

/** 是否账实相符：真值（逐用户明细合计）与批次表登记值一致。 */
function isBalanced(row: DividendPacket): boolean {
  return Number(row.distributedAmount || 0) === Number(row.recordedAmount || 0)
}

/** 状态筛选项（从返回数据里归纳，避免硬编码；文案走 `statusText`）。 */
const statusOptions = computed(() => {
  const seen = new Set<string>()
  for (const row of packets.value) {
    const value = String(row.status ?? '')
    if (value) seen.add(value)
  }
  return [...seen].map((value) => ({ value, label: statusText(value) }))
})

const visiblePackets = computed(() => (statusFilter.value
  ? packets.value.filter((row) => String(row.status ?? '') === statusFilter.value)
  : packets.value))

/** 当前筛选下的账实不符条数（列表上方提示用）。 */
const unbalancedCount = computed(() => visiblePackets.value.filter((row) => !isBalanced(row)).length)

async function load(): Promise<void> {
  loading.value = true
  try {
    packets.value = await getDividendPackets()
  } catch (error) {
    packets.value = []
    ElMessage.error(error instanceof Error ? error.message : '红包明细加载失败')
  } finally {
    loading.value = false
  }
}

/** 查看某批次的发放人员明细。红包不存在时后端返回 code=1002，此处如实提示。 */
async function openDetail(row: DividendPacket): Promise<void> {
  detailRow.value = row
  detailVisible.value = true
  detailLoading.value = true
  detail.value = null
  try {
    detail.value = await getDividendPacketDetail(row.id)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '红包明细详情加载失败')
    detailVisible.value = false
  } finally {
    detailLoading.value = false
  }
}

/** 用户层文案：NEW 新用户层 / OLD 老用户层 / 历史数据为空。 */
function segmentText(segment?: string | null): string {
  if (!segment) return '—'
  return segment === 'NEW' ? '新用户层' : segment === 'OLD' ? '老用户层' : segment
}

onMounted(() => { void load() })
</script>

<template>
  <el-card shadow="never" class="content-card">
    <div class="toolbar">
      <div>
        <strong>红包发放明细</strong>
        <span class="toolbar-count">共 {{ visiblePackets.length }} 批</span>
        <!-- 账实不符直接提示到列表上方，避免运营逐行比对 -->
        <el-tag v-if="unbalancedCount" type="danger" size="small" class="unbalanced-tip">有 {{ unbalancedCount }} 批账实不符</el-tag>
      </div>
      <div class="toolbar-actions">
        <el-select v-model="statusFilter" clearable placeholder="全部状态" style="width: 160px">
          <el-option v-for="opt in statusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
        <el-button :loading="loading" @click="load"><el-icon><Refresh /></el-icon>刷新</el-button>
      </div>
    </div>

    <el-table :data="visiblePackets" v-loading="loading" border stripe max-height="620">
      <el-table-column prop="distributionDate" label="发放日期" width="130" />
      <el-table-column label="发放金额（真值）" width="160">
        <template #default="{ row }">
          <span class="amount-strong">{{ money(row.distributedAmount) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="登记值（对账）" width="160">
        <template #default="{ row }">
          <span :class="{ 'amount-mismatch': !isBalanced(row) }">{{ money(row.recordedAmount) }}</span>
          <el-tag v-if="!isBalanced(row)" type="danger" size="small" class="mismatch-tag">账实不符</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="userCount" label="发放人数" width="110" />
      <el-table-column label="明细条数" width="130">
        <template #default="{ row }">
          <span>{{ row.recordCount }}</span>
          <!-- 条数 > 人数是正常的：同一用户当日会在新/老两个用户层各有一条明细 -->
          <el-tooltip v-if="Number(row.recordCount) > Number(row.userCount)" content="条数多于人数属正常：同一用户当日会同时出现在新用户层与老用户层" placement="top">
            <el-icon class="tip-icon"><View /></el-icon>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="新用户层" width="130"><template #default="{ row }">{{ money(row.newUserAmount) }}</template></el-table-column>
      <el-table-column label="老用户层" width="130"><template #default="{ row }">{{ money(row.oldUserAmount) }}</template></el-table-column>
      <el-table-column label="批次号" min-width="150"><template #default="{ row }">{{ row.batchNo || '—' }}</template></el-table-column>
      <el-table-column label="状态" width="120">
        <template #default="{ row }"><el-tag size="small" :type="isBalanced(row) ? 'success' : 'warning'">{{ statusText(row.status) }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="completedAt" label="完成时间" min-width="170"><template #default="{ row }">{{ row.completedAt || '—' }}</template></el-table-column>
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }"><el-button size="small" type="primary" @click="openDetail(row)">查看明细</el-button></template>
      </el-table-column>
    </el-table>
  </el-card>

  <el-dialog v-model="detailVisible" title="红包发放人员明细" width="880px" append-to-body>
    <div v-loading="detailLoading">
      <el-descriptions v-if="detailRow" :column="3" border class="detail-head">
        <el-descriptions-item label="发放日期">{{ detailView.distributionDate || '—' }}</el-descriptions-item>
        <el-descriptions-item label="发放金额（真值）">{{ money(detailView.distributedAmount) }}</el-descriptions-item>
        <el-descriptions-item label="登记值（对账）">{{ money(detailView.recordedAmount) }}</el-descriptions-item>
        <el-descriptions-item label="发放人数">{{ detailView.userCount ?? '—' }}</el-descriptions-item>
        <el-descriptions-item label="明细条数">{{ detailView.recordCount ?? '—' }}</el-descriptions-item>
        <el-descriptions-item label="批次号">{{ detailView.batchNo || '—' }}</el-descriptions-item>
      </el-descriptions>
      <el-alert
        v-if="detailRow && Number(detailView.distributedAmount || 0) !== Number(detailView.recordedAmount || 0)"
        type="error"
        :closable="false"
        show-icon
        class="detail-alert"
        title="账实不符：发放真值与批次表登记值不一致"
        description="以「发放金额（真值）」为准（它是逐用户明细的合计）；登记值仅用于对账，不一致说明批次表写入有问题。"
      />
      <el-table :data="detail?.members || []" border stripe max-height="460">
        <el-table-column prop="userId" label="用户 ID" width="120" />
        <el-table-column label="用户" min-width="160">
          <template #default="{ row }">{{ row.nickname || `用户${row.userId}` }}</template>
        </el-table-column>
        <el-table-column label="发放金额" width="130"><template #default="{ row }">{{ money(row.amount) }}</template></el-table-column>
        <el-table-column label="用户层" width="120"><template #default="{ row }">{{ segmentText(row.userSegment) }}</template></el-table-column>
        <el-table-column prop="orderCount" label="参与分配订单数" width="150" />
        <el-table-column label="发放状态" width="110"><template #default="{ row }">{{ statusText(row.status) }}</template></el-table-column>
      </el-table>
      <el-empty v-if="!detailLoading && !(detail?.members || []).length" description="该批次暂无发放明细" />
    </div>
  </el-dialog>
</template>

<style scoped>
.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.toolbar-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.toolbar-count { margin-left: 12px; color: var(--el-text-color-secondary); font-size: 13px; }
.unbalanced-tip { margin-left: 12px; }
.amount-strong { font-weight: 600; }
/* 账实不符：登记值标红，与「发放金额（真值）」形成对照 */
.amount-mismatch { color: var(--el-color-danger); font-weight: 600; }
.mismatch-tag { margin-left: 6px; }
.tip-icon { margin-left: 4px; color: var(--el-text-color-secondary); vertical-align: middle; }
.detail-head { margin-bottom: 12px; }
.detail-alert { margin-bottom: 12px; }
</style>
