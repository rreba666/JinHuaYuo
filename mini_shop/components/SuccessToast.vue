<template>
  <view v-if="visible" class="us-toast-mask" :class="{ 'is-leaving': leaving }">
    <view class="us-toast">
      <view class="us-toast-icon"><text class="us-toast-icon-check">✓</text></view>
      <text class="us-toast-title">{{ title }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onUnmounted, ref } from 'vue'

/** 自定义成功提示：居中深色圆角卡片 + 绿色对勾 + 白字 + 淡入淡出。替代原生 uni.showToast(icon:'success')。 */
const visible = ref(false)
const leaving = ref(false)
const title = ref('')
let hideTimer: ReturnType<typeof setTimeout> | null = null
let leavingTimer: ReturnType<typeof setTimeout> | null = null

/** 显示一条成功提示，约 1.5s 后淡出。 */
function show(text: string): void {
  title.value = text
  leaving.value = false
  visible.value = true
  if (hideTimer) clearTimeout(hideTimer)
  if (leavingTimer) clearTimeout(leavingTimer)
  hideTimer = setTimeout(() => {
    leaving.value = true
    leavingTimer = setTimeout(() => {
      visible.value = false
      leaving.value = false
    }, 220)
  }, 1500)
}

onUnmounted(() => {
  if (hideTimer) clearTimeout(hideTimer)
  if (leavingTimer) clearTimeout(leavingTimer)
})

defineExpose({ show })
</script>

<style scoped>
.us-toast-mask { position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center; pointer-events: none; opacity: 1; transition: opacity .22s ease; }
.us-toast-mask.is-leaving { opacity: 0; }
.us-toast { display: flex; flex-direction: column; align-items: center; min-width: 240rpx; padding: 30rpx 40rpx; border-radius: 20rpx; background: rgba(0,0,0,.78); box-shadow: 0 10rpx 30rpx rgba(0,0,0,.18); }
.us-toast-icon { display: flex; align-items: center; justify-content: center; width: 76rpx; height: 76rpx; border-radius: 50%; background: linear-gradient(135deg, #07c160, #0aa74f); }
.us-toast-icon-check { color: #fff; font-size: 48rpx; font-weight: 700; line-height: 1; }
.us-toast-title { margin-top: 20rpx; color: #fff; font-size: 28rpx; }
</style>
