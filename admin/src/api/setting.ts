import { request } from './request'
import type { ApiResponse } from './request'
import type { DividendCap, DividendCapSaveDTO, ProfitRatesConfig, ProfitRatesSaveDTO, RandomDividendConfig, RandomFloatConfig, SlotCountConfig, SysConfig, SysConfigSaveDTO, WithdrawRulesConfig, WithdrawRulesSaveDTO } from '@/types/setting'
import { DEFAULT_DIVIDEND_RATE, DEFAULT_PROMOTION_RATE } from '@/utils/productPricing'

const CUSTOMER_SERVICE_KEY = 'customer_service_phone'
const DEFAULT_DIVIDEND_MULTIPLIER = 1.5
const PROFIT_RATES_PATH = '/api/admin/setting/profit-rates'

/** 读取客服电话配置。未配置时返回空表单值，不创建后端历史配置。ADMIN 无权限访问时按业务错误处理，不触发登录跳转。 */
export async function getCustomerServiceConfig(): Promise<SysConfig> {
  const response = await request.get<ApiResponse<SysConfig | null>>('/api/admin/setting/customer-service', { skipAuthRedirect: true })
  const result = response.data
  ensureSuccess(result, '客服电话配置查询失败')
  return normalizeSysConfig(result.data)
}

/** 保存固定 key 的客服电话配置。 */
export async function saveCustomerServiceConfig(payload: SysConfigSaveDTO): Promise<void> {
  const response = await request.post<ApiResponse<null>>('/api/admin/setting/customer-service', {
    ...payload,
    configKey: CUSTOMER_SERVICE_KEY,
  })
  ensureSuccess(response.data, '客服电话配置保存失败')
}

/** 读取红包倍率；后端未配置或返回非有限值时使用约定默认值。ADMIN 无权限访问时按业务错误处理，不触发登录跳转。 */
export async function getDividendCap(): Promise<DividendCap> {
  const response = await request.get<ApiResponse<DividendCap | null>>('/api/admin/setting/dividend-cap', { skipAuthRedirect: true })
  const result = response.data
  ensureSuccess(result, '红包上限倍率查询失败')
  const data: Partial<DividendCap> = result.data || {}
  const multiplier = Number(data.multiplier)
  return {
    multiplier: Number.isFinite(multiplier) ? multiplier : DEFAULT_DIVIDEND_MULTIPLIER,
    remark: String(data.remark ?? ''),
  }
}

/** 保存红包倍率，避免无效值绕过页面控件提交。 */
export async function saveDividendCap(payload: DividendCapSaveDTO): Promise<void> {
  const multiplier = Number(payload.multiplier)
  if (!Number.isFinite(multiplier) || multiplier < 0.01 || multiplier > 100) {
    throw new Error('红包上限倍率必须在 0.01 到 100 之间')
  }
  const response = await request.post<ApiResponse<null>>('/api/admin/setting/dividend-cap', {
    ...payload,
    multiplier,
  })
  ensureSuccess(response.data, '红包上限倍率保存失败')
}

/** 每日随机红包下限/上限（元）。读取失败或未配置时返回默认值。 */
const RANDOM_DIVIDEND_MIN_KEY = 'dividend_random_min'
const RANDOM_DIVIDEND_MAX_KEY = 'dividend_random_max'
const DEFAULT_RANDOM_MIN = 10
const DEFAULT_RANDOM_MAX = 50

/** 读取每日随机红包配置（下限/上限，元）。 */
export async function getRandomDividendConfig(): Promise<RandomDividendConfig> {
  const [minRes, maxRes] = await Promise.all([
    request.get<ApiResponse<SysConfig | null>>('/api/admin/setting/dividend-random-min', { skipAuthRedirect: true }),
    request.get<ApiResponse<SysConfig | null>>('/api/admin/setting/dividend-random-max', { skipAuthRedirect: true }),
  ])
  try { ensureSuccess(minRes.data, '红包下限查询失败') } catch { /* 未配置时用默认 */ }
  try { ensureSuccess(maxRes.data, '红包上限查询失败') } catch { /* 未配置时用默认 */ }
  const minValue = Number(minRes.data?.data?.configValue)
  const maxValue = Number(maxRes.data?.data?.configValue)
  return {
    minAmount: Number.isFinite(minValue) && minValue > 0 ? minValue : DEFAULT_RANDOM_MIN,
    maxAmount: Number.isFinite(maxValue) && maxValue > 0 ? maxValue : DEFAULT_RANDOM_MAX,
    remark: String(minRes.data?.data?.remark ?? ''),
  }
}

/** 保存每日随机红包配置（下限/上限，元）。 */
export async function saveRandomDividendConfig(payload: { minAmount: number; maxAmount: number; remark?: string }): Promise<void> {
  const minAmount = Number(payload.minAmount)
  const maxAmount = Number(payload.maxAmount)
  if (!Number.isFinite(minAmount) || minAmount < 0) throw new Error('红包下限必须为非负数字')
  if (!Number.isFinite(maxAmount) || maxAmount < minAmount) throw new Error('红包上限必须不小于下限')
  const results = await Promise.all([
    request.post<ApiResponse<null>>('/api/admin/setting/dividend-random-min', { configKey: RANDOM_DIVIDEND_MIN_KEY, configValue: String(minAmount), remark: payload.remark }),
    request.post<ApiResponse<null>>('/api/admin/setting/dividend-random-max', { configKey: RANDOM_DIVIDEND_MAX_KEY, configValue: String(maxAmount), remark: payload.remark }),
  ])
  ensureSuccess(results[0].data, '红包下限保存失败')
  ensureSuccess(results[1].data, '红包上限保存失败')
}

/** 分红随机浮动幅度配置键与默认值（池2起：每人金额 = 均分基准 ± 浮动幅度，元）。 */
const RANDOM_FLOAT_KEY = 'dividend_random_float'
const DEFAULT_RANDOM_FLOAT = 10

/** 读取分红随机浮动幅度配置；未配置或返回非有限值时使用约定默认值 10。 */
export async function getRandomFloatConfig(): Promise<RandomFloatConfig> {
  const response = await request.get<ApiResponse<SysConfig | null>>(`/api/admin/setting/${RANDOM_FLOAT_KEY}`, { skipAuthRedirect: true })
  const result = response.data
  try { ensureSuccess(result, '分红浮动幅度查询失败') } catch { /* 未配置时用默认 */ }
  const value = Number(result?.data?.configValue)
  return {
    floatAmount: Number.isFinite(value) && value >= 0 ? value : DEFAULT_RANDOM_FLOAT,
    remark: String(result?.data?.remark ?? ''),
  }
}

/** 保存分红随机浮动幅度配置（通用配置接口 POST /api/admin/setting/{configKey}），避免无效值绕过页面控件提交。 */
export async function saveRandomFloatConfig(payload: { floatAmount: number; remark?: string }): Promise<void> {
  const floatAmount = Number(payload.floatAmount)
  if (!Number.isFinite(floatAmount) || floatAmount < 0 || floatAmount > 100) throw new Error('浮动幅度必须在 0 到 100 之间')
  const response = await request.post<ApiResponse<null>>(`/api/admin/setting/${RANDOM_FLOAT_KEY}`, {
    configValue: String(floatAmount),
    remark: payload.remark,
  })
  ensureSuccess(response.data, '分红浮动幅度保存失败')
}

/** 分红槽位数量上限配置键与默认值（每用户最多活跃槽位数，默认 3）。 */
const SLOT_COUNT_KEY = 'dividend_slot_count'
const DEFAULT_SLOT_COUNT = 3

/** 读取分红槽位数量上限配置；未配置或返回非正整数时使用约定默认值 3。 */
export async function getSlotCountConfig(): Promise<SlotCountConfig> {
  const response = await request.get<ApiResponse<SysConfig | null>>(`/api/admin/setting/${SLOT_COUNT_KEY}`, { skipAuthRedirect: true })
  const result = response.data
  try { ensureSuccess(result, '槽位数量查询失败') } catch { /* 未配置时用默认 */ }
  const value = Number(result?.data?.configValue)
  return {
    slotCount: Number.isInteger(value) && value >= 1 ? value : DEFAULT_SLOT_COUNT,
    remark: String(result?.data?.remark ?? ''),
  }
}

/** 保存分红槽位数量上限配置（通用配置接口 POST /api/admin/setting/{configKey}）。 */
export async function saveSlotCountConfig(payload: { slotCount: number; remark?: string }): Promise<void> {
  const slotCount = Number(payload.slotCount)
  if (!Number.isInteger(slotCount) || slotCount < 1) throw new Error('槽位数量必须为不小于 1 的整数')
  const response = await request.post<ApiResponse<null>>(`/api/admin/setting/${SLOT_COUNT_KEY}`, {
    configValue: String(slotCount),
    remark: payload.remark,
  })
  ensureSuccess(response.data, '槽位数量保存失败')
}

/** 读取商品资金比例。ADMIN 无权限访问时按业务错误处理，不触发登录跳转。 */
export async function getProfitRatesConfig(): Promise<ProfitRatesConfig> {
  const response = await request.get<ApiResponse<ProfitRatesConfig | null>>(PROFIT_RATES_PATH, { skipAuthRedirect: true })
  const result = response.data
  ensureSuccess(result, '商品资金比例查询失败')
  return normalizeProfitRates(result.data)
}

/** 保存商品资金比例。 */
export async function saveProfitRatesConfig(payload: ProfitRatesSaveDTO): Promise<void> {
  const promotionRate = Number(payload.promotionRate)
  const bonusPoolRate = Number(payload.bonusPoolRate)
  if (!Number.isFinite(promotionRate) || promotionRate < 0 || promotionRate > 100) {
    throw new Error('推广资金比例必须在 0 到 100 之间')
  }
  if (!Number.isFinite(bonusPoolRate) || bonusPoolRate < 0 || bonusPoolRate > 100) {
    throw new Error('红包池比例必须在 0 到 100 之间')
  }
  const response = await request.post<ApiResponse<null>>(PROFIT_RATES_PATH, {
    ...payload,
    promotionRate,
    bonusPoolRate,
  })
  ensureSuccess(response.data, '商品资金比例保存失败')
}

export async function getWithdrawRules(): Promise<WithdrawRulesConfig> {
  const response = await request.get<ApiResponse<WithdrawRulesConfig | null>>('/api/admin/setting/withdraw-rules', { skipAuthRedirect: true })
  const result = response.data
  ensureSuccess(result, '提现规则查询失败')
  return normalizeWithdrawRules(result.data)
}

export async function saveWithdrawRules(payload: WithdrawRulesSaveDTO): Promise<void> {
  const data = normalizeWithdrawRules(payload)
  if (data.minAmount < 0 || data.dailyAmountLimit < 0 || data.testUserMinAmount < 0 || data.frozenLimit < 0) throw new Error('提现金额规则不能小于 0')
  if (!Number.isInteger(data.dailyCountLimit) || data.dailyCountLimit <= 0) throw new Error('每日提现次数必须为正整数')
  if (!Number.isInteger(data.maxConcurrent) || data.maxConcurrent <= 0) throw new Error('并行提现笔数必须为正整数')
  if (data.feeRate < 0 || data.feeRate > 1) throw new Error('手续费率必须在 0 到 1 之间')
  if (data.testUserId !== null && (!Number.isInteger(data.testUserId) || data.testUserId <= 0)) throw new Error('测试用户 ID 必须为正整数')
  const response = await request.post<ApiResponse<null>>('/api/admin/setting/withdraw-rules', data)
  ensureSuccess(response.data, '提现规则保存失败')
}

function normalizeSysConfig(value: SysConfig | null): SysConfig {
  const row = value || {} as SysConfig
  return {
    id: String(row.id ?? ''),
    configKey: String(row.configKey ?? CUSTOMER_SERVICE_KEY),
    configValue: String(row.configValue ?? ''),
    remark: String(row.remark ?? ''),
    createTime: String(row.createTime ?? ''),
    updateTime: String(row.updateTime ?? ''),
    delFlag: Number(row.delFlag ?? 0) || 0,
  }
}

function normalizeProfitRates(value: ProfitRatesConfig | null): ProfitRatesConfig {
  const row = value || {} as ProfitRatesConfig
  return {
    promotionRate: Number.isFinite(Number(row.promotionRate)) ? Number(row.promotionRate) : DEFAULT_PROMOTION_RATE,
    bonusPoolRate: Number.isFinite(Number(row.bonusPoolRate)) ? Number(row.bonusPoolRate) : DEFAULT_DIVIDEND_RATE,
    remark: String(row.remark ?? ''),
  }
}

function normalizeWithdrawRules(value: Partial<WithdrawRulesConfig> | null): WithdrawRulesConfig {
  const row = value || {}
  return {
    minAmount: toFiniteNumber(row.minAmount),
    dailyAmountLimit: toFiniteNumber(row.dailyAmountLimit),
    dailyCountLimit: toFiniteNumber(row.dailyCountLimit),
    feeRate: toFiniteNumber(row.feeRate),
    testUserMinAmount: toFiniteNumber(row.testUserMinAmount),
    testUserId: row.testUserId == null ? null : toFiniteNumber(row.testUserId),
    testSkipLock: row.testSkipLock === true,
    maxConcurrent: toFiniteNumber(row.maxConcurrent),
    frozenLimit: toFiniteNumber(row.frozenLimit),
    remark: String(row.remark ?? ''),
  }
}

function toFiniteNumber(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function ensureSuccess<T>(result: ApiResponse<T>, fallbackMessage: string): void {
  if (result.code !== 0 || result.success === false) throw new Error(result.message || fallbackMessage)
}
