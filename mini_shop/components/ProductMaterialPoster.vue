<script setup lang="ts">
/**
 * 商品素材海报生成组件
 * 已生成商品的所有轮播图海报（每张轮播图=一张海报，底图=轮播图，右下角嵌推广码），铺开展示。
 * 复用 PromotionCodePoster 的微信 2D canvas 合成逻辑。
 */
import { computed, getCurrentInstance, onMounted, ref, watch } from 'vue'

interface ImageInfo { path: string; width?: number; height?: number }
interface CanvasImageNode { src: string; onload: (() => void) | null; onerror: (() => void) | null }
interface PosterCanvasContext { clearRect(x: number, y: number, w: number, h: number): void; fillRect(x: number, y: number, w: number, h: number): void; fillStyle: string; drawImage(image: CanvasImageNode, ...args: number[]): void; save(): void; restore(): void; beginPath(): void; arc(x: number, y: number, r: number, s: number, e: number): void; clip(): void }
interface PosterCanvasNode {
  width: number
  height: number
  createImage(): CanvasImageNode
  getContext(type: '2d'): PosterCanvasContext
  requestAnimationFrame?(cb: () => void): void
}

/** 画布尺寸（海报比例，与推广海报一致）。 */
const CANVAS_WIDTH = 1000
const CANVAS_HEIGHT = 1176
/** 右下角小程序码的边距与尺寸。 */
const CODE_MARGIN = 96
const CODE_SIZE = 220

const props = defineProps<{
  modelValue: boolean
  loading: boolean
  codeUrl: string
  /** 商品的轮播图（每张生成一张海报） */
  images: string[]
  productName?: string
}>()

const emit = defineEmits<{ (event: 'update:modelValue', value: boolean): void }>()

const posterList = ref<{ path: string; image: string }[]>([])
const posterLoading = ref(false)
const actionLoading = ref(false)
const componentInstance = getCurrentInstance()?.proxy
const capsuleBottom = ref(uni.upx2px(96))
const maskStyle = computed(() => ({
  paddingTop: `${capsuleBottom.value + uni.upx2px(12)}px`,
  paddingBottom: `${uni.upx2px(24)}px`,
}))

onMounted(() => {
  try {
    const rect = uni.getMenuButtonBoundingClientRect()
    if (rect?.bottom) capsuleBottom.value = rect.bottom
  } catch { /* 非微信环境默认 */ }
})

watch(() => props.modelValue, (open) => {
  // 打开即重新生成（清空旧商品海报，避免切换商品后残留旧图）
  if (open && props.images.length) void generate()
})

function close(): void {
  if (!props.loading && !posterLoading.value && !actionLoading.value) emit('update:modelValue', false)
}

function getImageInfo(src: string): Promise<ImageInfo> {
  return new Promise((resolve, reject) => uni.getImageInfo({ src, success: resolve, fail: reject }))
}

function getCanvasNode(): Promise<PosterCanvasNode> {
  return new Promise((resolve, reject) => {
    try {
      // @ts-ignore 微信小程序 2D canvas
      const wxApi = typeof wx !== 'undefined' ? wx : null
      if (!wxApi || typeof wxApi.createSelectorQuery !== 'function') { reject(new Error('当前环境不支持海报画布')); return }
      const query = componentInstance ? wxApi.createSelectorQuery().in(componentInstance) : wxApi.createSelectorQuery()
      query.select('#product-material-poster-canvas').fields({ node: true, size: true }).exec((result: Array<{ node?: PosterCanvasNode }>) => {
        const canvas = result?.[0]?.node
        if (!canvas) { reject(new Error('海报画布初始化失败')); return }
        resolve(canvas)
      })
    } catch (error) { reject(error) }
  })
}

function loadCanvasImage(canvas: PosterCanvasNode, src: string): Promise<CanvasImageNode> {
  return new Promise((resolve, reject) => {
    const image = canvas.createImage()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('海报图片加载失败'))
    image.src = src
  })
}

function loadCanvasImageWithFallback(canvas: PosterCanvasNode, src: string): Promise<CanvasImageNode> {
  return loadCanvasImage(canvas, src)
}

function waitForPaint(canvas: PosterCanvasNode): Promise<void> {
  return new Promise((resolve) => {
    const done = () => setTimeout(resolve, 150)
    if (typeof canvas.requestAnimationFrame === 'function') canvas.requestAnimationFrame?.(done)
    else done()
  })
}

function exportCanvas(canvas: PosterCanvasNode): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // @ts-ignore
      const wxApi = typeof wx !== 'undefined' ? wx : null
      if (!wxApi || typeof wxApi.canvasToTempFilePath !== 'function') { reject(new Error('当前环境不支持海报导出')); return }
      const w = canvas.width || CANVAS_WIDTH
      const h = canvas.height || CANVAS_HEIGHT
      wxApi.canvasToTempFilePath({
        canvas,
        x: 0, y: 0, width: w, height: h,
        destWidth: w, destHeight: h,
        success: (result: { tempFilePath: string }) => resolve(result.tempFilePath),
        fail: reject,
      }, componentInstance)
    } catch (error) { reject(error) }
  })
}

/**
 * 把小程序码的白底转透明（黑色码块保留、白底 alpha 置 0），失败返回 null 由调用方回退原图。
 */
async function makeCodeTransparent(src: string): Promise<unknown> {
  try {
    // @ts-ignore
    const wxApi = typeof wx !== 'undefined' ? wx : null
    if (!wxApi || typeof wxApi.createOffscreenCanvas !== 'function') return null
    // @ts-ignore
    const off = wxApi.createOffscreenCanvas({ type: '2d', width: 200, height: 200 })
    const img = off.createImage()
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('码图加载失败')); img.src = src })
    const w = img.width || 200
    const h = img.height || 200
    off.width = w
    off.height = h
    const ctx = off.getContext('2d')
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    const imageData = ctx.getImageData(0, 0, w, h)
    const data = imageData.data
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200) data[i + 3] = 0
    }
    ctx.putImageData(imageData, 0, 0)
    return off
  } catch (error) {
    console.warn('[ProductMaterialPoster] 码图去白底失败，使用原图:', error)
    return null
  }
}

/**
 * 用一张商品轮播图 + 推广码合成一张海报。
 * 商品图为底图，按 aspectFit 完整显示；推广码画在商品图区域内部右下角（透明背景）。
 */
async function composePoster(canvas: PosterCanvasNode, imageUrl: string, codeLocalPath: string): Promise<string> {
  const info = await getImageInfo(imageUrl)
  const imgW = info.width || 0
  const imgH = info.height || 0
  // 画布宽度固定，高度按商品图比例自适应：长图撑满、无白边
  const canvasHeight = imgW > 0 && imgH > 0 ? Math.max(CANVAS_HEIGHT, Math.round((CANVAS_WIDTH * imgH) / imgW)) : CANVAS_HEIGHT
  canvas.width = CANVAS_WIDTH
  canvas.height = canvasHeight
  const background = await loadCanvasImageWithFallback(canvas, info.path || imageUrl)
  const code = await loadCanvasImageWithFallback(canvas, codeLocalPath)
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, CANVAS_WIDTH, canvasHeight)
  // 图片按画布比例完整撑满（画布比例=图片比例，无白边、不变形）
  ctx.drawImage(background, 0, 0, CANVAS_WIDTH, canvasHeight)
  // 小程序码：圆形、右下角（在画布=图片内），原样
  const codeSize = Math.min(CODE_SIZE, CANVAS_WIDTH * 0.26, canvasHeight * 0.26)
  const codeX = CANVAS_WIDTH - codeSize - CODE_MARGIN
  const codeY = canvasHeight - codeSize - CODE_MARGIN
  ctx.save()
  ctx.beginPath()
  ctx.arc(codeX + codeSize / 2, codeY + codeSize / 2, codeSize / 2, 0, Math.PI * 2)
  ctx.clip()
  ctx.drawImage(code, codeX, codeY, codeSize, codeSize)
  ctx.restore()
  await waitForPaint(canvas)
  return exportCanvas(canvas)
}

/** 为商品的每一张轮播图各生成一张海报。 */
async function generate(): Promise<void> {
  if (posterLoading.value || !props.codeUrl || !props.images.length) return
  posterLoading.value = true
  posterList.value = []   // 清空上次商品海报，避免切换商品后残留旧图
  try {
    const codeInfo = await getImageInfo(props.codeUrl)
    const canvas = await getCanvasNode()
    const result: { path: string; image: string }[] = []
    for (const image of props.images) {
      if (!image) continue
      try {
        const path = await composePoster(canvas, image, codeInfo.path)
        result.push({ path, image })
      } catch (error) {
        console.warn('[ProductMaterialPoster] image compose failed:', image, error)
      }
    }
    posterList.value = result
    if (!result.length) uni.showToast({ title: '海报生成失败', icon: 'none' })
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '海报生成失败', icon: 'none' })
  } finally {
    posterLoading.value = false
  }
}

async function saveToPhone(path: string): Promise<void> {
  if (actionLoading.value || props.loading) return
  actionLoading.value = true
  try {
    await new Promise<void>((resolve, reject) => {
      uni.saveImageToPhotosAlbum({ filePath: path, success: () => resolve(), fail: reject })
    })
    uni.showToast({ title: '已保存到手机', icon: 'success' })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    uni.showToast({ title: message.includes('auth deny') ? '请允许访问相册后重试' : '保存失败，请重试', icon: 'none' })
  } finally { actionLoading.value = false }
}

async function shareToFriend(path: string): Promise<void> {
  if (actionLoading.value || props.loading) return
  actionLoading.value = true
  try {
    // @ts-ignore
    const wxApi = typeof wx !== 'undefined' ? wx : null
    if (!wxApi || typeof wxApi.showShareImageMenu !== 'function') { uni.showToast({ title: '当前微信版本不支持发送图片', icon: 'none' }); return }
    wxApi.showShareImageMenu({ path, fail: () => uni.showToast({ title: '发送失败，请重试', icon: 'none' }) })
  } catch (error) {
    uni.showToast({ title: '图片生成失败，请重试', icon: 'none' })
  } finally { actionLoading.value = false }
}
</script>

<template>
  <view v-if="modelValue" class="poster-mask" :style="maskStyle" @click="close">
    <view class="poster-dialog" @click.stop>
      <view class="poster-head">
        <text class="poster-title">{{ productName ? productName + ' · 商品素材' : '商品素材' }}</text>
        <text class="poster-close" @click="close">×</text>
      </view>

      <view v-show="loading || posterLoading" class="poster-loading">海报生成中...</view>

      <scroll-view v-show="!loading && !posterLoading && posterList.length" class="poster-scroll" scroll-y>
        <view v-for="(item, index) in posterList" :key="item.path" class="poster-card">
          <image class="poster-image" :src="item.path" mode="widthFix" />
          <view class="poster-actions">
            <button class="poster-action poster-save" :disabled="actionLoading" @click="saveToPhone(item.path)">保存到手机</button>
            <button class="poster-action poster-share" :disabled="actionLoading" @click="shareToFriend(item.path)">发送给好友</button>
          </view>
        </view>
        <view v-if="!posterList.length" class="poster-empty">该商品暂无轮播图素材</view>
      </scroll-view>

      <canvas type="2d" id="product-material-poster-canvas" class="poster-canvas" />
    </view>
  </view>
</template>

<style scoped>
.poster-mask { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, .62); box-sizing: border-box; }
.poster-dialog { display: flex; flex-direction: column; width: 660rpx; max-height: 90vh; background: #fff; border-radius: 20rpx; overflow: hidden; }
.poster-head { position: relative; display: flex; align-items: center; justify-content: center; min-height: 88rpx; border-bottom: 1rpx solid #f0f0f0; }
.poster-title { color: #222; font-size: 30rpx; font-weight: 600; }
.poster-close { position: absolute; right: 24rpx; color: #888; font-size: 42rpx; line-height: 1; }
.poster-loading { padding: 120rpx 0; color: #959595; font-size: 26rpx; text-align: center; }
.poster-scroll { max-height: 70vh; padding: 20rpx 24rpx; box-sizing: border-box; }
.poster-card { margin-bottom: 24rpx; }
.poster-image { display: block; width: 100%; background: #f7f8fa; border-radius: 12rpx; }
.poster-actions { display: flex; gap: 16rpx; margin-top: 12rpx; }
.poster-action { flex: 1; height: 68rpx; margin: 0; padding: 0; border-radius: 34rpx; color: #fff; font-size: 24rpx; line-height: 68rpx; }
.poster-action::after { border: 0; }
.poster-save { background: #1677ff; }
.poster-share { background: #07c160; }
.poster-empty { padding: 100rpx 0; color: #959595; font-size: 26rpx; text-align: center; }
.poster-canvas { position: fixed; left: -9999px; top: 0; width: 188px; height: 250px; }
</style>
