<template>
  <view class="login-page">
    <view class="login-card">
      <image class="logo" src="/static/logo.png" mode="aspectFit" />
      <text class="title">欢迎来到商城</text>
      <text class="subtitle">微信授权后即可开始购物</text>
      <button
        class="login-button"
        type="primary"
        open-type="getPhoneNumber"
        :disabled="loading"
        @getphonenumber="handlePhoneNumber"
      >
        {{ loading ? '登录中...' : '微信一键登录' }}
      </button>
      <text v-if="errorMessage" class="error-message">{{ errorMessage }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { loginByWechat } from '@/api/auth'
import { saveAuth } from '@/utils/auth'
import { clearPromotionContext, capturePromotionContext, getStoredPromoterId } from '@/utils/promotion'

const loading = ref(false)
const errorMessage = ref('')

/** 处理微信手机号授权回调，并继续完成业务登录。 */
async function handlePhoneNumber(event: UniApp.GetPhoneNumberResult): Promise<void> {
  if (loading.value) return
  if (!event.detail?.code) {
    errorMessage.value = '需要获得手机号授权后才能登录'
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    const loginResult = await getWechatLoginCode()
    const authData = await loginByWechat(loginResult, event.detail.code, getStoredPromoterId())
    // 打印 Token 到控制台方便测试
    console.log('========== 登录成功 ==========')
    console.log('Token:', authData.token)
    console.log('UserId:', authData.userId)
    console.log('IsNewUser:', authData.isNewUser)
    console.log('ExpireAt:', authData.expireAt)
    console.log('完整 authData:', JSON.stringify(authData))
    console.log('Bearer 头:', `Bearer ${authData.token}`)
    console.log('==============================')
    saveAuth(authData)
    clearPromotionContext()
    uni.reLaunch({ url: '/pages/index/index' })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '登录失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

/** 登录页也捕获入口参数，避免分享链接直接打开登录页时丢失推广者身份。 */
onLoad((options) => {
  capturePromotionContext(options as Record<string, unknown>)
})

/** 获取微信登录凭证，供后端换取业务 Token。 */
function getWechatLoginCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success: (result) => {
		console.log(result)
        if (result.code) resolve(result.code)
        else reject(new Error('微信登录凭证获取失败'))
		
      },
      fail: () => reject(new Error('微信登录失败，请稍后重试')),
    })
  })
}
</script>

<style>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx;
  background: linear-gradient(180deg, #f2f7ff 0%, #ffffff 100%);
}

.login-card {
  width: 100%;
  padding: 72rpx 48rpx 64rpx;
  border-radius: 24rpx;
  background: #ffffff;
  box-shadow: 0 16rpx 48rpx rgba(31, 65, 114, 0.12);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.logo {
  width: 160rpx;
  height: 160rpx;
  margin-bottom: 32rpx;
}

.title {
  color: #172033;
  font-size: 42rpx;
  font-weight: 700;
}

.subtitle {
  margin-top: 18rpx;
  color: #8a96a8;
  font-size: 27rpx;
}

.login-button {
  width: 100%;
  margin-top: 72rpx;
  border-radius: 48rpx;
  background: #07c160;
  font-size: 31rpx;
}

.error-message {
  margin-top: 24rpx;
  color: #e45656;
  font-size: 25rpx;
  text-align: center;
}
</style>
