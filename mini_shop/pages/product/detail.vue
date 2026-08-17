<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { addToCart } from '@/api/cart'
import { favoriteProduct, unfavoriteProduct } from '@/api/favorite'
import { getUserProfile, type UserProfile } from '@/api/user'
import { getProductDetail, type ProductDetail } from '@/api/product'
import { isRegisteredUser } from '@/utils/auth'
import { bindStoredPromotionIfLoggedIn, buildPromotionSharePath, capturePromotionContext } from '@/utils/promotion'

const menuTop = ref(0)
const menuHeight = ref(32)
const user = ref<UserProfile | null>(null)
const product = ref<ProductDetail | null>(null)
const loading = ref(true)
const errorMessage = ref('')
const actionLoading = ref(false)
/** 当前商品是否已收藏（进页从详情 favorite 字段初始化）。 */
const favorite = ref(false)
/** 收藏操作进行中，防止连点重复请求。 */
const favoriteLoading = ref(false)

const navStyle = computed(() => ({ top: `${menuTop.value}px`, height: `${menuHeight.value}px` }))
const bodyTop = computed(() => menuTop.value + menuHeight.value + 10)

/** 合并主图和轮播图，去重后作为详情页顶部轮播数据。 */
const galleryImages = computed(() => {
  if (!product.value) return []
  return Array.from(new Set((product.value.images || []).filter(Boolean)))
})

/** 没有轮播图时使用商品主图作为静态封面，不把主图混入轮播序列。 */
const coverImage = computed(() => product.value?.mainImage || galleryImages.value[0] || '')

/** 默认选择第一个可用 SKU，详情页暂按该 SKU 进行加购和立即支付。 */
const selectedSku = computed(() => product.value?.skuList.find((sku) => sku.enabled !== 0) || product.value?.skuList[0])

/** 展示当前默认 SKU 价格，没有 SKU 时回退到商品最低价。 */
const displayPrice = computed(() => Number(selectedSku.value?.price ?? product.value?.minPrice ?? 0))

/** 展示推广资金，整数金额不显示多余的小数位。 */
const promotionFundText = computed(() => formatAmount(product.value?.promotionFund || 0))

/** 仅在后端明确启用推广资金且金额有效时展示推广区域。 */
const promotionVisible = computed(() => {
  const enabled = product.value?.promotionEnabled
  return isRegisteredUser(user.value?.identity)
    && (enabled === 1 || enabled === '1' || enabled === true)
    && Number(product.value?.promotionFund || 0) > 0
})

/** 将金额格式化为设计稿使用的紧凑形式。 */
function formatAmount(value: number): string {
  return Number(value || 0).toFixed(2).replace(/\.00$/, '')
}

/** 读取页面参数并加载商品详情。 */
onLoad(async (options) => {
  capturePromotionContext(options as Record<string, unknown>)
  void bindStoredPromotionIfLoggedIn()
  if (!options?.id) {
    errorMessage.value = '商品参数缺失'
    loading.value = false
    return
  }
  try { user.value = await getUserProfile() } catch { user.value = null }
  try {
    product.value = await getProductDetail(String(options.id))
    favorite.value = Boolean(product.value.favorite)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '商品详情加载失败'
  } finally {
    loading.value = false
  }
})

/** 商品详情原生转发保留商品 ID，并附带当前推广者身份。 */
onShareAppMessage(() => {
  const productId = product.value?.id
  const path = productId ? `/pages/product/detail?id=${encodeURIComponent(String(productId))}` : '/pages/index/index'
  return { title: product.value?.name || '商品详情', path: buildPromotionSharePath(path) }
})

/** 返回上一级页面，没有历史页面时回到首页。 */
function goBack(): void {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack({ delta: 1 })
    return
  }
  uni.switchTab({ url: '/pages/index/index' })
}

/** 返回购物车 TabBar 页面。 */
function goCart(): void {
  uni.switchTab({ url: '/pages/cart/cart' })
}

/** 切换收藏状态：已收藏→取消，未收藏→收藏。 */
async function toggleFavorite(): Promise<void> {
  if (!product.value || favoriteLoading.value) return
  favoriteLoading.value = true
  try {
    if (favorite.value) {
      await unfavoriteProduct(product.value.id)
      favorite.value = false
    } else {
      await favoriteProduct(product.value.id)
      favorite.value = true
    }
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '操作失败', icon: 'none' })
  } finally {
    favoriteLoading.value = false
  }
}

/** 将当前商品默认 SKU 加入购物车。 */
async function addProductToCart(): Promise<void> {
  if (!product.value || actionLoading.value) return
  actionLoading.value = true
  try {
    const skuId = selectedSku.value?.id
    await addToCart({ productId: Number(product.value.id), ...(skuId ? { skuId: Number(skuId) } : {}), quantity: 1 })
    uni.showToast({ title: '已加入购物车', icon: 'success' })
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '加入购物车失败', icon: 'none' })
  } finally {
    actionLoading.value = false
  }
}

/** 立即购买：静默加入购物车后跳转确认订单页，由支付页用购物车结算（复用已验证的结算流程）。 */
async function buyNow(): Promise<void> {
  if (!product.value || actionLoading.value) return
  const skuId = selectedSku.value?.id
  if (!skuId) {
    uni.showToast({ title: '暂无可购买规格', icon: 'none' })
    return
  }
  actionLoading.value = true
  try {
    // 静默加购物车，让「立即支付」走购物车结算，避免直接下单缺收货地址等问题
    await addToCart({ productId: Number(product.value.id), skuId: Number(skuId), quantity: 1 })
    uni.navigateTo({ url: `/pages/payment/payment?productId=${product.value.id}&skuId=${skuId}&quantity=1` })
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '立即支付失败', icon: 'none' })
  } finally {
    actionLoading.value = false
  }
}

/** 获取胶囊按钮位置，让自定义返回按钮与系统导航区域对齐。 */
onMounted(() => {
  try {
    const rect = uni.getMenuButtonBoundingClientRect()
    if (rect) {
      menuTop.value = rect.top
      menuHeight.value = rect.height
    }
  } catch {
    // 非微信环境没有胶囊按钮，使用默认导航尺寸。
  }
})
</script>

<template>
  <view class="detail-page">
    <view class="nav" :style="navStyle">
      <view class="back-button" @click="goBack" />
    </view>

    <scroll-view class="detail-scroll" scroll-y :style="{ paddingTop: `${bodyTop}px` }">
      <view v-show="loading" class="state">加载中...</view>
      <view v-show="!loading && errorMessage" class="state error">{{ errorMessage }}</view>

      <view v-show="!loading && !errorMessage && product" class="product-body">
        <swiper v-if="galleryImages.length" class="gallery" circular indicator-dots>
          <swiper-item v-for="image in galleryImages" :key="image"><image class="gallery-image" :src="image" mode="aspectFill" /></swiper-item>
        </swiper>
        <image v-else class="gallery gallery-image single" :src="coverImage" mode="aspectFill" />

        <view class="summary">
          <text class="price">¥{{ formatAmount(displayPrice) }}</text>
          <view class="title-row">
            <text class="name">{{ product?.name }}</text>
            <view class="title-icons">
              <image class="title-icon" :src="favorite ? '/static/ProductDetails/已收藏_slices/已收藏.png' : '/static/ProductDetails/收藏_slices/收藏.png'" mode="aspectFit" @click="toggleFavorite" />
              <image class="title-icon" src="/static/ProductDetails/分享_slices/分享.png" mode="aspectFit" />
            </view>
          </view>
          <text class="description">{{ product?.description || product?.descriptionTitle || '' }}</text>

          <view v-show="promotionVisible" class="promotion-row">
            <text class="promotion-label">分享本商品成功可得</text>
            <text class="promotion-value">{{ promotionFundText }}</text>
            <text class="promotion-label">推广金</text>
            <image class="promotion-arrow" src="/static/ProductDetails/右备份_slices/右备份.png" mode="aspectFit" />
          </view>

          <view class="tag-row">
            <view class="tag"><image class="tag-icon" src="/static/ProductDetails/包邮_slices/包邮.png" mode="aspectFit" /><text>包邮</text></view>
            <view class="tag"><image class="tag-icon" src="/static/ProductDetails/七天无理由_slices/七天无理由.png" mode="aspectFit" /><text>七天无理由</text></view>
          </view>
        </view>

        <view class="detail-heading"><text>产品详情</text></view>
        <view class="detail-media">
          <image v-for="image in product?.detailImages || []" :key="image" class="product-detail-image" :src="image" mode="widthFix" />
        </view>
      </view>
    </scroll-view>

    <view v-show="!loading && !errorMessage && product" class="product-detail-actions">
      <view class="cart-action" @click="goCart"><image class="cart-icon" src="/static/ProductDetails/购物车_slices/购物车.png" mode="aspectFit" /><text>购物车</text></view>
      <view class="action-button add-button" @click="addProductToCart">加入购物车</view>
      <view class="action-button buy-button" @click="buyNow">立即支付</view>
    </view>
  </view>
</template>

<style>
.detail-page { height: 100vh; overflow: hidden; background: #fff; color: #222; }
.nav { position: fixed; left: 0; right: 0; z-index: 30; display: flex; align-items: center; padding-left: 20rpx; background: #fff; box-sizing: border-box; }
.back-button { width: 40rpx; height: 40rpx; background: #222; }
.detail-scroll { width: 100%; height: 100vh; padding-bottom: 140rpx; box-sizing: border-box; }
.product-body { background: #fff; }
.gallery { width: 100%; height: 100vw; background: #d7d7d7; }
.gallery-empty { display: block; }
.gallery-image { width: 100%; height: 100%; }
.summary { padding: 22rpx 20rpx 0; background: #fff; }
.price { display: block; color: #d40000; font-size: 40rpx; font-weight: 700; line-height: 1.2; }
.title-row { display: flex; align-items: flex-start; justify-content: space-between; margin-top: 22rpx; gap: 18rpx; }
.name { flex: 1; min-width: 0; color: #222; font-size: 32rpx; font-weight: 600; line-height: 1.35; }
.title-icons { display: flex; flex-shrink: 0; align-items: center; gap: 36rpx; padding-top: 4rpx; }
.title-icon { width: 40rpx; height: 40rpx; flex-shrink: 0; }
.description { display: block; margin-top: 16rpx; color: #999; font-size: 24rpx; line-height: 1.45; }
.promotion-row { display: flex; align-items: center; min-height: 74rpx; margin-top: 24rpx; padding: 0 18rpx; background: #fff0e6; box-sizing: border-box; }
.promotion-label { color: #444; font-size: 23rpx; white-space: nowrap; }
.promotion-value { margin: 0 10rpx; color: #df1919; font-size: 34rpx; font-weight: 700; line-height: 1; }
.promotion-arrow { width: 22rpx; height: 26rpx; margin-left: auto; flex-shrink: 0; }
.tag-row { display: flex; align-items: center; gap: 32rpx; padding: 24rpx 0 28rpx; border-bottom: 1px solid #eee; }
.tag { display: flex; align-items: center; color: #555; font-size: 23rpx; }
.tag-icon { width: 36rpx; height: 36rpx; margin-right: 12rpx; flex-shrink: 0; }
.detail-heading { display: flex; align-items: center; justify-content: center; height: 116rpx; color: #555; background: #fff; font-size: 25rpx; }
.detail-media { min-height: 520rpx; background: #d6d6d6; }
.product-detail-image { display: block; width: 100%; height: auto; }
.product-detail-actions { position: fixed; right: 0; bottom: 0; left: 0; z-index: 40; display: flex; align-items: center; gap: 12rpx; padding: 12rpx 20rpx calc(12rpx + env(safe-area-inset-bottom)); background: #fff; box-sizing: border-box; }
.cart-action { display: flex; width: 124rpx; flex-shrink: 0; flex-direction: column; align-items: center; justify-content: center; color: #333; font-size: 22rpx; }
.cart-icon { width: 64rpx; height: 64rpx; margin-bottom: 2rpx; flex-shrink: 0; }
.action-button { display: flex; align-items: center; justify-content: center; height: 82rpx; font-size: 28rpx; box-sizing: border-box; }
.add-button { flex: 1; border: 2rpx solid #222; color: #222; background: #fff; }
.buy-button { flex: 1; color: #fff; background: #050505; }
.state { padding: 180rpx 32rpx; color: #8a96a8; text-align: center; }
.error { color: #d94d3f; }
</style>
