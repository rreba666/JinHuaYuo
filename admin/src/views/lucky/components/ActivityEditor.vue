<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, type FormInstance, type FormRules, type UploadRequestOptions } from 'element-plus'
import { Delete, Plus } from '@element-plus/icons-vue'
import ImageGridUpload from '@/components/ImageGridUpload.vue'
import { createLuckyActivity, getLuckyActivity, getLuckyRigged, setLuckyRigged, updateLuckyActivity, uploadLuckyImage } from '@/api/lucky'
import type { LuckyActivitySaveDTO, LuckyPrize, LuckyRigged } from '@/types/lucky'

const props = defineProps<{ activityId: number | null }>()
const emit = defineEmits<{ (e: 'done'): void; (e: 'cancel'): void }>()

const loading = ref(false)
const saving = ref(false)
const uploading = ref(false)
const formRef = ref<FormInstance>()
/** 弹窗可见性：由父页面 v-if 控制挂载，此处初始为打开。 */
const open = ref(true)
const prizes = ref<LuckyPrize[]>([])
const rigged = ref<LuckyRigged[]>([])

const form = reactive<LuckyActivitySaveDTO>({
  name: '',
  description: '',
  status: 0,
  startTime: '',
  endTime: '',
  dailyLimitPerUser: null,
  totalLimitPerUser: null,
  prizes: [],
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入活动名称', trigger: 'blur' }],
  status: [{ required: true, message: '请选择启用状态', trigger: 'change' }],
  startTime: [{ required: true, message: '请选择开始时间', trigger: 'change' }],
  endTime: [{ required: true, message: '请选择结束时间', trigger: 'change' }],
}

function defaultPrize(): LuckyPrize {
  return { name: '', level: '', image: '', probability: 0, stock: 1, sortOrder: 0 }
}

function resetForm(): void {
  formRef.value?.clearValidate()
  Object.assign(form, {
    name: '',
    description: '',
    status: 0,
    startTime: '',
    endTime: '',
    dailyLimitPerUser: null,
    totalLimitPerUser: null,
  })
  prizes.value = [defaultPrize()]
  rigged.value = []
}

function addPrize(): void {
  prizes.value.push({ ...defaultPrize(), sortOrder: prizes.value.length })
}

function removePrize(index: number): void {
  prizes.value.splice(index, 1)
}

function addRigged(): void {
  rigged.value.push({ userId: 0, prizeId: 0, status: 'UNUSED' })
}

function removeRigged(index: number): void {
  rigged.value.splice(index, 1)
}

function removeRiggedImage(field: 'image', index: number): void {
  if (field === 'image') prizes.value[index].image = ''
}

/** 上传奖品图片。 */
async function onUpload(options: UploadRequestOptions, index: number): Promise<void> {
  const file = options.file as File
  if (!file.type.startsWith('image/')) { ElMessage.error('请上传图片'); return }
  if (file.size > 10 * 1024 * 1024) { ElMessage.error('图片不能超过 10MB'); return }
  uploading.value = true
  try {
    prizes.value[index].image = await uploadLuckyImage(file)
    ElMessage.success('上传成功')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '上传失败')
  } finally {
    uploading.value = false
  }
}

async function loadDetail(): Promise<void> {
  if (!props.activityId) return
  loading.value = true
  try {
    const detail = await getLuckyActivity(props.activityId)
    Object.assign(form, {
      name: detail.name,
      description: detail.description || '',
      status: detail.status,
      startTime: detail.startTime,
      endTime: detail.endTime,
      dailyLimitPerUser: detail.dailyLimitPerUser,
      totalLimitPerUser: detail.totalLimitPerUser,
    })
    prizes.value = (detail.prizes?.length ? detail.prizes : [defaultPrize()]).map((p) => ({ ...p }))
    rigged.value = (detail.rigged || []).map((r) => ({ ...r }))
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '活动详情加载失败')
  } finally {
    loading.value = false
  }
}

async function submit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  if (!prizes.value.length) { ElMessage.error('至少需要一个奖品'); return }
  for (const p of prizes.value) {
    if (!p.name) { ElMessage.error('奖品名称不能为空'); return }
    if (p.probability < 0 || p.probability > 100) { ElMessage.error(`${p.name} 的概率需在 0~100 之间`); return }
    if (p.stock < 0) { ElMessage.error('库存不能为负'); return }
  }
  // 概率总和必须等于 100（含「谢谢参与」格）。
  const totalProbability = prizes.value.reduce((sum, p) => sum + (Number(p.probability) || 0), 0)
  if (Math.abs(totalProbability - 100) > 0.001) {
    ElMessage.error(`奖品概率总和需等于 100%，当前为 ${totalProbability}%`)
    return
  }
  // 校验奖品格位去重（名称相同视为同一格，去重避免不必要）。
  const payload: LuckyActivitySaveDTO = {
    name: form.name.trim(),
    description: form.description,
    status: form.status,
    startTime: form.startTime,
    endTime: form.endTime,
    dailyLimitPerUser: form.dailyLimitPerUser ?? null,
    totalLimitPerUser: form.totalLimitPerUser ?? null,
    // 编辑时回传各自 prizeId（后端按 prizeId 匹配复用，避免重复创建）；新奖品留空；剔除 remainingStock。
    prizes: prizes.value.map((p, index) => ({
      ...(p.prizeId ? { prizeId: p.prizeId } : {}),
      name: p.name,
      image: p.image || null,
      level: p.level ?? null,
      probability: p.probability,
      stock: p.stock,
      sortOrder: p.sortOrder ?? index,
    })),
  }
  saving.value = true
  try {
    if (props.activityId) {
      await updateLuckyActivity(props.activityId, payload)
      // 内定名单整体覆盖
      const riggedItems = rigged.value.filter((r) => r.userId > 0 && r.prizeId > 0).map((r) => ({ userId: r.userId, prizeId: r.prizeId }))
      await setLuckyRigged(props.activityId, riggedItems)
    } else {
      await createLuckyActivity(payload)
      // 新增：若编辑器里填了内定，暂不支持直接关联（创建返回 id 后无内定），忽略内定（可由编辑再次保存）
    }
    ElMessage.success(props.activityId ? '活动已保存' : '活动已创建')
    emit('done')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(() => { void loadDetail() })
</script>

<template>
  <el-dialog
    v-model="open"
    :title="props.activityId ? '编辑活动' : '新增活动'"
    width="960px"
    append-to-body
    :close-on-click-modal="false"
    @close="open = false; emit('cancel')"
  >
    <el-form ref="formRef" v-loading="loading" :model="form" :rules="rules" label-width="90px" label-position="top">
      <el-divider content-position="left">活动基础信息</el-divider>
      <el-form-item label="活动名称" prop="name">
        <el-input v-model="form.name" maxlength="64" show-word-limit placeholder="请输入活动名称，如：开业大抽奖" />
      </el-form-item>
      <el-form-item label="活动描述">
        <el-input v-model="form.description" type="textarea" :rows="2" maxlength="255" show-word-limit placeholder="请输入活动说明，选填" />
        <div class="field-hint">描述会展示在小程序活动页，说明活动玩法</div>
      </el-form-item>
      <el-form-item label="启用状态" prop="status">
        <el-radio-group v-model="form.status">
          <el-radio :value="1">启用</el-radio>
          <el-radio :value="0">停用</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="活动起止时间" prop="startTime">
        <el-date-picker v-model="form.startTime" type="datetime" placeholder="开始时间" value-format="YYYY-MM-DD HH:mm:ss" style="width: 220px" />
        <span class="sep">至</span>
        <el-date-picker v-model="form.endTime" type="datetime" placeholder="结束时间" value-format="YYYY-MM-DD HH:mm:ss" style="width: 220px" />
        <div class="field-hint">仅在此时间段内可参与抽奖</div>
      </el-form-item>
      <el-form-item label="抽奖次数">
        <el-input-number v-model="form.dailyLimitPerUser" :min="0" :max="9999" placeholder="每日" controls-position="right" :value-on-clear="null" />
        <span class="sep">每日 / </span>
        <el-input-number v-model="form.totalLimitPerUser" :min="0" :max="999999" placeholder="总次数" controls-position="right" :value-on-clear="null" />
        <span class="form-tip">留空=不限</span>
        <div class="field-hint">每人每日可抽次数 / 活动期内总次数</div>
      </el-form-item>

      <el-divider content-position="left">奖品配置<span class="divider-tip">至少一个奖品；含「谢谢参与」格；所有奖品概率相加须等于 100%</span></el-divider>
      <div v-for="(prize, index) in prizes" :key="index" class="prize-row">
        <div class="prize-head"><span class="prize-index">奖品 {{ index + 1 }}</span><el-button class="row-remove" link type="danger" :icon="Delete" @click="removePrize(index)">删除</el-button></div>
        <div class="prize-grid">
          <el-form-item label="名称"><el-input v-model="prize.name" maxlength="64" placeholder="奖品名称，如：一等奖-免单券" /></el-form-item>
          <el-form-item label="奖项等级">
            <el-input v-model="prize.level" maxlength="32" placeholder="如：一等奖/二等奖" />
            <div class="field-hint">填「谢谢参与」则表示未中奖格</div>
          </el-form-item>
          <el-form-item label="概率(%)">
            <el-input-number v-model="prize.probability" :min="0" :max="100" controls-position="right" />
            <div class="field-hint">所有奖品（含谢谢参与）概率相加=100</div>
          </el-form-item>
          <el-form-item label="库存">
            <el-input-number v-model="prize.stock" :min="0" controls-position="right" />
            <div class="field-hint">该奖品可被抽中的总数量</div>
          </el-form-item>
          <el-form-item label="排序">
            <el-input-number v-model="prize.sortOrder" :min="0" controls-position="right" />
            <div class="field-hint">越小越靠前</div>
          </el-form-item>
          <el-form-item label="奖品图片">
            <ImageGridUpload
              :model-value="prize.image ? [prize.image] : []"
              :max="1"
              :uploading="uploading"
              @upload="onUpload($event, index)"
              @remove="removeRiggedImage('image', index)"
            />
            <div class="field-hint">建议正方形图片</div>
          </el-form-item>
        </div>
      </div>
      <el-button :icon="Plus" @click="addPrize">添加奖品</el-button>

      <el-divider content-position="left">内定名单<span class="divider-tip">指定某用户必中某奖品；命中一次后失效，之后恢复普通概率</span></el-divider>
      <div v-for="(item, index) in rigged" :key="index" class="rigged-row">
        <el-input v-model="item.userId" type="number" placeholder="内定用户ID" />
        <el-input v-model="item.prizeId" type="number" placeholder="内定奖品ID" />
        <el-button link type="danger" :icon="Delete" @click="removeRigged(index)">删除</el-button>
      </div>
      <div class="rigged-hint">用户ID 填小程序用户ID；奖品ID 填上方奖品列表中的某个奖品 ID（编辑活动时可在奖品配置看到）。留空=不启用内定。</div>
      <el-button :icon="Plus" @click="addRigged">添加内定</el-button>
    </el-form>

    <template #footer>
      <el-button @click="open = false; emit('cancel')">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.sep { margin: 0 10px; color: var(--el-text-color-secondary); }
.form-tip { margin-left: 10px; color: var(--el-text-color-secondary); font-size: 12px; }
.prize-row { margin-bottom: 12px; padding: 12px; border: 1px solid var(--el-border-color-lighter); border-radius: 8px; }
.prize-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.prize-index { font-weight: 600; font-size: 14px; }
.row-remove { padding: 0; }
.prize-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 0 16px; }
.prize-grid :deep(.el-form-item) { margin-bottom: 14px; }
.rigged-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.rigged-row .el-input { width: 200px; }
.divider-tip { margin-left: 12px; color: var(--el-text-color-secondary); font-size: 12px; font-weight: 400; }
.field-hint { margin-top: 4px; color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.4; }
.rigged-hint { margin: 4px 0 12px; color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.6; }
</style>
