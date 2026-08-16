<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'

interface AddressAuditRecord {
  id: string
  orderNo: string
  buyerName: string
  buyerPhone: string
  originalAddress: string
  newAddress: string
  orderStatus: string
  auditStatus: string
  remark: string
}

const filters = reactive({
  buyerKeyword: '',
  orderNo: '',
  auditStatus: '',
  orderStatus: '',
})
const dateRange = ref<[string, string] | null>(null)
const rows = ref<AddressAuditRecord[]>([])

const auditStatusOptions = [
  { label: '待审核', value: 'pending' },
  { label: '审核通过', value: 'approved' },
  { label: '审核驳回', value: 'rejected' },
]
const orderStatusOptions = [
  { label: '待支付', value: '0' },
  { label: '已支付', value: '1' },
  { label: '已发货', value: '2' },
  { label: '已收货', value: '3' },
  { label: '已完成', value: '4' },
  { label: '已关闭', value: '5' },
]

/** 保留筛选交互，等待后端审核列表接口接入真实查询。 */
function search(): void {
  ElMessage.info('地址变更审核接口待接入')
}

/** 清空地址审核页面的本地筛选条件。 */
function reset(): void {
  Object.assign(filters, { buyerKeyword: '', orderNo: '', auditStatus: '', orderStatus: '' })
  dateRange.value = null
}

/** 提示审核操作需要后端提供审核接口。 */
function notifyAuditAction(): void {
  ElMessage.info('地址变更审核操作接口待接入')
}
</script>

<template>
  <section class="page-container">
    <div class="page-heading">
      <div><h1>地址变更审核</h1><p>审核订单配送地址变更申请，避免履约地址被误修改。</p></div>
    </div>

    <el-card shadow="never" class="filter-card">
      <el-form inline class="audit-filter-form" @submit.prevent="search">
        <el-form-item label="买家信息">
          <el-input v-model="filters.buyerKeyword" placeholder="请输入用户 ID 或手机号" clearable />
        </el-form-item>
        <el-form-item label="订单号">
          <el-input v-model="filters.orderNo" placeholder="请输入订单号" clearable />
        </el-form-item>
        <el-form-item label="审核状态">
          <el-select v-model="filters.auditStatus" placeholder="全部" clearable>
            <el-option v-for="option in auditStatusOptions" :key="option.value" v-bind="option" />
          </el-select>
        </el-form-item>
        <el-form-item label="订单状态">
          <el-select v-model="filters.orderStatus" placeholder="全部" clearable>
            <el-option v-for="option in orderStatusOptions" :key="option.value" v-bind="option" />
          </el-select>
        </el-form-item>
        <el-form-item label="申请时间">
          <el-date-picker v-model="dateRange" type="daterange" value-format="YYYY-MM-DD" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" />
        </el-form-item>
        <el-form-item class="audit-filter-actions"><el-button type="primary" @click="search">搜索</el-button><el-button @click="reset">重置</el-button></el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="content-card">
      <div class="toolbar">
        <div><strong>地址变更申请</strong><span class="toolbar-count">接口待接入</span></div>
        <el-button type="primary" plain disabled @click="notifyAuditAction">批量审核</el-button>
      </div>
      <el-alert class="audit-state" title="地址变更审核接口尚未在 API 文档中提供" description="页面结构已预留，接入审核列表、审核通过/驳回和备注接口后即可加载真实申请。" type="info" show-icon :closable="false" />
      <el-table :data="rows" border class="address-audit-table">
        <el-table-column label="买家信息" min-width="180">
          <template #default="{ row }"><div>{{ row.buyerName }}</div><small>{{ row.buyerPhone }}</small></template>
        </el-table-column>
        <el-table-column label="地址" min-width="360">
          <template #default="{ row }"><div>原地址：{{ row.originalAddress }}</div><div>新地址：{{ row.newAddress }}</div></template>
        </el-table-column>
        <el-table-column prop="orderStatus" label="订单状态" width="120" />
        <el-table-column prop="auditStatus" label="审核状态" width="120" />
        <el-table-column prop="remark" label="备注" min-width="180" />
        <el-table-column label="操作" width="180"><template #default="{ row }"><el-button link type="primary" @click="notifyAuditAction">审核</el-button><el-button link @click="notifyAuditAction">备注</el-button></template></el-table-column>
        <template #empty><el-empty description="暂无地址变更申请" /></template>
      </el-table>
    </el-card>
  </section>
</template>

<style scoped>
.audit-filter-form { display: flex; align-items: flex-end; flex-wrap: wrap; gap: 0 12px; }
.audit-filter-form .el-form-item { margin-bottom: 0; }
.audit-filter-form .el-input { width: 210px; }
.audit-filter-form .el-select { width: 150px; min-width: 150px; }
.audit-filter-form .el-date-editor { width: 260px; }
.audit-filter-actions { margin-left: auto; }
.audit-state { margin-bottom: 16px; }
.address-audit-table :deep(.el-table__empty-block) { min-height: 220px; }
.address-audit-table small { color: var(--vben-muted); }
.address-audit-table :deep(.cell) { white-space: normal; line-height: 1.7; }

@media (max-width: 1200px) {
  .audit-filter-actions { margin-left: 0; }
}
</style>
