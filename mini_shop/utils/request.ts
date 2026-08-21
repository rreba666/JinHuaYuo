import developmentEnv from '../.env?raw'
import productionEnv from '../.env.production?raw'
import { clearAuth } from './auth'

/** 统一表示网络、HTTP 和后端业务失败，并保留后端业务码。 */
export class ApiRequestError extends Error {
  constructor(message: string, public readonly code?: number) {
    super(message)
    this.name = 'ApiRequestError'
  }
}

/** 判断异常是否为请求层统一错误。 */
export function isApiRequestError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError
}

/** 从环境文件原文中读取指定配置，兼容 HBuilderX 不注入自定义 VITE 变量的情况。 */
function readEnvValue(source: string, key: string): string {
  const line = source.split(/\r?\n/).find((item) => item.trim().startsWith(`${key}=`))
  return line ? line.trim().slice(key.length + 1).trim().replace(/^['"]|['"]$/g, '') : ''
}

const envSource = import.meta.env.MODE === 'production' ? productionEnv : developmentEnv
const API_BASE_URL = readEnvValue(envSource, 'VITE_API_BASE_URL').replace(/\/+$/, '')

interface ApiResponse<T> {
  code?: number
  message?: string
  success?: boolean
  data?: T
}

/** 统一处理会话失效，保留调用方自己的错误提示和业务分支。 */
function handleUnauthorized(statusCode: number, businessCode?: number): void {
  if (statusCode !== 401 && Number(businessCode) !== 401) return
  clearAuth()
  const pages = getCurrentPages()
  const currentRoute = pages.length ? pages[pages.length - 1]?.route || '' : ''
  if (currentRoute !== 'pages/login/login') {
    uni.reLaunch({ url: '/pages/login/login' })
  }
}

/** 发起 uni-app 网络请求，统一处理鉴权头和后端错误。 */
export function request<T = unknown>(options: UniApp.RequestOptions): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!API_BASE_URL) {
      reject(new ApiRequestError('未配置 VITE_API_BASE_URL，请检查 mini_shop 工程目录环境文件'))
      return
    }

    const token = uni.getStorageSync('mini_shop_token')
    const header: Record<string, string> = { ...(options.header || {}) }

    if (options.method && options.method.toUpperCase() !== 'GET') {
      header['Content-Type'] = 'application/json'
    }
    if (token) {
      header.Authorization = `Bearer ${token}`
    }

    uni.request({
      ...options,
      url: `${API_BASE_URL}${options.url}`,
      timeout: options.timeout ?? 15000,
      header,
      success: (response) => {
        const body = (response.data && typeof response.data === 'object'
          ? response.data
          : {}) as ApiResponse<T>
        if (response.statusCode < 200 || response.statusCode >= 300) {
          handleUnauthorized(response.statusCode, body.code)
          reject(new ApiRequestError(body.message || '网络异常，请稍后重试', body.code))
          return
        }
        if (body.success === false || (body.code != null && body.code !== 0)) {
          handleUnauthorized(response.statusCode, body.code)
          reject(new ApiRequestError(body.message || '请求失败', body.code))
          return
        }
        resolve(body.data as T)
      },
      fail: (error) => {
        reject(new ApiRequestError(error.errMsg || '网络异常，请稍后重试'))
      },
    })
  })
}

/**
 * 上传本地文件到后端通用上传接口，返回后端代理 URL（响应 data 为 URL 字符串）。
 * 用于头像等需要把微信临时文件转成永久可访问地址的场景。
 * 后端接口规范：POST /api/common/upload，multipart 字段名 file，返回 { code, message, data: "https://..." }。
 */
export function uploadFile(filePath: string, name = 'file'): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!API_BASE_URL) {
      reject(new ApiRequestError('未配置 VITE_API_BASE_URL，请检查 mini_shop 工程目录环境文件'))
      return
    }
    const token = uni.getStorageSync('mini_shop_token')
    uni.uploadFile({
      url: `${API_BASE_URL}/api/common/upload`,
      filePath,
      name,
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (response) => {
        try {
          const body = JSON.parse(response.data) as ApiResponse<string>
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new ApiRequestError(body.message || '网络异常，请稍后重试', body.code))
            return
          }
          if (body.success === false || (body.code != null && body.code !== 0)) {
            reject(new ApiRequestError(body.message || '上传失败', body.code))
            return
          }
          if (!body.data) {
            reject(new ApiRequestError('上传成功但未返回文件地址'))
            return
          }
          resolve(body.data)
        } catch {
          reject(new ApiRequestError('上传响应解析失败'))
        }
      },
      fail: (error) => {
        reject(new ApiRequestError(error.errMsg || '上传失败'))
      },
    })
  })
}
