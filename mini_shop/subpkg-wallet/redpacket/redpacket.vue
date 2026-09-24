<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { convertWallet, getDividendRecords, getSpecialSubsidies, getWalletInfo, getUserProfile, getWithdrawRules, type DividendRecord, type SpecialSubsidyRecord, type UserProfile, type WalletInfo, type WithdrawRules } from '@/api/user'
import { isLoggedIn, isRegisteredUser } from '@/utils/auth'
import { ApiRequestError } from '@/utils/request'
import { normalizeLegacyWording } from '@/utils/wording'
import { useConvertRealnameGate } from '@/utils/realname-gate'
import RequestState from '@/components/RequestState.vue'
import LoginGuide from '@/components/LoginGuide.vue'
import RealnameVerifySheet from '@/components/RealnameVerifySheet.vue'
import { useModuleGuard } from '@/utils/config'
// 提现额度口径（可转余额 / 锁定中）：与提现页、推广金页共用同一套实现
import { buildLockedRemainderHint, buildQuotaHint, pickWithdrawQuota, quotaWithdrawable } from '@/utils/withdraw-quota'

/** promotion 模块守卫：停用则拦截平台红包（深链防护）。 */
const { moduleEnabled: promotionEnabled, loadModuleConfig: loadPromotionModule } = useModuleGuard('promotion')

const menuTop = ref(0)
const menuHeight = ref(32)
const wallet = ref<WalletInfo | null>(null)
const records = ref<DividendRecord[]>([])
/**
 * 特殊补贴台账（复购专区商品给买家的一次性补贴，**含未到账**）。
 *
 * ⚠️ 为什么必须单独拉、单独展示：`records`（红包来源）走 `/wallet/dividend-records`，
 * 它**只返回已到账流水**。用户下单后补贴还在 7 天窗口内（`status = PENDING`）时，
 * 那条记录在红包来源里**根本不存在**，用户就会以为"补贴没发"（2026-09-24 线上反馈：
 * 「下单了补贴没显示，即使冻结也要显示」）。`/wallet/special-subsidy` 才会返回待到账记录。
 */
const subsidies = ref<SpecialSubsidyRecord[]>([])
/** 是否为「未到账」（待到账 / 发放中）。 */
function isSubsidyPending(status: string): boolean { return status === 'PENDING' || status === 'CLAIMING' }
/** 补贴状态文案：优先用后端下发的中文名，缺失时按状态码兜底。 */
function subsidyStatusText(item: SpecialSubsidyRecord): string {
  if (item.statusDesc) return item.statusDesc
  return ({ PENDING: '待到账', CLAIMING: '发放中', GRANTED: '已到账', VOIDED: '已作废' } as Record<string, string>)[item.status] || '—'
}
/** 比例文案：0.05 → 5%（先取整再拼，避免 5.000000000000001% 这种浮点尾巴）。 */
function subsidyRateText(rate: number): string {
  const percent = Math.round(Number(rate) * 10000) / 100
  return `${Number.isInteger(percent) ? percent : String(percent)}%`
}
/** 行内时间文案（不换行，用于「预计到账」这类说明）。 */
function formatDateTime(value?: string | null): string {
  return value ? String(value).replace('T', ' ').slice(0, 16) : '--'
}

/**
 * 红包来源标签文案。
 *
 * ⚠️ 2026-09-23：后端新增 `sourceType` 打标（`DIVIDEND` / `SPECIAL_SUBSIDY`）。
 * 文档说 `sourceTypeDesc` 可直接展示，但本项目展示口径是**前端映射**：
 * 特殊商品补贴对外叫「**商品补贴**」（后端下发的是"特殊补贴"），
 * 常规那类对外叫「**平台红包**」。所以这里按 `sourceType` 映射，
 * `sourceTypeDesc` 只在没有 `sourceType` 时兜底（后端 `non_null` ⇒ 老数据可能整个 key 缺失）。
 *
 * ⚠️ 两条红线（2026-09-24 线上截图事故后补，别再犯）：
 * 1. **本函数返回的字面量不得含旧术语**。之前这里硬编码了「旧词+红包」四个字 ——
 *    前端自己写的字串不经过任何归一化就上屏了，这是那次事故的直接原因。
 * 2. **兜底值必须过 `normalizeLegacyWording()`**：后端 `sourceTypeDesc` 的示例值本身就含旧词。
 */
function sourceTagText(record: DividendRecord): string {
  if (record.sourceType === 'SPECIAL_SUBSIDY') return '商品补贴'
  if (record.sourceType === 'DIVIDEND') return '平台红包'
  return normalizeLegacyWording(record.sourceTypeDesc)
}

const recordsPage = ref(1)
const recordsTotal = ref(0)
const loading = ref(false)
const loadError = ref('')
const loadingMore = ref(false)
const converting = ref(false)
const user = ref<UserProfile | null>(null)
const registeredUser = computed(() => isRegisteredUser(user.value?.identity))
const loginGuideVisible = ref(false)

/**
 * 转余额实名门禁（2026-09-19 多账号套现风控）。
 * 红包与推广金共用同一接口 `/api/wallet/convert`，后端已加实名校验：未实名 → `8601`。
 * 这里做**前置拦截**（体验：先查状态、未实名不白发请求）+ **`8601` 兜底**（保证任何路径都不漏）。
 */
const {
  sheetVisible: realnameVisible,
  ensureRealname,
  handleVerified,
  handleConvertDenied,
} = useConvertRealnameGate()
let pageLoadPromise: Promise<void> | null = null

/** 自定义导航栏样式。 */
const navStyle = computed(() => ({ top: `${menuTop.value}px`, height: `${menuHeight.value}px` }))
const bodyTop = computed(() => menuTop.value + menuHeight.value)

/** 待领取红包总额（红包金额，仅积分，不含货币符号）。 */
const bonusAmount = computed(() => {
  const value = Number(wallet.value?.pendingBonus || 0)
  return Number.isFinite(value) && value > 0 ? value : 0
})

/** 提现规则（含各类收益的「可提现 / 锁定中」额度，`byType.BONUS` 即红包口径）。 */
const withdrawRules = ref<WithdrawRules | null>(null)

/**
 * 红包的提现额度（2026-09-24 后端「逐笔解锁」新口径）。
 *
 * ⚠️ `wallet.pendingBonus` 是**待领取总额**，其中可能有一部分仍在**提现锁定期**内
 * （每笔收益自其**来源订单**支付时刻起 10 天）—— 那部分点了「转余额」也转不走。
 * 所以总额照旧展示，但「能转多少 / 还锁着多少」必须另说，否则用户会以为点一下就能全转走。
 */
const bonusQuota = computed(() => pickWithdrawQuota(withdrawRules.value, 'BONUS'))
/** 当前**可转余额**的红包；后端未下发额度（旧后端）时回退总额，保持原行为。 */
const withdrawableBonus = computed(() => (bonusQuota.value ? quotaWithdrawable(bonusQuota.value) : bonusAmount.value))
/** 红包额度提示：「当前可转余额 ¥X；另有 ¥Y 锁定中，Z 后解锁」。 */
const bonusQuotaHint = computed(() => buildQuotaHint(bonusQuota.value, '转余额'))

/** 拉取提现额度（可转 / 锁定中）；失败时置空 ⇒ 页面回退旧口径展示，不打断主流程。 */
async function loadWithdrawRules(): Promise<void> {
  try {
    withdrawRules.value = await getWithdrawRules()
  } catch {
    withdrawRules.value = null
  }
}

/** 将积分格式化为整数（无小数位），避免出现货币感。 */
function formatPoints(value: unknown): string {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '0'
  return amount.toFixed(2).replace(/\.00$/, '').replace(/\.(\d)0$/, '.$1')
}

/** 压缩时间为短格式。 */
function formatTime(value: string | null | undefined): string {
  if (!value) return '--'
  return value.replace(' ', '\n').slice(0, 16)
}

/** 加载钱包与红包流水（逐笔）。 */
async function loadData(): Promise<void> {
  loading.value = true
  loadError.value = ''
  try {
    await ensureUser()
    if (!registeredUser.value) return

    // 提现额度与钱包一起刷新（可转 / 锁定中，见 utils/withdraw-quota.ts）；不阻塞主数据加载
    void loadWithdrawRules()

    let failed = false
    try {
      const info = await getWalletInfo()
      wallet.value = info
    } catch {
      failed = true
    }
    try {
      const result = await getDividendRecords({ page: 1, pageSize: 10 })
      records.value = result.list || []
      recordsPage.value = result.page || 1
      recordsTotal.value = result.total || 0
    } catch {
      failed = true
    }
    // 特殊补贴台账（含待到账）：单独拉，失败**不置 failed** —— 它只是补充展示，
    // 不该因为一个增强接口把整页判成"加载失败"（原有红包数据仍然可用）。
    try {
      subsidies.value = await getSpecialSubsidies()
    } catch {
      subsidies.value = []
    }
    if (failed) loadError.value = '部分红包数据加载失败，请重试'
  } finally {
    loading.value = false
  }
}

/** 复用首次加载请求，避免 onMounted 与 onShow 同时进入时重复拉取。 */
function refreshData(): Promise<void> {
  if (pageLoadPromise) return pageLoadPromise
  const pending = loadData()
  pageLoadPromise = pending
  pending.then(
    () => { if (pageLoadPromise === pending) pageLoadPromise = null },
    () => { if (pageLoadPromise === pending) pageLoadPromise = null },
  )
  return pending
}

/** 上拉加载更多红包流水。 */
async function loadMoreRecords(): Promise<void> {
  if (!registeredUser.value) return
  if (loading.value || loadingMore.value || records.value.length >= recordsTotal.value) return
  loadingMore.value = true
  try {
    const result = await getDividendRecords({ page: recordsPage.value + 1, pageSize: 10 })
    records.value = records.value.concat(result.list || [])
    recordsPage.value = result.page || recordsPage.value + 1
    recordsTotal.value = result.total || recordsTotal.value
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' })
  } finally {
    loadingMore.value = false
  }
}

/** 把红包积分一键转入余额，成功后清空本地红点标记（下次红包重新提示）。 */
async function convertBonus(): Promise<void> {
  if (!registeredUser.value) return
  if (converting.value) return
  // ⚠️ 用「已解锁」金额判断，而不是待领取总额：总额里可能有一部分还在锁定期，点了也转不走
  if (withdrawableBonus.value <= 0) {
    const lockedHint = buildLockedRemainderHint(bonusQuota.value)
    if (lockedHint) {
      uni.showModal({ title: '暂无可转余额', content: `当前可转余额 ¥0.00，${lockedHint}`, showCancel: false, confirmText: '知道了' })
    } else {
      uni.showToast({ title: '暂无可转余额', icon: 'none' })
    }
    return
  }
  // 转余额前实名门禁：未实名则弹实名，认证成功后自动续跑本次转账
  if (!(await ensureRealname(() => { void convertBonus() }))) return
  converting.value = true
  try {
    // 转走的就是「转前已解锁的那部分」（convert 只结转已解锁金额）⇒ 用它作为成功提示的金额
    const transferred = withdrawableBonus.value
    await convertWallet('BONUS')
    // 转余额后待领取红包清零，重置红点已读标记，下次新红包重新亮红点
    uni.setStorageSync('bonus_last_seen', 0)
    await loadData()
    // ⚠️ 必须显式再等一次额度刷新：`loadData()` 内部是 `void loadWithdrawRules()`（不阻塞主数据），
    //    否则下面用到的还是**转前**的旧额度，"还锁着多少"会算错。
    await loadWithdrawRules()
    // 锁定期内那部分仍留在「待领取」⇒ 提示里带上"还锁着多少"，否则用户会以为钱少了
    const lockedHint = buildLockedRemainderHint(bonusQuota.value)
    if (lockedHint) {
      uni.showModal({ title: '转余额成功', content: `已转入 ¥${formatPoints(transferred)}；${lockedHint}`, showCancel: false, confirmText: '知道了' })
    } else {
      uni.showToast({ title: `已转入余额 ¥${formatPoints(transferred)}`, icon: 'success' })
    }
  } catch (error) {
    // 后端兜底：8601 = 未实名（前置查询失败/状态过期时走到这里），引导实名并自动续跑
    if (error instanceof ApiRequestError && error.code === 8601) {
      handleConvertDenied(() => { void convertBonus() })
      return
    }
    // 7006 = 可用金额不足（新口径文案较长，含锁定金额与解锁时刻）⇒ toast 会截断，改用弹窗完整展示
    if (error instanceof ApiRequestError && error.code === 7006) {
      uni.showModal({
        title: '暂时无法转余额',
        content: error.message || '当前可转余额不足',
        showCancel: false,
        confirmText: '知道了',
      })
      return
    }
    uni.showToast({ title: error instanceof Error ? error.message : '转余额失败', icon: 'none' })
  } finally {
    converting.value = false
  }
}

/** 返回上一页。 */
function goBack(): void {
  const pages = getCurrentPages()
  if (pages.length > 1) uni.navigateBack()
  else uni.switchTab({ url: '/pages/mine/mine' })
}

async function ensureUser(): Promise<void> {
  if (!isLoggedIn()) {
    user.value = null
    loginGuideVisible.value = true
    return
  }
  try { user.value = await getUserProfile() } catch { user.value = null }
}

onMounted(() => {
  try {
    const rect = uni.getMenuButtonBoundingClientRect()
    if (rect) { menuTop.value = rect.top; menuHeight.value = rect.height }
  } catch { /* 非微信环境忽略 */ }
  void refreshData()
  void loadPromotionModule()
})

onShow(() => { void refreshData() })
</script>

<template>
  <view class="page">
    <view class="nav" :style="navStyle"><image class="back-button" src="/static/left_arrow.png" mode="aspectFit" @click="goBack" /></view>

    <!-- promotion 模块停用：拦截平台红包（深链防护） -->
    <view v-if="!promotionEnabled" class="module-blocked">
      <text class="module-blocked-title">平台红包未开通</text>
      <text class="module-blocked-desc">当前商户未开通分销推广模块，平台红包暂不可用。</text>
    </view>

    <scroll-view v-if="registeredUser && promotionEnabled" class="page-scroll" scroll-y :style="{ paddingTop: bodyTop + 'px' }" @scrolltolower="loadMoreRecords">
      <view class="page-content">
        <view class="heading">
          <text class="heading-title">平台红包</text>
        </view>

        <view class="packet-card">
          <image class="packet-bg" src="/static/bg/红包页背景.jpg" mode="aspectFill" />
          <text class="packet-amount">{{ formatPoints(bonusAmount) }}</text>
          <view class="convert-btn" :class="{ disabled: converting || withdrawableBonus <= 0 }" @click="convertBonus">转余额</view>
        </view>

        <!-- 可转 / 锁定（2026-09-24 新口径）：待领取总额里有多少能立刻转走、多少还在锁定期 -->
        <text v-if="bonusQuotaHint" class="quota-hint">{{ bonusQuotaHint }}</text>

        <!-- 特殊补贴（复购专区商品给买家的一次性补贴）：**含未到账** —— 用户下单后补贴还在
             7 天窗口内时也要看得见，否则会以为补贴没发（2026-09-24 线上反馈） -->
        <view v-if="subsidies.length" class="subsidy-section">
          <text class="subsidy-title">特殊补贴</text>
          <view v-for="item in subsidies" :key="item.id" class="subsidy-card">
            <view class="subsidy-head">
              <text class="subsidy-amount">¥{{ formatPoints(item.amount) }}</text>
              <text class="subsidy-status" :class="{ pending: isSubsidyPending(item.status) }">{{ subsidyStatusText(item) }}</text>
            </view>
            <text v-if="isSubsidyPending(item.status) && item.maturityAt" class="subsidy-tip">
              {{ formatDateTime(item.maturityAt) }} 自动到账（成交后 7 天进红包）
            </text>
            <text class="subsidy-desc">复购专区商品补贴 = 商品定价 × {{ subsidyRateText(item.rate) }}，每用户终身一次</text>
          </view>
        </view>

        <view class="source-section">
          <text class="source-title">红包来源</text>
          <view class="table-head">
            <text>来源</text>
            <text>时间</text>
            <text>金额</text>
          </view>
          <view class="table-line" />
          <RequestState v-if="!loading && loadError" :error="loadError" @retry="refreshData" />
          <view v-show="loading" class="source-empty"><text>加载中...</text></view>
          <view v-show="!loading && !records.length" class="source-empty"><text>暂无红包记录</text></view>
          <view v-show="!loading && records.length" class="source-list">
            <view v-for="record in records" :key="record.id" class="source-row">
              <text class="source-cell name">{{ record.productName || '--' }}<text v-if="sourceTagText(record)" class="source-tag">{{ sourceTagText(record) }}</text></text>
              <text class="source-cell time">{{ formatTime(record.createTime) }}</text>
              <text class="source-cell amount">{{ formatPoints(record.amount) }}</text>
            </view>
            <view v-show="loadingMore" class="source-more">加载中...</view>
            <view v-show="!loadingMore && records.length >= recordsTotal" class="source-more">已加载全部</view>
          </view>
        </view>
      </view>
    </scroll-view>

    <view v-if="!registeredUser && !loginGuideVisible" class="access-empty">
      <text class="access-empty-title">登录后即可体验完整功能</text>
      <text class="access-empty-text">登录后即可查看平台红包和红包记录</text>
    </view>

    <LoginGuide v-model="loginGuideVisible" />

    <!-- 转余额实名门禁（2026-09-19 多账号套现风控）：未实名时弹出，认证成功后自动续跑转余额 -->
    <RealnameVerifySheet v-model="realnameVisible" @verified="handleVerified" />
  </view>
</template>

<style>
.page { height: 100vh; overflow: hidden; background: #fff; color: #000; font-family: '苹方-简', 'PingFang SC', sans-serif; font-weight: 600; }
.nav { position: fixed; left: 0; right: 0; z-index: 20; display: flex; align-items: center; padding-left: 40rpx; background: #fff; box-sizing: border-box; }
.back-button { width: 40rpx; height: 40rpx; }
.page-scroll { height: 100vh; box-sizing: border-box; }
.page-content { padding: 0 0 100rpx; box-sizing: border-box; }
.access-empty { position: absolute; top: 50%; right: 0; left: 0; display: flex; align-items: center; flex-direction: column; transform: translateY(-50%); }
.access-empty-title { color: #000; font-size: 30rpx; font-weight: 700; }
.access-empty-text { margin-top: 16rpx; color: #959595; font-size: 24rpx; }
.heading { display: flex; align-items: baseline; margin-left: 40rpx; }
.heading-title { color: #000; font-size: 28rpx; }
.packet-card { position: relative; width: 720rpx; max-width: calc(100% - 32rpx); height: 340rpx; margin: 24rpx auto 0; overflow: hidden; }
.packet-bg { position: absolute; inset: 0; width: 100%; height: 100%; }
.packet-amount { position: absolute; left: 0; right: 0; top: 46%; z-index: 1; color: #916448; font-size: 64rpx; font-weight: 700; text-align: center; }
.convert-btn { position: absolute; left: 50%; bottom: 20rpx; z-index: 1; display: flex; align-items: center; justify-content: center; width: 200rpx; height: 72rpx; border-radius: 36rpx; color: #fff; background: rgba(145, 100, 72, 0.9); font-size: 28rpx; transform: translateX(-50%); }
.convert-btn.disabled { opacity: 0.6; }
/* 可转 / 锁定提示（2026-09-24 新口径） */
.quota-hint { display: block; margin: 16rpx 40rpx 0; color: #916448; font-size: 22rpx; line-height: 1.5; }
/* 特殊补贴区（2026-09-24 新增）：与「红包来源」并列，**含待到账记录** */
.subsidy-section { margin-top: 60rpx; }
.subsidy-title { display: block; margin-left: 56rpx; color: #000; font-size: 28rpx; }
.subsidy-card { margin: 20rpx 40rpx 0; padding: 24rpx 26rpx; border-radius: 16rpx; background: #fff8ec; }
.subsidy-head { display: flex; align-items: baseline; justify-content: space-between; }
.subsidy-amount { color: #916448; font-size: 34rpx; font-weight: 700; }
.subsidy-status { color: #916448; font-size: 22rpx; }
.subsidy-status.pending { color: #d48806; }
.subsidy-tip { display: block; margin-top: 8rpx; color: #b4772f; font-size: 22rpx; line-height: 1.5; }
.subsidy-desc { display: block; margin-top: 8rpx; color: #999; font-size: 20rpx; line-height: 1.5; }
.source-section { margin-top: 60rpx; }
.source-title { display: block; margin-left: 56rpx; color: #000; font-size: 28rpx; }
.table-head { display: grid; grid-template-columns: 240rpx 240rpx 150rpx; width: 630rpx; margin: 30rpx 0 0 56rpx; color: #959595; font-size: 22rpx; }
.table-head text:nth-child(n + 2) { text-align: center; }
.table-head text:last-child { text-align: right; }
.table-line { height: 1rpx; margin: 12rpx 40rpx 0; background: #f6f6f6; }
.source-empty { display: flex; align-items: center; justify-content: center; height: 120rpx; color: #959595; font-size: 22rpx; }
.source-list { margin-top: 10rpx; }
.source-row { display: grid; grid-template-columns: 240rpx 240rpx 150rpx; min-height: 90rpx; margin: 0 40rpx; align-items: center; border-bottom: 1rpx solid #f6f6f6; color: #959595; font-size: 20rpx; }
.source-cell { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: pre-line; }
/* 红包来源标签（平台红包 / 商品补贴）：跟在商品名后的小号标记 */
.source-tag { margin-left: 8rpx; padding: 0 8rpx; border: 1rpx solid #e8d5b7; border-radius: 6rpx; color: #916448; font-size: 18rpx; }
.source-cell.time { text-align: center; }
.source-cell.amount { color: #010101; text-align: right; }
.source-more { padding: 20rpx 0; color: #959595; font-size: 20rpx; text-align: center; }

/* 模块停用拦截提示 */
.module-blocked { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; padding: 40rpx; text-align: center; }
.module-blocked-title { color: #1f2937; font-size: 32rpx; font-weight: 600; }
.module-blocked-desc { margin-top: 16rpx; color: #98a2b3; font-size: 26rpx; line-height: 1.6; }
</style>
