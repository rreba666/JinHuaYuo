import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import { adjustDaily, adjustPool, confirmPool, createPromotionRelation, getAdminDividendSlots, getBonusDetails, getBonusPools, getDailyUsers, getDividendLimits, getPendingPromotion, getProfitContributions, getPromotionLeaderboard, getPromotionRelations, getUnsettledDailyDetails, getSettledDailyDetails, injectBonusPool, rebindPromotionRelation, settleProfit, unbindPromotionRelation } from '@/api/profit'
import type { AdminDividendSlot, BonusInjectDTO, DailyContributionUser, DividendContribution, LeaderboardPeriod, ProfitAdjustDailyDTO, ProfitAdjustPoolDTO, ProfitLeaderboard, PromotionBinding, PromotionBindingSource, SevenDayBonusDetail, SevenDayBonusPool, UserDividendLimit } from '@/types/profit'

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
  const settledDaily = ref<SevenDayBonusDetail[]>([])
  const dividendLimits = ref<UserDividendLimit[]>([])
  const adminSlots = ref<AdminDividendSlot[]>([])
  const dailyUsers = ref<DailyContributionUser[]>([])
  const contributions = ref<DividendContribution[]>([])
  const contributionTotal = ref(0)
  const contributionPage = ref(1)
  const contributionSize = ref(50)
  const contributionStatus = ref('PENDING')
  const contributionLoading = ref(false)
  const loading = ref(false)
  const actionLoading = ref(false)
  /** 推广排行榜（B 端）：数据快照 / 当前周期 / 加载态。 */
  const leaderboard = ref<ProfitLeaderboard | null>(null)
  const leaderboardPeriod = ref<LeaderboardPeriod>('WEEK')
  const leaderboardLoading = ref(false)

  /** 加载推广金、红包和用户额度数据。 */
  async function fetchAll(): Promise<void> {
    loading.value = true
    try {
      const [pending, pools, daily, limits, settled] = await Promise.all([getPendingPromotion({ page: pendingPage.value, size: pendingSize.value }), getBonusPools(), getUnsettledDailyDetails(), getDividendLimits(), getSettledDailyDetails()])
      pendingPromotion.value = pending.list
      pendingTotal.value = pending.total
      sevenDayPools.value = pools
      unsettledDaily.value = daily
      settledDaily.value = settled
      dividendLimits.value = limits
    } finally { loading.value = false }
  }

  /** 仅加载待推广金列表（推广模块使用，避免附带拉取红包数据）。 */
  async function fetchPendingPromotion(): Promise<void> {
    loading.value = true
    try {
      const pending = await getPendingPromotion({ page: pendingPage.value, size: pendingSize.value })
      pendingPromotion.value = pending.list
      pendingTotal.value = pending.total
    } finally { loading.value = false }
  }

  /** 加载红包模块数据（红包池 / 每日明细 / 用户购买机会 / 红包槽位，不含推广金）。 */
  async function fetchRedPacketData(): Promise<void> {
    loading.value = true
    try {
      const [pools, daily, limits, settled] = await Promise.all([getBonusPools(), getUnsettledDailyDetails(), getDividendLimits(), getSettledDailyDetails()])
      sevenDayPools.value = pools
      unsettledDaily.value = daily
      dividendLimits.value = limits
      settledDaily.value = settled
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

  /**
   * 加载推广排行榜（B 端）。与 C 端同源同口径，但不返回「我的排名」（管理员不是推广员）；
   * 滚动口径下周期含尚未走完的当前周期，页面须展示 `asOf` 作为数据上界。
   */
  async function fetchLeaderboard(): Promise<void> {
    leaderboardLoading.value = true
    try {
      leaderboard.value = await getPromotionLeaderboard(leaderboardPeriod.value)
    } finally { leaderboardLoading.value = false }
  }

  async function fetchContributions(): Promise<void> {
    contributionLoading.value = true
    try {
      const result = await getProfitContributions({ status: contributionStatus.value || undefined, page: contributionPage.value, size: contributionSize.value })
      contributions.value = result.list
      contributionTotal.value = result.total
    } finally { contributionLoading.value = false }
  }

  async function fetchPoolDetails(poolId: string): Promise<void> { poolDetails.value = await getBonusDetails(poolId) }
  async function runAction(action: () => Promise<void>): Promise<void> { actionLoading.value = true; try { await action(); await fetchAll() } finally { actionLoading.value = false } }
  /** 后台「直接绑定」：给尚未绑定推广关系的买家指定推广员（成功后刷新列表）。 */
  async function createRelation(buyerUserId: string, promoterId: string): Promise<void> { relationActionLoading.value = true; try { await createPromotionRelation(buyerUserId, promoterId); await fetchRelations() } finally { relationActionLoading.value = false } }
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
  async function inject(payload: BonusInjectDTO): Promise<void> { await runAction(() => injectBonusPool(payload)) }
  async function confirm(poolId: string): Promise<void> { await runAction(() => confirmPool(poolId)) }
  async function adjust(poolId: string, payload: ProfitAdjustPoolDTO): Promise<void> { await runAction(() => adjustPool(poolId, payload)) }
  async function adjustDetail(detailId: string, payload: ProfitAdjustDailyDTO): Promise<void> { await runAction(() => adjustDaily(detailId, payload)) }

  /** 查询后台「用户红包资格」槽位（按 userId 过滤，留空查全部；只读）。 */
  async function fetchAdminSlots(userId?: string): Promise<void> {
    loading.value = true
    try {
      adminSlots.value = await getAdminDividendSlots(userId)
    } finally {
      loading.value = false
    }
  }

  /** 查询某支付日的累计用户贡献明细。 */
  async function fetchDailyUsers(asOfDate: string): Promise<void> {
    loading.value = true
    try {
      dailyUsers.value = await getDailyUsers(asOfDate)
    } finally {
      loading.value = false
    }
  }

  return { pendingPromotion, pendingTotal, pendingPage, pendingSize, relations, relationTotal, relationPage, relationSize, relationLoading, relationActionLoading, relationFilters, sevenDayPools, poolDetails, unsettledDaily, settledDaily, dividendLimits, adminSlots, dailyUsers, contributions, contributionTotal, contributionPage, contributionSize, contributionStatus, contributionLoading, loading, actionLoading, leaderboard, leaderboardPeriod, leaderboardLoading, fetchAll, fetchPendingPromotion, fetchRedPacketData, fetchRelations, fetchLeaderboard, fetchContributions, fetchPoolDetails, fetchAdminSlots, fetchDailyUsers, rebindRelation, createRelation, unbindRelation, inject, settle, confirm, adjust, adjustDetail }
})
