<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { getPeptideAccount, getPeptideLogs, normalizePeptideWording, type PeptideAccount, type PeptideLog } from '@/api/peptide'
import { isLoggedIn } from '@/utils/auth'
import LoginGuide from '@/components/LoginGuide.vue'

/** 流水类型兜底文案（后端 typeText 缺失时使用；产品内统一用「红包」，不出现「分红」）。 */
const LOG_TYPE_TEXT: Record<string, string> = {
  EARN: '红包获得',
  USE: '下单抵扣',
  REFUND: '订单关闭/退款返还',
  ADMIN_ADJUST: '后台调整',
}

/** 每页流水条数。 */
const LOG_PAGE_SIZE = 10

const account = ref<PeptideAccount | null>(null)
const logs = ref<PeptideLog[]>([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const loadingMore = ref(false)
const loaded = ref(false)
/** 首屏是否加载失败（与「暂无明细」区分，避免失败被当成空数据）。 */
const failed = ref(false)
const loginGuideVisible = ref(false)
/** 请求竞态 token：刷新与加载更多并发时丢弃过期响应。 */
let requestToken = 0

/** 微信胶囊按钮位置，用于自定义导航栏精确定位。 */
const menuTop = ref(0)
const menuHeight = ref(32)
const navStyle = computed(() => ({ top: `${menuTop.value}px`, height: `${menuHeight.value}px` }))
const bodyTop = computed(() => menuTop.value + menuHeight.value)
/** 是否还有更多流水（后端 total 为准，兜底按本页条数判断）。 */
const hasMore = computed(() => logs.value.length < total.value)

/** 将金额显示为最多两位小数，整数时省略小数位。 */
function formatAmount(value: unknown): string {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '0'
  return amount.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
}

/** 时间显示为「YYYY-MM-DD HH:mm」。 */
function formatTime(value?: string | null): string {
  if (!value) return '--'
  return String(value).replace('T', ' ').slice(0, 16)
}

/** 流水类型文案：后端 typeText 先归一卷名、再归一「分红→红包」，缺失时用本地兜底。 */
function logTypeText(log: PeptideLog): string {
  const normalized = normalizePeptideWording(log.typeText).replace(/分红/g, '红包')
  return normalized || LOG_TYPE_TEXT[String(log.type)] || '肽金券变动'
}

/** 流水副文案：优先关联订单号，其次来源订单号，最后兜底 remark（均已归一化）。 */
function logSubText(log: PeptideLog): string {
  const orderNo = log.orderNo || log.sourceOrderNo
  if (orderNo) return `订单 ${orderNo}`
  return normalizePeptideWording(log.remark).replace(/分红/g, '红包')
}

/** 加载账户信息与流水首屏。 */
async function load(reset = true): Promise<void> {
  if (!isLoggedIn()) {
    account.value = null
    logs.value = []
    loaded.value = true
    failed.value = false
    loginGuideVisible.value = true
    return
  }
  const token = ++requestToken
  if (reset) {
    loading.value = true
    failed.value = false
  } else {
    if (!hasMore.value || loadingMore.value) return
    loadingMore.value = true
  }
  try {
    // 账户与流水一起刷新：账户失败不影响流水展示，反之亦然
    const [accountResult, logsResult] = await Promise.all([
      getPeptideAccount().catch(() => null),
      getPeptideLogs(reset ? 1 : page.value + 1, LOG_PAGE_SIZE).catch(() => null),
    ])
    if (token !== requestToken) return
    if (accountResult) account.value = accountResult
    if (logsResult) {
      const list = logsResult.list || []
      logs.value = reset ? list : [...logs.value, ...list]
      page.value = logsResult.page || (reset ? 1 : page.value + 1)
      total.value = Number(logsResult.total ?? logs.value.length) || 0
    } else if (reset) {
      failed.value = true
    }
    loaded.value = true
  } finally {
    if (token === requestToken) {
      loading.value = false
      loadingMore.value = false
    }
  }
}

/** 触底加载下一页流水。 */
function loadMore(): void {
  void load(false)
}

/** 返回上一页；没有历史页面时回个人中心。 */
function goBack(): void {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack({ delta: 1 })
    return
  }
  uni.switchTab({ url: '/pages/mine/mine' })
}

onLoad(() => { void load(true) })

/** 从其他页面返回时刷新余额与首屏流水，保证抵扣后数字是最新的。 */
onShow(() => { if (loaded.value) void load(true) })

onMounted(() => {
  try {
    const rect = uni.getMenuButtonBoundingClientRect()
    if (rect) { menuTop.value = rect.top; menuHeight.value = rect.height }
  } catch { /* 非微信环境没有胶囊按钮 */ }
})
</script>

<template>
  <view class="page">
    <view class="nav" :style="navStyle">
      <view class="nav-back" @click="goBack"><text class="back-icon">‹</text></view>
      <text class="nav-title">肽金券</text>
    </view>

    <scroll-view class="scroll" scroll-y :style="{ marginTop: bodyTop + 'px' }" @scrolltolower="loadMore">
      <view class="content">
        <view class="heading">
          <text class="heading-title">我的肽金券</text>
          <text class="heading-subtitle">下单可抵扣</text>
        </view>

        <!-- 余额卡：黑底金字，与推广中心/排行榜的战绩卡同一视觉口径 -->
        <view class="balance-card">
          <text class="balance-label">可用肽金券（元）</text>
          <text class="balance-value">{{ formatAmount(account?.balance) }}</text>
          <view class="balance-stats">
            <text class="balance-stat">累计获得 ¥{{ formatAmount(account?.totalEarned) }}</text>
            <text class="balance-divider">·</text>
            <text class="balance-stat">累计使用 ¥{{ formatAmount(account?.totalUsed) }}</text>
          </view>
          <text v-if="account && !account.enabled" class="balance-paused">平台暂停发放肽金券，已有余额仍可继续抵扣</text>
        </view>

        <!-- 使用规则：肽金券不可提现是硬规则，必须显式说明 -->
        <view class="rule-card">
          <text class="rule-title">使用说明</text>
          <text class="rule-line">· 肽金券不可提现、不可转赠，仅能在下单时抵扣「支持肽金券」的商品</text>
          <text class="rule-line">· 无门槛、无上限，攒够即可 0 元购</text>
          <text class="rule-line">· 下单后会随机产生肽金券，与红包同时发放</text>
        </view>

        <view class="log-section">
          <text class="log-title">肽金券明细</text>
          <view v-show="loading" class="state">加载中...</view>
          <view v-show="!loading && failed" class="state state-retry" @click="load(true)">加载失败，点击重试</view>
          <view v-show="!loading && !failed && !logs.length" class="state">暂无肽金券明细</view>

          <view v-show="!loading && logs.length" class="log-list">
            <view v-for="log in logs" :key="log.id" class="log-row">
              <view class="log-main">
                <text class="log-type">{{ logTypeText(log) }}</text>
                <text class="log-time">{{ formatTime(log.createTime) }}</text>
                <text v-if="logSubText(log)" class="log-sub">{{ logSubText(log) }}</text>
              </view>
              <view class="log-side">
                <text :class="['log-value', log.direction === 'IN' ? 'log-in' : 'log-out']">{{ log.direction === 'IN' ? '+' : '-' }}{{ formatAmount(log.amount) }}</text>
                <text class="log-balance">余额 {{ formatAmount(log.balanceAfter) }}</text>
              </view>
            </view>
            <view v-show="loadingMore" class="log-more">加载中...</view>
            <view v-show="!loadingMore && !hasMore" class="log-more">已加载全部</view>
          </view>
        </view>
      </view>
    </scroll-view>

    <LoginGuide v-model="loginGuideVisible" />
  </view>
</template>

<style>
.page { position: relative; height: 100vh; overflow: hidden; background: #fff; color: #000; font-family: '苹方-简', 'PingFang SC', sans-serif; font-weight: 600; }

/* 自定义导航栏 */
.nav { position: fixed; right: 0; left: 0; z-index: 20; display: flex; align-items: center; justify-content: center; background: #fff; box-sizing: border-box; }
.nav-back { position: absolute; left: 16rpx; display: flex; align-items: center; justify-content: center; width: 64rpx; height: 64rpx; }
.back-icon { color: #222; font-size: 48rpx; line-height: 1; }
.nav-title { color: #222; font-size: 32rpx; font-weight: 700; }

.scroll { position: absolute; inset: 0; width: 100%; height: 100%; box-sizing: border-box; }
.content { padding: 0 0 100rpx; box-sizing: border-box; }

.heading { display: flex; align-items: baseline; height: 40rpx; margin: 24rpx 0 0 40rpx; }
.heading-title { color: #000; font-size: 26.72rpx; line-height: 26.72rpx; }
.heading-subtitle { margin-left: 10rpx; color: #959595; font-size: 22.9rpx; line-height: 22.9rpx; }

/* 余额卡 */
.balance-card { display: flex; flex-direction: column; margin: 24rpx 40rpx 0; padding: 32rpx; background: #000; }
.balance-label { color: #959595; font-size: 22.9rpx; line-height: 32rpx; }
.balance-value { margin-top: 8rpx; color: #fbd69d; font-size: 60rpx; line-height: 72rpx; }
.balance-stats { display: flex; align-items: center; margin-top: 16rpx; }
.balance-stat { color: #fbd69d; font-size: 22rpx; line-height: 32rpx; }
.balance-divider { margin: 0 12rpx; color: #959595; font-size: 22rpx; }
.balance-paused { margin-top: 14rpx; color: #959595; font-size: 20rpx; line-height: 28rpx; }

/* 规则说明 */
.rule-card { margin: 24rpx 40rpx 0; padding: 28rpx 32rpx; background: #f6f6f6; }
.rule-title { display: block; color: #010101; font-size: 26rpx; line-height: 36rpx; }
.rule-line { display: block; margin-top: 12rpx; color: #4f4f4f; font-size: 22rpx; line-height: 34rpx; }

/* 流水 */
.log-section { margin-top: 48rpx; }
.log-title { display: block; margin-left: 40rpx; color: #000; font-size: 26.72rpx; line-height: 40rpx; }
.log-list { margin-top: 12rpx; }
.log-row { display: flex; align-items: center; min-height: 120rpx; margin: 0 40rpx; border-bottom: 1rpx solid #f6f6f6; }
.log-main { display: flex; flex: 1; min-width: 0; flex-direction: column; padding: 16rpx 0; }
.log-type { color: #0a0a0a; font-size: 26rpx; line-height: 36rpx; }
.log-time { margin-top: 6rpx; color: #959595; font-size: 20rpx; line-height: 28rpx; }
.log-sub { margin-top: 4rpx; color: #959595; font-size: 20rpx; line-height: 28rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.log-side { display: flex; flex-shrink: 0; flex-direction: column; align-items: flex-end; margin-left: 20rpx; }
.log-value { font-size: 28rpx; line-height: 38rpx; }
.log-in { color: #b4772f; }
.log-out { color: #4f4f4f; }
.log-balance { margin-top: 6rpx; color: #959595; font-size: 20rpx; line-height: 28rpx; }
.log-more { padding: 24rpx 0; color: #959595; font-size: 20rpx; text-align: center; }

/* 状态位 */
.state { padding: 120rpx 0; color: #959595; font-size: 24rpx; text-align: center; }
.state-retry { color: #b4772f; }
</style>
