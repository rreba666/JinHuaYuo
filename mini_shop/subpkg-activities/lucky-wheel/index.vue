<template>
  <view class="lucky-page">
    <!-- 顶部导航 -->
    <view class="lucky-nav">
      <view class="nav-back" @click="goBack">‹</view>
      <text class="nav-title">大转盘</text>
      <view class="nav-space" />
    </view>

    <!-- 活动区 -->
    <view class="lucky-body">
      <text v-if="!activable" class="lucky-tip">活动暂未开始或已结束</text>
      <LuckyWheel
        ref="wheelRef"
        class="lucky-wheel"
        :size="wheelSize"
        :prizes="prizes"
        @start="onStart"
        @end="onEnd"
      />
      <text v-if="isLoggedIn()" class="remain">剩余抽奖次数：{{ remainCount }}</text>
      <text v-else class="remain">登录后可参与抽奖</text>

      <view v-if="rule" class="rule-card">
        <text class="rule-title">活动规则</text>
        <text class="rule-text">{{ rule }}</text>
      </view>
    </view>

    <!-- 我的中奖记录 -->
    <view class="record-section">
      <text class="record-title">我的中奖记录</text>
      <view v-if="records.length" class="record-list">
        <view v-for="record in records" :key="record.id" class="record-item">
          <view class="record-main">
            <text class="record-prize">{{ record.prizeName }}</text>
            <text v-if="record.activityName" class="record-sub">活动：{{ record.activityName }}</text>
            <text v-if="record.verifyCode" class="record-code">自提码：{{ record.verifyCode }}</text>
          </view>
          <view class="record-right">
            <text class="record-status" :class="{ 'record-status-ok': record.status === 'VERIFIED' }">{{ record.statusDesc || (record.status === 'VERIFIED' ? '已核销' : '待自提') }}</text>
            <text class="record-time">{{ record.createTime }}</text>
          </view>
        </view>
      </view>
      <view v-else class="record-empty">暂无中奖记录</view>
    </view>

    <!-- 登录引导 -->
    <LoginGuide v-model="loginVisible" />
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import LuckyWheel from '@/components/lucky-canvas/lucky-wheel.vue'
import LoginGuide from '@/components/LoginGuide.vue'
import { getLuckyConfig, drawLucky, getLuckyRecords } from '@/api/lucky'
import { LUCKY_MOCK_CONFIG, LUCKY_MOCK_RECORDS, mockLuckyDraw } from '@/utils/lucky-mock'
import { isLoggedIn } from '@/utils/auth'
import type { LuckyConfigVO, LuckyRecord, LuckyPrizeVO } from '@/types/lucky'

const wheelRef = ref<InstanceType<typeof LuckyWheel> | null>(null)
/** 转盘边长（px）：按屏宽计算，两侧留 16px 边距。 */
const wheelSize = Math.min(Math.floor((uni.getSystemInfoSync().windowWidth || 375) - 32), 320)
const config = ref<LuckyConfigVO>(LUCKY_MOCK_CONFIG)
const prizes = ref<LuckyPrizeVO[]>([])
const remainCount = ref(0)
const rule = ref('')
const records = ref<LuckyRecord[]>([])
const loginVisible = ref(false)
/** 抽奖中锁定，避免连点。 */
const drawing = ref(false)
/** 是否走真实接口（true=用本地 mock 演示，后端就绪后改为 false）。 */
const useMock = true

/** 活动是否可抽：开启且（mock 下不再校验剩余次数边界由前端处理，真实接口由后端校验）。 */
const activable = computed(() => Number(config.value.enabled) === 1)

function goBack(): void {
  uni.navigateBack()
}

/** 加载活动配置（成功用真实/mock，失败回退 mock 保证页面可展示）。 */
async function loadConfig(): Promise<void> {
  try {
    config.value = useMock ? LUCKY_MOCK_CONFIG : await getLuckyConfig()
  } catch {
    config.value = LUCKY_MOCK_CONFIG
  }
  prizes.value = config.value.prizes || []
  remainCount.value = Number(config.value.remainCount || 0)
  rule.value = config.value.rule || ''
}

/** 加载我的中奖记录。 */
async function loadRecords(): Promise<void> {
  if (useMock) {
    records.value = [...LUCKY_MOCK_RECORDS]
    return
  }
  try {
    const page = await getLuckyRecords(1, 20)
    records.value = page.list || []
  } catch {
    records.value = []
  }
}

/** 点中心抽奖按钮（组件 emit @start）：校验登录/可抽，先 play 再按结果 stop。 */
function onStart(): void {
  if (drawing.value) return
  if (!isLoggedIn()) {
    loginVisible.value = true
    return
  }
  if (!activable.value) {
    uni.showToast({ title: '活动暂未开始或已结束', icon: 'none' })
    return
  }
  drawing.value = true

  const startRotate = (index: number): void => {
    wheelRef.value?.play?.()
    // 稍后按后端/mock 返回的索引停止，让转盘先进入转动。
    setTimeout(() => wheelRef.value?.stop?.(index), 40)
  }

  if (useMock) {
    const result = mockLuckyDraw()
    startRotate(result.prizeIndex)
    return
  }
  drawLucky()
    .then((result) => startRotate(result.prizeIndex))
    .catch((e) => {
      drawing.value = false
      uni.showToast({ title: e?.message || '抽奖失败，请稍后重试', icon: 'none' })
    })
}

/** 转盘停止到指定格后回调。 */
function onEnd(index: number): void {
  drawing.value = false
  const hit = prizes.value.find((p) => p.index === index)
  uni.showToast({ title: `中奖：${hit?.name || '谢谢参与'}`, icon: 'none' })
  remainCount.value = Math.max(0, remainCount.value - 1)
  void loadRecords()
}

onLoad(() => {
  void loadConfig()
  void loadRecords()
})
</script>

<style scoped>
.lucky-page { min-height: 100vh; padding-bottom: 40rpx; box-sizing: border-box; background: linear-gradient(180deg, #fff7f2 0%, #ffe9e2 100%); }
.lucky-nav { display: flex; align-items: center; justify-content: space-between; height: 88rpx; padding: 0 24rpx; box-sizing: border-box; }
.nav-back { width: 60rpx; font-size: 40rpx; color: #333; }
.nav-title { font-size: 32rpx; font-weight: 600; color: #333; }
.nav-space { width: 60rpx; }
.lucky-body { display: flex; flex-direction: column; align-items: center; padding: 40rpx 32rpx; }
.lucky-tip { margin-bottom: 24rpx; color: #c97b6a; font-size: 26rpx; }
.lucky-wheel { margin-top: 20rpx; }
.remain { margin-top: 32rpx; color: #8a5a4a; font-size: 28rpx; }
.rule-card { width: 100%; margin-top: 40rpx; padding: 28rpx 32rpx; border-radius: 16rpx; background: #fff; box-sizing: border-box; }
.rule-title { display: block; margin-bottom: 12rpx; color: #a54f3c; font-size: 28rpx; font-weight: 600; }
.rule-text { color: #6b5a52; font-size: 26rpx; line-height: 40rpx; white-space: pre-wrap; }
.record-section { padding: 32rpx; }
.record-title { display: block; margin-bottom: 20rpx; color: #a54f3c; font-size: 28rpx; font-weight: 600; }
.record-item { display: flex; align-items: flex-start; justify-content: space-between; padding: 24rpx 0; border-bottom: 1rpx solid #f0e0da; }
.record-main { display: flex; flex: 1; min-width: 0; flex-direction: column; }
.record-prize { color: #333; font-size: 28rpx; font-weight: 500; }
.record-sub { margin-top: 8rpx; color: #9a8a82; font-size: 24rpx; }
.record-code { margin-top: 6rpx; color: #a54f3c; font-size: 24rpx; font-weight: 500; }
.record-right { display: flex; flex-direction: column; align-items: flex-end; margin-left: 16rpx; }
.record-status { color: #c97b6a; font-size: 24rpx; }
.record-status-ok { color: #5a9a6a; }
.record-time { margin-top: 8rpx; color: #9a8a82; font-size: 24rpx; }
.record-empty { padding: 40rpx 0; color: #9a8a82; font-size: 26rpx; text-align: center; }
</style>
