import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getCurrentAdmin } from '@/api/admin'
import type { AdminInfo } from '@/types/admin'
import type { AdminLoginVO } from '@/types/auth'

const TOKEN_KEY = 'admin_token'
const ADMIN_INFO_KEY = 'admin_login_info'

/** 管理管理员认证状态及本地持久化数据。 */
export const useAuthStore = defineStore('auth', () => {
  const token = ref('')
  const adminUserId = ref<string | null>(null)
  const nickname = ref('')
  const role = ref('')
  const expireAt = ref<number | null>(null)
  const isAuthenticated = computed(() => Boolean(token.value))

  /** 将登录结果写入响应式状态和本地存储。 */
  function setLoginData(loginData: AdminLoginVO): void {
    token.value = loginData.token
    adminUserId.value = String(loginData.adminUserId)
    nickname.value = loginData.nickname
    role.value = loginData.role
    expireAt.value = loginData.expireAt
    localStorage.setItem(TOKEN_KEY, loginData.token)
    localStorage.setItem(ADMIN_INFO_KEY, JSON.stringify(loginData))
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
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(ADMIN_INFO_KEY)
  }

  return {
    token,
    adminUserId,
    nickname,
    role,
    expireAt,
    isAuthenticated,
    setLoginData,
    applyCurrentAdmin,
    refreshCurrentAdmin,
    restore,
    logout,
  }
})
