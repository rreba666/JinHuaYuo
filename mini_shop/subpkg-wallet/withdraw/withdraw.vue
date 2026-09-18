<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { onShow, onUnload } from '@dcloudio/uni-app'
import { getRealnameStatus, type RealnameStatus } from '@/api/realname'
import { applyTransferAuth, getTransferAuthStatus, type TransferAuthState } from '@/api/transfer-auth'
import { getUserProfile, getWalletInfo, getWithdrawRules, searchUser, transferWallet, withdrawWallet, getWithdrawals, type UserProfile, type UserSearchVO, type WalletInfo, type WithdrawMethod, type WithdrawRecord, type WithdrawRules, type WithdrawType } from '@/api/user'
import RealnameVerifySheet from '@/components/RealnameVerifySheet.vue'
import { clearAuth, getAuth, hasWalletNoticeSeen, isLoggedIn, isRegisteredUser, markWalletNoticeSeen } from '@/utils/auth'
import { isApiRequestError } from '@/utils/request'
import { resolveAvatar } from '@/utils/avatar'
import { MERCHANT_TRANSFER_APP_ID, MERCHANT_TRANSFER_MCH_ID, TRANSFER_MIN_AMOUNT, WITHDRAW_MIN_AMOUNT } from '@/utils/wallet-config'
import { validateAmount, validatePositiveInteger } from '@/utils/input-validation'
import LoginGuide from '@/components/LoginGuide.vue'
import { useModuleGuard } from '@/utils/config'

/** wallet 模块守卫：停用则拦截提现/转账（深链防护）。 */
const { moduleEnabled: walletEnabled, loadModuleConfig: loadWalletModule } = useModuleGuard('wallet')

const menuTop = ref(0)
const menuHeight = ref(32)
const user = ref<UserProfile | null>(null)
const wallet = ref<WalletInfo | null>(null)
const loading = ref(false)
const currentTab = ref<'withdraw' | 'transfer'>('withdraw')
/** 提现方式入口，默认保留原有零钱提现流程，银行卡作为新增选项。 */
const withdrawOption = ref<'BALANCE' | 'BANK_CARD'>('BALANCE')
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
/** 当前提现申请的幂等键和请求指纹，网络重试时必须复用。 */
const pendingWithdrawIdempotencyKey = ref<string | null>(null)
const pendingWithdrawFingerprint = ref<string | null>(null)
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
const loginGuideVisible = ref(false)
const registeredUser = computed(() => isRegisteredUser(user.value?.identity))

const navStyle = computed(() => ({ top: `${menuTop.value}px`, height: `${menuHeight.value}px` }))
const bodyStyle = computed(() => ({ paddingTop: `${menuTop.value + menuHeight.value + uni.upx2px(100)}px` }))
const availableBalance = computed(() => Number(wallet.value?.balance ?? 0))
/**
 * 提现规则本地兜底值：后台 `GET /api/wallet/withdraw-rules` 未返回或请求失败时使用（页面不留空白）。
 */
const DEFAULT_WITHDRAW_FEE_RATE = 0.05
const DEFAULT_WITHDRAW_LOCK_DAYS = 10
/**
 * 单笔提现上限（元）：**商户后台（微信商户 / 支付渠道）侧的限额**，后端 `WithdrawRuleVO` 暂无对应字段，
 * 因此这里保持写死；后续若后端接入商户侧限额再改为配置驱动
 * （见 `docs/logs/2026-09-16-提现规则改为后台配置驱动.md`）。
 */
const WITHDRAW_SINGLE_LIMIT = 200
/** 到账时间后端未下发，保留固定文案。 */
const WITHDRAW_ARRIVAL_TEXT = '审核通过后 1-3 个工作日'
/** 后台下发的提现规则（最低额 / 费率 / 每日金额与次数上限 / 支付后锁定期；后端还会返回活跃笔数与冻结上限，页面暂不展示）。 */
const withdrawRules = ref<WithdrawRules | null>(null)
/** 最低提现金额：以后台配置为准，缺省回退本地默认。 */
const withdrawMinAmount = computed(() => {
  const value = Number(withdrawRules.value?.minAmount)
  return Number.isFinite(value) && value > 0 ? value : Number(WITHDRAW_MIN_AMOUNT)
})
/** 最低提现额度文案：整数不补小数（1 元而非 1.00 元），配合模板里的「元」使用。 */
const withdrawMinimumLabel = computed(() => (Number.isInteger(withdrawMinAmount.value) ? String(withdrawMinAmount.value) : formatMoney(withdrawMinAmount.value)))
/** 每日累计提现金额上限（元）；0/未配置 = 不限制（不展示该限制）。 */
const withdrawDailyAmountLimit = computed(() => {
  const value = Number(withdrawRules.value?.dailyAmountLimit)
  return Number.isFinite(value) && value > 0 ? value : 0
})
/** 每日提现次数上限；0/未配置 = 不限制。 */
const withdrawDailyCountLimit = computed(() => {
  const value = Number(withdrawRules.value?.dailyCountLimit)
  return Number.isFinite(value) && value > 0 ? value : 0
})
/** 手续费率（0~1 小数），以后台配置为准。 */
const withdrawFeeRate = computed(() => {
  const value = Number(withdrawRules.value?.feeRate)
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_WITHDRAW_FEE_RATE
})
/** 手续费率百分比文案（0.05 → 5%）。 */
const withdrawFeePercentLabel = computed(() => formatFeeRateLabel(withdrawFeeRate.value))
/** 支付后锁定期天数（支付时刻起 N×24 小时内不可提现）。 */
const withdrawLockDays = computed(() => {
  const value = Number(withdrawRules.value?.payLockDays)
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_WITHDRAW_LOCK_DAYS
})
/** 下次可提现时刻（空 = 当前不在锁定期，可立即提现）——后端已按精确 240 小时口径算好。 */
const withdrawNextWithdrawableAt = computed(() => {
  const value = withdrawRules.value?.nextWithdrawableAt
  return typeof value === 'string' && value.trim() ? value.trim() : ''
})
/** 锁定期提示：命中锁定时直接告诉用户具体可提现时间，避免"撞错"后才知道。 */
const withdrawLockHint = computed(() => (withdrawNextWithdrawableAt.value ? `最近有订单支付，暂时无法提现；${withdrawNextWithdrawableAt.value} 后可提现` : ''))
/** 是否超过单笔上限（商户后台限额，前端仅作提示，最终以后端校验为准）。 */
const overSingleLimit = computed(() => withdrawAmountNumber.value > WITHDRAW_SINGLE_LIMIT)
/** 单次输入是否超过单日累计上限（后台配置，前端仅作提示，最终以后端校验为准）。 */
const overDailyAmountLimit = computed(() => withdrawDailyAmountLimit.value > 0 && withdrawAmountNumber.value > withdrawDailyAmountLimit.value)
/** 用户输入的提现金额（非法输入按 0 处理）。 */
const withdrawAmountNumber = computed(() => {
  const value = Number(withdrawAmount.value)
  return Number.isFinite(value) ? value : 0
})
/** 提现手续费：按后台配置费率计算。 */
const withdrawFee = computed(() => (withdrawAmountNumber.value > 0 ? withdrawAmountNumber.value * withdrawFeeRate.value : 0))
/** 扣除手续费后的实际到账金额。 */
const withdrawActual = computed(() => (withdrawAmountNumber.value > 0 ? withdrawAmountNumber.value * (1 - withdrawFeeRate.value) : 0))
/** 是否需要引导完成免确认收款授权。 */
const needAuth = computed(() => transferAuthState.value !== 'TAKING_EFFECT')

function formatMoney(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00'
}

/** 手续费率百分比文案：0.05 → 5%，0.006 → 0.6%（避免浮点误差显示成 5.000000000000001%）。 */
function formatFeeRateLabel(rate: number): string {
  const percent = Math.round(rate * 10000) / 100
  return `${Number.isInteger(percent) ? percent : String(percent)}%`
}

/** 加载后台提现规则；失败时保留本地默认值，不打断提现流程。 */
async function loadWithdrawRules(): Promise<void> {
  try {
    withdrawRules.value = await getWithdrawRules()
  } catch {
    withdrawRules.value = null
  }
}

function createWithdrawIdempotencyKey(): string {
  const cryptoApi = (globalThis as typeof globalThis & { crypto?: { randomUUID?: () => string } }).crypto
  const uuid = cryptoApi?.randomUUID?.()
  const fallback = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`
  return `wd-${uuid || fallback}`.slice(0, 64)
}

/** 同一金额、来源和收款方式复用 key；任一项变化都开启新的提现申请。 */
function getWithdrawIdempotencyKey(amount: number, type: WithdrawType, withdrawMethod: WithdrawMethod): string {
  const fingerprint = `${amount.toFixed(2)}|${type}|${withdrawMethod}`
  if (pendingWithdrawFingerprint.value === fingerprint && pendingWithdrawIdempotencyKey.value) {
    return pendingWithdrawIdempotencyKey.value
  }
  const idempotencyKey = createWithdrawIdempotencyKey()
  pendingWithdrawFingerprint.value = fingerprint
  pendingWithdrawIdempotencyKey.value = idempotencyKey
  return idempotencyKey
}

function clearWithdrawRequestContext(): void {
  pendingWithdrawFingerprint.value = null
  pendingWithdrawIdempotencyKey.value = null
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
  if (!isLoggedIn()) {
    loginGuideVisible.value = true
    return false
  }
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

/** 页面进入时读取实名状态，决定提现按钮是“实名绑定”还是“确认提现”。 */
async function loadRealnameStatus(): Promise<void> {
  try {
    const status = await getRealnameStatus()
    realnameVerified.value = status.verified
  } catch {
    // 查询失败时按未实名处理，避免错误放行提现。
    realnameVerified.value = false
  }
}

/** 初始化或刷新钱包页，确保身份升级后重新进入即可使用提现功能。 */
async function loadPage(): Promise<void> {
  if (!(await ensureRegisteredAccess())) return
  await Promise.all([loadWallet(), loadWithdrawRules(), loadTransferAuthStatus(), loadWithdrawRecords(true), loadRealnameStatus()])
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
      if (/微信号不一致|授权微信号不一致|openid/i.test(detail)) {
        clearAuth()
        uni.showModal({
          title: '微信号不一致',
          content: '当前微信号与授权账号不一致，请重新登录后再试。',
          showCancel: false,
          confirmText: '重新登录',
          success: () => uni.reLaunch({ url: '/pages/login/login' }),
        })
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

/** 切换提现方式，零钱和银行卡分别走各自的后端收款流程。 */
function selectWithdrawOption(option: 'BALANCE' | 'BANK_CARD'): void {
  if (withdrawSubmitting.value || withdrawOption.value === option) return
  clearWithdrawRequestContext()
  pendingWithdrawAmount.value = null
  withdrawOption.value = option
}

async function executeWithdraw(amount: number): Promise<void> {
  if (withdrawSubmitting.value) return
  const withdrawMethod: WithdrawMethod = withdrawOption.value === 'BANK_CARD' ? 'BANK_CARD' : 'WECHAT_BALANCE'
  const idempotencyKey = getWithdrawIdempotencyKey(amount, 'BALANCE', withdrawMethod)
  withdrawSubmitting.value = true
  try {
    await withdrawWallet(amount, 'BALANCE', withdrawMethod, idempotencyKey)
    withdrawAmount.value = ''
    pendingWithdrawAmount.value = null
    pendingAction.value = null
    clearWithdrawRequestContext()
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
    } else if (withdrawOption.value === 'BALANCE' && isApiRequestError(error) && error.code === 7007) {
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
  if (withdrawSubmitting.value) return
  const amountResult = validateAmount(withdrawAmount.value, {
    label: '提现金额',
    min: withdrawMinAmount.value,
    max: availableBalance.value,
  })
  if (!amountResult.ok) {
    uni.showToast({ title: amountResult.message, icon: 'none' })
    return
  }
  const amount = amountResult.value

  const withdrawMethod: WithdrawMethod = withdrawOption.value === 'BANK_CARD' ? 'BANK_CARD' : 'WECHAT_BALANCE'
  getWithdrawIdempotencyKey(amount, 'BALANCE', withdrawMethod)
  pendingWithdrawAmount.value = amount
  if (!(await ensureRealnameReady('withdraw'))) return
  await executeWithdraw(amount)
}

async function handleSearchRecipient(): Promise<void> {
  if (searching.value) return
  const userIdResult = validatePositiveInteger(transferUserId.value, '用户ID')
  if (!userIdResult.ok) {
    uni.showToast({ title: userIdResult.message, icon: 'none' })
    return
  }
  const userId = userIdResult.value
  transferUserId.value = String(userId)

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
  if (!recipient.value) {
    uni.showToast({ title: '请先查找接收人', icon: 'none' })
    return
  }
  const amountResult = validateAmount(transferAmount.value, {
    label: '转账金额',
    min: TRANSFER_MIN_AMOUNT,
    max: availableBalance.value,
  })
  if (!amountResult.ok) {
    uni.showToast({ title: amountResult.message, icon: 'none' })
    return
  }
  const amount = amountResult.value
  if (getAuth()?.userId != null && recipient.value.id === getAuth()?.userId) {
    uni.showToast({ title: '不能转给自己', icon: 'none' })
    return
  }

  const payload = { toUserId: recipient.value.id, amount }
  pendingTransfer.value = payload
  if (!(await ensureRealnameReady('transfer'))) return
  await executeTransfer(payload)
}

async function handleRealnameVerified(status: RealnameStatus): Promise<void> {
  realnameVerified.value = status.verified
  if (!status.verified) {
    uni.showToast({ title: '实名认证未完成，请核对信息后重试', icon: 'none' })
    return
  }
  realnameVisible.value = false

  const action = pendingAction.value
  pendingAction.value = null

  if (action === 'withdraw' && pendingWithdrawAmount.value != null) {
    pendingWithdrawAmount.value = null
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

watch(withdrawAmount, (next, previous) => {
  if (withdrawSubmitting.value) return
  if (next !== previous && pendingWithdrawIdempotencyKey.value) {
    clearWithdrawRequestContext()
    pendingWithdrawAmount.value = null
  }
})

onMounted(() => {
  try {
    const rect = uni.getMenuButtonBoundingClientRect()
    if (rect) {
      menuTop.value = rect.top
      menuHeight.value = rect.height
    }
  } catch { /* 非微信环境没有胶囊按钮 */ }
  void loadWalletModule()
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

    <!-- wallet 模块停用：拦截提现/转账（深链防护） -->
    <view v-if="!walletEnabled" class="module-blocked">
      <text class="module-blocked-title">钱包功能未开通</text>
      <text class="module-blocked-desc">当前商户未开通钱包模块，提现与转账暂不可用。</text>
    </view>

    <scroll-view v-if="registeredUser && walletEnabled" class="page-scroll" scroll-y :style="bodyStyle">
      <view class="page-content">
        <view class="hero-card">
          <image class="hero-card-bg" src="/static/bg/钱包页背景.png" mode="aspectFill" />
          <text class="hero-label">可转账余额</text>
          <text class="hero-value">{{ formatMoney(availableBalance) }}</text>
          <text class="hero-subtitle">1:1 提现</text>
        </view>

        <view class="tab-row">
          <view class="tab-item" :class="{ active: currentTab === 'withdraw' }" @click="currentTab = 'withdraw'">提现</view>
        </view>

        <view v-show="currentTab === 'withdraw'" class="panel-card">
          <text class="panel-title">提现方式</text>
          <view class="type-row">
            <view class="type-chip" :class="{ active: withdrawOption === 'BALANCE' }" @click="selectWithdrawOption('BALANCE')">零钱提现</view>
            <view class="type-chip" :class="{ active: withdrawOption === 'BANK_CARD' }" @click="selectWithdrawOption('BANK_CARD')">银行卡提现</view>
          </view>
          <text class="panel-title panel-section-title">提现金额</text>
          <input v-model="withdrawAmount" class="panel-input" maxlength="11" type="digit" :disabled="withdrawSubmitting" :placeholder="`请输入提现余额，最低 ${withdrawMinimumLabel} 元`" />
          <text v-if="withdrawOption === 'BANK_CARD'" class="fee-hint">银行卡信息取自实名认证资料，平台审核通过后人工打款；提现将收取 {{ withdrawFeePercentLabel }} 手续费。</text>
          <text v-else class="fee-hint">提现将收取 {{ withdrawFeePercentLabel }} 手续费，提交后进入审核。</text>
          <text v-if="!realnameVerified" class="fee-hint">首次提现需完成实名认证（仅一次），认证后余额满 {{ withdrawMinimumLabel }} 元即可提现，无其他门槛。</text>
          <text v-if="withdrawAmountNumber > 0" class="fee-calc">手续费 ¥{{ formatMoney(withdrawFee) }}，实际到账 ¥{{ formatMoney(withdrawActual) }}</text>
          <text v-if="overSingleLimit" class="fee-calc fee-warning">单笔最高可提现 {{ WITHDRAW_SINGLE_LIMIT }} 元，请调整提现金额</text>
          <text v-if="overDailyAmountLimit" class="fee-calc fee-warning">单日累计提现上限 {{ withdrawDailyAmountLimit }} 元，请调整提现金额</text>
          <text v-if="withdrawLockHint" class="fee-calc fee-warning">{{ withdrawLockHint }}</text>

          <!-- 提现规则：金额/次数/锁定期全部取自后台配置（GET /api/wallet/withdraw-rules），接口失败时用本地默认值兜底 -->
          <view class="rule-card">
            <text class="rule-title">提现规则</text>
            <view class="rule-item"><text class="rule-label">提现门槛</text><text class="rule-text">账户余额满 {{ withdrawMinimumLabel }} 元即可提现，无需邀请好友、无需消费</text></view>
            <view class="rule-item"><text class="rule-label">可提现额度</text><text class="rule-text">最低提现 {{ withdrawMinimumLabel }} 元，单笔最高 {{ WITHDRAW_SINGLE_LIMIT }} 元{{ withdrawDailyAmountLimit > 0 ? '，单日累计上限 ' + withdrawDailyAmountLimit + ' 元' : '' }}</text></view>
            <view class="rule-item"><text class="rule-label">每日提现次数</text><text class="rule-text">{{ withdrawDailyCountLimit > 0 ? '每日最多可提现 ' + withdrawDailyCountLimit + ' 次' : '每日提现次数不限' }}</text></view>
            <view class="rule-item"><text class="rule-label">提现时间</text><text class="rule-text">全天可提现（00:00–24:00），提交后进入平台审核</text></view>
            <!-- 提现锁口径：天数为后台配置（精确 N×24 小时，自支付时刻起算），不写实现细节 -->
            <view class="rule-item"><text class="rule-label">可提现时间</text><text class="rule-text">收益有 {{ withdrawLockDays }} 天锁定期（自订单支付时刻起算），需满 {{ withdrawLockDays }} 天才可提现</text></view>
            <view class="rule-item"><text class="rule-label">到账时间</text><text class="rule-text">{{ WITHDRAW_ARRIVAL_TEXT }}到账（银行卡提现为审核通过后人工打款）</text></view>
            <view class="rule-item"><text class="rule-label">实名认证</text><text class="rule-text">依据法律法规要求，首次提现前需完成实名认证（仅需一次），认证后即可正常提现</text></view>
            <view class="rule-item"><text class="rule-label">收款授权</text><text class="rule-text">零钱提现首次需在微信中确认一次收款授权，授权后后续提现无需重复操作</text></view>
            <view class="rule-item"><text class="rule-label">手续费</text><text class="rule-text">按提现金额的 {{ withdrawFeePercentLabel }} 收取，实际到账 = 提现金额 − 手续费</text></view>
          </view>
          <template v-if="withdrawOption === 'BANK_CARD'">
            <button class="panel-button" :disabled="withdrawSubmitting || realnameChecking" @click="handleWithdraw">
              {{ withdrawSubmitting ? '提交中...' : (realnameVerified ? '确认提现' : '实名绑定') }}
            </button>
          </template>
          <template v-else>
            <!-- 未完成免确认收款授权时引导授权，仅零钱提现需要此流程 -->
            <button v-if="!realnameVerified" class="panel-button" :disabled="withdrawSubmitting || realnameChecking" @click="handleWithdraw">
              {{ realnameChecking ? '查询中...' : '实名绑定' }}
            </button>
            <view v-else-if="authStatusError" class="auth-banner">
              <text class="auth-text">授权状态获取失败，请重试</text>
              <button class="panel-button" :disabled="authLoading" @click="refreshTransferAuth">
                {{ authLoading ? '刷新中...' : '刷新授权状态' }}
              </button>
            </view>
            <view v-else-if="needAuth" class="auth-banner">
              <text class="auth-text">{{ transferAuthState === 'WAIT_USER_CONFIRM' ? '授权未完成，请再次确认授权' : '首次零钱提现前需完成免确认收款授权，提交后由平台审核打款' }}</text>
              <button class="panel-button" :disabled="authApplying || authLoading" @click="handleAuthorize">
                {{ authApplying ? '授权中...' : (transferAuthState === 'WAIT_USER_CONFIRM' ? '重新授权' : '去授权') }}
              </button>
            </view>
            <button v-else class="panel-button" :disabled="withdrawSubmitting" @click="handleWithdraw">
              {{ withdrawSubmitting ? '提交中...' : '确认提现' }}
            </button>
          </template>
        </view>

        <view v-if="false" class="panel-card">
          <text class="panel-title">转账账号</text>
          <view class="search-row">
            <input v-model="transferUserId" class="panel-input search-input" maxlength="19" type="number" placeholder="请输入接收人账号或ID" />
            <button class="search-button" :disabled="searching" @click="handleSearchRecipient">
              {{ searching ? '查找中...' : '查找' }}
            </button>
          </view>
          <view v-if="recipient" class="recipient-card">
            <image class="recipient-avatar" :src="resolveAvatar(recipient.avatarUrl)" mode="aspectFill" />
            <view class="recipient-info">
              <text class="recipient-name">{{ recipient.nickname }}</text>
              <text class="recipient-id">ID: {{ recipient.id }}</text>
            </view>
          </view>
          <text class="panel-title panel-section-title">转出金额</text>
          <input v-model="transferAmount" class="panel-input" maxlength="11" type="digit" placeholder="请输入转出余额" />
          <button class="panel-button" :disabled="transferSubmitting" @click="handleTransfer">
            {{ transferSubmitting ? '提交中...' : '确认转账' }}
          </button>
        </view>

        <view class="records-card">
          <text class="records-title">提现记录</text>
          <view v-if="withdrawRecords.length" class="records-list">
            <view v-for="record in withdrawRecords" :key="record.withdrawNo" class="record-item">
              <view class="record-top">
                <text class="record-type">{{ record.withdrawMethod === 'BANK_CARD' ? '银行卡提现' : record.typeDesc }}</text>
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

    <view v-if="!registeredUser && !loginGuideVisible" class="access-empty">
      <text class="access-empty-title">登录后即可体验完整功能</text>
      <text class="access-empty-text">登录后即可使用余额转账和提现</text>
    </view>

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

    <RealnameVerifySheet
      v-model="realnameVisible"
      :required-bank-info="withdrawOption === 'BANK_CARD'"
      @verified="handleRealnameVerified"
    />
    <LoginGuide v-model="loginGuideVisible" />
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
.access-empty { position: absolute; top: 50%; right: 0; left: 0; display: flex; align-items: center; flex-direction: column; transform: translateY(-50%); }
.access-empty-title { color: #172033; font-size: 30rpx; font-weight: 700; }
.access-empty-text { margin-top: 16rpx; color: #98a2b3; font-size: 24rpx; }
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
.fee-warning { color: #d40000; }
/* 提现规则（微信审核要求：清晰展示额度 / 次数 / 提现与到账时间） */
.rule-card { margin-top: 20rpx; padding: 20rpx 24rpx; border-radius: 12rpx; background: #f7f8fa; }
.rule-title { display: block; margin-bottom: 14rpx; color: #1f2329; font-size: 26rpx; font-weight: 600; }
.rule-item { display: flex; margin-bottom: 10rpx; }
.rule-item:last-child { margin-bottom: 0; }
.rule-label { flex-shrink: 0; width: 168rpx; color: #86909c; font-size: 24rpx; line-height: 36rpx; }
.rule-text { flex: 1; color: #4e5969; font-size: 24rpx; line-height: 36rpx; }
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

/* 模块停用拦截提示 */
.module-blocked { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; padding: 40rpx; text-align: center; }
.module-blocked-title { color: #1f2937; font-size: 32rpx; font-weight: 600; }
.module-blocked-desc { margin-top: 16rpx; color: #98a2b3; font-size: 26rpx; line-height: 1.6; }
</style>
