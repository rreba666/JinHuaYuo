import { request } from './request'
import type { ApiResponse } from './request'
import type { DividendCap, DividendCapSaveDTO, ProfitRatesConfig, ProfitRatesSaveDTO, SysConfig, SysConfigSaveDTO } from '@/types/setting'
import { DEFAULT_DIVIDEND_RATE, DEFAULT_PROMOTION_RATE } from '@/utils/productPricing'

const CUSTOMER_SERVICE_KEY = 'customer_service_phone'
const DEFAULT_DIVIDEND_MULTIPLIER = 1.5
const PROFIT_RATES_PATH = '/api/admin/setting/profit-rates'

/** 读取客服电话配置。未配置时返回空表单值，不创建后端历史配置。 */
export async function getCustomerServiceConfig(): Promise<SysConfig> {
  const response = await request.get<ApiResponse<SysConfig | null>>('/api/admin/setting/customer-service')
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

/** 读取分红倍率；后端未配置或返回非有限值时使用约定默认值。 */
export async function getDividendCap(): Promise<DividendCap> {
  const response = await request.get<ApiResponse<DividendCap | null>>('/api/admin/setting/dividend-cap')
  const result = response.data
  ensureSuccess(result, '分红上限倍率查询失败')
  const data: Partial<DividendCap> = result.data || {}
  const multiplier = Number(data.multiplier)
  return {
    multiplier: Number.isFinite(multiplier) ? multiplier : DEFAULT_DIVIDEND_MULTIPLIER,
    remark: String(data.remark ?? ''),
  }
}

/** 保存分红倍率，避免无效值绕过页面控件提交。 */
export async function saveDividendCap(payload: DividendCapSaveDTO): Promise<void> {
  const multiplier = Number(payload.multiplier)
  if (!Number.isFinite(multiplier) || multiplier < 0.01 || multiplier > 100) {
    throw new Error('分红上限倍率必须在 0.01 到 100 之间')
  }
  const response = await request.post<ApiResponse<null>>('/api/admin/setting/dividend-cap', {
    ...payload,
    multiplier,
  })
  ensureSuccess(response.data, '分红上限倍率保存失败')
}

/** 读取商品资金比例。 */
export async function getProfitRatesConfig(): Promise<ProfitRatesConfig> {
  const response = await request.get<ApiResponse<ProfitRatesConfig | null>>(PROFIT_RATES_PATH)
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
    throw new Error('分红奖池比例必须在 0 到 100 之间')
  }
  const response = await request.post<ApiResponse<null>>(PROFIT_RATES_PATH, {
    ...payload,
    promotionRate,
    bonusPoolRate,
  })
  ensureSuccess(response.data, '商品资金比例保存失败')
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

function ensureSuccess<T>(result: ApiResponse<T>, fallbackMessage: string): void {
  if (result.code !== 0 || result.success === false) throw new Error(result.message || fallbackMessage)
}
