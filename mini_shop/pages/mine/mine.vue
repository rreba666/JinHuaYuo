<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getUserProfile, getWalletInfo, updateUserProfile, type UserProfile, type WalletInfo } from '@/api/user'
import { isRegisteredUser } from '@/utils/auth'

const menuTop = ref(0)
const menuHeight = ref(32)
const bodyTop = computed(() => menuTop.value + menuHeight.value + 12)

const user = ref<UserProfile | null>(null)
const wallet = ref<WalletInfo | null>(null)
const profileEditorVisible = ref(false)
const profileSaving = ref(false)
const profileForm = reactive({ nickname: '', avatarUrl: '', phone: '' })
const registeredUser = computed(() => isRegisteredUser(user.value?.identity))

// 仅映射设计稿中已有的本地切图，缺失资源的条目由模板保留占位块。
const orderEntries = [
  { key: 'pending', label: '待付款', icon: '/static/my/待付款_slices/待付款.png' },
  { key: 'shipped', label: '待发货', icon: '/static/my/待发货_slices/待发货.png' },
  { key: 'received', label: '待收货', icon: '/static/my/待收货_slices/待收货.png' },
  { key: 'pickup', label: '待自提', icon: '/static/my/待自提_slices/待自提.png' },
  { key: 'completed', label: '退款/售后', icon: '/static/my/售后_slices/售后.png' },
]

const menuItems = [
  { key: 'invoice', label: '发票记录', icon: '/static/my/发票.png' },
  { key: 'service', label: '客服', icon: '/static/my/客服_slices/客服.png' },
  { key: 'settings', label: '设置', icon: '/static/my/设置_slices/设置.png' },
  { key: 'favorite', label: '我的收藏', icon: '/static/my/收藏_slices/收藏.png' },
  { key: 'materials', label: '商品素材', icon: '/static/my/商品素材_slices/商品素材.png' },
  { key: 'about', label: '关于我们', icon: '/static/my/关于我们_slices/关于我们.png' },
  { key: 'privacy', label: '隐私政策协议', icon: '/static/my/隐私_slices/隐私.png' },
]

const incomeEntries = computed(() => [
  { label: '我的余额', value: wallet.value?.balance },
  { label: '推广收益', value: wallet.value?.pendingPromotion },
  { label: '平台红包', value: wallet.value?.pendingBonus },
])

function formatIncome(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '0.00'
}

async function loadData(): Promise<void> {
  try { user.value = await getUserProfile() } catch { user.value = null /* 资料失败按游客处理 */ }
  if (!registeredUser.value) {
    wallet.value = null
    return
  }
  try { wallet.value = await getWalletInfo() } catch { /* 未登录时显示默认收益 */ }
}

function goOrder(key: string): void {
  // 待发货(status=1,物流) 与 待自提(status=1,自提) 用 pickupType 区分
  const tabMap: Record<string, { status?: number; pickupType?: number }> = {
    pending: { status: 0 },
    shipped: { status: 1, pickupType: 0 },
    received: { status: 2 },
    pickup: { status: 1, pickupType: 1 },
    completed: { status: 4 },
  }
  const target = tabMap[key]
  if (!target || target.status === undefined) { uni.navigateTo({ url: '/pages/orders/list' }); return }
  const pickup = target.pickupType !== undefined ? `&pickupType=${target.pickupType}` : ''
  uni.navigateTo({ url: `/pages/orders/list?status=${target.status}${pickup}` })
}

function goMenu(key: string): void {
  if (key === 'invoice') { uni.navigateTo({ url: '/pages/invoice/list' }); return }
  if (key === 'favorite') { uni.navigateTo({ url: '/pages/favorite/list' }); return }
  if (key === 'promotion') { goPromotionCenter(); return }
  if (key === 'wallet') { goWallet(); return }
  const item = menuItems.find((menu) => menu.key === key)
  uni.showToast({ title: `${item?.label || '功能'} - 功能开发中`, icon: 'none' })
}

/** 处理收益卡点击，推广收益进入独立推广页，其他收益暂不伪造明细。 */
function goIncome(index: number): void {
  if (!registeredUser.value) return
  if (index === 0) {
    goWallet()
    return
  }
  if (index === 1) {
    goPromotionCenter()
    return
  }
  if (index === 2) {
    uni.showToast({ title: '平台红包详情接口待后端提供', icon: 'none' })
  }
}

function goAllOrders(): void {
  uni.navigateTo({ url: '/pages/orders/list' })
}

function goWallet(): void {
  if (!registeredUser.value) {
    uni.showToast({ title: '完成订单后开放推广功能', icon: 'none' })
    return
  }
  uni.navigateTo({ url: '/pages/wallet/withdraw' })
}

/** 进入推广中心前再次校验身份，防止异步刷新期间出现越权跳转。 */
function goPromotionCenter(): void {
  if (!registeredUser.value) {
    uni.showToast({ title: '完成订单后开放推广功能', icon: 'none' })
    return
  }
  uni.navigateTo({ url: '/pages/dividend/dividend' })
}

function goEditProfile(): void {
  Object.assign(profileForm, { nickname: user.value?.nickname || '', avatarUrl: user.value?.avatarUrl || '', phone: user.value?.phone || '' })
  profileEditorVisible.value = true
}

async function saveProfile(): Promise<void> {
  if (!profileForm.nickname.trim()) { uni.showToast({ title: '请输入昵称', icon: 'none' }); return }
  profileSaving.value = true
  try {
    user.value = await updateUserProfile({ nickname: profileForm.nickname.trim(), avatarUrl: profileForm.avatarUrl.trim(), phone: profileForm.phone.trim() })
    profileEditorVisible.value = false
    uni.showToast({ title: '资料已保存', icon: 'success' })
  } catch (error) { uni.showToast({ title: error instanceof Error ? error.message : '资料保存失败', icon: 'none' }) }
  finally { profileSaving.value = false }
}

onMounted(() => {
  try {
    const menuButton = uni.getMenuButtonBoundingClientRect()
    if (menuButton) {
      menuTop.value = menuButton.top
      menuHeight.value = menuButton.height
    }
  } catch { /* 非微信环境没有胶囊按钮 */ }
  void loadData()
})

onShow(() => { void loadData() })
</script>

<template>
  <view class="pg">
    <scroll-view class="bd" scroll-y>
      <view class="hero" :style="{ paddingTop: bodyTop + 'px' }">
        <view class="profile-row">
          <view class="u-avatar">
            <image v-if="user?.avatarUrl" class="u-avatar-image" :src="user.avatarUrl" mode="aspectFill" />
          </view>
          <view class="u-info" @click="goEditProfile">
            <text class="u-name">{{ user?.nickname || '我的姓名微信名' }}</text>
            <image v-if="registeredUser" class="vip-avatar-badge" src="/static/my/vip 头像_slices/vip 头像.png" mode="aspectFit" />
            <text v-if="user" class="u-id">ID: {{ user.id }}</text>
          </view>
          <image class="qr-mark" src="/static/my/QRcode.png" mode="aspectFit" />
        </view>

        <view class="member-card" :class="{ 'member-card-guest': !registeredUser }">
          <image v-if="registeredUser" class="member-card-background" src="/static/my/vip会员背景_slices/vip会员背景.png" mode="scaleToFill" />
          <view v-else class="member-mark" />
          <text :class="['member-label', { 'member-label-registered': registeredUser }]">{{ registeredUser ? '您已是vip会员用户啦' : '游客' }}</text>
          <view v-if="registeredUser" class="member-benefits"><text>查看权益</text><image class="benefits-arrow benefits-arrow-white" src="/static/my/右_白/右.png" mode="aspectFit" /></view>
          <view v-else class="member-end" />
        </view>

        <view v-if="registeredUser" class="income-strip">
          <view v-for="(item, index) in incomeEntries" :key="item.label" class="income-item" @click="goIncome(index)">
            <text class="income-value">{{ formatIncome(item.value) }}</text>
            <text class="income-label">{{ item.label }}</text>
            <view v-if="index === 2" class="income-dot" />
          </view>
        </view>
      </view>

      <view class="order-section">
        <view class="order-head">
          <text class="order-title">我的订单</text>
          <view class="order-all" @click="goAllOrders"><text>全部</text><image class="all-arrow" src="/static/my/右_slices/右.png" mode="aspectFit" /></view>
        </view>
        <view class="order-grid">
          <view v-for="entry in orderEntries" :key="entry.key" class="order-item" @click="goOrder(entry.key)">
            <image v-if="entry.icon" class="order-icon order-icon-image" :src="entry.icon" mode="aspectFit" />
            <view v-else class="order-icon" />
            <text class="order-label">{{ entry.label }}</text>
          </view>
        </view>
      </view>

      <view class="menu-section">
        <view class="menu-list">
          <view v-for="item in menuItems" :key="item.key" class="menu-item" @click="goMenu(item.key)">
            <image v-if="item.icon" class="menu-icon menu-icon-image" :src="item.icon" mode="aspectFit" />
            <view v-else class="menu-icon" />
            <text class="menu-label">{{ item.label }}</text>
          </view>
        </view>
      </view>

    </scroll-view>

    <view v-show="profileEditorVisible" class="mask" @click="profileEditorVisible = false">
      <view class="sheet" @click.stop>
        <view class="sheet-head"><text class="sheet-title">编辑资料</text><text class="sheet-close" @click="profileEditorVisible = false">×</text></view>
        <input v-model="profileForm.nickname" class="sheet-input" placeholder="请输入昵称" />
        <input v-model="profileForm.phone" class="sheet-input" type="number" maxlength="11" placeholder="请输入手机号" />
        <input v-model="profileForm.avatarUrl" class="sheet-input" placeholder="头像地址（可选）" />
        <button class="sheet-submit" :disabled="profileSaving" @click="saveProfile">{{ profileSaving ? '保存中...' : '保存资料' }}</button>
      </view>
    </view>
  </view>
</template>

<style>
.pg { display: flex; flex-direction: column; height: 100vh; overflow: hidden; background: #fff; color: #242526; }
.bd { flex: 1; width: 100%; min-height: 0; margin-bottom: -50rpx; box-sizing: border-box; }

.hero { position: relative; overflow: hidden; padding-right: 38.17rpx; padding-left: 38.17rpx; background: #0d0e0f; color: #fff; }
.hero::before { position: absolute; top: -120rpx; right: -120rpx; width: 760rpx; height: 620rpx; background: repeating-linear-gradient(132deg, transparent 0 22rpx, rgba(178, 143, 77, .45) 23rpx 26rpx); content: ''; transform: rotate(4deg); opacity: .72; }
.hero::after { position: absolute; bottom: 184rpx; left: -180rpx; width: 740rpx; height: 280rpx; background: repeating-linear-gradient(18deg, transparent 0 28rpx, rgba(132, 102, 59, .32) 29rpx 32rpx); content: ''; transform: rotate(-16deg); opacity: .6; }
.profile-row { position: relative; z-index: 1; display: flex; align-items: center; padding: 16rpx 0 48rpx; }
.u-avatar { width: 99.24rpx; height: 99.24rpx; flex-shrink: 0; overflow: hidden; border-radius: 50%; background: #819a7b; }
.u-avatar-image { width: 100%; height: 100%; }
.u-info { display: flex; min-width: 0; flex: 1; flex-direction: column; align-items: flex-start; margin-left: 22.9rpx; }
.u-name { overflow: hidden; color: #fff; font-size: 26.72rpx; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.vip-avatar-badge { width: 78rpx; height: 25.5rpx; margin-top: 8rpx; }
.u-id { margin-top: 8rpx; color: rgba(255, 255, 255, .72); font-size: 21rpx; line-height: 1.2; }
.qr-mark { width: 93.51rpx; height: 93.51rpx; flex-shrink: 0; }

.member-card { position: relative; z-index: 1; display: flex; align-items: center; height: 82.06rpx; padding: 0 24.8rpx 0 38.17rpx; box-sizing: border-box; overflow: hidden; border-radius: 16rpx 16rpx 0 0; box-shadow: 0 8rpx 18rpx rgba(0, 0, 0, .16); color: #55575b; }
.member-card:not(.member-card-guest) { align-items: flex-start; height: 304rpx; padding-right: 48rpx; }
.member-card-background { position: absolute; inset: 0; z-index: 0; width: 100%; height: 100%; }
.member-card-guest { background: linear-gradient(108deg, #f4f4f6 0%, #d9dade 38%, #aeb0b6 100%); }
.member-mark, .member-end { position: relative; z-index: 1; width: 38.17rpx; height: 38.17rpx; flex-shrink: 0; background: #55565a; }
.member-label { position: relative; z-index: 1; margin-left: 19.08rpx; font-size: 26.72rpx; font-weight: 500; }
.member-label-registered { margin-top: 48rpx; margin-left: 114rpx; }
.member-benefits { position: relative; z-index: 1; display: flex; align-items: center; gap: 8rpx; margin-top: 48rpx; margin-left: auto; color: #FFFFFF; font-size: 22.9rpx; font-weight: 600; white-space: nowrap; }
.benefits-arrow { width: 14rpx; height: 16rpx; }
.member-end { position: relative; z-index: 1; margin-left: auto; }
.income-strip { position: relative; z-index: 1; display: flex; height: 196rpx; margin: -196rpx -38.17rpx 0; padding: 38rpx 38.17rpx 50rpx; box-sizing: border-box; overflow: hidden; background: linear-gradient(104deg, #303134 0%, #5c5d61 48%, #28292b 100%); box-shadow: inset 0 1rpx rgba(255, 255, 255, .24); }
.income-strip::after { position: absolute; top: -120%; left: -16%; width: 34%; height: 340%; background: linear-gradient(108deg, transparent 0%, rgba(255, 255, 255, .11) 46%, rgba(255, 255, 255, .03) 62%, transparent 100%); content: ''; transform: rotate(16deg); pointer-events: none; }
.income-item { position: absolute; top: 0; bottom: 0; z-index: 1; display: block; }
.income-item:nth-child(1) { left: 0; width: 252rpx; }
.income-item:nth-child(2) { left: 252rpx; width: 280rpx; }
.income-item:nth-child(3) { right: 0; left: 532rpx; }
.income-item + .income-item::before { position: absolute; top: 54rpx; left: 0; width: 2rpx; height: 84rpx; background: rgba(255, 255, 255, .72); content: ''; }
.income-value { position: absolute; top: 50rpx; color: #fff; font-size: 48rpx; font-weight: 700; line-height: 58rpx; white-space: nowrap; }
.income-item:nth-child(1) .income-value { left: 86rpx; width: 110rpx; text-align: center; }
.income-item:nth-child(2) .income-value { left: 86rpx; width: 110rpx; text-align: center; }
.income-item:nth-child(3) .income-value { left: 58rpx; width: 110rpx; text-align: center; }
.income-label { position: absolute; top: 120rpx; margin: 0; color: #fff; font-size: 24rpx; line-height: 34rpx; white-space: nowrap; }
.income-item:nth-child(1) .income-label { left: 86rpx; width: 110rpx; text-align: center; }
.income-item:nth-child(2) .income-label { left: 92rpx; }
.income-item:nth-child(3) .income-label { left: 64rpx; }
.income-dot { position: absolute; top: 56rpx; left: 160rpx; width: 20rpx; height: 20rpx; border-radius: 50%; background: #f34848; }

.order-section { padding: 34rpx 0 38rpx; background: #fff; border-bottom: 22.9rpx solid #f5f5f5; color: #1E1E1E; font-family: 'PingFang SC', '苹方-简', sans-serif; font-weight: 500; }
.order-head { display: flex; align-items: center; justify-content: space-between; padding: 0 38.17rpx; }
.order-title { color: #1E1E1E; font-size: 26.72rpx; font-weight: 500; }
.order-all { display: flex; align-items: center; gap: 15.27rpx; color: #1E1E1E; font-size: 26.72rpx; }
.all-arrow { width: 14rpx; height: 16rpx; }
.order-grid { display: flex; padding: 24rpx 59.16rpx 0 38.17rpx; box-sizing: border-box; justify-content: space-between; }
.order-item { display: flex; width: 80.15rpx; flex: 0 0 80.15rpx; flex-direction: column; align-items: center; }
.order-icon { width: 80.15rpx; height: 80.15rpx; background: #d8d8d8; }
.order-icon-image { background: transparent; }
.order-label { margin-top: 16rpx; color: #1E1E1E; font-size: 26.72rpx; font-weight: 500; white-space: nowrap; }

.menu-section { padding: 0 0 120rpx; background: #fff; font-family: 'PingFang SC', '苹方-简', sans-serif; font-weight: 500; }
.menu-list { background: #fff; }
.menu-item { display: flex; align-items: center; min-height: 99.24rpx; padding: 0 38.17rpx; box-sizing: border-box; border-bottom: 0; }
.menu-item:last-child { border-bottom: 0; }
.menu-icon { width: 45.8rpx; height: 45.8rpx; flex-shrink: 0; margin-right: 34.35rpx; background: #d8d8d8; }
.menu-icon-image { background: transparent; }
.menu-label { color: #4F4F4F; font-size: 26.72rpx; font-weight: 500; }
.mask { position: fixed; inset: 0; z-index: 20; display: flex; align-items: flex-end; background: rgba(0, 0, 0, .62); }
.sheet { width: 100%; padding: 30rpx 28rpx calc(30rpx + env(safe-area-inset-bottom)); background: #fff; box-sizing: border-box; }
.sheet-head { display: flex; align-items: center; justify-content: center; min-height: 54rpx; }.sheet-title { font-size: 30rpx; font-weight: 700; }.sheet-close { position: absolute; right: 30rpx; color: #888; font-size: 42rpx; }
.sheet-input { height: 78rpx; margin-top: 20rpx; padding: 0 22rpx; background: #f7f7f7; box-sizing: border-box; color: #333; font-size: 25rpx; }.balance { display: block; margin-top: 22rpx; color: #555; font-size: 26rpx; }
.sheet-submit { height: 78rpx; margin: 28rpx 0 0; color: #fff; background: #222; border-radius: 4rpx; font-size: 27rpx; }.sheet-submit::after { border: 0; }
</style>
