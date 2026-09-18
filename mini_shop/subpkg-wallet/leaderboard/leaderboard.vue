<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { onHide, onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import { getPromotionLeaderboard, type LeaderboardPeriod, type LeaderboardRow, type PromotionLeaderboard } from '@/api/promotion'
import { isLoggedIn } from '@/utils/auth'
import { useModuleGuard } from '@/utils/config'
import LoginGuide from '@/components/LoginGuide.vue'

/** promotion 模块守卫：模块停用时拦截页面（深链防护）。 */
const { moduleEnabled: promotionEnabled, loadModuleConfig: loadPromotionModule } = useModuleGuard('promotion')

/**
 * 周期切换项（设计稿：日榜 / 周榜 / 月榜 / 年榜 / 总榜）。
 * 前四项对应后端 period 枚举；「总榜」需要后端新增 `ALL`（全时段累计）——
 * api-docs 当前只有 DAY/WEEK/MONTH/YEAR，后端上线后**无需改前端即自动生效**；
 * 未支持时页面显示「总榜暂未开放」，不会报错。
 */
const periodTabs: { key: LeaderboardPeriod; label: string }[] = [
  { key: 'DAY', label: '日榜' },
  { key: 'WEEK', label: '周榜' },
  { key: 'MONTH', label: '月榜' },
  { key: 'YEAR', label: '年榜' },
  { key: 'ALL', label: '总榜' },
]
/** 榜单最多取多少名（后端限制 1~100）。 */
const LEADERBOARD_LIMIT = 20
/** 榜单轮询间隔：排名随支付实时变化，页面可见时每 60 秒静默刷新一次。 */
const LEADERBOARD_POLL_INTERVAL = 60 * 1000

/** 当前统计周期：设计稿默认高亮第一个（日榜）。 */
const period = ref<LeaderboardPeriod>('DAY')
/** 排行榜数据快照。 */
const board = ref<PromotionLeaderboard | null>(null)
const loading = ref(false)
const loaded = ref(false)
/** 首屏加载失败（与空榜区分）。 */
const failed = ref(false)
/** 「总榜」在当前后端版本不可用（未支持 period=ALL）的占位状态。 */
const totalUnavailable = ref(false)
const loginGuideVisible = ref(false)
/** 请求竞态 token：快速切换周期时丢弃过期响应。 */
let requestToken = 0
/** 轮询定时器：页面隐藏 / 卸载时清理。 */
let pollTimer: ReturnType<typeof setInterval> | null = null

/** 微信胶囊按钮位置，用于自定义导航栏精确定位。 */
const menuTop = ref(0)
const menuHeight = ref(32)
const navStyle = computed(() => ({ top: `${menuTop.value}px`, height: `${menuHeight.value}px` }))
const bodyTop = computed(() => menuTop.value + menuHeight.value)

/** 全部名次（后端已按 推广人数↓ / 推广金↓ / 用户ID↑ 排序，名次唯一无并列）。 */
const rows = computed<LeaderboardRow[]>(() => board.value?.list || [])
/** 领奖台三名（不足三名时对应位置留空）。 */
const podium = computed<(LeaderboardRow | null)[]>([rows.value[0] || null, rows.value[1] || null, rows.value[2] || null])
/** 是否显示领奖台：有任何一名上榜就显示。 */
const podiumVisible = computed(() => podium.value.some(Boolean))
/** 空榜：加载完成、未失败、总榜可用且没有任何名次。 */
const empty = computed(() => loaded.value && !loading.value && !failed.value && !totalUnavailable.value && !rows.value.length)
/** 数据截止时刻文案（滚动口径：含尚未走完的当前周期，真实上界是 asOf 而不是周期终点）。 */
const asOfText = computed(() => formatAsOf(board.value?.asOf))

/**
 * 把 `asOf`（2026-09-18 11:57:30）格式化为「09-18 11:57」。
 * 按字符串截取而不用 new Date：iOS 无法解析带空格的 `YYYY-MM-DD HH:mm:ss`。
 */
function formatAsOf(value?: string | null): string {
  if (!value) return ''
  const matched = String(value).match(/^(\d{4})-(\d{2}-\d{2})[ T](\d{2}:\d{2})/)
  return matched ? `${matched[2]} ${matched[3]}` : ''
}

/** 昵称首字，用作无头像时的占位文字。 */
function avatarText(row: LeaderboardRow | null): string {
  const name = String(row?.nickname || '').trim()
  return name ? name.slice(0, 1) : '用'
}

/** 领奖台徽章图（设计稿：金 1 / 银 2 / 铜 3 六边形徽章）。 */
function badgeSrc(index: number): string {
  return `/static/leaderboard/badge-${index + 1}.png`
}

/** 昵称展示兜底：后端可能不下发昵称。 */
function displayName(row: LeaderboardRow): string {
  return row.nickname || '微信用户'
}

/**
 * 加载当前周期的排行榜。
 * @param silent 轮询触发时为 true：失败不弹提示、保留上一份数据，避免每分钟打扰用户。
 */
async function load(silent = false): Promise<void> {
  if (!isLoggedIn()) {
    board.value = null
    loaded.value = true
    failed.value = false
    loginGuideVisible.value = true
    return
  }
  if (silent && loading.value) return
  const token = ++requestToken
  loading.value = true
  failed.value = false
  try {
    const result = await getPromotionLeaderboard(period.value, LEADERBOARD_LIMIT)
    if (token !== requestToken) return
    board.value = result
    totalUnavailable.value = false
    loaded.value = true
  } catch (error) {
    if (token !== requestToken) return
    // 「总榜」后端未支持时（period=ALL 非法）给出占位提示，不当作加载失败处理
    if (period.value === 'ALL') {
      board.value = null
      totalUnavailable.value = true
      loaded.value = true
      if (!silent) uni.showToast({ title: '总榜暂未开放', icon: 'none' })
      return
    }
    if (silent) return
    board.value = null
    loaded.value = true
    failed.value = true
    uni.showToast({ title: error instanceof Error ? error.message : '排行榜加载失败', icon: 'none' })
  } finally {
    if (token === requestToken) loading.value = false
  }
}

/** 启动轮询（重复调用不会叠加定时器）。 */
function startPolling(): void {
  stopPolling()
  pollTimer = setInterval(() => { void load(true) }, LEADERBOARD_POLL_INTERVAL)
}

/** 停止轮询并清理定时器。 */
function stopPolling(): void {
  if (pollTimer !== null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

/** 切换周期并重新拉取榜单；清空旧数据避免跨周期串台，同时重置轮询计时。 */
function switchPeriod(next: LeaderboardPeriod): void {
  if (period.value === next || loading.value) return
  period.value = next
  board.value = null
  totalUnavailable.value = false
  loaded.value = false
  void load()
  startPolling()
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

onLoad(() => { void load(); startPolling() })

/** 页面可见时刷新一次并恢复轮询；从后台切回也能立刻拿到最新排名。 */
onShow(() => {
  if (loaded.value) void load(true)
  startPolling()
})

/** 页面隐藏（切后台/跳走）立即停止轮询。 */
onHide(() => stopPolling())
/** 页面卸载清理定时器，避免内存泄漏与无效请求。 */
onUnload(() => stopPolling())

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
    <!-- 页面背景：设计稿的三色柔光装饰层 -->
    <image class="page-bg" src="/static/leaderboard/bg-glow.jpg" mode="aspectFill" />

    <view class="nav" :style="navStyle">
      <view class="nav-back" @click="goBack"><text class="back-icon">‹</text></view>
      <text class="nav-title">排行榜</text>
    </view>

    <!-- promotion 模块停用：拦截页面（深链防护） -->
    <view v-if="!promotionEnabled" class="module-blocked">
      <text class="module-blocked-title">推广功能未开通</text>
      <text class="module-blocked-desc">当前商户未开通分销推广模块，推广排行榜暂不可用。</text>
    </view>

    <scroll-view v-else class="scroll" scroll-y :style="{ paddingTop: bodyTop + 'px' }">
      <!-- 周期切换 -->
      <view class="tabs">
        <view
          v-for="tab in periodTabs"
          :key="tab.key"
          class="tab"
          :class="{ active: period === tab.key }"
          @click="switchPeriod(tab.key)"
        >
          <text class="tab-label">{{ tab.label }}</text>
        </view>
      </view>

      <!-- 前三名领奖台（设计稿：日落领奖台插图 + 三张头像 + 金/银/铜徽章） -->
      <view v-if="podiumVisible" class="podium">
        <image class="podium-art" src="/static/leaderboard/podium.jpg" mode="scaleToFill" />
        <template v-for="(item, index) in podium" :key="index">
          <view v-if="item" class="podium-avatar" :class="'podium-avatar-' + (index + 1)">
            <image v-if="item.avatarUrl" class="podium-avatar-img" :src="item.avatarUrl" mode="aspectFill" />
            <text v-else class="podium-avatar-text">{{ avatarText(item) }}</text>
          </view>
          <image v-if="item" class="podium-badge" :class="'podium-badge-' + (index + 1)" :src="badgeSrc(index)" mode="aspectFit" />
        </template>
      </view>

      <!-- 榜单列表 -->
      <view class="list-card">
        <view v-show="loading" class="state">加载中...</view>
        <view v-show="!loading && totalUnavailable" class="state">总榜暂未开放</view>
        <view v-show="!loading && failed" class="state state-retry" @click="load()">加载失败，点击重试</view>
        <view v-show="!loading && empty" class="state">本周期暂无推广数据</view>

        <view v-show="!loading && rows.length" class="list">
          <view v-for="row in rows" :key="row.promoterUserId + '-' + row.rank" class="list-row" :class="{ me: row.isMe }">
            <view class="row-left">
              <text class="row-rank">{{ row.rank }}</text>
              <image v-if="row.avatarUrl" class="row-avatar" :src="row.avatarUrl" mode="aspectFill" />
              <view v-else class="row-avatar row-avatar-placeholder"><text class="row-avatar-text">{{ avatarText(row) }}</text></view>
              <text class="row-name">{{ displayName(row) }}</text>
              <text v-if="row.isMe" class="row-me">我</text>
            </view>
            <text class="row-count">{{ row.promotedUserCount }} 人</text>
          </view>
          <!-- 滚动口径告知：数据上界是 asOf，不是周期终点 -->
          <text v-if="asOfText" class="list-asof">数据截至 {{ asOfText }}</text>
        </view>
      </view>
    </scroll-view>

    <LoginGuide v-model="loginGuideVisible" />
  </view>
</template>

<style>
.page { position: relative; min-height: 100vh; background: #ffffff; color: #1d2129; font-family: '苹方-简', 'PingFang SC', sans-serif; }
.page-bg { position: fixed; top: 0; left: 0; z-index: 0; width: 100%; height: 100vh; }

/* 自定义导航栏 */
.nav { position: fixed; right: 0; left: 0; z-index: 20; display: flex; align-items: center; justify-content: center; background: transparent; box-sizing: border-box; }
.nav-back { position: absolute; left: 16rpx; display: flex; align-items: center; justify-content: center; width: 64rpx; height: 64rpx; }
.back-icon { color: #1d2129; font-size: 52rpx; font-weight: 400; line-height: 1; }
.nav-title { color: #1d2129; font-size: 34rpx; font-weight: 600; line-height: 46rpx; }

.scroll { position: relative; z-index: 1; width: 100%; box-sizing: border-box; }

/* 周期切换：选中为橙色渐变胶囊，未选中为 10% 橙底 */
.tabs { display: flex; gap: 23rpx; padding: 31rpx; box-sizing: border-box; }
.tab { display: flex; flex: 1; align-items: center; justify-content: center; height: 65rpx; border-radius: 15rpx; background: rgba(253, 93, 33, 0.1); }
.tab.active { background: linear-gradient(90deg, #ff9d4c 0%, #ff5c1e 100%); }
.tab-label { color: #6e4451; font-size: 27rpx; font-weight: 400; line-height: 42rpx; }
.tab.active .tab-label { color: #ffffff; font-weight: 500; }

/* 前三名领奖台：尺寸与绝对坐标均取自设计稿（390px 稿 ×1.923 转 rpx） */
.podium { position: relative; width: 611rpx; height: 461rpx; margin: 0 auto; }
.podium-art { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
.podium-avatar { position: absolute; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 2rpx solid #ffffff; border-radius: 50%; background: #d8d8d8; box-sizing: border-box; }
.podium-avatar-1 { top: 94rpx; left: 223rpx; width: 165rpx; height: 165rpx; border-color: #f8a21d; }
.podium-avatar-2 { top: 190rpx; left: 33rpx; width: 129rpx; height: 129rpx; border-color: #618dff; }
.podium-avatar-3 { top: 196rpx; left: 448rpx; width: 127rpx; height: 127rpx; border-color: #f68467; }
.podium-avatar-img { width: 100%; height: 100%; }
.podium-avatar-text { color: #ffffff; font-size: 44rpx; }
.podium-badge { position: absolute; }
.podium-badge-1 { top: 240rpx; left: 283rpx; width: 46rpx; height: 46rpx; }
.podium-badge-2 { top: 302rpx; left: 79rpx; width: 38rpx; height: 38rpx; }
.podium-badge-3 { top: 308rpx; left: 492rpx; width: 38rpx; height: 38rpx; }

/* 榜单列表：白底卡片，上圆角 */
.list-card { position: relative; margin-top: 0; padding: 46rpx 31rpx 31rpx; background: #ffffff; border-radius: 31rpx 31rpx 0 0; box-sizing: border-box; }
.list { display: flex; flex-direction: column; }
.list-row { display: flex; height: 92rpx; flex-shrink: 0; align-items: center; justify-content: space-between; margin-bottom: 38rpx; }
.list-row:last-child { margin-bottom: 0; }
.list-row.me .row-name { color: #ff5c1e; }
.row-left { display: flex; min-width: 0; align-items: center; gap: 23rpx; }
.row-rank { width: 38rpx; flex-shrink: 0; color: #1d2129; font-size: 29rpx; font-weight: 600; text-align: center; }
.row-avatar { width: 92rpx; height: 92rpx; flex-shrink: 0; background: #d8d8d8; border-radius: 50%; }
.row-avatar-placeholder { display: flex; align-items: center; justify-content: center; }
.row-avatar-text { color: #ffffff; font-size: 34rpx; }
.row-name { max-width: 144rpx; overflow: hidden; color: #1d2129; font-size: 29rpx; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.row-me { flex-shrink: 0; padding: 0 8rpx; color: #ff5c1e; font-size: 22rpx; line-height: 30rpx; }
.row-count { flex-shrink: 0; color: #86909c; font-size: 29rpx; font-weight: 400; }
.list-asof { margin-top: 24rpx; color: #c9cdd4; font-size: 22rpx; text-align: center; }

/* 状态位 */
.state { padding: 120rpx 0; color: #86909c; font-size: 26rpx; text-align: center; }
.state-retry { color: #ff5c1e; }

/* 模块停用拦截提示 */
.module-blocked { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; padding: 40rpx; text-align: center; }
.module-blocked-title { color: #1f2937; font-size: 32rpx; font-weight: 600; }
.module-blocked-desc { margin-top: 16rpx; color: #98a2b3; font-size: 26rpx; line-height: 1.6; }
</style>
