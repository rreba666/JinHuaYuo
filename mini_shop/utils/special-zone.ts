import { isApiRequestError } from '@/utils/request'

/**
 * 「复购专区 / 特殊商品」的门禁与引导（2026-09-23）。
 *
 * ## 为什么要单独抽出来
 * 特殊商品**仅注册用户可见可买**，而它的失败形态很有迷惑性：
 *
 * | 场景 | 后端返回 |
 * |---|---|
 * | 未登录 / token 失效 | **401 + `code=1003`** |
 * | **已登录但还不是注册用户**（`identity=0`） | **`200` + `code=1004`**「仅注册用户可见」 |
 *
 * ⚠️ **游客不是 401**（他确实登录了，只是身份不够）⇒ 用「401 就跳登录」的通用逻辑处理它会走错路。
 *
 * ## ⚠️ 解锁方式：买任意**普通商品**
 * 任意订单**支付成功**（物流单）或**核销**（自提单）后，后端会把 `identity` 从 `0` 自动升为 `1`。
 * ⇒ 引导文案**只能**写"购买任意普通商品后即可解锁"，
 * ⛔ **不要**写成"完成实名认证""充值"之类的错误引导（会把人带偏）。
 *
 * ## 使用位置（本轮尚未接入，等后端就绪后接上）
 * - 专区页 / 分类里点「复购专区」：拿到 `1004` ⇒ `showSpecialLockedGuide()`；
 * - 商品详情页打开特殊商品：同上（后端此时**不返回任何商品内容**，所以**必须先判 code，再渲染**）；
 * - 购物车加购 / 下单特殊商品：同上。
 */

/** 后端门禁错误码：**已登录但不是注册用户**（`identity=0`）。 */
export const SPECIAL_LOCKED_CODE = 1004

/** 未登录 / token 失效的通用错误码（与门禁区分开）。 */
export const NOT_LOGGED_IN_CODE = 1003

/** 统一引导文案（⚠️ 别改写成实名/充值之类）。 */
export const SPECIAL_LOCKED_GUIDE = '该商品为复购专区专属，购买任意普通商品后即可解锁'

/**
 * 是否命中「仅注册用户」门禁。
 *
 * ⚠️ 只认 `code === 1004`，**不要**用 `message` 判断（后端文案会改）。
 */
export function isSpecialLockedError(error: unknown): boolean {
  return isApiRequestError(error) && Number(error.code) === SPECIAL_LOCKED_CODE
}

/**
 * 是否「需要先登录」（用于与门禁区分：这个才该去引导登录）。
 */
export function isNotLoggedInError(error: unknown): boolean {
  if (!isApiRequestError(error)) return false
  return Number(error.code) === NOT_LOGGED_IN_CODE
}

/**
 * 统一展示门禁引导。
 *
 * 用 toast 而非弹窗：它在"点开商品/专区"这类**高频动作**里出现，
 * 弹窗会打断操作；文案已经说清了解锁方式。
 */
export function showSpecialLockedGuide(): void {
  uni.showToast({ title: SPECIAL_LOCKED_GUIDE, icon: 'none', duration: 2600 })
}
