import { request } from '@/utils/request'

/** 银行字典（对应 BankEntity）。 */
export interface Bank {
  /** 银行编码。 */
  bankCode: string
  /** 银行名称。 */
  bankName: string
  /** 排序权重。 */
  sort?: number
}

/** 查询银行字典，用于银行卡绑定下拉选择。 */
export function getBankList(): Promise<Bank[]> {
  return request<Bank[]>({ url: '/api/bank/list', method: 'GET' }).then((list) => (Array.isArray(list) ? list : []))
}
