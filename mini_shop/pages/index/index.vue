<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { onLoad, onPageScroll, onShareAppMessage, onShow } from '@dcloudio/uni-app'
import { getHomepageData } from '@/api/homepage'
import type { HomepageMediaItem, HomepageProduct } from '@/api/homepage'
import { bindStoredPromotionIfLoggedIn, buildPromotionSharePath, capturePromotionContext } from '@/utils/promotion'
import { createThrottle } from '@/utils/interaction'
import RequestState from '@/components/RequestState.vue'

const brandName = ref('今华有·臻选品质人生')
const products = ref<HomepageProduct[]>([])
const homepageMedia = ref<HomepageMediaItem | null>(null)
const loading = ref(true)
const loadError = ref('')
let homepageLoadPromise: Promise<void> | null = null
const welfareTab = ref(0)
const navigationThrottle = createThrottle(500)
/** 「更多福利」落地中转弹窗：因目标小程序非同一主体，微信禁止直接跨小程序跳转，改为展示引导+小程序码让用户扫码进入。 */
const welfareLandingVisible = ref(false)
/** 目标小程序 AppID（由后台 bottomLinkTarget 配置，用于展示/预留）。 */
const welfareAppId = ref('')
/** 目标小程序码海报图片 URL（暂未提供，填入后即展示；为空显示「小程序码待配置」占位）。 */
const welfareQrImage = ref('')
/** 单独的纯小程序码图（方形、仅码），用于放大后长按识别；未配置为空时回退到整张海报。 */
const welfareCodeImage = ref('')
/** 保存海报到相册进行中。 */
const welfareSaving = ref(false)

/** 微信胶囊按钮位置（px），用于悬浮导航栏精确定位 */
const menuTop = ref(0)
const menuLeft = ref(0)
const menuHeight = ref(32)
const navScrolled = ref(false)

/** 悬浮导航栏样式：top 跟随胶囊、高度一致，覆盖在轮播图上方 */
const navBarStyle = computed(() => ({
  top: menuTop.value + 'px',
  height: menuHeight.value + 'px',
}))

/** 顶部毛玻璃状态，搜索框和顶部背景层共用，避免视觉断层。 */
const navGlassStyle = computed(() => ({
  background: navScrolled.value ? 'rgba(255,255,255,.82)' : 'transparent',
  backdropFilter: navScrolled.value ? 'blur(14px)' : 'none',
  WebkitBackdropFilter: navScrolled.value ? 'blur(14px)' : 'none',
}))

/** 搜索框高度（68rpx）换算为 px，确保毛玻璃层完整包裹搜索框。 */
const navSearchHeightPx = computed(() => Math.max(menuHeight.value, 68 * (systemWidth.value || 375) / 750))

/** 覆盖状态栏到胶囊底部，避免轮播图切换造成顶部背景色跳变。 */
const navBackdropStyle = computed(() => ({
  height: `${menuTop.value + navSearchHeightPx.value}px`,
  ...navGlassStyle.value,
  boxShadow: navScrolled.value ? '0 1rpx 10rpx rgba(15,23,42,.08)' : 'none',
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
const heroHeightStyle = '960rpx'

function isRecommendTextEnabled(value: HomepageProduct['recommendTextEnabled']): boolean {
  return value === 1 || value === '1' || value === true
}

async function loadHomepage(): Promise<void> {
  loadError.value = ''
  try {
    const data = await getHomepageData()
    const enabled = (data.mediaList || []).find((item: HomepageMediaItem) => item.isEnabled === 1)
    homepageMedia.value = enabled || null
    if (enabled?.description) brandName.value = enabled.description
    products.value = (data.recommendedProducts || []).slice(0, 6)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '首页加载失败，请重试'
  }
  finally { loading.value = false }
}

/** 复用首页首屏请求，避免页面生命周期重叠时重复加载。 */
function refreshHomepage(): Promise<void> {
  if (homepageLoadPromise) return homepageLoadPromise
  const pending = loadHomepage()
  homepageLoadPromise = pending
  pending.then(
    () => { if (homepageLoadPromise === pending) homepageLoadPromise = null },
    () => { if (homepageLoadPromise === pending) homepageLoadPromise = null },
  )
  return pending
}

function goProduct(id: string): void {
  if (!navigationThrottle()) return
  uni.navigateTo({ url: `/subpkg-goods/detail/detail?id=${id}` })
}
function goSearch(): void {
  if (!navigationThrottle()) return
  uni.navigateTo({ url: '/subpkg-goods/search/index' })
}
function goCategory(): void {
  if (!navigationThrottle()) return
  uni.switchTab({ url: '/pages/category/category' })
}
function goHero(index: number): void {
  if (!navigationThrottle()) return
  const target = homepageMedia.value?.linkTarget?.[index]
  if (target) uni.navigateTo({ url: target })
}

/** 点击“更多福利”图片：因目标小程序非同一主体，微信禁止直接跨小程序跳转，改为打开落地中转弹窗（展示小程序码海报让用户长按识别）。 */
function handleWelfareImageTap(index: number): void {
  if (index !== 0) return
  if (!navigationThrottle()) return
  const appId = homepageMedia.value?.bottomLinkTarget?.[0]?.trim() || ''
  const qrUrl = homepageMedia.value?.welfareMiniProgramQrUrl?.trim() || ''
  const codeUrl = homepageMedia.value?.welfareMiniProgramQrCodeUrl?.trim() || ''
  welfareAppId.value = appId
  welfareQrImage.value = qrUrl
  welfareCodeImage.value = codeUrl
  // 海报图和纯小程序码图均未配置时给出提示，避免空弹窗。
  if (!qrUrl && !codeUrl) {
    uni.showToast({ title: '福利海报暂未配置', icon: 'none' })
    return
  }
  welfareLandingVisible.value = true
}

/** 关闭「更多福利」落地中转弹窗。 */
function closeWelfareLanding(): void {
  welfareLandingVisible.value = false
}

/** 检测并触发微信隐私授权（保存到相册属隐私接口）；部分环境无该 API 时直接放行。 */
function ensurePrivacyAuthorize(callback: () => void): void {
  const authorize = (uni as unknown as { requirePrivacyAuthorize?: (opts: { success: () => void; fail: () => void }) => void }).requirePrivacyAuthorize
    || (wx as unknown as { requirePrivacyAuthorize?: (opts: { success: () => void; fail: () => void }) => void }).requirePrivacyAuthorize
  if (authorize) {
    authorize({ success: () => callback(), fail: () => callback() })
  } else {
    callback()
  }
}

/** 保存小程序码海报到相册，引导用户用微信「扫一扫-相册」识别进入目标小程序。 */
function saveWelfarePoster(): void {
  if (welfareSaving.value || !welfareQrImage.value) return
  ensurePrivacyAuthorize(() => doSaveWelfarePoster())
}

/** 实际执行保存：下载网络图片到本地临时路径 → 存相册。 */
function doSaveWelfarePoster(): void {
  welfareSaving.value = true
  uni.showLoading({ title: '保存中...' })
  // 相册保存只接受本地临时文件，网络 URL 需先下载到本地再保存。
  uni.downloadFile({
    url: welfareQrImage.value,
    success: (download) => {
      if (download.statusCode !== 200 || !download.tempFilePath) {
        uni.hideLoading()
        uni.showToast({ title: `保存失败：${download.statusCode}`, icon: 'none', duration: 3000 })
        welfareSaving.value = false
        return
      }
      uni.saveImageToPhotosAlbum({
        filePath: download.tempFilePath,
        success: () => {
          uni.hideLoading()
          uni.showModal({
            title: '已保存到相册',
            content: '已保存到相册。在微信中长按相册里的这张海报，即可识别小程序码进入福利小程序。',
            showCancel: false,
            confirmText: '我知道了',
          })
          welfareSaving.value = false
        },
        fail: (error) => {
          uni.hideLoading()
          welfareSaving.value = false
          uni.showToast({ title: `保存失败：${error?.errMsg || '未知'}`, icon: 'none', duration: 3000 })
        },
      })
    },
    fail: (error) => {
      uni.hideLoading()
      uni.showToast({ title: `下载失败：${error?.errMsg || '未知'}`, icon: 'none', duration: 3000 })
      welfareSaving.value = false
    },
  })
}

/** 记录首页分享或扫码带入的推广者身份，并为已登录用户尝试补绑定。 */
onLoad((options) => {
  capturePromotionContext(options as Record<string, unknown>)
  void bindStoredPromotionIfLoggedIn()
})

/** 首页胶囊转发不绑定推广关系（推广绑定为下单后功能）。 */
onShareAppMessage(() => ({
  title: brandName.value || '今华有商城',
  path: '/pages/index/index',
}))

onPageScroll(({ scrollTop }: { scrollTop: number }) => {
  navScrolled.value = scrollTop > 2
})


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
  void refreshHomepage()
})

onShow(() => { void refreshHomepage() })
</script>

<template>
  <view class="page">

    <!-- ====== 首屏轮播（从页面顶部开始） ====== -->
    <view v-if="loading" class="hero-skeleton" :style="{ height: heroHeightStyle }">
      <view class="hero-skeleton-media" />
      <view class="hero-skeleton-copy">
        <view class="hero-skeleton-line hero-skeleton-line-wide" />
        <view class="hero-skeleton-line hero-skeleton-line-narrow" />
      </view>
    </view>
    <swiper v-else-if="heroImages.length" class="hero-swiper" :style="{ height: heroHeightStyle }" circular autoplay interval="4500" duration="450">
      <swiper-item v-for="(image, index) in heroImages" :key="image" class="hero-swiper-item" :style="{ height: heroHeightStyle }">
        <image class="hero-image" :src="image" mode="widthFix" @click="goHero(index)" />
      </swiper-item>
    </swiper>
    <video v-else-if="heroVideo" class="hero-video" :src="heroVideo" :poster="homepageMedia?.coverUrl?.[0]" autoplay loop muted />
    <!-- 无轮播/视频时灰色占位 -->
    <view v-else class="hero-placeholder" />

    <RequestState v-if="!loading && loadError" :error="loadError" @retry="loadHomepage" />

    <!-- ====== 悬浮导航栏（覆盖在轮播图上方，与胶囊按钮同行） ====== -->
    <view class="nav-backdrop" :style="navBackdropStyle" />
    <view class="nav-bar" :style="navBarStyle">
      <image class="nav-logo-img" src="/static/logo.png" mode="aspectFit" />
      <view class="nav-search" :style="navSearchStyle" @click="goSearch">
        <input class="nav-search-input" value="" placeholder="搜索商品" readonly />
      </view>
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

    <!-- ====== 商品卡片（骨架屏 / 正常 / 空态） ====== -->
    <view v-if="loading" class="cards-wrap">
      <view v-for="i in 2" :key="'sk-' + i" class="product-card">
        <view class="card-img-ph card-skeleton" />
        <view class="card-text">
          <view class="card-skeleton-line" style="width: 62%; height: 40rpx;" />
          <view class="card-bar">
            <view class="card-skeleton-line" style="width: 160rpx; height: 32rpx;" />
          </view>
        </view>
      </view>
    </view>

    <view v-else-if="products.length" class="cards-wrap">
      <view v-for="(item, index) in products" :key="item.id || index" class="product-card" @click="goProduct(item.id)">
        <image v-if="item.mainImage" class="card-img" :src="item.mainImage" mode="widthFix" lazy-load />
        <view v-else class="card-img-ph" />
        <view v-if="isRecommendTextEnabled(item.recommendTextEnabled)" class="card-text">
          <text class="card-title">{{ item.name }}</text>
          <text v-if="isRecommendTextEnabled(item.recommendTextEnabled)" class="card-desc">{{ item.descriptionTitle || '' }}</text>
          <view class="card-bar">
            <view class="price-group">
              <text class="price-yuan">¥</text>
              <text class="price-num">{{ item.originalPrice ?? item.minOriginalPrice ?? item.price ?? 2999 }}</text>
            </view>
            <view class="buy-btn"><text class="buy-text">即刻购买</text></view>
          </view>
        </view>
      </view>
    </view>

    <view v-else class="cards-wrap">
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

    <!-- ====== 福利与资讯（背景图 + 内容叠加） ====== -->
    <view class="welfare">
      <image class="welfare-bg" src="/static/bg/2-1.jpg" mode="widthFix" lazy-load />
      <view class="welfare-content">
        <text class="welfare-title">福利与资讯</text>
        <view class="welfare-tabs">
          <view class="w-tab" :class="{ active: welfareTab === 0 }" @click="welfareTab = 0"><text>更多福利</text></view>
        <view class="w-tab" :class="{ active: welfareTab === 1 }" @click="welfareTab = 1"><text>今华有肽</text></view>
        </view>
        <image v-if="bottomImages[welfareTab]" class="welfare-img" :src="bottomImages[welfareTab]" mode="aspectFill" lazy-load @click="handleWelfareImageTap(welfareTab)" />
        <view v-else class="welfare-placeholder" />
      </view>
    </view>

    <!-- 「更多福利」落地中转弹窗：目标小程序非同一主体，微信禁止直接跳转，改为展示小程序码，让用户长按识别进入。 -->
    <view v-if="welfareLandingVisible" class="welfare-mask" @click="closeWelfareLanding">
      <view class="welfare-dialog" @click.stop>
        <text class="welfare-dialog-title">福利小程序</text>
        <text class="welfare-dialog-tip">该福利由合作方提供，长按下方小程序码即可识别进入。</text>
        <!-- 单独的纯小程序码：放大展示，供用户长按识别（最可靠）。 -->
        <view v-if="welfareCodeImage" class="welfare-code-wrap">
          <image class="welfare-code" :src="welfareCodeImage" mode="aspectFit" />
          <view class="welfare-code-badge"><text class="welfare-code-badge-text">长按识别小程序码</text></view>
        </view>
        <!-- 整张海报：可欣赏/保存；无单独纯码图时兼作长按识别入口（回退兼容）。 -->
        <view v-if="welfareQrImage" class="welfare-poster-wrap">
          <image class="welfare-poster" :src="welfareQrImage" mode="widthFix" @click="saveWelfarePoster" />
          <view v-if="!welfareCodeImage" class="welfare-poster-badge"><text class="welfare-poster-badge-text">长按识别小程序码</text></view>
        </view>
        <view v-if="!welfareQrImage && !welfareCodeImage" class="welfare-poster-placeholder">
          <text class="welfare-poster-placeholder-text">海报待配置</text>
        </view>
        <button v-if="welfareQrImage" class="welfare-dialog-btn" :loading="welfareSaving" @click="saveWelfarePoster">保存海报</button>
        <button class="welfare-dialog-btn welfare-dialog-btn--plain" @click="closeWelfareLanding">我知道了</button>
      </view>
    </view>

  </view>
</template>

<style>
.page { display: flex; flex-direction: column; align-items: center; min-height: 100vh; background: #fff; }

/* ===== 悬浮导航栏（fixed 覆盖轮播图上方） ===== */
.nav-backdrop { position: fixed; top: 0; right: 0; left: 0; z-index: 99; pointer-events: none; transition: background-color .2s ease, box-shadow .2s ease; }
.nav-bar { position: fixed; left: 0; right: 0; display: flex; align-items: center; padding-left: 24rpx; z-index: 100; box-sizing: border-box; background: transparent; transition: background-color .2s ease, box-shadow .2s ease; }
.nav-logo-img { width: 102rpx; height: 54rpx; flex-shrink: 0; }
.nav-search { display: flex; flex: 1; align-items: center; height: 68rpx; margin-left: 16rpx; padding: 0 24rpx; box-sizing: border-box; border: 1rpx solid rgba(255,255,255,.78); border-radius: 34rpx; background: rgba(255,255,255,.22); box-shadow: 0 3rpx 14rpx rgba(0,0,0,.1); }
.nav-search-input { flex: 1; min-width: 0; padding: 0; color: #5d5956; font-size: 26rpx; font-weight: 500; }
.nav-search-input::placeholder { color: #77716d; opacity: 1; }

/* ===== 首屏轮播 ===== */
.hero-swiper { width: 100%; margin-top: 0; overflow: hidden; }
.hero-swiper-item { width: 100%; overflow: hidden; }
.hero-image { width: 100%; height: auto; display: block; }
.hero-skeleton { width: 100%; min-height: 960rpx; position: relative; overflow: hidden; background: #e7eaed; }
.hero-skeleton-media { position: absolute; inset: 0; background: #e7eaed; animation: hero-skeleton-pulse 1.4s ease-in-out infinite; }
.hero-skeleton-copy { position: absolute; right: 72rpx; bottom: 74rpx; left: 72rpx; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 18rpx; }
.hero-skeleton-line { height: 28rpx; border-radius: 14rpx; background: rgba(190,197,204,.82); animation: hero-skeleton-pulse 1.4s ease-in-out infinite; }
.hero-skeleton-line-wide { width: 58%; }
.hero-skeleton-line-narrow { width: 34%; height: 18rpx; }
.hero-skeleton::after { content: ''; position: absolute; inset: 0; z-index: 2; pointer-events: none; background: rgba(255,255,255,.22); animation: hero-skeleton-pulse 1.4s ease-in-out infinite; }
@keyframes hero-skeleton-pulse { 0%, 100% { opacity: .25; } 50% { opacity: .8; } }
.hero-video { width: 100%; height: 960rpx; margin-top: 0; }
.hero-placeholder { width: 100%; height: 960rpx; background: #d8d8d8; }

/* ===== Logo 小图 ===== */
.logo-row { width: 100%; padding: 102rpx 0 0 26rpx; margin-top: -120rpx; }
.logo-mark { width: 102rpx; height: 54rpx; background: rgba(0,0,0,.08); border-radius: 6rpx; }

/* ===== 品牌文案 ===== */
.brand-title { display: block; width: 100%; box-sizing: border-box; padding: 0 24rpx; color: #232423; font-size: 40rpx; letter-spacing: 13rpx; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 48rpx 0 0; line-height: 56rpx; }
.brand-slogan { display: flex; justify-content: center; color: #bebebe; font-size: 28rpx; margin-top: 4rpx; gap: 4rpx; }

/* ===== 商品卡片（图片 + 下方文字样式） ===== */
.cards-wrap { display: flex; flex-direction: column; align-items: center; gap: 20rpx; margin-top: 60rpx; padding: 0 40rpx; width: 100%; }
.product-card { width: 100%; border-radius: 40rpx 40rpx 0 0; overflow: hidden; position: relative; }
/* 图片撑满整卡 */
.card-img { width: 100%; display: block; }
.card-img-ph { width: 100%; height: 360rpx; background: rgba(0,0,0,.06); }
/* 骨架屏占位（复用 hero 的脉动动画） */
.card-skeleton { animation: hero-skeleton-pulse 1.4s ease-in-out infinite; }
.card-skeleton-line { display: block; border-radius: 6rpx; background: rgba(0,0,0,.08); animation: hero-skeleton-pulse 1.4s ease-in-out infinite; }

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

/* ===== 「更多福利」落地中转弹窗 ===== */
.welfare-mask { position: fixed; inset: 0; z-index: 1100; display: flex; align-items: center; justify-content: center; padding: 160rpx 40rpx 40rpx; box-sizing: border-box; background: rgba(0,0,0,.5); }
.welfare-dialog { width: 100%; max-width: 600rpx; padding: 40rpx 36rpx 32rpx; border-radius: 24rpx; background: #fff; display: flex; flex-direction: column; align-items: center; }
.welfare-dialog-title { color: #232423; font-size: 32rpx; font-weight: 600; }
.welfare-dialog-tip { margin-top: 16rpx; color: #666; font-size: 24rpx; line-height: 1.6; text-align: center; }
.welfare-code-wrap { position: relative; margin-top: 28rpx; width: 420rpx; height: 420rpx; padding: 24rpx; border-radius: 16rpx; background: #fff; box-shadow: 0 2rpx 12rpx rgba(0,0,0,.08); box-sizing: border-box; }
.welfare-code { display: block; width: 100%; height: 100%; }
.welfare-code-badge { position: absolute; top: 10rpx; left: 50%; padding: 6rpx 20rpx; border-radius: 22rpx; background: rgba(0,0,0,.5); transform: translateX(-50%); }
.welfare-code-badge-text { color: #fff; font-size: 22rpx; }
.welfare-poster-wrap { position: relative; margin-top: 28rpx; width: 100%; max-height: 64vh; overflow: hidden; border-radius: 12rpx; background: #f2f2f2; }
.welfare-poster { display: block; width: 100%; height: auto; }
.welfare-poster-badge { position: absolute; top: 12rpx; left: 50%; padding: 6rpx 20rpx; border-radius: 24rpx; background: rgba(0,0,0,.5); transform: translateX(-50%); }
.welfare-poster-badge-text { color: #fff; font-size: 22rpx; }
.welfare-poster-placeholder { display: flex; align-items: center; justify-content: center; width: 100%; height: 320rpx; border-radius: 12rpx; background: #f2f2f2; }
.welfare-poster-placeholder-text { color: #aaa; font-size: 26rpx; }
.welfare-dialog-btn { height: 80rpx; margin-top: 32rpx; width: 100%; border-radius: 40rpx; background: #232423; color: #fff; font-size: 28rpx; font-weight: 500; line-height: 80rpx; }
.welfare-dialog-btn--plain { margin-top: 16rpx; background: #f2f2f2; color: #666; font-weight: 400; }
.welfare-dialog-btn::after { border: 0; }
</style>
