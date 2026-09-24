<script setup lang="ts">
/**
 * 收货地址簿（设置页子页面）
 * 列表 + 新增/编辑/删除/设默认。数据源：/api/user/address/**（后端已接入）。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  createAddress, deleteAddress, getAddressList, setDefaultAddress, updateAddress,
  type Address, type AddressPayload,
} from '@/api/address'
import { getCities, getProvinces, getDistricts, type Region } from '@/api/region'
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
const formVisible = ref(false)
const editingId = ref<string | null>(null)
const loginGuideVisible = ref(false)
const navigationThrottle = createThrottle(500)
/* ===================== 地址快速录入（2026-09-23 新增） ===================== */

/**
 * 从粘贴的整段文本里识别收货信息（参考别家小程序的「粘贴并识别」）。
 *
 * ⚠️ 中文地址没有固定格式 ⇒ 这里只做**启发式**识别：手机号最可靠（`1[3-9]\d{9}`），
 * 省/市/区按「以省/市/区县结尾的连续片段」从前到后切，剩下的进「详细地址」。
 * 因此识别后**必须让用户核对**（识别完给 toast 提示）。
 */
function parseAddressText(raw: string): { name: string; phone: string; province: string; city: string; district: string; detail: string } {
  const text = String(raw || '').replace(/\s+/g, ' ').trim()
  const phone = (text.match(/1[3-9]\d{9}/) || [''])[0]
  let rest = (phone ? text.replace(phone, ' ') : text).replace(/[,，;；]/g, ' ').replace(/\s+/g, ' ').trim()

  const province = (rest.match(/([^\s]{2,10}?(?:省|自治区|特别行政区))/) || ['', ''])[1]
  const afterProvince = province ? rest.slice(rest.indexOf(province) + province.length) : rest
  const city = (afterProvince.match(/([^\s]{2,10}?(?:市|自治州|地区|盟))/) || ['', ''])[1]
  const afterCity = city ? afterProvince.slice(afterProvince.indexOf(city) + city.length) : afterProvince
  const district = (afterCity.match(/([^\s]{2,10}?(?:区|县|旗))/) || ['', ''])[1]
  const detail = (district ? afterCity.slice(afterCity.indexOf(district) + district.length) : afterCity).trim()

  // 姓名：手机号前后最靠近的 2~4 个汉字，且不含地址关键字
  let name = ''
  const idx = phone ? text.indexOf(phone) : -1
  const segs = idx >= 0 ? [text.slice(idx + phone.length).trim(), text.slice(0, idx).trim()] : [text]
  for (const seg of segs) {
    const m = seg.match(/^([\u4e00-\u9fa5·]{2,4})/)
    if (m && !/省|市|区|县|路|街|号|栋|室|楼|镇|村/.test(m[1])) { name = m[1]; break }
  }
  return { name, phone, province, city, district, detail: detail || rest }
}

/** 「粘贴并识别」：读剪贴板 → 解析 → 回填表单。 */
function pasteAndRecognize(): void {
  uni.getClipboardData({
    success: (res) => {
      const text = String((res as { data?: string })?.data || '').trim()
      if (!text) { uni.showToast({ title: '剪贴板是空的，请先复制收货信息', icon: 'none' }); return }
      const parsed = parseAddressText(text)
      if (parsed.name) form.receiverName = parsed.name
      if (parsed.phone) form.receiverPhone = parsed.phone
      if (parsed.province) form.province = parsed.province
      if (parsed.city) form.city = parsed.city
      if (parsed.district) form.district = parsed.district
      if (parsed.detail) form.detail = parsed.detail
      uni.showToast({ title: '已识别，请核对后保存', icon: 'none' })
    },
    fail: () => uni.showToast({ title: '读取剪贴板失败，请手动填写', icon: 'none' }),
  })
}

/**
 * 「授权微信地址」：调微信原生地址簿（`uni.chooseAddress`）。
 * ⚠️ 仅微信小程序支持；其它端会走 fail 分支，给"请手动填写"的提示。
 */
function chooseWechatAddress(): void {
  uni.chooseAddress({
    success: (res) => {
      const r = res as unknown as { userName?: string; telNumber?: string; provinceName?: string; cityName?: string; countyName?: string; detailInfo?: string }
      if (r.userName) form.receiverName = r.userName
      if (r.telNumber) form.receiverPhone = r.telNumber
      if (r.provinceName) form.province = r.provinceName
      if (r.cityName) form.city = r.cityName
      if (r.countyName) form.district = r.countyName
      if (r.detailInfo) form.detail = r.detailInfo
      uni.showToast({ title: '已带入微信地址，请核对', icon: 'none' })
    },
    fail: (err) => {
      const msg = String((err as { errMsg?: string })?.errMsg || '')
      if (!/cancel/i.test(msg)) uni.showToast({ title: '未能获取微信地址，请手动填写', icon: 'none' })
    },
  })
}

const form = reactive<AddressPayload>({ receiverName: '', receiverPhone: '', province: '', city: '', district: '', detail: '', isDefault: 0 })

/** 省市区三级联动数据（region/list）。 */
const provinces = ref<Region[]>([])
const cities = ref<Region[]>([])
const districts = ref<Region[]>([])
/** multiSelector 当前选中下标（省/市/区）。 */
const regionIndex = ref([0, 0, 0])
/** 当前选中的 code 缓存：省 code / 市 code / 区 code。 */
const regionCodes = ref<string[]>(['', '', ''])
/** 三级联动 picker 的列（列名列表）。 */
const regionColumns = computed(() => [
  provinces.value.map((p) => p.name),
  cities.value.map((c) => c.name),
  districts.value.map((d) => d.name),
])
/** 已选省/市/区文本，供 picker 显示。 */
const regionText = computed(() => [form.province, form.city, form.district].filter(Boolean).join(' ') || '请选择省/市/区')
/** 是否已加载省列表。 */
const regionLoaded = ref(false)

/** 加载省级列表。 */
async function loadProvinces(): Promise<void> {
  try {
    provinces.value = await getProvinces()
    regionLoaded.value = true
  } catch {
    provinces.value = []
  }
}

/** 加载市级（按省 code）。 */
async function loadCities(provinceCode: string): Promise<void> {
  if (!provinceCode) { cities.value = []; return }
  try { cities.value = await getCities(provinceCode) } catch { cities.value = [] }
}

/** 加载区县（按市 code）。 */
async function loadDistricts(cityCode: string): Promise<void> {
  if (!cityCode) { districts.value = []; return }
  try { districts.value = await getDistricts(cityCode) } catch { districts.value = [] }
}

/** picker 列切换：联动刷新下级列。 */
async function onRegionColumnChange(e: { detail: { column: number; value: number } }): Promise<void> {
  const { column, value } = e.detail
  regionIndex.value[column] = value
  if (column === 0) {
    const code = provinces.value[value]?.code || ''
    regionCodes.value[0] = code
    await loadCities(code)
    regionCodes.value[1] = ''
    regionIndex.value[1] = 0
    await loadDistricts('')
    regionIndex.value[2] = 0
  } else if (column === 1) {
    const code = cities.value[value]?.code || ''
    regionCodes.value[1] = code
    await loadDistricts(code)
    regionIndex.value[2] = 0
  }
}

/** picker 确认：回填省/市/区名称到 form。 */
function onRegionConfirm(e: { detail: { value: number[] } }): void {
  const [pi, ci, di] = e.detail.value
  form.province = provinces.value[pi]?.name || ''
  form.city = cities.value[ci]?.name || ''
  form.district = districts.value[di]?.name || ''
  regionIndex.value = [pi, ci, di]
}

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

function openCreate(): void {
  editingId.value = null
  Object.assign(form, { receiverName: '', receiverPhone: '', province: '', city: '', district: '', detail: '', isDefault: 0 })
  formVisible.value = true
  void loadProvinces()
}

function openEdit(item: Address): void {
  editingId.value = String(item.id)
  Object.assign(form, {
    receiverName: item.receiverName,
    receiverPhone: item.receiverPhone,
    province: item.province || '',
    city: item.city || '',
    district: item.district || '',
    detail: item.detail,
    isDefault: item.isDefault,
  })
  formVisible.value = true
  void loadProvinces()
}

function onDefaultChange(e: { detail: { value: boolean } }): void {
  form.isDefault = e.detail.value ? 1 : 0
}

function closeForm(): void {
  if (actionLoading.value) return
  formVisible.value = false
}

async function saveForm(): Promise<void> {
  if (!form.receiverName.trim()) { uni.showToast({ title: '请输入收货人', icon: 'none' }); return }
  if (!form.receiverPhone.trim()) { uni.showToast({ title: '请输入手机号', icon: 'none' }); return }
  if (!form.detail.trim()) { uni.showToast({ title: '请输入详细地址', icon: 'none' }); return }
  if (actionLoading.value) return
  actionLoading.value = true
  try {
    const payload: AddressPayload = {
      receiverName: form.receiverName.trim(),
      receiverPhone: form.receiverPhone.trim(),
      province: form.province?.trim() || undefined,
      city: form.city?.trim() || undefined,
      district: form.district?.trim() || undefined,
      detail: form.detail.trim(),
      isDefault: form.isDefault,
    }
    if (editingId.value) {
      await updateAddress(editingId.value, payload)
      successToastRef.value?.show('地址已更新')
    } else {
      await createAddress(payload)
      successToastRef.value?.show('地址已添加')
    }
    formVisible.value = false
    await loadList()
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '保存失败', icon: 'none' })
  } finally { actionLoading.value = false }
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

    <view v-if="formVisible" class="mask" @click="closeForm">
      <view class="sheet" @click.stop>
        <view class="quick-row">
            <text class="quick-btn" @click="pasteAndRecognize">粘贴并识别</text>
            <text class="quick-btn" @click="chooseWechatAddress">授权微信地址</text>
          </view>
          <view class="sheet-head"><text class="sheet-title">{{ editingId ? '编辑地址' : '新增地址' }}</text><text class="sheet-close" @click="closeForm">×</text></view>
        <view class="form-line"><text class="label">收货人</text><input v-model="form.receiverName" class="input" maxlength="32" placeholder="请输入" /></view>
        <view class="form-line"><text class="label">手机号</text><input v-model="form.receiverPhone" class="input" maxlength="20" type="number" placeholder="请输入" /></view>
        <picker mode="multiSelector" :range="regionColumns" :value="regionIndex" @columnchange="onRegionColumnChange" @change="onRegionConfirm">
          <view class="form-line"><text class="label">省/市/区</text><text class="input region-picker-text">{{ regionText }}</text></view>
        </picker>
        <view class="form-line"><text class="label">省</text><input v-model="form.province" class="input" placeholder="可选（或点击上方快捷选择）" /></view>
        <view class="form-line"><text class="label">市</text><input v-model="form.city" class="input" placeholder="可选" /></view>
        <view class="form-line"><text class="label">区/县</text><input v-model="form.district" class="input" placeholder="可选" /></view>
        <view class="form-line"><text class="label">详细地址</text><input v-model="form.detail" class="input" maxlength="200" placeholder="街道门牌等" /></view>
        <view class="form-line"><text class="label">设为默认</text><switch :checked="form.isDefault === 1" @change="onDefaultChange" /></view>
        <button class="save-btn" :disabled="actionLoading" @click="saveForm">{{ actionLoading ? '保存中...' : '保存' }}</button>
      </view>
    </view>

    <LoginGuide v-model="loginGuideVisible" />
    <SuccessToast ref="successToastRef" />
  </view>
</template>

<style scoped>
/* 地址快速录入：粘贴识别 / 授权微信地址 */
.quick-row { display: flex; gap: 16rpx; padding: 0 32rpx 16rpx; }
.quick-btn { padding: 10rpx 24rpx; border: 1rpx solid #e5e6eb; border-radius: 30rpx; color: #4e5969; font-size: 24rpx; }
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
.add-btn { height: 84rpx; margin: 0; border: 0; border-radius: 42rpx; background: linear-gradient(135deg, #ff6a2b, #ff5a1f); color: #fff; font-size: 30rpx; font-weight: 600; line-height: 84rpx; }
.add-btn::after { border: 0; }
.mask { position: fixed; inset: 0; z-index: 40; display: flex; align-items: flex-end; background: rgba(0, 0, 0, .56); }
.sheet { width: 100%; padding: 28rpx 28rpx calc(30rpx + env(safe-area-inset-bottom)); background: #fff; box-sizing: border-box; }
.sheet-head { position: relative; display: flex; align-items: center; justify-content: center; min-height: 54rpx; margin-bottom: 16rpx; }
.sheet-title { color: #222; font-size: 30rpx; font-weight: 600; }
.sheet-close { position: absolute; right: 0; color: #888; font-size: 42rpx; line-height: 1; }
.form-line { display: flex; align-items: center; gap: 16rpx; margin-bottom: 20rpx; }
.label { width: 120rpx; color: #333; font-size: 26rpx; flex-shrink: 0; }
.input { flex: 1; height: 68rpx; padding: 0 20rpx; border-radius: 12rpx; background: #f7f7f7; color: #333; font-size: 26rpx; }
.region-picker-text { display: flex; align-items: center; justify-content: space-between; color: #333; }
.region-picker-text:empty::after { content: '请选择省/市/区'; color: #999; }
.save-btn { height: 84rpx; margin-top: 12rpx; border: 0; border-radius: 42rpx; background: linear-gradient(135deg, #ff6a2b, #ff5a1f); color: #fff; font-size: 30rpx; font-weight: 600; line-height: 84rpx; }
.save-btn::after { border: 0; }
</style>
