<script setup lang="ts">
import { onLoad, onShow } from '@dcloudio/uni-app'
import { computed, onMounted, ref } from 'vue'
import { cancelOrder, getOrderList, receiveOrder, refundOrder, type OrderStatus, type OrderSummary } from '@/api/order'

/** 订单 tab 定义，每项携带后端 statuses 状态码数组与可选配送方式。已关闭(5)一律不展示。 */
const tabs: Array<{ label: string; statuses: OrderStatus[]; pickupType?: 0 | 1 }> = [
  { label: '全部', statuses: [0, 1, 2, 3, 4, 6, 7, 8] },
  { label: '待付款', statuses: [0] },
  { label: '待发货', statuses: [1], pickupType: 0 },
  { label: '待收货', statuses: [2] },
  { label: '待自提', statuses: [1], pickupType: 1 },
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
    const tab = tabs[activeIndex.value]
    const result = await getOrderList({ page: nextPage, pageSize: 10, statuses: tab.statuses, pickupType: tab.pickupType })
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

/** 确认收货（物流订单）。 */
async function receive(order: OrderSummary): Promise<void> {
  const confirmed = await new Promise<boolean>((resolve) => {
    uni.showModal({ title: '提示', content: '确认已收到商品吗？', success: (res) => resolve(res.confirm), fail: () => resolve(false) })
  })
  if (!confirmed) return
  try { await receiveOrder(order.id); uni.showToast({ title: '已确认收货', icon: 'success' }); await load(true) }
  catch (error) { uni.showToast({ title: error instanceof Error ? error.message : '确认收货失败', icon: 'none' }) }
}

/** 申请退款（自提订单）。 */
async function refund(order: OrderSummary): Promise<void> {
  const confirmed = await new Promise<boolean>((resolve) => {
    uni.showModal({ title: '提示', content: '确定申请退款吗？', success: (res) => resolve(res.confirm), fail: () => resolve(false) })
  })
  if (!confirmed) return
  try { await refundOrder(order.id); uni.showToast({ title: '退款申请已提交', icon: 'success' }); await load(true) }
  catch (error) { uni.showToast({ title: error instanceof Error ? error.message : '退款申请失败', icon: 'none' }) }
}

/** 格式化金额：整数去掉小数位。 */
function formatAmount(value: number): string {
  return Number(value || 0).toFixed(2).replace(/\.00$/, '')
}

/** 待收货订单物流条文案：deliveryStatus 0=已发货(运输中)，1=已送达。 */
function logisticsInfo(order: OrderSummary): { status: string; remark: string } {
  if (order.deliveryStatus === 1) return { status: '已送达', remark: '请确认收货' }
  return { status: '已发货', remark: '运输中' }
}

onMounted(() => {
  try {
    const r = uni.getMenuButtonBoundingClientRect()
    if (r) { menuTop.value = r.top; menuHeight.value = r.height }
  } catch { /* 非微信环境忽略 */ }
})

onLoad((options?: Record<string, string | undefined>) => {
  const status = Number(options?.status)
  const pickupType = options?.pickupType !== undefined && options.pickupType !== '' ? (Number(options.pickupType) as 0 | 1) : undefined
  if (Number.isInteger(status) && status >= 0 && status <= 8) {
    // 待发货(status=1,物流) 与 待自提(status=1,自提) 需用 pickupType 区分
    const matched = tabs.findIndex((t) => t.statuses.includes(status as OrderStatus) && (pickupType === undefined || t.pickupType === pickupType))
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
        <view class="card-head"><text class="card-title">{{ order.pickupType === 1 ? (order.shopName || '门店自提') : order.orderNo }}</text><text class="card-status">{{ order.statusDesc }}</text></view>
        <text class="card-time">{{ order.createTime }}</text>

        <!-- 物流状态条（仅待收货，两态：已发货/已送达） -->
        <view v-if="order.status === 2" class="logistics" @click.stop="openDetail(order)">
          <view class="logi-icon" />
          <text class="logi-status">{{ logisticsInfo(order).status }}</text>
          <text class="logi-remark">{{ logisticsInfo(order).remark }}</text>
          <text class="logi-arrow">›</text>
        </view>

        <view class="card-goods">
          <image v-if="order.firstProductImage" class="goods-img" :src="order.firstProductImage" mode="aspectFill" />
          <view v-else class="goods-img placeholder" />
          <view class="goods-info">
            <text class="goods-name">{{ order.firstProductName || '商品' }}</text>
            <text class="goods-meta">共{{ order.totalQuantity }}件</text>
            <text class="goods-price">实付款：¥{{ formatAmount(order.payAmount) }}</text>
          </view>
        </view>

        <view class="card-actions">
          <template v-if="order.status === 0">
            <text class="btn outline" @click.stop="cancel(order)">取消订单</text>
            <text class="btn primary" @click.stop="pay(order)">去支付</text>
          </template>
          <text v-if="order.status === 1 && order.pickupType === 0" class="btn outline" @click.stop="openDetail(order)">查看详情</text>
          <template v-if="order.status === 2">
            <text class="btn outline" @click.stop="openDetail(order)">查看物流</text>
            <text v-if="order.deliveryStatus === 1" class="btn primary" @click.stop="receive(order)">确认收货</text>
          </template>
          <template v-if="order.status === 1 && order.pickupType === 1">
            <text class="btn outline" @click.stop="refund(order)">退款</text>
            <text class="btn primary" @click.stop="openDetail(order)">去自提</text>
          </template>
        </view>
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
.order-card { margin-bottom: 20rpx; padding: 26rpx 30rpx; background: #fff; border-radius: 16rpx; }
.card-head { display: flex; align-items: center; justify-content: space-between; }
.card-title { color: #303030; font-size: 30rpx; font-weight: 600; max-width: 420rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-status { color: #916448; font-size: 28rpx; flex-shrink: 0; }
.card-time { display: block; margin-top: 8rpx; color: #959595; font-size: 26rpx; }
.logistics { display: flex; align-items: center; margin-top: 20rpx; padding: 14rpx 20rpx; background: rgba(224, 215, 206, 0.27); border-radius: 8rpx; }
.logi-icon { width: 40rpx; height: 40rpx; margin-right: 12rpx; border: 2rpx solid #c9b8a8; border-radius: 50%; flex-shrink: 0; }
.logi-status { color: #000; font-size: 26rpx; font-weight: 600; flex-shrink: 0; }
.logi-remark { flex: 1; min-width: 0; margin-left: 14rpx; color: #959595; font-size: 26rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.logi-arrow { margin-left: 8rpx; color: #959595; font-size: 36rpx; line-height: 1; }
.card-goods { display: flex; margin-top: 24rpx; }
.goods-img { width: 196rpx; height: 264rpx; flex-shrink: 0; background: #d8d8d8; border-radius: 8rpx; }
.goods-img.placeholder { background: #d8d8d8; }
.goods-info { display: flex; flex: 1; min-width: 0; flex-direction: column; margin-left: 24rpx; }
.goods-name { color: #0a0a0a; font-size: 28rpx; line-height: 1.4; }
.goods-meta { margin-top: 18rpx; color: #8e8e8e; font-size: 26rpx; }
.goods-price { margin-top: auto; color: #8e8e8e; font-size: 26rpx; }
.card-actions { display: flex; justify-content: flex-end; gap: 16rpx; margin-top: 24rpx; }
.btn { display: flex; align-items: center; justify-content: center; min-width: 160rpx; height: 52rpx; padding: 0 24rpx; border-radius: 8rpx; font-size: 26rpx; box-sizing: border-box; }
.btn.outline { color: #000; border: 2rpx solid #222; }
.btn.primary { color: #916448; background: rgba(192, 172, 155, 0.49); }
.state, .more { padding: 120rpx 0; color: #999; text-align: center; font-size: 26rpx; }.more { padding: 28rpx 0; }
</style>
