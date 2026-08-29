<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import DataTable from '@/components/DataTable.vue'
import { useAdminStore } from '@/stores/admin'
import { useAuthStore } from '@/stores/auth'
import { ROLE_LABELS, ROLE_PERMISSIONS } from '@/utils/permission'
import type { AdminCreateDTO, AdminInfo, AdminRole, AdminStatus } from '@/types/admin'
import { Delete, Edit, Key, RefreshLeft } from '@element-plus/icons-vue'

const store = useAdminStore()
const authStore = useAuthStore()
const formVisible = ref(false)
const formRef = ref<FormInstance>()
const form = reactive<AdminCreateDTO>({ username: '', password: '', nickname: '', role: 'CUSTOMER_SERVICE' })
const rules: FormRules = {
  username: [{ required: true, message: '请输入登录账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入登录密码', trigger: 'blur' }],
  nickname: [{ required: true, message: '请输入显示名称', trigger: 'blur' }],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }],
}

/** 当前登录者是否为商户管理员（ADMIN 只能管理 ADMIN 及下级，即 ADMIN/客服/财务，不含超管）。 */
const isMerchantAdmin = computed(() => authStore.role === 'ADMIN')

/** 角色下拉选项：超管可见全部角色；商户管理员可见 商户管理员 + 客服 + 财务（不含超管）。 */
const roleOptions = computed<Array<{ label: string; value: AdminRole }>>(() => {
  const all = [
    { label: ROLE_LABELS.SUPER_ADMIN, value: 'SUPER_ADMIN' as AdminRole },
    { label: ROLE_LABELS.ADMIN, value: 'ADMIN' as AdminRole },
    { label: ROLE_LABELS.CUSTOMER_SERVICE, value: 'CUSTOMER_SERVICE' as AdminRole },
    { label: ROLE_LABELS.FINANCE, value: 'FINANCE' as AdminRole },
  ]
  return isMerchantAdmin.value ? all.filter((r) => r.value !== 'SUPER_ADMIN') : all
})

/** 角色权限说明行：只展示当前登录者可见的角色（商户管理员可见 商户管理员/客服/财务，不出超管）。 */
const rolePermissionRows = computed(() => (Object.keys(ROLE_PERMISSIONS) as AdminRole[])
  .filter((role) => !isMerchantAdmin.value || role !== 'SUPER_ADMIN')
  .map((role) => ({
  role,
  label: ROLE_LABELS[role],
  permissions: ROLE_PERMISSIONS[role],
})))

/** 判断当前行是否为登录者本人（不允许对自己禁用/改角色）。 */
function isSelf(admin: AdminInfo): boolean {
  return authStore.adminUserId != null && String(admin.id) === String(authStore.adminUserId)
}

function openForm(): void {
  Object.assign(form, { username: '', password: '', nickname: '', role: isMerchantAdmin.value ? 'ADMIN' : 'CUSTOMER_SERVICE' })
  formVisible.value = true
}

async function submitForm(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  try {
    await store.save({ ...form })
    formVisible.value = false
    ElMessage.success('管理员已新增')
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : '管理员新增失败') }
}

/** 切换管理员启用状态。 */
async function changeStatus(admin: AdminInfo, value: boolean | string | number): Promise<void> {
  const next: AdminStatus = value ? 1 : 0
  try {
    await ElMessageBox.confirm(`确认${next ? '启用' : '禁用'}管理员“${admin.nickname}”吗？`, '管理员状态确认')
    await store.setStatus(admin, next)
    ElMessage.success(next ? '管理员已启用' : '管理员已禁用')
  } catch (error) {
    admin.status = next ? 0 : 1
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '状态更新失败')
  }
}

/** 修改管理员角色。 */
async function changeRole(admin: AdminInfo, role: AdminRole): Promise<void> {
  if (admin.role === role) return
  try {
    await ElMessageBox.confirm(`确认将“${admin.nickname}”的角色改为「${ROLE_LABELS[role]}」吗？`, '角色修改确认')
    await store.setRole(admin, role)
    ElMessage.success('角色已修改')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '角色修改失败')
  }
}

/** 重置管理员密码。 */
async function resetPassword(admin: AdminInfo): Promise<void> {
  try {
    const result = await ElMessageBox.prompt('请输入新的登录密码', '重置管理员密码', { inputPattern: /^.{6,}$/, inputErrorMessage: '密码至少 6 位' })
    await store.resetPassword(admin.id, { newPassword: result.value })
    ElMessage.success('密码已重置')
  } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '密码重置失败') }
}

/** 确认后软删除管理员。 */
async function removeAdmin(admin: AdminInfo): Promise<void> {
  if (isSelf(admin)) return
  try {
    await ElMessageBox.confirm(`确认删除管理员“${admin.nickname}”吗？`, '删除管理员', { type: 'warning' })
    await store.remove(admin.id)
    ElMessage.success('管理员已删除')
  } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '管理员删除失败') }
}

/** 确认后恢复管理员。 */
async function restoreAdmin(admin: AdminInfo): Promise<void> {
  try {
    await ElMessageBox.confirm(`确认恢复管理员“${admin.nickname}”吗？`, '恢复管理员', { type: 'warning' })
    await store.restore(admin.id)
    ElMessage.success('管理员已恢复')
  } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '管理员恢复失败') }
}

async function loadList(): Promise<void> {
  try { await store.fetchList() } catch (error) { ElMessage.error(error instanceof Error ? error.message : '管理员列表查询失败') }
}

onMounted(() => { void loadList() })
</script>

<template>
  <section class="page-container page-enter">
    <div class="page-heading"><div><h1>管理员管理</h1><p>维护后台管理员账号、角色和启用状态。</p></div><el-button type="primary" @click="openForm">新增管理员</el-button></div>
    <el-card shadow="never" class="content-card role-permission-card">
      <div class="toolbar"><div><strong>角色权限说明</strong><span class="toolbar-count">共 {{ rolePermissionRows.length }} 个角色</span></div></div>
      <el-table :data="rolePermissionRows" border>
        <el-table-column label="角色" width="150">
          <template #default="{ row }"><el-tag>{{ row.label }}</el-tag></template>
        </el-table-column>
        <el-table-column label="可访问功能">
          <template #default="{ row }">
            <div class="permission-tags">
              <el-tag v-for="perm in row.permissions" :key="perm" size="small" effect="plain">{{ perm }}</el-tag>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    <el-card shadow="never" class="content-card">
      <div class="toolbar"><div><strong>管理员列表</strong><span class="toolbar-count">共 {{ store.total }} 条</span></div><div class="toolbar-actions"><el-button :loading="store.loading" @click="loadList">刷新</el-button></div></div>
      <DataTable :data="store.list" :loading="store.loading" :total="store.total" :page="store.page" :page-size="store.pageSize" empty-text="暂无管理员数据" @page-change="store.page = $event; void loadList()" @size-change="store.pageSize = $event; store.page = 1; void loadList()">
        <el-table-column prop="username" label="登录账号" min-width="150" />
        <el-table-column prop="nickname" label="显示名称" min-width="130" />
        <el-table-column label="角色" width="130">
          <template #default="{ row }">
            <el-select v-if="!isSelf(row)" :model-value="row.role" size="small" class="role-select" :disabled="store.actionLoading" @change="changeRole(row, $event)">
              <el-option v-for="opt in roleOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
            </el-select>
            <el-tag v-else type="warning">{{ ROLE_LABELS[row.role as AdminRole] }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag v-if="row.delFlag === 1" type="danger">已删除</el-tag>
            <el-switch v-else :model-value="row.status === 1" :disabled="isSelf(row) || store.actionLoading" :loading="store.actionLoading" @change="changeStatus(row, $event)" />
          </template>
        </el-table-column>
        <el-table-column prop="lastLoginTime" label="最后登录时间" min-width="180" />
        <el-table-column prop="createTime" label="创建时间" min-width="180" />
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <div class="operator-actions">
              <el-button size="small" :disabled="isSelf(row)" @click="resetPassword(row)"><el-icon><Key /></el-icon>重置密码</el-button>
              <el-button v-if="row.delFlag === 0" size="small" type="danger" plain :disabled="isSelf(row) || store.actionLoading" @click="removeAdmin(row)"><el-icon><Delete /></el-icon>删除管理员</el-button>
              <el-button v-else size="small" type="success" plain :disabled="store.actionLoading" @click="restoreAdmin(row)"><el-icon><RefreshLeft /></el-icon>恢复管理员</el-button>
            </div>
          </template>
        </el-table-column>
      </DataTable>
    </el-card>
    <el-dialog v-model="formVisible" title="新增管理员" width="560px" append-to-body>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="登录账号" prop="username"><el-input v-model="form.username" /></el-form-item>
        <el-form-item label="登录密码" prop="password"><el-input v-model="form.password" type="password" show-password /></el-form-item>
        <el-form-item label="显示名称" prop="nickname"><el-input v-model="form.nickname" /></el-form-item>
        <el-form-item label="角色" prop="role">
          <el-radio-group v-model="form.role" class="role-radio-group">
            <el-radio-button v-for="opt in roleOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</el-radio-button>
          </el-radio-group>
          <div class="role-permission-preview">
            <div class="preview-title">该角色可访问的功能</div>
            <div class="permission-tags">
              <el-tag v-for="perm in ROLE_PERMISSIONS[form.role]" :key="perm" size="small" effect="plain">{{ perm }}</el-tag>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="formVisible = false">取消</el-button><el-button type="primary" :loading="store.saving" @click="submitForm">保存</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.full-width { width: 100%; }
.role-permission-card { margin-bottom: 16px; }
.permission-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.role-radio-group { display: flex; flex-wrap: wrap; gap: 8px; }
.role-permission-preview { margin-top: 12px; padding: 10px 12px; background: var(--el-fill-color-light); border-radius: 6px; }
.preview-title { margin-bottom: 8px; font-size: 13px; color: var(--el-text-color-secondary); }
.role-select { width: 100%; }
.operator-actions { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.operator-actions :deep(.el-button) { margin-left: 0; padding: 5px 8px; }
.operator-actions :deep(.el-icon) { margin-right: 4px; }
.toolbar-actions { display: flex; align-items: center; gap: 8px; }
</style>
