<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Edit, Plus, Refresh, Search, Tickets } from '@element-plus/icons-vue'
import ActivityEditor from './components/ActivityEditor.vue'
import { deleteLuckyActivity, getLuckyActivities, setLuckyActivityStatus, verifyLuckyCode } from '@/api/lucky'
import type { LuckyActivityVO } from '@/types/lucky'

const list = ref<LuckyActivityVO[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)

const editorVisible = ref(false)
const editorId = ref<number | null>(null)

const verifyDialogVisible = ref(false)
const verifyCode = ref('')
const verifying = ref(false)

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await getLuckyActivities({ page: page.value, pageSize: pageSize.value })
    list.value = result.list
    total.value = result.total
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '活动列表加载失败')
  } finally {
    loading.value = false
  }
}

function onPageChange(p: number, s: number): void {
  page.value = p
  pageSize.value = s
  void load()
}

/** 打开新增。 */
function openCreate(): void {
  editorId.value = null
  editorVisible.value = true
}

/** 打开编辑。 */
function openEdit(row: LuckyActivityVO): void {
  editorId.value = row.id
  editorVisible.value = true
}

function onEditorDone(): void {
  editorVisible.value = false
  void load()
}

/** 启停。 */
async function toggleStatus(row: LuckyActivityVO): Promise<void> {
  const next = row.status === 1 ? 0 : 1
  try {
    await setLuckyActivityStatus(row.id, next)
    ElMessage.success(next === 1 ? '已启用' : '已停用')
    void load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '操作失败')
  }
}

/** 删除。 */
async function remove(row: LuckyActivityVO): Promise<void> {
  try {
    await ElMessageBox.confirm(`确认删除活动「${row.name}」吗？其奖品与内定名单将被删除（抽奖记录保留）。`, '删除活动', { type: 'warning' })
    await deleteLuckyActivity(row.id)
    ElMessage.success('活动已删除')
    void load()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '删除失败')
  }
}

/** 核销自提码。 */
async function doVerify(): Promise<void> {
  const code = verifyCode.value.trim()
  if (!code) { ElMessage.warning('请输入核销码'); return }
  verifying.value = true
  try {
    await verifyLuckyCode(code)
    ElMessage.success('核销成功')
    verifyDialogVisible.value = false
    verifyCode.value = ''
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '核销失败')
  } finally {
    verifying.value = false
  }
}

onMounted(() => { void load() })
</script>

<template>
  <section class="page-container page-enter">
    <div class="page-heading">
      <div><h1>大转盘活动</h1><p>配置抽奖活动、奖品（权重/库存）、抽奖次数与内定名单；核销中奖自提码。</p></div>
      <div class="heading-actions">
        <el-button :loading="loading" @click="load"><el-icon><Refresh /></el-icon>刷新</el-button>
        <el-button type="primary" @click="verifyDialogVisible = true"><el-icon><Tickets /></el-icon>核销码核销</el-button>
        <el-button type="primary" @click="openCreate"><el-icon><Plus /></el-icon>新增活动</el-button>
      </div>
    </div>

    <el-card shadow="never" class="content-card">
      <el-table :data="list" v-loading="loading" border stripe empty-text="暂无抽奖活动">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="活动名称" min-width="160" show-overflow-tooltip />
        <el-table-column label="状态" width="90">
          <template #default="{ row }"><el-tag :type="row.status === 1 ? 'success' : 'info'">{{ row.status === 1 ? '启用' : '停用' }}</el-tag></template>
        </el-table-column>
        <el-table-column label="奖品数" width="85" align="center">
          <template #default="{ row }">{{ row.prizes?.length || 0 }}</template>
        </el-table-column>
        <el-table-column label="每日/总次数" width="110" align="center">
          <template #default="{ row }">{{ row.dailyLimitPerUser ?? '∞' }} / {{ row.totalLimitPerUser ?? '∞' }}</template>
        </el-table-column>
        <el-table-column label="起止时间" min-width="220">
          <template #default="{ row }">{{ row.startTime }}<br />{{ row.endTime }}</template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" min-width="170" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <div class="operator-actions">
              <el-button size="small" type="primary" @click="openEdit(row)"><el-icon><Edit /></el-icon>编辑</el-button>
              <el-button size="small" :type="row.status === 1 ? 'warning' : 'success'" @click="toggleStatus(row)">{{ row.status === 1 ? '停用' : '启用' }}</el-button>
              <el-button size="small" type="danger" @click="remove(row)"><el-icon><Delete /></el-icon>删除</el-button>
            </div>
          </template>
        </el-table-column>
        <template #empty><el-empty description="暂无抽奖活动" /></template>
      </el-table>
      <el-pagination
        class="pager"
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        @current-change="onPageChange($event, pageSize)"
        @size-change="onPageChange(1, $event)"
      />
    </el-card>

    <ActivityEditor v-if="editorVisible" :activity-id="editorId" @done="onEditorDone" @cancel="editorVisible = false" />

    <el-dialog v-model="verifyDialogVisible" title="核销自提码" width="420px" append-to-body @closed="verifyCode = ''">
      <el-form label-width="0">
        <el-form-item>
          <el-input v-model="verifyCode" maxlength="16" clearable placeholder="请输入用户出示的 8 位核销码" @keyup.enter="doVerify" />
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="verifyDialogVisible = false">取消</el-button><el-button type="primary" :loading="verifying" @click="doVerify">核销</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.heading-actions { display: flex; align-items: center; gap: 8px; }
.operator-actions { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.operator-actions :deep(.el-button) { margin-left: 0; padding: 5px 8px; }
.operator-actions :deep(.el-icon) { margin-right: 4px; }
.pager { margin-top: 18px; justify-content: flex-end; }
</style>
