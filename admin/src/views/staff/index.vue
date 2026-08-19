<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import DataTable from '@/components/DataTable.vue'
import { useShopStore } from '@/stores/shop'
import { useStaffStore } from '@/stores/staff'
import type { Staff, StaffCreateDTO, StaffGender, StaffStatus } from '@/types/staff'
import { Delete, Edit, Key, RefreshLeft } from '@element-plus/icons-vue'

const store = useStaffStore()
const shopStore = useShopStore()
const selected = ref<Staff[]>([])
const deletableSelected = computed(() => selected.value.filter((staff) => staff.delFlag !== 1))
const restorableSelected = computed(() => selected.value.filter((staff) => staff.delFlag === 1))
const formVisible = ref(false)
const editingId = ref<string>()
const formRef = ref<FormInstance>()
const form = reactive<StaffCreateDTO>({ username: '', password: '', name: '', phone: '', idCard: '', gender: 0, shopId: '' })
const rules: FormRules = {
  username: [{ required: true, message: '请输入登录账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入登录密码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  shopId: [{ required: true, message: '请选择所属门店', trigger: 'change' }],
}

/** 打开店员新增/编辑表单，并加载启用门店。 */
async function openForm(staff?: Staff): Promise<void> {
  editingId.value = staff?.id
  Object.assign(form, { username: staff?.username || '', password: '', name: staff?.name || '', phone: staff?.phone || '', idCard: staff?.idCard || '', gender: staff?.gender || 0, shopId: staff?.shopId || '' })
  await shopStore.fetchEnabled()
  formVisible.value = true
}

/** 校验并保存店员。 */
async function submitForm(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  try {
    if (editingId.value) {
      const { password: _password, username: _username, ...payload } = form
      await store.save(editingId.value, payload)
    } else await store.save(undefined, { ...form })
    formVisible.value = false
    ElMessage.success(editingId.value ? '店员已更新' : '店员已新增')
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : '店员保存失败') }
}

/** 切换店员启用状态。 */
async function changeStatus(staff: Staff, value: boolean | string | number): Promise<void> {
  const next: StaffStatus = value ? 1 : 0
  try {
    await ElMessageBox.confirm(`确认${next ? '启用' : '禁用'}店员“${staff.name}”吗？`, '店员状态确认')
    await store.setStatus(staff, next)
    ElMessage.success(next ? '店员已启用' : '店员已禁用')
  } catch (error) {
    staff.status = next ? 0 : 1
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '店员状态更新失败')
  }
}

/** 判断店员是否已经软删除。 */
function isDeleted(staff: Staff): boolean {
  return staff.delFlag === 1
}

/** 删除单个店员，并在确认后刷新列表。 */
async function removeStaff(staff: Staff): Promise<void> {
  if (isDeleted(staff)) return
  try {
    await ElMessageBox.confirm(`确认删除店员“${staff.name}”吗？`, '删除店员确认', { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' })
    await store.remove(staff.id)
    selected.value = []
    ElMessage.success('店员已删除')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '店员删除失败')
  }
}

/** 批量软删除当前页选中的正常店员。 */
async function removeSelected(): Promise<void> {
  if (!deletableSelected.value.length) return
  try {
    await ElMessageBox.confirm(`确认删除选中的 ${deletableSelected.value.length} 个店员吗？`, '批量删除店员确认', { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' })
    const result = await store.removeBatch(deletableSelected.value.map((staff) => staff.id))
    selected.value = []
    if (result.failedIds.length) ElMessage.warning(`删除成功 ${result.successIds.length} 个，失败 ${result.failedIds.length} 个`)
    else ElMessage.success(`已删除 ${result.successIds.length} 个店员`)
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '批量删除失败')
  }
}

/** 恢复单个已删除店员。 */
async function restoreStaff(staff: Staff): Promise<void> {
  if (!isDeleted(staff)) return
  try {
    await ElMessageBox.confirm(`确认恢复店员“${staff.name}”吗？`, '恢复店员确认', { type: 'warning', confirmButtonText: '确认恢复', cancelButtonText: '取消' })
    await store.restore(staff.id)
    selected.value = []
    ElMessage.success('店员已恢复')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '店员恢复失败')
  }
}

/** 批量恢复当前页选中的已删除店员。 */
async function restoreSelected(): Promise<void> {
  if (!restorableSelected.value.length) return
  try {
    await ElMessageBox.confirm(`确认恢复选中的 ${restorableSelected.value.length} 个店员吗？`, '批量恢复店员确认', { type: 'warning', confirmButtonText: '确认恢复', cancelButtonText: '取消' })
    const result = await store.restoreBatch(restorableSelected.value.map((staff) => staff.id))
    selected.value = []
    if (result.failedIds.length) ElMessage.warning(`恢复成功 ${result.successIds.length} 个，失败 ${result.failedIds.length} 个`)
    else ElMessage.success(`已恢复 ${result.successIds.length} 个店员`)
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '批量恢复失败')
  }
}

/** 修改店员密码。 */
async function resetPassword(staff: Staff): Promise<void> {
  try {
    const result = await ElMessageBox.prompt('请输入新的登录密码', '重置店员密码', { inputPattern: /^.{6,}$/, inputErrorMessage: '密码至少 6 位' })
    await store.resetPassword(staff.id, { newPassword: result.value })
    ElMessage.success('店员密码已重置')
  } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '密码重置失败') }
}

async function loadList(): Promise<void> {
  try { await store.fetchList() } catch (error) { ElMessage.error(error instanceof Error ? error.message : '店员列表查询失败') }
}

/** 按关键词搜索店员（ID/姓名/工号），回车或点击触发。 */
function searchStaff(): void {
  store.page = 1
  void loadList()
}

onMounted(() => { void loadList() })
</script>

<template>
  <section class="page-container page-enter">
    <div class="page-heading"><div><h1>店员管理</h1><p>维护门店店员账号、所属门店和登录状态。</p></div><el-button type="primary" @click="openForm()">新增店员</el-button></div>
    <el-card shadow="never" class="content-card">
      <div class="toolbar"><div><strong>店员列表</strong><span class="toolbar-count">共 {{ store.total }} 条</span></div><div class="toolbar-actions"><el-input v-model="store.keyword" placeholder="店员ID/姓名/工号" clearable class="search-input" @keyup.enter="searchStaff" @clear="searchStaff" /><el-button type="primary" @click="searchStaff">搜索</el-button><span v-if="selected.length" class="selection-tip">已选择 {{ selected.length }} 项</span><el-button size="small" type="danger" plain :disabled="!deletableSelected.length || store.actionLoading" :loading="store.actionLoading" @click="removeSelected"><el-icon><Delete /></el-icon>批量删除</el-button><el-button size="small" type="success" plain :disabled="!restorableSelected.length || store.actionLoading" :loading="store.actionLoading" @click="restoreSelected"><el-icon><RefreshLeft /></el-icon>批量恢复</el-button><el-button :loading="store.loading" @click="loadList">刷新</el-button></div></div>
      <DataTable :data="store.list" :loading="store.loading" :total="store.total" :page="store.page" :page-size="store.pageSize" empty-text="暂无店员数据" @selection-change="selected = $event" @page-change="store.page = $event; selected = []; void loadList()" @size-change="store.pageSize = $event; store.page = 1; selected = []; void loadList()">
        <el-table-column prop="username" label="登录账号" min-width="150" /><el-table-column prop="name" label="姓名" width="110" /><el-table-column prop="phone" label="手机号" width="140" /><el-table-column prop="shopName" label="所属门店" min-width="170" /><el-table-column label="性别" width="90"><template #default="{ row }">{{ row.gender === 1 ? '男' : row.gender === 2 ? '女' : '未设置' }}</template></el-table-column><el-table-column label="状态" width="110"><template #default="{ row }"><el-tag v-if="isDeleted(row)" type="info">已删除</el-tag><el-switch v-else :model-value="row.status === 1" :loading="store.actionLoading" @change="changeStatus(row, $event)" /></template></el-table-column><el-table-column prop="createTime" label="创建时间" min-width="180" /><el-table-column label="操作" width="270" fixed="right"><template #default="{ row }"><div class="operator-actions"><el-button v-if="isDeleted(row)" size="small" type="success" :loading="store.actionLoading" @click="restoreStaff(row)"><el-icon><RefreshLeft /></el-icon>恢复</el-button><template v-else><el-button size="small" type="primary" @click="openForm(row)"><el-icon><Edit /></el-icon>编辑</el-button><el-button size="small" @click="resetPassword(row)"><el-icon><Key /></el-icon>重置密码</el-button><el-button size="small" type="danger" :loading="store.actionLoading" @click="removeStaff(row)"><el-icon><Delete /></el-icon>删除</el-button></template></div></template></el-table-column>
      </DataTable>
    </el-card>
    <el-dialog v-model="formVisible" :title="editingId ? '编辑店员' : '新增店员'" width="560px" append-to-body>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px"><el-form-item label="登录账号" prop="username"><el-input v-model="form.username" :disabled="Boolean(editingId)" /></el-form-item><el-form-item v-if="!editingId" label="登录密码" prop="password"><el-input v-model="form.password" type="password" show-password /></el-form-item><el-form-item label="姓名" prop="name"><el-input v-model="form.name" /></el-form-item><el-form-item label="手机号"><el-input v-model="form.phone" maxlength="11" /></el-form-item><el-form-item label="身份证号"><el-input v-model="form.idCard" /></el-form-item><el-form-item label="性别"><el-radio-group v-model="form.gender"><el-radio :value="0">未设置</el-radio><el-radio :value="1">男</el-radio><el-radio :value="2">女</el-radio></el-radio-group></el-form-item><el-form-item label="所属门店" prop="shopId"><el-select v-model="form.shopId" placeholder="请选择门店" class="full-width"><el-option v-for="shop in shopStore.enabledList" :key="shop.id" :label="shop.name" :value="shop.id" /></el-select></el-form-item></el-form>
      <template #footer><el-button @click="formVisible = false">取消</el-button><el-button type="primary" :loading="store.saving" @click="submitForm">保存</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.full-width { width: 100%; }
.operator-actions { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.operator-actions :deep(.el-button) { margin-left: 0; padding: 5px 8px; }
.operator-actions :deep(.el-icon) { margin-right: 4px; }
.toolbar-actions { display: flex; align-items: center; gap: 8px; }
.search-input { width: 200px; }
.selection-tip { color: var(--el-text-color-secondary); font-size: 13px; }
</style>
