<script setup lang="ts">
/**
 * 品牌管理
 * 平台管理员维护品牌实例（今华有/隆平/后续），每个品牌可进入：模块配置 / 授权管理 / 系统工具授权。
 * 后端 GET/POST/PUT /api/admin/v2/brands 就绪后接入真实数据；当前为本地示例 + 完整交互形态。
 */
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'

/** 品牌记录。 */
interface BrandRow {
  appKey: string
  brandName: string
  dbName: string
  prefix: string
  enabled: number
  defaultFlag: number
}

const router = useRouter()
const loading = ref(false)
const brands = ref<BrandRow[]>([])
const formVisible = ref(false)
const editingKey = ref('')
const formRef = ref<FormInstance>()
const form = reactive({ appKey: '', brandName: '', dbName: '', prefix: '', defaultFlag: 0 })
const rules: FormRules = {
  appKey: [{ required: true, message: '请输入品牌标识（小写）', trigger: 'blur' }],
  brandName: [{ required: true, message: '请输入品牌名', trigger: 'blur' }],
  dbName: [{ required: true, message: '请输入业务库名', trigger: 'blur' }],
  prefix: [{ required: true, message: '请输入单号前缀', trigger: 'blur' }],
}

onMounted(() => {
  void loadBrands()
})

/** 加载品牌列表（占位：后端 GET /api/admin/v2/brands 就绪后替换）。 */
async function loadBrands(): Promise<void> {
  loading.value = true
  try {
    brands.value = [
      { appKey: 'jinhua', brandName: '今华有', dbName: 'db_jinhua', prefix: 'JH', enabled: 1, defaultFlag: 1 },
      { appKey: 'longping', brandName: '隆平', dbName: 'db_longping', prefix: 'LP', enabled: 1, defaultFlag: 0 },
    ]
  } finally {
    loading.value = false
  }
}

/** 打开品牌表单（编辑时回填）。 */
function openForm(brand?: BrandRow): void {
  editingKey.value = brand?.appKey || ''
  Object.assign(form, {
    appKey: brand?.appKey || '',
    brandName: brand?.brandName || '',
    dbName: brand?.dbName || '',
    prefix: brand?.prefix || '',
    defaultFlag: brand?.defaultFlag || 0,
  })
  formVisible.value = true
}

/** 校验并保存品牌。 */
async function submitForm(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  if (!editingKey.value) {
    brands.value.push({ ...form, enabled: 1 })
  } else {
    const target = brands.value.find((b) => b.appKey === editingKey.value)
    if (target) Object.assign(target, { ...form })
  }
  formVisible.value = false
  ElMessage.success(editingKey.value ? '品牌已更新' : '品牌已新增')
}

/** 切换品牌启停。 */
function toggleBrand(row: BrandRow, value: string | number | boolean): void {
  row.enabled = value ? 1 : 0
  ElMessage.info(`品牌「${row.brandName}」已${row.enabled ? '启用' : '停用'}`)
}

/** 进入品牌的子功能页（模块配置 / 授权管理 / 系统工具）。 */
function goBrandFeature(appKey: string, feature: 'modules' | 'auth' | 'tools'): void {
  if (feature === 'modules') {
    router.push({ path: '/modules', query: { appKey } })
  } else if (feature === 'auth') {
    router.push({ path: '/brands/auth', query: { appKey } })
  } else {
    router.push({ path: '/brands/tools', query: { appKey } })
  }
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h2>品牌管理</h2>
      <el-button type="primary" @click="openForm()">新增品牌</el-button>
    </div>

    <el-alert
      title="平台管理员维护品牌实例；每品牌可进入模块配置 / 授权管理 / 系统工具授权。后端接口就绪后接入真实数据。"
      type="info"
      :closable="false"
      show-icon
      class="page-tip"
    />

    <el-table v-loading="loading" :data="brands" border stripe>
      <el-table-column prop="appKey" label="品牌标识" width="130" />
      <el-table-column prop="brandName" label="品牌名" width="130" />
      <el-table-column prop="dbName" label="业务库" width="150" />
      <el-table-column prop="prefix" label="单号前缀" width="110" />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-switch :model-value="row.enabled === 1" @change="(v: string | number | boolean) => toggleBrand(row, v)" />
        </template>
      </el-table-column>
      <el-table-column label="默认品牌" width="110">
        <template #default="{ row }">
          <el-tag v-if="row.defaultFlag === 1" type="warning">默认</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" min-width="280">
        <template #default="{ row }">
          <el-button size="small" text type="primary" @click="openForm(row)">编辑</el-button>
          <el-button size="small" text type="primary" @click="goBrandFeature(row.appKey, 'modules')">模块配置</el-button>
          <el-button size="small" text type="primary" @click="goBrandFeature(row.appKey, 'auth')">授权管理</el-button>
          <el-button size="small" text type="primary" @click="goBrandFeature(row.appKey, 'tools')">系统工具</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 品牌新增/编辑弹窗 -->
    <el-dialog v-model="formVisible" :title="editingKey ? '编辑品牌' : '新增品牌'" width="520px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="品牌标识" prop="appKey">
          <el-input v-model="form.appKey" placeholder="小写，如 jinhua" :disabled="!!editingKey" />
        </el-form-item>
        <el-form-item label="品牌名" prop="brandName">
          <el-input v-model="form.brandName" placeholder="如 今华有" />
        </el-form-item>
        <el-form-item label="业务库" prop="dbName">
          <el-input v-model="form.dbName" placeholder="如 db_jinhua" :disabled="!!editingKey" />
        </el-form-item>
        <el-form-item label="单号前缀" prop="prefix">
          <el-input v-model="form.prefix" placeholder="如 JH" maxlength="4" />
        </el-form-item>
        <el-form-item label="默认品牌">
          <el-switch v-model="form.defaultFlag" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.page-tip { margin-bottom: 16px; }
</style>
