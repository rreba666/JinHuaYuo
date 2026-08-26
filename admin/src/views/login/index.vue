<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { loginAdmin } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const formRef = ref<FormInstance>()
const loading = ref(false)
const form = reactive({ username: '', password: '' })
const rules: FormRules = {
  username: [{ required: true, message: '请输入管理员账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入登录密码', trigger: 'blur' }],
}

/** 判断重定向地址是否为当前站点内的安全路径。 */
function getSafeRedirect(): string {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
  return redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/users'
}

/** 校验登录表单、调用接口并跳转到原目标页面。 */
async function submitLogin(): Promise<void> {
  if (loading.value) return
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    const loginData = await loginAdmin(form)
    authStore.setLoginData(loginData)
    ElMessage.success('登录成功')
    await router.replace(getSafeRedirect())
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '登录失败，请稍后重试')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <section class="login-card login-card-enter">
      <div class="login-brand"><span class="login-mark">E</span><div><strong>E-Admin Pro</strong><p>电商后台管理系统</p></div></div>
      <div class="login-heading"><h1>管理员登录</h1><p>请输入管理员账号和密码</p></div>
      <el-form ref="formRef" :model="form" :rules="rules" size="large" @submit.prevent="submitLogin">
        <el-form-item prop="username"><el-input v-model="form.username" placeholder="管理员账号" clearable /></el-form-item>
        <el-form-item prop="password"><el-input v-model="form.password" type="password" placeholder="登录密码" show-password @keyup.enter="submitLogin" /></el-form-item>
        <el-button type="primary" native-type="submit" :loading="loading" class="login-button">登录</el-button>
      </el-form>
    </section>
  </main>
</template>

<style scoped>
.login-page { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: linear-gradient(160deg, #10131a 0%, #1a1f2b 45%, #222836 100%); position: relative; overflow: hidden; }
.login-page::before, .login-page::after { content: ''; position: absolute; border-radius: 50%; filter: blur(90px); pointer-events: none; }
.login-page::before { width: 420px; height: 420px; top: -120px; left: -100px; background: radial-gradient(circle, rgba(212,168,67,.28), transparent 65%); }
.login-page::after { width: 380px; height: 380px; right: -90px; bottom: -120px; background: radial-gradient(circle, rgba(212,168,67,.18), transparent 65%); }
/* 登录卡片固定深色毛玻璃背景，不随主题切换，确保浅色文字始终可读 */
.login-card { width: 420px; padding: 42px 40px 38px; border-radius: 18px; background: rgba(26, 31, 40, 0.68); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(212,168,67,.25); box-shadow: 0 18px 50px rgba(0,0,0,.35); }
.login-card-enter { animation: login-card-in .6s cubic-bezier(.22,.8,.28,1) both; }
@keyframes login-card-in { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
.login-brand { display: flex; align-items: center; gap: 12px; color: #e7e9ee; }
.login-mark { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 10px; background: linear-gradient(135deg, #d4a843, #f0c96a); color: #fff; font-size: 24px; font-weight: 700; box-shadow: 0 4px 12px rgba(212,168,67,.30); }
.login-brand strong { font-size: 19px; }
.login-brand p, .login-heading p { margin: 4px 0 0; color: rgba(255,255,255,.6); font-size: 13px; }
.login-heading { margin: 38px 0 24px; }
.login-heading h1 { margin: 0; color: #e7e9ee; font-size: 26px; }
.login-button { width: 100%; margin-top: 8px; }
</style>
