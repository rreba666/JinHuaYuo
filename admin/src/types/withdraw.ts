import type { PaginationResult } from './common'

export type WithdrawStatus = 'PENDING_REVIEW' | 'APPROVED' | 'SUCCESS' | 'FAILED' | 'REJECTED' | 'STUCK' | string

export interface Withdrawal {
  id: string
  withdrawNo: string
  userId: string
  type: string
  withdrawMethod: string
  typeDesc: string
  withdrawMethodDesc: string
  amount: number
  feeAmount: number
  netAmount: number
  status: WithdrawStatus
  statusDesc: string
  createdAt: string
  finishedAt: string
  failReason: string
  // ===== 以下字段后端 `AdminWithdrawVO`（待审核 / 异常提现列表）已返回 =====
  // 此前前端未声明也未展示，导致「银行卡提现看不到卡号」，财务无法人工转账。
  /** 脱敏姓名（首字 + `**`）；未实名认证为 null。 */
  maskedName?: string | null
  /** 脱敏身份证号（`******` + 后 4 位）；未实名认证为 null。 */
  maskedCertNo?: string | null
  /** 用户手机号（**B 端不脱敏**）。 */
  phone?: string
  /** 提现时留存的实名姓名快照（银行卡提现即持卡人）。 */
  realnameSnapshot?: string | null
  /** 提现时留存的银行卡快照（微信零钱提现为 null）—— **财务人工转账必需**。 */
  bankCardSnapshot?: string | null
  /** 微信商户转账单号（微信零钱打款后回填；银行卡人工转账为 null）。 */
  wxTransferBillNo?: string | null
  /** 审核人（管理员账号 ID）；未审核为 null。 */
  reviewedBy?: string | null
  /** 审核时间；未审核为 null。 */
  reviewedAt?: string | null
}

export interface WithdrawResponse<T> {
  code: number
  message: string
  data?: T | null
  success?: boolean
}

export type WithdrawPage = PaginationResult<Withdrawal> & { page: number; pageSize: number }

/**
 * 提现交易记录（B 端**全量提现单**，`GET /api/admin/withdraw/records`）。
 * 面向后台对账：字段与待审核/异常列表的 `AdminWithdrawVO` 同源，本类型直接复用 `Withdrawal`。
 * 字段口径见《B端-提现交易记录接口与字段-2026-09-15》。
 */
export type WithdrawRecord = Withdrawal

/** 提现交易记录查询参数（全部可选，组合生效；`status` 多值用英文逗号分隔）。 */
export interface WithdrawRecordQuery {
  /** 多值：`PENDING_REVIEW,APPROVED,SUCCESS,FAILED,REJECTED,STUCK`。 */
  status?: string
  /** `PROMOTION` / `BONUS` / `BALANCE`。 */
  type?: string
  /** `WECHAT_BALANCE` / `BANK_CARD`。 */
  withdrawMethod?: string
  /** 用户 ID（精确匹配）。 */
  userId?: string
  /** 提现单号（精确匹配）。 */
  withdrawNo?: string
  /** 用户手机号（精确匹配）。 */
  phone?: string
  /** 申请时间起（含），`yyyy-MM-dd HH:mm:ss`。 */
  startTime?: string
  /** 申请时间止（含）。 */
  endTime?: string
  page: number
  size: number
}

export type WithdrawRecordPage = PaginationResult<WithdrawRecord> & { page: number; pageSize: number }
