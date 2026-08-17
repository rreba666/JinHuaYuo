<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { getHomepageData } from '@/api/homepage'
import type { HomepageMediaItem, HomepageProduct } from '@/api/homepage'
import { bindStoredPromotionIfLoggedIn, buildPromotionSharePath, capturePromotionContext } from '@/utils/promotion'

const brandName = ref('今华有·臻养品质人生')
const products = ref<HomepageProduct[]>([])
const homepageMedia = ref<HomepageMediaItem | null>(null)
const loading = ref(true)
const welfareTab = ref(0)

/** 微信胶囊按钮位置（px），用于悬浮导航栏精确定位 */
const menuTop = ref(0)
const menuLeft = ref(0)
const menuHeight = ref(32)

/** 悬浮导航栏样式：top 跟随胶囊、高度一致，覆盖在轮播图上方 */
const navBarStyle = computed(() => ({
  top: menuTop.value + 'px',
  height: menuHeight.value + 'px',
}))

/** 搜索框右侧间距：延伸到胶囊按钮左侧，保留 12px 间距 */
const navSearchStyle = computed(() => {
  if (!menuLeft.value) return {}
  const winWidth = systemWidth.value || 375
  const rightGap = winWidth - menuLeft.value + 12
  return { marginRight: rightGap + 'px' }
})

/** 系统窗口宽度 */
const systemWidth = ref(0)

const heroImages = computed(() => homepageMedia.value?.imageUrl || [])
const heroVideo = computed(() => homepageMedia.value?.videoUrl?.[0] || '')
const bottomImages = computed(() => homepageMedia.value?.bottomImageUrl || [])

async function loadHomepage(): Promise<void> {
  try {
    const data = await getHomepageData()
    const enabled = (data.mediaList || []).find((item: HomepageMediaItem) => item.isEnabled === 1)
    homepageMedia.value = enabled || null
    if (enabled?.description) brandName.value = enabled.description
    products.value = (data.recommendedProducts || []).slice(0, 6)
  } catch { /* 接口失败使用默认展示 */ }
  finally { loading.value = false }
}

function goProduct(id: string): void { uni.navigateTo({ url: `/pages/product/detail?id=${id}` }) }
function goSearch(): void { uni.navigateTo({ url: '/pages/search/index' }) }
function goCategory(): void { uni.switchTab({ url: '/pages/category/category' }) }
function goHero(index: number): void {
  const target = homepageMedia.value?.linkTarget?.[index]
  if (target) uni.navigateTo({ url: target })
}

/** 点击“更多福利”图片，按后台配置的 AppID 跳转到目标小程序。 */
function handleWelfareImageTap(index: number): void {
  if (index !== 0) return
  const appId = homepageMedia.value?.bottomLinkTarget?.[0]?.trim() || ''
  if (!appId) {
    uni.showToast({ title: '暂未配置跳转小程序', icon: 'none' })
    return
  }
  // @ts-ignore 微信小程序跨小程序跳转 API
  uni.navigateToMiniProgram({
    appId,
    fail: (error: { errMsg?: string }) => {
      const detail = error?.errMsg?.replace('navigateToMiniProgram:', '').trim() || '跳转失败'
      if (detail === 'cancel') return
      uni.showToast({ title: `跳转失败：${detail}`, icon: 'none' })
    },
  })
}

/** 记录首页分享或扫码带入的推广者身份，并为已登录用户尝试补绑定。 */
onLoad((options) => {
  capturePromotionContext(options as Record<string, unknown>)
  void bindStoredPromotionIfLoggedIn()
})

/** 首页原生转发携带当前推广者身份，让接收方进入首页后可继续登录绑定。 */
onShareAppMessage(() => ({
  title: brandName.value || '今华有商城',
  path: buildPromotionSharePath('/pages/index/index'),
}))

onMounted(() => {
  try {
    const sys = uni.getSystemInfoSync()
    systemWidth.value = sys.windowWidth || 0
  } catch { /* 非微信环境忽略 */ }
  try {
    const rect = uni.getMenuButtonBoundingClientRect()
    if (rect) {
      menuTop.value = rect.top
      menuLeft.value = rect.left
      menuHeight.value = rect.height
    }
  } catch { /* 非微信环境忽略 */ }
  // 始终加载数据，登录态由 API 服务器校验，失败时自动兜底
  loadHomepage()
})
</script>

<template>
  <view class="page">

    <!-- ====== 首屏轮播（从页面顶部开始） ====== -->
    <swiper v-if="heroImages.length" class="hero-swiper" circular autoplay interval="4500" duration="450">
      <swiper-item v-for="(image, index) in heroImages" :key="image">
        <image class="hero-image" :src="image" mode="aspectFill" @click="goHero(index)" />
      </swiper-item>
    </swiper>
    <video v-else-if="heroVideo" class="hero-video" :src="heroVideo" :poster="homepageMedia?.coverUrl?.[0]" autoplay loop muted />
    <!-- 无轮播/视频时灰色占位 -->
    <view v-else class="hero-placeholder" />

    <!-- ====== 悬浮导航栏（覆盖在轮播图上方，与胶囊按钮同行） ====== -->
    <view class="nav-bar" :style="navBarStyle">
      <image class="nav-logo-img" src="/static/logo.png" mode="aspectFit" />
      <view class="nav-search" :style="navSearchStyle" @click="goSearch"><text class="nav-search-text">搜索商品</text></view>
    </view>

    <!-- ====== Logo 小图 ====== -->
    <view class="logo-row">
      <view class="logo-mark" />
    </view>

    <!-- ====== 品牌文案 ====== -->
    <text class="brand-title">{{ brandName }}</text>
    <view class="brand-slogan">
      <text>JINHUAYOU</text><text>·</text><text>NURTURE A REFINED LIFE</text>
    </view>

    <!-- ====== 商品卡片（图片完整展示 + 文字在下方） ====== -->
    <view class="cards-wrap" v-if="products.length">
      <view v-for="(item, index) in products" :key="item.id || index" class="product-card" @click="goProduct(item.id)">
        <image v-if="item.mainImage" class="card-img" :src="item.mainImage" mode="widthFix" />
        <view v-else class="card-img-ph" />
        <view class="card-text">
          <text class="card-title">{{ item.name }}</text>
          <text class="card-desc">{{ item.descriptionTitle || '' }}</text>
          <view class="card-bar">
            <view class="price-group">
              <text class="price-yuan">¥</text>
              <text class="price-num">{{ item.price || 2999 }}</text>
            </view>
            <view class="buy-btn"><text class="buy-text">即刻购买</text></view>
          </view>
        </view>
      </view>
    </view>

    <view class="cards-wrap" v-if="!loading && !products.length">
      <view class="product-card" v-for="i in 2" :key="'ph-'+i">
        <view class="card-img-ph" />
        <view class="card-text">
          <text class="card-title">商品推荐</text>
          <text class="card-desc">敬请期待</text>
          <view class="card-bar">
            <view class="price-group">
              <text class="price-yuan">¥</text>
              <text class="price-num">2999</text>
            </view>
            <view class="buy-btn"><text class="buy-text">即刻购买</text></view>
          </view>
        </view>
      </view>
    </view>

    <view class="loading-row" v-if="loading"><text class="loading-text">加载中...</text></view>

    <!-- ====== 福利与资讯（背景图 + 内容叠加） ====== -->
    <view class="welfare">
      <image class="welfare-bg" src="/static/bg/2-1.png" mode="widthFix" />
      <view class="welfare-content">
        <text class="welfare-title">福利与资讯</text>
        <view class="welfare-tabs">
          <view class="w-tab" :class="{ active: welfareTab === 0 }" @click="welfareTab = 0"><text>更多福利</text></view>
        <view class="w-tab" :class="{ active: welfareTab === 1 }" @click="welfareTab = 1"><text>关注金华有</text></view>
        </view>
        <image v-if="bottomImages[welfareTab]" class="welfare-img" :src="bottomImages[welfareTab]" mode="aspectFill" @click="handleWelfareImageTap(welfareTab)" />
        <view v-else class="welfare-placeholder" />
        <text class="welfare-logo">今华有</text>
      </view>
    </view>

  </view>
</template>

<style>
.page { display: flex; flex-direction: column; align-items: center; min-height: 100vh; background: #fff; }

/* ===== 悬浮导航栏（fixed 覆盖轮播图上方） ===== */
.nav-bar { position: fixed; left: 0; right: 0; display: flex; align-items: center; padding-left: 24rpx; z-index: 100; box-sizing: border-box; }
.nav-logo-img { width: 102rpx; height: 54rpx; flex-shrink: 0; }
.nav-search { flex: 1; height: 68rpx; margin-left: 16rpx; background: rgba(255,255,255,.58); border-radius: 34rpx; display: flex; align-items: center; padding: 0 24rpx; }
.nav-search-text { color: #999; font-size: 26rpx; }

/* ===== 首屏轮播 ===== */
.hero-swiper { width: 100%; height: 720rpx; margin-top: 0; }
.hero-image { width: 100%; height: 100%; }
.hero-video { width: 100%; height: 720rpx; margin-top: 0; }
.hero-placeholder { width: 100%; height: 720rpx; background: #d8d8d8; }

/* ===== Logo 小图 ===== */
.logo-row { width: 100%; padding: 102rpx 0 0 26rpx; margin-top: -120rpx; }
.logo-mark { width: 102rpx; height: 54rpx; background: rgba(0,0,0,.08); border-radius: 6rpx; }

/* ===== 品牌文案 ===== */
.brand-title { color: #232423; font-size: 40rpx; letter-spacing: 13rpx; text-align: center; margin: 48rpx 110rpx 0 144rpx; line-height: 56rpx; }
.brand-slogan { display: flex; justify-content: center; color: #bebebe; font-size: 28rpx; margin-top: 4rpx; gap: 4rpx; }

/* ===== 商品卡片（图片 + 下方文字样式） ===== */
.cards-wrap { display: flex; flex-direction: column; align-items: center; gap: 20rpx; margin-top: 60rpx; padding: 0 40rpx; width: 100%; }
.product-card { width: 100%; border-radius: 40rpx 40rpx 0 0; overflow: hidden; position: relative; }
/* 图片撑满整卡 */
.card-img { width: 100%; display: block; }
.card-img-ph { width: 100%; height: 360rpx; background: rgba(0,0,0,.06); }

/* 文字叠加在图片底部 */
.card-text { position: absolute; left: 0; right: 0; bottom: 20rpx; display: flex; flex-direction: column; align-items: center; padding: 0 40rpx; }
.card-title { color: #0a0a0a; font-size: 40rpx; font-weight: 700; letter-spacing: 4rpx; text-align: center; }
.card-desc { color: #4f4f4f; font-size: 24rpx; letter-spacing: 2rpx; margin-top: 4rpx; text-align: center; }

.card-bar { display: flex; align-items: center; justify-content: center; gap: 30rpx; padding: 20rpx 0 0; }
.price-group { display: flex; align-items: baseline; gap: 6rpx; }
.price-yuan { color: #0a0a0a; font-size: 22rpx; font-weight: 300; }
.price-num { color: #0a0a0a; font-size: 40rpx; font-weight: 700; letter-spacing: 2rpx; }
.buy-btn { background: #000; padding: 4rpx 14rpx 2rpx 16rpx; margin-left: 8rpx; border-radius: 4rpx; }
.buy-text { color: #fff; font-size: 22rpx; font-weight: 500; letter-spacing: 2rpx; }

.loading-row { padding: 200rpx 0; text-align: center; }
.loading-text { color: #999; font-size: 28rpx; }

/* ===== 福利与资讯（背景图 + 内容叠加） ===== */
.welfare { position: relative; width: 100%; margin-top: 42rpx; }
.welfare-bg { width: 100%; display: block; }
.welfare-content { position: absolute; top: 0; left: 0; right: 0; display: flex; flex-direction: column; align-items: center; padding: 54rpx 90rpx 56rpx 94rpx; }
/* 标题 19px PingFangSC-Regular #232423 */
.welfare-title { color: #232423; font-size: 38rpx; }
/* Tab 容器 radius 22px, bg rgba(255,255,255,0.48) */
.welfare-tabs { display: flex; width: 602rpx; margin-top: 44rpx; background: rgba(255,255,255,.48); border-radius: 44rpx; }
/* 14px, 未选中 #999，选中 #000 白底 */
.w-tab { flex: 1; text-align: center; padding: 18rpx 0; color: #999; font-size: 28rpx; border-radius: 44rpx; }
.w-tab.active { background: #fff; color: #000; font-weight: 500; }
/* 福利图区 301×214px, radius 5px */
.welfare-img { width: 602rpx; height: 428rpx; margin-top: 44rpx; border-radius: 10rpx; }
.welfare-placeholder { width: 602rpx; height: 428rpx; margin-top: 44rpx; background: #a9a9a9; border-radius: 10rpx; }
/* 底部 logo 19px #232423, mt 31px */
.welfare-logo { color: #232423; font-size: 38rpx; margin-top: 62rpx; }
</style>
