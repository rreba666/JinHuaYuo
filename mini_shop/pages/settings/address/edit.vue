<script setup lang="ts">
/**
 * 收货地址 · 新增/编辑（**整页**，2026-09-23 新增）
 *
 * ## 为什么改成整页
 * 原来是各页内联的**底部弹层**（确认订单页、地址簿页各一份），弹层里只有 姓名/手机号/详细地址
 * 三格，没地方放"快速录入"，也没有省市区。改成整页后：
 * - 有空间放 **「粘贴并识别」** 与 **「授权微信地址」** 两个快速录入入口（照参考做法）；
 * - 省市区三级联动、设为默认等字段一次放齐；
 * - 三个入口（地址簿、确认订单、未来的其它页）**共用这一份表单**，不会再各写一份。
 *
 * ## 入口约定
 * - `?id=<地址ID>` → 编辑该地址（会先拉列表找到它回填）；
 * - 不带参数 → 新增。
 * - 保存成功后 `uni.navigateBack()`，并在上一页 `onShow` 时重新拉地址列表（本页**不回传数据**，
 *   避免各调用方解析返回值）。
 */
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { createAddress, getAddressList, updateAddress, type Address, type AddressPayload } from '@/api/address'
import { getCities, getDistricts, getProvinces, type Region } from '@/api/region'

const editingId = ref<string>('')
const saving = ref(false)

/** 表单（字段名与后端 AddressPayload 对齐）。 */
const form = reactive<AddressPayload>({
  receiverName: '',
  receiverPhone: '',
  province: '',
  city: '',
  district: '',
  detail: '',
  isDefault: 0,
})

/** 导航栏几何（与项目其它页一致：取微信胶囊位置，避免自绘栏与胶囊错位）。 */
const menuTop = ref(0)
const menuHeight = ref(32)
const navStyle = computed(() => ({ top: `${menuTop.value}px`, height: `${menuHeight.value}px` }))
const bodyStyle = computed(() => ({ paddingTop: `${menuTop.value + menuHeight.value + uni.upx2px(20)}px` }))

/* ===================== 省市区三级联动 ===================== */

const provinces = ref<Region[]>([])
const cities = ref<Region[]>([])
const districts = ref<Region[]>([])
/** picker 的三列下标。 */
const regionIndex = ref<number[]>([0, 0, 0])

/** picker 的三列（省/市/区名称）。
 *  ⚠️ 不要在模板里写 `.map()` 之类的表达式：小程序端模板编译对复杂表达式支持有限，
 *  统一放 computed（与地址簿页原来的写法保持一致）。 */
const regionColumns = computed<string[]>(() => [
  provinces.value.map((p) => p.name),
  cities.value.map((c) => c.name),
  districts.value.map((d) => d.name),
])

/** picker 的当前值（列不存在时给空串，避免越界）。 */
const regionValue = computed<string[]>(() => [
  provinces.value[regionIndex.value[0]]?.name || '',
  cities.value[regionIndex.value[1]]?.name || '',
  districts.value[regionIndex.value[2]]?.name || '',
])

/** 地区选择框里的展示文本。 */
const regionText = computed<string>(() => regionValue.value.filter(Boolean).join(' ') || '请选择')

/** 只拉省；市/区在定位或换列时按需拉。 */
async function loadProvinces(): Promise<void> {
  try {
    provinces.value = await getProvinces()
  } catch {
    provinces.value = []
    return
  }
  const pi = provinces.value.findIndex((item) => item.name === form.province)
  regionIndex.value[0] = pi >= 0 ? pi : 0
  await loadCities(form.city)
}

/**
 * 按当前省 code 拉市列表。
 * @param keepCity 回填时用于把已有城市名定位到下标（定位不到就落到第 0 项）。
 */
async function loadCities(keepCity = ''): Promise<void> {
  const code = provinces.value[regionIndex.value[0]]?.code
  cities.value = code ? await getCities(String(code)).catch(() => []) : []
  const ci = keepCity ? cities.value.findIndex((item) => item.name === keepCity) : -1
  regionIndex.value[1] = ci >= 0 ? ci : 0
  await loadDistricts(keepCity ? form.district : '')
}

/**
 * 按当前市 code 拉区县列表。
 * @param keepDistrict 回填时用于把已有区县名定位到下标（定位不到就落到第 0 项）。
 */
async function loadDistricts(keepDistrict = ''): Promise<void> {
  const code = cities.value[regionIndex.value[1]]?.code
  districts.value = code ? await getDistricts(String(code)).catch(() => []) : []
  const di = keepDistrict ? districts.value.findIndex((item) => item.name === keepDistrict) : -1
  regionIndex.value[2] = di >= 0 ? di : 0
}

/** picker 换列：上一级变了要清空并重拉下一级。 */
async function onRegionColumnChange(e: { detail: { column: number; value: number } }): Promise<void> {
  const { column, value } = e.detail
  regionIndex.value[column] = value
  if (column === 0) {
    regionIndex.value[1] = 0
    regionIndex.value[2] = 0
    await loadCities('')
  } else if (column === 1) {
    regionIndex.value[2] = 0
    await loadDistricts('')
  }
}

/** picker 确认后写进表单（以事件里的三列下标为准，并同步回 regionIndex）。 */
function onRegionChange(e: { detail: { value: number[] } }): void {
  const [pi, ci, di] = e.detail.value || regionIndex.value
  regionIndex.value = [pi, ci, di]
  form.province = provinces.value[pi]?.name || ''
  form.city = cities.value[ci]?.name || ''
  form.district = districts.value[di]?.name || ''
}

/* ===================== 地图选点（自动填地区） ===================== */

/**
 * 从地图选点返回的地址串里拆出「省 / 市 / 区」。
 *
 * `uni.chooseLocation` 的 `address` 是「江西省九江市柴桑区水葵路」这样一整串，
 * 整串塞进详细地址会和「所在地区」重复，而地区又一直空着 —— 所以先拆出省市区，
 * 剩下的街道部分才留给详细地址。
 */
function parseRegion(text: string): { province: string; city: string; district: string; rest: string } | null {
  const raw = String(text || '').trim()
  if (!raw) return null
  // 普通省份：江西省 / 广西壮族自治区 / 内蒙古自治区…
  const normal = raw.match(/^(.{2,10}?(?:省|自治区|特别行政区))(.{2,12}?(?:市|自治州|地区|盟))(.{2,12}?(?:区|县|旗|市))(.*)$/)
  if (normal) return { province: normal[1], city: normal[2], district: normal[3], rest: normal[4] || '' }
  // 直辖市：北京市朝阳区…（省、市两级同名，联动里两级都填同一个名字）
  const municipality = raw.match(/^(北京市|上海市|天津市|重庆市)(.{2,12}?(?:区|县))?(.*)$/)
  if (municipality) {
    return { province: municipality[1], city: municipality[1], district: municipality[2] || '', rest: municipality[3] || '' }
  }
  return null
}

/**
 * 把省市区写进表单，并把三级联动定位过去。
 * 识别出来的名字未必在区划表里，定位不到就退回第 0 项（用户仍可用「手选」纠正）。
 */
async function applyRegionText(province: string, city: string, district: string): Promise<void> {
  form.province = province || ''
  form.city = city || ''
  form.district = district || ''
  const pi = provinces.value.findIndex((item) => item.name === province)
  regionIndex.value[0] = pi >= 0 ? pi : 0
  await loadCities(city)
}

/**
 * 地图选点（点击「选择地区」触发）：弹微信地图，选中后自动回填省市区与详细地址。
 *
 * ⚠️ 依赖 `chooseLocation` + `scope.userLocation`，两者都必须在 `manifest.json` 的
 * `mp-weixin.requiredPrivateInfos` / `permission` 里声明，否则基础库直接让调用失败。
 */
function pickOnMap(): void {
  uni.chooseLocation({
    success: async (res) => {
      const address = String(res.address || '').trim()
      const pointName = String(res.name || '').trim()
      const parsed = parseRegion(address)
      if (parsed) await applyRegionText(parsed.province, parsed.city, parsed.district)
      // 详细地址优先用选点名称（如「XX 小区」），没有就退回剥掉省市区后的街道部分
      const detail = pointName || (parsed ? parsed.rest : address)
      if (detail) form.detail = detail
      uni.showToast({ title: '已按地图选点填写，请核对', icon: 'none' })
    },
    fail: (err) => {
      const msg = String((err as { errMsg?: string })?.errMsg || '')
      // 用户主动取消不打扰；其它失败（未授权 / 未声明隐私接口）给一句可操作的提示
      if (!/cancel/i.test(msg)) uni.showToast({ title: '地图选点失败，可点「手选」或检查定位授权', icon: 'none' })
    },
  })
}

/* ===================== 快速录入（参考做法） ===================== */

/**
 * 从粘贴的整段文本里识别收货信息。
 *
 * ⚠️ 中文地址没有固定格式 ⇒ 只做**启发式**识别：手机号最可靠（`1[3-9]\d{9}`），
 * 省/市/区按"以省/市/区县结尾的连续片段"从前到后切，剩下的进「详细地址」。
 * 因此识别后**必须让用户核对**。
 */
function parseAddressText(raw: string): { name: string; phone: string; province: string; city: string; district: string; detail: string } {
  const text = String(raw || '').replace(/\s+/g, ' ').trim()
  const phone = (text.match(/1[3-9]\d{9}/) || [''])[0]
  const rest = (phone ? text.replace(phone, ' ') : text).replace(/[,，;；]/g, ' ').replace(/\s+/g, ' ').trim()

  const province = (rest.match(/([^\s]{2,10}?(?:省|自治区|特别行政区))/) || ['', ''])[1]
  const afterProvince = province ? rest.slice(rest.indexOf(province) + province.length) : rest
  const city = (afterProvince.match(/([^\s]{2,10}?(?:市|自治州|地区|盟))/) || ['', ''])[1]
  const afterCity = city ? afterProvince.slice(afterProvince.indexOf(city) + city.length) : afterProvince
  const district = (afterCity.match(/([^\s]{2,10}?(?:区|县|旗))/) || ['', ''])[1]
  const detail = (district ? afterCity.slice(afterCity.indexOf(district) + district.length) : afterCity).trim()

  let name = ''
  const idx = phone ? text.indexOf(phone) : -1
  const segs = idx >= 0 ? [text.slice(idx + phone.length).trim(), text.slice(0, idx).trim()] : [text]
  for (const seg of segs) {
    const m = seg.match(/^([\u4e00-\u9fa5·]{2,4})/)
    if (m && !/省|市|区|县|路|街|号|栋|室|楼|镇|村/.test(m[1])) { name = m[1]; break }
  }
  return { name, phone, province, city, district, detail: detail || rest }
}

const pasteText = ref('')
const recognizing = ref(false)

/** 解析一段文本并回填表单（识别完提示核对）。 */
async function applyPastedText(text: string): Promise<void> {
  const parsed = parseAddressText(text)
  if (parsed.name) form.receiverName = parsed.name
  if (parsed.phone) form.receiverPhone = parsed.phone
  if (parsed.detail) form.detail = parsed.detail
  // 省市区：识别到了就写进表单，并把三级联动定位过去
  if (parsed.province) await applyRegionText(parsed.province, parsed.city, parsed.district)
  uni.showToast({ title: '已识别，请核对后保存', icon: 'none' })
}

/**
 * 「粘贴并识别」。
 *
 * ⚠️ **优先解析输入框里已有的文本**：`getClipboardData` 属于隐私接口，在小程序后台未配置
 * 《用户隐私保护指引》或用户未同意时会直接 fail —— 此时用户仍可在输入框里长按粘贴。
 * 所以只有输入框为空时才去读剪贴板，避免"接口不可用就整条路走不通"。
 */
function pasteAndRecognize(): void {
  const typed = pasteText.value.trim()
  if (typed) {
    void applyPastedText(typed)
    return
  }
  recognizing.value = true
  uni.getClipboardData({
    success: async (res) => {
      const text = String((res as { data?: string })?.data || '').trim()
      pasteText.value = text
      if (!text) { uni.showToast({ title: '剪贴板是空的，请先复制收货信息', icon: 'none' }); return }
      await applyPastedText(text)
    },
    fail: () => uni.showToast({ title: '读取剪贴板失败，请长按上方输入框粘贴后再点识别', icon: 'none' }),
    complete: () => { recognizing.value = false },
  })
}

/** 「授权微信地址」：调微信原生地址簿（`uni.chooseAddress`，仅微信端支持）。 */
function chooseWechatAddress(): void {
  uni.chooseAddress({
    success: async (res) => {
      const r = res as unknown as { userName?: string; telNumber?: string; provinceName?: string; cityName?: string; countyName?: string; detailInfo?: string }
      if (r.userName) form.receiverName = r.userName
      if (r.telNumber) form.receiverPhone = r.telNumber
      if (r.detailInfo) form.detail = r.detailInfo
      if (r.provinceName) await applyRegionText(r.provinceName, r.cityName || '', r.countyName || '')
      uni.showToast({ title: '已带入微信地址，请核对', icon: 'none' })
    },
    fail: (err) => {
      const msg = String((err as { errMsg?: string })?.errMsg || '')
      if (!/cancel/i.test(msg)) uni.showToast({ title: '未能获取微信地址，请手动填写', icon: 'none' })
    },
  })
}

/* ===================== 保存 ===================== */

/** 返回上一页。 */
function goBack(): void {
  uni.navigateBack({ delta: 1 })
}

/** 「设为默认地址」开关变化。 */
function onDefaultChange(e: { detail: { value: boolean } }): void {
  form.isDefault = e.detail.value ? 1 : 0
}

/** 校验并保存（新增或编辑），成功后返回上一页。 */
async function save(): Promise<void> {
  const name = form.receiverName.trim()
  const phone = form.receiverPhone.trim()
  const detail = form.detail.trim()
  if (!name) { uni.showToast({ title: '请输入收货人姓名', icon: 'none' }); return }
  if (!/^1[3-9]\d{9}$/.test(phone)) { uni.showToast({ title: '请输入正确的手机号', icon: 'none' }); return }
  if (!detail) { uni.showToast({ title: '请输入详细地址', icon: 'none' }); return }

  saving.value = true
  try {
    const payload: AddressPayload = {
      receiverName: name,
      receiverPhone: phone,
      province: form.province?.trim() || undefined,
      city: form.city?.trim() || undefined,
      district: form.district?.trim() || undefined,
      detail,
      isDefault: form.isDefault,
    }
    if (editingId.value) await updateAddress(editingId.value, payload)
    else await createAddress(payload)
    uni.showToast({ title: editingId.value ? '地址已更新' : '地址已保存', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 600)
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '保存失败', icon: 'none' })
  } finally {
    saving.value = false
  }
}

onLoad(async (options) => {
  try {
    const rect = uni.getMenuButtonBoundingClientRect()
    if (rect) { menuTop.value = rect.top; menuHeight.value = rect.height }
  } catch { /* 非微信环境用默认值 */ }
  editingId.value = String(options?.id || '')
  await loadProvinces()
  if (!editingId.value) return
  // 编辑：从列表里找到该条回填（列表接口按登录用户过滤，够用）
  try {
    const list: Address[] = await getAddressList()
    const hit = (list || []).find((item) => String(item.id) === editingId.value)
    if (hit) {
      form.receiverName = hit.receiverName || ''
      form.receiverPhone = hit.receiverPhone || ''
      form.province = hit.province || ''
      form.city = hit.city || ''
      form.district = hit.district || ''
      form.detail = hit.detail || ''
      form.isDefault = Number(hit.isDefault) === 1 ? 1 : 0
      const pi = provinces.value.findIndex((item) => item.name === form.province)
      if (pi >= 0) { regionIndex.value[0] = pi; await loadCities(form.city) }
    }
  } catch {
    /* 回填失败就让用户重填，不阻塞页面 */
  }
})
</script>

<template>
  <view class="page">
    <!-- 自定义导航栏（位置随微信胶囊） -->
    <view class="nav" :style="navStyle">
      <view class="nav-inner">
        <text class="nav-back" @click="goBack">‹</text>
        <text class="nav-title">{{ editingId ? '编辑收货地址' : '添加新地址' }}</text>
      </view>
    </view>

    <view class="body" :style="bodyStyle">
      <!-- 快速录入：授权微信地址 -->
      <view class="quick-head">
        <text class="quick-link" @click="chooseWechatAddress">授权微信个人地址</text>
      </view>

      <!-- 快速录入：粘贴并识别 -->
      <view class="paste-card">
        <textarea
          v-model="pasteText"
          class="paste-input"
          placeholder="粘贴信息，自动拆分姓名、电话和地址"
          :maxlength="500"
          auto-height
        />
        <view class="paste-action">
          <button class="paste-btn" :loading="recognizing" @click="pasteAndRecognize">粘贴并识别</button>
        </view>
      </view>

      <!-- 表单 -->
      <view class="form-card">
        <view class="field">
          <text class="field-label">姓名<text class="req">*</text></text>
          <input v-model="form.receiverName" class="field-input" maxlength="32" placeholder="请输入" />
        </view>
        <view class="field">
          <text class="field-label">手机号码<text class="req">*</text></text>
          <input v-model="form.receiverPhone" class="field-input" type="number" maxlength="11" placeholder="请输入" />
        </view>
        <!-- 选择地区：点左边文字区 → 地图选点自动回填；右边「手选」走省市区选择器（地图选不到时兜底） -->
        <view class="field">
          <text class="field-label">选择地区<text class="req">*</text></text>
          <view class="region-value" @click="pickOnMap">
            <text class="region-text" :class="{ placeholder: !form.province }">{{ regionText }}</text>
          </view>
          <picker
            mode="multiSelector"
            :range="regionColumns"
            :value="regionIndex"
            @columnchange="onRegionColumnChange"
            @change="onRegionChange"
          >
            <view class="region-hand">手选</view>
          </picker>
        </view>
        <view class="field">
          <text class="field-label">详细地址<text class="req">*</text></text>
          <input v-model="form.detail" class="field-input" maxlength="200" placeholder="请输入" />
        </view>

        <view class="switch-row">
          <text class="switch-label">设为默认地址</text>
          <switch :checked="Number(form.isDefault) === 1" @change="onDefaultChange" />
        </view>
      </view>

      <button class="save-btn" :disabled="saving" @click="save">{{ saving ? '保存中...' : '保存' }}</button>
    </view>
  </view>
</template>

<style scoped>
.page { min-height: 100vh; box-sizing: border-box; background: #f5f6f8; }
/* 导航栏底色与页面一致（与地址簿页同款），不要白底，否则顶部会有一条明显的色带 */
.nav { position: fixed; right: 0; left: 0; z-index: 20; background: #f5f6f8; }
.nav-inner { display: flex; align-items: center; height: 44px; padding: 0 24rpx; }
.nav-back { display: flex; align-items: center; width: 56rpx; height: 88rpx; color: #1d2129; font-size: 46rpx; line-height: 1; }
.nav-title { color: #1d2129; font-size: 34rpx; font-weight: 600; }
.body { padding: 24rpx; }
.quick-head { display: flex; justify-content: flex-end; padding: 0 8rpx 12rpx; }
.quick-link { color: #12a150; font-size: 26rpx; }
.paste-card { position: relative; margin-bottom: 20rpx; padding: 24rpx; border-radius: 16rpx; background: #fff; }
.paste-input { width: 100%; min-height: 120rpx; color: #1d2129; font-size: 27rpx; line-height: 40rpx; }
.paste-action { display: flex; justify-content: flex-end; margin-top: 12rpx; }
.paste-btn { margin: 0; padding: 0 28rpx; border-radius: 8rpx; background: #010101; color: #fff; font-size: 26rpx; line-height: 64rpx; }
.form-card { padding: 8rpx 24rpx; border-radius: 16rpx; background: #fff; }
.field { display: flex; align-items: center; min-height: 100rpx; border-bottom: 1rpx solid #f2f4f7; }
.field:last-of-type { border-bottom: none; }
.field-label { flex: 0 0 150rpx; color: #4e5969; font-size: 28rpx; }
.req { color: #e0432a; }
.field-input { flex: 1; min-width: 0; color: #1d2129; font-size: 28rpx; }
/* 选择地区：文字区点开地图选点，右侧「手选」是省市区选择器 */
.region-value { flex: 1; min-width: 0; }
.region-text { display: block; color: #1d2129; font-size: 28rpx; }
.region-text.placeholder { color: #c9cdd4; }
.region-hand { margin-left: 16rpx; padding: 6rpx 18rpx; border: 1rpx solid #e5e6eb; border-radius: 8rpx; color: #4e5969; font-size: 24rpx; }
.switch-row { display: flex; align-items: center; justify-content: space-between; min-height: 100rpx; }
.switch-label { color: #4e5969; font-size: 28rpx; }
.save-btn { margin-top: 40rpx; border-radius: 8rpx; background: #010101; color: #fff; font-size: 30rpx; line-height: 92rpx; }
.save-btn[disabled] { opacity: .6; }
</style>
