<script setup lang="ts">
import { onLoad, onShow } from '@dcloudio/uni-app'
import { computed, onMounted, ref } from 'vue'
import { cancelOrder, getOrderList, type OrderStatus, type OrderSummary } from '@/api/order'

/** 订单 tab 定义，每项携带后端 statuses 状态码数组。已关闭(5)一律不展示。 */
const tabs: Array<{ label: string; statuses: OrderStatus[] }> = [
  { label: '全部', statuses: [0, 1, 2, 3, 4, 6, 7, 8] },
  { label: '待付款', statuses: [0] },
  { label: '待发货', statuses: [1] },
  { label: '待收货', statuses: [2] },
  { label: '已完成', statuses: [3, 4, 8] },
  { label: '退款售后', statuses: [6, 7] },
]
/** 当前选中的 tab 索引。 */
const activeIndex = ref(0)
const list = ref<OrderSummary[]>([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const loadingMore = ref(false)
const loaded = ref(false)
const empty = computed(() => loaded.value && !loading.value && !list.value.length)
/** 请求竞态 token，快速切换 tab 时丢弃过期响应。 */
let requestToken = 0

/** 微信胶囊按钮位置，用于自定义导航栏精确定位。 */
const menuTop = ref(0)
const menuHeight = ref(32)
const navStyle = computed(() => ({ top: `${menuTop.value}px`, height: `${menuHeight.value}px` }))
const bodyTop = computed(() => menuTop.value + menuHeight.value)

async function load(reset = true): Promise<void> {
  const token = ++requestToken
  const nextPage = reset ? 1 : page.value + 1
  if (!reset && list.value.length >= total.value) return
  if (reset) loading.value = true
  else loadingMore.value = true
  try {
    const result = await getOrderList({ page: nextPage, pageSize: 10, statuses: tabs[activeIndex.value].statuses })
    if (token !== requestToken) return
    list.value = reset ? result.list : [...list.value, ...result.list]
    page.value = result.page || nextPage
    total.value = result.total || list.value.length
    loaded.value = true
  } catch (error) {
    if (token !== requestToken) return
    uni.showToast({ title: error instanceof Error ? error.message : '订单加载失败', icon: 'none' })
  } finally {
    if (token === requestToken) { loading.value = false; loadingMore.value = false }
  }
}

function selectTab(index: number): void { activeIndex.value = index; void load(true) }
function openDetail(order: OrderSummary): void { uni.navigateTo({ url: `/pages/orders/detail?orderId=${order.id}` }) }
function pay(order: OrderSummary): void { uni.navigateTo({ url: `/pages/payment/payment?orderId=${order.id}` }) }
/** 返回上一页；无上一页（分享/直达进入）时回首页。 */
function goBack(): void {
  const pages = getCurrentPages()
  if (pages.length > 1) uni.navigateBack()
  else uni.switchTab({ url: '/pages/index/index' })
}
async function cancel(order: OrderSummary): Promise<void> {
  try { await cancelOrder(order.id); uni.showToast({ title: '订单已取消', icon: 'success' }); await load(true) }
  catch (error) { uni.showToast({ title: error instanceof Error ? error.message : '取消订单失败', icon: 'none' }) }
}

onMounted(() => {
  try {
    const r = uni.getMenuButtonBoundingClientRect()
    if (r) { menuTop.value = r.top; menuHeight.value = r.height }
  } catch { /* 非微信环境忽略 */ }
})

onLoad((options?: Record<string, string | undefined>) => {
  const status = Number(options?.status)
  if (Number.isInteger(status) && status >= 0 && status <= 8) {
    const matched = tabs.findIndex((t) => t.statuses.includes(status as OrderStatus))
    activeIndex.value = matched >= 0 ? matched : 0
  }
  void load(true)
})
onShow(() => { if (loaded.value) void load(true) })
</script>

<template>
  <view class="page">
    <!-- 自定义导航栏，与胶囊按钮同一行 -->
    <view class="nav" :style="navStyle"><view class="nav-back" @click="goBack"><text class="back-icon">‹</text></view><text class="title">我的订单</text></view>
    <view class="tabs" :style="{ marginTop: bodyTop + 'px' }">
      <view v-for="(tab, index) in tabs" :key="tab.label" class="tab" :class="{ active: activeIndex === index }" @click="selectTab(index)">{{ tab.label }}</view>
    </view>
    <scroll-view class="list" scroll-y @scrolltolower="load(false)">
      <view v-show="loading && !list.length" class="state">加载中...</view>
      <view v-for="order in list" :key="order.id" class="order-card" @click="openDetail(order)">
        <view class="order-head"><text>{{ order.orderNo }}</text><text class="status">{{ order.statusDesc }}</text></view>
        <view class="order-body"><image v-if="order.firstProductImage" class="image" :src="order.firstProductImage" mode="aspectFill" /><view v-else class="image placeholder" /><view class="summary"><text>{{ order.totalQuantity }} 件商品</text><text class="time">{{ order.createTime }}</text></view></view>
        <view class="order-foot"><text>实付 ¥{{ Number(order.payAmount || 0).toFixed(2) }}</text><view class="actions"><text v-if="order.status === 0" class="action" @click.stop="pay(order)">去支付</text><text v-if="order.status === 0" class="action muted" @click.stop="cancel(order)">取消订单</text></view></view>
      </view>
      <view v-show="empty" class="state">暂无订单</view><view v-show="loadingMore" class="more">加载中...</view>
    </scroll-view>
  </view>
</template>

<style>
.page { display: flex; flex-direction: column; height: 100vh; overflow: hidden; background: #f6f6f6; color: #242526; }
.nav { position: fixed; left: 0; right: 0; z-index: 100; display: flex; align-items: center; justify-content: center; background: #fff; box-sizing: border-box; }
.nav-back { position: absolute; left: 16rpx; display: flex; align-items: center; justify-content: center; width: 64rpx; height: 64rpx; }.back-icon { font-size: 48rpx; line-height: 1; color: #222; }
.title { font-size: 32rpx; font-weight: 700; }
.tabs { display: flex; width: 100%; height: 82rpx; flex-shrink: 0; background: #fff; }
.tab { flex: 1; display: flex; align-items: center; justify-content: center; height: 82rpx; color: #888; font-size: 26rpx; border-bottom: 4rpx solid transparent; box-sizing: border-box; }
.tab.active { color: #222; border-color: #222; font-weight: 700; }
.list { flex: 1; min-height: 0; padding: 20rpx 24rpx; box-sizing: border-box; }
.order-card { margin-bottom: 18rpx; padding: 22rpx; background: #fff; border-radius: 10rpx; }
.order-head, .order-foot { display: flex; align-items: center; justify-content: space-between; font-size: 24rpx; }
.status { color: #a57b3b; }.order-body { display: flex; align-items: center; margin: 22rpx 0; }
.image { width: 128rpx; height: 128rpx; flex-shrink: 0; background: #eee; }.placeholder { background: #e9e7dd; }
.summary { display: flex; flex-direction: column; gap: 14rpx; margin-left: 22rpx; color: #444; font-size: 26rpx; }.time { color: #999; font-size: 22rpx; }
.actions { display: flex; gap: 18rpx; }.action { padding: 8rpx 18rpx; color: #fff; background: #222; border-radius: 4rpx; }.action.muted { color: #666; background: #eee; }
.state, .more { padding: 120rpx 0; color: #999; text-align: center; font-size: 26rpx; }.more { padding: 28rpx 0; }
</style>
