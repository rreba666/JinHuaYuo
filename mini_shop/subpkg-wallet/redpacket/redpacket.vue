<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { convertWallet, getDividendRecords, getWalletInfo, getUserProfile, type DividendRecord, type UserProfile, type WalletInfo } from '@/api/user'
import { isLoggedIn, isRegisteredUser } from '@/utils/auth'
import { ApiRequestError } from '@/utils/request'
import { useConvertRealnameGate } from '@/utils/realname-gate'
import RequestState from '@/components/RequestState.vue'
import LoginGuide from '@/components/LoginGuide.vue'
import RealnameVerifySheet from '@/components/RealnameVerifySheet.vue'
import { useModuleGuard } from '@/utils/config'

/** promotion 模块守卫：停用则拦截平台红包（深链防护）。 */
const { moduleEnabled: promotionEnabled, loadModuleConfig: loadPromotionModule } = useModuleGuard('promotion')

const menuTop = ref(0)
const menuHeight = ref(32)
const wallet = ref<WalletInfo | null>(null)
const records = ref<DividendRecord[]>([])

/**
 * 红包来源标签文案。
 *
 * ⚠️ 2026-09-23：后端新增 `sourceType` 打标（`DIVIDEND` 分红红包 / `SPECIAL_SUBSIDY` 特殊补贴），
 * 文档说 `sourceTypeDesc` 可直接展示；但本项目展示口径是**前端映射** ——
 * 特殊商品补贴对外叫「**商品补贴**」（后端下发的是"特殊补贴"）。
 * 所以这里按 `sourceType` 映射，`sourceTypeDesc` 仅在没有 sourceType 时兜底
 * （后端 `non_null` ⇒ 老数据可能整个 key 缺失）。
 */
function sourceTagText(record: DividendRecord): string {
  if (record.sourceType === 'SPECIAL_SUBSIDY') return '商品补贴'
  if (record.sourceType === 'DIVIDEND') return '分红红包'
  return record.sourceTypeDesc || ''
}

const recordsPage = ref(1)
const recordsTotal = ref(0)
const loading = ref(false)
const loadError = ref('')
const loadingMore = ref(false)
const converting = ref(false)
const user = ref<UserProfile | null>(null)
const registeredUser = computed(() => isRegisteredUser(user.value?.identity))
const loginGuideVisible = ref(false)

/**
 * 转余额实名门禁（2026-09-19 多账号套现风控）。
 * 红包与推广金共用同一接口 `/api/wallet/convert`，后端已加实名校验：未实名 → `8601`。
 * 这里做**前置拦截**（体验：先查状态、未实名不白发请求）+ **`8601` 兜底**（保证任何路径都不漏）。
 */
const {
  sheetVisible: realnameVisible,
  ensureRealname,
  handleVerified,
  handleConvertDenied,
} = useConvertRealnameGate()
let pageLoadPromise: Promise<void> | null = null

/** 自定义导航栏样式。 */
const navStyle = computed(() => ({ top: `${menuTop.value}px`, height: `${menuHeight.value}px` }))
const bodyTop = computed(() => menuTop.value + menuHeight.value)

/** 待领取红包总额（红包金额，仅积分，不含货币符号）。 */
const bonusAmount = computed(() => {
  const value = Number(wallet.value?.pendingBonus || 0)
  return Number.isFinite(value) && value > 0 ? value : 0
})

/** 将积分格式化为整数（无小数位），避免出现货币感。 */
function formatPoints(value: unknown): string {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '0'
  return amount.toFixed(2).replace(/\.00$/, '').replace(/\.(\d)0$/, '.$1')
}

/** 压缩时间为短格式。 */
function formatTime(value: string | null | undefined): string {
  if (!value) return '--'
  return value.replace(' ', '\n').slice(0, 16)
}

/** 加载钱包与红包流水（逐笔）。 */
async function loadData(): Promise<void> {
  loading.value = true
  loadError.value = ''
  try {
    await ensureUser()
    if (!registeredUser.value) return

    let failed = false
    try {
      const info = await getWalletInfo()
      wallet.value = info
    } catch {
      failed = true
    }
    try {
      const result = await getDividendRecords({ page: 1, pageSize: 10 })
      records.value = result.list || []
      recordsPage.value = result.page || 1
      recordsTotal.value = result.total || 0
    } catch {
      failed = true
    }
    if (failed) loadError.value = '部分红包数据加载失败，请重试'
  } finally {
    loading.value = false
  }
}

/** 复用首次加载请求，避免 onMounted 与 onShow 同时进入时重复拉取。 */
function refreshData(): Promise<void> {
  if (pageLoadPromise) return pageLoadPromise
  const pending = loadData()
  pageLoadPromise = pending
  pending.then(
    () => { if (pageLoadPromise === pending) pageLoadPromise = null },
    () => { if (pageLoadPromise === pending) pageLoadPromise = null },
  )
  return pending
}

/** 上拉加载更多红包流水。 */
async function loadMoreRecords(): Promise<void> {
  if (!registeredUser.value) return
  if (loading.value || loadingMore.value || records.value.length >= recordsTotal.value) return
  loadingMore.value = true
  try {
    const result = await getDividendRecords({ page: recordsPage.value + 1, pageSize: 10 })
    records.value = records.value.concat(result.list || [])
    recordsPage.value = result.page || recordsPage.value + 1
    recordsTotal.value = result.total || recordsTotal.value
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' })
  } finally {
    loadingMore.value = false
  }
}

/** 把红包积分一键转入余额，成功后清空本地红点标记（下次红包重新提示）。 */
async function convertBonus(): Promise<void> {
  if (!registeredUser.value) return
  if (converting.value) return
  if (bonusAmount.value <= 0) {
    uni.showToast({ title: '暂无可转余额', icon: 'none' })
    return
  }
  // 转余额前实名门禁：未实名则弹实名，认证成功后自动续跑本次转账
  if (!(await ensureRealname(() => { void convertBonus() }))) return
  converting.value = true
  try {
    await convertWallet('BONUS')
    // 转余额后待领取红包清零，重置红点已读标记，下次新红包重新亮红点
    uni.setStorageSync('bonus_last_seen', 0)
    await loadData()
    uni.showToast({ title: '已转入余额', icon: 'success' })
  } catch (error) {
    // 后端兜底：8601 = 未实名（前置查询失败/状态过期时走到这里），引导实名并自动续跑
    if (error instanceof ApiRequestError && error.code === 8601) {
      handleConvertDenied(() => { void convertBonus() })
      return
    }
    uni.showToast({ title: error instanceof Error ? error.message : '转余额失败', icon: 'none' })
  } finally {
    converting.value = false
  }
}

/** 返回上一页。 */
function goBack(): void {
  const pages = getCurrentPages()
  if (pages.length > 1) uni.navigateBack()
  else uni.switchTab({ url: '/pages/mine/mine' })
}

async function ensureUser(): Promise<void> {
  if (!isLoggedIn()) {
    user.value = null
    loginGuideVisible.value = true
    return
  }
  try { user.value = await getUserProfile() } catch { user.value = null }
}

onMounted(() => {
  try {
    const rect = uni.getMenuButtonBoundingClientRect()
    if (rect) { menuTop.value = rect.top; menuHeight.value = rect.height }
  } catch { /* 非微信环境忽略 */ }
  void refreshData()
  void loadPromotionModule()
})

onShow(() => { void refreshData() })
</script>

<template>
  <view class="page">
    <view class="nav" :style="navStyle"><image class="back-button" src="/static/left_arrow.png" mode="aspectFit" @click="goBack" /></view>

    <!-- promotion 模块停用：拦截平台红包（深链防护） -->
    <view v-if="!promotionEnabled" class="module-blocked">
      <text class="module-blocked-title">平台红包未开通</text>
      <text class="module-blocked-desc">当前商户未开通分销推广模块，平台红包暂不可用。</text>
    </view>

    <scroll-view v-if="registeredUser && promotionEnabled" class="page-scroll" scroll-y :style="{ paddingTop: bodyTop + 'px' }" @scrolltolower="loadMoreRecords">
      <view class="page-content">
        <view class="heading">
          <text class="heading-title">平台红包</text>
        </view>

        <view class="packet-card">
          <image class="packet-bg" src="/static/bg/红包页背景.jpg" mode="aspectFill" />
          <text class="packet-amount">{{ formatPoints(bonusAmount) }}</text>
          <view class="convert-btn" :class="{ disabled: converting || bonusAmount <= 0 }" @click="convertBonus">转余额</view>
        </view>

        <view class="source-section">
          <text class="source-title">红包来源</text>
          <view class="table-head">
            <text>来源</text>
            <text>时间</text>
            <text>金额</text>
          </view>
          <view class="table-line" />
          <RequestState v-if="!loading && loadError" :error="loadError" @retry="refreshData" />
          <view v-show="loading" class="source-empty"><text>加载中...</text></view>
          <view v-show="!loading && !records.length" class="source-empty"><text>暂无红包记录</text></view>
          <view v-show="!loading && records.length" class="source-list">
            <view v-for="record in records" :key="record.id" class="source-row">
              <text class="source-cell name">{{ record.productName || '--' }}<text v-if="sourceTagText(record)" class="source-tag">{{ sourceTagText(record) }}</text></text>
              <text class="source-cell time">{{ formatTime(record.createTime) }}</text>
              <text class="source-cell amount">{{ formatPoints(record.amount) }}</text>
            </view>
            <view v-show="loadingMore" class="source-more">加载中...</view>
            <view v-show="!loadingMore && records.length >= recordsTotal" class="source-more">已加载全部</view>
          </view>
        </view>
      </view>
    </scroll-view>

    <view v-if="!registeredUser && !loginGuideVisible" class="access-empty">
      <text class="access-empty-title">登录后即可体验完整功能</text>
      <text class="access-empty-text">登录后即可查看平台红包和红包记录</text>
    </view>

    <LoginGuide v-model="loginGuideVisible" />

    <!-- 转余额实名门禁（2026-09-19 多账号套现风控）：未实名时弹出，认证成功后自动续跑转余额 -->
    <RealnameVerifySheet v-model="realnameVisible" @verified="handleVerified" />
  </view>
</template>

<style>
.page { height: 100vh; overflow: hidden; background: #fff; color: #000; font-family: '苹方-简', 'PingFang SC', sans-serif; font-weight: 600; }
.nav { position: fixed; left: 0; right: 0; z-index: 20; display: flex; align-items: center; padding-left: 40rpx; background: #fff; box-sizing: border-box; }
.back-button { width: 40rpx; height: 40rpx; }
.page-scroll { height: 100vh; box-sizing: border-box; }
.page-content { padding: 0 0 100rpx; box-sizing: border-box; }
.access-empty { position: absolute; top: 50%; right: 0; left: 0; display: flex; align-items: center; flex-direction: column; transform: translateY(-50%); }
.access-empty-title { color: #000; font-size: 30rpx; font-weight: 700; }
.access-empty-text { margin-top: 16rpx; color: #959595; font-size: 24rpx; }
.heading { display: flex; align-items: baseline; margin-left: 40rpx; }
.heading-title { color: #000; font-size: 28rpx; }
.packet-card { position: relative; width: 720rpx; max-width: calc(100% - 32rpx); height: 340rpx; margin: 24rpx auto 0; overflow: hidden; }
.packet-bg { position: absolute; inset: 0; width: 100%; height: 100%; }
.packet-amount { position: absolute; left: 0; right: 0; top: 46%; z-index: 1; color: #916448; font-size: 64rpx; font-weight: 700; text-align: center; }
.convert-btn { position: absolute; left: 50%; bottom: 20rpx; z-index: 1; display: flex; align-items: center; justify-content: center; width: 200rpx; height: 72rpx; border-radius: 36rpx; color: #fff; background: rgba(145, 100, 72, 0.9); font-size: 28rpx; transform: translateX(-50%); }
.convert-btn.disabled { opacity: 0.6; }
.source-section { margin-top: 60rpx; }
.source-title { display: block; margin-left: 56rpx; color: #000; font-size: 28rpx; }
.table-head { display: grid; grid-template-columns: 240rpx 240rpx 150rpx; width: 630rpx; margin: 30rpx 0 0 56rpx; color: #959595; font-size: 22rpx; }
.table-head text:nth-child(n + 2) { text-align: center; }
.table-head text:last-child { text-align: right; }
.table-line { height: 1rpx; margin: 12rpx 40rpx 0; background: #f6f6f6; }
.source-empty { display: flex; align-items: center; justify-content: center; height: 120rpx; color: #959595; font-size: 22rpx; }
.source-list { margin-top: 10rpx; }
.source-row { display: grid; grid-template-columns: 240rpx 240rpx 150rpx; min-height: 90rpx; margin: 0 40rpx; align-items: center; border-bottom: 1rpx solid #f6f6f6; color: #959595; font-size: 20rpx; }
.source-cell { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: pre-line; }
/* 红包来源标签（分红红包 / 商品补贴）：跟在商品名后的小号标记 */
.source-tag { margin-left: 8rpx; padding: 0 8rpx; border: 1rpx solid #e8d5b7; border-radius: 6rpx; color: #916448; font-size: 18rpx; }
.source-cell.time { text-align: center; }
.source-cell.amount { color: #010101; text-align: right; }
.source-more { padding: 20rpx 0; color: #959595; font-size: 20rpx; text-align: center; }

/* 模块停用拦截提示 */
.module-blocked { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; padding: 40rpx; text-align: center; }
.module-blocked-title { color: #1f2937; font-size: 32rpx; font-weight: 600; }
.module-blocked-desc { margin-top: 16rpx; color: #98a2b3; font-size: 26rpx; line-height: 1.6; }
</style>
