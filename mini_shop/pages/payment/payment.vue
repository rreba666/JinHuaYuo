<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { getCartList, type CartItem } from '@/api/cart'
import { cancelOrder, createOrder, getOrderDetail, type OrderDetail } from '@/api/order'
import { createPrepay, requestPayment } from '@/api/payment'
import { getEnabledShops, type EnabledShop } from '@/api/shop'
import { submitInvoice } from '@/api/invoice'

type PickupType = 0 | 1
type InvoiceType = 'personal' | 'company'

interface Address {
  name: string
  phone: string
  detail: string
}

const menuTop = ref(0)
const menuHeight = ref(32)
const navStyle = computed(() => ({ top: `${menuTop.value}px`, height: `${menuHeight.value}px` }))
const bodyTop = computed(() => menuTop.value + menuHeight.value + 10)

const items = ref<CartItem[]>([])
const selectedCartIds = ref<number[]>([])
const loading = ref(true)
const loadError = ref(false)

const pickupType = ref<PickupType>(0)
const selectedAddress = ref<Address | null>(null)
const selectedShop = ref<EnabledShop | null>(null)
const contactName = ref('')
const contactPhone = ref('')
const shops = ref<EnabledShop[]>([])
const orderId = ref<string | null>(null)
const existingOrder = ref<OrderDetail | null>(null)
const paying = ref(false)
/** 倒计时基准时间，定时器每秒刷新驱动剩余时间重算。 */
const now = ref(Date.now())
let countdownTimer: ReturnType<typeof setInterval> | null = null

const addressSheetVisible = ref(false)
const shopSheetVisible = ref(false)
const addressForm = reactive<Address>({ name: '', phone: '', detail: '' })

const invoiceExpanded = ref(false)
const invoiceDrawerVisible = ref(false)
const invoiceEnabled = ref(false)
const invoiceType = ref<InvoiceType>('personal')
const invoiceSaved = ref(false)
const invoiceForm = reactive({
  name: '',
  companyName: '',
  taxNumber: '',
  email: '',
})

const remarkExpanded = ref(false)
const remark = ref('')

const subtotal = computed(() => items.value.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0))
const deliveryFee = computed(() => Number(existingOrder.value?.freightAmount || 0))
const total = computed(() => subtotal.value + deliveryFee.value)
const itemCount = computed(() => items.value.reduce((sum, item) => sum + item.quantity, 0))
const canRenderCheckout = computed(() => !loading.value && !loadError.value && (items.value.length > 0 || Boolean(existingOrder.value)))
const invoiceSummary = computed(() => {
  if (!invoiceEnabled.value) return '不需要发票'
  if (!invoiceSaved.value) return '请填写发票信息'
  return invoiceType.value === 'personal'
    ? `个人 · ${invoiceForm.name}`
    : `公司 · ${invoiceForm.companyName}`
})
const remarkSummary = computed(() => remark.value.trim() || '添加备注')

/** 是否展示「取消订单」按钮：仅从订单列表进入的待付款历史订单。 */
const showCancelOrder = computed(() => Boolean(orderId.value) && existingOrder.value?.status === 0)

/** 解析支付截止时间字符串（yyyy-MM-dd HH:mm:ss）为毫秒时间戳，iOS 需把 '-' 换成 '/'。 */
function parseExpireTime(value?: string): number {
  if (!value) return 0
  const normalized = String(value).replace(/-/g, '/')
  const t = new Date(normalized).getTime()
  return Number.isFinite(t) ? t : 0
}

/** 支付剩余秒数（仅待付款历史订单，依赖后端 payExpireTime 字符串）。 */
const payRemainingSeconds = computed(() => {
  if (!showCancelOrder.value) return 0
  const expire = parseExpireTime(existingOrder.value?.payExpireTime)
  if (!expire) return 0
  return Math.max(0, Math.floor((expire - now.value) / 1000))
})
/** 倒计时文案 HH:MM:SS。 */
const countdownText = computed(() => {
  const s = payRemainingSeconds.value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
})

/** 格式化金额，统一保留两位小数。 */
function formatMoney(value: number): string {
  return Number(value || 0).toFixed(2)
}

/** 计算单个商品的小计。 */
function productTotal(item: CartItem): number {
  return Number(item.price || 0) * item.quantity
}

/** 从购物车重新读取数据，只保留结算入口传入的记录。 */
async function loadSelectedItems(): Promise<void> {
  loading.value = true
  loadError.value = false
  try {
    const allItems = await getCartList()
    items.value = allItems.filter((item) => selectedCartIds.value.includes(item.cartId))
  } catch (error) {
    loadError.value = true
    console.error('确认订单商品加载失败', error)
  } finally {
    loading.value = false
  }
}

/** 加载历史待付款订单，避免从订单列表进入时再次按购物车创建新订单。 */
async function loadExistingOrder(): Promise<void> {
  if (!orderId.value) return
  loading.value = true
  loadError.value = false
  try {
    const detail = await getOrderDetail(orderId.value)
    existingOrder.value = detail
    pickupType.value = detail.pickupType ?? 0
    if (detail.receiverName || detail.receiverPhone || detail.receiverAddress) {
      selectedAddress.value = {
        name: detail.receiverName || '',
        phone: detail.receiverPhone || '',
        detail: detail.receiverAddress || '',
      }
    }
    if (detail.shopName) {
      selectedShop.value = {
        id: detail.pickupShopId || 0,
        name: detail.shopName,
        address: '',
      }
    }

    const detailItems = Array.isArray(detail.items) ? detail.items : []
    if (detailItems.length) {
      items.value = detailItems.map((item, index) => ({
        cartId: -(index + 1),
        productId: 0,
        skuId: 0,
        productName: item.productName || '订单商品',
        productImage: item.productImage || detail.firstProductImage || '',
        skuName: item.skuName || '',
        specs: '',
        price: Number(item.price || 0),
        quantity: Number(item.quantity || 1),
        checked: true,
        stock: 0,
      }))
    } else if (detail.totalQuantity > 0) {
      items.value = [{
        cartId: -1,
        productId: 0,
        skuId: 0,
        productName: '订单商品',
        productImage: detail.firstProductImage || '',
        skuName: '',
        specs: '',
        price: Number(detail.payAmount || 0) / detail.totalQuantity,
        quantity: detail.totalQuantity,
        checked: true,
        stock: 0,
      }]
    }
  } catch (error) {
    loadError.value = true
    console.error('历史订单加载失败', error)
  } finally {
    loading.value = false
  }
}

function reloadCheckout(): void {
  if (orderId.value) {
    void loadExistingOrder()
    return
  }
  void loadSelectedItems()
}

/** 加载 C 端可用门店，替换支付页中的本地假数据。 */
async function loadShops(): Promise<void> {
  try { shops.value = await getEnabledShops() }
  catch (error) { shops.value = []; console.error('门店列表加载失败', error) }
}

/** 读取微信页面参数并初始化页面布局。 */
onLoad(async (options?: Record<string, string | undefined>) => {
  orderId.value = options?.orderId || null
  selectedCartIds.value = String(options?.cartIds || '')
    .split(',')
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)
  if (orderId.value) {
    await loadExistingOrder()
    return
  }
  await Promise.all([loadSelectedItems(), loadShops()])
})

/** 页面重新显示时关闭残留的发票抽屉，确保进入确认订单页不会被遮罩覆盖。 */
onShow(() => {
  invoiceDrawerVisible.value = false
})

onMounted(() => {
  try {
    const rect = uni.getMenuButtonBoundingClientRect()
    if (rect) {
      menuTop.value = rect.top
      menuHeight.value = rect.height
    }
  } catch (error) {
    console.warn('获取微信胶囊位置失败', error)
  }
  // 待付款订单的支付倒计时：每秒刷新基准时间
  countdownTimer = setInterval(() => { now.value = Date.now() }, 1000)
})

onUnmounted(() => {
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null }
})

/** 切换配送方式，保留两种方式下已经填写的本地内容。 */
function changePickupType(type: PickupType): void {
  pickupType.value = type
}

/** 打开本地地址编辑抽屉。 */
function openAddressEditor(): void {
  Object.assign(addressForm, selectedAddress.value || { name: '', phone: '', detail: '' })
  addressSheetVisible.value = true
}

/** 校验并保存本地地址。 */
function saveAddress(): void {
  if (!addressForm.name.trim() || !addressForm.phone.trim() || !addressForm.detail.trim()) {
    uni.showToast({ title: '请填写完整地址', icon: 'none' })
    return
  }
  if (!/^1\d{10}$/.test(addressForm.phone.trim())) {
    uni.showToast({ title: '手机号格式不正确', icon: 'none' })
    return
  }
  selectedAddress.value = { ...addressForm }
  addressSheetVisible.value = false
}

/** 打开本地门店选择抽屉。 */
function openShopPicker(): void {
  shopSheetVisible.value = true
}

/** 保存本地选择的门店。 */
function chooseShop(shop: EnabledShop): void {
  selectedShop.value = shop
  shopSheetVisible.value = false
}

/** 展开发票区域；需要发票时继续打开填写抽屉。 */
function toggleInvoice(): void {
  invoiceExpanded.value = !invoiceExpanded.value
}

/** 设置是否需要发票，并在开启时进入发票填写流程。 */
function setInvoiceEnabled(enabled: boolean): void {
  invoiceEnabled.value = enabled
  invoiceExpanded.value = true
  if (enabled) {
    invoiceSaved.value = false
    invoiceDrawerVisible.value = true
  } else {
    invoiceSaved.value = false
    invoiceDrawerVisible.value = false
  }
}

/** 切换个人或公司发票类型。 */
function changeInvoiceType(type: InvoiceType): void {
  invoiceType.value = type
  invoiceSaved.value = false
}

/** 校验并保存发票信息。 */
function completeInvoice(): void {
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invoiceForm.email.trim())
  const personalValid = invoiceForm.name.trim() && emailValid
  const companyValid = invoiceForm.companyName.trim() && invoiceForm.taxNumber.trim() && emailValid
  if (!(invoiceType.value === 'personal' ? personalValid : companyValid)) {
    uni.showToast({ title: '请填写完整发票信息', icon: 'none' })
    return
  }
  invoiceSaved.value = true
  invoiceDrawerVisible.value = false
}

/** 关闭发票抽屉，不清除已填写的本地内容。 */
function closeInvoiceDrawer(): void {
  invoiceDrawerVisible.value = false
}

/** 校验结算信息，创建订单后获取支付签名并调起微信支付。 */
async function submitPayment(): Promise<void> {
  if (paying.value) return
  const isExistingOrder = Boolean(orderId.value)
  if (!items.value.length && !isExistingOrder) {
    uni.showToast({ title: '没有可结算的商品', icon: 'none' })
    return
  }
  if (!isExistingOrder && pickupType.value === 0 && !selectedAddress.value) {
    uni.showToast({ title: '请先添加配送地址', icon: 'none' })
    openAddressEditor()
    return
  }
  if (!isExistingOrder && pickupType.value === 1 && !selectedShop.value) {
    uni.showToast({ title: '请选择自提门店', icon: 'none' })
    openShopPicker()
    return
  }
  if (!isExistingOrder && pickupType.value === 1 && (!contactName.value.trim() || !/^1\d{10}$/.test(contactPhone.value.trim()))) {
    uni.showToast({ title: '请填写正确的联系方式', icon: 'none' })
    return
  }
  if (invoiceEnabled.value && !invoiceSaved.value) {
    invoiceDrawerVisible.value = true
    invoiceExpanded.value = true
    return
  }
  paying.value = true
  try {
    let currentOrderId = orderId.value
    if (!currentOrderId) {
      const created = await createOrder({
        cartIds: selectedCartIds.value,
        pickupType: pickupType.value,
        ...(pickupType.value === 0 && selectedAddress.value ? {
          receiverName: selectedAddress.value.name,
          receiverPhone: selectedAddress.value.phone,
          receiverAddress: selectedAddress.value.detail,
        } : {}),
        ...(pickupType.value === 1 && selectedShop.value ? { pickupShopId: selectedShop.value.id, receiverName: contactName.value.trim(), receiverPhone: contactPhone.value.trim() } : {}),
        ...(remark.value.trim() ? { remark: remark.value.trim() } : {}),
      })
      const id = created.orderId ?? created.id
      if (id == null) throw new Error('创建订单未返回订单 ID')
      currentOrderId = String(id)
      orderId.value = currentOrderId
    }
    const prepay = await createPrepay(currentOrderId)
    await requestPayment(prepay)
    let invoiceError: unknown = null
    if (invoiceEnabled.value) {
      try {
        const detail = existingOrder.value?.orderNo ? existingOrder.value : await getOrderDetail(currentOrderId)
        if (!detail.orderNo) throw new Error('订单号获取失败')
        await submitInvoice({
          type: invoiceType.value === 'company' ? 2 : 1,
          ...(invoiceType.value === 'company'
            ? { companyName: invoiceForm.companyName.trim(), taxNo: invoiceForm.taxNumber.trim() }
            : { personalName: invoiceForm.name.trim() }),
          email: invoiceForm.email.trim(),
          orderIds: detail.orderNo,
        })
      } catch (error) { invoiceError = error }
    }
    uni.showToast({ title: invoiceError ? '支付成功，发票申请失败' : '支付成功', icon: invoiceError ? 'none' : 'success' })
    setTimeout(() => { uni.redirectTo({ url: `/pages/orders/detail?orderId=${currentOrderId}` }) }, 500)
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '支付未完成', icon: 'none' })
  } finally { paying.value = false }
}

/** 取消当前待付款订单（二次确认后调用后端取消接口并返回）。 */
async function cancelExistingOrder(): Promise<void> {
  if (!orderId.value || paying.value) return
  const confirmed = await new Promise<boolean>((resolve) => {
    uni.showModal({ title: '提示', content: '确定取消该订单吗？', success: (res) => resolve(res.confirm), fail: () => resolve(false) })
  })
  if (!confirmed) return
  paying.value = true
  try {
    await cancelOrder(orderId.value)
    uni.showToast({ title: '订单已取消', icon: 'success' })
    setTimeout(() => { uni.navigateBack() }, 500)
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '取消订单失败', icon: 'none' })
  } finally { paying.value = false }
}

/** 返回购物车重新选择商品。 */
function backToCart(): void {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack({ delta: 1 })
    return
  }
  uni.switchTab({ url: '/pages/cart/cart' })
}
</script>

<template>
    <view class="pg">
      <view class="nav" :style="navStyle">
        <view class="brand-mark back-button" @click="backToCart" />
        <text class="nav-title">确认订单</text>
      </view>

    <scroll-view
      v-show="canRenderCheckout"
      class="content"
      scroll-y
      :style="{ paddingTop: `${bodyTop}px` }"
    >
      <view class="section delivery-section">
        <text class="section-title">配送方式</text>
        <view class="pickup-options">
          <view class="pickup-option" :class="{ active: pickupType === 0 }" @click="changePickupType(0)">
            <view class="radio" :class="{ active: pickupType === 0 }"><view class="radio-dot" /></view>
            <text>快速配送</text>
          </view>
          <view class="pickup-option" :class="{ active: pickupType === 1 }" @click="changePickupType(1)">
            <view class="radio" :class="{ active: pickupType === 1 }"><view class="radio-dot" /></view>
            <text>门店自提</text>
          </view>
        </view>
      </view>

      <view v-show="pickupType === 0" class="section address-section">
        <view class="section-row" @click="openAddressEditor">
          <view>
            <view class="row-heading">
              <text class="section-title">配送信息</text>
              <text class="action-text">添加新地址</text>
            </view>
            <text v-if="selectedAddress" class="address-value">{{ selectedAddress.name }} {{ selectedAddress.phone }}</text>
            <text v-if="selectedAddress" class="address-detail">{{ selectedAddress.detail }}</text>
            <text v-else class="placeholder-text">请添加您的配送地址</text>
          </view>
          <text class="arrow">›</text>
        </view>
      </view>

      <view v-show="pickupType === 1" class="section pickup-section">
        <view class="section-row" @click="openShopPicker">
          <view>
            <text class="section-title">选择门店</text>
            <text v-if="selectedShop" class="address-value">{{ selectedShop.name }}</text>
            <text v-if="selectedShop" class="address-detail">{{ selectedShop.address }}</text>
            <text v-else class="placeholder-text">请选择门店地址</text>
          </view>
          <text class="arrow">›</text>
        </view>
      </view>

      <view v-show="pickupType === 1" class="section contact-section">
        <text class="section-title">联系方式</text>
        <view class="form-line">
          <text class="form-label">姓名<span class="required">*</span></text>
          <input v-model="contactName" class="form-input" placeholder="请输入" placeholder-class="input-placeholder" />
        </view>
        <view class="form-line">
          <text class="form-label">手机号<span class="required">*</span></text>
          <input v-model="contactPhone" class="form-input" type="number" maxlength="11" placeholder="请输入" placeholder-class="input-placeholder" />
        </view>
      </view>

      <view class="section products-section">
        <text class="section-title">{{ items.length === 1 ? '一件商品' : `${items.length}件商品` }}</text>
        <view v-for="item in items" :key="item.cartId" class="product-row">
          <image v-if="item.productImage" class="product-image" :src="item.productImage" mode="aspectFill" />
          <view v-else class="product-image product-placeholder" />
          <view class="product-info">
            <text class="product-name">{{ item.productName }}</text>
            <text v-if="item.skuName && item.skuName !== '1'" class="product-spec">{{ item.skuName }}</text>
            <view class="product-bottom">
              <text class="quantity">数量：{{ item.quantity }}</text>
              <text class="product-price">¥ {{ formatMoney(productTotal(item)) }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="section amount-section">
        <view class="amount-row"><text>小计</text><text>¥{{ formatMoney(subtotal) }}</text></view>
        <view class="amount-row"><text>配送费</text><text>{{ pickupType === 1 ? '(门店自提) ' : '' }}¥{{ formatMoney(deliveryFee) }}</text></view>
        <view class="amount-row total-row"><text>合计</text><text>¥{{ formatMoney(total) }}</text></view>
      </view>

      <view class="section invoice-section">
        <view class="section-row compact-row" @click="toggleInvoice">
          <text class="section-title">发票信息</text>
          <view class="row-summary"><text>{{ invoiceSummary }}</text><text class="plus">＋</text></view>
        </view>
        <view v-show="invoiceExpanded" class="invoice-options">
          <view class="invoice-option" :class="{ active: !invoiceEnabled }" @click="setInvoiceEnabled(false)">
            <view class="radio" :class="{ active: !invoiceEnabled }"><view class="radio-dot" /></view>
            <text>不需要发票</text>
          </view>
          <view class="invoice-option" :class="{ active: invoiceEnabled }" @click="setInvoiceEnabled(true)">
            <view class="radio" :class="{ active: invoiceEnabled }"><view class="radio-dot" /></view>
            <text>需要发票</text>
          </view>
        </view>
      </view>

      <view class="section remark-section">
        <view class="section-row compact-row" @click="remarkExpanded = !remarkExpanded">
          <text class="section-title">备注</text>
          <view class="row-summary"><text>{{ remarkSummary }}</text><text class="plus">＋</text></view>
        </view>
        <textarea
          v-show="remarkExpanded"
          v-model="remark"
          class="remark-input"
          maxlength="100"
          placeholder="请输入备注"
          placeholder-class="input-placeholder"
        />
      </view>
      <view class="content-bottom-space" />
    </scroll-view>

    <view v-show="loading" class="state-view"><text>加载中...</text></view>
    <view v-show="!loading && loadError" class="state-view">
      <text>订单商品加载失败</text>
      <text class="state-action" @click="reloadCheckout">重新加载</text>
    </view>
    <view v-show="!loading && !loadError && !items.length && !orderId" class="state-view">
      <text>没有可结算的商品</text>
      <text class="state-action" @click="backToCart">返回购物车</text>
    </view>

    <view v-show="canRenderCheckout" class="paybar">
      <view v-if="showCancelOrder" class="cancel-order" @click="cancelExistingOrder"><view class="cancel-icon" /><text>取消</text></view>
      <view class="total-block"><text class="currency">¥</text><text class="total-price">{{ formatMoney(total) }}</text><text v-if="!showCancelOrder" class="count-label">共{{ itemCount }}件</text></view>
      <view class="pay-now" :class="{ disabled: !items.length || paying }" @click="submitPayment">
        <text v-if="showCancelOrder && countdownText" class="countdown">{{ countdownText }}</text>
        <text>{{ paying ? '处理中...' : '立即支付' }}</text>
      </view>
    </view>

    <view v-show="addressSheetVisible" class="mask" @click="addressSheetVisible = false">
      <view class="sheet" @click.stop>
        <view class="sheet-head"><text class="sheet-title">配送地址</text><text class="sheet-close" @click="addressSheetVisible = false">×</text></view>
        <view class="sheet-form-line"><text class="form-label">姓名<span class="required">*</span></text><input v-model="addressForm.name" class="sheet-input" placeholder="请输入" placeholder-class="input-placeholder" /></view>
        <view class="sheet-form-line"><text class="form-label">手机号<span class="required">*</span></text><input v-model="addressForm.phone" class="sheet-input" type="number" maxlength="11" placeholder="请输入" placeholder-class="input-placeholder" /></view>
        <view class="sheet-form-line"><text class="form-label">详细地址<span class="required">*</span></text><input v-model="addressForm.detail" class="sheet-input" placeholder="请输入" placeholder-class="input-placeholder" /></view>
        <view class="sheet-submit" @click="saveAddress">保存地址</view>
      </view>
    </view>

    <view v-show="shopSheetVisible" class="mask" @click="shopSheetVisible = false">
      <view class="sheet shop-sheet" @click.stop>
        <view class="sheet-head"><text class="sheet-title">选择门店</text><text class="sheet-close" @click="shopSheetVisible = false">×</text></view>
        <view v-for="shop in shops" :key="shop.id" class="shop-option" :class="{ selected: selectedShop?.id === shop.id }" @click="chooseShop(shop)">
          <view><text class="shop-name">{{ shop.name }}</text><text class="shop-address">{{ shop.address }}</text></view>
          <text class="shop-distance">{{ shop.phone || '支持到店自提' }}</text>
        </view>
      </view>
    </view>

    <view v-if="invoiceDrawerVisible" class="mask invoice-mask" @tap="closeInvoiceDrawer">
      <view class="sheet invoice-sheet" @tap.stop>
        <view class="sheet-head"><text class="sheet-title">发票信息</text><text class="sheet-close" @tap="closeInvoiceDrawer">×</text></view>
        <view class="invoice-type-row">
          <view class="type-choice" :class="{ active: invoiceType === 'personal' }" @click="changeInvoiceType('personal')"><view class="radio" :class="{ active: invoiceType === 'personal' }"><view class="radio-dot" /></view><text>个人</text></view>
          <view class="type-choice" :class="{ active: invoiceType === 'company' }" @click="changeInvoiceType('company')"><view class="radio" :class="{ active: invoiceType === 'company' }"><view class="radio-dot" /></view><text>公司</text></view>
        </view>
        <view v-show="invoiceType === 'personal'" class="drawer-fields">
          <view class="sheet-form-line"><text class="form-label">姓名<span class="required">*</span></text><input v-model="invoiceForm.name" class="sheet-input" placeholder="请输入" placeholder-class="input-placeholder" /></view>
          <view class="sheet-form-line"><text class="form-label">电子邮箱<span class="required">*</span></text><input v-model="invoiceForm.email" class="sheet-input" type="text" placeholder="请输入" placeholder-class="input-placeholder" /></view>
        </view>
        <view v-show="invoiceType === 'company'" class="drawer-fields">
          <view class="sheet-form-line"><text class="form-label">公司名称<span class="required">*</span></text><input v-model="invoiceForm.companyName" class="sheet-input" placeholder="请输入" placeholder-class="input-placeholder" /></view>
          <view class="sheet-form-line"><text class="form-label">纳税人识别号<span class="required">*</span></text><input v-model="invoiceForm.taxNumber" class="sheet-input" placeholder="请输入" placeholder-class="input-placeholder" /></view>
          <view class="sheet-form-line"><text class="form-label">电子邮箱<span class="required">*</span></text><input v-model="invoiceForm.email" class="sheet-input" type="text" placeholder="请输入" placeholder-class="input-placeholder" /></view>
        </view>
        <view class="sheet-submit" @click="completeInvoice">完成</view>
      </view>
    </view>
  </view>
</template>

<style>
.pg { height: 100vh; background: #fff; color: #222; overflow: hidden; }
.nav { position: fixed; left: 0; right: 0; z-index: 20; display: flex; align-items: center; padding-left: 24rpx; background: #fff; box-sizing: border-box; }
.brand-mark { width: 42rpx; height: 42rpx; background: #222; }
.back-button { flex-shrink: 0; }
.nav-title { margin-left: 22rpx; color: #222; font-size: 30rpx; font-weight: 600; }
.content { height: 100vh; padding: 0 24rpx; box-sizing: border-box; }
.section { padding: 30rpx 0; border-bottom: 1px solid #eee; }
.section-title { color: #252525; font-size: 28rpx; font-weight: 600; }
.delivery-section { padding-top: 24rpx; }
.pickup-options, .invoice-options { display: flex; gap: 24rpx; margin-top: 30rpx; }
.pickup-option, .invoice-option { display: flex; flex: 1; align-items: center; min-height: 72rpx; padding: 0 24rpx; box-sizing: border-box; background: #f7f7f7; color: #555; font-size: 25rpx; }
.pickup-option.active, .invoice-option.active { color: #222; font-weight: 600; }
.radio { width: 34rpx; height: 34rpx; margin-right: 14rpx; border: 2rpx solid #888; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-sizing: border-box; flex-shrink: 0; }
.radio.active { border-color: #222; }
.radio-dot { width: 18rpx; height: 18rpx; border-radius: 50%; background: transparent; }
.radio.active .radio-dot { background: #222; }
.section-row { display: flex; align-items: center; justify-content: space-between; min-height: 86rpx; }
.section-row > view:first-child { flex: 1; min-width: 0; }
.row-heading { display: flex; align-items: center; justify-content: space-between; }
.action-text { color: #222; font-size: 24rpx; font-weight: 600; }
.address-value, .address-detail, .placeholder-text { display: block; margin-top: 14rpx; font-size: 24rpx; }
.address-value { color: #333; }
.address-detail, .placeholder-text { color: #aaa; }
.arrow { padding-left: 20rpx; color: #222; font-size: 48rpx; font-weight: 300; line-height: 1; }
.contact-section { padding-top: 28rpx; }
.form-line, .sheet-form-line { display: flex; align-items: center; min-height: 78rpx; margin-top: 22rpx; padding: 0 28rpx; background: #f7f7f7; box-sizing: border-box; }
.form-label { flex-shrink: 0; color: #333; font-size: 25rpx; white-space: nowrap; }
.required { color: #222; margin-left: 4rpx; }
.form-input { flex: 1; min-width: 0; margin-left: 26rpx; color: #333; font-size: 25rpx; }
.input-placeholder { color: #aaa; }
.products-section { padding-bottom: 26rpx; }
.product-row { display: flex; min-width: 0; margin-top: 28rpx; }
.product-image { width: 216rpx; height: 216rpx; flex-shrink: 0; background: #d9d9d9; }
.product-placeholder { background: #d9d9d9; }
.product-info { display: flex; flex: 1; min-width: 0; flex-direction: column; justify-content: space-between; padding: 4rpx 0 4rpx 26rpx; }
.product-name { color: #222; font-size: 26rpx; font-weight: 600; line-height: 1.45; }
.product-spec { margin-top: 10rpx; color: #999; font-size: 22rpx; }
.product-bottom { display: flex; align-items: baseline; justify-content: space-between; gap: 10rpx; }
.quantity { color: #999; font-size: 22rpx; }
.product-price { color: #222; font-size: 30rpx; font-weight: 700; white-space: nowrap; }
.amount-section { padding: 22rpx 0; }
.amount-row { display: flex; align-items: center; justify-content: space-between; min-height: 58rpx; color: #999; font-size: 24rpx; }
.amount-row.total-row { color: #222; font-size: 26rpx; font-weight: 700; }
.invoice-section, .remark-section { padding: 0; }
.compact-row { min-height: 94rpx; }
.row-summary { display: flex; align-items: center; max-width: 68%; color: #333; font-size: 24rpx; text-align: right; }
.row-summary text:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.plus { margin-left: 16rpx; color: #333; font-size: 32rpx; }
.invoice-options { margin: 0 0 28rpx; }
.remark-input { width: 100%; min-height: 130rpx; margin-bottom: 26rpx; padding: 22rpx; background: #f7f7f7; box-sizing: border-box; color: #333; font-size: 24rpx; }
.content-bottom-space { height: 180rpx; }
.state-view { position: absolute; top: 45%; left: 0; right: 0; display: flex; flex-direction: column; align-items: center; color: #999; font-size: 26rpx; }
.state-action { margin-top: 26rpx; color: #222; text-decoration: underline; }
.paybar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; display: flex; align-items: center; justify-content: space-between; padding: 18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom)); background: #fff; box-shadow: 0 -4rpx 18rpx rgba(0, 0, 0, .08); box-sizing: border-box; }
.total-block { display: flex; align-items: baseline; min-width: 0; }
.currency { color: #222; font-size: 28rpx; font-weight: 700; }
.total-price { margin-left: 4rpx; color: #222; font-size: 34rpx; font-weight: 700; }
.count-label { margin-left: 12rpx; color: #999; font-size: 22rpx; }
.pay-now { display: flex; align-items: center; justify-content: center; gap: 12rpx; width: 420rpx; height: 82rpx; background: #050505; color: #fff; font-size: 28rpx; }
.pay-now.disabled { background: #aaa; }
.cancel-order { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 96rpx; flex-shrink: 0; color: #959595; font-size: 22rpx; }
.cancel-icon { position: relative; width: 40rpx; height: 40rpx; margin-bottom: 6rpx; border: 2rpx solid #c4c4c4; border-radius: 50%; box-sizing: border-box; }
.cancel-icon::before, .cancel-icon::after { content: ''; position: absolute; left: 50%; top: 50%; width: 22rpx; height: 2rpx; background: #999; }
.cancel-icon::before { transform: translate(-50%, -50%) rotate(45deg); }
.cancel-icon::after { transform: translate(-50%, -50%) rotate(-45deg); }
.countdown { font-size: 26rpx; font-weight: 600; }
.mask { position: fixed; inset: 0; z-index: 50; display: flex; align-items: flex-end; background: rgba(0, 0, 0, .68); }
.sheet { width: 100%; max-height: 86vh; padding: 30rpx 28rpx calc(30rpx + env(safe-area-inset-bottom)); background: #fff; box-sizing: border-box; overflow-y: auto; }
.sheet-head { display: flex; align-items: center; justify-content: center; min-height: 54rpx; }
.sheet-title { color: #222; font-size: 30rpx; font-weight: 700; }
.sheet-close { position: absolute; right: 30rpx; color: #888; font-size: 42rpx; font-weight: 300; line-height: 1; }
.sheet-form-line { margin-top: 22rpx; }
.sheet-input { flex: 1; min-width: 0; margin-left: 24rpx; color: #333; font-size: 25rpx; }
.sheet-submit { display: flex; align-items: center; justify-content: center; height: 82rpx; margin-top: 34rpx; background: #050505; color: #fff; font-size: 28rpx; }
.shop-sheet { padding-bottom: calc(36rpx + env(safe-area-inset-bottom)); }
.shop-option { display: flex; align-items: center; justify-content: space-between; padding: 28rpx 0; border-bottom: 1px solid #eee; }
.shop-option.selected { background: #fafafa; }
.shop-name, .shop-address { display: block; }
.shop-name { color: #222; font-size: 27rpx; font-weight: 600; }
.shop-address { margin-top: 10rpx; color: #999; font-size: 23rpx; }
.shop-distance { color: #999; font-size: 22rpx; }
.invoice-mask { align-items: flex-end; }
.invoice-sheet { max-height: 88vh; }
.invoice-type-row { display: flex; gap: 84rpx; margin: 34rpx 0 18rpx; }
.type-choice { display: flex; align-items: center; color: #555; font-size: 26rpx; }
.type-choice.active { color: #222; font-weight: 600; }
.drawer-fields { min-height: 0; }
</style>
