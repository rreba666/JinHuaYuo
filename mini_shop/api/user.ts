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

/** 提现收款方式，当前后端仅支持银行卡人工打款。 */
export type WithdrawMethod = 'BANK_CARD'

export interface WithdrawDTO {
  amount: number
  type: WithdrawType
  withdrawMethod?: WithdrawMethod
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
  withdrawMethod: WithdrawMethod
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
export function withdrawWallet(amount: number, type: WithdrawType = 'BALANCE', withdrawMethod?: WithdrawMethod): Promise<void> {
  const data = { amount, type, ...(withdrawMethod ? { withdrawMethod } : {}) }
  return request<void>({ url: '/api/wallet/withdraw', method: 'POST', data: data as WithdrawDTO })
}

/** 分页查询当前用户的提现记录。 */
export function getWithdrawals(page = 1, pageSize = 20): Promise<WithdrawPageResult> {
  return request<WithdrawPageResult>({
    url: `/api/wallet/withdrawals?page=${page}&pageSize=${pageSize}`,
    method: 'GET',
  })
}

/** 分红槽位（对应 DividendSlotVO，用于红包来源列表）。 */
export interface DividendSlot {
  /** 槽位 ID（int64，序列化为字符串） */
  id: string
  /** 商品名称（红包来源） */
  productName: string
  /** 商品价格（槽位基准价） */
  productPrice: number
  /** 分红上限（=价格×1.5） */
  capAmount: number
  /** 本槽位累计已领分红 */
  totalReceived: number
  /** 是否锁死：0=活跃, 1=已锁死 */
  locked: number
  /** 锁死时间（未锁死为 null） */
  lockedAt: string | null
  /** 开槽位时间 */
  createTime: string
}

/** 分红槽位列表。 */
export interface DividendSlotList {
  availablePurchase: number
  totalPurchases: number
  slots: DividendSlot[]
}

/** 查询分红槽位列表（红包来源）。 */
export async function getDividendSlots(): Promise<DividendSlotList> {
  const result = await request<DividendSlotList>({ url: '/api/wallet/dividend-slots', method: 'GET' })
  return {
    ...result,
    slots: (result.slots || []).map((slot) => ({ ...slot, id: String(slot.id) })),
  }
}

/** 分红流水（逐笔，对应 DividendRecordVO，红包页来源列表用）。 */
export interface DividendRecord {
  /** 分红流水 ID（int64，序列化为字符串） */
  id: string
  /** 红包来源（商品名） */
  productName: string
  /** 本笔分红金额（积分，纯数值） */
  amount: number
  /** 分红到账时间（yyyy-MM-dd HH:mm:ss） */
  createTime: string
}

/** 分红流水分页结果。 */
export interface DividendRecordPage {
  total: number
  list: DividendRecord[]
  page: number
  pageSize: number
}

/** 分页查询分红明细流水（按到账时间倒序）。 */
export async function getDividendRecords(params: { page?: number; pageSize?: number } = {}): Promise<DividendRecordPage> {
  const query = `page=${encodeURIComponent(String(params.page || 1))}&pageSize=${encodeURIComponent(String(params.pageSize || 10))}`
  const result = await request<DividendRecordPage>({ url: `/api/wallet/dividend-records?${query}`, method: 'GET' })
  return { ...result, list: (result.list || []).map((record) => ({ ...record, id: String(record.id) })) }
}
