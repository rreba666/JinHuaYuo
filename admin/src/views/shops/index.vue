<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import DataTable from '@/components/DataTable.vue'
import { useShopStore } from '@/stores/shop'
import type { Shop, ShopCreateDTO, ShopStatus } from '@/types/shop'
import { Delete, Edit, RefreshLeft } from '@element-plus/icons-vue'

const store = useShopStore()
const selected = ref<Shop[]>([])
const deletableSelected = computed(() => selected.value.filter((shop) => shop.delFlag !== 1))
const restorableSelected = computed(() => selected.value.filter((shop) => shop.delFlag === 1))
const formVisible = ref(false)
const editingId = ref<string>()
const formRef = ref<FormInstance>()
const form = reactive<ShopCreateDTO>({ name: '', address: '', phone: '' })
const rules: FormRules = {
  name: [{ required: true, message: '请输入门店名称', trigger: 'blur' }],
  address: [{ required: true, message: '请输入门店地址', trigger: 'blur' }],
}

/** 清空并打开门店编辑表单。 */
function openForm(shop?: Shop): void {
  editingId.value = shop?.id
  Object.assign(form, { name: shop?.name || '', address: shop?.address || '', phone: shop?.phone || '' })
  formVisible.value = true
}

/** 校验并保存门店。 */
async function submitForm(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  try {
    await store.save(editingId.value, { ...form })
    formVisible.value = false
    ElMessage.success(editingId.value ? '门店已更新' : '门店已新增')
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : '门店保存失败') }
}

/** 切换门店状态，失败时重新加载服务端状态。 */
async function changeStatus(shop: Shop, value: boolean | string | number): Promise<void> {
  const next: ShopStatus = value ? 1 : 0
  try {
    await ElMessageBox.confirm(`确认${next ? '启用' : '禁用'}门店“${shop.name}”吗？`, '门店状态确认')
    await store.setStatus(shop, next)
    ElMessage.success(next ? '门店已启用' : '门店已禁用')
  } catch (error) {
    shop.status = next ? 0 : 1
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '门店状态更新失败')
  }
}

/** 判断门店是否已经软删除。 */
function isDeleted(shop: Shop): boolean {
  return shop.delFlag === 1
}

/** 删除单个门店，并在确认后刷新列表。 */
async function removeShop(shop: Shop): Promise<void> {
  if (isDeleted(shop)) return
  try {
    await ElMessageBox.confirm(`确认删除门店“${shop.name}”吗？`, '删除门店确认', { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' })
    await store.remove(shop.id)
    selected.value = []
    ElMessage.success('门店已删除')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '门店删除失败')
  }
}

/** 批量软删除当前页选中的正常门店。 */
async function removeSelected(): Promise<void> {
  if (!deletableSelected.value.length) return
  try {
    await ElMessageBox.confirm(`确认删除选中的 ${deletableSelected.value.length} 个门店吗？`, '批量删除门店确认', { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' })
    const result = await store.removeBatch(deletableSelected.value.map((shop) => shop.id))
    selected.value = []
    if (result.failedIds.length) ElMessage.warning(`删除成功 ${result.successIds.length} 个，失败 ${result.failedIds.length} 个`)
    else ElMessage.success(`已删除 ${result.successIds.length} 个门店`)
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '批量删除失败')
  }
}

/** 恢复单个已删除门店。 */
async function restoreShop(shop: Shop): Promise<void> {
  if (!isDeleted(shop)) return
  try {
    await ElMessageBox.confirm(`确认恢复门店“${shop.name}”吗？`, '恢复门店确认', { type: 'warning', confirmButtonText: '确认恢复', cancelButtonText: '取消' })
    await store.restore(shop.id)
    selected.value = []
    ElMessage.success('门店已恢复')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '门店恢复失败')
  }
}

/** 批量恢复当前页选中的已删除门店。 */
async function restoreSelected(): Promise<void> {
  if (!restorableSelected.value.length) return
  try {
    await ElMessageBox.confirm(`确认恢复选中的 ${restorableSelected.value.length} 个门店吗？`, '批量恢复门店确认', { type: 'warning', confirmButtonText: '确认恢复', cancelButtonText: '取消' })
    const result = await store.restoreBatch(restorableSelected.value.map((shop) => shop.id))
    selected.value = []
    if (result.failedIds.length) ElMessage.warning(`恢复成功 ${result.successIds.length} 个，失败 ${result.failedIds.length} 个`)
    else ElMessage.success(`已恢复 ${result.successIds.length} 个门店`)
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '批量恢复失败')
  }
}

async function loadList(): Promise<void> {
  try { await store.fetchList() } catch (error) { ElMessage.error(error instanceof Error ? error.message : '门店列表查询失败') }
}

/** 按关键词搜索门店（ID/名称），回车或点击触发。 */
function searchShops(): void {
  store.page = 1
  void loadList()
}

onMounted(() => { void loadList() })
</script>

<template>
  <section class="page-container page-enter">
    <div class="page-heading"><div><h1>门店管理</h1><p>维护自提门店的基础信息和营业状态。</p></div><el-button type="primary" @click="openForm()">新增门店</el-button></div>
    <el-card shadow="never" class="content-card">
      <div class="toolbar"><div><strong>门店列表</strong><span class="toolbar-count">共 {{ store.total }} 条</span></div><div class="toolbar-actions"><el-input v-model="store.keyword" placeholder="门店ID/名称" clearable class="search-input" @keyup.enter="searchShops" @clear="searchShops" /><el-button type="primary" @click="searchShops">搜索</el-button><span v-if="selected.length" class="selection-tip">已选择 {{ selected.length }} 项</span><el-button size="small" type="danger" plain :disabled="!deletableSelected.length || store.actionLoading" :loading="store.actionLoading" @click="removeSelected"><el-icon><Delete /></el-icon>批量删除</el-button><el-button size="small" type="success" plain :disabled="!restorableSelected.length || store.actionLoading" :loading="store.actionLoading" @click="restoreSelected"><el-icon><RefreshLeft /></el-icon>批量恢复</el-button><el-button :loading="store.loading" @click="loadList">刷新</el-button></div></div>
      <DataTable :data="store.list" :loading="store.loading" :total="store.total" :page="store.page" :page-size="store.pageSize" empty-text="暂无门店数据" @selection-change="selected = $event" @page-change="store.page = $event; selected = []; void loadList()" @size-change="store.pageSize = $event; store.page = 1; selected = []; void loadList()">
        <el-table-column prop="id" label="门店 ID" min-width="180" />
        <el-table-column prop="name" label="门店名称" min-width="180" />
        <el-table-column prop="address" label="地址" min-width="260" />
        <el-table-column prop="phone" label="联系电话" width="150" />
        <el-table-column label="状态" width="110"><template #default="{ row }"><el-tag v-if="isDeleted(row)" type="info">已删除</el-tag><el-switch v-else :model-value="row.status === 1" :loading="store.actionLoading" @change="changeStatus(row, $event)" /></template></el-table-column>
        <el-table-column prop="createTime" label="创建时间" min-width="180" />
        <el-table-column label="操作" width="190" fixed="right"><template #default="{ row }"><div class="operator-actions"><el-button v-if="isDeleted(row)" size="small" type="success" :loading="store.actionLoading" @click="restoreShop(row)"><el-icon><RefreshLeft /></el-icon>恢复</el-button><template v-else><el-button size="small" type="primary" @click="openForm(row)"><el-icon><Edit /></el-icon>编辑</el-button><el-button size="small" type="danger" :loading="store.actionLoading" @click="removeShop(row)"><el-icon><Delete /></el-icon>删除</el-button></template></div></template></el-table-column>
      </DataTable>
    </el-card>
    <el-dialog v-model="formVisible" :title="editingId ? '编辑门店' : '新增门店'" width="520px" append-to-body>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px"><el-form-item label="门店名称" prop="name"><el-input v-model="form.name" /></el-form-item><el-form-item label="门店地址" prop="address"><el-input v-model="form.address" /></el-form-item><el-form-item label="联系电话" prop="phone"><el-input v-model="form.phone" /></el-form-item></el-form>
      <template #footer><el-button @click="formVisible = false">取消</el-button><el-button type="primary" :loading="store.saving" @click="submitForm">保存</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.operator-actions { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.operator-actions :deep(.el-button) { margin-left: 0; padding: 5px 8px; }
.operator-actions :deep(.el-icon) { margin-right: 4px; }
.toolbar-actions { display: flex; align-items: center; gap: 8px; }
.search-input { width: 200px; }
.selection-tip { color: var(--el-text-color-secondary); font-size: 13px; }
</style>
