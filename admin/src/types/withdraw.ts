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
}

export interface WithdrawResponse<T> {
  code: number
  message: string
  data?: T | null
  success?: boolean
}

export type WithdrawPage = PaginationResult<Withdrawal> & { page: number; pageSize: number }
