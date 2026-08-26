import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getCurrentAdmin } from '@/api/admin'
import type { AdminInfo } from '@/types/admin'
import type { AdminLoginVO } from '@/types/auth'

const TOKEN_KEY = 'admin_token'
const ADMIN_INFO_KEY = 'admin_login_info'
const APP_KEY_KEY = 'admin_current_app_key'
/** 模拟身份开关（仅用于后端 brandScope 接口未就绪时验证两种身份；后端就绪后移除） */
const MOCK_BRAND_SCOPE_KEY = 'admin_mock_brand_scope'

/** 读取本地模拟身份：'ALL'=平台管理员 / 'jinhua'=商户管理员（今华有）。后端未返回 brandScope 时兜底用。 */
export function readMockBrandScope(): 'ALL' | string[] {
  const saved = localStorage.getItem(MOCK_BRAND_SCOPE_KEY)
  if (saved === 'merchant') return ['jinhua']
  return 'ALL'
}

/** 管理管理员认证状态及本地持久化数据。 */
export const useAuthStore = defineStore('auth', () => {
  const token = ref('')
  const adminUserId = ref<string | null>(null)
  const nickname = ref('')
  const role = ref('')
  const expireAt = ref<number | null>(null)
  /** 品牌范围：'ALL'（平台管理员）或品牌 key 数组（商户管理员）。 */
  const brandScope = ref<'ALL' | string[]>('ALL')
  /** 当前操作品牌（请求 X-App-Key）：平台管理员可切换，商户固定自己的品牌。 */
  const currentAppKey = ref('')
  const isAuthenticated = computed(() => Boolean(token.value))
  /** 是否为平台管理员（品牌范围 ALL）。 */
  const isPlatform = computed(() => brandScope.value === 'ALL')

  /** 将登录结果写入响应式状态和本地存储。 */
  function setLoginData(loginData: AdminLoginVO): void {
    token.value = loginData.token
    adminUserId.value = String(loginData.adminUserId)
    nickname.value = loginData.nickname
    role.value = loginData.role
    expireAt.value = loginData.expireAt
    brandScope.value = loginData.brandScope ?? readMockBrandScope()
    // 当前品牌：商户固定第一个品牌（通常只有一个），平台默认空（请求层按 ALL 语义可不带 X-App-Key）
    if (Array.isArray(brandScope.value) && brandScope.value.length > 0) {
      currentAppKey.value = brandScope.value[0]
    } else {
      currentAppKey.value = ''
    }
    localStorage.setItem(TOKEN_KEY, loginData.token)
    localStorage.setItem(ADMIN_INFO_KEY, JSON.stringify(loginData))
    localStorage.setItem(APP_KEY_KEY, currentAppKey.value)
  }

  /** 用后端本人信息更新身份展示字段，不覆盖 Token 和过期时间。 */
  function applyCurrentAdmin(admin: AdminInfo): void {
    if (!admin.id.trim()) throw new Error('当前管理员信息无效')
    adminUserId.value = String(admin.id)
    nickname.value = admin.nickname
    role.value = admin.role
    const savedInfo = { token: token.value, adminUserId: adminUserId.value, nickname: nickname.value, role: role.value, expireAt: expireAt.value }
    localStorage.setItem(ADMIN_INFO_KEY, JSON.stringify(savedInfo))
  }

  /** 平台管理员切换当前品牌（请求层 X-App-Key 跟着变）。 */
  function switchAppKey(appKey: string): void {
    if (brandScope.value !== 'ALL') return
    currentAppKey.value = appKey
    localStorage.setItem(APP_KEY_KEY, appKey)
  }

  /** 刷新当前管理员信息，失败交由布局层保留本地登录态。 */
  async function refreshCurrentAdmin(): Promise<void> {
    const requestToken = token.value
    const admin = await getCurrentAdmin()
    if (!requestToken || token.value !== requestToken) return
    applyCurrentAdmin(admin)
  }

  /** 从本地存储恢复上一次登录留下的认证数据。 */
  function restore(): void {
    const savedToken = localStorage.getItem(TOKEN_KEY)
    const savedInfo = localStorage.getItem(ADMIN_INFO_KEY)
    if (!savedToken || !savedInfo) return

    try {
      const loginData = JSON.parse(savedInfo) as AdminLoginVO
      if (loginData.token !== savedToken) return
      setLoginData(loginData)
      // 恢复上次切换的品牌（平台管理员）
      currentAppKey.value = localStorage.getItem(APP_KEY_KEY) || ''
    } catch {
      logout()
    }
  }

  /** 清理本地认证数据并重置当前登录状态。 */
  function logout(): void {
    token.value = ''
    adminUserId.value = null
    nickname.value = ''
    role.value = ''
    expireAt.value = null
    brandScope.value = 'ALL'
    currentAppKey.value = ''
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(ADMIN_INFO_KEY)
    localStorage.removeItem(APP_KEY_KEY)
  }

  return {
    token,
    adminUserId,
    nickname,
    role,
    expireAt,
    brandScope,
    currentAppKey,
    isAuthenticated,
    isPlatform,
    setLoginData,
    applyCurrentAdmin,
    switchAppKey,
    refreshCurrentAdmin,
    restore,
    logout,
  }
})
