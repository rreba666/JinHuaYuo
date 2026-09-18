<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { getPromotionLeaderboard, type LeaderboardPeriod, type LeaderboardRow, type PromotionLeaderboard } from '@/api/promotion'
import { isLoggedIn } from '@/utils/auth'
import { useModuleGuard } from '@/utils/config'
import LoginGuide from '@/components/LoginGuide.vue'

/** promotion 模块守卫：模块停用时拦截页面（深链防护）。 */
const { moduleEnabled: promotionEnabled, loadModuleConfig: loadPromotionModule } = useModuleGuard('promotion')

/** 周期切换项：与后端 period 枚举一一对应。 */
const periodTabs: { key: LeaderboardPeriod; label: string }[] = [
  { key: 'DAY', label: '今日' },
  { key: 'WEEK', label: '本周' },
  { key: 'MONTH', label: '本月' },
  { key: 'YEAR', label: '本年' },
]
/** 榜单最多取多少名（后端限制 1~100，默认 20）。 */
const LEADERBOARD_LIMIT = 20

/** 当前统计周期，默认与后端默认值保持一致（本周）。 */
const period = ref<LeaderboardPeriod>('WEEK')
/** 排行榜数据快照。 */
const board = ref<PromotionLeaderboard | null>(null)
const loading = ref(false)
const loaded = ref(false)
/** 本次加载是否失败（用于展示重试入口，避免失败被误判成空榜）。 */
const failed = ref(false)
const loginGuideVisible = ref(false)
/** 请求竞态 token：快速切换周期时丢弃过期响应，避免旧周期数据覆盖新周期。 */
let requestToken = 0

/** 微信胶囊按钮位置，用于自定义导航栏精确定位。 */
const menuTop = ref(0)
const menuHeight = ref(32)
const navStyle = computed(() => ({ top: `${menuTop.value}px`, height: `${menuHeight.value}px` }))
const bodyTop = computed(() => menuTop.value + menuHeight.value)

/** 榜单列表（后端已按 推广人数↓ / 推广金↓ / 用户ID↑ 排序，名次唯一）。 */
const rows = computed<LeaderboardRow[]>(() => board.value?.list || [])
/** 我本周期是否有名次（没有有效推广时后端返回 myRank=null）。 */
const showMyRank = computed(() => board.value?.myRank !== null && board.value?.myRank !== undefined)
/** 空榜：加载完成、未失败且没有任何名次。 */
const empty = computed(() => loaded.value && !loading.value && !failed.value && !rows.value.length)

/** 将金额显示为最多两位小数，整数时省略小数位。 */
function formatAmount(value: unknown): string {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '0'
  return amount.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
}

/**
 * 把 `asOf`（2026-09-18 11:57:30）格式化为「09-18 11:57」。
 * 按字符串截取而不用 new Date：iOS 无法解析 `YYYY-MM-DD HH:mm:ss` 这种带空格的格式。
 */
function formatAsOf(value?: string | null): string {
  if (!value) return '--'
  const matched = String(value).match(/^\d{4}-(\d{2}-\d{2})[ T](\d{2}:\d{2})/)
  return matched ? `${matched[1]} ${matched[2]}` : String(value).slice(0, 16)
}

/** 昵称首字，用作无头像时的占位文字。 */
function avatarText(row: LeaderboardRow): string {
  const name = String(row.nickname || '').trim()
  return name ? name.slice(0, 1) : '用'
}

/** 前三名徽标样式，其余名次用默认灰底。 */
function rankClass(row: LeaderboardRow): string {
  return row.rank >= 1 && row.rank <= 3 ? `rank-${row.rank}` : ''
}

/** 加载当前周期的排行榜；未登录时不请求接口，直接弹登录引导。 */
async function load(): Promise<void> {
  if (!isLoggedIn()) {
    board.value = null
    loaded.value = true
    failed.value = false
    loginGuideVisible.value = true
    return
  }
  const token = ++requestToken
  loading.value = true
  failed.value = false
  try {
    const result = await getPromotionLeaderboard(period.value, LEADERBOARD_LIMIT)
    if (token !== requestToken) return
    board.value = result
    loaded.value = true
  } catch (error) {
    if (token !== requestToken) return
    board.value = null
    loaded.value = true
    failed.value = true
    uni.showToast({ title: error instanceof Error ? error.message : '排行榜加载失败', icon: 'none' })
  } finally {
    if (token === requestToken) loading.value = false
  }
}

/** 切换统计周期并重新拉取榜单，清空旧数据避免跨周期串台。 */
function switchPeriod(next: LeaderboardPeriod): void {
  if (period.value === next || loading.value) return
  period.value = next
  board.value = null
  loaded.value = false
  void load()
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

onLoad(() => { void load() })

/** 从后台切回或身份升级后重新拉取，保证榜单不过期。 */
onShow(() => { if (loaded.value) void load() })

onMounted(() => {
  try {
    const rect = uni.getMenuButtonBoundingClientRect()
    if (rect) { menuTop.value = rect.top; menuHeight.value = rect.height }
  } catch { /* 非微信环境没有胶囊按钮 */ }
  void loadPromotionModule()
})
</script>

<template>
  <view class="page">
    <view class="nav" :style="navStyle">
      <view class="nav-back" @click="goBack"><text class="back-icon">‹</text></view>
      <text class="nav-title">推广排行榜</text>
    </view>

    <!-- promotion 模块停用：拦截页面（深链防护） -->
    <view v-if="!promotionEnabled" class="module-blocked">
      <text class="module-blocked-title">推广功能未开通</text>
      <text class="module-blocked-desc">当前商户未开通分销推广模块，推广排行榜暂不可用。</text>
    </view>

    <scroll-view v-else class="scroll" scroll-y :style="{ marginTop: bodyTop + 'px' }">
      <view class="content">
        <view class="heading">
          <text class="heading-title">推广排行榜</text>
          <text class="heading-subtitle">按推广人数排名</text>
        </view>

        <!-- 周期切换：滚动口径，周期终点恒为「此刻」 -->
        <view class="period-tabs">
          <view
            v-for="tab in periodTabs"
            :key="tab.key"
            class="period-tab"
            :class="{ active: period === tab.key }"
            @click="switchPeriod(tab.key)"
          >
            <text class="period-label">{{ tab.label }}</text>
          </view>
        </view>

        <!-- 滚动口径提示：periodComplete 恒为 false，数据真实上界是 asOf -->
        <text v-if="board" class="as-of">数据截至 {{ formatAsOf(board.asOf) }}（本周期尚未结束）</text>

        <!-- 我的战绩：未上榜时也展示，让用户知道自己在哪个周期没成绩 -->
        <view v-if="board" class="my-card">
          <view class="my-rank">
            <text class="my-rank-label">我的排名</text>
            <text class="my-rank-value">{{ showMyRank ? '第 ' + board.myRank + ' 名' : '暂未上榜' }}</text>
          </view>
          <view class="my-stats">
            <text class="my-stat">推广 {{ board.myPromotedUserCount || 0 }} 人</text>
            <text class="my-divider">·</text>
            <text class="my-stat">推广金 ¥{{ formatAmount(board.myPromotionAmount) }}</text>
          </view>
          <!-- myRankInList=false 表示我未进入前 limit 名，需说明「列表里为什么找不到自己」 -->
          <text v-if="showMyRank && !board.myRankInList" class="my-tip">你暂未进入前 {{ board.limit }} 名，继续分享即可冲榜</text>
          <text v-else-if="!showMyRank" class="my-tip">本周期还没有有效推广，被推广人支付成功后即可上榜</text>
        </view>

        <view v-show="loading" class="state">加载中...</view>
        <view v-show="!loading && failed" class="state state-retry" @click="load">加载失败，点击重试</view>
        <view v-show="!loading && empty" class="state">本周期暂无推广数据</view>

        <!-- 榜单列表 -->
        <view v-show="!loading && rows.length" class="board">
          <view
            v-for="row in rows"
            :key="row.promoterUserId + '-' + row.rank"
            class="board-row"
            :class="{ me: row.isMe }"
          >
            <view class="rank-badge" :class="rankClass(row)">
              <text class="rank-text">{{ row.rank }}</text>
            </view>
            <image v-if="row.avatarUrl" class="avatar" :src="row.avatarUrl" mode="aspectFill" />
            <view v-else class="avatar avatar-placeholder"><text class="avatar-text">{{ avatarText(row) }}</text></view>
            <view class="board-main">
              <view class="nick-line">
                <text class="nickname">{{ row.nickname || '微信用户' }}</text>
                <text v-if="row.isMe" class="me-tag">我</text>
              </view>
              <text class="promoted">推广 {{ row.promotedUserCount }} 人</text>
            </view>
            <text class="amount">¥{{ formatAmount(row.promotionAmount) }}</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <LoginGuide v-model="loginGuideVisible" />
  </view>
</template>

<style>
.page { position: relative; height: 100vh; overflow: hidden; background: #fff; color: #000; font-family: '苹方-简', 'PingFang SC', sans-serif; font-weight: 600; }
.page button { font-family: '苹方-简', 'PingFang SC', sans-serif; font-weight: 600; }

/* 自定义导航栏 */
.nav { position: fixed; right: 0; left: 0; z-index: 20; display: flex; align-items: center; justify-content: center; background: #fff; box-sizing: border-box; }
.nav-back { position: absolute; left: 16rpx; display: flex; align-items: center; justify-content: center; width: 64rpx; height: 64rpx; }
.back-icon { color: #222; font-size: 48rpx; line-height: 1; }
.nav-title { color: #222; font-size: 32rpx; font-weight: 700; }

.scroll { position: absolute; inset: 0; width: 100%; height: 100%; box-sizing: border-box; }
.content { padding: 0 0 100rpx; box-sizing: border-box; }

/* 标题区：与推广中心页保持同一排版口径 */
.heading { display: flex; align-items: baseline; height: 40rpx; margin: 24rpx 0 0 40rpx; }
.heading-title { color: #000; font-size: 26.72rpx; line-height: 26.72rpx; }
.heading-subtitle { margin-left: 10rpx; color: #959595; font-size: 22.9rpx; line-height: 22.9rpx; }

/* 周期切换 */
.period-tabs { display: flex; gap: 18rpx; margin: 32rpx 40rpx 0; }
.period-tab { display: flex; flex: 1; align-items: center; justify-content: center; height: 64rpx; background: #f6f6f6; }
.period-tab.active { background: #000; }
.period-label { color: #4f4f4f; font-size: 24rpx; line-height: 64rpx; }
.period-tab.active .period-label { color: #fbd69d; }

/* 滚动口径提示 */
.as-of { display: block; margin: 20rpx 40rpx 0; color: #959595; font-size: 20rpx; line-height: 28rpx; }

/* 我的战绩卡 */
.my-card { margin: 24rpx 40rpx 0; padding: 28rpx 32rpx; background: #000; }
.my-rank { display: flex; align-items: baseline; justify-content: space-between; }
.my-rank-label { color: #959595; font-size: 22.9rpx; line-height: 32rpx; }
.my-rank-value { color: #fbd69d; font-size: 45.8rpx; line-height: 54.96rpx; }
.my-stats { display: flex; align-items: center; margin-top: 16rpx; }
.my-stat { color: #fbd69d; font-size: 24rpx; line-height: 34rpx; }
.my-divider { margin: 0 12rpx; color: #959595; font-size: 24rpx; }
.my-tip { display: block; margin-top: 14rpx; color: #959595; font-size: 20rpx; line-height: 28rpx; }

/* 榜单列表 */
.board { margin-top: 32rpx; }
.board-row { display: flex; align-items: center; min-height: 120rpx; margin: 0 40rpx; border-bottom: 1rpx solid #f6f6f6; }
.board-row.me { background: #fffaf0; }
.rank-badge { display: flex; align-items: center; justify-content: center; width: 44rpx; height: 44rpx; flex-shrink: 0; background: #f6f6f6; }
.rank-badge.rank-1 { background: #fbd69d; }
.rank-badge.rank-2 { background: #e3e3e3; }
.rank-badge.rank-3 { background: #f2d5b8; }
.rank-text { color: #4f4f4f; font-size: 22rpx; line-height: 30rpx; }
.rank-badge.rank-1 .rank-text, .rank-badge.rank-2 .rank-text, .rank-badge.rank-3 .rank-text { color: #000; }
.avatar { width: 72rpx; height: 72rpx; flex-shrink: 0; margin-left: 24rpx; background: #d8d8d8; border-radius: 50%; }
.avatar-placeholder { display: flex; align-items: center; justify-content: center; }
.avatar-text { color: #fff; font-size: 28rpx; line-height: 36rpx; }
.board-main { display: flex; flex: 1; min-width: 0; flex-direction: column; margin-left: 20rpx; }
.nick-line { display: flex; align-items: center; }
.nickname { max-width: 300rpx; overflow: hidden; color: #0a0a0a; font-size: 26rpx; line-height: 36rpx; text-overflow: ellipsis; white-space: nowrap; }
.me-tag { margin-left: 10rpx; padding: 2rpx 10rpx; color: #b4772f; background: #fff4e5; font-size: 18rpx; line-height: 24rpx; }
.promoted { margin-top: 10rpx; color: #959595; font-size: 20rpx; line-height: 28rpx; }
.amount { flex-shrink: 0; margin-left: 16rpx; color: #010101; font-size: 26rpx; line-height: 36rpx; }

/* 状态位 */
.state { padding: 120rpx 0; color: #959595; font-size: 24rpx; text-align: center; }
.state-retry { color: #b4772f; }

/* 模块停用拦截提示 */
.module-blocked { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; padding: 40rpx; text-align: center; }
.module-blocked-title { color: #1f2937; font-size: 32rpx; font-weight: 600; }
.module-blocked-desc { margin-top: 16rpx; color: #98a2b3; font-size: 26rpx; line-height: 1.6; }
</style>
