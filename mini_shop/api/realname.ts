import { request } from '@/utils/request'

/** 实名认证状态，只保留后端返回的脱敏身份信息。 */
export interface RealnameStatus {
  verified: boolean
  maskedName: string | null
  maskedCertNo: string | null
  /**
   * 该用户**是否已填银行卡号**（A 方案字段，2026-10-06）。
   *
   * 用途：用户切到「银行卡提现」时**提前**判断要不要引导补卡，
   * 避免"填完金额 → 点提交 → 才被后端 8601 拦"的糟糕体验。
   *
   * ⚠️⚠️ **两个必须注意的点**：
   * 1. **声明成可选**：后端该字段**尚未上线**（后端文档说已预留位置、约 15 分钟），
   *    老接口不返回它 ⇒ 不能强制要求；
   * 2. **判定必须用 `=== false`**（见 `withdraw.vue` 的 `hasBankCardMissing`）——
   *    `undefined` 一律视为"未知/有卡"并**放行**，否则会把**所有**用户
   *    误判成"没有卡号"从而拦在提现门外。
   */
  hasBankCard?: boolean
  /** 脱敏银行卡号（可选，如 `6222 **** **** 0128`）；仅用于展示"将使用这张卡"，缺失不影响功能。 */
  maskedBankCardNo?: string | null
}

/** 二要素实名认证请求，仅在本次核验请求中使用完整身份信息。 */
export interface RealnameVerifyDTO {
  certName: string
  certNo: string
  idCardFrontUrl?: string
  idCardBackUrl?: string
  bankCardNo?: string
  bankPhone?: string
}

export interface RealnameOcrDTO {
  image?: string
  url?: string
}

/** OCR 结果透传对象，具体字段由实名认证服务返回，前端只读取姓名和证件号候选字段。 */
export interface RealnameOcrVO {
  success: boolean
  data?: unknown
  message?: string
}

/** 查询当前用户的实名认证状态。 */
export function getRealnameStatus(): Promise<RealnameStatus> {
  return request<RealnameStatus>({ url: '/api/realname/status', method: 'GET' })
}

/** 提交姓名和身份证号进行实名认证。 */
export function verifyRealname(payload: RealnameVerifyDTO): Promise<RealnameStatus> {
  return request<RealnameStatus>({ url: '/api/realname/verify', method: 'POST', data: payload })
}

/** 识别身份证正面图片文字，不执行实名认证。 */
export function ocrRealname(payload: RealnameOcrDTO): Promise<RealnameOcrVO> {
  return request<RealnameOcrVO>({ url: '/api/realname/ocr', method: 'POST', data: payload })
}
