import { request } from '@/utils/request'
import { getDeviceId } from '@/utils/device'

export interface MiniShopLoginData {
  token: string
  userId: number
  isNewUser: boolean
  expireAt: number
}

/** 调用小程序登录接口，用微信登录凭证换取业务 Token。 */
export function loginByWechat(code: string, phoneCode?: string, promoterId?: number | null): Promise<MiniShopLoginData> {
  const data: { code: string; phoneCode?: string; promoterId?: number; deviceId?: string } = { code }
  if (phoneCode) data.phoneCode = phoneCode
  if (Number.isInteger(promoterId) && Number(promoterId) > 0) data.promoterId = Number(promoterId)
  // 设备标识（2026-09-19 多账号套现风控）：后端用于 Token 绑定设备 + 异常登录检测，
  // 并在「一证一号」冲突时写入 realname_duplicate_log 辅助排查。拿不到就不传（字段可选）。
  const deviceId = getDeviceId()
  if (deviceId) data.deviceId = deviceId

  return request<MiniShopLoginData>({
    url: '/api/auth/login',
    method: 'POST',
    data,
  })
}
