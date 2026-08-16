import { request } from '@/utils/request'

/** 实名认证状态，只保留后端返回的脱敏身份信息。 */
export interface RealnameStatus {
  verified: boolean
  maskedName: string | null
  maskedCertNo: string | null
}

/** 身份证 OCR 请求。 */
export interface RealnameOcrDTO {
  image: string
  url?: string
}

/** 身份证 OCR + 二要素自动核验请求。 */
export interface RealnameOcrVerifyDTO {
  image: string
  url?: string
  bankCardNo?: string
  bankPhone?: string
}

/** OCR 识别返回值。 */
export interface RealnameOcrResult {
  success: boolean
  data: Record<string, unknown> | null
  message: string
}

/** 二要素实名认证请求，仅在本次核验请求中使用完整身份信息。 */
export interface RealnameVerifyDTO {
  certName: string
  certNo: string
}

/** 查询当前用户的实名认证状态。 */
export function getRealnameStatus(): Promise<RealnameStatus> {
  return request<RealnameStatus>({ url: '/api/realname/status', method: 'GET' })
}

/** 身份证 OCR 识别。 */
export function ocrRealname(payload: RealnameOcrDTO): Promise<RealnameOcrResult> {
  return request<RealnameOcrResult>({ url: '/api/realname/ocr', method: 'POST', data: payload })
}

/** 身份证 OCR 识别 + 自动二要素核验。 */
export function ocrVerifyRealname(payload: RealnameOcrVerifyDTO): Promise<RealnameStatus> {
  return request<RealnameStatus>({ url: '/api/realname/ocr-verify', method: 'POST', data: payload })
}

/** 提交姓名和身份证号进行实名认证。 */
export function verifyRealname(payload: RealnameVerifyDTO): Promise<RealnameStatus> {
  return request<RealnameStatus>({ url: '/api/realname/verify', method: 'POST', data: payload })
}
