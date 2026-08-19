<script setup lang="ts">
import { getCurrentInstance, ref } from 'vue'

interface ImageInfo {
  path: string
}

const props = defineProps<{
  modelValue: boolean
  loading: boolean
  codeUrl: string
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
}>()

const actionLoading = ref(false)
const componentInstance = getCurrentInstance()?.proxy

function close(): void {
  if (!props.loading && !actionLoading.value) emit('update:modelValue', false)
}

function getImageInfo(src: string): Promise<ImageInfo> {
  return new Promise((resolve, reject) => {
    uni.getImageInfo({ src, success: resolve, fail: reject })
  })
}

/** 把海报背景和二维码合成一张 1242x2400 图片，保存/分享时保持设计稿完整。 */
async function createPosterFile(): Promise<string> {
  if (!props.codeUrl) throw new Error('推广码尚未生成')
  const [background, code] = await Promise.all([
    getImageInfo('/static/bg/推广码背景.png'),
    getImageInfo(props.codeUrl),
  ])
  const rpx = (value: number) => uni.upx2px(value)
  const canvasWidth = rpx(621)
  const canvasHeight = rpx(1200)
  const context = uni.createCanvasContext('promotion-code-poster-canvas', componentInstance)
  context.clearRect(0, 0, canvasWidth, canvasHeight)
  context.drawImage(background.path, 0, 0, canvasWidth, canvasHeight)
  context.drawImage(code.path, rpx(114), rpx(686), rpx(392), rpx(392))

  return new Promise((resolve, reject) => {
    context.draw(false, () => {
      uni.canvasToTempFilePath({
        canvasId: 'promotion-code-poster-canvas',
        width: canvasWidth,
        height: canvasHeight,
        destWidth: 1242,
        destHeight: 2400,
        success: (result) => resolve(result.tempFilePath),
        fail: reject,
      }, componentInstance)
    })
  })
}

async function saveToPhone(): Promise<void> {
  if (actionLoading.value || props.loading) return
  actionLoading.value = true
  try {
    const filePath = await createPosterFile()
    await new Promise<void>((resolve, reject) => {
      uni.saveImageToPhotosAlbum({
        filePath,
        success: () => resolve(),
        fail: reject,
      })
    })
    uni.showToast({ title: '已保存到手机', icon: 'success' })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    uni.showToast({ title: message.includes('auth deny') ? '请允许访问相册后重试' : '保存失败，请重试', icon: 'none' })
  } finally {
    actionLoading.value = false
  }
}

async function shareToFriend(): Promise<void> {
  if (actionLoading.value || props.loading) return
  actionLoading.value = true
  try {
    const filePath = await createPosterFile()
    // @ts-ignore 微信小程序分享图片 API
    const wxApi = typeof wx !== 'undefined' ? wx : null
    if (!wxApi || typeof wxApi.showShareImageMenu !== 'function') {
      uni.showToast({ title: '当前微信版本不支持发送图片', icon: 'none' })
      return
    }
    wxApi.showShareImageMenu({
      path: filePath,
      fail: () => uni.showToast({ title: '发送失败，请重试', icon: 'none' }),
    })
  } catch {
    uni.showToast({ title: '图片生成失败，请重试', icon: 'none' })
  } finally {
    actionLoading.value = false
  }
}
</script>

<template>
  <view v-show="modelValue" class="promotion-code-mask" @click="close">
    <view class="promotion-code-dialog" @click.stop>
      <view class="promotion-code-sheet">
        <image class="promotion-code-bg" src="/static/bg/推广码背景.png" mode="aspectFit" />
        <text class="promotion-code-close" @click="close">×</text>
        <view v-show="loading" class="promotion-code-loading">推广码生成中...</view>
        <image v-show="!loading && codeUrl" class="promotion-code-image" :src="codeUrl" mode="aspectFit" />
      </view>
      <view v-show="!loading && codeUrl" class="poster-actions">
        <button class="poster-action poster-save" :disabled="actionLoading" @click="saveToPhone">保存到手机</button>
        <button class="poster-action poster-share" :disabled="actionLoading" @click="shareToFriend">发送给好友</button>
      </view>
      <canvas canvas-id="promotion-code-poster-canvas" class="poster-canvas" />
    </view>
  </view>
</template>

<style>
.promotion-code-mask { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; overflow-y: auto; padding: 20rpx; box-sizing: border-box; background: rgba(0, 0, 0, .62); }
.promotion-code-dialog { display: flex; flex-direction: column; align-items: center; }
.promotion-code-sheet { position: relative; width: 621rpx; height: 1200rpx; padding: 0; box-sizing: border-box; background: transparent; }
.promotion-code-bg { position: absolute; inset: 0; z-index: 0; width: 100%; height: 100%; }
.promotion-code-close { position: absolute; top: 28rpx; right: 34rpx; z-index: 3; color: #fff; font-size: 46rpx; font-weight: 300; line-height: 1; }
.promotion-code-image { position: absolute; top: 686rpx; left: 114rpx; z-index: 1; width: 392rpx; height: 392rpx; }
.promotion-code-loading { position: absolute; top: 686rpx; left: 114rpx; z-index: 1; display: flex; align-items: center; justify-content: center; width: 392rpx; height: 392rpx; color: #959595; font-size: 24rpx; }
.poster-actions { display: flex; gap: 16rpx; width: 621rpx; margin-top: 16rpx; }
.poster-action { flex: 1; height: 76rpx; margin: 0; padding: 0; border-radius: 38rpx; color: #fff; font-size: 25rpx; line-height: 76rpx; }
.poster-action::after { border: 0; }
.poster-save { background: #1677ff; }
.poster-share { background: #07c160; }
.poster-canvas { position: fixed; top: -2000rpx; left: -2000rpx; width: 621rpx; height: 1200rpx; opacity: 0; pointer-events: none; }
</style>
