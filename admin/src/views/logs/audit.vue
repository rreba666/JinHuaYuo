<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import DataTable from '@/components/DataTable.vue'
import { useLogStore } from '@/stores/log'

const store = useLogStore()
const dateRange = ref<[string, string] | null>(null)

/** 将日期范围转换为操作日志接口的时间参数。 */
function updateDateRange(value: [string, string] | null): void {
  dateRange.value = value
  store.auditFilters.startTime = value?.[0] ? `${value[0]} 00:00:00` : ''
  store.auditFilters.endTime = value?.[1] ? `${value[1]} 23:59:59` : ''
}

async function search(): Promise<void> { try { store.auditPage = 1; await store.fetchAuditLogs() } catch (error) { ElMessage.error(error instanceof Error ? error.message : '操作日志查询失败') } }
async function reset(): Promise<void> { store.resetAuditFilters(); dateRange.value = null; await search() }
async function load(): Promise<void> { try { await store.fetchAuditLogs() } catch (error) { ElMessage.error(error instanceof Error ? error.message : '操作日志查询失败') } }

onMounted(() => { void load() })
</script>

<template>
  <section class="page-container page-enter"><div class="page-heading"><div><h1>操作追溯</h1><p>查询后台管理员、店员对业务数据的操作记录。</p></div></div><el-card shadow="never" class="filter-card"><el-form inline @submit.prevent="search"><el-form-item label="操作类型"><el-input v-model="store.auditFilters.operation" clearable placeholder="例如：修改地址" /></el-form-item><el-form-item label="操作者类型"><el-select v-model="store.auditFilters.operatorType" clearable placeholder="全部"><el-option label="管理员" value="ADMIN" /><el-option label="店员" value="STAFF" /></el-select></el-form-item><el-form-item label="操作时间"><el-date-picker :model-value="dateRange" type="daterange" value-format="YYYY-MM-DD" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" @update:model-value="updateDateRange" /></el-form-item><el-form-item><el-button type="primary" @click="search">查询</el-button><el-button @click="reset">重置</el-button></el-form-item></el-form></el-card><el-card shadow="never" class="content-card"><div class="toolbar"><div><strong>操作记录</strong><span class="toolbar-count">共 {{ store.auditTotal }} 条</span></div></div><DataTable :data="store.auditList" :loading="store.auditLoading" :total="store.auditTotal" :page="store.auditPage" :page-size="store.auditPageSize" empty-text="暂无操作日志" @page-change="store.auditPage = $event; void load()" @size-change="store.auditPageSize = $event; store.auditPage = 1; void load()"><el-table-column prop="createTime" label="时间" min-width="180" /><el-table-column prop="operatorType" label="操作者类型" width="120" /><el-table-column prop="operatorName" label="操作者" width="140" /><el-table-column prop="operation" label="操作" min-width="160" /><el-table-column prop="targetType" label="目标类型" width="120" /><el-table-column prop="targetId" label="目标 ID" min-width="160" /><el-table-column prop="detail" label="详情" min-width="240" show-overflow-tooltip /><el-table-column prop="ipAddress" label="IP 地址" width="150" /></DataTable></el-card></section>
</template>
