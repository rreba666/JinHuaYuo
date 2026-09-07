<template>
  <view class="welfare-page">
    <!-- 自定义导航栏（悬浮顶部，避开状态栏） -->
    <view class="welfare-nav">
      <view class="welfare-nav-back" @click="goBack">
        <image class="welfare-nav-back-icon" src="/static/left_arrow.png" />
      </view>
      <text class="welfare-nav-title">福利海报</text>
    </view>

    <!-- 整张海报占满页面，用户长按识别图中小程序码 -->
    <view class="welfare-poster-body">
      <image v-if="posterSrc" class="welfare-poster-img" :src="posterSrc" mode="aspectFit" @click="savePoster" />
      <view v-else class="welfare-poster-empty">
        <text class="welfare-poster-empty-text">福利海报暂未配置</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

/** 海报图片 URL（由「更多福利」跳转时通过 query src 传入）。 */
const posterSrc = ref('')

onLoad((options) => {
  posterSrc.value = decodeURIComponent((options?.src || '') as string)
})

/** 返回上一页。 */
function goBack(): void {
  uni.navigateBack({ delta: 1 })
}

/** 保存海报到相册（长按识别之外的兜底：保存后用微信扫一扫-相册，或在相册长按识别）。 */
function savePoster(): void {
  if (!posterSrc.value) return
  uni.downloadFile({
    url: posterSrc.value,
    success: (download) => {
      if (download.statusCode !== 200 || !download.tempFilePath) {
        uni.showToast({ title: `保存失败：${download.statusCode}`, icon: 'none' })
        return
      }
      uni.saveImageToPhotosAlbum({
        filePath: download.tempFilePath,
        success: () => {
          uni.showToast({ title: '已保存到相册', icon: 'success' })
        },
        fail: (error) => {
          uni.showToast({ title: `保存失败：${error?.errMsg || '未知'}`, icon: 'none' })
        },
      })
    },
    fail: (error) => {
      uni.showToast({ title: `下载失败：${error?.errMsg || '未知'}`, icon: 'none' })
    },
  })
}
</script>

<style scoped>
.welfare-page { position: relative; width: 100%; height: 100vh; background: #fff; overflow: hidden; }
.welfare-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 10; display: flex; align-items: center; height: calc(88rpx + var(--status-bar-height)); padding: var(--status-bar-height) 24rpx 0; box-sizing: border-box; background: rgba(0,0,0,.28); }
.welfare-nav-back { width: 44rpx; height: 44rpx; display: flex; align-items: center; }
.welfare-nav-back-icon { width: 34rpx; height: 34rpx; }
.welfare-nav-title { position: absolute; top: var(--status-bar-height); left: 50%; height: 88rpx; line-height: 88rpx; color: #fff; font-size: 30rpx; font-weight: 600; transform: translateX(-50%); }
.welfare-poster-body { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
.welfare-poster-img { width: 100%; height: 100%; }
.welfare-poster-empty { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
.welfare-poster-empty-text { color: #98a2b3; font-size: 26rpx; }
</style>
