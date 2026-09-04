<template>
  <view class="lucky-wheel-box" :style="{ width: boxWidth + 'px', height: boxHeight + 'px' }">
    <canvas
      type="2d"
      id="lucky-wheel-canvas"
      canvas-id="lucky-wheel-canvas"
      :style="{ width: boxWidth + 'px', height: boxHeight + 'px' }"
    />
    <!-- 中心抽奖按钮：点击触发抽奖（由父页面决定开始/停止），始终叠加在 canvas 上层 -->
    <view class="lucky-wheel-btn" @click="handleBtnClick" :style="{ width: btnSize + 'px', height: btnSize + 'px' }">
      <text class="lucky-wheel-btn-text">抽奖</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, onMounted, ref, watch } from 'vue'
import type { LuckyPrizeVO } from '@/types/lucky'
// lucky-canvas 核心引擎（ESM，导出 LuckyWheel）。微信小程序通过 flag='MP-WX' 分支适配 canvas。
import { LuckyWheel } from './lucky-canvas.js'

const props = withDefaults(defineProps<{
  /** 奖品格列表（驱动格子渲染与图/文字）。 */
  prizes?: LuckyPrizeVO[]
  /** 中心按钮半径（px，相对转盘默认 34）。 */
  btnRadius?: number
}>(), {
  prizes: () => [],
  btnRadius: 34,
})

const emit = defineEmits<{ (e: 'start'): void; (e: 'end', index: number): void }>()

const instance = getCurrentInstance()
const boxWidth = ref(300)
const boxHeight = ref(300)
const btnSize = ref((props.btnRadius || 34) * 2)
let myLucky: any = null

// 把奖品转成 luck 格式：有图用图，无图用文字 + 默认背景/文字色。
const prizesConfig = computed(() =>
  props.prizes.map((prize) => ({
    name: prize.name,
    range: 0,
    ...(prize.image ? { imgs: [{ src: prize.image, width: '40%' }] } : {}),
  })),
)

/** 初始化 canvas 并创建 LuckyWheel 实例（微信 2d canvas）。 */
function initCanvas(): void {
  uni.createSelectorQuery().in(instance?.proxy).select('#lucky-wheel-canvas')
    .fields({ node: true, size: true })
    .exec((res) => {
      const info = res?.[0]
      if (!info || !info.node) return
      const canvas = info.node
      const width = info.width
      const height = info.height
      const dpr = uni.getSystemInfoSync().pixelRatio
      canvas.width = width * dpr
      canvas.height = height * dpr
      const ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr)
      boxWidth.value = width
      boxHeight.value = height
      btnSize.value = (props.btnRadius || 34) * 2

      const Radius = Math.min(width, height) / 2
      myLucky = new LuckyWheel({
        flag: 'MP-WX',
        ctx,
        dpr,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        // 以画布中心为原点绘制
        beforeCreate: () => ctx.translate(Radius, Radius),
        beforeResize: () => ctx.translate(-Radius, -Radius),
        afterInit: () => undefined,
        afterStart: () => emit('start'),
      }, {
        width: '100%',
        height: '100%',
        prizes: prizesConfig.value,
        buttons: [{ radius: `${props.btnRadius}px`, background: '#e5322d' }],
        defaultConfig: {
          responsive: false,
          gutter: 0,
          speed: 20,
          accelerationTime: 2500,
          decelerationTime: 2500,
        },
        defaultStyle: {
          fontColor: '#333',
          fontSize: '15px',
          background: '#fff3e8',
        },
        start: () => emit('start'),
        end: (index: number) => emit('end', index),
      })
    })
}

/** 点中心抽奖按钮：发 start 事件，由父页面决定后续开始/停止。 */
function handleBtnClick(): void {
  emit('start')
}

/** 开始旋转（转盘进入加速/匀速阶段，等待外部 stop）。 */
function play(): void {
  myLucky?.play?.()
}

/** 停止到指定格（index：第几格，0 起）。调用前需先 play，后再按接口结果 stop(index)。 */
function stop(index: number): void {
  myLucky?.stop?.(index)
}

watch(prizesConfig, () => {
  if (myLucky) myLucky.prizes = prizesConfig.value
}, { deep: true })

onMounted(() => {
  // 等页面渲染完成再获取 canvas
  setTimeout(() => initCanvas(), 60)
})

defineExpose({ play, stop })
</script>

<style scoped>
.lucky-wheel-box { position: relative; margin: 0 auto; overflow: hidden; }
.lucky-wheel-box canvas { position: absolute; left: 0; top: 0; pointer-events: none; }
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
  cursor: pointer;
  z-index: 1;
}
.lucky-wheel-btn-text { color: #fff; font-size: 26rpx; font-weight: 600; }
</style>
