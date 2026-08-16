<script setup lang="ts">
import { onLaunch, onShow } from '@dcloudio/uni-app'
import { isLoggedIn } from '@/utils/auth'
import { bindStoredPromotionIfLoggedIn, capturePromotionContext } from '@/utils/promotion'

/** 应用启动时检查本地登录状态，避免已登录用户重复进入登录页。 */
onLaunch((options) => {
  capturePromotionContext(options as Record<string, unknown>)
  void bindStoredPromotionIfLoggedIn()
  if (isLoggedIn()) {
    const pages = getCurrentPages()
    const currentRoute = pages[pages.length - 1]?.route
    if (currentRoute === 'pages/login/login') {
      uni.reLaunch({ url: '/pages/index/index' })
    }
  }
})

/** 小程序从后台回到前台时再次捕获分享或扫码参数。 */
onShow((options) => {
  capturePromotionContext(options as Record<string, unknown>)
  void bindStoredPromotionIfLoggedIn()
})
</script>

<style>
/* 全局页面基础样式。 */
page {
  background: #f6f8fc;
  color: #172033;
  font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
}
</style>
