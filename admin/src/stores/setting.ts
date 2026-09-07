import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getCustomerServiceConfig, getDividendCap, getProfitRatesConfig, getRandomDividendConfig, getRandomFloatConfig, getSlotCountConfig, getWithdrawRules, saveCustomerServiceConfig, saveDividendCap, saveProfitRatesConfig as postProfitRatesConfig, saveRandomDividendConfig, saveRandomFloatConfig, saveSlotCountConfig, saveWithdrawRules } from '@/api/setting'
import { setFundRates } from '@/utils/productPricing'
import type { DividendCap, DividendCapSaveDTO, ProfitRatesConfig, ProfitRatesSaveDTO, RandomDividendConfig, RandomFloatConfig, SlotCountConfig, SysConfig, SysConfigSaveDTO, WithdrawRulesConfig, WithdrawRulesSaveDTO } from '@/types/setting'

export const useSettingStore = defineStore('setting', () => {
  const customerService = ref<SysConfig | null>(null)
  const dividendCap = ref<DividendCap>({ multiplier: 1.5, remark: '' })
  const randomDividend = ref<RandomDividendConfig>({ minAmount: 10, maxAmount: 50, remark: '' })
  const randomFloat = ref<RandomFloatConfig>({ floatAmount: 10, remark: '' })
  const slotCount = ref<SlotCountConfig>({ slotCount: 3, remark: '' })
  const profitRates = ref<ProfitRatesConfig>({ promotionRate: 0.2, bonusPoolRate: 0.26, remark: '' })
  const withdrawRules = ref<WithdrawRulesConfig>({ minAmount: 0, dailyAmountLimit: 0, dailyCountLimit: 0, feeRate: 0, testUserMinAmount: 0, testUserId: null, testSkipLock: false, maxConcurrent: 0, frozenLimit: 0, remark: '' })
  const customerServiceLoading = ref(false)
  const dividendCapLoading = ref(false)
  const randomDividendLoading = ref(false)
  const randomFloatLoading = ref(false)
  const slotCountLoading = ref(false)
  const profitRatesLoading = ref(false)
  const withdrawRulesLoading = ref(false)
  const customerServiceSaving = ref(false)
  const dividendCapSaving = ref(false)
  const randomDividendSaving = ref(false)
  const randomFloatSaving = ref(false)
  const slotCountSaving = ref(false)
  const profitRatesSaving = ref(false)
  const withdrawRulesSaving = ref(false)

  /** 独立读取客服电话，避免倍率请求阻塞客服电话区域。 */
  async function loadCustomerService(): Promise<void> {
    customerServiceLoading.value = true
    try {
      customerService.value = await getCustomerServiceConfig()
    } finally {
      customerServiceLoading.value = false
    }
  }

  /** 独立读取红包倍率，未配置时由 API 提供默认值。 */
  async function loadDividendCap(): Promise<void> {
    dividendCapLoading.value = true
    try {
      dividendCap.value = await getDividendCap()
    } finally {
      dividendCapLoading.value = false
    }
  }

  /** 读取每日随机红包配置（下限/上限，元）。 */
  async function loadRandomDividend(): Promise<void> {
    randomDividendLoading.value = true
    try {
      randomDividend.value = await getRandomDividendConfig()
    } finally {
      randomDividendLoading.value = false
    }
  }

  /** 保存每日随机红包配置。 */
  async function saveRandomDividend(payload: { minAmount: number; maxAmount: number; remark?: string }): Promise<void> {
    randomDividendSaving.value = true
    try {
      await saveRandomDividendConfig(payload)
      await loadRandomDividend()
    } finally {
      randomDividendSaving.value = false
    }
  }

  /** 读取分红随机浮动幅度配置（池2起：每人金额 = 均分基准 ± 浮动，元）。 */
  async function loadRandomFloat(): Promise<void> {
    randomFloatLoading.value = true
    try {
      randomFloat.value = await getRandomFloatConfig()
    } finally {
      randomFloatLoading.value = false
    }
  }

  /** 保存分红随机浮动幅度配置。 */
  async function saveRandomFloat(payload: { floatAmount: number; remark?: string }): Promise<void> {
    randomFloatSaving.value = true
    try {
      await saveRandomFloatConfig(payload)
      await loadRandomFloat()
    } finally {
      randomFloatSaving.value = false
    }
  }

  /** 读取分红槽位数量上限配置（每用户最多活跃槽位数，默认 3）。 */
  async function loadSlotCount(): Promise<void> {
    slotCountLoading.value = true
    try {
      slotCount.value = await getSlotCountConfig()
    } finally {
      slotCountLoading.value = false
    }
  }

  /** 保存分红槽位数量上限配置。 */
  async function saveSlotCount(payload: { slotCount: number; remark?: string }): Promise<void> {
    slotCountSaving.value = true
    try {
      await saveSlotCountConfig(payload)
      await loadSlotCount()
    } finally {
      slotCountSaving.value = false
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

  async function loadWithdrawRules(): Promise<void> {
    withdrawRulesLoading.value = true
    try {
      withdrawRules.value = await getWithdrawRules()
    } finally {
      withdrawRulesLoading.value = false
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

  /** 保存后只刷新红包倍率配置本身。 */
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

  async function saveWithdrawRulesConfig(payload: WithdrawRulesSaveDTO): Promise<void> {
    withdrawRulesSaving.value = true
    try {
      await saveWithdrawRules(payload)
      await loadWithdrawRules()
    } finally {
      withdrawRulesSaving.value = false
    }
  }

  return {
    customerService,
    dividendCap,
    randomDividend,
    randomFloat,
    slotCount,
    profitRates,
    withdrawRules,
    customerServiceLoading,
    dividendCapLoading,
    randomDividendLoading,
    randomFloatLoading,
    slotCountLoading,
    profitRatesLoading,
    withdrawRulesLoading,
    customerServiceSaving,
    dividendCapSaving,
    randomDividendSaving,
    randomFloatSaving,
    slotCountSaving,
    profitRatesSaving,
    withdrawRulesSaving,
    loadCustomerService,
    loadDividendCap,
    loadRandomDividend,
    loadRandomFloat,
    loadSlotCount,
    loadProfitRates,
    loadWithdrawRules,
    saveCustomerService,
    saveDividendCapConfig,
    saveRandomDividend,
    saveRandomFloat,
    saveSlotCount,
    saveProfitRatesConfig,
    saveWithdrawRulesConfig,
  }
})
