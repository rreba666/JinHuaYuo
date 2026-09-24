<script setup lang="ts">
/**
 * 老层发放设置（红包管理 →「老层发放」tab，**仅超管可见**）
 *
 * ## 背景（对接文档《老层一次性发放-前端对接文档-20260924》§1.2 / §六）
 * 老用户层的钱**按槽位发**（不像新层按订单），所以除了「按名单 7 天轮转」外，
 * 后端还支持一种新模式：
 * - `ROTATION`（历史默认）：把当周全部合格槽位按 `7/7/7/8/8/8/9` 分到 7 天，每天发一段；
 * - `ONE_SHOT`（2026-09-24 新规）：只在池首发放日（自然周口径下即**周一**）一次性发完，D2~D7 老层为 0。
 *
 * ⚠️ 两种模式**每人的钱与整周总额完全一样**，只是到账时点不同 —— 本页只做开关，不涉及金额。
 * ⚠️ **生效时点**：发放时读配置，**从下一个建池的池开始生效**（例如池23 发放中，改动要到池24 才起作用），
 * 所以必须在建池前设置好；设晚了当周改不回来。历史池不受影响。
 *
 * ## 为什么前端也要校验取值
 * 后端**写入端**会硬校验（非法值 `code=400`），但**读取端对非法值是静默回退 `ROTATION`** 的 ——
 * 一旦脏值落库，就会出现"后台显示改了、线上其实没生效"这种最难排查的情况（文档 §六原文）。
 */
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getOldLayerModeConfig, saveOldLayerModeConfig } from '@/api/setting'
import type { OldLayerMode } from '@/types/setting'

const loading = ref(false)
const saving = ref(false)
/** 当前选中的模式（默认 ROTATION —— 未配置时后端语义就是它）。 */
const mode = ref<OldLayerMode>('ROTATION')
/** 服务端当前已保存的模式，用于判断"是否改动过"与二次确认文案。 */
const savedMode = ref<OldLayerMode>('ROTATION')
const remark = ref('')

/** 两种模式的可读说明（用于单选组下方的解释文案）。 */
const MODE_OPTIONS: Array<{ value: OldLayerMode; label: string; desc: string }> = [
  {
    value: 'ROTATION',
    label: '按名单 7 天轮转（默认）',
    desc: '把当周全部合格槽位按 7/7/7/8/8/8/9 分到 7 天，每天发一段；每人整周只轮到一次。',
  },
  {
    value: 'ONE_SHOT',
    label: '每周一一次性发完',
    desc: '只在池首发放日（自然周口径下即周一）一次性把当周全部合格槽位发完，D2~D7 老层为 0。',
  },
]

/** 当前选中模式的说明文案。 */
const currentDesc = computed(() => MODE_OPTIONS.find((item) => item.value === mode.value)?.desc || '')
/** 是否与已保存的值不同。 */
const dirty = computed(() => mode.value !== savedMode.value)

/** 读取当前模式（未配置 / 查询失败都按 ROTATION 展示，与后端读取端口径一致）。 */
async function load(): Promise<void> {
  loading.value = true
  try {
    const cfg = await getOldLayerModeConfig()
    mode.value = cfg.mode
    savedMode.value = cfg.mode
    remark.value = cfg.remark
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '老层发放模式查询失败')
  } finally {
    loading.value = false
  }
}

/**
 * 保存模式。
 *
 * ⚠️ 改成 `ONE_SHOT` 时给一道二次确认 —— 它会**改变老层用户的到账时点**（从分散 7 天变成周一一次），
 * 属于影响面较大的运营设置，不该一键生效。
 */
async function save(): Promise<void> {
  if (saving.value) return
  if (mode.value === 'ONE_SHOT') {
    try {
      await ElMessageBox.confirm(
        '切换为「每周一一次性发完」后，老层当周的钱会在池首发放日一次性到账，D2~D7 不再有老层发放。'
        + '该设置从下一个建池的池开始生效，期间不可当周改回。确认切换？',
        '确认切换老层发放模式',
        { type: 'warning', confirmButtonText: '确认切换', cancelButtonText: '取消' },
      )
    } catch {
      return // 用户取消
    }
  }
  saving.value = true
  try {
    await saveOldLayerModeConfig({ mode: mode.value, remark: remark.value.trim() || undefined })
    savedMode.value = mode.value
    ElMessage.success('已保存；新设置从下一个建池的池开始生效')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '老层发放模式保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(() => { void load() })
</script>

<template>
  <el-card shadow="never" class="content-card" v-loading="loading">
    <div class="toolbar">
      <div>
        <strong>老层发放模式</strong>
        <span class="toolbar-count">仅超级管理员可改</span>
      </div>
      <el-button :loading="loading" @click="load">刷新</el-button>
    </div>

    <el-alert
      type="warning"
      :closable="false"
      show-icon
      class="mode-alert"
      title="改动从「下一个建池的池」开始生效"
      description="发放时读取本配置：当前池正在发放中的不受影响，历史池也不受影响。因此必须在下次建池前设置好，设晚了当周无法改回。"
    />

    <el-form label-width="120px" class="mode-form">
      <el-form-item label="发放模式">
        <el-radio-group v-model="mode">
          <el-radio v-for="item in MODE_OPTIONS" :key="item.value" :value="item.value">{{ item.label }}</el-radio>
        </el-radio-group>
        <p class="mode-desc">{{ currentDesc }}</p>
      </el-form-item>
      <el-form-item label="备注">
        <el-input
          v-model="remark"
          maxlength="100"
          show-word-limit
          placeholder="建议写清改动原因，例如：2026-09-28 起老层改为每周一一次性发放"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="saving" :disabled="!dirty" @click="save">保存</el-button>
        <span v-if="!dirty" class="mode-tip">当前已是保存中的设置</span>
      </el-form-item>
    </el-form>

    <el-alert
      type="info"
      :closable="false"
      show-icon
      title="两种模式，用户拿到的钱完全一样"
      description="ROTATION 与 ONE_SHOT 只改变到账时点（分散 7 天 / 周一一次），每人金额与整周总额不变，因此前端不需要为 ONE_SHOT 做任何特殊处理。"
    />
  </el-card>
</template>

<style scoped>
.content-card { margin-top: 16px; }
.toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.toolbar-count { margin-left: 12px; color: #909399; font-size: 13px; }
.mode-alert { margin-bottom: 16px; }
.mode-form { max-width: 760px; }
.mode-desc { margin: 6px 0 0; color: #909399; font-size: 13px; line-height: 20px; }
.mode-tip { margin-left: 12px; color: #909399; font-size: 13px; }
</style>
