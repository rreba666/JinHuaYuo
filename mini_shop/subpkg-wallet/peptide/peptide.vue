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

/** 去首页逛商品：肽金券可用于抵扣「支持肽金券」的商品，余额为 0 时也引导先了解商品。 */
function goGoods(): void {
  uni.switchTab({ url: '/pages/index/index' })
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

/** 从其他页面返回时刷新余额与首屏流水，保证下单抵扣后数字是最新的。 */
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
        <!-- 余额卡：黑金渐变 + 光晕，突出「这是一笔可用于抵扣的资产」 -->
        <view class="balance-card">
          <view class="balance-glow" />
          <view class="balance-head">
            <text class="balance-label">可用肽金券</text>
            <view class="balance-tag">不可提现</view>
          </view>
          <view class="balance-amount">
            <text class="balance-value">{{ formatAmount(account?.balance) }}</text>
            <text class="balance-unit">元</text>
          </view>
          <view class="balance-stats">
            <view class="stat">
              <text class="stat-value">¥{{ formatAmount(account?.totalEarned) }}</text>
              <text class="stat-label">累计获得</text>
            </view>
            <view class="stat-split" />
            <view class="stat">
              <text class="stat-value">¥{{ formatAmount(account?.totalUsed) }}</text>
              <text class="stat-label">累计使用</text>
            </view>
          </view>
          <view class="balance-action" @click="goGoods">去逛逛，下单可用</view>
        </view>

        <!-- 停发提示：已有余额仍可继续抵扣，需明确告知，避免以为余额失效 -->
        <view v-if="account && !account.enabled" class="notice">
          <text class="notice-text">平台暂停发放肽金券，已有余额仍可在下单时继续抵扣</text>
        </view>

        <!-- 使用说明 -->
        <view class="card">
          <text class="card-title">使用说明</text>
          <view class="rule"><view class="rule-dot" /><text class="rule-text">肽金券不可提现、不可转赠，仅能在下单时抵扣「支持肽金券」的商品</text></view>
          <view class="rule"><view class="rule-dot" /><text class="rule-text">无门槛、无上限，攒够即可 0 元购</text></view>
          <view class="rule"><view class="rule-dot" /><text class="rule-text">下单后会产生肽金券，与红包同时发放</text></view>
        </view>

        <!-- 明细 -->
        <view class="log-section">
          <text class="section-title">肽金券明细</text>

          <view v-show="loading" class="state">加载中...</view>
          <view v-show="!loading && failed" class="state state-retry" @click="load(true)">加载失败，点击重试</view>

          <!-- 空态：给出「怎么获得」的说明与入口，而不是一行灰字 -->
          <view v-show="!loading && !failed && !logs.length" class="empty">
            <view class="empty-art">
              <view class="empty-ticket" />
              <view class="empty-ticket empty-ticket-small" />
            </view>
            <text class="empty-title">还没有肽金券</text>
            <text class="empty-desc">购买支持肽金券的商品，成交后与红包同时到账</text>
            <view class="empty-action" @click="goGoods">去逛逛</view>
          </view>

          <!-- 明细列表：一条一张卡，金额方向用颜色区分 -->
          <view v-show="!loading && logs.length" class="log-list">
            <view v-for="log in logs" :key="log.id" class="log-card">
              <view class="log-head">
                <text class="log-type">{{ logTypeText(log) }}</text>
                <text :class="['log-value', log.direction === 'IN' ? 'log-in' : 'log-out']">{{ log.direction === 'IN' ? '+' : '-' }}{{ formatAmount(log.amount) }}</text>
              </view>
              <view class="log-meta">
                <text class="log-time">{{ formatTime(log.createTime) }}</text>
                <text class="log-balance">余额 {{ formatAmount(log.balanceAfter) }}</text>
              </view>
              <text v-if="logSubText(log)" class="log-sub">{{ logSubText(log) }}</text>
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
.page { position: relative; height: 100vh; overflow: hidden; background: #ffffff; color: #000; font-family: '苹方-简', 'PingFang SC', sans-serif; font-weight: 600; }

/* 自定义导航栏 */
.nav { position: fixed; right: 0; left: 0; z-index: 20; display: flex; align-items: center; justify-content: center; background: #ffffff; box-sizing: border-box; }
.nav-back { position: absolute; left: 16rpx; display: flex; align-items: center; justify-content: center; width: 64rpx; height: 64rpx; }
.back-icon { color: #222; font-size: 48rpx; line-height: 1; }
.nav-title { color: #222; font-size: 32rpx; font-weight: 700; }

.scroll { position: absolute; inset: 0; width: 100%; height: 100%; box-sizing: border-box; }
.content { padding: 0 0 100rpx; box-sizing: border-box; }

/* 余额卡：黑金渐变 + 右上角金色光晕 */
.balance-card { position: relative; display: flex; flex-direction: column; margin: 24rpx 40rpx 0; padding: 40rpx 36rpx 36rpx; border-radius: 28rpx; background: linear-gradient(135deg, #2a2119 0%, #100e0c 58%, #2b2016 100%); overflow: hidden; }
.balance-glow { position: absolute; top: -120rpx; right: -100rpx; width: 340rpx; height: 340rpx; border-radius: 50%; background: radial-gradient(circle, rgba(251, 214, 157, 0.30) 0%, rgba(251, 214, 157, 0) 70%); }
.balance-head { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; }
.balance-label { color: #d8cbb7; font-size: 24rpx; font-weight: 400; }
.balance-tag { padding: 4rpx 16rpx; border-radius: 20rpx; color: #fbd69d; background: rgba(251, 214, 157, 0.16); font-size: 20rpx; font-weight: 400; }
.balance-amount { position: relative; z-index: 1; display: flex; align-items: baseline; margin-top: 20rpx; }
.balance-value { color: #fbd69d; font-size: 76rpx; font-weight: 700; line-height: 88rpx; }
.balance-unit { margin-left: 10rpx; color: #fbd69d; font-size: 26rpx; font-weight: 400; }
.balance-stats { position: relative; z-index: 1; display: flex; align-items: center; margin-top: 28rpx; padding-top: 24rpx; border-top: 1rpx solid rgba(255, 255, 255, 0.10); }
.stat { display: flex; flex: 1; flex-direction: column; }
.stat-value { color: #fbd69d; font-size: 28rpx; font-weight: 600; }
.stat-label { margin-top: 6rpx; color: #9c9184; font-size: 20rpx; font-weight: 400; }
.stat-split { width: 1rpx; height: 52rpx; margin: 0 24rpx; background: rgba(255, 255, 255, 0.10); }
.balance-action { position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; height: 76rpx; margin-top: 32rpx; border-radius: 38rpx; color: #2a2119; background: #fbd69d; font-size: 27rpx; font-weight: 600; }

/* 停发提示 */
.notice { margin: 20rpx 40rpx 0; padding: 20rpx 24rpx; border-radius: 16rpx; background: #fff7e8; }
.notice-text { color: #b4772f; font-size: 22rpx; font-weight: 400; line-height: 34rpx; }

/* 使用说明卡 */
.card { margin: 24rpx 40rpx 0; padding: 32rpx; border-radius: 24rpx; background: #f7f8fa; }
.card-title { display: block; margin-bottom: 20rpx; color: #1d2129; font-size: 26rpx; }
.rule { display: flex; align-items: flex-start; margin-top: 16rpx; }
.rule:first-of-type { margin-top: 0; }
.rule-dot { width: 8rpx; height: 8rpx; margin: 14rpx 14rpx 0 0; flex-shrink: 0; border-radius: 50%; background: #c8892f; }
.rule-text { flex: 1; color: #4e5969; font-size: 23rpx; font-weight: 400; line-height: 36rpx; }

/* 明细 */
.log-section { margin-top: 48rpx; }
.section-title { display: block; margin: 0 40rpx; color: #1d2129; font-size: 28rpx; }
.log-list { margin-top: 24rpx; }
.log-card { margin: 0 40rpx 20rpx; padding: 28rpx; border-radius: 24rpx; background: #f7f8fa; }
.log-head { display: flex; align-items: baseline; justify-content: space-between; }
.log-type { color: #1d2129; font-size: 26rpx; }
.log-value { font-size: 32rpx; font-weight: 700; }
.log-in { color: #c8892f; }
.log-out { color: #4e5969; }
.log-meta { display: flex; align-items: center; justify-content: space-between; margin-top: 12rpx; }
.log-time { color: #86909c; font-size: 21rpx; font-weight: 400; }
.log-balance { color: #86909c; font-size: 21rpx; font-weight: 400; }
.log-sub { display: block; margin-top: 10rpx; color: #a9aeb8; font-size: 20rpx; font-weight: 400; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.log-more { padding: 20rpx 0; color: #a9aeb8; font-size: 20rpx; font-weight: 400; text-align: center; }

/* 空态：用 CSS 画两张券的图形 + 引导入口 */
.empty { display: flex; flex-direction: column; align-items: center; padding: 80rpx 40rpx 60rpx; }
.empty-art { position: relative; width: 180rpx; height: 130rpx; margin-bottom: 32rpx; }
.empty-ticket { position: absolute; top: 0; left: 0; width: 150rpx; height: 90rpx; border: 2rpx solid #ecd9b6; border-radius: 16rpx; background: #fdf8ef; }
.empty-ticket::after { position: absolute; top: 50%; left: 18rpx; right: 18rpx; height: 2rpx; background: repeating-linear-gradient(90deg, #ecd9b6 0, #ecd9b6 10rpx, transparent 10rpx, transparent 20rpx); content: ''; transform: translateY(-50%); }
.empty-ticket-small { top: 40rpx; left: 30rpx; width: 150rpx; height: 90rpx; background: #fffdf9; }
.empty-title { color: #1d2129; font-size: 28rpx; }
.empty-desc { margin-top: 14rpx; color: #86909c; font-size: 22rpx; font-weight: 400; line-height: 34rpx; text-align: center; }
.empty-action { display: flex; align-items: center; justify-content: center; width: 240rpx; height: 72rpx; margin-top: 32rpx; border: 2rpx solid #c8892f; border-radius: 36rpx; color: #c8892f; font-size: 25rpx; }

/* 状态位 */
.state { padding: 100rpx 0; color: #86909c; font-size: 24rpx; font-weight: 400; text-align: center; }
.state-retry { color: #c8892f; }
</style>
