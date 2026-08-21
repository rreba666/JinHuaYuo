<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { verifyRealname, type RealnameStatus, type RealnameVerifyDTO } from '@/api/realname'
import { isApiRequestError } from '@/utils/request'
import { validateBankCard, validateIdCard, validateMobile, validateText } from '@/utils/input-validation'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [visible: boolean]
  verified: [status: RealnameStatus]
}>()

const visible = computed(() => props.modelValue)
const submitting = ref(false)
const errorMessage = ref('')
const form = reactive({
  certName: '',
  certNo: '',
  bankCardNo: '',
  bankPhone: '',
})

function clearSensitiveInput(): void {
  form.certName = ''
  form.certNo = ''
  form.bankCardNo = ''
  form.bankPhone = ''
}

function close(): void {
  if (submitting.value) return
  clearSensitiveInput()
  errorMessage.value = ''
  emit('update:modelValue', false)
}

function validateForm(): RealnameVerifyDTO | null {
  const certName = validateText(form.certName, { label: '真实姓名', maxLength: 32 })
  if (!certName.ok) {
    errorMessage.value = certName.message
    return null
  }
  const certNo = validateIdCard(form.certNo)
  if (!certNo.ok) {
    errorMessage.value = certNo.message
    return null
  }

  const bankCardInput = form.bankCardNo.trim()
  const bankPhoneInput = form.bankPhone.trim()
  const bankCardNo = bankCardInput ? validateBankCard(bankCardInput) : null
  if (bankCardNo && !bankCardNo.ok) {
    errorMessage.value = bankCardNo.message
    return null
  }
  const bankPhone = bankPhoneInput ? validateMobile(bankPhoneInput, '银行预留手机号') : null
  if (bankPhone && !bankPhone.ok) {
    errorMessage.value = bankPhone.message
    return null
  }

  return {
    certName: certName.value,
    certNo: certNo.value,
    ...(bankCardNo ? { bankCardNo: bankCardNo.value } : {}),
    ...(bankPhone ? { bankPhone: bankPhone.value } : {}),
  }
}

async function submitForm(): Promise<void> {
  if (submitting.value) return
  const payload = validateForm()
  if (!payload) return
  submitting.value = true
  errorMessage.value = ''
  try {
    const status = await verifyRealname(payload)
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
  <view v-show="visible" class="realname-mask" @click="close">
    <view class="realname-sheet" @click.stop>
      <view class="sheet-header">
        <text class="sheet-title">实名认证</text>
        <text class="sheet-close" @click="close">×</text>
      </view>
      <scroll-view class="realname-form" scroll-y>
        <view class="field-group">
          <text class="field-label">姓名</text>
          <input v-model="form.certName" class="field-input" maxlength="32" type="text" placeholder="请输入真实姓名" />
        </view>
        <view class="field-group">
          <text class="field-label">身份证号</text>
          <input v-model="form.certNo" class="field-input" maxlength="18" type="text" placeholder="请输入18位身份证号" />
        </view>
        <view class="field-group">
          <text class="field-label">电话号</text>
          <input v-model="form.bankPhone" class="field-input" maxlength="11" type="number" placeholder="请输入银行预留手机号" />
        </view>
        <view class="field-group">
          <text class="field-label">银行卡</text>
          <input v-model="form.bankCardNo" class="field-input" maxlength="19" type="number" placeholder="请输入银行卡号" />
        </view>
        <text v-show="errorMessage" class="sheet-error">{{ errorMessage }}</text>
      </scroll-view>
      <button class="sheet-submit" :disabled="submitting" @click="submitForm">
        {{ submitting ? '认证中...' : '提交认证' }}
      </button>
    </view>
  </view>
</template>

<style>
.realname-mask { position: fixed; inset: 0; z-index: 50; display: flex; align-items: flex-end; background: rgba(0, 0, 0, .62); }
.realname-sheet { width: 100%; max-height: 88vh; padding: 30rpx 28rpx calc(30rpx + env(safe-area-inset-bottom)); box-sizing: border-box; background: #fff; }
.sheet-header { position: relative; display: flex; align-items: center; justify-content: center; min-height: 54rpx; }
.sheet-title { color: #222; font-size: 30rpx; font-weight: 600; }
.sheet-close { position: absolute; right: 0; color: #888; font-size: 42rpx; line-height: 42rpx; }
.realname-form { max-height: 62vh; margin-top: 20rpx; }
.field-group { margin-bottom: 20rpx; }
.field-label { display: block; margin-bottom: 10rpx; color: #333; font-size: 25rpx; font-weight: 600; }
.field-input { width: 100%; height: 82rpx; padding: 0 22rpx; box-sizing: border-box; border: 1rpx solid #e5e7eb; border-radius: 12rpx; background: #fafafa; color: #222; font-size: 26rpx; }
.sheet-error { display: block; margin: 4rpx 0 10rpx; color: #c44; font-size: 23rpx; line-height: 32rpx; }
.sheet-submit { height: 78rpx; margin-top: 22rpx; color: #fff; background: #222; border-radius: 4rpx; font-size: 27rpx; }
.sheet-submit::after { border: 0; }
</style>
