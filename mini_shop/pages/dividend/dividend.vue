<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { onLoad, onShareAppMessage, onShow } from '@dcloudio/uni-app'
import { getPromotionCode, getPromotionRecords, getPromotionSummary, type PromotionRecord, type PromotionSummary } from '@/api/promotion'
import { convertWallet, getUserProfile, getWalletInfo, type UserProfile, type WalletInfo } from '@/api/user'
import { getAuth, isRegisteredUser } from '@/utils/auth'
import { bindStoredPromotionIfLoggedIn, buildPromotionSharePath, capturePromotionContext } from '@/utils/promotion'

const menuTop = ref(0)
const menuHeight = ref(32)
const user = ref<UserProfile | null>(null)
const wallet = ref<WalletInfo | null>(null)
const promotionSummary = ref<PromotionSummary | null>(null)
const promotionRecords = ref<PromotionRecord[]>([])
const promotionPage = ref(1)
const promotionTotal = ref(0)
const promotionLoading = ref(false)
const promotionLoadingMore = ref(false)
const loading = ref(false)
const promotionCodeVisible = ref(false)
const promotionCodeLoading = ref(false)
const promotionCodeUrl = ref('')
const converting = ref(false)
const accessChecking = ref(false)
const accessDenied = ref(false)
const registeredUser = computed(() => isRegisteredUser(user.value?.identity))

/** 自定义导航栏样式，和微信胶囊按钮保持同一高度。 */
const navStyle = computed(() => ({ top: `${menuTop.value}px`, height: `${menuHeight.value}px` }))

/** 内容区从胶囊按钮下方开始，避免标题被系统导航遮挡。 */
const bodyStyle = computed(() => ({ paddingTop: `${menuTop.value + menuHeight.value + uni.upx2px(100)}px` }))

/** 当前可提现的推广金，接口未返回时按 0 处理。 */
const pendingPromotion = computed(() => {
  const value = Number(promotionSummary.value?.pendingPromotion ?? wallet.value?.pendingPromotion)
  return Number.isFinite(value) && value > 0 ? value : 0
})

/** 累计推广金额，接口失败时保持真实空态。 */
const totalPromotionText = computed(() => formatMoneyOrPlaceholder(promotionSummary.value?.totalPromotion))

/** 已绑定用户数量，接口失败时保持真实空态。 */
const boundUserCountText = computed(() => formatIntegerOrPlaceholder(promotionSummary.value?.boundUserCount))

/** 是否还有未加载的推广明细。 */
const hasMorePromotionRecords = computed(() => promotionRecords.value.length < promotionTotal.value)

/** 将可选金额格式化为设计稿金额，否则显示空态。 */
function formatMoneyOrPlaceholder(value: unknown): string {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount.toFixed(2) : '--'
}

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


/** 将推广积分一键转入余额，成功后刷新钱包与推广汇总。 */
async function handleConvertPromotion(): Promise<void> {
  if (!registeredUser.value) {
    denyGuestAccess()
    return
  }
  if (converting.value) return
  if (pendingPromotion.value <= 0) {
    uni.showToast({ title: '暂无可转余额', icon: 'none' })
    return
  }
  converting.value = true
  try {
    // 直接调用 /api/wallet/convert，避免前端只改界面不改余额。
    await convertWallet('PROMOTION')
    await Promise.all([loadWallet(), loadPromotionSummary()])
    uni.showToast({ title: '已转入余额', icon: 'success' })
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '转余额失败', icon: 'none' })
  } finally {
    converting.value = false
  }
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
  if (!registeredUser.value) {
    denyGuestAccess()
    return
  }
  uni.navigateTo({ url: '/pages/wallet/withdraw' })
}

/** 获取并展示带当前推广者身份的小程序码。 */
async function openPromotionCode(): Promise<void> {
  if (!registeredUser.value) {
    denyGuestAccess()
    return
  }
  if (promotionCodeLoading.value) return
  if (!getAuth()?.userId) {
    uni.showToast({ title: '请先登录后生成推广码', icon: 'none' })
    return
  }
  promotionCodeLoading.value = true
  promotionCodeVisible.value = true
  try {
    promotionCodeUrl.value = await getPromotionCode('pages/index/index')
    if (!promotionCodeUrl.value) throw new Error('推广码地址为空')
  } catch (error) {
    promotionCodeVisible.value = false
    uni.showToast({ title: error instanceof Error ? error.message : '推广码生成失败', icon: 'none' })
  } finally {
    promotionCodeLoading.value = false
  }
}

/** 关闭推广码弹窗。 */
function closePromotionCode(): void {
  if (!promotionCodeLoading.value) promotionCodeVisible.value = false
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
}

/** 返回来源页面，没有历史页面时回到个人中心。 */
function goBack(): void {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack({ delta: 1 })
    return
  }
  uni.switchTab({ url: '/pages/mine/mine' })
}

/** 配置微信转发卡片，转发后仍回到推广收益页。 */
onShareAppMessage(() => {
  const path = buildPromotionSharePath('/pages/index/index')
  return { title: '分享赚钱，即刻兑现', path }
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
  void loadPage()
})

onShow(() => {
  void loadPage()
})
</script>

<template>
  <view class="page">
    <view class="nav" :style="navStyle">
      <view class="back-button" @click="goBack" />
    </view>

    <scroll-view v-if="registeredUser" class="page-scroll" scroll-y :style="bodyStyle" @scrolltolower="loadMorePromotionRecords">
      <view class="page-content">
        <view class="share-heading">
          <text class="share-title">分享赚钱</text>
          <text class="share-subtitle">即刻兑现</text>
        </view>

        <view class="balance-card">
          <image class="promotion-background" src="/static/Promotion/推广背景_slices/推广背景.png" mode="scaleToFill" />
          <text class="balance-value">{{ formatMoney(pendingPromotion) }}</text>
          <view class="card-actions">
            <view class="wallet-button" :class="{ disabled: converting }" @click="handleConvertPromotion">转余额</view>
            <view class="wallet-button wallet-link" @click="goWallet">钱包提现</view>
          </view>
        </view>

        <view class="share-actions">
          <button class="share-button" open-type="share" @click="handleShare">立即分享赚钱 <view class="share-arrow" /></button>
          <view class="code-button" @click="openPromotionCode">推广码</view>
        </view>

        <view class="stats-row">
          <view class="stat-card">
            <image class="stat-icon-image" src="/static/Promotion/推广金_slices/推广金.png" mode="aspectFit" />
            <view class="stat-copy">
              <text class="stat-value">{{ totalPromotionText }}</text>
              <text class="stat-label">累计推广（元）</text>
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
              <text class="promotion-cell promotion-amount">+{{ formatMoney(record.amount) }}</text>
            </view>
            <view v-show="promotionLoadingMore" class="promotion-more">加载中...</view>
            <view v-show="!promotionLoadingMore && !hasMorePromotionRecords" class="promotion-more">已加载全部</view>
          </view>
        </view>
      </view>
    </scroll-view>

    <view v-show="promotionCodeVisible" class="mask promotion-code-mask" @click="closePromotionCode">
      <view class="promotion-code-sheet" @click.stop>
        <view class="sheet-head">
          <text class="sheet-title">我的推广码</text>
          <text class="sheet-close" @click="closePromotionCode">×</text>
        </view>
        <view v-show="promotionCodeLoading" class="promotion-code-loading">推广码生成中...</view>
        <image v-show="!promotionCodeLoading && promotionCodeUrl" class="promotion-code-image" :src="promotionCodeUrl" mode="aspectFit" />
        <text class="promotion-code-tip">扫码进入小程序，登录后自动建立推广关系</text>
      </view>
    </view>
  </view>
</template>

<style>
.page { position: relative; height: 100vh; overflow: hidden; background: #fff; color: #000; font-family: '苹方-简', 'PingFang SC', sans-serif; font-weight: 600; }
.page button, .page input { font-family: '苹方-简', 'PingFang SC', sans-serif; font-weight: 600; }
.nav { position: fixed; right: 0; left: 0; z-index: 20; display: flex; align-items: center; padding-left: 40rpx; background: #fff; box-sizing: border-box; }
.back-button { width: 40rpx; height: 40rpx; background: #282828; }
.page-scroll { position: absolute; inset: 0; width: 100%; height: 100%; box-sizing: border-box; }
.page-content { padding: 0 0 100rpx; box-sizing: border-box; }
.share-heading { display: flex; align-items: baseline; height: 40rpx; }
.share-heading { margin-left: 40rpx; }
.share-title { color: #000; font-size: 26.72rpx; line-height: 26.72rpx; }
.share-subtitle { margin-left: 10rpx; color: #959595; font-size: 22.9rpx; line-height: 22.9rpx; }
.balance-card { position: relative; width: 756rpx; max-width: calc(100% - 32rpx); height: 176rpx; margin: 24rpx 16rpx 0; overflow: hidden; }
.promotion-background { position: absolute; inset: 0; z-index: 0; display: block; width: 100%; height: 100%; }
.balance-value { position: absolute; bottom: 34rpx; left: 64rpx; z-index: 1; color: #fbd69d; font-size: 45.8rpx; font-weight: 600; line-height: 54.96rpx; }
.card-actions { position: absolute; right: 62rpx; bottom: 40rpx; z-index: 1; display: flex; align-items: center; gap: 24rpx; }
.wallet-button { display: flex; align-items: center; justify-content: center; width: 136rpx; height: 56rpx; box-sizing: border-box; border: 1rpx solid #fbd69d; color: #fbd69d; background: transparent; font-size: 22.9rpx; white-space: nowrap; }
.wallet-button.wallet-link { color: #000; background: #fbd69d; }
.wallet-button.disabled { opacity: .65; }
.share-button { display: flex; align-items: center; justify-content: center; width: 445rpx; height: 64rpx; margin: 52rpx auto 0; padding: 0; border: 1rpx solid #000; border-radius: 0; color: #000; background: #fff; font-size: 22.9rpx; line-height: 64rpx; }
.share-button::after { border: 0; }
.share-actions { display: flex; align-items: center; justify-content: center; gap: 16rpx; margin-top: 52rpx; }
.share-actions .share-button { margin: 0; }
.code-button { display: flex; align-items: center; justify-content: center; width: 104rpx; height: 64rpx; border: 1rpx solid #000; color: #000; background: #fff; font-size: 22.9rpx; box-sizing: border-box; }
.share-arrow { position: relative; width: 28rpx; height: 1rpx; margin-left: 12rpx; background: #000; }
.share-arrow::after { position: absolute; top: -4rpx; right: 0; width: 8rpx; height: 8rpx; border-top: 1rpx solid #000; border-right: 1rpx solid #000; content: ''; transform: rotate(45deg); }
.stats-row { display: flex; gap: 26rpx; margin: 48rpx 40rpx 0; }
.stat-card { display: flex; flex: none; align-items: center; width: 340rpx; height: 136rpx; padding: 0 28rpx; box-sizing: border-box; background: #f6f6f6; }
.stat-icon-image { width: 88rpx; height: 88rpx; flex-shrink: 0; }
.stat-copy { display: flex; min-width: 0; height: 88rpx; flex-direction: column; justify-content: space-between; margin-left: 28rpx; }
.stat-value { color: #4f4f4f; font-size: 45.8rpx; font-weight: 600; line-height: 54.96rpx; }
.stat-label { color: #959595; font-size: 22.9rpx; line-height: 28rpx; white-space: nowrap; }
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
.promotion-amount { color: #010101; text-align: right; }
.promotion-more { padding: 18rpx 0; color: #959595; font-size: 20rpx; text-align: center; }
.sheet-head { position: relative; display: flex; align-items: center; justify-content: center; min-height: 54rpx; }
.sheet-title { color: #222; font-size: 30rpx; font-weight: 600; }
.sheet-close { position: absolute; right: 0; color: #888; font-size: 42rpx; line-height: 42rpx; }
.promotion-code-mask { position: fixed; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center; padding: 40rpx; box-sizing: border-box; background: rgba(0, 0, 0, .62); }
.promotion-code-sheet { width: 590rpx; padding: 30rpx 28rpx 34rpx; box-sizing: border-box; background: #fff; }
.promotion-code-image { display: block; width: 460rpx; height: 460rpx; margin: 24rpx auto 0; }
.promotion-code-loading { display: flex; align-items: center; justify-content: center; width: 460rpx; height: 460rpx; margin: 24rpx auto 0; color: #959595; font-size: 24rpx; }
.promotion-code-tip { display: block; margin-top: 18rpx; color: #959595; font-size: 22rpx; text-align: center; }
</style>
