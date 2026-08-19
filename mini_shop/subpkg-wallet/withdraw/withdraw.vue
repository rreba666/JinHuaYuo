<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { onShow, onUnload } from '@dcloudio/uni-app'
import { getRealnameStatus } from '@/api/realname'
import { applyTransferAuth, getTransferAuthStatus, type TransferAuthState } from '@/api/transfer-auth'
import { getUserProfile, getWalletInfo, searchUser, transferWallet, withdrawWallet, getWithdrawals, type UserProfile, type UserSearchVO, type WalletInfo, type WithdrawRecord } from '@/api/user'
import RealnameVerifySheet from '@/components/RealnameVerifySheet.vue'
import { getAuth, hasWalletNoticeSeen, isRegisteredUser, markWalletNoticeSeen } from '@/utils/auth'
import { isApiRequestError } from '@/utils/request'
import { MERCHANT_TRANSFER_APP_ID, MERCHANT_TRANSFER_MCH_ID, TRANSFER_MIN_AMOUNT, WITHDRAW_MIN_AMOUNT } from '@/utils/wallet-config'

const menuTop = ref(0)
const menuHeight = ref(32)
const user = ref<UserProfile | null>(null)
const wallet = ref<WalletInfo | null>(null)
const loading = ref(false)
const currentTab = ref<'withdraw' | 'transfer'>('transfer')
const withdrawAmount = ref('')
const transferUserId = ref('')
const transferAmount = ref('')
const recipient = ref<UserSearchVO | null>(null)
const searching = ref(false)
const withdrawSubmitting = ref(false)
const transferSubmitting = ref(false)
/** 提现记录列表（含审核状态）。 */
const withdrawRecords = ref<WithdrawRecord[]>([])
const recordsPage = ref(1)
const recordsLoading = ref(false)
const recordsFinished = ref(false)
const walletNoticeVisible = ref(false)
const walletNoticeSeen = ref(hasWalletNoticeSeen())
const realnameVisible = ref(false)
const realnameVerified = ref(false)
const realnameChecking = ref(false)
const pendingAction = ref<'withdraw' | 'transfer' | null>(null)
const pendingWithdrawAmount = ref<number | null>(null)
const pendingTransfer = ref<{ toUserId: number; amount: number } | null>(null)
/** 免确认收款授权状态（''=未授权，WAIT_USER_CONFIRM=待确认，TAKING_EFFECT=已授权）。 */
const transferAuthState = ref<TransferAuthState>('')
const authStatusError = ref(false)
const authLoading = ref(false)
const authApplying = ref(false)
let authPollTimer: ReturnType<typeof setTimeout> | null = null
const MIN_TRANSFER_AUTH_SDK_VERSION = '3.7.9'
const accessChecking = ref(false)
const accessDenied = ref(false)
const registeredUser = computed(() => isRegisteredUser(user.value?.identity))

const navStyle = computed(() => ({ top: `${menuTop.value}px`, height: `${menuHeight.value}px` }))
const bodyStyle = computed(() => ({ paddingTop: `${menuTop.value + menuHeight.value + uni.upx2px(100)}px` }))
const availableBalance = computed(() => Number(wallet.value?.balance ?? 0))
const withdrawMinimumLabel = computed(() => formatMoney(WITHDRAW_MIN_AMOUNT))
/** 用户输入的提现金额（非法输入按 0 处理）。 */
const withdrawAmountNumber = computed(() => {
  const value = Number(withdrawAmount.value)
  return Number.isFinite(value) ? value : 0
})
/** 5% 提现手续费。 */
const withdrawFee = computed(() => (withdrawAmountNumber.value > 0 ? withdrawAmountNumber.value * 0.05 : 0))
/** 扣除手续费后的实际到账金额。 */
const withdrawActual = computed(() => (withdrawAmountNumber.value > 0 ? withdrawAmountNumber.value * 0.95 : 0))
/** 是否需要引导完成免确认收款授权。 */
const needAuth = computed(() => transferAuthState.value !== 'TAKING_EFFECT')

function formatMoney(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00'
}

/** 比较微信基础库版本号，避免低版本调用授权 API 后只返回笼统 fail。 */
function compareVersion(left: string, right: string): number {
  const leftParts = left.split('.').map((part) => Number(part) || 0)
  const rightParts = right.split('.').map((part) => Number(part) || 0)
  const length = Math.max(leftParts.length, rightParts.length)
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0)
    if (difference !== 0) return difference
  }
  return 0
}

/** 读取真机微信基础库版本，非微信环境返回空字符串交给环境检查处理。 */
function readWechatSdkVersion(): string {
  try {
    // @ts-ignore 微信小程序专用 API，仅微信环境可用
    const systemInfo = typeof wx !== 'undefined' && typeof wx.getSystemInfoSync === 'function'
      ? wx.getSystemInfoSync()
      : null
    return systemInfo?.SDKVersion || ''
  } catch {
    return ''
  }
}

async function loadWallet(): Promise<void> {
  if (!registeredUser.value) return
  loading.value = true
  try {
    wallet.value = await getWalletInfo()
  } catch (error) {
    wallet.value = null
    uni.showToast({ title: error instanceof Error ? error.message : '余额加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

/** 提现状态码 → 展示样式类名，用于区分审核各阶段颜色。 */
function withdrawStatusClass(status: string): string {
  switch (status) {
    case 'PENDING_REVIEW': return 'pending'
    case 'APPROVED': return 'approved'
    case 'SUCCESS': return 'success'
    case 'FAILED': return 'failed'
    case 'REJECTED': return 'rejected'
    case 'STUCK': return 'stuck'
    default: return ''
  }
}

/** 分页加载当前用户提现记录，展示审核状态。reset=true 时清空重载。 */
async function loadWithdrawRecords(reset = false): Promise<void> {
  if (recordsLoading.value) return
  if (reset) {
    recordsPage.value = 1
    recordsFinished.value = false
    withdrawRecords.value = []
  }
  if (recordsFinished.value) return
  recordsLoading.value = true
  try {
    const result = await getWithdrawals(recordsPage.value, 20)
    withdrawRecords.value = [...withdrawRecords.value, ...result.list]
    recordsFinished.value = withdrawRecords.value.length >= result.total
    recordsPage.value += 1
  } catch {
    // 记录加载失败静默处理，不影响提现主流程
  } finally {
    recordsLoading.value = false
  }
}

function openWalletNotice(): void {
  if (walletNoticeSeen.value) return
  walletNoticeVisible.value = true
}

function acknowledgeWalletNotice(): void {
  markWalletNoticeSeen()
  walletNoticeSeen.value = true
  walletNoticeVisible.value = false
}

function goBack(): void {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack({ delta: 1 })
    return
  }
  uni.switchTab({ url: '/pages/mine/mine' })
}

/** 拦截游客访问钱包页，并返回个人中心等待后端身份升级。 */
function denyGuestAccess(): void {
  if (accessDenied.value) return
  accessDenied.value = true
  uni.showToast({ title: '完成订单后开放推广功能', icon: 'none' })
  setTimeout(() => uni.switchTab({ url: '/pages/mine/mine' }), 650)
}

/** 刷新用户身份，只有注册用户才加载余额、授权和提现数据。 */
async function ensureRegisteredAccess(): Promise<boolean> {
  if (accessDenied.value || accessChecking.value) return false
  accessChecking.value = true
  try {
    user.value = await getUserProfile()
    if (!registeredUser.value) {
      denyGuestAccess()
      return false
    }
    return true
  } catch {
    user.value = null
    denyGuestAccess()
    return false
  } finally {
    accessChecking.value = false
  }
}

/** 初始化或刷新钱包页，确保身份升级后重新进入即可使用提现功能。 */
async function loadPage(): Promise<void> {
  if (!(await ensureRegisteredAccess())) return
  await Promise.all([loadWallet(), loadTransferAuthStatus(), loadWithdrawRecords(true)])
  openWalletNotice()
}

/** 查询免确认收款授权状态。 */
async function loadTransferAuthStatus(): Promise<boolean> {
  authLoading.value = true
  authStatusError.value = false
  try {
    const status = await getTransferAuthStatus()
    transferAuthState.value = status.state === 'TAKING_EFFECT' || status.state === 'WAIT_USER_CONFIRM'
      ? status.state
      : ''
    return true
  } catch {
    transferAuthState.value = ''
    authStatusError.value = true
    return false
  } finally {
    authLoading.value = false
  }
}

/** 手动重试授权状态查询，避免网络异常时沿用旧授权状态。 */
async function refreshTransferAuth(): Promise<void> {
  await loadTransferAuthStatus()
}

/** 停止授权状态轮询。 */
function stopAuthPolling(): void {
  if (authPollTimer) {
    clearTimeout(authPollTimer)
    authPollTimer = null
  }
}

/** 轮询授权状态，直到已授权或超过最大次数。 */
function startAuthPolling(attempt = 0): void {
  stopAuthPolling()
  if (attempt >= 10) return
  authPollTimer = setTimeout(async () => {
    try {
      const status = await getTransferAuthStatus()
      if (status.state === 'TAKING_EFFECT') {
        transferAuthState.value = 'TAKING_EFFECT'
        authStatusError.value = false
        uni.showToast({ title: '授权成功，可正常提现', icon: 'success' })
        return
      }
      transferAuthState.value = status.state === 'WAIT_USER_CONFIRM' ? 'WAIT_USER_CONFIRM' : ''
      authStatusError.value = false
      startAuthPolling(attempt + 1)
    } catch {
      transferAuthState.value = ''
      authStatusError.value = true
      startAuthPolling(attempt + 1)
    }
  }, 2000)
}

/** 读取当前微信运行容器的 AppID，用于阻止配置与实际小程序身份不一致。 */
function readRuntimeAppId(): string {
  try {
    // @ts-ignore 微信小程序专用 API，仅微信环境可用
    const accountInfo = typeof wx !== 'undefined' && typeof wx.getAccountInfoSync === 'function'
      ? wx.getAccountInfoSync()
      : null
    return accountInfo?.miniProgram?.appId || ''
  } catch {
    return ''
  }
}

/** 拉起微信免确认收款授权页，并保留微信返回的失败原因。 */
function openMerchantTransferAuth(packageInfo: string): void {
  if (!MERCHANT_TRANSFER_MCH_ID || !MERCHANT_TRANSFER_APP_ID) {
    uni.showToast({ title: '未配置商户转账参数，请联系管理员', icon: 'none' })
    return
  }
  const sdkVersion = readWechatSdkVersion()
  if (sdkVersion && compareVersion(sdkVersion, MIN_TRANSFER_AUTH_SDK_VERSION) < 0) {
    uni.showToast({ title: `微信基础库需达到 ${MIN_TRANSFER_AUTH_SDK_VERSION}，请升级微信`, icon: 'none' })
    return
  }
  const runtimeAppId = readRuntimeAppId()
  if (runtimeAppId && runtimeAppId !== MERCHANT_TRANSFER_APP_ID) {
    uni.showToast({ title: '当前小程序 AppID 与支付配置不一致，请重新编译', icon: 'none' })
    return
  }
  // @ts-ignore 微信商家转账授权 API，仅微信小程序环境可用
  if (typeof wx === 'undefined' || typeof wx.requestMerchantTransfer !== 'function') {
    uni.showToast({ title: '当前环境不支持授权，请在微信小程序中操作', icon: 'none' })
    return
  }
  // @ts-ignore
  wx.requestMerchantTransfer({
    mchId: MERCHANT_TRANSFER_MCH_ID,
    appId: MERCHANT_TRANSFER_APP_ID,
    package: packageInfo,
    success: () => {
      // 授权页展示成功，不等同于用户已确认，需轮询确认
      transferAuthState.value = 'WAIT_USER_CONFIRM'
      authStatusError.value = false
      startAuthPolling()
    },
    fail: (res: { errMsg?: string }) => {
      transferAuthState.value = ''
      const errMsg = res?.errMsg || ''
      const detail = errMsg.replace('requestMerchantTransfer:', '').trim()
      if (detail === 'cancel') {
        uni.showToast({ title: '已取消授权', icon: 'none' })
        return
      }
      uni.showToast({ title: detail ? `授权页拉起失败：${detail}` : '授权页拉起失败，请重试', icon: 'none' })
    },
  })
}

/** 用户点击「去授权」。 */
async function handleAuthorize(): Promise<void> {
  if (authApplying.value) return
  authApplying.value = true
  try {
    const packageInfo = (await applyTransferAuth()).packageInfo
    if (packageInfo === null) {
      // 已授权（幂等），直接刷新状态
      await loadTransferAuthStatus()
    } else if (typeof packageInfo === 'string' && packageInfo.length > 0) {
      openMerchantTransferAuth(packageInfo)
    } else {
      throw new Error('授权 package 信息为空')
    }
  } catch (error) {
    showWalletActionError(error, '授权发起失败')
  } finally {
    authApplying.value = false
  }
}

/** 将提现和授权接口的关键业务码转换成明确的用户提示。 */
function showWalletActionError(error: unknown, fallback: string): void {
  if (isApiRequestError(error) && error.code === 7005) {
    uni.showToast({ title: '已有一笔提现正在处理中，请稍后重试', icon: 'none' })
    return
  }
  if (isApiRequestError(error) && error.code === 9000) {
    uni.showToast({ title: '微信服务暂时不可用，请稍后重试', icon: 'none' })
    return
  }
  uni.showToast({ title: error instanceof Error ? error.message : fallback, icon: 'none' })
}

async function ensureRealnameReady(action: 'withdraw' | 'transfer'): Promise<boolean> {
  if (realnameVerified.value) return true
  if (realnameChecking.value) return false

  realnameChecking.value = true
  try {
    const status = await getRealnameStatus()
    realnameVerified.value = status.verified
    if (status.verified) return true
    pendingAction.value = action
    realnameVisible.value = true
    return false
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '实名认证状态查询失败', icon: 'none' })
    return false
  } finally {
    realnameChecking.value = false
  }
}

async function executeWithdraw(amount: number): Promise<void> {
  if (withdrawSubmitting.value) return
  withdrawSubmitting.value = true
  try {
    await withdrawWallet(amount, 'BALANCE')
    withdrawAmount.value = ''
    pendingWithdrawAmount.value = null
    pendingAction.value = null
    await loadWallet()
    await loadWithdrawRecords(true)
    uni.showToast({ title: '提现申请已提交，待审核', icon: 'success' })
  } catch (error) {
    if (isApiRequestError(error) && error.code === 8601) {
      // 未实名认证 → 引导实名
      realnameVerified.value = false
      pendingAction.value = 'withdraw'
      pendingWithdrawAmount.value = amount
      realnameVisible.value = true
    } else if (isApiRequestError(error) && error.code === 7007) {
      // 未完成免确认收款授权 → 引导授权
      transferAuthState.value = ''
      pendingWithdrawAmount.value = amount
      uni.showToast({ title: '请先完成免确认收款授权', icon: 'none' })
    } else {
      showWalletActionError(error, '提现申请失败')
    }
  } finally {
    withdrawSubmitting.value = false
  }
}

async function handleWithdraw(): Promise<void> {
  const amount = Number(withdrawAmount.value)
  if (!Number.isFinite(amount) || amount < WITHDRAW_MIN_AMOUNT) {
    uni.showToast({ title: `请输入至少 ${withdrawMinimumLabel.value} 的提现余额`, icon: 'none' })
    return
  }
  if (amount > availableBalance.value) {
    uni.showToast({ title: '提现余额超过可用余额', icon: 'none' })
    return
  }

  pendingWithdrawAmount.value = amount
  if (!(await ensureRealnameReady('withdraw'))) return
  await executeWithdraw(amount)
}

async function handleSearchRecipient(): Promise<void> {
  if (searching.value) return
  const userId = Number(transferUserId.value)
  if (!Number.isInteger(userId) || userId <= 0) {
    uni.showToast({ title: '请输入正确的用户ID', icon: 'none' })
    return
  }

  searching.value = true
  try {
    recipient.value = await searchUser(userId)
  } catch (error) {
    recipient.value = null
    uni.showToast({ title: error instanceof Error ? error.message : '查找接收人失败', icon: 'none' })
  } finally {
    searching.value = false
  }
}

async function executeTransfer(payload: { toUserId: number; amount: number }): Promise<void> {
  if (transferSubmitting.value) return
  transferSubmitting.value = true
  try {
    await transferWallet(payload)
    transferAmount.value = ''
    recipient.value = null
    pendingTransfer.value = null
    pendingAction.value = null
    await loadWallet()
    uni.showToast({ title: '转账已提交', icon: 'success' })
  } catch (error) {
    if (isApiRequestError(error) && error.code === 8601) {
      realnameVerified.value = false
      pendingAction.value = 'transfer'
      pendingTransfer.value = payload
      realnameVisible.value = true
    } else {
      showWalletActionError(error, '转账失败')
    }
  } finally {
    transferSubmitting.value = false
  }
}

async function handleTransfer(): Promise<void> {
  const amount = Number(transferAmount.value)
  if (!recipient.value) {
    uni.showToast({ title: '请先查找接收人', icon: 'none' })
    return
  }
  if (!Number.isFinite(amount) || amount < TRANSFER_MIN_AMOUNT) {
    uni.showToast({ title: '请输入有效转账余额', icon: 'none' })
    return
  }
  if (amount > availableBalance.value) {
    uni.showToast({ title: '转账余额超过可用余额', icon: 'none' })
    return
  }
  if (getAuth()?.userId != null && recipient.value.id === getAuth()?.userId) {
    uni.showToast({ title: '不能转给自己', icon: 'none' })
    return
  }

  const payload = { toUserId: recipient.value.id, amount }
  pendingTransfer.value = payload
  if (!(await ensureRealnameReady('transfer'))) return
  await executeTransfer(payload)
}

async function handleRealnameVerified(): Promise<void> {
  realnameVerified.value = true
  realnameVisible.value = false

  const action = pendingAction.value
  pendingAction.value = null

  if (action === 'withdraw' && pendingWithdrawAmount.value != null) {
    const amount = pendingWithdrawAmount.value
    pendingWithdrawAmount.value = null
    await executeWithdraw(amount)
    return
  }
  if (action === 'transfer' && pendingTransfer.value) {
    const payload = pendingTransfer.value
    pendingTransfer.value = null
    await executeTransfer(payload)
  }
}

watch(transferUserId, () => {
  recipient.value = null
})

onMounted(() => {
  try {
    const rect = uni.getMenuButtonBoundingClientRect()
    if (rect) {
      menuTop.value = rect.top
      menuHeight.value = rect.height
    }
  } catch { /* 非微信环境没有胶囊按钮 */ }
})

onShow(() => { void loadPage() })

onUnload(() => {
  stopAuthPolling()
})
</script>

<template>
  <view class="page">
    <view class="nav" :style="navStyle">
      <image class="back-button" src="/static/left_arrow.png" mode="aspectFit" @click="goBack" />
      <text class="nav-title">余额转账</text>
      <view class="nav-spacer" />
    </view>

    <scroll-view v-if="registeredUser" class="page-scroll" scroll-y :style="bodyStyle">
      <view class="page-content">
        <view class="hero-card">
          <image class="hero-card-bg" src="/static/bg/钱包页背景.png" mode="aspectFill" />
          <text class="hero-label">可转账余额</text>
          <text class="hero-value">{{ formatMoney(availableBalance) }}</text>
          <text class="hero-subtitle">1:1 提现</text>
        </view>

        <view class="tab-row">
          <view class="tab-item" :class="{ active: currentTab === 'withdraw' }" @click="currentTab = 'withdraw'">提现</view>
          <view class="tab-item" :class="{ active: currentTab === 'transfer' }" @click="currentTab = 'transfer'">转赠他人</view>
        </view>

        <view v-show="currentTab === 'withdraw'" class="panel-card">
          <text class="panel-title">提现方式</text>
          <view class="type-row">
            <view class="type-chip active">零钱提现</view>
          </view>
          <text class="panel-title panel-section-title">提现金额</text>
          <input v-model="withdrawAmount" class="panel-input" type="digit" :placeholder="`请输入提现余额，最低 ${withdrawMinimumLabel}`" />
          <text class="fee-hint">提现将收取 5% 手续费，实际到账金额为提现金额的 95%，提交后进入审核。</text>
          <text v-if="withdrawAmountNumber > 0" class="fee-calc">手续费 ¥{{ formatMoney(withdrawFee) }}，实际到账 ¥{{ formatMoney(withdrawActual) }}</text>
          <!-- 未完成免确认收款授权时引导授权 -->
          <view v-if="authStatusError" class="auth-banner">
            <text class="auth-text">授权状态获取失败，请重试</text>
            <button class="panel-button" :disabled="authLoading" @click="refreshTransferAuth">
              {{ authLoading ? '刷新中...' : '刷新授权状态' }}
            </button>
          </view>
          <view v-else-if="needAuth" class="auth-banner">
            <text class="auth-text">{{ transferAuthState === 'WAIT_USER_CONFIRM' ? '授权未完成，请再次确认授权' : '首次提现前需完成免确认收款授权，提交后由平台审核打款' }}</text>
            <button class="panel-button" :disabled="authApplying || authLoading" @click="handleAuthorize">
              {{ authApplying ? '授权中...' : (transferAuthState === 'WAIT_USER_CONFIRM' ? '重新授权' : '去授权') }}
            </button>
          </view>
          <template v-else>
            <button class="panel-button" :disabled="withdrawSubmitting" @click="handleWithdraw">
              {{ withdrawSubmitting ? '提交中...' : '确认提现' }}
            </button>
          </template>
        </view>

        <view v-show="currentTab === 'transfer'" class="panel-card">
          <text class="panel-title">转账账号</text>
          <view class="search-row">
            <input v-model="transferUserId" class="panel-input search-input" type="number" placeholder="请输入接收人账号或ID" />
            <button class="search-button" :disabled="searching" @click="handleSearchRecipient">
              {{ searching ? '查找中...' : '查找' }}
            </button>
          </view>
          <view v-if="recipient" class="recipient-card">
            <image v-if="recipient.avatarUrl" class="recipient-avatar" :src="recipient.avatarUrl" mode="aspectFill" />
            <view v-else class="recipient-avatar placeholder" />
            <view class="recipient-info">
              <text class="recipient-name">{{ recipient.nickname }}</text>
              <text class="recipient-id">ID: {{ recipient.id }}</text>
            </view>
          </view>
          <text class="panel-title panel-section-title">转出金额</text>
          <input v-model="transferAmount" class="panel-input" type="digit" placeholder="请输入转出余额" />
          <button class="panel-button" :disabled="transferSubmitting" @click="handleTransfer">
            {{ transferSubmitting ? '提交中...' : '确认转账' }}
          </button>
        </view>

        <view class="records-card">
          <text class="records-title">提现记录</text>
          <view v-if="withdrawRecords.length" class="records-list">
            <view v-for="record in withdrawRecords" :key="record.withdrawNo" class="record-item">
              <view class="record-top">
                <text class="record-type">{{ record.typeDesc }}</text>
                <text :class="['record-status', withdrawStatusClass(record.status)]">{{ record.statusDesc }}</text>
              </view>
              <view class="record-mid">
                <text class="record-amount">¥ {{ formatMoney(record.amount) }}</text>
                <text class="record-time">{{ record.createdAt }}</text>
              </view>
              <text v-if="record.failReason" class="record-reason">{{ record.failReason }}</text>
            </view>
          </view>
          <view v-else class="records-empty">{{ recordsLoading ? '加载中...' : '暂无提现记录' }}</view>
          <view v-if="!recordsFinished && withdrawRecords.length" class="records-more" @click="loadWithdrawRecords()">
            {{ recordsLoading ? '加载中...' : '加载更多' }}
          </view>
        </view>
      </view>
    </scroll-view>

    <view v-show="walletNoticeVisible" class="mask" @click="acknowledgeWalletNotice">
      <view class="notice-card" @click.stop>
        <view class="notice-head">
          <text class="notice-title">温馨提示</text>
          <text class="notice-close" @click="acknowledgeWalletNotice">×</text>
        </view>
        <text class="notice-body">余额按 1:1 提现，请确认提现方式、接收人和余额数无误。</text>
        <button class="notice-button" @click="acknowledgeWalletNotice">我知道了</button>
      </view>
    </view>

    <RealnameVerifySheet v-model="realnameVisible" @verified="handleRealnameVerified" />
  </view>
</template>

<style>
.page { position: relative; height: 100vh; overflow: hidden; background: #f5f6f8; color: #172033; font-family: 'PingFang SC', '苹方-简', sans-serif; }
.nav { position: fixed; right: 0; left: 0; z-index: 20; display: flex; align-items: center; padding: 0 32rpx; box-sizing: border-box; background: #f5f6f8; }
.back-button { width: 34rpx; height: 34rpx; flex-shrink: 0; }
.nav-title { position: absolute; left: 50%; color: #111; font-size: 32rpx; font-weight: 600; transform: translateX(-50%); }
.nav-spacer { width: 34rpx; height: 34rpx; }
.page-scroll { position: absolute; inset: 0; width: 100%; height: 100%; box-sizing: border-box; }
.page-content { padding: 0 30rpx 56rpx; box-sizing: border-box; }
.hero-card { position: relative; overflow: hidden; margin-top: 20rpx; padding: 36rpx 30rpx 32rpx; border-radius: 28rpx; background: #ff6427; box-shadow: 0 14rpx 28rpx rgba(255, 90, 31, .22); color: #fff; }
.hero-card-bg { position: absolute; inset: 0; z-index: 0; width: 100%; height: 100%; }
.hero-label { position: relative; z-index: 1; display: block; font-size: 24rpx; opacity: .92; }
.hero-value { position: relative; z-index: 1; display: block; margin-top: 10rpx; font-size: 64rpx; font-weight: 700; line-height: 1.1; }
.hero-subtitle { position: relative; z-index: 1; display: block; margin-top: 10rpx; color: rgba(255, 255, 255, .88); font-size: 22rpx; }
.tab-row { display: flex; gap: 18rpx; margin-top: 22rpx; }
.tab-item { flex: 1; height: 76rpx; display: flex; align-items: center; justify-content: center; border-radius: 22rpx; background: #fff; color: #667085; font-size: 26rpx; font-weight: 600; box-shadow: 0 6rpx 16rpx rgba(15, 23, 42, .06); }
.tab-item.active { background: linear-gradient(135deg, #ff6a2b, #ff5a1f); color: #fff; }
.panel-card { margin-top: 20rpx; padding: 28rpx; border-radius: 24rpx; background: #fff; box-shadow: 0 10rpx 24rpx rgba(15, 23, 42, .06); }
.panel-title { display: block; color: #111827; font-size: 28rpx; font-weight: 600; }
.panel-section-title { margin-top: 22rpx; }
.type-row { display: flex; gap: 16rpx; margin-top: 20rpx; }
.type-chip { flex: 1; height: 72rpx; display: flex; align-items: center; justify-content: center; border-radius: 18rpx; background: #f3f4f6; color: #475467; font-size: 24rpx; font-weight: 600; }
.type-chip.active { background: rgba(255, 106, 43, .12); color: #ff5a1f; border: 2rpx solid rgba(255, 106, 43, .35); }
.search-row { display: flex; gap: 16rpx; margin-top: 18rpx; }
.panel-input { height: 84rpx; padding: 0 22rpx; box-sizing: border-box; border-radius: 18rpx; background: #f8fafc; color: #111827; font-size: 26rpx; }
.fee-hint { display: block; margin-top: 14rpx; color: #b45309; font-size: 22rpx; line-height: 1.5; }
.fee-calc { display: block; margin-top: 8rpx; color: #ff5a1f; font-size: 24rpx; font-weight: 600; line-height: 1.5; }
.search-input { flex: 1; }
.search-button { flex-shrink: 0; width: 140rpx; height: 84rpx; border-radius: 18rpx; background: linear-gradient(135deg, #ff6a2b, #ff5a1f); color: #fff; font-size: 26rpx; font-weight: 600; }
.search-button::after, .panel-button::after, .notice-button::after { border: 0; }
.recipient-card { display: flex; align-items: center; gap: 16rpx; margin-top: 18rpx; padding: 18rpx; border-radius: 18rpx; background: #f8fafc; }
.recipient-avatar { width: 72rpx; height: 72rpx; border-radius: 50%; background: #d9dee7; }
.recipient-avatar.placeholder { background: linear-gradient(135deg, #d9dee7, #eef2f7); }
.recipient-info { display: flex; flex-direction: column; min-width: 0; }
.recipient-name { color: #111827; font-size: 26rpx; font-weight: 600; }
.recipient-id { margin-top: 6rpx; color: #667085; font-size: 22rpx; }
.panel-button { height: 84rpx; margin-top: 24rpx; border-radius: 18rpx; background: linear-gradient(135deg, #ff6a2b, #ff5a1f); color: #fff; font-size: 28rpx; font-weight: 600; }
.panel-button.ghost { margin-top: 16rpx; background: #fff; border: 2rpx solid rgba(255, 90, 31, .28); color: #ff5a1f; }
.notice-body { display: block; margin-top: 18rpx; color: #475467; font-size: 26rpx; line-height: 42rpx; }
.mask { position: fixed; inset: 0; z-index: 30; display: flex; align-items: center; justify-content: center; padding: 40rpx; box-sizing: border-box; background: rgba(0, 0, 0, .56); }
.notice-card { width: 100%; padding: 28rpx 28rpx 30rpx; border-radius: 28rpx; background: #fff; box-sizing: border-box; }
.notice-head { position: relative; display: flex; align-items: center; justify-content: center; min-height: 52rpx; }
.notice-title { color: #111827; font-size: 32rpx; font-weight: 700; }
.notice-close { position: absolute; right: 0; color: #98a2b3; font-size: 42rpx; line-height: 1; }
.notice-button { height: 84rpx; margin-top: 26rpx; border-radius: 18rpx; background: linear-gradient(135deg, #ff6a2b, #ff5a1f); color: #fff; font-size: 28rpx; font-weight: 600; }
.auth-banner { display: flex; flex-direction: column; gap: 8rpx; margin-top: 22rpx; padding: 22rpx; border-radius: 18rpx; background: #fff7ed; border: 2rpx solid rgba(255, 106, 43, .25); }
.auth-text { color: #9a3412; font-size: 24rpx; line-height: 36rpx; }
.records-card { margin-top: 20rpx; padding: 28rpx; border-radius: 24rpx; background: #fff; box-shadow: 0 10rpx 24rpx rgba(15, 23, 42, .06); }
.records-title { display: block; color: #111827; font-size: 28rpx; font-weight: 600; }
.records-list { margin-top: 8rpx; }
.record-item { padding: 22rpx 0; border-bottom: 2rpx solid #f1f3f6; }
.record-item:last-child { border-bottom: 0; }
.record-top { display: flex; align-items: center; justify-content: space-between; }
.record-type { color: #475467; font-size: 24rpx; font-weight: 600; }
.record-status { font-size: 22rpx; font-weight: 600; }
.record-status.pending { color: #d97706; }
.record-status.approved { color: #2563eb; }
.record-status.success { color: #16a34a; }
.record-status.failed { color: #dc2626; }
.record-status.rejected { color: #9ca3af; }
.record-status.stuck { color: #dc2626; }
.record-mid { display: flex; align-items: baseline; justify-content: space-between; margin-top: 8rpx; }
.record-amount { color: #111827; font-size: 30rpx; font-weight: 700; }
.record-time { color: #98a2b3; font-size: 22rpx; }
.record-reason { display: block; margin-top: 8rpx; color: #dc2626; font-size: 22rpx; line-height: 1.5; }
.records-empty { padding: 30rpx 0; text-align: center; color: #98a2b3; font-size: 24rpx; }
.records-more { margin-top: 18rpx; padding: 16rpx 0; text-align: center; color: #ff5a1f; font-size: 24rpx; font-weight: 600; }
</style>
