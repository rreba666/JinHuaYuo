<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ocrVerifyRealname, type RealnameOcrVerifyDTO, type RealnameStatus } from '@/api/realname'
import { isApiRequestError } from '@/utils/request'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [visible: boolean]
  verified: [status: Awaited<ReturnType<typeof ocrVerifyRealname>>]
}>()

const photoPreview = ref('')
const photoBase64 = ref('')
const errorMessage = ref('')
const uploading = ref(false)
const submitting = ref(false)
const visible = computed(() => props.modelValue)
// 由父组件通过 v-model 控制显示和关闭。

function clearSensitiveInput(): void {
  photoPreview.value = ''
  photoBase64.value = ''
}

function close(): void {
  if (submitting.value || uploading.value) return
  clearSensitiveInput()
  errorMessage.value = ''
  emit('update:modelValue', false)
}

function readFileAsBase64(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.getFileSystemManager().readFile({
      filePath,
      encoding: 'base64',
      success: (result) => {
        const data = typeof result.data === 'string' ? result.data : ''
        resolve(data.startsWith('data:') ? data : `data:image/jpeg;base64,${data}`)
      },
      fail: reject,
    })
  })
}

function pickIdCardPhoto(): void {
  if (submitting.value || uploading.value) return
  uploading.value = true
  errorMessage.value = ''
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['camera', 'album'],
    success: (result) => {
      void (async () => {
        try {
          const file = result.tempFiles?.[0]
          const filePath = result.tempFilePaths?.[0]
          if (!file || !filePath) {
            errorMessage.value = '未选择身份证照片'
            return
          }
          if (file.size > 1024 * 1024) {
            errorMessage.value = '身份证照片不能超过 1M'
            return
          }
          photoPreview.value = filePath
          photoBase64.value = await readFileAsBase64(filePath)
        } catch (error) {
          errorMessage.value = error instanceof Error ? error.message : '身份证照片读取失败'
        } finally {
          uploading.value = false
        }
      })()
    },
    fail: () => {
      errorMessage.value = '未选择身份证照片'
      uploading.value = false
    },
  })
}

async function submitPhoto(): Promise<void> {
  if (submitting.value) return
  if (!photoBase64.value) {
    errorMessage.value = '请先拍摄身份证照片'
    return
  }

  submitting.value = true
  errorMessage.value = ''
  try {
    const payload: RealnameOcrVerifyDTO = { image: photoBase64.value }
    const status: RealnameStatus = await ocrVerifyRealname(payload)
    clearSensitiveInput()
    emit('verified', status)
    emit('update:modelValue', false)
  } catch (error) {
    if (isApiRequestError(error) && [8602, 8603, 1001].includes(error.code ?? -1)) {
      errorMessage.value = error.message
    } else {
      errorMessage.value = error instanceof Error ? error.message : '实名认证失败，请稍后重试'
    }
  } finally {
    submitting.value = false
  }
}

watch(() => props.modelValue, (nextVisible) => {
  if (nextVisible) errorMessage.value = ''
  else {
    clearSensitiveInput()
    errorMessage.value = ''
  }
})
</script>

<template>
  <!-- 由父组件通过 v-model 控制显示，成功后通过 @verified 通知外层继续流程。 -->
  <view v-show="visible" class="realname-mask" @click="close">
    <view class="realname-sheet" @click.stop>
      <view class="sheet-header">
        <text class="sheet-title">实名认证</text>
        <text class="sheet-close" @click="close">×</text>
      </view>
      <text class="sheet-description">请拍摄本人身份证照片</text>
      <view class="photo-box" @click="pickIdCardPhoto">
        <image v-if="photoPreview" class="photo-preview" :src="photoPreview" mode="aspectFill" />
        <view v-else class="photo-empty">
          <text class="photo-plus">+</text>
          <text class="photo-text">拍身份证照片</text>
        </view>
      </view>
      <text class="sheet-tip">请保持身份证文字清晰，正面拍摄更容易通过</text>
      <text v-show="errorMessage" class="sheet-error">{{ errorMessage }}</text>
      <button class="sheet-submit" :disabled="submitting || uploading" @click="submitPhoto">
        {{ submitting ? '认证中...' : '提交认证' }}
      </button>
    </view>
  </view>
</template>

<style>
.realname-mask { position: fixed; inset: 0; z-index: 50; display: flex; align-items: flex-end; background: rgba(0, 0, 0, .62); }
.realname-sheet { width: 100%; padding: 30rpx 28rpx calc(30rpx + env(safe-area-inset-bottom)); box-sizing: border-box; background: #fff; }
.sheet-header { position: relative; display: flex; align-items: center; justify-content: center; min-height: 54rpx; }
.sheet-title { color: #222; font-size: 30rpx; font-weight: 600; }
.sheet-close { position: absolute; right: 0; color: #888; font-size: 42rpx; line-height: 42rpx; }
.sheet-description { display: block; margin-top: 18rpx; color: #666; font-size: 24rpx; }
.photo-box { display: flex; align-items: center; justify-content: center; width: 100%; height: 330rpx; margin-top: 20rpx; overflow: hidden; border: 1rpx dashed #d0d5dd; border-radius: 20rpx; background: #fafafa; }
.photo-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12rpx; color: #98a2b3; }
.photo-plus { font-size: 72rpx; line-height: 1; }
.photo-text { font-size: 26rpx; }
.photo-preview { width: 100%; height: 100%; }
.sheet-tip { display: block; margin-top: 14rpx; color: #8a8f99; font-size: 22rpx; line-height: 32rpx; }
.sheet-error { display: block; margin-top: 14rpx; color: #c44; font-size: 23rpx; line-height: 32rpx; }
.sheet-submit { height: 78rpx; margin-top: 28rpx; color: #fff; background: #222; border-radius: 4rpx; font-size: 27rpx; }
.sheet-submit::after { border: 0; }
</style>
