<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, type UploadRequestOptions } from 'element-plus'
import ImageGridUpload from '@/components/ImageGridUpload.vue'
import { useHomepageStore } from '@/stores/homepage'
import type { HomepageConfigVO, HomepageEnabledValue } from '@/types/homepage'
import { Edit } from '@element-plus/icons-vue'

const store = useHomepageStore()
const editItem = ref<HomepageConfigVO | null>(null)
const form = reactive({ bottomTitle: '', bottomImageUrl: [] as string[], bottomLinkTarget: [] as string[] })

/** 归一化。 */
function norm(value: HomepageEnabledValue | undefined): 0 | 1 {
  return value === 1 || value === '1' ? 1 : 0
}

/** 打开底部推荐编辑。 */
function openEditor(item: HomepageConfigVO): void {
  editItem.value = item
  Object.assign(form, {
    bottomTitle: item.bottomTitle || '',
    bottomImageUrl: [...(item.bottomImageUrl || [])],
    bottomLinkTarget: [...(item.bottomLinkTarget || [])],
  })
}

function closeEditor(): void { editItem.value = null }

function add(field: 'bottomImageUrl' | 'bottomLinkTarget'): void { form[field].push('') }
function remove(field: 'bottomImageUrl' | 'bottomLinkTarget', i: number): void { form[field].splice(i, 1) }

/** 上传底部推荐图。 */
async function upload(options: UploadRequestOptions): Promise<void> {
  const file = options.file as File
  if (form.bottomImageUrl.length >= 5) { ElMessage.warning('最多上传5张图片'); return }
  if (!file.type.startsWith('image/')) { ElMessage.error('请上传图片'); return }
  if (file.size > 10 * 1024 * 1024) { ElMessage.error('图片不能超过 10MB'); return }
  try {
    form.bottomImageUrl.push(await store.uploadFile(file))
    ElMessage.success('上传成功')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '上传失败')
  }
}

/** 保存底部字段的部分更新。 */
async function save(): Promise<void> {
  if (!editItem.value) return
  try {
    await store.updateConfig(editItem.value.id, { bottomTitle: form.bottomTitle, bottomImageUrl: form.bottomImageUrl, bottomLinkTarget: form.bottomLinkTarget })
    closeEditor()
    ElMessage.success('底部推荐保存成功')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  }
}

const enabledId = computed(() => {
  const item = store.list.find((i) => norm(i.isEnabled) === 1)
  return item ? String(item.id) : null
})

onMounted(() => {
  store.loadConfigs().catch((e: unknown) => ElMessage.error(e instanceof Error ? e.message : '加载失败'))
})
</script>

<template>
  <section class="page-container">
    <div class="page-heading">
      <div><h1>底部推荐</h1><p>管理首页底部推荐标题、图片和跳转目标。</p></div>
      <el-button v-if="editItem" @click="closeEditor">返回列表</el-button>
    </div>

    <el-card v-if="!editItem" shadow="never" class="content-card">
      <el-table v-loading="store.loading" :data="store.list" border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="bottomTitle" label="底部标题" min-width="180">
          <template #default="{ row }">{{ row.bottomTitle || '未设置' }}</template>
        </el-table-column>
        <el-table-column label="底部图片" min-width="140">
          <template #default="{ row }">
            <div v-if="row.bottomImageUrl?.length" class="mini-preview">
              <el-image v-for="(url, i) in row.bottomImageUrl.slice(0, 3)" :key="i" :src="url" class="mini-thumb" fit="cover" :preview-src-list="row.bottomImageUrl" preview-teleported />
            </div>
            <span v-else class="empty">暂无</span>
          </template>
        </el-table-column>
        <el-table-column label="跳转目标" min-width="120">
          <template #default="{ row }">{{ row.bottomLinkTarget?.length || 0 }} 个目标</template>
        </el-table-column>
        <el-table-column label="当前启用" width="90">
          <template #default="{ row }"><el-tag size="small" :type="String(row.id) === enabledId ? 'success' : 'info'">{{ String(row.id) === enabledId ? '启用' : '禁用' }}</el-tag></template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }"><div class="operator-actions"><el-button size="small" type="primary" @click="openEditor(row)"><el-icon><Edit /></el-icon>编辑</el-button></div></template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!store.loading && !store.list.length" description="暂无配置" />
    </el-card>

    <template v-if="editItem">
      <el-card shadow="never" class="content-card">
        <el-form label-width="110px">
          <el-form-item label="底部标题"><el-input v-model="form.bottomTitle" placeholder="例如：热门推荐" /></el-form-item>
          <el-form-item label="底部图片">
            <ImageGridUpload v-model="form.bottomImageUrl" :uploading="store.uploading" @upload="upload" @remove="remove('bottomImageUrl', $event)" />
          </el-form-item>
          <el-form-item label="跳转目标">
            <div class="edit-block">
              <div v-for="(_, i) in form.bottomLinkTarget" :key="`bt-${i}`" class="array-row">
                <el-input v-model="form.bottomLinkTarget[i]" placeholder="小程序页面路径" />
                <el-button link type="danger" @click="remove('bottomLinkTarget', i)">删除</el-button>
              </div>
              <el-button link @click="add('bottomLinkTarget')">新增目标</el-button>
            </div>
          </el-form-item>
        </el-form>
        <div class="form-footer"><el-button @click="closeEditor">取消</el-button><el-button type="primary" :loading="store.saving" @click="save">保存底部推荐</el-button></div>
      </el-card>
    </template>
  </section>
</template>

<style scoped>
.mini-preview { display: flex; gap: 4px; }
.mini-thumb { width: 40px; height: 28px; border-radius: 3px; }
.empty { color: var(--vben-muted); font-size: 13px; }
.edit-block { width: 100%; }
.array-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.array-row .el-input { flex: 1; }
.array-actions { display: flex; gap: 10px; margin-top: 6px; }
.thumb { width: 72px; height: 48px; border-radius: 4px; flex-shrink: 0; }
.form-footer { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--vben-border); }
.operator-actions { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.operator-actions :deep(.el-button) { margin-left: 0; padding: 5px 8px; }
.operator-actions :deep(.el-icon) { margin-right: 4px; }
</style>
