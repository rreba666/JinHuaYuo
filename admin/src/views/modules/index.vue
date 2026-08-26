<script setup lang="ts">
/**
 * 模块管理（占位页）
 * 本期仅搭建页面骨架；后端 GET/PUT /api/admin/v2/modules?appKey= 就绪后接入真实数据。
 */
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'

/** 模块配置行（占位：后端模块接口接入后替换为动态数据）。 */
interface ModuleRow {
  key: string
  name: string
  enabled: number
  sort: number
}

const loading = ref(false)
const modules = ref<ModuleRow[]>([])

onMounted(() => {
  // 占位：后端接口未就绪，先展示静态示例数据（8 个模块）
  loading.value = false
  modules.value = [
    { key: 'basic', name: '基础商城', enabled: 1, sort: 10 },
    { key: 'delivery', name: '物流配送', enabled: 1, sort: 20 },
    { key: 'pickup', name: '门店自提', enabled: 1, sort: 30 },
    { key: 'samecity', name: '同城配送', enabled: 0, sort: 40 },
    { key: 'wallet', name: '钱包/提现', enabled: 1, sort: 50 },
    { key: 'promotion', name: '分销推广', enabled: 1, sort: 60 },
    { key: 'aftersale', name: '售后', enabled: 1, sort: 70 },
    { key: 'invoice', name: '发票', enabled: 1, sort: 80 },
  ]
})

function onToggle(row: ModuleRow): void {
  if (row.key === 'basic') {
    ElMessage.warning('基础商城为必买模块，不可停用')
    row.enabled = 1
    return
  }
  ElMessage.info(`模块「${row.name}」开关待后端接口就绪后生效（30s 内前端拉取生效）`)
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h2>模块管理</h2>
    </div>

    <el-alert
      title="占位页：后端模块接口（GET/PUT /api/admin/v2/modules?appKey=）就绪后接入真实数据；basic 为必买模块不可停用"
      type="info"
      :closable="false"
      show-icon
      class="page-tip"
    />

    <el-table v-loading="loading" :data="modules" border stripe>
      <el-table-column prop="key" label="模块标识" width="160" />
      <el-table-column prop="name" label="模块名称" width="180" />
      <el-table-column prop="sort" label="排序" width="100" />
      <el-table-column label="启用" width="120">
        <template #default="{ row }">
          <el-switch
            :model-value="row.enabled === 1"
            :disabled="row.key === 'basic'"
            @change="(value: string | number | boolean) => { row.enabled = value ? 1 : 0; onToggle(row) }"
          />
        </template>
      </el-table-column>
      <el-table-column label="说明" min-width="240">
        <template #default="{ row }">
          <span v-if="row.key === 'basic'" class="basic-tip">必买模块，不可停用</span>
          <span v-else class="module-desc">停用后前端隐藏入口，后端返回 1005 拦截</span>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.page-tip { margin-bottom: 16px; }
.basic-tip { color: #e6a23c; font-weight: 600; }
.module-desc { color: #909399; }
</style>
