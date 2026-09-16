<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute } from 'vue-router'
import DataTable from '@/components/DataTable.vue'
import { useAfterSaleStore } from '@/stores/after-sale'
import { useTodoStore } from '@/stores/todo'
import type { AdminAfterSale } from '@/types/after-sale'
import { AFTER_SALE_STATUS, AFTER_SALE_TYPE } from '@/types/after-sale'
import { Box, CircleCheck, CircleClose, Refresh } from '@element-plus/icons-vue'

const store = useAfterSaleStore()
const route = useRoute()
const todoStore = useTodoStore()

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
/**
 * 从「库存对账」页台账跳转过来时携带的售后单号。
 * ⚠️ 售后列表接口（`/api/admin/after-sale/list`）目前**只支持 status/type 筛选**，没有 afterSaleNo 参数，
 * 所以这里不做请求筛选，只在已加载的结果里定位并高亮该行，未命中时给出提示。
 */
const focusNo = ref('')
/** 当前结果里是否命中了 focusNo（未命中说明该单不在本页/本次筛选结果中）。 */
const focusMatched = computed(() => focusNo.value !== '' && store.list.some((row) => row.afterSaleNo === focusNo.value))

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

/** 按 URL query 初始化状态筛选（待办铃铛跳 `/after-sale?status=0`）。 */
function applyQuery(): void {
  const status = route.query.status
  if (typeof status === 'string' && status !== '' && !Number.isNaN(Number(status))) {
    store.statusFilter = Number(status)
    store.page = 1
  }
  // 库存对账页台账跳转会带 afterSaleNo，仅用于定位高亮（接口不支持按单号查询，见 focusNo 注释）
  const afterSaleNo = route.query.afterSaleNo
  focusNo.value = typeof afterSaleNo === 'string' ? afterSaleNo.trim() : ''
}

/** 命中 focusNo 的行加高亮样式，便于从库存台账跳转后快速定位。 */
function rowClass({ row }: { row: AdminAfterSale }): string {
  return focusNo.value !== '' && row.afterSaleNo === focusNo.value ? 'focus-row' : ''
}

/** 重新套用 URL 筛选并刷新（待办铃铛信号；200ms 去重避免与路由变化重复请求）。 */
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
// 同一路径下只变 afterSaleNo（库存台账多次点不同售后单）也要重新定位
watch(() => route.query.afterSaleNo, () => { applyTodoAndReload() })
watch(() => todoStore.clickTick, () => { applyTodoAndReload() })

onMounted(() => {
  applyQuery()
  void load()
})
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

    <el-alert
      v-if="focusNo && !focusMatched && !store.loading"
      class="focus-alert"
      type="info"
      show-icon
      :closable="false"
      :title="`当前结果中未找到售后单 ${focusNo}`"
      description="售后列表接口暂不支持按售后单号查询，请在列表中翻页查找；该单号可直接复制。"
    />

    <el-card shadow="never" class="content-card">
      <div class="toolbar"><div><strong>售后单</strong><span class="toolbar-count">共 {{ store.total }} 条</span></div></div>
      <DataTable :data="store.list" :loading="store.loading" :total="store.total" :page="store.page" :page-size="store.size" empty-text="暂无售后单" :row-class-name="rowClass" @page-change="pageChange" @size-change="sizeChange">
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
.focus-alert { margin-bottom: 12px; }
/* 从库存台账跳转定位到的售后单行高亮（需穿透 el-table 单元格背景） */
:deep(.focus-row) td { background: #fdf6ec !important; }
</style>
