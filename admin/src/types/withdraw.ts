import type { PaginationResult } from './common'

export type WithdrawStatus = 'PENDING_REVIEW' | 'STUCK' | 'APPROVED' | string

export interface Withdrawal {
  id: string
  withdrawNo: string
  userId: string
  amount: number
  status: WithdrawStatus
  createdAt: string
}

export interface WithdrawResponse<T> {
  code: number
  message: string
  data?: T | null
  success?: boolean
}

export type WithdrawPage = PaginationResult<Withdrawal> & { page: number; pageSize: number }
