import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import { adjustDaily, adjustPool, confirmPool, getBonusDetails, getBonusPools, getDividendLimits, getPendingPromotion, getPromotionRelations, getUnsettledDailyDetails, rebindPromotionRelation, resetDividendLimit, settleProfit, unbindPromotionRelation } from '@/api/profit'
import type { ProfitAdjustDailyDTO, ProfitAdjustPoolDTO, PromotionBinding, PromotionBindingSource, SevenDayBonusDetail, SevenDayBonusPool, UserDividendLimit } from '@/types/profit'

export const useProfitStore = defineStore('profit', () => {
  const pendingPromotion = ref<import('@/types/profit').PendingPromotionRecord[]>([])
  const pendingTotal = ref(0)
  const pendingPage = ref(1)
  const pendingSize = ref(20)
  const relations = ref<PromotionBinding[]>([])
  const relationTotal = ref(0)
  const relationPage = ref(1)
  const relationSize = ref(20)
  const relationLoading = ref(false)
  const relationActionLoading = ref(false)
  const relationFilters = reactive<{ keyword: string; source: PromotionBindingSource | '' }>({ keyword: '', source: '' })
  const sevenDayPools = ref<SevenDayBonusPool[]>([])
  const poolDetails = ref<SevenDayBonusDetail[]>([])
  const unsettledDaily = ref<SevenDayBonusDetail[]>([])
  const dividendLimits = ref<UserDividendLimit[]>([])
  const loading = ref(false)
  const actionLoading = ref(false)

  /** 加载推广金、奖池和用户额度数据。 */
  async function fetchAll(): Promise<void> {
    loading.value = true
    try {
      const [pending, pools, daily, limits] = await Promise.all([getPendingPromotion({ page: pendingPage.value, size: pendingSize.value }), getBonusPools(), getUnsettledDailyDetails(), getDividendLimits()])
      pendingPromotion.value = pending.list
      pendingTotal.value = pending.total
      sevenDayPools.value = pools
      unsettledDaily.value = daily
      dividendLimits.value = limits
    } finally { loading.value = false }
  }

  async function fetchRelations(): Promise<void> {
    relationLoading.value = true
    try {
      const result = await getPromotionRelations({ keyword: relationFilters.keyword || undefined, source: relationFilters.source || undefined, page: relationPage.value, size: relationSize.value })
      relations.value = result.list
      relationTotal.value = result.total
    } finally { relationLoading.value = false }
  }

  async function fetchPoolDetails(poolId: string): Promise<void> { poolDetails.value = await getBonusDetails(poolId) }
  async function runAction(action: () => Promise<void>): Promise<void> { actionLoading.value = true; try { await action(); await fetchAll() } finally { actionLoading.value = false } }
  async function rebindRelation(buyerUserId: string, promoterId: string): Promise<void> { relationActionLoading.value = true; try { await rebindPromotionRelation(buyerUserId, promoterId); await fetchRelations() } finally { relationActionLoading.value = false } }
  async function unbindRelation(buyerUserId: string): Promise<void> {
    relationActionLoading.value = true
    try {
      await unbindPromotionRelation(buyerUserId)
      await fetchRelations()
      if (!relations.value.length && relationPage.value > 1) { relationPage.value -= 1; await fetchRelations() }
    } finally { relationActionLoading.value = false }
  }
  async function settle(startDate: string, endDate: string): Promise<void> { await runAction(() => settleProfit(startDate, endDate)) }
  async function confirm(poolId: string): Promise<void> { await runAction(() => confirmPool(poolId)) }
  async function adjust(poolId: string, payload: ProfitAdjustPoolDTO): Promise<void> { await runAction(() => adjustPool(poolId, payload)) }
  async function adjustDetail(detailId: string, payload: ProfitAdjustDailyDTO): Promise<void> { await runAction(() => adjustDaily(detailId, payload)) }
  async function resetLimit(userId: string): Promise<void> { await runAction(() => resetDividendLimit(userId)) }

  return { pendingPromotion, pendingTotal, pendingPage, pendingSize, relations, relationTotal, relationPage, relationSize, relationLoading, relationActionLoading, relationFilters, sevenDayPools, poolDetails, unsettledDaily, dividendLimits, loading, actionLoading, fetchAll, fetchRelations, fetchPoolDetails, rebindRelation, unbindRelation, settle, confirm, adjust, adjustDetail, resetLimit }
})
