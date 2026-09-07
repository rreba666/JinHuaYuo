import { request } from '@/utils/request'

/** 提现银行卡（对应设置页后端接口清单：user_bank_card，列表只返回脱敏卡号）。 */
export interface BankCard {
  id: number | string
  bankName: string
  cardNoMasked: string
  holderName: string
  isDefault: number
}

/** 绑定/修改银行卡请求（仅提交时含完整卡号，后端 AES 加密存储）。 */
export interface BankCardPayload {
  bankName: string
  cardNo: string
  holderName: string
  phone?: string
  isDefault?: number
}

/** 查询当前用户银行卡列表（只返回脱敏卡号）。 */
export function getBankCardList(): Promise<BankCard[]> {
  return request<BankCard[]>({ url: '/api/user/bank-card/list', method: 'GET' })
}

/** 绑定银行卡（校验卡号/持卡人与实名一致）。 */
export function createBankCard(payload: BankCardPayload): Promise<BankCard> {
  return request<BankCard>({ url: '/api/user/bank-card', method: 'POST', data: payload })
}

/** 修改银行卡。 */
export function updateBankCard(id: number | string, payload: BankCardPayload): Promise<BankCard> {
  return request<BankCard>({ url: `/api/user/bank-card/${id}`, method: 'PUT', data: payload })
}

/** 解绑银行卡（软删）。 */
export function deleteBankCard(id: number | string): Promise<void> {
  return request<void>({ url: `/api/user/bank-card/${id}`, method: 'DELETE' })
}

/** 设为默认银行卡。 */
export function setDefaultBankCard(id: number | string): Promise<void> {
  return request<void>({ url: `/api/user/bank-card/${id}/default`, method: 'PUT' })
}
