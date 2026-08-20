import axios from 'axios'

declare module 'axios' {
  interface AxiosRequestConfig {
    skipAuthRedirect?: boolean
  }
}

export type { ApiResponse } from '@/types/common'

/** 清理失效认证并跳转到登录页，保留当前地址供登录后返回。 */
function redirectToLogin(): void {
  localStorage.removeItem('admin_token')
  localStorage.removeItem('admin_login_info')
  if (window.location.pathname === '/login') return
  const redirect = `${window.location.pathname}${window.location.search}${window.location.hash}`
  window.location.assign(`/login?redirect=${encodeURIComponent(redirect)}`)
}

// 统一请求实例，使用 Vite 环境变量区分不同部署环境的后端地址。
export const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL, 
  timeout: 10000,
  // Spring 接口将数组绑定为重复查询参数，例如 statuses=6&statuses=7。
  paramsSerializer: { indexes: null },
})

// 请求拦截器统一注入管理员 Token。
request.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token')
  if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 响应拦截器统一转换 HTTP、网络和超时错误，业务响应由具体 API 校验。
request.interceptors.response.use(
  (response) => response,
  (error) => {
    if ((error.response?.status === 401 || error.response?.status === 403) && error.config?.skipAuthRedirect) {
      return Promise.reject(new Error(error.response?.data?.message || '当前管理员信息查询失败'))
    }
    if (error.response?.status === 401 || error.response?.status === 403) {
      redirectToLogin()
      return Promise.reject(new Error('登录状态已失效，请重新登录'))
    }
    if (error.response?.data?.message) {
      return Promise.reject(new Error(error.response.data.message))
    }
    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new Error('请求超时，请稍后重试'))
    }
    return Promise.reject(new Error('网络异常，请稍后重试'))
  },
)
