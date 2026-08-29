<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import DataTable from '@/components/DataTable.vue'
import { useAfterSaleStore } from '@/stores/after-sale'
import type { AdminAfterSale } from '@/types/after-sale'
import { AFTER_SALE_STATUS, AFTER_SALE_TYPE } from '@/types/after-sale'
import { Box, CircleCheck, CircleClose, Refresh } from '@element-plus/icons-vue'

const store = useAfterSaleStore()

/** 状态筛选选项（undefined=全部）。 */
const statusOptions: Array<{ label: string; value: number | undefined }> = [
  { label: '全部', value: undefined },
  { label: '待审核', value: 0 },
  { label: '已驳回', value: 1 },
  { label: '退款中', value: 2 },
  { label: '已退款', value: 3 },
  { label: '待寄回', value: 4 },
  { label: '待收货', value: 5 },
]

/** 类型筛选选项（undefined=全部）。 */
const typeOptions: Array<{ label: string; value: number | undefined }> = [
  { label: '全部类型', value: undefined },
  { label: '仅退款', value: 1 },
  { label: '退货退款', value: 2 },
]

const statusFilter = ref<number | undefined>(undefined)
const typeFilter = ref<number | undefined>(undefined)
const reasonVisible = ref(false)
const reasonTitle = ref('')
const reasonValue = ref('')
const reasonAction = ref<((reason: string) => Promise<void>) | null>(null)

function money(value: number): string { return `¥ ${Number(value || 0).toFixed(2)}` }
function statusType(status: number): 'warning' | 'danger' | 'success' | 'info' {
  if (status === 1) return 'danger'
  if (status === 3) return 'success'
  if (status === 4) return 'info'
  return 'warning'
}

/** 打开原因输入弹窗（审核驳回 / 质检不通过共用）。 */
function openReason(title: string, action: (reason: string) => Promise<void>): void {
  reasonTitle.value = title
  reasonValue.value = ''
  reasonAction.value = action
  reasonVisible.value = true
}

async function submitReason(): Promise<void> {
  if (!reasonAction.value) return
  try {
    await reasonAction.value(reasonValue.value.trim())
    reasonVisible.value = false
    ElMessage.success('操作成功')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '操作失败')
  }
}

/** 审核通过：仅退款直接退款，退货退款进入待寄回。 */
async function approve(row: AdminAfterSale): Promise<void> {
  try {
    await ElMessageBox.confirm(`确认通过售后单「${row.afterSaleNo}」吗？`, '审核通过', { type: 'warning' })
    await store.approve(row.id)
    ElMessage.success('已通过审核')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '审核失败')
  }
}

/** 审核驳回。 */
function reject(row: AdminAfterSale): void {
  openReason('审核驳回', (reason) => store.reject(row.id, reason))
}

/** 收货质检通过（仅退货退款待收货状态）。 */
async function receivePass(row: AdminAfterSale): Promise<void> {
  try {
    await ElMessageBox.confirm(`确认售后单「${row.afterSaleNo}」质检通过并回补库存、触发退款吗？`, '质检通过', { type: 'warning' })
    await store.receive(row.id, 'PASS')
    ElMessage.success('质检通过')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '质检失败')
  }
}

/** 收货质检不通过。 */
function receiveFail(row: AdminAfterSale): void {
  openReason('质检不通过', (reason) => store.receive(row.id, 'FAIL', reason))
}

async function load(): Promise<void> {
  try { await store.fetchList() } catch (error) { ElMessage.error(error instanceof Error ? error.message : '售后单加载失败') }
}

function handleStatusChange(value: number | undefined): void { store.statusFilter = value; store.page = 1; void load() }
function handleTypeChange(value: number | undefined): void { store.typeFilter = value; store.page = 1; void load() }
function pageChange(value: number): void { store.page = value; void load() }
function sizeChange(value: number): void { store.size = value; store.page = 1; void load() }

onMounted(() => { void load() })
</script>

<template>
  <section class="page-container page-enter">
    <div class="page-heading">
      <div><h1>售后管理</h1><p>审核用户售后申请：仅退款审核通过即退款，退货退款需寄回后收货质检。</p></div>
      <el-button :loading="store.loading" @click="load"><el-icon><Refresh /></el-icon>刷新</el-button>
    </div>

    <el-card shadow="never" class="filter-card">
      <div class="filter-row">
        <span class="filter-label">状态</span>
        <el-radio-group :model-value="store.statusFilter" @change="handleStatusChange">
          <el-radio-button v-for="opt in statusOptions" :key="String(opt.value)" :value="opt.value">{{ opt.label }}</el-radio-button>
        </el-radio-group>
      </div>
      <div class="filter-row">
        <span class="filter-label">类型</span>
        <el-radio-group :model-value="store.typeFilter" @change="handleTypeChange">
          <el-radio-button v-for="opt in typeOptions" :key="String(opt.value)" :value="opt.value">{{ opt.label }}</el-radio-button>
        </el-radio-group>
      </div>
    </el-card>

    <el-card shadow="never" class="content-card">
      <div class="toolbar"><div><strong>售后单</strong><span class="toolbar-count">共 {{ store.total }} 条</span></div></div>
      <DataTable :data="store.list" :loading="store.loading" :total="store.total" :page="store.page" :page-size="store.size" empty-text="暂无售后单" @page-change="pageChange" @size-change="sizeChange">
        <el-table-column prop="afterSaleNo" label="售后单号" min-width="200" />
        <el-table-column prop="orderNo" label="订单号" min-width="190" />
        <el-table-column label="用户" width="150"><template #default="{ row }"><div>{{ row.userNickname || '--' }}</div><div class="cell-sub">{{ row.userPhone || '' }}</div></template></el-table-column>
        <el-table-column label="类型" width="100"><template #default="{ row }">{{ AFTER_SALE_TYPE[row.type] || row.typeDesc || '--' }}</template></el-table-column>
        <el-table-column label="退款金额" width="120"><template #default="{ row }">{{ money(row.refundAmount) }}</template></el-table-column>
        <el-table-column label="状态" width="100"><template #default="{ row }"><el-tag :type="statusType(row.status)">{{ row.statusDesc || AFTER_SALE_STATUS[row.status] || '--' }}</el-tag></template></el-table-column>
        <el-table-column prop="reason" label="申请原因" min-width="160" show-overflow-tooltip />
        <el-table-column prop="createTime" label="申请时间" min-width="170" />
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <div class="operator-actions">
              <template v-if="row.status === 0">
                <el-button size="small" type="success" :loading="store.actionLoading" @click="approve(row)"><el-icon><CircleCheck /></el-icon>通过</el-button>
                <el-button size="small" type="danger" @click="reject(row)"><el-icon><CircleClose /></el-icon>驳回</el-button>
              </template>
              <template v-else-if="row.status === 5">
                <el-button size="small" type="success" :loading="store.actionLoading" @click="receivePass(row)"><el-icon><Box /></el-icon>质检通过</el-button>
                <el-button size="small" type="danger" @click="receiveFail(row)">质检不通过</el-button>
              </template>
              <span v-else class="cell-muted">—</span>
            </div>
          </template>
        </el-table-column>
      </DataTable>
    </el-card>

    <el-dialog v-model="reasonVisible" :title="reasonTitle" width="460px" append-to-body>
      <el-input v-model="reasonValue" type="textarea" :rows="4" placeholder="请输入原因（可为空）" />
      <template #footer><el-button @click="reasonVisible = false">取消</el-button><el-button type="primary" :loading="store.actionLoading" @click="submitReason">确定</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.filter-row { display: flex; align-items: center; gap: 16px; margin-bottom: 14px; }
.filter-row:last-child { margin-bottom: 0; }
.filter-label { flex-shrink: 0; width: 44px; color: #606266; font-size: 14px; }
.operator-actions { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.operator-actions :deep(.el-button) { margin-left: 0; padding: 5px 8px; }
.operator-actions :deep(.el-icon) { margin-right: 4px; }
.cell-sub { margin-top: 2px; color: #909399; font-size: 12px; }
.cell-muted { color: #c0c4cc; }
</style>
