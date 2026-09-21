<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Warning } from '@element-plus/icons-vue'
import { commitOfflineRefund, isOfflineRefundTokenExpired, previewOfflineRefund } from '@/api/offlineRefund'
import { OFFLINE_REFUND_BRANCH_TAG, OFFLINE_REFUND_BRANCH_TEXT } from '@/types/offlineRefund'
import type { OfflineRefundPreviewVO } from '@/types/offlineRefund'

/**
 * 自提订单「线下退款冲账」弹窗（三段式：预演 → 表单 → 结果）。
 *
 * ⚠️ **这是财务不可逆操作的界面**，所有交互设计都围绕「防误操作」与「可读性」：
 * 1. 打开即预演（只读），把 `plan`（哪张表哪一行从什么变成什么）+ `money`（金额影响）+ `warnings`（风险提示）先摆出来；
 * 2. 表单要求 原因 / 凭证号 / 金额 + 勾选确认 + **手工重输订单号**；金额与实付不一致时二次确认；
 * 3. 提交后展示 `reconcile` 对账块与异常提示；令牌失效**自动回到第一段重新预演**，不让用户卡死。
 *
 * ⚠️ **契约来源**：`docs/B端-自提线下退款冲账-接口方案与风险说明-20260921.md`（2026-09-21）；
 * 该接口尚未进 `api-docs.json`，字段名以后端补的 OpenAPI 为准（补后需复核本组件展示的字段）。
 */

const visible = defineModel<boolean>({ default: false })

const props = defineProps<{
  /** 冲账目标订单号（订单详情页传入）。 */
  orderNo: string
}>()

const emit = defineEmits<{ success: [payload: OfflineRefundPreviewVO] }>()

/** 当前段位：0=预演 / 1=表单 / 2=结果。 */
const activeStep = ref(0)
const formRef = ref<FormInstance>()
const previewLoading = ref(false)
const submitting = ref(false)
const previewError = ref('')
const submitError = ref('')
const preview = ref<OfflineRefundPreviewVO | null>(null)
/** 提交成功后的响应（= 预演 VO + reconcile），为 null 表示尚未提交成功。 */
const result = ref<OfflineRefundPreviewVO | null>(null)
/** 是否提交成功（决定「完成」按钮是刷新还是直接关闭）。 */
const committed = ref(false)

const form = reactive({
  reason: '',
  voucherNo: '',
  offlineRefundAmount: 0,
  confirmed: false,
  /** 手工重输的订单号（必须与当前订单号完全一致才能提交）。 */
  confirmOrderNo: '',
})

const rules: FormRules = {
  reason: [{ required: true, message: '请填写退款原因', trigger: 'blur' }],
  voucherNo: [{ required: true, message: '请填写线下退款凭证号', trigger: 'blur' }],
  offlineRefundAmount: [{ required: true, message: '请填写线下退款金额', trigger: 'change' }],
}

/** 未冲账时才允许进入表单段（`blockers` 非空 / `NO_CONTRIBUTION` / 已冲账 都不给提交入口）。 */
const canSubmit = computed(() => {
  const data = preview.value
  if (!data) return false
  if (data.executed) return false
  if (data.branch === 'NO_CONTRIBUTION') return false
  return data.blockers.length === 0
})

/** 订单实付金额（元）；预演未返回时兜底 0。 */
const payAmount = computed(() => Number(preview.value?.payAmount ?? 0))

/** 手工输入订单号是否与当前订单一致（大小写与空格不敏感，避免复制粘贴带空格导致误判）。 */
const orderNoMatched = computed(() => form.confirmOrderNo.trim() === props.orderNo.trim() && props.orderNo.trim() !== '')

/** 金额与订单实付是否一致（不一致需要二次确认，见 md §四.3）。 */
const amountMatched = computed(() => Math.abs(Number(form.offlineRefundAmount) - payAmount.value) < 0.005)

/** 分支中文：优先用映射表，未知分支原样展示后端下发值（后端新增分支不至于显示空白）。 */
const branchText = computed(() => {
  const branch = String(preview.value?.branch ?? '')
  return OFFLINE_REFUND_BRANCH_TEXT[branch] ?? (branch || '未返回分支')
})

/** 分支标签颜色；未知分支用 info。 */
const branchTag = computed(() => OFFLINE_REFUND_BRANCH_TAG[String(preview.value?.branch ?? '')] ?? 'info')

/** money 金额影响 6 行（顺序与 md §2.1 示例一致，便于财务逐项核对）。 */
const moneyRows = computed(() => {
  const money = preview.value?.money
  if (!money) return []
  return [
    { key: 'poolTotalDelta', label: '红包池总额', value: money.poolTotalDelta },
    { key: 'newLayerDelta', label: '新用户层', value: money.newLayerDelta },
    { key: 'oldLayerDelta', label: '老用户层', value: money.oldLayerDelta },
    { key: 'emergencyDelta', label: '应急红包池', value: money.emergencyDelta },
    { key: 'promotionDelta', label: '推广金', value: money.promotionDelta },
    { key: 'peptideDelta', label: '肽金', value: money.peptideDelta },
  ]
})

/** 池总额 = 新层 + 老层 一致性检查（不等只提示、**不阻断**，见任务要求）。 */
const layerConsistent = computed(() => {
  const money = preview.value?.money
  if (!money) return true
  return Math.abs(money.poolTotalDelta - (money.newLayerDelta + money.oldLayerDelta)) < 0.005
})

/** 结果段对账块 12 个字段（金额类两位小数，条数类原样）。 */
const reconcileRows = computed(() => {
  const data = result.value?.reconcile
  if (!data) return []
  return [
    { key: 'poolTotal', label: '池总额（冲减后）', value: data.poolTotal },
    { key: 'poolNew', label: '新用户层（冲减后）', value: data.poolNew },
    { key: 'poolOld', label: '老用户层（冲减后）', value: data.poolOld },
    { key: 'poolDistributed', label: '池内已发放', value: data.poolDistributed },
    { key: 'poolRemaining', label: '池内剩余待发', value: data.poolRemaining },
    { key: 'poolNewOrderCount', label: '池内订单数', value: data.poolNewOrderCount, count: true },
    { key: 'nonVoidedCount', label: '非作废贡献条数', value: data.nonVoidedCount, count: true },
    { key: 'nonVoidedAmount', label: '非作废贡献金额', value: data.nonVoidedAmount },
    { key: 'emergencyBalance', label: '应急池余额', value: data.emergencyBalance },
    { key: 'emergencyTotalDeducted', label: '应急池累计抽取', value: data.emergencyTotalDeducted },
    { key: 'emergencyTotalInjected', label: '应急池累计注入', value: data.emergencyTotalInjected },
  ]
})

/** 结果段对账块的一致性提示：池总额 = 新层 + 老层。 */
const reconcileLayerConsistent = computed(() => {
  const data = result.value?.reconcile
  if (!data) return true
  return Math.abs(data.poolTotal - (data.poolNew + data.poolOld)) < 0.005
})

/**
 * 展示金额格式化：一律两位小数；`null` / 非数字用「—」占位（**不要显示 undefined**）。
 */
function money(value: number | null | undefined): string {
  return value == null || !Number.isFinite(Number(value)) ? '—' : Number(value).toFixed(2)
}

/** 带符号的 delta 展示：负值前面显式加 `-`，0 显示 `0.00`（页面按颜色区分）。 */
function delta(value: number): string {
  const num = Number(value)
  if (!Number.isFinite(num)) return '—'
  return `${num > 0 ? '+' : ''}${num.toFixed(2)}`
}

/** delta 文本颜色：负值（冲减）红、正值绿、0 灰。 */
function deltaClass(value: number): string {
  const num = Number(value)
  if (!Number.isFinite(num) || num === 0) return 'delta-zero'
  return num < 0 ? 'delta-negative' : 'delta-positive'
}

/**
 * `plan` 的 `from` / `to` 快照值安全展示（**这是最容易出 "undefined" 的地方**）：
 * - `null` / `undefined` → 「—」；
 * - 布尔 / 数字 / 字符串 → 原样；
 * - 对象 / 数组 → JSON 字符串（用于超长省略，完整值走 tooltip）。
 */
function formatPlanValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value === '' ? '—' : value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    const json = JSON.stringify(value)
    return json === undefined ? '—' : json
  } catch {
    return String(value)
  }
}

/** 变更计划表格行 key（表名 + 行ID + 字段；同一行可能改多个字段）。 */
function planRowKey(row: { table: string; id: string; field: string }, index: number): string {
  return `${row.table}-${row.id}-${row.field}-${index}`
}

/**
 * 是否存在「待人工跟进的异常项」。
 *
 * **数据来源限制**：md §三 说明异常（推广金余额不足 / 肽金余额不足 / 应急池反向失败）体现在**审计表与 `warnings`**，
 * 而审计表没有查询接口 —— 所以本次只能按 `warnings` 文案里的"异常/不足/失败/待人工"关键词判断，
 * 属于**启发式**提示，不是后端结构化字段（后端未提供 `exceptionFlag` 字段，待补）。
 */
const hasException = computed(() => {
  const data = result.value ?? preview.value
  if (!data) return false
  const text = [...data.warnings, ...data.blockers].join('；')
  return /(异常|不足|失败|待人工|追回)/.test(text)
})

/** 重置全部状态：每次打开弹窗都从第一段开始，避免残留上一单的清单与表单值。 */
function resetState(): void {
  activeStep.value = 0
  previewLoading.value = false
  submitting.value = false
  previewError.value = ''
  submitError.value = ''
  preview.value = null
  result.value = null
  committed.value = false
  form.reason = ''
  form.voucherNo = ''
  form.offlineRefundAmount = 0
  form.confirmed = false
  form.confirmOrderNo = ''
  // 不在这里调 formRef.clearValidate()：弹窗是 destroy-on-close，表单实例在关闭后已卸载，
  // 残留的 ref 可能指向已销毁组件（重开时表单本身是全新的，校验态自然清空）。
}

/**
 * 调预演（只读）。成功后回到第一段；金额输入框默认带出订单实付（md §四.3）。
 * 预演失败时把错误留在弹窗里（而不是直接关掉），用户可以重试或关闭。
 */
async function runPreview(): Promise<void> {
  if (!props.orderNo) {
    previewError.value = '缺少订单号，无法预演'
    return
  }
  previewLoading.value = true
  previewError.value = ''
  submitError.value = ''
  try {
    const data = await previewOfflineRefund(props.orderNo)
    preview.value = data
    activeStep.value = 0
    // 默认带出订单实付；已冲账 / 无贡献时不进表单，但仍填好以便复核
    form.offlineRefundAmount = Number(data.payAmount ?? 0)
  } catch (error) {
    preview.value = null
    previewError.value = error instanceof Error ? error.message : '线下退款冲账预演失败'
  } finally {
    previewLoading.value = false
  }
}

/** 打开弹窗：清空上次状态并立即预演。 */
watch(visible, (opened) => {
  if (opened) {
    resetState()
    void runPreview()
  }
})

/** 订单号变化（父页面切换订单）且弹窗开着时重新预演，避免展示上一单的清单。 */
watch(() => props.orderNo, () => {
  if (visible.value) {
    resetState()
    void runPreview()
  }
})

/** 进入表单段：先做前置校验（阻断项 / 已冲账 / 无贡献都不能提交）。 */
function goStep2(): void {
  const data = preview.value
  if (data?.executed) {
    ElMessage.warning('该订单已完成线下退款冲账')
    return
  }
  if (data?.branch === 'NO_CONTRIBUTION') {
    ElMessage.warning('该订单没有红包贡献，无需冲账')
    return
  }
  if (!canSubmit.value) {
    ElMessage.warning('存在阻断项，无法冲账')
    return
  }
  activeStep.value = 1
}

/** 提交前的二次确认链：勾选 → 订单号一致 → 金额一致（金额不一致时弹确认框）。 */
async function submit(): Promise<void> {
  const data = preview.value
  if (!data) return
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  if (!form.confirmed) {
    ElMessage.warning('请先勾选「我确认线下已实际退款」')
    return
  }
  if (!orderNoMatched.value) {
    ElMessage.warning(`手工输入的订单号与当前订单不一致，请核对后重新输入（应为 ${props.orderNo}）`)
    return
  }
  const amount = Number(form.offlineRefundAmount)
  if (!Number.isFinite(amount) || amount <= 0) {
    ElMessage.warning('线下退款金额必须大于 0')
    return
  }
  if (!amountMatched.value) {
    try {
      await ElMessageBox.confirm(
        `线下退款金额 ${amount.toFixed(2)} 元与订单实付金额 ${payAmount.value.toFixed(2)} 元不一致，属于部分退款/超额退款，请务必核对凭证后确认。`,
        '金额与订单实付不一致，请二次确认',
        { type: 'warning', confirmButtonText: '金额无误，继续冲账', cancelButtonText: '返回修改' },
      )
    } catch {
      return
    }
  }
  submitting.value = true
  submitError.value = ''
  try {
    const response = await commitOfflineRefund({
      orderNo: props.orderNo,
      reason: form.reason.trim(),
      voucherNo: form.voucherNo.trim(),
      offlineRefundAmount: amount,
      confirmToken: data.confirmToken,
    })
    result.value = response
    preview.value = response
    committed.value = true
    activeStep.value = 2
    ElMessage.success('线下退款冲账已完成')
    emit('success', response)
  } catch (error) {
    const message = error instanceof Error ? error.message : '线下退款冲账提交失败'
    // 令牌失效（10 分钟过期 / 账务变更）→ 明确文案 + **自动重新预演回到第一段**，不让用户卡在表单上
    if (isOfflineRefundTokenExpired(error)) {
      submitError.value = `预演已过期或账务已变更：${message}`
      ElMessage.warning('预演已过期，请重新预演')
      await runPreview()
      if (preview.value) form.offlineRefundAmount = Number(preview.value.payAmount ?? 0)
    } else {
      submitError.value = message
      ElMessage.error(message)
    }
  } finally {
    submitting.value = false
  }
}

/** 结果段：完成后关闭弹窗（父页面通过 `success` 事件刷新详情/列表）。 */
function finish(): void {
  visible.value = false
}
</script>

<template>
  <el-dialog v-model="visible" title="线下退款冲账" width="880px" append-to-body destroy-on-close>
    <el-steps :active="activeStep" finish-status="success" align-center class="refund-steps">
      <el-step title="预演核对" description="只读，不写库" />
      <el-step title="填写凭证" description="不可撤销" />
      <el-step title="冲账结果" description="对账与异常" />
    </el-steps>

    <!-- ===== 第一段：预演 ===== -->
    <el-skeleton v-if="previewLoading" :rows="8" animated />

    <el-alert
      v-else-if="previewError"
      type="error"
      :closable="false"
      show-icon
      class="block-gap"
      :title="`预演失败：${previewError}`"
      description="预演是只读接口，失败不会改动任何数据。可点「重新预演」重试，或关闭后联系后端确认接口状态。"
    />

    <template v-else-if="preview">
      <!-- 固定醒目提示：这一条任何时候都在最上面 -->
      <el-alert
        type="error"
        :closable="false"
        show-icon
        class="block-gap irreversible-alert"
        title="本操作不可撤销，仅用于「线下确已退款」的订单"
        description="冲账会作废红包贡献 / 槽位 / 推广金，冲减红包池计划额，并可能反向应急红包池与回收肽金。系统没有「撤销冲账」功能，请先与门店和凭证核对无误再提交。"
      />

      <!-- 已冲账：直接给出结论，隐藏表单 -->
      <el-alert
        v-if="preview.executed"
        type="success"
        :closable="false"
        show-icon
        class="block-gap"
        title="该订单已完成线下退款冲账"
        description="无需重复操作；重复冲账会被后端唯一键拒绝（幂等保护）。如需查看审计明细，请联系后端/运维查分红线下退款审计表。"
      />

      <!-- 无贡献：明确告知无需冲账 -->
      <el-alert
        v-else-if="preview.branch === 'NO_CONTRIBUTION'"
        type="info"
        :closable="false"
        show-icon
        class="block-gap"
        title="该订单没有红包贡献，无需冲账"
        description="后端判定该订单不存在红包贡献记录（可能未产生贡献或已被冲账），无需执行线下退款冲账。"
      />

      <el-descriptions :column="2" border size="small" class="block-gap">
        <el-descriptions-item label="订单号">{{ preview.orderNo || '—' }}</el-descriptions-item>
        <el-descriptions-item label="用户ID">{{ preview.userId || '—' }}</el-descriptions-item>
        <el-descriptions-item label="订单实付">¥ {{ money(preview.payAmount) }}</el-descriptions-item>
        <el-descriptions-item label="配送方式">{{ preview.pickupType === 1 ? '线下自提' : `其他（${preview.pickupType}）` }}</el-descriptions-item>
        <el-descriptions-item label="冲账分支">
          <el-tag :type="branchTag" effect="plain">{{ branchText }}</el-tag>
          <span class="branch-code">{{ preview.branch || '—' }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="是否已冲账">
          <el-tag :type="preview.executed ? 'success' : 'info'" effect="plain">{{ preview.executed ? '已冲账' : '未冲账' }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="分支说明" :span="2">{{ preview.branchDesc || '—' }}</el-descriptions-item>
      </el-descriptions>

      <!-- 阻断项：逐条展示并禁用提交 -->
      <el-alert
        v-if="preview.blockers.length"
        type="error"
        :closable="false"
        show-icon
        class="block-gap"
        title="存在阻断项，无法冲账"
        description="以下阻断项由后端预演返回，必须先行解决（例如该单已冲账、发放批次正在处理中）后才能提交。"
      >
        <ul class="plain-list danger-text">
          <li v-for="(item, index) in preview.blockers" :key="`blocker-${index}`">{{ item }}</li>
        </ul>
      </el-alert>

      <!-- 风险提示：原样红字，不折叠、不省略 -->
      <div v-if="preview.warnings.length" class="block-gap">
        <div class="section-title">风险提示（后端原文，请逐条阅读）</div>
        <ul class="plain-list danger-text">
          <li v-for="(item, index) in preview.warnings" :key="`warning-${index}`">{{ item }}</li>
        </ul>
      </div>

      <!-- 变更计划：哪张表、哪一行、哪个字段、从什么变成什么 -->
      <div class="block-gap">
        <div class="section-title">变更计划（共 {{ preview.plan.length }} 行）</div>
        <el-empty v-if="!preview.plan.length" :image-size="48" description="后端未返回变更计划（可能无需改动任何账务）" />
        <el-table v-else :data="preview.plan" border size="small" max-height="260">
          <el-table-column label="表" min-width="190">
            <template #default="{ row }"><span class="mono">{{ row.table || '—' }}</span></template>
          </el-table-column>
          <el-table-column label="行ID" width="100">
            <template #default="{ row }"><span class="mono">{{ row.id || '—' }}</span></template>
          </el-table-column>
          <el-table-column label="字段" min-width="150">
            <template #default="{ row }"><span class="mono">{{ row.field || '—' }}</span></template>
          </el-table-column>
          <el-table-column label="原值 → 新值" min-width="300">
            <template #default="{ row }">
              <!-- 值可能很长或是 JSON：单行省略 + tooltip 看全文（避免撑破弹窗） -->
              <el-tooltip placement="top-start" :show-after="200">
                <template #content>
                  <div class="tooltip-value">{{ formatPlanValue(row.from) }} → {{ formatPlanValue(row.to) }}</div>
                </template>
                <div class="plan-diff">
                  <span class="plan-from">{{ formatPlanValue(row.from) }}</span>
                  <span class="plan-arrow">→</span>
                  <span class="plan-to">{{ formatPlanValue(row.to) }}</span>
                </div>
              </el-tooltip>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 金额影响 -->
      <div class="block-gap">
        <div class="section-title">金额影响（元；负值 = 冲减）</div>
        <el-descriptions :column="3" border size="small">
          <el-descriptions-item v-for="item in moneyRows" :key="item.key" :label="item.label">
            <span :class="deltaClass(item.value)">{{ delta(item.value) }}</span>
          </el-descriptions-item>
        </el-descriptions>
        <el-alert
          v-if="!layerConsistent"
          type="warning"
          :closable="false"
          show-icon
          class="block-gap"
          title="金额一致性提示：红包池总额变化 ≠ 新用户层 + 老用户层"
          description="按后端口径，红包池总额冲减应等于新层 + 老层之和（只改总额会让 new + old ≠ total）。此处仅提示，不阻断提交；请把截图发给后端核对层额口径。"
        />
      </div>
    </template>

    <!-- ===== 第二段：表单 ===== -->
    <template v-if="activeStep === 1 && preview">
      <el-alert
        type="warning"
        :closable="false"
        show-icon
        class="block-gap"
        title="提交后立即生效、无法撤销，请核对凭证后再提交"
        description="订单号需手工重输一次做二次确认；金额与订单实付不一致时会再弹一次确认框。"
      />
      <el-alert
        v-if="submitError"
        type="error"
        :closable="false"
        show-icon
        class="block-gap"
        :title="submitError"
      />
      <el-form ref="formRef" :model="form" :rules="rules" label-width="130px" class="refund-form">
        <el-form-item label="订单号">
          <span class="mono strong">{{ preview.orderNo }}</span>
          <span class="muted">实付 ¥ {{ money(preview.payAmount) }}</span>
        </el-form-item>
        <el-form-item label="退款原因" prop="reason">
          <el-input v-model="form.reason" type="textarea" :rows="3" maxlength="200" show-word-limit placeholder="例如：门店线下已全额退款，客户未提货" />
        </el-form-item>
        <el-form-item label="线下退款凭证号" prop="voucherNo">
          <el-input v-model="form.voucherNo" maxlength="64" placeholder="例如微信/支付宝转账单号 WX20260920142300" />
        </el-form-item>
        <el-form-item label="线下退款金额" prop="offlineRefundAmount">
          <el-input-number v-model="form.offlineRefundAmount" :min="0.01" :precision="2" :step="0.01" controls-position="right" style="width: 220px" />
          <span v-if="!amountMatched" class="amount-mismatch">与订单实付 ¥ {{ money(preview.payAmount) }} 不一致，提交时会再弹一次确认</span>
        </el-form-item>
        <el-form-item label="退款确认">
          <el-checkbox v-model="form.confirmed">我确认线下已实际退款</el-checkbox>
        </el-form-item>
        <el-form-item label="二次确认订单号">
          <el-input v-model="form.confirmOrderNo" placeholder="请手工输入上方订单号" style="width: 320px" />
          <span v-if="form.confirmOrderNo && !orderNoMatched" class="amount-mismatch">与当前订单号不一致</span>
        </el-form-item>
      </el-form>
    </template>

    <!-- ===== 第三段：结果 ===== -->
    <template v-if="activeStep === 2 && result">
      <el-alert
        type="success"
        :closable="false"
        show-icon
        class="block-gap"
        title="线下退款冲账已完成（单事务提交，账务已冲平）"
        :description="`订单 ${result.orderNo}：红包贡献/槽位/推广金已作废，红包池计划额已按分支口径冲减。`"
      />

      <!-- 异常项：只在结果里提示（列表/详情标记缺后端字段，本次不做） -->
      <el-alert
        v-if="hasException"
        type="error"
        :closable="false"
        show-icon
        class="block-gap exception-alert"
        title="存在待人工跟进的异常项"
        description="冲账本身已完成，但下述提示说明有钱款需要人工处理（如推广金已入账但余额不足、肽金已发放但余额不足、应急池反向失败）。后端异常明细写在审计台账里，请按提示人工核对。"
      >
        <ul class="plain-list danger-text">
          <li v-for="(item, index) in result.warnings" :key="`result-warning-${index}`">{{ item }}</li>
        </ul>
      </el-alert>

      <div v-if="result.warnings.length" class="block-gap">
        <div class="section-title">后端返回的提示（原文）</div>
        <ul class="plain-list danger-text">
          <li v-for="(item, index) in result.warnings" :key="`result-warning-2-${index}`">{{ item }}</li>
        </ul>
      </div>

      <div class="block-gap">
        <div class="section-title">对账块（冲账后实时口径）</div>
        <el-empty v-if="!reconcileRows.length" :image-size="48" description="后端未返回对账块（reconcile）" />
        <el-descriptions v-else :column="3" border size="small">
          <el-descriptions-item v-for="item in reconcileRows" :key="item.key" :label="item.label">
            <span :class="{ mono: item.count }">{{ item.count ? item.value : money(item.value) }}</span>
          </el-descriptions-item>
        </el-descriptions>
        <el-alert
          v-if="reconcileRows.length && !reconcileLayerConsistent"
          type="warning"
          :closable="false"
          show-icon
          class="block-gap"
          title="对账提示：池总额 ≠ 新用户层 + 老用户层"
          description="后端已做层额按原比例同步，若此处不等，请把本页截图发给后端复核层额口径。"
        />
      </div>
    </template>

    <template #footer>
      <template v-if="activeStep === 0">
        <el-button @click="visible = false">关闭</el-button>
        <el-button :loading="previewLoading" @click="runPreview">重新预演</el-button>
        <el-button
          v-if="preview && canSubmit"
          type="danger"
          @click="goStep2"
        >下一步：填写退款凭证</el-button>
        <!-- 不能提交时给出**具体原因**，避免财务看到灰按钮不知道卡在哪 -->
        <el-button v-else-if="preview && !preview.executed && preview.branch !== 'NO_CONTRIBUTION'" type="danger" disabled>存在阻断项，无法冲账</el-button>
        <el-button v-else-if="preview && preview.executed" disabled>该订单已冲账</el-button>
        <el-button v-else-if="preview" disabled>无需冲账</el-button>
      </template>
      <template v-else-if="activeStep === 1">
        <el-button :disabled="submitting" @click="activeStep = 0">返回预演</el-button>
        <el-button type="danger" :loading="submitting" :disabled="!form.confirmed || !orderNoMatched" @click="submit">确认冲账（不可撤销）</el-button>
      </template>
      <template v-else>
        <el-button type="primary" @click="finish">{{ committed ? '完成并刷新订单详情' : '关闭' }}</el-button>
      </template>
    </template>
  </el-dialog>
</template>

<style scoped>
.refund-steps { margin-bottom: 16px; }
.block-gap { margin-top: 12px; }
/* 顶部不可撤销提示：加粗描边，财务一眼能看到 */
.irreversible-alert { margin-top: 0; border-width: 2px; }
.exception-alert { border-width: 2px; }
.section-title { margin-bottom: 6px; color: var(--el-text-color-primary); font-size: 13px; font-weight: 600; }
.plain-list { margin: 6px 0 0; padding-left: 18px; }
.plain-list li { margin-bottom: 4px; line-height: 20px; }
.danger-text { color: var(--el-color-danger); }
.branch-code { margin-left: 8px; color: var(--el-text-color-secondary); font-size: 12px; }
.mono { font-family: Consolas, Monaco, monospace; }
.strong { font-weight: 600; }
.muted { margin-left: 10px; color: var(--el-text-color-secondary); font-size: 12px; }
/* 变更计划：单行省略 + tooltip 看全文 */
.plan-diff { display: flex; align-items: center; gap: 6px; min-width: 0; }
.plan-from { overflow: hidden; color: var(--el-text-color-regular); text-overflow: ellipsis; white-space: nowrap; }
.plan-arrow { color: var(--el-text-color-secondary); flex-shrink: 0; }
.plan-to { overflow: hidden; color: var(--el-color-primary); font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.tooltip-value { max-width: 420px; font-family: Consolas, Monaco, monospace; font-size: 12px; line-height: 18px; word-break: break-all; }
/* 金额影响配色：负值红、正值绿、0 灰 */
.delta-negative { color: var(--el-color-danger); font-weight: 600; }
.delta-positive { color: var(--el-color-success); font-weight: 600; }
.delta-zero { color: var(--el-text-color-secondary); }
.refund-form { margin-top: 4px; }
.amount-mismatch { margin-left: 10px; color: var(--el-color-danger); font-size: 12px; }
</style>
