<script setup lang="ts">
/**
 * 品牌管理（占位页）
 * 本期仅搭建页面骨架；后端 GET/POST/PUT /api/admin/v2/brands 就绪后接入真实数据。
 */
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'

/** 品牌列表（占位：后端品牌接口 P3 接入后替换为动态数据）。 */
interface BrandRow {
  appKey: string
  brandName: string
  dbName: string
  prefix: string
  enabled: number
  defaultFlag: number
}

const loading = ref(false)
const brands = ref<BrandRow[]>([])

onMounted(() => {
  // 占位：后端接口未就绪，先展示静态示例数据
  loading.value = false
  brands.value = [
    { appKey: 'jinhua', brandName: '今华有', dbName: 'db_jinhua', prefix: 'JH', enabled: 1, defaultFlag: 1 },
    { appKey: 'longping', brandName: '隆平', dbName: 'db_longping', prefix: 'LP', enabled: 1, defaultFlag: 0 },
  ]
})

function onCreateBrand(): void {
  ElMessage.info('品牌创建功能待后端接口就绪后开放')
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h2>品牌管理</h2>
      <el-button type="primary" @click="onCreateBrand">新增品牌</el-button>
    </div>

    <el-alert
      title="占位页：后端品牌接口（GET/POST/PUT /api/admin/v2/brands）就绪后接入真实数据"
      type="info"
      :closable="false"
      show-icon
      class="page-tip"
    />

    <el-table v-loading="loading" :data="brands" border stripe>
      <el-table-column prop="appKey" label="品牌标识" width="140" />
      <el-table-column prop="brandName" label="品牌名" width="140" />
      <el-table-column prop="dbName" label="业务库" width="160" />
      <el-table-column prop="prefix" label="单号前缀" width="120" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.enabled === 1 ? 'success' : 'info'">{{ row.enabled === 1 ? '启用' : '停用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="默认品牌" width="120">
        <template #default="{ row }">
          <el-tag v-if="row.defaultFlag === 1" type="warning">默认</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" min-width="140">
        <template #default>
          <el-button size="small" text type="primary" @click="ElMessage.info('待接口就绪')">编辑</el-button>
          <el-button size="small" text type="danger" @click="ElMessage.info('待接口就绪')">停用</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.page-tip { margin-bottom: 16px; }
</style>
