<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, TrendCharts } from '@element-plus/icons-vue'
import DataTable from '@/components/DataTable.vue'
import { getEmergencyPool, getEmergencyPoolLogs, injectEmergencyPool } from '@/api/emergencyPool'
import type { EmergencyPoolLog, EmergencyPoolOverview } from '@/types/emergencyPool'

const overview = ref<EmergencyPoolOverview | null>(null)
const logs = ref<EmergencyPoolLog[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const injectVisible = ref(false)
const injectAmount = ref(0)
const injecting = ref(false)

function money(value?: number): string { return `¥ ${Number(value || 0).toFixed(2)}` }
function logTypeText(type: string): string { return ({ DEDUCT: '抽取', INJECT: '注入', INJECT_SETTLE: '注入结算' } as Record<string, string>)[type] || type || '未知' }
function logTypeTag(type: string): 'warning' | 'success' | 'info' { return type === 'DEDUCT' ? 'warning' : type === 'INJECT' ? 'success' : 'info' }

async function load(): Promise<void> {
  loading.value = true
  try {
    const [ov, logResult] = await Promise.all([getEmergencyPool(), getEmergencyPoolLogs(page.value, pageSize.value)])
    overview.value = ov
    logs.value = logResult.list
    total.value = logResult.total
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '应急池数据加载失败')
  } finally {
    loading.value = false
  }
}

function openInject(): void { injectAmount.value = 0; injectVisible.value = true }
async function submitInject(): Promise<void> {
  if (injecting.value) return
  if (!Number.isFinite(injectAmount.value) || injectAmount.value <= 0) {
    ElMessage.warning('请输入正整数金额')
    return
  }
  try {
    await ElMessageBox.confirm(`确认向应急池注入 ${money(injectAmount.value)} 吗？下次结算将加入父奖池。`, '应急池注入确认', { type: 'warning' })
    injecting.value = true
    await injectEmergencyPool(injectAmount.value)
    injectVisible.value = false
    ElMessage.success('应急池注入成功')
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
        <div><strong>应急缓存池</strong></div>
        <div class="toolbar-actions">
          <el-button :loading="loading" @click="load"><el-icon><Refresh /></el-icon>刷新</el-button>
          <el-button type="primary" @click="openInject"><el-icon><TrendCharts /></el-icon>注入应急池</el-button>
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
      <div class="toolbar"><div><strong>流水分页</strong><span class="toolbar-count">共 {{ total }} 条</span></div></div>
      <DataTable :data="logs" :loading="loading" :total="total" :page="page" :page-size="pageSize" empty-text="暂无应急池流水" @page-change="pageChange" @size-change="sizeChange">
        <el-table-column prop="createTime" label="时间" min-width="180" />
        <el-table-column label="类型" width="120"><template #default="{ row }"><el-tag :type="logTypeTag(row.type)">{{ logTypeText(row.type) }}</el-tag></template></el-table-column>
        <el-table-column label="金额" width="130"><template #default="{ row }">{{ money(row.amount) }}</template></el-table-column>
        <el-table-column prop="remark" label="说明" min-width="200"><template #default="{ row }">{{ row.remark || '—' }}</template></el-table-column>
      </DataTable>
    </el-card>

    <el-dialog v-model="injectVisible" title="注入应急池" width="460px" append-to-body>
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
.toolbar { display: flex; align-items: center; justify-content: space-between; }
.toolbar-actions { display: flex; align-items: center; gap: 8px; }
.toolbar-count { margin-left: 12px; color: var(--el-text-color-secondary); font-size: 13px; }
.inject-tip { color: var(--el-text-color-secondary); font-size: 13px; }
</style>
