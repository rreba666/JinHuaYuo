<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { useSettingStore } from '@/stores/setting'
import type { DividendCapSaveDTO, ProfitRatesSaveDTO, SysConfigSaveDTO } from '@/types/setting'
import { fromDisplayFundRate, toDisplayFundRate } from '@/utils/fundRate'

const store = useSettingStore()
const customerServiceFormRef = ref<FormInstance>()
const dividendCapFormRef = ref<FormInstance>()
const profitRatesFormRef = ref<FormInstance>()
const customerServiceForm = reactive<SysConfigSaveDTO>({
  configKey: 'customer_service_phone',
  configValue: '',
  remark: '',
})
const dividendCapForm = reactive<DividendCapSaveDTO>({ multiplier: 1.5, remark: '' })
const profitRatesForm = reactive<ProfitRatesSaveDTO>({ promotionRate: 20, bonusPoolRate: 26, remark: '' })

const customerServiceRules: FormRules = {
  configValue: [{ required: true, message: '请输入客服电话', trigger: 'blur' }],
}
const dividendCapRules: FormRules = {
  multiplier: [
    { required: true, message: '请输入分红上限倍率', trigger: 'blur' },
    { type: 'number', min: 0.01, max: 100, message: '倍率范围为 0.01~100', trigger: 'change' },
  ],
}
const profitRatesRules: FormRules = {
  promotionRate: [
    { required: true, message: '请输入比例', trigger: 'blur' },
    { type: 'number', min: 0, max: 100, message: '比例范围为 0~100', trigger: 'change' },
  ],
  bonusPoolRate: [
    { required: true, message: '请输入比例', trigger: 'blur' },
    { type: 'number', min: 0, max: 100, message: '比例范围为 0~100', trigger: 'change' },
  ],
}

function showError(error: unknown, fallback: string): void {
  ElMessage.error(error instanceof Error ? error.message : fallback)
}

async function loadCustomerService(): Promise<void> {
  try {
    await store.loadCustomerService()
    customerServiceForm.configValue = store.customerService?.configValue || ''
    customerServiceForm.remark = store.customerService?.remark || ''
  } catch (error) {
    showError(error, '客服电话配置加载失败')
  }
}

async function loadDividendCap(): Promise<void> {
  try {
    await store.loadDividendCap()
    dividendCapForm.multiplier = store.dividendCap.multiplier
    dividendCapForm.remark = store.dividendCap.remark
  } catch (error) {
    showError(error, '分红上限倍率加载失败')
  }
}

async function loadProfitRates(): Promise<void> {
  try {
    await store.loadProfitRates()
    profitRatesForm.promotionRate = toDisplayFundRate(store.profitRates.promotionRate)
    profitRatesForm.bonusPoolRate = toDisplayFundRate(store.profitRates.bonusPoolRate)
    profitRatesForm.remark = store.profitRates.remark
  } catch (error) {
    showError(error, '商品资金比例加载失败')
  }
}

async function saveCustomerService(): Promise<void> {
  if (!(await customerServiceFormRef.value?.validate().catch(() => false))) return
  try {
    await ElMessageBox.confirm('保存客服电话配置吗？', '保存确认', { type: 'warning' })
    await store.saveCustomerService({ ...customerServiceForm, configKey: 'customer_service_phone' })
    ElMessage.success('客服电话配置已保存')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') showError(error, '客服电话配置保存失败')
  }
}

async function saveDividendCap(): Promise<void> {
  if (!(await dividendCapFormRef.value?.validate().catch(() => false))) return
  try {
    await ElMessageBox.confirm('保存分红上限倍率后，仅影响之后新开的槽位，确认继续吗？', '保存确认', { type: 'warning' })
    await store.saveDividendCapConfig({ ...dividendCapForm })
    ElMessage.success('分红上限倍率已保存')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') showError(error, '分红上限倍率保存失败')
  }
}

async function saveProfitRates(): Promise<void> {
  if (!(await profitRatesFormRef.value?.validate().catch(() => false))) return
  try {
    await ElMessageBox.confirm('保存商品资金比例后，会同步影响所有仍在使用默认值的商品，确认继续吗？', '保存确认', { type: 'warning' })
    await store.saveProfitRatesConfig({
      promotionRate: fromDisplayFundRate(profitRatesForm.promotionRate),
      bonusPoolRate: fromDisplayFundRate(profitRatesForm.bonusPoolRate),
      remark: profitRatesForm.remark,
    })
    ElMessage.success('商品资金比例已保存')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') showError(error, '商品资金比例保存失败')
  }
}

function reload(): void {
  void loadCustomerService()
  void loadDividendCap()
  void loadProfitRates()
}

onMounted(reload)
</script>

<template>
  <section class="page-container page-enter">
    <div class="page-heading">
      <div><h1>系统设置</h1><p>管理客服电话和分红业务参数。</p></div>
      <el-button :icon="Refresh" :loading="store.customerServiceLoading || store.dividendCapLoading || store.profitRatesLoading" @click="reload">刷新</el-button>
    </div>

    <div class="settings-grid">
      <section class="content-card setting-section">
        <div class="setting-heading"><div><h2>客服电话</h2><p>用于用户咨询和后台联系。</p></div></div>
        <el-form ref="customerServiceFormRef" :model="customerServiceForm" :rules="customerServiceRules" label-width="90px" @submit.prevent="saveCustomerService">
          <el-form-item label="客服电话" prop="configValue"><el-input v-model="customerServiceForm.configValue" placeholder="请输入客服电话" clearable /></el-form-item>
          <el-form-item label="备注"><el-input v-model="customerServiceForm.remark" placeholder="可选" clearable /></el-form-item>
          <el-form-item><el-button type="primary" :loading="store.customerServiceSaving" @click="saveCustomerService">保存客服电话</el-button></el-form-item>
        </el-form>
      </section>

      <section class="content-card setting-section">
        <div class="setting-heading"><div><h2>分红上限倍率</h2><p>设置新槽位使用的分红额度倍率。</p></div></div>
        <el-alert title="仅影响之后新开的槽位" type="warning" :closable="false" show-icon />
        <el-form ref="dividendCapFormRef" :model="dividendCapForm" :rules="dividendCapRules" label-width="90px" @submit.prevent="saveDividendCap">
          <el-form-item label="倍率" prop="multiplier"><el-input-number v-model="dividendCapForm.multiplier" :min="0.01" :max="100" :precision="2" :step="0.01" controls-position="right" /></el-form-item>
          <el-form-item label="备注"><el-input v-model="dividendCapForm.remark" placeholder="可选" clearable /></el-form-item>
          <el-form-item><el-button type="primary" :loading="store.dividendCapSaving" @click="saveDividendCap">保存倍率</el-button></el-form-item>
        </el-form>
      </section>

      <section class="content-card setting-section fund-rate-section">
        <div class="setting-heading"><div><h2>商品资金默认比例</h2><p>商品未单独设置金额时，按最低 SKU 价格计算默认资金。</p></div></div>
        <el-alert title="影响所有默认值商品" description="前端按百分比输入，保存时自动换算为后端小数。商品未手动填写金额时会读取这里的默认比例，保存后会同步影响所有仍在使用默认值的商品。" type="info" :closable="false" show-icon />
        <el-form ref="profitRatesFormRef" class="profit-rates-form" :model="profitRatesForm" :rules="profitRatesRules" label-width="110px" @submit.prevent="saveProfitRates">
          <el-form-item label="推广资金比例" prop="promotionRate">
            <div class="rate-control">
              <el-input-number v-model="profitRatesForm.promotionRate" :min="0" :max="100" :precision="2" :step="0.1" controls-position="right" class="rate-input" />
              <span class="rate-suffix">%</span>
            </div>
          </el-form-item>
          <el-form-item label="分红奖池比例" prop="bonusPoolRate">
            <div class="rate-control">
              <el-input-number v-model="profitRatesForm.bonusPoolRate" :min="0" :max="100" :precision="2" :step="0.1" controls-position="right" class="rate-input" />
              <span class="rate-suffix">%</span>
            </div>
          </el-form-item>
          <el-form-item label="备注" class="remark-item">
            <el-input v-model="profitRatesForm.remark" class="rate-remark-input" placeholder="可选" clearable maxlength="40" show-word-limit />
          </el-form-item>
          <el-form-item class="form-item-full">
            <el-button type="primary" :loading="store.profitRatesSaving" @click="saveProfitRates">保存商品资金比例</el-button>
          </el-form-item>
        </el-form>
      </section>
    </div>
  </section>
</template>

<style scoped>
.settings-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.setting-section { margin-bottom: 0; padding: 20px; }
.setting-heading { margin-bottom: 20px; }
.setting-heading h2 { margin: 0 0 6px; color: var(--vben-text); font-size: 17px; }
.setting-heading p { margin: 0; color: var(--vben-muted); font-size: 13px; }
.setting-section :deep(.el-alert) { margin-bottom: 20px; }
.fund-rate-section { grid-column: 1 / -1; }
.profit-rates-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 20px;
  align-items: start;
}
.profit-rates-form :deep(.el-form-item) { min-width: 0; }
.profit-rates-form :deep(.el-form-item__content) { min-width: 0; }
.rate-control {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.rate-input { width: 150px; }
.rate-remark-input { width: min(100%, 280px); }
.remark-item { grid-column: 1 / -1; }
.form-item-full { grid-column: 1 / -1; }
.rate-suffix { color: var(--vben-muted); min-width: 18px; }
@media (max-width: 760px) {
  .settings-grid,
  .profit-rates-form { grid-template-columns: 1fr; }
  .remark-item,
  .form-item-full { grid-column: auto; }
  .rate-input,
  .rate-remark-input { width: 100%; max-width: none; }
}
</style>
