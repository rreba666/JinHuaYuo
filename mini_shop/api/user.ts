import { request } from '@/utils/request'

/** 后端用户身份值，兼容 OpenAPI 枚举的数字和字符串序列化。 */
export type UserIdentity = 0 | 1 | '0' | '1'

/** 用户信息（对应 UserProfileVO） */
export interface UserProfile {
  id: number
  nickname: string
  avatarUrl: string
  phone: string
  identity: UserIdentity
  banStatus: number
}

/** 钱包信息（对应 WalletVO） */
export interface WalletInfo {
  balance: number
  pendingPromotion: number
  pendingBonus: number
  totalIncome: number
}

export type WithdrawType = 'PROMOTION' | 'BONUS' | 'BALANCE'

export interface WithdrawDTO {
  amount: number
  type: WithdrawType
}

export interface BalanceTransferDTO {
  toUserId: number
  amount: number
}

export interface UserSearchVO {
  id: number
  nickname: string
  avatarUrl: string
}

/** 提现记录（对应 WithdrawRecordVO）。 */
export interface WithdrawRecord {
  withdrawNo: string
  type: WithdrawType
  typeDesc: string
  amount: number
  status: string
  statusDesc: string
  createdAt: string
  finishedAt?: string | null
  failReason?: string | null
}

/** 提现记录分页结果。 */
export interface WithdrawPageResult {
  total: number
  list: WithdrawRecord[]
  page: number
  pageSize: number
}

/** 获取当前登录用户信息 */
export function getUserProfile(): Promise<UserProfile> {
  return request<UserProfile>({ url: '/api/user/profile', method: 'GET' })
}

/** 获取用户钱包信息 */
export function getWalletInfo(): Promise<WalletInfo> {
  return request<WalletInfo>({ url: '/api/wallet/info', method: 'GET' })
}

/** 一键转余额，默认可由推广金或分红发起。 */
export function convertWallet(type: Exclude<WithdrawType, 'BALANCE'>): Promise<void> {
  return request<void>({
    url: `/api/wallet/convert?type=${encodeURIComponent(type)}`,
    method: 'POST',
  })
}

/** 按用户 ID 搜索转账接收方。 */
export function searchUser(targetUserId: number): Promise<UserSearchVO> {
  return request<UserSearchVO>({
    url: `/api/user/search?targetUserId=${encodeURIComponent(targetUserId)}`,
    method: 'GET',
  })
}

/** 提交余额转账。 */
export function transferWallet(data: BalanceTransferDTO): Promise<void> {
  return request<void>({ url: '/api/wallet/transfer', method: 'POST', data })
}

/** 修改用户信息 */
export function updateUserProfile(data: Partial<UserProfile>): Promise<UserProfile> {
  return request<UserProfile>({ url: '/api/user/profile', method: 'PUT', data })
}

/** 提交指定类型的钱包提现申请，后端要求金额最低 1。 */
export function withdrawWallet(amount: number, type: WithdrawType = 'BALANCE'): Promise<void> {
  return request<void>({ url: '/api/wallet/withdraw', method: 'POST', data: { amount, type } as WithdrawDTO })
}

/** 分页查询当前用户的提现记录。 */
export function getWithdrawals(page = 1, pageSize = 20): Promise<WithdrawPageResult> {
  return request<WithdrawPageResult>({
    url: `/api/wallet/withdrawals?page=${page}&pageSize=${pageSize}`,
    method: 'GET',
  })
}
