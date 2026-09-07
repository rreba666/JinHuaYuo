import { request } from '@/utils/request'

export type InvoiceType = 1 | 2
export type InvoiceStatus = 0 | 1 | 2 | 4

export interface InvoiceSubmitDTO {
  type: InvoiceType
  personalName?: string
  companyName?: string
  taxNo?: string
  email: string
  orderIds: string
}

export interface InvoiceRequest {
  id: number | string
  type: InvoiceType
  personalName?: string
  companyName?: string
  taxNo?: string
  email: string
  amount: number
  orderIds: string
  status: InvoiceStatus
  statusDesc: string
  invoiceNo?: string
  createTime: string
  updateTime: string
}

/** 提交发票申请（下单确认页用），金额由后端根据订单实付金额计算。 */
export function submitInvoice(data: InvoiceSubmitDTO): Promise<InvoiceRequest> {
  return request<InvoiceRequest>({ url: '/api/invoice/submit', method: 'POST', data })
}
