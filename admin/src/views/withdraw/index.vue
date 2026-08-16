<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import DataTable from '@/components/DataTable.vue'
import { useWithdrawStore } from '@/stores/withdraw'
import type { Withdrawal } from '@/types/withdraw'
import { CircleCheck, CircleClose, Refresh, Warning } from '@element-plus/icons-vue'

const store = useWithdrawStore()
const activeTab = ref('pending')
const reasonVisible = ref(false)
const reasonTitle = ref('')
const reasonValue = ref('')
const reasonAction = ref<((reason: string) => Promise<void>) | null>(null)

function money(value: number): string { return `¥ ${Number(value || 0).toFixed(2)}` }
function statusText(status: string): string { return status === 'PENDING_REVIEW' ? '待审核' : status === 'STUCK' ? '异常' : status || '未知' }
function statusType(status: string): 'warning' | 'danger' | 'info' { return status === 'PENDING_REVIEW' ? 'warning' : status === 'STUCK' ? 'danger' : 'info' }
function openReason(title: string, action: (reason: string) => Promise<void>): void { reasonTitle.value = title; reasonValue.value = ''; reasonAction.value = action; reasonVisible.value = true }
async function submitReason(): Promise<void> { if (!reasonValue.value.trim() || !reasonAction.value) return; try { await reasonAction.value(reasonValue.value.trim()); reasonVisible.value = false; ElMessage.success('操作成功') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '操作失败') } }
async function approveWithdraw(row: Withdrawal): Promise<void> { try { await ElMessageBox.confirm(`确认通过提现 ${row.withdrawNo} 并发起微信打款吗？`, '审核通过', { type: 'warning' }); await store.approve(row.withdrawNo); ElMessage.success('已发起微信打款') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '审核失败') } }
function rejectWithdraw(row: Withdrawal): void { openReason('拒绝提现', (reason) => store.reject(row.withdrawNo, reason)) }
async function retry(row: Withdrawal): Promise<void> { try { await ElMessageBox.confirm(`确认重试查询 ${row.withdrawNo} 的微信打款结果吗？`, '重试打款查询', { type: 'warning' }); await store.retry(row.withdrawNo); ElMessage.success('已提交重试') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '重试失败') } }
async function manualSuccess(row: Withdrawal): Promise<void> { try { await ElMessageBox.confirm(`确认提现 ${row.withdrawNo} 已在微信后台到账吗？`, '手动确认成功', { type: 'warning' }); await store.manualSuccess(row.withdrawNo); ElMessage.success('已手动确认到账') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '确认失败') } }
function manualFail(row: Withdrawal): void { openReason('手动确认失败', (reason) => store.manualFail(row.withdrawNo, reason)) }
async function load(): Promise<void> { try { await store.fetchAll() } catch (error) { ElMessage.error(error instanceof Error ? error.message : '提现数据加载失败') } }
function pageChange(value: number): void { store.page = value; void load() }
function sizeChange(value: number): void { store.size = value; store.page = 1; void load() }
onMounted(() => { void load() })
</script>

<template>
  <section class="page-container page-enter">
    <div class="page-heading"><div><h1>提现审核</h1><p>审核用户提现申请，处理微信打款异常。</p></div><el-button :loading="store.loading" @click="load"><el-icon><Refresh /></el-icon>刷新</el-button></div>
    <el-tabs v-model="activeTab">
      <el-tab-pane label="待审核提现" name="pending"><el-card shadow="never" class="content-card"><div class="toolbar"><div><strong>待审核提现</strong><span class="toolbar-count">共 {{ store.pendingTotal }} 条</span></div></div><DataTable :data="store.pendingWithdrawals" :loading="store.loading" :total="store.pendingTotal" :page="store.page" :page-size="store.size" empty-text="暂无待审核提现" @page-change="pageChange" @size-change="sizeChange"><el-table-column prop="id" label="记录 ID" width="110" /><el-table-column prop="withdrawNo" label="提现单号" min-width="220" /><el-table-column prop="userId" label="用户 ID" width="120" /><el-table-column label="提现金额" width="140"><template #default="{ row }">{{ money(row.amount) }}</template></el-table-column><el-table-column label="状态" width="100"><template #default="{ row }"><el-tag :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag></template></el-table-column><el-table-column prop="createdAt" label="申请时间" min-width="180" /><el-table-column label="操作" width="220" fixed="right"><template #default="{ row }"><div class="operator-actions"><el-button size="small" type="success" @click="approveWithdraw(row)"><el-icon><CircleCheck /></el-icon>通过</el-button><el-button size="small" type="danger" @click="rejectWithdraw(row)"><el-icon><CircleClose /></el-icon>拒绝</el-button></div></template></el-table-column></DataTable></el-card></el-tab-pane>
      <el-tab-pane label="异常提现" name="stuck"><el-card shadow="never" class="content-card"><div class="toolbar"><div><strong>异常提现</strong><span class="toolbar-count">共 {{ store.stuckTotal }} 条</span></div></div><DataTable :data="store.stuckWithdrawals" :loading="store.loading" :total="store.stuckTotal" :page="store.page" :page-size="store.size" empty-text="暂无异常提现" @page-change="pageChange" @size-change="sizeChange"><el-table-column prop="id" label="记录 ID" width="110" /><el-table-column prop="withdrawNo" label="提现单号" min-width="220" /><el-table-column prop="userId" label="用户 ID" width="120" /><el-table-column label="提现金额" width="140"><template #default="{ row }">{{ money(row.amount) }}</template></el-table-column><el-table-column label="状态" width="100"><template #default="{ row }"><el-tag type="danger"><el-icon><Warning /></el-icon>{{ statusText(row.status) }}</el-tag></template></el-table-column><el-table-column prop="createdAt" label="申请时间" min-width="180" /><el-table-column label="操作" width="330" fixed="right"><template #default="{ row }"><div class="operator-actions"><el-button size="small" type="primary" @click="retry(row)"><el-icon><Refresh /></el-icon>重试</el-button><el-button size="small" type="success" @click="manualSuccess(row)">手动成功</el-button><el-button size="small" type="danger" @click="manualFail(row)">手动失败</el-button></div></template></el-table-column></DataTable></el-card></el-tab-pane>
    </el-tabs>
    <el-dialog v-model="reasonVisible" :title="reasonTitle" width="460px" append-to-body><el-input v-model="reasonValue" type="textarea" :rows="4" placeholder="请输入原因" /><template #footer><el-button @click="reasonVisible = false">取消</el-button><el-button type="primary" :loading="store.actionLoading" @click="submitReason">确定</el-button></template></el-dialog>
  </section>
</template>

<style scoped>
.operator-actions { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.operator-actions :deep(.el-button) { margin-left: 0; padding: 5px 8px; }
.operator-actions :deep(.el-icon) { margin-right: 4px; }
</style>
