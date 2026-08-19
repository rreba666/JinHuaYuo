import { request } from '@/utils/request'

export interface PrepayParams {
  timeStamp: string
  nonceStr: string
  package: string
  signType: string
  paySign: string
}

/** 获取微信 JSAPI 支付签名参数。 */
export function createPrepay(orderId: number | string): Promise<PrepayParams> {
  return request<PrepayParams>({ url: '/api/pay/prepay', method: 'POST', data: { orderId } })
}

/** 调起微信小程序支付收银台。 */
export function requestPayment(params: PrepayParams): Promise<void> {
  return new Promise((resolve, reject) => {
    uni.requestPayment({
      timeStamp: params.timeStamp,
      nonceStr: params.nonceStr,
      package: params.package,
      signType: params.signType,
      paySign: params.paySign,
      success: () => resolve(),
      fail: (error) => reject(new Error(error.errMsg || '微信支付未完成')),
    })
  })
}

/** 余额支付：用钱包余额全额抵扣订单，同步完成（无微信回调）。余额不足时后端返回错误。 */
export function payByBalance(orderId: number | string): Promise<void> {
  return request<void>({ url: '/api/pay/balance', method: 'POST', data: { orderId } })
}
