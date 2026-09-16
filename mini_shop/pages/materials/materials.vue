<script setup lang="ts">
/**
 * 商品素材页（海报生成）
 * 列表 = 商品（主图 + 商品名 + 一键生成）；每张商品轮播图各生成一张「轮播图 + 右下角推广码」海报，铺开展示。
 */
import { computed, onMounted, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getProductDetail, getProductList, type ProductCard } from '@/api/product'
import { getPromotionCode } from '@/api/promotion'
import { isLoggedIn } from '@/utils/auth'
import { createThrottle } from '@/utils/interaction'
import ProductMaterialPoster from '@/components/ProductMaterialPoster.vue'
import LoginGuide from '@/components/LoginGuide.vue'
import PageWatermark from '@/components/PageWatermark.vue'

const menuTop = ref(0)
const menuHeight = ref(32)
const keyword = ref('')
const products = ref<ProductCard[]>([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const loadingMore = ref(false)
const loginGuideVisible = ref(false)
const posterVisible = ref(false)
const posterLoading = ref(false)
const posterImages = ref<string[]>([])
const posterCodeUrl = ref('')
const posterName = ref('')
const navigationThrottle = createThrottle(500)
let pageLoadPromise: Promise<void> | null = null

const navStyle = computed(() => ({ top: `${menuTop.value}px`, height: `${menuHeight.value}px` }))
const bodyStyle = computed(() => ({ paddingTop: `${menuTop.value + menuHeight.value + uni.upx2px(20)}px` }))
const hasMore = computed(() => products.value.length < total.value)

/** 拉取商品素材列表；reset=true 用于搜索/首屏。 */
async function loadProducts(reset: boolean): Promise<void> {
  if (loading.value || loadingMore.value) return
  if (!reset && !hasMore.value) return
  const targetPage = reset ? 1 : page.value + 1
  if (reset) loading.value = true; else loadingMore.value = true
  try {
    const result = await getProductList({ keyword: keyword.value.trim() || undefined, page: targetPage, pageSize: 10 })
    products.value = reset ? (result.list || []) : products.value.concat(result.list || [])
    page.value = result.page || targetPage
    total.value = result.total || 0
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '商品素材加载失败', icon: 'none' })
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

function loadMore(): void { void loadProducts(false) }

function onSearch(): void { void loadProducts(true) }

function goBack(): void {
  if (!navigationThrottle()) return
  uni.navigateBack({ delta: 1 })
}

/** 一键生成：取商品轮播图 + 推广码，铺开生成海报。 */
async function generatePoster(product: ProductCard): Promise<void> {
  if (!isLoggedIn()) { loginGuideVisible.value = true; return }
  if (loading.value) return
  posterLoading.value = true
  posterName.value = product.name
  try {
    const [detail, codeUrl] = await Promise.all([
      getProductDetail(String(product.id)),
      getPromotionCode(),
    ])
    const poster = detail.detailPosterUrl
    if (!poster) {
      uni.showToast({ title: '该商品暂无商品海报', icon: 'none' })
      posterLoading.value = false
      return
    }
    posterImages.value = [poster]
    posterCodeUrl.value = codeUrl
    posterVisible.value = true
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '海报生成失败', icon: 'none' })
  } finally {
    posterLoading.value = false
  }
}

onMounted(async () => {
  try {
    const rect = uni.getMenuButtonBoundingClientRect()
    if (rect) { menuTop.value = rect.top; menuHeight.value = rect.height }
  } catch { /* 非微信环境忽略 */ }
  void loadProducts(true)
})

onShow(() => {
  if (pageLoadPromise) return
  pageLoadPromise = loadProducts(true).then(() => { pageLoadPromise = null })
})
</script>

<template>
  <view class="page">
    <view class="nav" :style="navStyle">
      <image class="back-button" src="/static/left_arrow.png" mode="aspectFit" @click="goBack" />
      <text class="nav-title">商品素材</text>
      <view class="nav-spacer" />
    </view>

    <view class="search-bar" :style="{ paddingTop: (menuTop + menuHeight + 12) + 'px' }">
      <view class="search-box">
        <input v-model="keyword" class="search-input" type="text" placeholder="输入商品名称" confirm-type="search" @confirm="onSearch" />
        <view class="search-btn" @click="onSearch">搜索</view>
      </view>
    </view>

    <scroll-view class="page-scroll" scroll-y :style="bodyStyle" @scrolltolower="loadMore">
      <view v-if="loading" class="state">加载中...</view>
      <view v-else-if="!products.length" class="state">暂无商品素材</view>
      <view v-else class="product-list">
        <view v-for="product in products" :key="product.id" class="product-card">
          <image class="product-image" :src="product.mainImage" mode="aspectFill" />
          <view class="product-info">
            <text class="product-name">{{ product.name }}</text>
            <button class="generate-btn" @click="generatePoster(product)">一键生成</button>
          </view>
        </view>
        <view class="more">{{ loadingMore ? '加载中...' : (hasMore ? '上拉加载更多' : '已加载全部') }}</view>
      </view>
      <PageWatermark />
    </scroll-view>

    <ProductMaterialPoster
      v-model="posterVisible"
      :loading="posterLoading"
      :code-url="posterCodeUrl"
      :images="posterImages"
      :product-name="posterName"
    />
    <LoginGuide v-model="loginGuideVisible" />
  </view>
</template>

<style scoped>
.page { position: relative; height: 100vh; overflow: hidden; background: #f5f6f8; color: #172033; font-family: 'PingFang SC', '苹方-简', sans-serif; }
.nav { position: fixed; right: 0; left: 0; z-index: 20; display: flex; align-items: center; padding: 0 32rpx; box-sizing: border-box; background: #f5f6f8; }
.back-button { width: 34rpx; height: 34rpx; flex-shrink: 0; }
.nav-title { position: absolute; left: 50%; color: #111; font-size: 32rpx; font-weight: 600; transform: translateX(-50%); }
.nav-spacer { width: 34rpx; height: 34rpx; }
.search-bar { position: absolute; right: 0; left: 0; z-index: 19; padding-left: 32rpx; padding-right: 32rpx; padding-bottom: 12rpx; box-sizing: border-box; background: #f5f6f8; }
.search-box { display: flex; align-items: center; height: 72rpx; border-radius: 36rpx; background: #fff; padding: 0 8rpx 0 28rpx; }
.search-input { flex: 1; height: 100%; font-size: 26rpx; }
.search-btn { flex-shrink: 0; height: 56rpx; padding: 0 28rpx; border-radius: 28rpx; background: linear-gradient(135deg, #ff6a2b, #ff5a1f); color: #fff; font-size: 24rpx; font-weight: 600; line-height: 56rpx; }
.page-scroll { position: absolute; inset: 0; padding-top: 0; box-sizing: border-box; }
.page-scroll, .page-scroll >>> .uni-scroll-view-content { height: 100%; }
.state { padding: 160rpx 0; color: #98a2b3; font-size: 26rpx; text-align: center; }
.product-list { padding: 116rpx 24rpx 40rpx; }
.product-card { display: flex; align-items: center; gap: 20rpx; margin-bottom: 16rpx; padding: 20rpx; border-radius: 20rpx; background: #fff; }
.product-image { width: 140rpx; height: 140rpx; border-radius: 12rpx; flex-shrink: 0; }
.product-info { flex: 1; display: flex; align-items: center; justify-content: space-between; gap: 12rpx; }
.product-name { flex: 1; min-width: 0; color: #172033; font-size: 28rpx; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.generate-btn { flex-shrink: 0; height: 60rpx; padding: 0 28rpx; margin: 0; border: 0; border-radius: 30rpx; background: linear-gradient(135deg, #ff6a2b, #ff5a1f); color: #fff; font-size: 24rpx; font-weight: 600; line-height: 60rpx; }
.generate-btn::after { border: 0; }
.more { padding: 20rpx 0; color: #98a2b3; font-size: 24rpx; text-align: center; }
</style>
