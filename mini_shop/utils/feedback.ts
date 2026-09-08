/**
 * 统一成功反馈：图标 toast + 短震动，提升操作确认感（替代原生弱反馈 toast）。
 * 用于接收地址/银行卡等"填写并保存"的操作，让用户明确知道提交成功。
 */
export function successToast(title: string): void {
  // 轻震动（真机有效；部分平台不支持时静默忽略）
  try { uni.vibrateShort() } catch { /* 忽略 */ }
  uni.showToast({ title, icon: 'success', duration: 1800 })
}
