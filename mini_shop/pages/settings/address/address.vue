<script setup lang="ts">
/**
 * 收货地址簿（设置页子页面）
 *
 * 列表 + 删除 + 设默认。数据源：`/api/user/address/**`。
 *
 * ⚠️ **新增/编辑已迁到整页表单** `pages/settings/address/edit.vue`（2026-09-23）：
 * 原先进来是一个底部弹层（收货人/手机号/省市区/详细地址/默认），弹层里塞不下
 * 「粘贴并识别」与「授权微信地址」两个快速录入入口。现在本页只负责列表，
 * 新增与编辑都 `navigateTo` 那个整页，靠 `onShow` 拉列表刷新（整页不回传数据）。
 */
import { computed, onMounted, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { deleteAddress, getAddressList, setDefaultAddress, type Address } from '@/api/address'
import { isLoggedIn } from '@/utils/auth'
import { createThrottle } from '@/utils/interaction'
import SuccessToast from '@/components/SuccessToast.vue'

const successToastRef = ref<InstanceType<typeof SuccessToast> | null>(null)
import LoginGuide from '@/components/LoginGuide.vue'

const menuTop = ref(0)
const menuHeight = ref(32)
const list = ref<Address[]>([])
const loading = ref(false)
const actionLoading = ref(false)
const loginGuideVisible = ref(false)
const navigationThrottle = createThrottle(500)

const navStyle = computed(() => ({ top: `${menuTop.value}px`, height: `${menuHeight.value}px` }))
const bodyStyle = computed(() => ({ paddingTop: `${menuTop.value + menuHeight.value + uni.upx2px(20)}px` }))

async function loadList(): Promise<void> {
  if (!isLoggedIn()) { loginGuideVisible.value = true; return }
  loading.value = true
  try {
    const result = await getAddressList()
    list.value = Array.isArray(result) ? result : []
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '地址加载失败', icon: 'none' })
  } finally { loading.value = false }
}

function goBack(): void {
  if (!navigationThrottle()) return
  uni.navigateBack({ delta: 1 })
}

/** 新增地址：跳整页表单（保存后由 onShow 刷新列表）。 */
function openCreate(): void {
  uni.navigateTo({ url: '/pages/settings/address/edit' })
}

/** 编辑地址：跳整页表单并带上地址 ID（整页自己拉列表回填）。 */
function openEdit(item: Address): void {
  uni.navigateTo({ url: `/pages/settings/address/edit?id=${item.id}` })
}

function formatFullAddress(item: Address): string {
  return [item.province, item.city, item.district, item.detail].filter(Boolean).join('')
}

async function remove(item: Address): Promise<void> {
  const confirm = await new Promise<boolean>((resolve) => {
    uni.showModal({ title: '删除地址', content: '确认删除这个地址吗？', success: (r) => resolve(r.confirm) })
  })
  if (!confirm) return
  if (actionLoading.value) return
  actionLoading.value = true
  try {
    await deleteAddress(item.id)
    successToastRef.value?.show('地址已删除')
    await loadList()
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '删除失败', icon: 'none' })
  } finally { actionLoading.value = false }
}

async function setDefault(item: Address): Promise<void> {
  if (actionLoading.value) return
  actionLoading.value = true
  try {
    await setDefaultAddress(item.id)
    successToastRef.value?.show('已设为默认')
    await loadList()
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '设置失败', icon: 'none' })
  } finally { actionLoading.value = false }
}

onMounted(async () => {
  try {
    const rect = uni.getMenuButtonBoundingClientRect()
    if (rect) { menuTop.value = rect.top; menuHeight.value = rect.height }
  } catch { /* 非微信环境 */ }
  void loadList()
})

/** 页面重新显示时刷新：从整页表单保存返回后列表要立刻反映最新数据。 */
onShow(() => { void loadList() })
</script>

<template>
  <view class="page">
    <view class="nav" :style="navStyle">
      <image class="back-button" src="/static/left_arrow.png" mode="aspectFit" @click="goBack" />
      <text class="nav-title">收货地址</text>
      <view class="nav-spacer" />
    </view>

    <scroll-view class="page-scroll" scroll-y :style="bodyStyle">
      <view v-if="loading" class="state">加载中...</view>
      <view v-else-if="!list.length" class="state">暂无收货地址</view>
      <view v-else class="address-list">
        <view v-for="item in list" :key="item.id" class="address-card">
          <view class="card-head">
            <text class="receiver">{{ item.receiverName }}</text>
            <text class="phone">{{ item.receiverPhone }}</text>
            <text v-if="item.isDefault === 1" class="default-tag">默认</text>
          </view>
          <view class="card-address"><text>{{ formatFullAddress(item) }}</text></view>
          <view class="card-actions">
            <text class="action" @click="setDefault(item)">{{ item.isDefault === 1 ? '已默认' : '设为默认' }}</text>
            <text class="action" @click="openEdit(item)">编辑</text>
            <text class="action danger" @click="remove(item)">删除</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <view class="add-bar"><button class="add-btn" @click="openCreate">+ 新增地址</button></view>

    <LoginGuide v-model="loginGuideVisible" />
    <SuccessToast ref="successToastRef" />
  </view>
</template>

<style scoped>
.page { position: relative; height: 100vh; overflow: hidden; background: #f5f6f8; color: #172033; font-family: 'PingFang SC', '苹方-简', sans-serif; }
.nav { position: fixed; right: 0; left: 0; z-index: 20; display: flex; align-items: center; padding: 0 32rpx; box-sizing: border-box; background: #f5f6f8; }
.back-button { width: 34rpx; height: 34rpx; flex-shrink: 0; }
.nav-title { position: absolute; left: 50%; color: #111; font-size: 32rpx; font-weight: 600; transform: translateX(-50%); }
.nav-spacer { width: 34rpx; height: 34rpx; }
.page-scroll { position: absolute; inset: 0; box-sizing: border-box; }
.state { padding: 160rpx 0; color: #98a2b3; font-size: 26rpx; text-align: center; }
.address-list { padding: 20rpx 24rpx 160rpx; }
.address-card { margin-bottom: 16rpx; padding: 24rpx; border-radius: 20rpx; background: #fff; }
.card-head { display: flex; align-items: center; gap: 16rpx; }
.receiver { color: #172033; font-size: 28rpx; font-weight: 600; }
.phone { color: #475467; font-size: 26rpx; }
.default-tag { padding: 2rpx 12rpx; border-radius: 8rpx; background: rgba(255, 106, 43, .12); color: #ff5a1f; font-size: 20rpx; }
.card-address { margin-top: 10rpx; color: #667085; font-size: 24rpx; line-height: 1.5; }
.card-actions { display: flex; gap: 28rpx; margin-top: 16rpx; padding-top: 16rpx; border-top: 1rpx solid #f2f4f7; }
.action { color: #475467; font-size: 24rpx; }
.action.danger { color: #f04438; }
.add-bar { position: fixed; right: 0; bottom: 0; left: 0; z-index: 20; padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom)); box-sizing: border-box; background: #fff; }
/* 方形黑底白字：与新增/编辑地址整页的按钮保持一致（原来是橙色胶囊） */
.add-btn { height: 88rpx; margin: 0; border: 0; border-radius: 8rpx; background: #010101; color: #fff; font-size: 30rpx; font-weight: 600; line-height: 88rpx; }
.add-btn::after { border: 0; }
</style>
