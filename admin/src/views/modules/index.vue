<script setup lang="ts">
/**
 * 模块管理
 * 说明：按品牌查看/切换模块开关（9 个模块，含 tools 系统工具）。basic 为必买模块不可停用。
 * 后端 GET/PUT /api/admin/v2/modules?appKey= 就绪后接入真实数据；当前为本地示例 + 品牌维度骨架。
 */
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

/** 模块配置行。 */
interface ModuleRow {
  key: string
  name: string
  enabled: number
  sort: number
}

const authStore = useAuthStore()
const loading = ref(false)
const modules = ref<ModuleRow[]>([])
/** 当前查看的品牌 key（平台管理员可切换，商户固定自己的品牌）。 */
const currentAppKey = ref(authStore.currentAppKey || 'jinhua')
/** 品牌下拉（占位：后端品牌接口后替换为品牌列表；平台管理员可见多品牌）。 */
const brandOptions = [
  { label: '今华有', value: 'jinhua' },
  { label: '隆平', value: 'longping' },
]

/** 模块清单（含 tools 系统工具，共 9 个）。 */
const MODULE_LIST: ModuleRow[] = [
  { key: 'basic', name: '基础商城', enabled: 1, sort: 10 },
  { key: 'delivery', name: '物流配送', enabled: 1, sort: 20 },
  { key: 'pickup', name: '门店自提', enabled: 1, sort: 30 },
  { key: 'samecity', name: '同城配送', enabled: 0, sort: 40 },
  { key: 'wallet', name: '钱包/提现', enabled: 1, sort: 50 },
  { key: 'promotion', name: '分销推广', enabled: 1, sort: 60 },
  { key: 'aftersale', name: '售后', enabled: 1, sort: 70 },
  { key: 'invoice', name: '发票', enabled: 1, sort: 80 },
  { key: 'tools', name: '系统工具', enabled: 1, sort: 90 },
]

onMounted(() => {
  void loadModules()
})

/** 按当前品牌加载模块配置（占位：后端接口就绪后拉真实数据）。 */
async function loadModules(): Promise<void> {
  loading.value = true
  try {
    // 暂用本地数据（模拟按品牌返回）；后端 GET /api/admin/v2/modules?appKey= 就绪后替换。
    modules.value = MODULE_LIST.map((m) => ({ ...m }))
  } finally {
    loading.value = false
  }
}

/** 平台管理员切换品牌后重新加载模块。 */
function onBrandChange(): void {
  void loadModules()
}

/** 切换模块开关；basic 禁停用。 */
function onToggle(row: ModuleRow, value: string | number | boolean): void {
  row.enabled = value ? 1 : 0
  if (row.key === 'basic') {
    row.enabled = 1
    ElMessage.warning('基础商城为必买模块，不可停用')
    return
  }
  ElMessage.info(`模块「${row.name}」开关：${row.enabled ? '启用' : '停用'}（30s 内前端拉取生效）`)
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h2>模块管理</h2>
      <el-select
        v-if="authStore.isPlatform"
        v-model="currentAppKey"
        size="default"
        class="brand-select"
        @change="onBrandChange"
      >
        <el-option v-for="brand in brandOptions" :key="brand.value" :label="brand.label" :value="brand.value" />
      </el-select>
    </div>

    <el-alert
      title="按品牌查看模块开关；basic 为必买模块不可停用。后端 GET/PUT /api/admin/v2/modules?appKey= 就绪后接入真实数据。"
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
            @change="(v: string | number | boolean) => onToggle(row, v)"
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
.brand-select { width: 160px; }
.page-tip { margin-bottom: 16px; }
.basic-tip { color: #e6a23c; font-weight: 600; }
.module-desc { color: #909399; }
</style>
