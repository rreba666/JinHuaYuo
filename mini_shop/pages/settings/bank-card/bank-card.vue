<script setup lang="ts">
/**
 * 提现银行卡管理（设置页子页面）
 * 列表（脱敏卡号）+ 绑定/解绑/设默认。数据源：/api/user/bank-card/**（后端已接入）。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  createBankCard, deleteBankCard, getBankCardList, setDefaultBankCard, updateBankCard,
  type BankCard, type BankCardPayload,
} from '@/api/bank-card'
import { getBankList, type Bank } from '@/api/bank'
import { isLoggedIn } from '@/utils/auth'
import { createThrottle } from '@/utils/interaction'
import LoginGuide from '@/components/LoginGuide.vue'

const menuTop = ref(0)
const menuHeight = ref(32)
const list = ref<BankCard[]>([])
const loading = ref(false)
const actionLoading = ref(false)
const formVisible = ref(false)
const editingId = ref<string | null>(null)
const loginGuideVisible = ref(false)
const navigationThrottle = createThrottle(500)
const form = reactive<BankCardPayload>({ bankName: '', cardNo: '', holderName: '', phone: '', isDefault: 0 })

/** 银行下拉（bank/list）。 */
const banks = ref<Bank[]>([])
/** 当前选中的银行名（picker 显示用）。 */
const selectedBankIndex = ref(-1)
/** bankName 可手输兜底（下拉找不到时手动输入）。 */
const bankText = computed(() => form.bankName || '选择银行（可手输）')

/** 加载银行字典。 */
async function loadBanks(): Promise<void> {
  try {
    banks.value = await getBankList()
  } catch {
    banks.value = []
  }
}

/** 选中银行下拉项，回填 bankName。 */
function onBankChange(e: { detail: { value: string | number } }): void {
  const idx = Number(e.detail.value)
  const bank = banks.value[idx]
  if (bank) {
    form.bankName = bank.bankName
    selectedBankIndex.value = idx
  }
}

const navStyle = computed(() => ({ top: `${menuTop.value}px`, height: `${menuHeight.value}px` }))
const bodyStyle = computed(() => ({ paddingTop: `${menuTop.value + menuHeight.value + uni.upx2px(20)}px` }))

async function loadList(): Promise<void> {
  if (!isLoggedIn()) { loginGuideVisible.value = true; return }
  loading.value = true
  try {
    const result = await getBankCardList()
    list.value = Array.isArray(result) ? result : []
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '银行卡加载失败', icon: 'none' })
  } finally { loading.value = false }
}

function goBack(): void {
  if (!navigationThrottle()) return
  uni.navigateBack({ delta: 1 })
}

function openCreate(): void {
  editingId.value = null
  Object.assign(form, { bankName: '', cardNo: '', holderName: '', phone: '', isDefault: 0 })
  selectedBankIndex.value = -1
  formVisible.value = true
  void loadBanks()
}

function openEdit(item: BankCard): void {
  editingId.value = String(item.id)
  Object.assign(form, { bankName: item.bankName, cardNo: '', holderName: item.holderName, phone: '', isDefault: item.isDefault })
  selectedBankIndex.value = -1
  formVisible.value = true
  void loadBanks()
}

function onDefaultChange(e: { detail: { value: boolean } }): void {
  form.isDefault = e.detail.value ? 1 : 0
}

function closeForm(): void {
  if (actionLoading.value) return
  formVisible.value = false
}

async function saveForm(): Promise<void> {
  if (!form.bankName.trim()) { uni.showToast({ title: '请输入银行名称', icon: 'none' }); return }
  if (!editingId.value && !form.cardNo.trim()) { uni.showToast({ title: '请输入银行卡号', icon: 'none' }); return }
  if (editingId.value && !form.cardNo.trim()) { uni.showToast({ title: '修改需重新输入卡号', icon: 'none' }); return }
  if (!form.holderName.trim()) { uni.showToast({ title: '请输入持卡人姓名', icon: 'none' }); return }
  if (actionLoading.value) return
  actionLoading.value = true
  try {
    const payload: BankCardPayload = {
      bankName: form.bankName.trim(),
      cardNo: form.cardNo.replace(/\s+/g, ''),
      holderName: form.holderName.trim(),
      phone: form.phone?.trim() || undefined,
      isDefault: form.isDefault,
    }
    if (editingId.value) {
      await updateBankCard(editingId.value, payload)
      uni.showToast({ title: '银行卡已更新', icon: 'success' })
    } else {
      await createBankCard(payload)
      uni.showToast({ title: '银行卡已绑定', icon: 'success' })
    }
    formVisible.value = false
    await loadList()
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '保存失败', icon: 'none' })
  } finally { actionLoading.value = false }
}

async function remove(item: BankCard): Promise<void> {
  const confirm = await new Promise<boolean>((resolve) => {
    uni.showModal({ title: '解绑银行卡', content: '确认解绑这张银行卡吗？', success: (r) => resolve(r.confirm) })
  })
  if (!confirm) return
  if (actionLoading.value) return
  actionLoading.value = true
  try {
    await deleteBankCard(item.id)
    uni.showToast({ title: '已解绑', icon: 'success' })
    await loadList()
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '解绑失败', icon: 'none' })
  } finally { actionLoading.value = false }
}

async function setDefault(item: BankCard): Promise<void> {
  if (actionLoading.value) return
  actionLoading.value = true
  try {
    await setDefaultBankCard(item.id)
    uni.showToast({ title: '已设为默认', icon: 'success' })
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

onShow(() => { void loadList() })
</script>

<template>
  <view class="page">
    <view class="nav" :style="navStyle">
      <image class="back-button" src="/static/left_arrow.png" mode="aspectFit" @click="goBack" />
      <text class="nav-title">提现银行卡</text>
      <view class="nav-spacer" />
    </view>

    <scroll-view class="page-scroll" scroll-y :style="bodyStyle">
      <view v-if="loading" class="state">加载中...</view>
      <view v-else-if="!list.length" class="state">暂未绑定银行卡</view>
      <view v-else class="bank-list">
        <view v-for="item in list" :key="item.id" class="bank-card">
          <view class="card-head">
            <text class="bank-name">{{ item.bankName }}</text>
            <text v-if="item.isDefault === 1" class="default-tag">默认</text>
          </view>
          <view class="card-no"><text>{{ item.cardNoMasked }}</text></view>
          <view class="card-holder"><text>持卡人 {{ item.holderName }}</text></view>
          <view class="card-actions">
            <text class="action" @click="setDefault(item)">{{ item.isDefault === 1 ? '已默认' : '设为默认' }}</text>
            <text class="action" @click="openEdit(item)">编辑</text>
            <text class="action danger" @click="remove(item)">解绑</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <view class="add-bar"><button class="add-btn" @click="openCreate">+ 绑定银行卡</button></view>

    <view v-if="formVisible" class="mask" @click="closeForm">
      <view class="sheet" @click.stop>
        <view class="sheet-head"><text class="sheet-title">{{ editingId ? '编辑银行卡' : '绑定银行卡' }}</text><text class="sheet-close" @click="closeForm">×</text></view>
        <picker mode="selector" :range="banks.map((b) => b.bankName)" :value="selectedBankIndex" @change="onBankChange">
          <view class="form-line"><text class="label">选择银行</text><text class="input bank-picker-text">{{ bankText }}</text></view>
        </picker>
        <view class="form-line"><text class="label">银行名称</text><input v-model="form.bankName" class="input" maxlength="64" placeholder="如 招商银行（下拉找不到可手输）" /></view>
        <view class="form-line"><text class="label">银行卡号</text><input v-model="form.cardNo" class="input" maxlength="32" type="number" placeholder="输入完整卡号" /></view>
        <view class="form-line"><text class="label">持卡人</text><input v-model="form.holderName" class="input" maxlength="32" placeholder="需与实名一致" /></view>
        <view class="form-line"><text class="label">预留手机</text><input v-model="form.phone" class="input" maxlength="20" type="number" placeholder="可选" /></view>
        <view class="form-line"><text class="label">设为默认</text><switch :checked="form.isDefault === 1" @change="onDefaultChange" /></view>
        <button class="save-btn" :disabled="actionLoading" @click="saveForm">{{ actionLoading ? '保存中...' : '保存' }}</button>
      </view>
    </view>

    <LoginGuide v-model="loginGuideVisible" />
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
.bank-list { padding: 20rpx 24rpx 160rpx; }
.bank-card { margin-bottom: 16rpx; padding: 24rpx; border-radius: 20rpx; background: #fff; }
.card-head { display: flex; align-items: center; gap: 16rpx; }
.bank-name { color: #172033; font-size: 28rpx; font-weight: 600; }
.default-tag { padding: 2rpx 12rpx; border-radius: 8rpx; background: rgba(255, 106, 43, .12); color: #ff5a1f; font-size: 20rpx; }
.card-no { margin-top: 12rpx; color: #475467; font-size: 30rpx; letter-spacing: 1rpx; }
.card-holder { margin-top: 8rpx; color: #667085; font-size: 24rpx; }
.card-actions { display: flex; gap: 28rpx; margin-top: 16rpx; padding-top: 16rpx; border-top: 1rpx solid #f2f4f7; }
.action { color: #475467; font-size: 24rpx; }
.action.danger { color: #f04438; }
.add-bar { position: fixed; right: 0; bottom: 0; left: 0; z-index: 20; padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom)); box-sizing: border-box; background: #fff; }
.add-btn { height: 84rpx; margin: 0; border: 0; border-radius: 42rpx; background: linear-gradient(135deg, #ff6a2b, #ff5a1f); color: #fff; font-size: 30rpx; font-weight: 600; line-height: 84rpx; }
.add-btn::after { border: 0; }
.mask { position: fixed; inset: 0; z-index: 40; display: flex; align-items: flex-end; background: rgba(0, 0, 0, .56); }
.sheet { width: 100%; padding: 28rpx 28rpx calc(30rpx + env(safe-area-inset-bottom)); background: #fff; box-sizing: border-box; }
.sheet-head { position: relative; display: flex; align-items: center; justify-content: center; min-height: 54rpx; margin-bottom: 16rpx; }
.sheet-title { color: #222; font-size: 30rpx; font-weight: 600; }
.sheet-close { position: absolute; right: 0; color: #888; font-size: 42rpx; line-height: 1; }
.form-line { display: flex; align-items: center; gap: 16rpx; margin-bottom: 20rpx; }
.label { width: 140rpx; color: #333; font-size: 26rpx; flex-shrink: 0; }
.input { flex: 1; height: 68rpx; padding: 0 20rpx; border-radius: 12rpx; background: #f7f7f7; color: #333; font-size: 26rpx; }
.bank-picker-text { display: flex; align-items: center; justify-content: space-between; color: #333; }
.save-btn { height: 84rpx; margin-top: 12rpx; border: 0; border-radius: 42rpx; background: linear-gradient(135deg, #ff6a2b, #ff5a1f); color: #fff; font-size: 30rpx; font-weight: 600; line-height: 84rpx; }
.save-btn::after { border: 0; }
</style>
