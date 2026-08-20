import { request } from '@/utils/request'

/** 实名认证状态，只保留后端返回的脱敏身份信息。 */
export interface RealnameStatus {
  verified: boolean
  maskedName: string | null
  maskedCertNo: string | null
}

/** 二要素实名认证请求，仅在本次核验请求中使用完整身份信息。 */
export interface RealnameVerifyDTO {
  certName: string
  certNo: string
  bankCardNo?: string
  bankPhone?: string
}

/** 查询当前用户的实名认证状态。 */
export function getRealnameStatus(): Promise<RealnameStatus> {
  return request<RealnameStatus>({ url: '/api/realname/status', method: 'GET' })
}

/** 提交姓名和身份证号进行实名认证。 */
export function verifyRealname(payload: RealnameVerifyDTO): Promise<RealnameStatus> {
  return request<RealnameStatus>({ url: '/api/realname/verify', method: 'POST', data: payload })
}
