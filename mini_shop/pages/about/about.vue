<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { createThrottle } from '@/utils/interaction'

const menuTop = ref(0)
const menuHeight = ref(32)
const navigationThrottle = createThrottle(500)
const navStyle = computed(() => ({ top: `${menuTop.value}px`, height: `${menuHeight.value}px` }))
const bodyStyle = computed(() => ({ paddingTop: `${menuTop.value + menuHeight.value + uni.upx2px(20)}px` }))

function goBack(): void {
  if (!navigationThrottle()) return
  uni.navigateBack({ delta: 1 })
}

onMounted(() => {
  try {
    const rect = uni.getMenuButtonBoundingClientRect()
    if (rect) { menuTop.value = rect.top; menuHeight.value = rect.height }
  } catch { /* 非微信环境忽略 */ }
})
</script>

<template>
  <view class="page">
    <view class="nav" :style="navStyle">
      <image class="back" src="/static/left_arrow.png" mode="aspectFit" @click="goBack" />
      <text class="title">关于我们</text>
      <view class="spacer" />
    </view>
    <scroll-view class="scroll" scroll-y :style="bodyStyle">
      <view class="content">
        <view class="brand">
          <image class="logo" src="/static/logo.png" mode="aspectFit" />
          <text class="brand-name">今华有肽</text>
          <text class="brand-slogan">今华有 · 臻选品质人生</text>
        </view>
        <view class="desc">
          <text>今华有（江西）生物科技有限公司，专注健康与品质生活。我们以科技为驱动，甄选优质产品，为每一位用户带来健康、美好的人生体验。</text>
        </view>
        <view class="meta">
          <view class="row"><text class="k">版本</text><text class="v">1.0.0</text></view>
          <view class="row"><text class="k">客服</text><text class="v">微信小程序在线客服</text></view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<style scoped>
.page { position: relative; height: 100vh; overflow: hidden; background: #f5f6f8; color: #172033; font-family: 'PingFang SC', '苹方-简', sans-serif; }
.nav { position: fixed; right: 0; left: 0; z-index: 20; display: flex; align-items: center; padding: 0 32rpx; box-sizing: border-box; background: #f5f6f8; }
.back { width: 34rpx; height: 34rpx; flex-shrink: 0; }
.title { position: absolute; left: 50%; color: #111; font-size: 32rpx; font-weight: 600; transform: translateX(-50%); }
.spacer { width: 34rpx; height: 34rpx; }
.scroll { position: absolute; inset: 0; box-sizing: border-box; }
.content { padding: 40rpx 32rpx; }
.brand { display: flex; flex-direction: column; align-items: center; padding: 40rpx 0; }
.logo { width: 150rpx; height: 150rpx; border-radius: 24rpx; }
.brand-name { margin-top: 20rpx; color: #172033; font-size: 36rpx; font-weight: 700; }
.brand-slogan { margin-top: 10rpx; color: #98a2b3; font-size: 24rpx; }
.desc { margin-top: 30rpx; padding: 28rpx; border-radius: 20rpx; background: #fff; color: #475467; font-size: 26rpx; line-height: 1.7; }
.meta { margin-top: 20rpx; padding: 8rpx 28rpx; border-radius: 20rpx; background: #fff; }
.row { display: flex; align-items: center; justify-content: space-between; padding: 24rpx 0; border-bottom: 1rpx solid #f2f4f7; }
.row:last-child { border-bottom: 0; }
.k { color: #98a2b3; font-size: 26rpx; }
.v { color: #172033; font-size: 26rpx; }
</style>
