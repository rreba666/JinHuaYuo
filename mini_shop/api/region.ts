import { request } from '@/utils/request'

/** 行政区划（对应 RegionEntity）。 */
export interface Region {
  /** 行政代码（省级 12 位；港澳台 13 位）。 */
  code: string
  /** 父级代码（省级为 null）。 */
  parentCode?: string | null
  /** 名称（广东省/深圳市/南山区）。 */
  name: string
  /** 1省 / 2市 / 3区县。 */
  level: number
}

/**
 * 按 parentCode 查询子级行政区划，实现省→市→区县三级联动。
 * 不传 parentCode 返回省级；传省 code 返回市；传市 code 返回区县。
 */
export async function getRegionList(parentCode?: string): Promise<Region[]> {
  const url = parentCode ? `/api/region/list?parentCode=${encodeURIComponent(parentCode)}` : '/api/region/list'
  const result = await request<Region[]>({ url, method: 'GET' })
  return Array.isArray(result) ? result : []
}

/** 加载全部省份。 */
export function getProvinces(): Promise<Region[]> {
  return getRegionList()
}

/** 按省 code 加载城市。 */
export function getCities(provinceCode: string): Promise<Region[]> {
  return getRegionList(provinceCode)
}

/** 按市 code 加载区县。 */
export function getDistricts(cityCode: string): Promise<Region[]> {
  return getRegionList(cityCode)
}
