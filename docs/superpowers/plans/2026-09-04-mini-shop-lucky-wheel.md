# 今华有肽 大转盘抽奖活动（小程序端）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 mini_shop 小程序端搭建"大转盘抽奖"活动页（lucky-canvas 转盘 + 抽奖动画 + 中奖记录），个人页加入口，并预留接口对接位（先用本地 mock 跑通）。

**Architecture:** 用 lucky-canvas 核心（`lucky-canvas.js`）在 HBuilderX-only 工程里作为自带组件实现大转盘；新增分包页面 `subpkg-activities/lucky-wheel/index.vue`，通过 `api/lucky.ts` 封装接口；接口未就绪时用 `utils/lucky-mock.ts` 的 mock 配置渲染与假中奖。抽奖结果以 mock/后端返回的 `prizeIndex` 为准驱动动画。

**Tech Stack:** uni-app（HBuilderX-only，无 npm build）、Vue3 `<script setup>` + TS、微信 2D canvas（`canvas type="2d"`）、lucky-canvas。

## Global Constraints

- 工程为 `E:\work\JJ\project\mini_shop`（今华有肽），**与 LonPin 无关**。
- HBuilderX-only，无根 package.json，所有改动需用户在 HBuilderX 重新编译验证；lucky-canvas 以**自带组件文件**形式放入，不依赖 npm install。
- 抽奖结果以 `prizeIndex`（服务端/mock 返回）为准，前端不做随机。
- 需登录才能抽奖；未登录点抽奖弹登录引导。
- 代码注释用中文；接口封装风格参照 `mini_shop/api/user.ts`（`request<T>` + `{ url, method, data }`）。
- 统一包裹 `{ code, message, data, success }`；`code !== 0` 抛 `ApiRequestError`。
- 每次改动在 HBuilderX 无法自动验证，需用户重新编译；但 mini_shop 有单测，`mini_shop/tests/` 有 `*.test.ts`。

---

## 文件结构

- `mini_shop/components/lucky-canvas/lucky-canvas.js` — lucky-canvas 核心引擎（微信小程序 UMD，`LuckyWheel`）。从 npm 包 `lucky-canvas@1.7.27` 的 `dist/lucky-canvas.js` 复制。
- `mini_shop/components/lucky-canvas/lucky-wheel.vue` — Vue3 适配的转盘组件（封装 `LuckyWheel`，暴露 `blocks/prizes/buttons/config` + `play/stop` 方法 + `end`/`start` 事件）。
- `mini_shop/pages.json` — 注册分包 `subpkg-activities/lucky-wheel`。
- `mini_shop/types/lucky.ts` — 类型定义（`LuckyConfigVO`/`LuckyPrizeVO`/`LuckyDrawVO`/`LuckyRecord`/分页）。
- `mini_shop/api/lucky.ts` — 接口封装（`getLuckyConfig`/`drawLucky`/`getLuckyRecords`）。
- `mini_shop/utils/lucky-mock.ts` — 本地 mock 配置与假抽奖。
- `mini_shop/subpkg-activities/lucky-wheel/index.vue` — 大转盘活动页。
- `mini_shop/pages/mine/mine.vue` — 个人页加"大转盘"入口。

---

### Task 1: 引入 lucky-canvas 核心引擎

**Files:**
- Create: `mini_shop/components/lucky-canvas/lucky-canvas.js` （从 `C:\Users\RE-儿~1\AppData\Local\Temp\dsh-7hofvS\lucky-core-extract\package\dist\lucky-canvas.js` 复制）

**Interfaces:**
- Produces: `window.LuckyWheel`（UMD 全局，供 `lucky-wheel.vue` 引用）。

- [ ] **Step 1: 复制核心引擎文件**

将已解压的 `lucky-canvas.js`（微信小程序 UMD 包）复制到 `mini_shop/components/lucky-canvas/lucky-canvas.js`。（源文件在 npm 包临时解压目录，已在上一环节解压；若不存在则用 `E:\work\JJ\project` 下的 tgz 重新解压。）

- [ ] **Step 2: 确认文件存在**

Run: `Get-ChildItem E:\work\JJ\project\mini_shop\components\lucky-canvas` — 应看到 `lucky-canvas.js`。

- [ ] **Step 3: 添加中文注释说明来源**

在文件名上方用注释标注来源与版本：

```js
// lucky-canvas 核心引擎（微信小程序 UMD 版） 版本 1.7.27
// 来源: https://github.com/buuing/lucky-canvas  对应 npm 包 lucky-canvas@1.7.27
// 本文件为自包含引擎，导出 global.LuckyWheel，供 Vue 转盘组件调用。
```

- [ ] **Step 4: 提交**

```bash
git add mini_shop/components/lucky-canvas/lucky-canvas.js
git commit -m "feat(mini_shop): 引入 lucky-canvas 1.7.27 核心引擎"
```

---

### Task 2: 类型定义

**Files:**
- Create: `mini_shop/types/lucky.ts`

**Interfaces:**
- Consumes: 无。
- Produces: `LuckyPrizeVO`, `LuckyConfigVO`, `LuckyDrawVO`, `LuckyRecord`, `LuckyRecordPage`。供 `api/lucky.ts` 与 `index.vue` 使用。

- [ ] **Step 1: 编写类型定义**

```ts
/** 奖品类型：REAL=实物 INTEGRAL=积分 COUPON=优惠券 NONE=谢谢参与。 */
export type LuckyPrizeType = 'REAL' | 'INTEGRAL' | 'COUPON' | 'NONE'

/** 奖品（对应 LuckyPrizeVO）。 */
export interface LuckyPrizeVO {
  /** 格位索引（0 起）。 */
  index: number
  /** 奖品名称。 */
  name: string
  /** 奖品图片 URL（可空）。 */
  image?: string
  /** 概率权重（展示/配置用，抽奖由后端决定）。 */
  weight?: number
  /** 奖品类型。 */
  type?: LuckyPrizeType
  /** 是否谢谢参与兜底格。 */
  isDefault?: boolean
}

/** 活动配置（对应 LuckyConfigVO）。 */
export interface LuckyConfigVO {
  /** 活动 ID（字符串）。 */
  id: string
  /** 1=开启 0=关闭。 */
  enabled: number
  /** 开始时间 yyyy-MM-dd HH:mm:ss。 */
  startTime: string
  /** 结束时间 yyyy-MM-dd HH:mm:ss。 */
  endTime: string
  /** 每人每日抽奖次数上限。 */
  dailyCount: number
  /** 当前用户今日剩余次数。 */
  remainCount: number
  /** 活动规则文案。 */
  rule: string
  /** 奖品列表（按 index 排序）。 */
  prizes: LuckyPrizeVO[]
}

/** 抽奖结果（对应 LuckyDrawVO）。 */
export interface LuckyDrawVO {
  /** 命中的格位索引（驱动转盘指针）。 */
  prizeIndex: number
  /** 奖品名称。 */
  prizeName: string
  /** 奖品类型。 */
  prizeType: LuckyPrizeType
  /** 中奖记录 ID（字符串）。 */
  recordId: string
}

/** 中奖记录（对应 LuckyRecordVO）。 */
export interface LuckyRecord {
  /** 记录 ID（字符串）。 */
  id: string
  /** 奖品名称。 */
  prizeName: string
  /** 格位索引。 */
  prizeIndex: number
  /** 奖品类型。 */
  prizeType: LuckyPrizeType
  /** 状态：UNCLAIMED=待领取 CLAIMED=已领取 SHIPPED=已发奖 EXPIRE=已过期。 */
  status: string
  /** 时间 yyyy-MM-dd HH:mm:ss。 */
  createTime: string
}

/** 中奖记录分页结果。 */
export interface LuckyRecordPage {
  total: number
  list: LuckyRecord[]
  page: number
  pageSize: number
}
```

- [ ] **Step 2: 提交**

```bash
git add mini_shop/types/lucky.ts
git commit -m "feat(mini_shop): 新增大转盘类型定义"
```

---

### Task 3: 接口封装

**Files:**
- Create: `mini_shop/api/lucky.ts`

**Interfaces:**
- Consumes: `@/utils/request` 的 `request`；`@/types/lucky` 的 `LuckyConfigVO`/`LuckyDrawVO`/`LuckyRecordPage`。
- Produces: `getLuckyConfig(): Promise<LuckyConfigVO>`, `drawLucky(): Promise<LuckyDrawVO>`, `getLuckyRecords(page, pageSize): Promise<LuckyRecordPage>`。

- [ ] **Step 1: 编写接口封装**

```ts
import { request } from '@/utils/request'
import type { LuckyConfigVO, LuckyDrawVO, LuckyRecordPage } from '@/types/lucky'

/** 查询活动配置（返回配置与奖品，登录态下含今日剩余次数）。 */
export function getLuckyConfig(): Promise<LuckyConfigVO> {
  return request<LuckyConfigVO>({ url: '/api/lucky/config', method: 'GET' })
}

/** 抽奖：后端按权重/内定返回中奖格位索引。 */
export function drawLucky(): Promise<LuckyDrawVO> {
  return request<LuckyDrawVO>({ url: '/api/lucky/draw', method: 'POST', data: {} })
}

/** 分页查询当前用户的中奖记录。 */
export function getLuckyRecords(page = 1, pageSize = 10): Promise<LuckyRecordPage> {
  return request<LuckyRecordPage>({
    url: `/api/lucky/records?page=${page}&pageSize=${pageSize}`,
    method: 'GET',
  })
}
```

- [ ] **Step 2: 提交**

```bash
git add mini_shop/api/lucky.ts
git commit -m "feat(mini_shop): 新增大转盘接口封装"
```

---

### Task 4: 本地 mock 配置

**Files:**
- Create: `mini_shop/utils/lucky-mock.ts`

**Interfaces:**
- Consumes: `@/types/lucky` 类型。
- Produces: `LUCKY_MOCK_CONFIG: LuckyConfigVO`, `mockLuckyDraw(): LuckyDrawVO`（按权重随机返回格子索引）。供 `index.vue` 走本地演示。

- [ ] **Step 1: 编写 mock**

```ts
import type { LuckyConfigVO, LuckyDrawVO } from '@/types/lucky'

/** 本地演示配置：后端就绪前用；活动开启、每人 3 次、6 格。 */
export const LUCKY_MOCK_CONFIG: LuckyConfigVO = {
  id: 'mock',
  enabled: 1,
  startTime: '2026-09-04 00:00:00',
  endTime: '2026-09-30 23:59:59',
  dailyCount: 3,
  remainCount: 3,
  rule: '每人每日可抽 3 次，点击中心按钮开始；本页为演示版本，奖品以实际活动为准。',
  prizes: [
    { index: 0, name: '一等奖', type: 'REAL', weight: 1 },
    { index: 1, name: '谢谢参与', type: 'NONE', weight: 40, isDefault: true },
    { index: 2, name: '50积分', type: 'INTEGRAL', weight: 30 },
    { index: 3, name: '谢谢参与', type: 'NONE', weight: 20, isDefault: true },
    { index: 4, name: '10积分', type: 'INTEGRAL', weight: 25 },
    { index: 5, name: '谢谢参与', type: 'NONE', weight: 10, isDefault: true },
  ],
}

/** 本地假抽奖：按权重返回命中格位（演示用，仅做动画）。 */
export function mockLuckyDraw(): LuckyDrawVO {
  const prizes = LUCKY_MOCK_CONFIG.prizes
  const total = prizes.reduce((sum, prize) => sum + (prize.weight || 1), 0)
  let rand = Math.random() * total
  let hit = prizes[0]
  for (const prize of prizes) {
    rand -= prize.weight || 1
    if (rand <= 0) { hit = prize; break }
  }
  return {
    prizeIndex: hit.index,
    prizeName: hit.name,
    prizeType: hit.type || 'NONE',
    recordId: String(Date.now()),
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add mini_shop/utils/lucky-mock.ts
git commit -m "feat(mini_shop): 新增大转盘本地 mock 配置"
```

---

### Task 5: lucky-canvas Vue3 转盘组件

**Files:**
- Create: `mini_shop/components/lucky-canvas/lucky-wheel.vue`

**Interfaces:**
- Consumes: `./lucky-canvas.js` 的 `LuckyWheel`；Vue3。
- Produces: props `prizes`（格位数组字符串/对象）、`config`（默认样式）。方法：`play()`（开始旋转，待停止时通过 `stop(index)` 停止）、`stop(index)`（转到指定格）。事件：`@start`、`@end`。`defineExpose({ play, stop })`。

- [ ] **Step 1: 编写 Vue3 组件**

参考官方 uni 版改为 Vue3 `<script setup>`。核心：`canvas type="2d"`，`new LuckyWheel({...})`，转盘用 `blocks/prizes/buttons` 配置渲染。因为项目无需图片，首先用纯色/文字格。

```vue
<template>
  <view class="lucky-wheel-box" :style="{ width: boxWidth + 'px', height: boxHeight + 'px' }">
    <canvas
      type="2d"
      id="lucky-wheel-canvas"
      canvas-id="lucky-wheel-canvas"
      :style="{ width: boxWidth + 'px', height: boxHeight + 'px' }"
    />
    <view class="lucky-wheel-btn" @click="handleBtnClick" :style="{ width: btnSize + 'px', height: btnSize + 'px' }" />
  </view>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, onMounted, ref, watch } from 'vue'
import type { LuckyPrizeVO } from '@/types/lucky'
// @ts-ignore lucky-canvas 核心（微信小程序 UMD，挂到 window.LuckyWheel）
import LuckyWheel from './lucky-canvas.js'

const props = withDefaults(defineProps<{
  /** 奖品格列表（驱动格子渲染）。 */
  prizes?: LuckyPrizeVO[]
  /** 中心按钮半径（px，相对转盘）。 */
  btnRadius?: number
}>(), {
  prizes: () => [],
  btnRadius: 28,
})

const emit = defineEmits<{ (e: 'start'): void; (e: 'end', index: number): void }>()

const instance = getCurrentInstance()
const boxWidth = ref(300)
const boxHeight = ref(300)
const btnSize = ref(56)
let myLucky: any = null

// 把奖品转成 luck 格式；有图用图，无图用文字+背景色。
const prizesConfig = computed(() =>
  props.prizes.map((prize) => ({
    name: prize.name,
    range: 0,
    ...(prize.image ? { imgs: [{ src: prize.image, width: '40%' }] } : {}),
  })),
)

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
      btnSize.value = (props.btnRadius || 28) * 2

      myLucky = new LuckyWheel({
        flag: 'MP-WX',
        ctx,
        dpr,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        beforeCreate: () => ctx.translate(width / 2, height / 2),
        beforeResize: () => ctx.translate(-width / 2, -height / 2),
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
        },
        defaultStyle: {
          fontColor: '#333',
          fontSize: '14px',
        },
        start: () => emit('start'),
        end: (index: number) => emit('end', index),
      })
    })
}

function handleBtnClick(): void {
  myLucky?.startCallback?.()
}

/** 开始旋转（转盘随机停，等待外部停止）。 */
function play(): void {
  myLucky?.play?.()
}

/** 停止到指定格（index：第几格，0 起）。调用前先 play，后按接口结果 stop(index)。 */
function stop(index: number): void {
  myLucky?.stop?.(index)
}

watch(prizesConfig, () => {
  if (myLucky) myLucky.prizes = prizesConfig.value
}, { deep: true })

onMounted(() => {
  // 等页面渲染完再初始化 canvas
  setTimeout(() => initCanvas(), 50)
})

defineExpose({ play, stop })
</script>

<style scoped>
.lucky-wheel-box { position: relative; margin: 0 auto; overflow: hidden; }
.lucky-wheel-box canvas { position: absolute; left: 0; top: 0; pointer-events: none; }
.lucky-wheel-btn { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); border-radius: 50%; background: #e5322d; cursor: pointer; }
</style>
```

> 注：以上能跑通的基础版。若真机微信 canvas 指针事件穿层导致中心按钮点不中，用 `cover-view` 或把按钮放 canvas 上层（同层级）。真机验证后再细化。

- [ ] **Step 2: 提交**

```bash
git add mini_shop/components/lucky-canvas/lucky-wheel.vue
git commit -m "feat(mini_shop): 新增 lucky-canvas Vue3 大转盘组件"
```

---

### Task 6: 注册分包页面

**Files:**
- Modify: `mini_shop/pages.json`

**Interfaces:**
- Consumes: 无。
- Produces: 页面路由 `/subpkg-activities/lucky-wheel/index`。

- [ ] **Step 1: 在 subPackages 追加分包**

在 `pages.json` 的 `subPackages` 数组中追加：

```json
{
  "root": "subpkg-activities",
  "name": "activities",
  "pages": [
    {
      "path": "lucky-wheel/index",
      "style": {
        "navigationStyle": "custom",
        "navigationBarTitleText": "大转盘"
      }
    }
  ]
}
```

- [ ] **Step 2: 提交**

```bash
git add mini_shop/pages.json
git commit -m "feat(mini_shop): 注册大转盘分包页面"
```

---

### Task 7: 大转盘活动页

**Files:**
- Create: `mini_shop/subpkg-activities/lucky-wheel/index.vue`

**Interfaces:**
- Consumes: `getLuckyConfig`/`drawLucky`/`getLuckyRecords`（`@/api/lucky`），`LUCKY_MOCK_CONFIG`/`mockLuckyDraw`（`@/utils/lucky-mock`），类型（`@/types/lucky`），`enabled==false` 判断。
- Produces: 活动页（无对外接口）。

页面逻辑：
1. `onLoad` 拉配置。若后端就绪（`VITE_LUCKY_MOCK !== '1'`）走 `getLuckyConfig`；否则用 `LUCKY_MOCK_CONFIG`。
2. 渲染转盘（`prizes`）。
3. 点中心按钮：`play()` 前先判断登录态 + 活动开关 + 剩余次数；调用 `draw`（或 mock）拿 `prizeIndex`，再 `stop(prizeIndex)`。
4. `@end` 回调弹中奖弹窗，刷新剩余次数与中奖记录。
5. 中奖记录列表 + 空态。
6. 未登录点抽奖：弹 `LoginGuide`。

- [ ] **Step 1: 编写页面**

```vue
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
      <text class="lucky-tip" v-if="!activable">活动暂未开始/已结束</text>
      <LuckyWheel
        ref="wheelRef"
        class="lucky-wheel"
        :prizes="prizes"
        @start="onStart"
        @end="onEnd"
      />
      <navigator v-if="isLoggedIn()" url="/subpkg-activities/lucky-wheel/index" class="remain" open-type="navigate">剩余次数：{{ remainCount }}</navigator>
      <text v-else class="remain">登录后可参与抽奖</text>

      <view class="rule-card" v-if="rule">
        <text class="rule-title">活动规则</text>
        <text class="rule-text">{{ rule }}</text>
      </view>
    </view>

    <!-- 我的中奖记录 -->
    <view class="record-section">
      <text class="record-title">我的中奖记录</text>
      <view v-if="records.length" class="record-list">
        <view v-for="record in records" :key="record.id" class="record-item">
          <text class="record-prize">{{ record.prizeName }}</text>
          <text class="record-time">{{ record.createTime }}</text>
        </view>
      </view>
      <view v-else class="record-empty">暂无中奖记录</view>
    </view>

    <!-- 登录引导 -->
    <LoginGuide v-model="loginVisible" />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import LuckyWheel from '@/components/lucky-canvas/lucky-wheel.vue'
import LoginGuide from '@/components/LoginGuide.vue'
import { getLuckyConfig, drawLucky, getLuckyRecords } from '@/api/lucky'
import { LUCKY_MOCK_CONFIG, mockLuckyDraw } from '@/utils/lucky-mock'
import { isLoggedIn } from '@/utils/auth'
import type { LuckyConfigVO, LuckyRecord, LuckyPrizeVO } from '@/types/lucky'

const wheelRef = ref<InstanceType<typeof LuckyWheel> | null>(null)
const config = ref<LuckyConfigVO>(LUCKY_MOCK_CONFIG)
const prizes = ref<LuckyPrizeVO[]>([])
const remainCount = ref(0)
const rule = ref('')
const records = ref<LuckyRecord[]>([])
const loginVisible = ref(false)
/** 抽奖中锁定，避免连点。 */
const drawing = ref(false)
/** 是否走真实接口（VITE_LUCKY_MOCK=1 表示用 mock）。 */
const useMock = true

const activable = computed(() => Number(config.value.enabled) === 1 && (useMock || Number(config.value.remainCount) > 0))

function goBack(): void {
  uni.navigateBack()
}

async function loadConfig(): Promise<void> {
  try {
    if (useMock) {
      config.value = LUCKY_MOCK_CONFIG
    } else {
      config.value = await getLuckyConfig()
    }
    prizes.value = config.value.prizes || []
    remainCount.value = Number(config.value.remainCount || 0)
    rule.value = config.value.rule || ''
  } catch (e) {
    // 失败时用 mock 兜底，保证页面可展示。
    config.value = LUCKY_MOCK_CONFIG
    prizes.value = config.value.prizes || []
    remainCount.value = Number(config.value.remainCount || 0)
    rule.value = config.value.rule || ''
  }
}

async function loadRecords(): Promise<void> {
  try {
    if (useMock) return
    const page = await getLuckyRecords(1, 20)
    records.value = page.list || []
  } catch {
    records.value = []
  }
}

function onStart(): void {
  // 抽奖已开始
}

function onEnd(index: number): void {
  drawing.value = false
  const hit = prizes.value.find((p) => p.index === index)
  uni.showToast({ title: `中奖：${hit?.name || '谢谢参与'}`, icon: 'none' })
  remainCount.value = Math.max(0, remainCount.value - 1)
  void loadRecords()
}

function handleDraw(): void {
  if (drawing.value) return
  if (!isLoggedIn()) {
    loginVisible.value = true
    return
  }
  if (!activable.value) {
    uni.showToast({ title: '活动暂未开始或次数不足', icon: 'none' })
    return
  }
  drawing.value = true
  const doStop = (index: number): void => {
    // 先 play（转盘转动），再按 index 停止。
    wheelRef.value?.play?.()
    setTimeout(() => wheelRef.value?.stop?.(index), 30)
  }

  if (useMock) {
    const result = mockLuckyDraw()
    doStop(result.prizeIndex)
    return
  }
  drawLucky()
    .then((result) => doStop(result.prizeIndex))
    .catch((e) => {
      drawing.value = false
      uni.showToast({ title: e?.message || '抽奖失败，请稍后重试', icon: 'none' })
    })
}

onLoad(() => {
  void loadConfig()
  void loadRecords()
})
</script>

<style scoped>
.lucky-page { min-height: 100vh; background: linear-gradient(180deg, #fff7f2 0%, #ffe9e2 100%); padding-bottom: 40rpx; box-sizing: border-box; }
.lucky-nav { display: flex; align-items: center; justify-content: space-between; height: 88rpx; padding: 0 24rpx; box-sizing: border-box; }
.nav-back { width: 60rpx; font-size: 40rpx; color: #333; }
.nav-title { font-size: 32rpx; font-weight: 600; color: #333; }
.nav-space { width: 60rpx; }
.lucky-body { display: flex; flex-direction: column; align-items: center; padding: 40rpx 32rpx; }
.lucky-tip { color: #c97b6a; font-size: 26rpx; margin-bottom: 24rpx; }
.lucky-wheel { width: 600rpx; height: 600rpx; margin-top: 20rpx; }
.remain { margin-top: 32rpx; color: #8a5a4a; font-size: 28rpx; }
.rule-card { width: 100%; margin-top: 40rpx; padding: 28rpx 32rpx; border-radius: 16rpx; background: #fff; box-sizing: border-box; }
.rule-title { display: block; color: #a54f3c; font-size: 28rpx; font-weight: 600; margin-bottom: 12rpx; }
.rule-text { color: #6b5a52; font-size: 26rpx; line-height: 40rpx; white-space: pre-wrap; }
.record-section { padding: 32rpx 32rpx; }
.record-title { display: block; color: #a54f3c; font-size: 28rpx; font-weight: 600; margin-bottom: 20rpx; }
.record-item { display: flex; align-items: center; justify-content: space-between; padding: 24rpx 0; border-bottom: 1rpx solid #f0e0da; }
.record-prize { color: #333; font-size: 28rpx; }
.record-time { color: #9a8a82; font-size: 24rpx; }
.record-empty { color: #9a8a82; font-size: 26rpx; text-align: center; padding: 40rpx 0; }
</style>
```

需要补充：`import { computed } from 'vue'`（`activable` 用了 `computed`）。修正为顶部引入。

- [ ] **Step 2: 自检并修正 import**

确认 `<script setup>` 顶部含：
```ts
import { computed, ref } from 'vue'
```

- [ ] **Step 3: 提交**

```bash
git add mini_shop/subpkg-activities/lucky-wheel/index.vue
git commit -m "feat(mini_shop): 新增大转盘活动页"
```

---

### Task 8: 个人页加入口

**Files:**
- Modify: `mini_shop/pages/mine/mine.vue`

**Interfaces:**
- Consumes: `goMenu` 现有逻辑。
- Produces: 菜单项"大转盘" → 跳 `/subpkg-activities/lucky-wheel/index`。

- [ ] **Step 1: 增加菜单项**

在 `menuItems` 数组（约第 65-72 行）加入：
```ts
{ key: 'lucky', label: '大转盘', icon: '/static/my/大转盘_slices/大转盘.png' },
```

- [ ] **Step 2: 在 goMenu 增加跳转**

在 `goMenu` 函数（约 221-238 行）增加分支：
```ts
if (key === 'lucky') { uni.navigateTo({ url: '/subpkg-activities/lucky-wheel/index' }); return }
```

- [ ] **Step 3: 提交**

```bash
git add mini_shop/pages/mine/mine.vue
git commit -m "feat(mini_shop): 个人页新增大转盘活动入口"
```

---

### Task 9: 汇总验证 + 文档

**Files:**
- Create: `docs/logs/2026-09-04-今华有肽-大转盘抽奖活动.md`
- Modify: 无（只读验证）

**Interfaces:**
- Consumes: 前 8 个任务的产物。
- Produces: 经验/联调小结文档。

- [ ] **Step 1: 检查 git 状态与改动清单**

Run: `git -C E:\work\JJ\project status --short`
Expected: 前 8 任务相关文件已提交，无遗漏。

- [ ] **Step 2: 写联调/开发日志**

记录：引入 lucky-canvas、组件适配 Vue3 的注意点、mock 开关（`useMock`/`VITE_LUCKY_MOCK`）、后端就绪后如何切真实接口、HBuilderX 需要用户重新编译。

- [ ] **Step 3: 提交文档**

```bash
git add docs/logs/2026-09-04-今华有肽-大转盘抽奖活动.md
git commit -m "docs(mini_shop): 大转盘活动开发联调记录"
```

---

## Self-Review 自查记录

- **Spec 覆盖**：小程序活动页（Task 7）、个人页入口（Task 8）、lucky-canvas 引入（Task 1/5）、接口封装 + mock（Task 3/4）、分包注册（Task 6）、类型（Task 2）。满足设计文档 §5。admin 端与后端契约（设计文档 §6/§7）不在本次运行范围（用户要求"先把小程序搭好"），已单独成文。
- **占位符**：无 TBD/TODO；mock 奖品、页面结构、组件代码均已给出。
- **类型一致性**：`LuckyConfigVO`/`LuckyDrawVO`/`LuckyRecordPage` 在 Task 2/3/7 用一致的字段名；`play`/`stop`/`@end` 在 Task 5 暴露并在 Task 7 调用同名方法。
- **已知风险**：lucky-canvas 微信 canvas 可能穿层/指针事件问题，Task 5 已注明真机验证后细化。`.gitignore` 忽略 `docs`，用 `-f` 提交文档。
