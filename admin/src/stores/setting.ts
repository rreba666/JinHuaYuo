import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getCustomerServiceConfig, getDividendCap, getProfitRatesConfig, saveCustomerServiceConfig, saveDividendCap, saveProfitRatesConfig as postProfitRatesConfig } from '@/api/setting'
import { setFundRates } from '@/utils/productPricing'
import type { DividendCap, DividendCapSaveDTO, ProfitRatesConfig, ProfitRatesSaveDTO, SysConfig, SysConfigSaveDTO } from '@/types/setting'

export const useSettingStore = defineStore('setting', () => {
  const customerService = ref<SysConfig | null>(null)
  const dividendCap = ref<DividendCap>({ multiplier: 1.5, remark: '' })
  const profitRates = ref<ProfitRatesConfig>({ promotionRate: 0.2, bonusPoolRate: 0.26, remark: '' })
  const customerServiceLoading = ref(false)
  const dividendCapLoading = ref(false)
  const profitRatesLoading = ref(false)
  const customerServiceSaving = ref(false)
  const dividendCapSaving = ref(false)
  const profitRatesSaving = ref(false)

  /** 独立读取客服电话，避免倍率请求阻塞客服电话区域。 */
  async function loadCustomerService(): Promise<void> {
    customerServiceLoading.value = true
    try {
      customerService.value = await getCustomerServiceConfig()
    } finally {
      customerServiceLoading.value = false
    }
  }

  /** 独立读取分红倍率，未配置时由 API 提供默认值。 */
  async function loadDividendCap(): Promise<void> {
    dividendCapLoading.value = true
    try {
      dividendCap.value = await getDividendCap()
    } finally {
      dividendCapLoading.value = false
    }
  }

  /** 读取商品资金比例并同步到金额默认值工具。 */
  async function loadProfitRates(): Promise<void> {
    profitRatesLoading.value = true
    try {
      profitRates.value = await getProfitRatesConfig()
      setFundRates({ promotionRate: profitRates.value.promotionRate, dividendRate: profitRates.value.bonusPoolRate })
    } finally {
      profitRatesLoading.value = false
    }
  }

  /** 保存后只刷新客服电话配置本身。 */
  async function saveCustomerService(payload: SysConfigSaveDTO): Promise<void> {
    customerServiceSaving.value = true
    try {
      await saveCustomerServiceConfig(payload)
      await loadCustomerService()
    } finally {
      customerServiceSaving.value = false
    }
  }

  /** 保存后只刷新分红倍率配置本身。 */
  async function saveDividendCapConfig(payload: DividendCapSaveDTO): Promise<void> {
    dividendCapSaving.value = true
    try {
      await saveDividendCap(payload)
      await loadDividendCap()
    } finally {
      dividendCapSaving.value = false
    }
  }

  async function saveProfitRatesConfig(payload: ProfitRatesSaveDTO): Promise<void> {
    profitRatesSaving.value = true
    try {
      await postProfitRatesConfig(payload)
      await loadProfitRates()
    } finally {
      profitRatesSaving.value = false
    }
  }

  return {
    customerService,
    dividendCap,
    profitRates,
    customerServiceLoading,
    dividendCapLoading,
    profitRatesLoading,
    customerServiceSaving,
    dividendCapSaving,
    profitRatesSaving,
    loadCustomerService,
    loadDividendCap,
    loadProfitRates,
    saveCustomerService,
    saveDividendCapConfig,
    saveProfitRatesConfig,
  }
})
