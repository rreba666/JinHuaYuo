<template>
  <view class="lucky-page">
    <view class="lucky-nav">
      <view class="nav-back" @click="goBack">‹</view>
      <text class="nav-title">{{ config.name || '大转盘' }}</text>
      <view class="nav-space" />
    </view>

    <view v-if="!config" class="lucky-none">
      <text class="lucky-none-text">当前没有进行中的抽奖活动</text>
    </view>

    <view v-else class="lucky-body">
      <LuckyWheel
        ref="wheelRef"
        class="lucky-wheel"
        :size="wheelSize"
        :prizes="prizes"
        @start="onStart"
        @end="onEnd"
      />
      <text v-if="!isLoggedIn()" class="remain">登录后可参与抽奖</text>

      <view v-if="config.description" class="rule-card">
        <text class="rule-title">活动规则</text>
        <text class="rule-text">{{ config.description }}</text>
      </view>
    </view>

    <view v-if="config" class="record-section">
      <text class="record-title">我的抽奖记录</text>
      <view v-if="records.length" class="record-list">
        <view v-for="record in records" :key="record.id" class="record-item">
          <view class="record-main">
            <text class="record-prize">{{ record.won ? (record.prizeName || '') : '未中奖' }}</text>
            <text v-if="record.activityName" class="record-sub">活动：{{ record.activityName }}</text>
            <text v-if="record.verifyCode" class="record-code">核销码：{{ record.verifyCode }}</text>
          </view>
          <view class="record-right">
            <text v-if="record.status" class="record-status" :class="{ 'record-status-ok': record.status === 'VERIFIED' }">{{ record.status === 'VERIFIED' ? '已核销' : '待核销' }}</text>
            <text class="record-time">{{ record.createTime }}</text>
          </view>
        </view>
      </view>
      <view v-else class="record-empty">暂无抽奖记录</view>
    </view>

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
const wheelSize = Math.min(Math.floor((uni.getSystemInfoSync().windowWidth || 375) - 32), 320)
const config = ref<LuckyConfigVO | null>(null)
const prizes = ref<LuckyPrizeVO[]>([])
const records = ref<LuckyRecord[]>([])
const loginVisible = ref(false)
const drawing = ref(false)
const useMock = true

const activable = computed(() => !!config.value)

function goBack(): void {
  uni.navigateBack()
}

async function loadConfig(): Promise<void> {
  try {
    config.value = useMock ? LUCKY_MOCK_CONFIG : await getLuckyConfig()
  } catch {
    config.value = LUCKY_MOCK_CONFIG
  }
  prizes.value = config.value?.prizes || []
}

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

function prizeIndex(prizeId: number): number {
  const idx = prizes.value.findIndex((p) => p.prizeId === prizeId)
  return idx >= 0 ? idx : (prizes.value.length - 1)
}

function onStart(): void {
  if (drawing.value) return
  if (!isLoggedIn()) {
    loginVisible.value = true
    return
  }
  if (!activable.value) {
    uni.showToast({ title: '当前没有进行中的抽奖活动', icon: 'none' })
    return
  }
  drawing.value = true

  const startRotate = (index: number): void => {
    wheelRef.value?.play?.()
    setTimeout(() => wheelRef.value?.stop?.(index), 40)
  }

  if (useMock) {
    const result = mockLuckyDraw()
    const idx = result.won ? prizeIndex(result.prizeId!) : prizeIndexForThanks()
    startRotate(idx)
    return
  }
  drawLucky()
    .then((result) => {
      const idx = result.won ? prizeIndex(result.prizeId!) : prizeIndexForThanks()
      startRotate(idx)
    })
    .catch((e) => {
      drawing.value = false
      uni.showToast({ title: e?.message || '抽奖失败，请稍后重试', icon: 'none' })
    })
}

function prizeIndexForThanks(): number {
  const idx = prizes.value.findIndex((p) => /谢谢参与/.test((p.level || '') + (p.name || '')))
  return idx >= 0 ? idx : (prizes.value.length - 1)
}

function onEnd(index: number): void {
  drawing.value = false
  const hit = prizes.value[index]
  uni.showToast({ title: `${hit?.level || hit?.name || '未中奖'}`, icon: 'none' })
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
.lucky-none { display: flex; align-items: center; justify-content: center; min-height: 60vh; }
.lucky-none-text { color: #9a8a82; font-size: 28rpx; }
.lucky-body { display: flex; flex-direction: column; align-items: center; padding: 40rpx 32rpx; }
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