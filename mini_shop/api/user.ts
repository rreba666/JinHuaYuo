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
  /** 待提现推广金（已入账、可一键转余额或提现）。 */
  pendingPromotion: number
  /**
   * 待到账推广金（元）：已产生但未过 7 天退款窗口、尚未入账的部分（2026-09-16 后端新增）。
   * **推广收益合计 = pendingPromotion + unsettledPromotion**，前端不再自行按明细汇总。
   */
  unsettledPromotion?: number
  pendingBonus: number
  totalIncome: number
}

export type WithdrawType = 'PROMOTION' | 'BONUS' | 'BALANCE'

/** 提现收款方式，两种方式均由后台按提现记录人工打款。 */
export type WithdrawMethod = 'WECHAT_BALANCE' | 'BANK_CARD'

export interface WithdrawDTO {
  amount: number
  type: WithdrawType
  withdrawMethod: WithdrawMethod
  idempotencyKey: string
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

/**
 * 提现规则（对应 `WithdrawRuleVO`，`GET /api/wallet/withdraw-rules`）。
 * 提现页展示与金额下限前置校验用；**实际下限与限额仍由后端二次校验**。
 * 不含任何测试豁免配置（后端刻意不下发）。
 */
/**
 * 单类收益（`type`）的提现口径 —— 对应 `withdraw-rules` 响应里的 `byType[type]`（2026-09-24 后端新增）。
 *
 * ⚠️ 口径变更（2026-09-24）：提现锁定期由「账户级：240 小时内有无已支付订单」改为「**每笔收益各自**解锁」，
 * 解锁时刻 = **该笔收益来源订单**的支付时间 + `payLockDays`。
 * 所以必须按 `type` 分开看：推广金 `PROMOTION`、红包 `BONUS`、余额 `BALANCE`。
 * 这解决了「账户里早就有钱、只因最近买过东西就全都提不出来」的问题。
 */
export interface WithdrawTypeQuota {
  /** 该口径对应的扣款来源。 */
  type: WithdrawType
  /** **当前可提现金额**（元）—— 提现金额上限按它校验。 */
  withdrawableAmount: number
  /** **锁定中金额**（元）：尚未到解锁时刻、当前提不出来的部分。 */
  lockedAmount: number
  /** **下一笔**解锁时刻（`yyyy-MM-dd HH:mm:ss`）；`null` = 当前无锁定。 */
  nextUnlockAt?: string | null
  /** 下一笔解锁金额（元）。 */
  nextUnlockAmount: number
  /** 该类收益的待处理金额（元，含锁定部分）。 */
  pendingAmount: number
  /** 后端拼好的提示文案（例：「当前可提现 ¥12.00；另有 ¥204.30 锁定中，2026-10-01 14:24:01 后解锁」）；无锁定时可能为 `null`。 */
  message?: string | null
}

export interface WithdrawRules {
  /** 最低提现金额（元），后端已按当前登录用户身份计算。 */
  minAmount: number
  /** 手续费率（0~1 小数，如 0.05 = 5%）。 */
  feeRate: number
  /** 每日累计提现金额上限（元）。 */
  dailyAmountLimit: number
  /** 每日提现次数上限。 */
  dailyCountLimit: number
  /** 同时处理中的提现笔数上限。 */
  maxConcurrent: number
  /** 当前提现冻结总额上限（元）。 */
  frozenLimit: number
  /** 支付后锁定期天数（**每笔收益各自的来源订单**支付时刻起 N×24 小时内不可提现）。 */
  payLockDays: number
  /**
   * 本次口径对应的扣款来源，默认 `BALANCE`（2026-09-24 新增）。
   * ⚠️ 与「提现方式」（`WECHAT_BALANCE` 零钱 / `BANK_CARD` 银行卡）**不是一个维度**，别混。
   */
  type?: WithdrawType
  /** **当前可提现金额**（元，2026-09-24 新增）—— 提现金额上限按它校验。 */
  withdrawableAmount?: number
  /** **锁定中金额**（元，2026-09-24 新增）。 */
  lockedAmount?: number
  /** **下一笔**解锁时刻；`null` = 当前无锁定（2026-09-24 新增）。 */
  nextUnlockAt?: string | null
  /** 下一笔解锁金额（元，2026-09-24 新增）。 */
  nextUnlockAmount?: number
  /**
   * 三类收益各自的口径（2026-09-24 新增）。
   * 提现页取 `byType.BALANCE`、推广金页取 `byType.PROMOTION`、红包页取 `byType.BONUS`。
   */
  byType?: Partial<Record<WithdrawType, WithdrawTypeQuota>>
  /**
   * 下次可提现时刻（`yyyy-MM-dd HH:mm:ss`）。
   *
   * ⚠️ **语义已变更（2026-09-24）**：由「全部订单的解锁时刻」改为「**本次 `type`（默认 `BALANCE`）的下一笔解锁时刻**」。
   * 于是余额页拿到的是 **`null`**（余额恒为可提）⇒ 不要再把它当作「整账户是否被锁」的判据，
   * 也不要再用它拼「最近有订单支付，暂时无法提现」这种一刀切文案（那套账户级锁定已下线）。
   */
  nextWithdrawableAt?: string | null
}

/** 查询提现规则（后台配置驱动提现页文案与校验，避免前端写死金额/次数）。 */
export function getWithdrawRules(): Promise<WithdrawRules> {
  return request<WithdrawRules>({ url: '/api/wallet/withdraw-rules', method: 'GET' })
}

/** 一键转余额，默认可由推广金或红包发起。 */
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

/** 提交指定类型的钱包提现申请，后端要求金额最低 1，且每次申请必须携带幂等键。 */
export function withdrawWallet(amount: number, type: WithdrawType, withdrawMethod: WithdrawMethod, idempotencyKey: string): Promise<void> {
  const data: WithdrawDTO = {
    amount: Number(amount.toFixed(2)),
    type,
    withdrawMethod,
    idempotencyKey,
  }
  return request<void>({ url: '/api/wallet/withdraw', method: 'POST', data })
}

/** 分页查询当前用户的提现记录。 */
export function getWithdrawals(page = 1, pageSize = 20): Promise<WithdrawPageResult> {
  return request<WithdrawPageResult>({
    url: `/api/wallet/withdrawals?page=${page}&pageSize=${pageSize}`,
    method: 'GET',
  })
}

/** 红包槽位（对应 DividendSlotVO，用于红包来源列表）。 */
export interface DividendSlot {
  /** 槽位 ID（int64，序列化为字符串） */
  id: string
  /** 商品名称（红包来源） */
  productName: string
  /** 商品价格（槽位基准价） */
  productPrice: number
  /** 红包上限（=价格×1.5） */
  capAmount: number
  /** 本槽位累计已领红包 */
  totalReceived: number
  /** 是否锁死：0=活跃, 1=已锁死 */
  locked: number
  /** 锁死时间（未锁死为 null） */
  lockedAt: string | null
  /** 开槽位时间 */
  createTime: string
}

/** 红包槽位列表。 */
export interface DividendSlotList {
  availablePurchase: number
  totalPurchases: number
  slots: DividendSlot[]
}

/** 查询红包槽位列表（红包来源）。 */
export async function getDividendSlots(): Promise<DividendSlotList> {
  const result = await request<DividendSlotList>({ url: '/api/wallet/dividend-slots', method: 'GET' })
  return {
    ...result,
    slots: (result.slots || []).map((slot) => ({ ...slot, id: String(slot.id) })),
  }
}

/** 红包流水（逐笔，对应 DividendRecordVO，红包页来源列表用）。 */
export interface DividendRecord {
  /** 红包流水 ID（int64，序列化为字符串） */
  id: string
  /** 红包来源（商品名） */
  productName: string
  /** 本笔红包金额（积分，纯数值） */
  amount: number
  /** 红包到账时间（yyyy-MM-dd HH:mm:ss） */
  createTime: string
  /**
   * 红包**来源类型**（2026-09-23 新增）：
   * `DIVIDEND` 平台红包 / `SPECIAL_SUBSIDY` 特殊商品补贴。
   * ⚠️ 后端 `default-property-inclusion: non_null` ⇒ 老数据可能**整个 key 都不存在**。
   */
  sourceType?: string
  /**
   * 来源中文名（后端下发，文档标注"可直接展示"）。
   * ⚠️ 但本项目的展示口径是**前端映射**：`SPECIAL_SUBSIDY` 要显示成「**商品补贴**」
   * （后端下发的是"特殊补贴"）⇒ 见 `sourceTagText()`，本字段仅作兜底。
   */
  sourceTypeDesc?: string
}

/** 红包流水分页结果。 */
export interface DividendRecordPage {
  total: number
  list: DividendRecord[]
  page: number
  pageSize: number
}

/** 分页查询红包明细流水（按到账时间倒序）。 */
export async function getDividendRecords(params: { page?: number; pageSize?: number } = {}): Promise<DividendRecordPage> {
  const query = `page=${encodeURIComponent(String(params.page || 1))}&pageSize=${encodeURIComponent(String(params.pageSize || 10))}`
  const result = await request<DividendRecordPage>({ url: `/api/wallet/dividend-records?${query}`, method: 'GET' })
  return { ...result, list: (result.list || []).map((record) => ({ ...record, id: String(record.id) })) }
}
