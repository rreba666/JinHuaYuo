<script setup lang="ts">
import { onLoad, onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { cancelOrder, getOrderDetail, getPickupCode, receiveOrder, refundOrder, type OrderDetail } from '@/api/order'
import { getEnabledShops, type EnabledShop } from '@/api/shop'
// @ts-ignore uqrcode 为 UMD 单文件库（utils/uqrcode.js），无官方类型声明
import UQRCode from '@/utils/uqrcode'

const order = ref<OrderDetail | null>(null)
const loading = ref(true)
const actionLoading = ref(false)
const errorMessage = ref('')
/** 自提码（独立 pickup-code 接口返回）。 */
const pickupCode = ref('')
/** 自提二维码内容（独立 pickup-code 接口返回）。 */
const pickupUrl = ref('')
/** 二维码点阵（qr.modules 二维数组，每格 isBlack 表示黑/白）。 */
const qrModules = ref<Array<Array<{ isBlack: boolean }>>>([])
/** 自提门店完整信息（地址、电话，从门店列表匹配）。 */
const pickupShop = ref<EnabledShop | null>(null)

/** 是否为待自提订单（自提且已支付待核销）。 */
const isPickupPending = computed(() => order.value?.pickupType === 1 && order.value?.status === 1)

/** 金额明细：小计、配送费、合计。 */
const amountSummary = computed(() => {
  const subtotal = (order.value?.items || []).reduce((sum, item) => sum + (Number(item.subtotal ?? 0) || Number(item.price ?? 0) * Number(item.quantity ?? 1)), 0)
  const freight = Number(order.value?.freightAmount || 0)
  const total = Number(order.value?.payAmount || 0) || subtotal + freight
  return { subtotal, freight, total }
})

/** 生成自提二维码点阵：用 uqrcode 计算 modules，交给模板 v-for 渲染，规避 Vue3 小程序 canvas 兼容问题。 */
function drawPickupQrcode(url: string): void {
  try {
    const qr = new UQRCode()
    qr.data = url
    qr.make()
    qrModules.value = qr.modules as Array<Array<{ isBlack: boolean }>>
  } catch {
    /* 二维码生成失败时静默，仍保留自提码文本兜底 */
    qrModules.value = []
  }
}

/** 拉取自提二维码信息（仅自提订单；核销/退款后后端置 null，二维码自动失效）。 */
async function loadPickupCode(orderId: string): Promise<void> {
  if (order.value?.pickupType !== 1) { pickupCode.value = ''; pickupUrl.value = ''; qrModules.value = []; return }
  try {
    const info = await getPickupCode(orderId)
    pickupCode.value = info.pickupCode || ''
    pickupUrl.value = info.pickupUrl || ''
    if (info.pickupUrl) drawPickupQrcode(info.pickupUrl)
    else qrModules.value = []
  } catch {
    pickupCode.value = ''; pickupUrl.value = ''; qrModules.value = []
  }
}

async function load(orderId: string, silent = false): Promise<void> {
  if (!silent) loading.value = true
  try {
    order.value = await getOrderDetail(orderId)
    await loadPickupCode(orderId)
    await loadPickupShop()
  }
  catch (error) { if (!silent) errorMessage.value = error instanceof Error ? error.message : '订单详情加载失败' }
  finally { loading.value = false }
}

/** 加载自提门店完整信息（地址、电话），订单详情仅返回门店名。 */
async function loadPickupShop(): Promise<void> {
  pickupShop.value = null
  if (order.value?.pickupType !== 1) return
  const shopId = order.value.pickupShopId
  if (!shopId) return
  try {
    const shops = await getEnabledShops()
    pickupShop.value = shops.find((shop) => shop.id === shopId) || null
  } catch {
    pickupShop.value = null
  }
}

/** 打开地图导航到自提门店；无经纬度时兜底复制地址。 */
function openMap(): void {
  const shop = pickupShop.value
  if (!shop) return
  if (shop.latitude != null && shop.longitude != null) {
    uni.openLocation({
      latitude: Number(shop.latitude),
      longitude: Number(shop.longitude),
      name: shop.name,
      address: shop.address,
      scale: 16,
    })
    return
  }
  if (shop.address) {
    uni.setClipboardData({ data: shop.address, success: () => uni.showToast({ title: '地址已复制', icon: 'none' }) })
  }
}
async function action(type: 'cancel' | 'receive' | 'refund'): Promise<void> {
  if (!order.value || actionLoading.value) return
  actionLoading.value = true
  try {
    if (type === 'cancel') await cancelOrder(order.value.id)
    if (type === 'receive') await receiveOrder(order.value.id)
    if (type === 'refund') await refundOrder(order.value.id)
    uni.showToast({ title: type === 'cancel' ? '订单已取消' : '操作成功', icon: 'success' })
    await load(String(order.value.id))
  } catch (error) { uni.showToast({ title: error instanceof Error ? error.message : '操作失败', icon: 'none' }) }
  finally { actionLoading.value = false }
}
onLoad((options?: Record<string, string | undefined>) => {
  if (!options?.orderId) { errorMessage.value = '订单参数缺失'; loading.value = false; return }
  void load(options.orderId)
})
onShow(() => {
  // 从核销等流程返回时静默刷新订单状态（如已支付 → 已核销）
  if (order.value?.id) void load(String(order.value.id), true)
})
</script>

<template>
  <view class="page">
    <view v-show="loading" class="state">加载中...</view><view v-show="!loading && errorMessage" class="state error">{{ errorMessage }}</view>
    <scroll-view v-show="!loading && !errorMessage && order" class="content" scroll-y>
      <!-- 状态横幅（居中标签） -->
      <view class="status-banner"><text class="status-banner-text">{{ order?.statusDesc }}</text></view>

      <!-- 自提二维码（仅自提订单） -->
      <view v-if="order?.pickupType === 1 && pickupUrl" class="card qrcode-card">
        <text class="qrcode-title">请凭二维码取货</text>
        <view class="qr-grid"><view v-for="(row, rowI) in qrModules" :key="rowI" class="qr-row"><view v-for="(cell, colI) in row" :key="colI" class="qr-cell" :class="{ 'is-dark': cell.isBlack }" /></view></view>
        <text class="qrcode-code">{{ pickupCode }}</text>
        <text class="qrcode-tip">到店出示此码给店员扫码核销</text>
      </view>

      <!-- 自提信息（仅自提订单） -->
      <view v-if="order?.pickupType === 1" class="card">
        <view class="line"><text>自提时间</text><text>{{ pickupShop?.openTime || '--' }}</text></view>
        <view class="line"><text>店主电话</text><text>{{ pickupShop?.phone || '--' }}</text></view>
        <view class="line"><text>自提地址</text><text class="right">{{ pickupShop?.address || order?.shopName || '--' }}</text></view>
        <view class="line map-line" @click="openMap"><text>地图</text><text class="right map-arrow">›</text></view>
      </view>

      <!-- 配送信息（仅物流订单） -->
      <view v-if="order?.pickupType === 0" class="card">
        <view class="line"><text>配送方式</text><text>物流配送</text></view>
        <view v-if="order?.receiverName" class="line"><text>收货人</text><text>{{ order.receiverName }} {{ order.receiverPhone }}</text></view>
        <view v-if="order?.receiverAddress" class="line"><text>收货地址</text><text class="right">{{ order.receiverAddress }}</text></view>
      </view>

      <!-- 商品清单 + 金额明细 -->
      <view class="card">
        <view v-for="(item, index) in order?.items || []" :key="`${item.productName}-${index}`" class="item"><image v-if="item.productImage" class="item-image" :src="item.productImage" mode="aspectFill" /><view v-else class="item-image" /><view class="item-info"><text>{{ item.productName || '商品' }}</text><text class="muted">{{ item.skuName || '' }}</text></view><text>×{{ item.quantity || 1 }}</text></view>
        <view class="amount">
          <view class="amount-line"><text>小计</text><text>¥{{ amountSummary.subtotal.toFixed(2) }}</text></view>
          <view class="amount-line"><text>配送费</text><text>{{ order?.pickupType === 1 ? '(门店自提) ' : '' }}¥{{ amountSummary.freight.toFixed(2) }}</text></view>
          <view class="amount-line amount-total"><text>合计</text><text>¥{{ amountSummary.total.toFixed(2) }}</text></view>
        </view>
      </view>

      <view class="actions"><button v-if="order?.status === 0" :disabled="actionLoading" @click="action('cancel')">取消订单</button><button v-if="order?.status === 2" :disabled="actionLoading" @click="action('receive')">确认收货</button><button v-if="[1, 2, 3].includes(order?.status || 0)" :disabled="actionLoading" @click="action('refund')">申请退款</button></view>
    </scroll-view>
  </view>
</template>

<style>
.page { min-height: 100vh; background: #f6f6f6; color: #242526; }.content { height: 100vh; padding: 24rpx; box-sizing: border-box; }
.status-banner { display: flex; justify-content: center; margin-bottom: 18rpx; padding: 22rpx; background: rgba(145, 100, 72, 0.13); border-radius: 10rpx; }.status-banner-text { color: #916448; font-size: 32rpx; font-weight: 700; }
.card { margin-bottom: 18rpx; padding: 26rpx; background: #fff; border-radius: 10rpx; }
.line { display: flex; justify-content: space-between; gap: 24rpx; padding: 18rpx 0; color: #555; font-size: 25rpx; border-bottom: 1px solid #f2f2f2; }.line:last-child { border-bottom: 0; }.right { flex: 1; text-align: right; }
.map-line { align-items: center; }.map-arrow { color: #959595; font-size: 36rpx; line-height: 1; }
.item { display: flex; align-items: center; gap: 16rpx; padding: 16rpx 0; }.item-image { width: 84rpx; height: 84rpx; flex-shrink: 0; background: #e9e7dd; }.item-info { display: flex; flex: 1; flex-direction: column; gap: 8rpx; font-size: 25rpx; }.muted { color: #999; font-size: 22rpx; }
.amount { margin-top: 10rpx; padding-top: 14rpx; border-top: 1px solid #f2f2f2; }.amount-line { display: flex; justify-content: space-between; padding: 10rpx 0; color: #8e8e8e; font-size: 24rpx; }.amount-total { color: #222; font-weight: 700; }
.actions { display: flex; gap: 16rpx; padding-bottom: 48rpx; }button { flex: 1; margin: 0; color: #fff; background: #222; border-radius: 6rpx; font-size: 26rpx; }button::after { border: 0; }.state { padding: 220rpx 24rpx; color: #999; text-align: center; }.error { color: #c44; }
.qrcode-card { display: flex; flex-direction: column; align-items: center; padding: 30rpx 26rpx; }.qrcode-title { font-size: 28rpx; font-weight: 600; color: #333; margin-bottom: 20rpx; }.qr-grid { padding: 10rpx; background: #fff; border: 1rpx solid #e6e8eb; }.qr-row { display: flex; }.qr-cell { width: 10rpx; height: 10rpx; }.qr-cell.is-dark { background: #000; }.qrcode-code { margin-top: 16rpx; font-size: 30rpx; letter-spacing: 4rpx; color: #222; font-weight: 600; }.qrcode-tip { margin-top: 10rpx; font-size: 22rpx; color: #999; }
</style>
