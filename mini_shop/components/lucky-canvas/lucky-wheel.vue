<template>
  <view class="lucky-wheel-box" :style="{ width: size + 'px', height: size + 'px' }">
    <canvas
      type="2d"
      id="lucky-wheel-canvas"
      canvas-id="lucky-wheel-canvas"
      class="lucky-wheel-canvas"
      :style="{ width: size + 'px', height: size + 'px' }"
    />
    <!-- 中心抽奖按钮：叠加在 canvas 上层，点击开始抽奖 -->
    <view class="lucky-wheel-btn" @click="handleBtnClick" :style="{ width: btnSize + 'px', height: btnSize + 'px' }">
      <text class="lucky-wheel-btn-text">抽奖</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { getCurrentInstance, onMounted, onUnmounted, ref, watch } from 'vue'
import type { LuckyPrizeVO } from '@/types/lucky'

const props = withDefaults(defineProps<{
  /** 奖品格列表（驱动扇区渲染）。 */
  prizes?: LuckyPrizeVO[]
  /** 圆盘直径（px），默认 300。 */
  size?: number
  /** 中心按钮半径（px），默认 34。 */
  btnRadius?: number
}>(), {
  prizes: () => [],
  size: 300,
  btnRadius: 34,
})

const emit = defineEmits<{ (e: 'start'): void; (e: 'end', index: number): void }>()

const instance = getCurrentInstance()
const size = ref(props.size)
const btnSize = ref((props.btnRadius || 34) * 2)

let canvasNode: any = null
let ctx: any = null
let dpr = 1
let timer: ReturnType<typeof setTimeout> | null = null

/** 当前转动角度（度）。 */
let angle = 0
let animating = false
/** 格子背景色盘。 */
const PALETTE = ['#ffd7d7', '#fff0c9', '#d7f5e0', '#dbe7ff', '#f7e0ff', '#ffe6c9']

function initCanvas(): void {
  uni.createSelectorQuery().in(instance?.proxy).select('#lucky-wheel-canvas')
    .fields({ node: true, size: true })
    .exec((res) => {
      const info = res?.[0]
      if (!info || !info.node) return
      canvasNode = info.node
      const w = info.width || props.size
      const h = info.height || props.size
      canvasNode.width = w * dpr
      canvasNode.height = h * dpr
      ctx = canvasNode.getContext('2d')
      ctx.scale(dpr, dpr)
      size.value = w
      btnSize.value = (props.btnRadius || 34) * 2
      draw()
    })
}

/** 在画布上按当前角度绘制圆盘（分扇区 + 奖品文字，指针固定在顶部）。 */
function draw(): void {
  if (!ctx || !canvasNode) return
  const center = size.value / 2
  const radius = center
  ctx.clearRect(0, 0, size.value, size.value)
  ctx.save()
  ctx.translate(center, center)
  ctx.rotate((angle * Math.PI) / 180)

  const prizes = props.prizes
  const count = prizes.length || 1
  const sector = (Math.PI * 2) / count

  prizes.forEach((prize, i) => {
    const startAngle = i * sector
    const endAngle = startAngle + sector
    // 每格背景
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.arc(0, 0, radius, startAngle, endAngle)
    ctx.closePath()
    ctx.fillStyle = PALETTE[i % PALETTE.length]
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.stroke()

    // 奖品文字（沿扇区外侧径向布置）
    ctx.save()
    ctx.rotate(startAngle + sector / 2)
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#5a4a42'
    ctx.font = 'bold 15px sans-serif'
    const text = prize.name || ''
    ctx.fillText(text, radius - 16, 0)
    ctx.restore()
  })

  // 画外圈描边
  ctx.beginPath()
  ctx.arc(0, 0, radius - 1, 0, Math.PI * 2)
  ctx.lineWidth = 4
  ctx.strokeStyle = '#e5322d'
  ctx.stroke()

  // 顶部指针（固定指向 0 点）
  ctx.beginPath()
  ctx.moveTo(0, -radius)
  ctx.lineTo(-9, -radius + 20)
  ctx.lineTo(9, -radius + 20)
  ctx.closePath()
  ctx.fillStyle = '#e5322d'
  ctx.fill()

  ctx.restore()
}

/** 在 x 度基础上加速 rotate，落到 y 度。 */
function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t)
}

/** 转到目标角度（用 easeOutQuad 缓动）。 */
function rotateTo(index: number, duration: number): void {
  const prizes = props.prizes
  const count = prizes.length || 1
  const sector = 360 / count
  // 目标角度：用 4 圈以上余量，让 index 格的中心对齐顶部指针。
  const base = 360 * 4 + (360 - index * sector - sector / 2)
  const start = angle
  const delta = ((base - (start % 360) + 360) % 360) + 360
  const end = start + delta
  const startTime = Date.now()

  const step = (): void => {
    const t = Math.min(1, (Date.now() - startTime) / duration)
    angle = start + delta * easeOutQuad(t)
    draw()
    if (t < 1) {
      timer = setTimeout(step, 16)
    } else {
      angle = end
      draw()
      animating = false
      emit('end', index)
    }
  }
  timer = setTimeout(step, 16)
}

/** 开始转动（先转到一个随机格，转入动画）。 */
function play(): void {
  if (animating) return
  animating = true
  const idx = Math.floor(Math.random() * (props.prizes.length || 1))
  rotateTo(idx, 2500)
}

/** 停止到指定格：若正在转动则重定向到该格并减速停下。 */
function stop(index: number): void {
  if (timer) { clearTimeout(timer); timer = null }
  animating = true
  rotateTo(index, 1200)
}

function handleBtnClick(): void {
  emit('start')
}

watch(() => props.prizes, () => draw(), { deep: true })

onMounted(() => {
  dpr = uni.getSystemInfoSync().pixelRatio || 2
  setTimeout(() => initCanvas(), 60)
})

onUnmounted(() => {
  if (timer) { clearTimeout(timer); timer = null }
})

defineExpose({ play, stop })
</script>

<style scoped>
.lucky-wheel-box { position: relative; margin: 0 auto; }
.lucky-wheel-canvas { position: absolute; left: 0; top: 0; }
.lucky-wheel-btn {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #e5322d;
  box-shadow: 0 4rpx 12rpx rgba(229, 50, 45, .4);
  z-index: 1;
}
.lucky-wheel-btn-text { color: #fff; font-size: 26rpx; font-weight: 600; }
</style>
