/**
 * 设备标识（2026-09-19 多账号套现风控）
 *
 * **用途**：登录时随 `AuthLoginDTO.deviceId` 上报，后端用于
 * ① 「Token 绑定设备 + 检测异常登录」；② 在「一证一号」冲突时把 `deviceId` 写进
 * `realname_duplicate_log`，供后台排查同一物理设备上的多个账号。
 *
 * ⚠️ **微信不提供硬件级设备 ID**（隐私限制，`getSystemInfoSync().deviceId` 在多数机型为空），
 * 因此本模块的策略是：
 * 1. 优先用系统下发的 `deviceId`（有则最准）；
 * 2. 否则用**本地持久化的随机串**兜底 —— 同一设备在小程序数据未被清除时保持稳定。
 *
 * ⚠️ **它不是强标识**：用户清除小程序数据 / 重装后会变成新值。所以它的定位是
 * **提高多开成本 + 辅助风控排查**，而不是拦截依据；
 * 真正的硬拦截以**实名（含「一证一号」）**为准 —— 见 `utils/realname-gate.ts`。
 */
const DEVICE_ID_KEY = 'dsh_device_id'

/** 读取（必要时生成并持久化）当前设备标识；异常时返回空串（后端该字段可选，不传即可）。 */
export function getDeviceId(): string {
  try {
    const info = uni.getSystemInfoSync() as { deviceId?: string }
    if (info?.deviceId) return info.deviceId
  } catch {
    // 忽略：拿不到系统 deviceId 时走下面的本地兜底
  }
  try {
    const cached = uni.getStorageSync(DEVICE_ID_KEY)
    if (typeof cached === 'string' && cached) return cached
    const generated = `dsh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    uni.setStorageSync(DEVICE_ID_KEY, generated)
    return generated
  } catch {
    return ''
  }
}
