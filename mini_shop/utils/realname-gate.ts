/**
 * 「转余额前实名」门禁（今华有肽 C 端，2026-09-19）
 *
 * 背景：**红包**与**推广金**都通过同一个接口 `convertWallet(type)` 一键转成**通用余额**
 * （`api/user.ts` 注释：「一键转余额，默认可由推广金或红包发起」），
 * 而余额可支付（`/api/pay/balance`「用钱包余额全额抵扣订单」）、可提现（需实名）。
 *
 * 于是存在一条**绕开提现实名**的套现闭环：
 *   多开微信号（各自 userId）→ 各自下单领红包 → **转余额（原先无任何实名校验）** → 余额支付买货 → 实物到手。
 * 提现实名那道墙完全没碰到，恶意用户零成本获利。
 *
 * 对策：把实名卡在**「转余额」这一个动作**上 —— 红包与推广金共用同一接口，一刀切两条路。
 * 正常用户「浏览 / 下单 / 肽金券抵扣」全程不触碰本门禁，只有要把平台送的权益变成**通用余额**时才需实名。
 *
 * ⚠️ 前端门禁只负责**体验与引导**，真正的拦截必须由后端在 `/api/wallet/convert` 上实施
 * （前端可被绕过 —— 直接调接口即可）。对应后端需求见 `docs/logs/` 主题日志。
 */
import { ref } from 'vue'
import { getRealnameStatus } from '@/api/realname'

export function useConvertRealnameGate() {
  /** 实名弹层显隐：页面把它绑到 `<RealnameVerifySheet v-model="...">`。 */
  const sheetVisible = ref(false)
  /** 是否正在查询实名状态（防连点）。 */
  const checking = ref(false)
  /** 认证成功后要续跑的动作（就是「再转一次余额」）。 */
  let resumeAction: (() => void) | null = null

  /**
   * 转余额前调用。
   * - 已实名 → 返回 `true`，调用方继续执行转账；
   * - 未实名 → 打开实名弹层并返回 `false`；认证成功后会执行 `onVerified` 续跑（用户无需再点一次）。
   *
   * 查询失败时**按未实名处理**（与提现页 `withdraw.vue` 一致）——宁可多要一次实名，也不放行未经核验的转账。
   */
  async function ensureRealname(onVerified?: () => void): Promise<boolean> {
    if (checking.value) return false
    checking.value = true
    try {
      const status = await getRealnameStatus()
      if (status?.verified) return true
      resumeAction = onVerified || null
      sheetVisible.value = true
      return false
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : '实名认证状态查询失败', icon: 'none' })
      return false
    } finally {
      checking.value = false
    }
  }

  /** 实名认证成功回调：关闭弹层并续跑被拦下的转账。 */
  function handleVerified(): void {
    sheetVisible.value = false
    const action = resumeAction
    resumeAction = null
    action?.()
  }

  /**
   * 后端返回 **`8601 未实名`** 时调用（`/api/wallet/convert` 与 `/api/wallet/withdraw` 共用该码）。
   *
   * 与 `ensureRealname()` 的分工：
   * - `ensureRealname()` 是**前置拦截**（先查状态，未实名就不发请求）——体验好，省一次无效请求；
   * - 本函数是**后端兜底**（前置查询失败、状态过期、或别处直接调接口时）——保证任何路径都不会漏。
   * 两者都指向同一个实名弹层，认证成功后都会续跑原动作。
   */
  function handleConvertDenied(onVerified?: () => void): void {
    resumeAction = onVerified || null
    sheetVisible.value = true
  }

  return { sheetVisible, checking, ensureRealname, handleVerified, handleConvertDenied }
}
