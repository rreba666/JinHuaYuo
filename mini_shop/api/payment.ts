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
