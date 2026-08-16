<script setup lang="ts">
import { onLoad, onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { cancelOrder, getOrderDetail, getPickupCode, receiveOrder, refundOrder, type OrderDetail } from '@/api/order'
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
  }
  catch (error) { if (!silent) errorMessage.value = error instanceof Error ? error.message : '订单详情加载失败' }
  finally { loading.value = false }
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
      <view class="status-card"><text class="status">{{ order?.statusDesc }}</text><text class="order-no">{{ order?.orderNo }}</text></view>
      <view v-if="order?.pickupType === 1 && pickupUrl" class="card qrcode-card"><text class="qrcode-title">到店自提码</text><view class="qr-grid"><view v-for="(row, rowI) in qrModules" :key="rowI" class="qr-row"><view v-for="(cell, colI) in row" :key="colI" class="qr-cell" :class="{ 'is-dark': cell.isBlack }" /></view></view><text class="qrcode-code">{{ pickupCode }}</text><text class="qrcode-tip">结账后请出示此码给店员扫码核销</text></view>
      <view class="card"><view class="line"><text>配送方式</text><text>{{ order?.pickupType === 1 ? '门店自提' : '物流配送' }}</text></view><view v-if="order?.receiverName" class="line"><text>收货人</text><text>{{ order.receiverName }} {{ order.receiverPhone }}</text></view><view v-if="order?.receiverAddress" class="line"><text>收货地址</text><text class="right">{{ order.receiverAddress }}</text></view><view v-if="order?.shopName" class="line"><text>自提门店</text><text class="right">{{ order.shopName }}</text></view></view>
      <view class="card"><view v-for="(item, index) in order?.items || []" :key="`${item.productName}-${index}`" class="item"><view class="item-image" /><view class="item-info"><text>{{ item.productName || '商品' }}</text><text class="muted">{{ item.skuName || '' }}</text></view><text>×{{ item.quantity || 1 }}</text></view><view class="total"><text>实付金额</text><text class="price">¥{{ Number(order?.payAmount || 0).toFixed(2) }}</text></view></view>
      <view class="actions"><button v-if="order?.status === 0" :disabled="actionLoading" @click="action('cancel')">取消订单</button><button v-if="order?.status === 2" :disabled="actionLoading" @click="action('receive')">确认收货</button><button v-if="[1, 2, 3].includes(order?.status || 0)" :disabled="actionLoading" @click="action('refund')">申请退款</button></view>
    </scroll-view>
  </view>
</template>

<style>
.page { min-height: 100vh; background: #f6f6f6; color: #242526; }.content { height: 100vh; padding: 24rpx; box-sizing: border-box; }
.status-card, .card { margin-bottom: 18rpx; padding: 26rpx; background: #fff; border-radius: 10rpx; }.status { color: #a57b3b; font-size: 32rpx; font-weight: 700; }.order-no { display: block; margin-top: 12rpx; color: #999; font-size: 23rpx; }
.line, .total { display: flex; justify-content: space-between; gap: 24rpx; padding: 18rpx 0; color: #555; font-size: 25rpx; border-bottom: 1px solid #f2f2f2; }.line:last-child { border-bottom: 0; }.right { flex: 1; text-align: right; }
.item { display: flex; align-items: center; gap: 16rpx; padding: 16rpx 0; }.item-image { width: 84rpx; height: 84rpx; background: #e9e7dd; }.item-info { display: flex; flex: 1; flex-direction: column; gap: 8rpx; font-size: 25rpx; }.muted { color: #999; font-size: 22rpx; }.total { padding-bottom: 0; border-bottom: 0; }.price { color: #222; font-weight: 700; }
.actions { display: flex; gap: 16rpx; padding-bottom: 48rpx; }button { flex: 1; margin: 0; color: #fff; background: #222; border-radius: 6rpx; font-size: 26rpx; }button::after { border: 0; }.state { padding: 220rpx 24rpx; color: #999; text-align: center; }.error { color: #c44; }
.qrcode-card { display: flex; flex-direction: column; align-items: center; padding: 30rpx 26rpx; }.qrcode-title { font-size: 28rpx; font-weight: 600; color: #333; margin-bottom: 20rpx; }.qr-grid { padding: 10rpx; background: #fff; border: 1rpx solid #e6e8eb; }.qr-row { display: flex; }.qr-cell { width: 10rpx; height: 10rpx; }.qr-cell.is-dark { background: #000; }.qrcode-code { margin-top: 16rpx; font-size: 30rpx; letter-spacing: 4rpx; color: #222; font-weight: 600; }.qrcode-tip { margin-top: 10rpx; font-size: 22rpx; color: #999; }
</style>
