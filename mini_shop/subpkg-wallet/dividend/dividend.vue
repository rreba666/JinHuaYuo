<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { onLoad, onShareAppMessage, onShow } from '@dcloudio/uni-app'
import { getPromotionRecords, getPromotionSummary, type PromotionRecord, type PromotionSummary } from '@/api/promotion'
import { convertWallet, getUserProfile, getWalletInfo, type UserProfile, type WalletInfo } from '@/api/user'
import { isLoggedIn, isRegisteredUser } from '@/utils/auth'
import { bindStoredPromotionIfLoggedIn, buildPromotionSharePath, capturePromotionContext } from '@/utils/promotion'
import { formatPromotionQueryDate, getPendingSettlementAmount, isPendingSettlementRecord, PROMOTION_SETTLEMENT_MAX_PAGES, PROMOTION_SETTLEMENT_PAGE_SIZE, PROMOTION_SETTLEMENT_QUERY_MS } from '@/utils/promotion-freeze'
import { resolvePromotionSettlement, savePromotionSettlement, syncPromotionSettlement } from '@/utils/promotion-settlement'
import { createThrottle } from '@/utils/interaction'
import LoginGuide from '@/components/LoginGuide.vue'
import { FEATURE_FLAGS, useModuleGuard } from '@/utils/config'

/** promotion 模块守卫：停用则拦截推广/红包（深链防护）。 */
const { moduleEnabled: promotionEnabled, loadModuleConfig: loadPromotionModule } = useModuleGuard('promotion')

const menuTop = ref(0)
const menuHeight = ref(32)
const user = ref<UserProfile | null>(null)
const wallet = ref<WalletInfo | null>(null)
const promotionSummary = ref<PromotionSummary | null>(null)
const promotionRecords = ref<PromotionRecord[]>([])
const settlementPromotionRecords = ref<PromotionRecord[]>([])
const promotionPage = ref(1)
const promotionTotal = ref(0)
const promotionLoading = ref(false)
const promotionLoadingMore = ref(false)
const promotionClock = ref(Date.now())
const loading = ref(false)
const converting = ref(false)
const accessChecking = ref(false)
const accessDenied = ref(false)
const loginGuideVisible = ref(false)
const navigationThrottle = createThrottle(500)
let pageLoadPromise: Promise<void> | null = null
const registeredUser = computed(() => isRegisteredUser(user.value?.identity))
/**
 * 后端直接下发的「待到账」金额（2026-09-16 起）：推广汇总优先，其次钱包接口。
 * 都未返回时返回 null，由前端按推广明细汇总兜底（老环境 / 字段缺失）。
 */
const backendUnsettledPromotion = computed<number | null>(() => {
  const fromSummary = promotionSummary.value?.unsettledPromotion
  if (typeof fromSummary === 'number' && Number.isFinite(fromSummary)) return fromSummary
  const fromWallet = wallet.value?.unsettledPromotion
  if (typeof fromWallet === 'number' && Number.isFinite(fromWallet)) return fromWallet
  return null
})
/** 前端按推广明细汇总的「待到账」兜底值（仅后端未下发 unsettledPromotion 时使用）。 */
const settlementFallbackAmount = computed(() => getPendingSettlementAmount(settlementPromotionRecords.value, promotionClock.value))
/** 平台尚未结算到账的推广金：这些金额不在钱包 pendingPromotion 里，转余额后仍要展示，否则会"凭空消失"。 */
const pendingSettlementAmount = computed(() => backendUnsettledPromotion.value ?? settlementFallbackAmount.value)

/** 自定义导航栏样式，和微信胶囊按钮保持同一高度。 */
const navStyle = computed(() => ({ top: `${menuTop.value}px`, height: `${menuHeight.value}px` }))

/** 内容区从胶囊按钮下方开始，避免标题被系统导航遮挡。 */
const bodyStyle = computed(() => ({ paddingTop: `${menuTop.value + menuHeight.value + uni.upx2px(100)}px` }))

/** 当前可转余额的推广金（后端钱包 pendingPromotion，未结算到账的部分不在其中）。 */
const withdrawablePromotion = computed(() => {
  const value = Number(promotionSummary.value?.pendingPromotion ?? wallet.value?.pendingPromotion)
  return Number.isFinite(value) && value > 0 ? value : 0
})

/** 当前已产生的推广金合计 = 钱包可转金额 + 平台尚未结算到账的部分（仅用于展示）。 */
const displayedPromotionAmount = computed(() => withdrawablePromotion.value + pendingSettlementAmount.value)

/**
 * 转余额兜底：后端转余额后会先把 pending 清零、约 1 小时后才把未转出部分重新累计回来，
 * 这段窗口期内用「转账前展示合计 − 实际转入余额金额」兜底，避免收益瞬间显示为 0
 * （详见 utils/promotion-settlement.ts）。
 */
const promotionDisplay = computed(() => resolvePromotionSettlement(displayedPromotionAmount.value, user.value?.id))
/** 最终对外展示的推广金合计（后端未追平时为兜底值）。 */
const promotionBalanceAmount = computed(() => promotionDisplay.value.amount)
/** 是否处于「结算中」（后端数据尚未追平，当前展示的是本地兜底值）。 */
const promotionSettling = computed(() => promotionDisplay.value.settling)

/**
 * 推广金展示值 = **可转余额 + 平台尚未结算到账（待到账）** 的合计。
 * 不再叠加后端 `totalPromotion`（累计口径受后端定时同步影响，会出现"昨天 1182、今天 396"的跳变）。
 * 推广概要接口未返回时保持空态 `--`。
 */
const totalPromotionText = computed(() => {
  if (!promotionSummary.value) return '--'
  return formatMoney(promotionBalanceAmount.value)
})

/** 已绑定用户数量，接口失败时保持真实空态。 */
const boundUserCountText = computed(() => formatIntegerOrPlaceholder(promotionSummary.value?.boundUserCount))

/** 是否还有未加载的推广明细。 */
const hasMorePromotionRecords = computed(() => promotionRecords.value.length < promotionTotal.value)

/** 将可选人数格式化为整数，否则显示空态。 */
function formatIntegerOrPlaceholder(value: unknown): string {
  const count = Number(value)
  return Number.isInteger(count) && count >= 0 ? String(count) : '--'
}

/** 将接口日期压缩成设计稿可容纳的短日期时间。 */
function formatDate(value: string | null | undefined): string {
  if (!value) return '--'
  return value.replace(' ', '\n').slice(0, 16)
}

/** 将金额显示为两位小数，保持卡片数字宽度稳定。 */
function formatMoney(value: unknown): string {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount.toFixed(2) : '0.00'
}

/** 加载当前用户钱包信息，接口失败时保留页面结构并提示。 */
async function loadWallet(): Promise<void> {
  if (!registeredUser.value) return
  loading.value = true
  try {
    wallet.value = await getWalletInfo()
  } catch (error) {
    wallet.value = null
    uni.showToast({ title: error instanceof Error ? error.message : '收益信息加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

/** 加载推广汇总，失败时只保留统计卡空态。 */
async function loadPromotionSummary(): Promise<void> {
  if (!registeredUser.value) return
  try {
    promotionSummary.value = await getPromotionSummary()
  } catch (error) {
    promotionSummary.value = null
    uni.showToast({ title: error instanceof Error ? error.message : '推广汇总加载失败', icon: 'none' })
  }
}

/** 加载推广明细首屏数据。 */
async function loadPromotionRecords(): Promise<void> {
  if (!registeredUser.value) return
  promotionLoading.value = true
  try {
    const result = await getPromotionRecords({ page: 1, pageSize: 10 })
    promotionRecords.value = result.list || []
    promotionPage.value = result.page || 1
    promotionTotal.value = result.total || 0
  } catch (error) {
    promotionRecords.value = []
    promotionTotal.value = 0
    uni.showToast({ title: error instanceof Error ? error.message : '推广明细加载失败', icon: 'none' })
  } finally {
    promotionLoading.value = false
  }
}

/**
 * 查询近期推广记录，计算「平台尚未结算到账」的推广金。
 * 窗口取 60 天：正常记录在支付后 7 天退款窗口结束即入账，60 天用于兜住延迟入账的记录，避免漏算。
 */
async function loadSettlementPromotionRecords(): Promise<void> {
  if (!registeredUser.value) return
  const now = Date.now()
  promotionClock.value = now
  const startTime = formatPromotionQueryDate(now - PROMOTION_SETTLEMENT_QUERY_MS)
  const endTime = formatPromotionQueryDate(now)
  const recentRecords: PromotionRecord[] = []
  let page = 1
  let total = 0
  try {
    do {
      const result = await getPromotionRecords({ startTime, endTime, page, pageSize: PROMOTION_SETTLEMENT_PAGE_SIZE })
      recentRecords.push(...(result.list || []))
      total = Number(result.total) || recentRecords.length
      page += 1
      if (!result.list?.length) break
    } while (recentRecords.length < total && page <= PROMOTION_SETTLEMENT_MAX_PAGES)
    settlementPromotionRecords.value = recentRecords
  } catch {
    // 未到账金额是增强展示，查询失败时保留后端确认金额，不影响转余额。
    settlementPromotionRecords.value = []
  }
}

/** 滚动到底部时继续加载推广明细。 */
async function loadMorePromotionRecords(): Promise<void> {
  if (!registeredUser.value) return
  if (promotionLoading.value || promotionLoadingMore.value || !hasMorePromotionRecords.value) return
  promotionLoadingMore.value = true
  try {
    const result = await getPromotionRecords({ page: promotionPage.value + 1, pageSize: 10 })
    promotionRecords.value = promotionRecords.value.concat(result.list || [])
    promotionPage.value = result.page || promotionPage.value + 1
    promotionTotal.value = result.total || promotionTotal.value
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '推广明细加载失败', icon: 'none' })
  } finally {
    promotionLoadingMore.value = false
  }
}


/** 将推广积分一键转入余额；转后立即按「转账前合计 − 实际到账金额」兜底展示，不依赖后端轮询。 */
async function handleConvertPromotion(): Promise<void> {
  if (!registeredUser.value) {
    denyGuestAccess()
    return
  }
  if (converting.value) return
  if (withdrawablePromotion.value <= 0) {
    uni.showToast({ title: '暂无可转余额', icon: 'none' })
    return
  }
  converting.value = true
  try {
    // 转账前的展示合计与余额：用于计算"本次实际转入余额的金额"（余额增量最可信）
    const beforeDisplay = displayedPromotionAmount.value
    const beforeBalance = Number(wallet.value?.balance || 0)
    // 直接调用 /api/wallet/convert，避免前端只改界面不改余额。
    await convertWallet('PROMOTION')
    await Promise.all([loadWallet(), loadPromotionSummary()])
    if (backendUnsettledPromotion.value === null) await loadSettlementPromotionRecords()
    const transferred = Math.max(0, Number(wallet.value?.balance || 0) - beforeBalance)
    // 兜底：转账后仍应展示的推广金 = 转账前合计 − 实际到账金额（冻结/待到账部分不该凭空消失）
    savePromotionSettlement(user.value?.id, Math.max(0, beforeDisplay - transferred))
    // 立即按兜底口径重算，避免后端 pending 清零期间页面显示 0
    syncPromotionSettlement(displayedPromotionAmount.value, user.value?.id)
    uni.showToast({ title: '已转入余额', icon: 'success' })
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '转余额失败', icon: 'none' })
  } finally {
    converting.value = false
  }
}

/** 查看推广金的规则说明（点击推广金金额触发）。 */
function showPromotionIncomeInfo(): void {
  const total = promotionBalanceAmount.value
  const withdrawable = withdrawablePromotion.value
  const unsettled = pendingSettlementAmount.value
  const common = `\n\n· 待到账的推广金是已产生、但平台尚未结算到账的收益（订单满 7 天退款窗口后结算入账），结算后会自动进入可转余额；\n· 提现（余额 / 推广金）另有锁定期：需在订单支付满 10 天后才能提现，详见钱包提现页的「提现规则」；\n· 本页「推广金」按「可转余额 + 待到账」合计展示，不等于已结算到账金额。`
  // 结算中：后端 pending 尚未追平，等式不再成立，改用说明剩余金额的口径
  const content = promotionSettling.value
    ? `你刚刚将可转余额的推广金转入了余额，页面仍显示 ${formatMoney(total)} 元在结算中（其中待到账 ${formatMoney(unsettled)} 元），最迟 1 小时内更新为最新金额。${common}`
    : `当前推广金合计 ${formatMoney(total)} 元 = 可转余额 ${formatMoney(withdrawable)} 元 + 待到账 ${formatMoney(unsettled)} 元。${common}`
  uni.showModal({
    title: '推广金说明',
    content,
    showCancel: false,
    confirmText: '知道了',
  })
}

/** 打开微信分享能力，具体分享内容由 onShareAppMessage 返回。 */
function handleShare(): void {
  if (!registeredUser.value) {
    denyGuestAccess()
    return
  }
  uni.showShareMenu({ withShareTicket: true })
}

/** 进入统一钱包页，余额提现与转账统一在钱包页完成。 */
function goWallet(): void {
  if (!navigationThrottle()) return
  if (!registeredUser.value) {
    denyGuestAccess()
    return
  }
  uni.navigateTo({ url: '/subpkg-wallet/withdraw/withdraw' })
}

/** 进入推广排行榜（推广中心二级页）；门槛与推广中心其他功能保持一致。 */
function goLeaderboard(): void {
  if (!navigationThrottle()) return
  if (!registeredUser.value) {
    denyGuestAccess()
    return
  }
  uni.navigateTo({ url: '/subpkg-wallet/leaderboard/leaderboard' })
}

/** 拦截游客访问推广中心，并返回个人中心等待后端身份升级。 */
function denyGuestAccess(): void {
  if (accessDenied.value) return
  accessDenied.value = true
  uni.showToast({ title: '完成订单后开放推广功能', icon: 'none' })
  setTimeout(() => uni.switchTab({ url: '/pages/mine/mine' }), 650)
}

/** 刷新用户身份，只有注册用户才加载推广中心数据。 */
async function ensureRegisteredAccess(): Promise<boolean> {
  if (accessDenied.value || accessChecking.value) return false
  if (!isLoggedIn()) {
    loginGuideVisible.value = true
    return false
  }
  accessChecking.value = true
  try {
    user.value = await getUserProfile()
    if (!registeredUser.value) {
      denyGuestAccess()
      return false
    }
    return true
  } catch {
    user.value = null
    denyGuestAccess()
    return false
  } finally {
    accessChecking.value = false
  }
}

/** 初始化或刷新推广中心，身份升级后重新进入即可获得完整功能。 */
async function loadPage(): Promise<void> {
  if (!(await ensureRegisteredAccess())) return
  await Promise.all([loadWallet(), loadPromotionSummary(), loadPromotionRecords()])
  // 后端已下发 unsettledPromotion 时无需再拉明细汇总（省一次多页请求），仅在字段缺失时兜底
  if (backendUnsettledPromotion.value === null) await loadSettlementPromotionRecords()
  // 数据加载完成后校准兜底快照：后端已追平则清除，未追平则继续按兜底值展示
  syncPromotionSettlement(displayedPromotionAmount.value, user.value?.id)
}

/** 合并首次挂载与重新显示时的并发刷新，避免重复请求推广数据。 */
function refreshPage(): Promise<void> {
  if (pageLoadPromise) return pageLoadPromise
  const pending = loadPage()
  pageLoadPromise = pending
  pending.then(
    () => { if (pageLoadPromise === pending) pageLoadPromise = null },
    () => { if (pageLoadPromise === pending) pageLoadPromise = null },
  )
  return pending
}

/** 返回来源页面，没有历史页面时回到个人中心。 */
function goBack(): void {
  if (!navigationThrottle()) return
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack({ delta: 1 })
    return
  }
  uni.switchTab({ url: '/pages/mine/mine' })
}

/** 主动「分享赚钱」按钮(button)带推广关系；胶囊分享(menu)不绑定。 */
onShareAppMessage((options) => {
  const base = '/pages/index/index'
  const path = options.from === 'button' ? buildPromotionSharePath(base) : base
  return { title: '今华有肽，年轻常在', path, imageUrl: '/static/logo.png' }
})

/** 捕获推广收益页的原生分享参数，兼容已登录用户扫码后直接补绑定。 */
onLoad((options) => {
  capturePromotionContext(options as Record<string, unknown>)
  void bindStoredPromotionIfLoggedIn()
})

onMounted(() => {
  try {
    const rect = uni.getMenuButtonBoundingClientRect()
    if (rect) {
      menuTop.value = rect.top
      menuHeight.value = rect.height
    }
  } catch { /* 非微信环境没有胶囊按钮 */ }
  void refreshPage()
  void loadPromotionModule()
})

onShow(() => {
  void refreshPage()
})
</script>

<template>
  <view class="page">
    <view class="nav" :style="navStyle">
      <image class="back-button" src="/static/left_arrow.png" mode="aspectFit" @click="goBack" />
    </view>

    <!-- promotion 模块停用：拦截推广/红包（深链防护） -->
    <view v-if="!promotionEnabled" class="module-blocked">
      <text class="module-blocked-title">推广功能未开通</text>
      <text class="module-blocked-desc">当前商户未开通分销推广模块，推广与红包暂不可用。</text>
    </view>

    <scroll-view v-if="registeredUser && promotionEnabled" class="page-scroll" scroll-y :style="bodyStyle" @scrolltolower="loadMorePromotionRecords">
      <view class="page-content">
        <view class="share-heading">
          <text class="share-title">分享赚钱</text>
          <text class="share-subtitle">即刻兑现</text>
        </view>

        <view class="balance-card">
          <image class="promotion-background" src="/static/Promotion/推广背景_slices/推广背景@2x.png" mode="scaleToFill" />
          <view class="balance-amount">
            <text class="balance-value" @click="showPromotionIncomeInfo">{{ formatMoney(promotionBalanceAmount) }}</text>
            <text v-if="promotionSettling" class="balance-settling" @click="showPromotionIncomeInfo">结算中</text>
          </view>
          <view class="card-actions">
            <view class="wallet-button" :class="{ disabled: converting }" @click="handleConvertPromotion">转余额</view>
            <view class="wallet-button wallet-link" @click="goWallet">钱包提现</view>
          </view>
        </view>

        <view class="share-actions">
          <button class="share-button" open-type="share" @click="handleShare">立即分享赚钱 <view class="share-arrow" /></button>
        </view>

        <view class="stats-row">
          <view class="stat-card">
            <image class="stat-icon-image" src="/static/Promotion/推广金_slices/推广金.png" mode="aspectFit" />
            <view class="stat-copy">
              <text class="stat-value">{{ totalPromotionText }}</text>
              <text class="stat-label">推广金（元）</text>
            </view>
          </view>
          <view class="stat-card">
            <image class="stat-icon-image" src="/static/Promotion/绑定人数_slices/绑定人数.png" mode="aspectFit" />
            <view class="stat-copy">
              <text class="stat-value">{{ boundUserCountText }}</text>
              <text class="stat-label">绑定总数（人）</text>
            </view>
          </view>
        </view>

        <!-- 排行榜入口：进入「推广排行榜」二级页（临时隐藏，甲方未结款，见 utils/config.ts 的 FEATURE_FLAGS） -->
        <view v-if="FEATURE_FLAGS.leaderboard" class="leaderboard-entry" @click="goLeaderboard">
          <text class="leaderboard-label">排行榜</text>
          <view class="leaderboard-arrow" />
        </view>

        <view class="promotion-section">
          <text class="promotion-title">推广数据</text>
          <view class="table-head">
            <text>用户名</text>
            <text>下单时间</text>
            <text>下单金额</text>
            <text>推广金</text>
          </view>
          <view class="table-line" />
          <view v-show="promotionLoading" class="promotion-empty">
            <text>推广数据加载中...</text>
          </view>
          <view v-show="!promotionLoading && !promotionRecords.length" class="promotion-empty">
            <text>暂无推广数据</text>
          </view>
          <view v-show="!promotionLoading && promotionRecords.length" class="promotion-list">
            <view v-for="record in promotionRecords" :key="record.orderNo" class="promotion-row">
              <text class="promotion-cell buyer-name">{{ record.buyerName || '--' }}</text>
              <text class="promotion-cell order-time">{{ formatDate(record.createTime) }}</text>
              <text class="promotion-cell order-amount">{{ formatMoney(record.payAmount) }}</text>
              <view class="promotion-cell promotion-amount"><text>+{{ formatMoney(record.amount) }}</text><text v-if="isPendingSettlementRecord(record)" class="promotion-unsettled-mark">待到账</text></view>
            </view>
            <view v-show="promotionLoadingMore" class="promotion-more">加载中...</view>
            <view v-show="!promotionLoadingMore && !hasMorePromotionRecords" class="promotion-more">已加载全部</view>
          </view>
        </view>
      </view>
    </scroll-view>

    <view v-if="!registeredUser && !loginGuideVisible" class="access-empty">
      <text class="access-empty-title">登录后即可体验完整功能</text>
      <text class="access-empty-text">登录后即可查看推广收益和推广数据</text>
    </view>

    <LoginGuide v-model="loginGuideVisible" />

  </view>
</template>

<style>
.page { position: relative; height: 100vh; overflow: hidden; background: #fff; color: #000; font-family: '苹方-简', 'PingFang SC', sans-serif; font-weight: 600; }
.page button, .page input { font-family: '苹方-简', 'PingFang SC', sans-serif; font-weight: 600; }
.nav { position: fixed; right: 0; left: 0; z-index: 20; display: flex; align-items: center; padding-left: 40rpx; background: #fff; box-sizing: border-box; }
.back-button { width: 40rpx; height: 40rpx; }
.page-scroll { position: absolute; inset: 0; width: 100%; height: 100%; box-sizing: border-box; }
.page-content { padding: 0 0 100rpx; box-sizing: border-box; }
.access-empty { position: absolute; top: 50%; right: 0; left: 0; display: flex; align-items: center; flex-direction: column; transform: translateY(-50%); }
.access-empty-title { color: #222; font-size: 30rpx; font-weight: 700; }
.access-empty-text { margin-top: 16rpx; color: #959595; font-size: 24rpx; }
.share-heading { display: flex; align-items: baseline; height: 40rpx; }
.share-heading { margin-left: 40rpx; }
.share-title { color: #000; font-size: 26.72rpx; line-height: 26.72rpx; }
.share-subtitle { margin-left: 10rpx; color: #959595; font-size: 22.9rpx; line-height: 22.9rpx; }
.balance-card { position: relative; width: 756rpx; max-width: calc(100% - 32rpx); height: 176rpx; margin: 24rpx 16rpx 0; overflow: hidden; }
.promotion-background { position: absolute; inset: 0; z-index: 0; display: block; width: 100%; height: 100%; }
.balance-amount { position: absolute; bottom: 34rpx; left: 64rpx; z-index: 1; display: flex; align-items: center; }
.balance-value { color: #fbd69d; font-size: 45.8rpx; font-weight: 600; line-height: 54.96rpx; }
.balance-settling { margin-left: 12rpx; padding: 2rpx 10rpx; border: 1rpx solid #fbd69d; color: #fbd69d; font-size: 18rpx; line-height: 26rpx; }
.card-actions { position: absolute; right: 62rpx; bottom: 40rpx; z-index: 1; display: flex; align-items: center; gap: 24rpx; }
.wallet-button { display: flex; align-items: center; justify-content: center; width: 136rpx; height: 56rpx; box-sizing: border-box; border: 1rpx solid #fbd69d; color: #fbd69d; background: transparent; font-size: 22.9rpx; white-space: nowrap; }
.wallet-button.wallet-link { color: #000; background: #fbd69d; }
.wallet-button.disabled { opacity: .65; }
.share-button { display: flex; align-items: center; justify-content: center; width: 445rpx; height: 64rpx; margin: 52rpx auto 0; padding: 0; border: 1rpx solid #000; border-radius: 0; color: #000; background: #fff; font-size: 22.9rpx; line-height: 64rpx; }
.share-button::after { border: 0; }
.share-actions { display: flex; align-items: center; justify-content: center; gap: 16rpx; margin-top: 52rpx; }
.share-actions .share-button { margin: 0; }
.share-arrow { position: relative; width: 28rpx; height: 1rpx; margin-left: 12rpx; background: #000; }
.share-arrow::after { position: absolute; top: -4rpx; right: 0; width: 8rpx; height: 8rpx; border-top: 1rpx solid #000; border-right: 1rpx solid #000; content: ''; transform: rotate(45deg); }
.stats-row { display: flex; gap: 26rpx; margin: 48rpx 40rpx 0; }
.stat-card { display: flex; flex: none; align-items: center; width: 340rpx; height: 136rpx; padding: 0 28rpx; box-sizing: border-box; background: #f6f6f6; }
.stat-icon-image { width: 88rpx; height: 88rpx; flex-shrink: 0; }
.stat-copy { display: flex; min-width: 0; height: 88rpx; flex-direction: column; justify-content: space-between; margin-left: 28rpx; }
.stat-value { color: #4f4f4f; font-size: 45.8rpx; font-weight: 600; line-height: 54.96rpx; }
.stat-label { color: #959595; font-size: 22.9rpx; line-height: 28rpx; white-space: nowrap; }
/* 排行榜入口行 */
.leaderboard-entry { display: flex; align-items: center; justify-content: space-between; height: 96rpx; margin: 32rpx 40rpx 0; padding: 0 32rpx; box-sizing: border-box; background: #f6f6f6; }
.leaderboard-label { color: #010101; font-size: 26rpx; line-height: 36rpx; }
.leaderboard-arrow { position: relative; width: 28rpx; height: 1rpx; background: #000; }
.leaderboard-arrow::after { position: absolute; top: -4rpx; right: 0; width: 8rpx; height: 8rpx; border-top: 1rpx solid #000; border-right: 1rpx solid #000; content: ''; transform: rotate(45deg); }
.promotion-section { margin-top: 94rpx; }
.promotion-title { display: block; margin-left: 56rpx; color: #000; font-size: 26.72rpx; line-height: 40rpx; }
.table-head { display: grid; grid-template-columns: 200rpx 194rpx 212rpx 72rpx; width: 678rpx; margin: 32rpx 0 0 56rpx; color: #959595; font-size: 22.9rpx; line-height: 34rpx; }
.table-head text:nth-child(n + 2) { text-align: center; }
.table-head text:last-child { text-align: right; }
.table-line { height: 1rpx; margin: 14rpx 40rpx 0; background: #f6f6f6; }
.promotion-empty { display: flex; align-items: center; justify-content: center; height: 120rpx; color: #959595; font-size: 22.9rpx; }
.promotion-list { margin-top: 12rpx; }
.promotion-row { display: grid; grid-template-columns: 202rpx 216rpx 190rpx 98rpx; min-height: 100rpx; margin: 0 40rpx; align-items: center; border-bottom: 1rpx solid #f6f6f6; color: #959595; font-size: 20rpx; line-height: 26rpx; }
.promotion-cell { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: pre-line; }
.order-time, .order-amount { text-align: center; }
.promotion-amount { display: flex; flex-direction: column; align-items: flex-end; justify-content: center; color: #010101; text-align: right; }
.promotion-unsettled-mark { margin-top: 4rpx; padding: 2rpx 8rpx; color: #b4772f; background: #fff4e5; font-size: 18rpx; line-height: 22rpx; }
.promotion-more { padding: 18rpx 0; color: #959595; font-size: 20rpx; text-align: center; }
.sheet-head { position: relative; display: flex; align-items: center; justify-content: center; min-height: 54rpx; }
.sheet-title { color: #222; font-size: 30rpx; font-weight: 600; }
.sheet-close { position: absolute; right: 0; color: #888; font-size: 42rpx; line-height: 42rpx; }

/* 模块停用拦截提示 */
.module-blocked { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; padding: 40rpx; text-align: center; }
.module-blocked-title { color: #1f2937; font-size: 32rpx; font-weight: 600; }
.module-blocked-desc { margin-top: 16rpx; color: #98a2b3; font-size: 26rpx; line-height: 1.6; }
</style>
