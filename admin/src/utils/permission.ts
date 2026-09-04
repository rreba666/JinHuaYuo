import type { AdminRole } from '@/types/auth'

/** 角色中文名称。 */
export const ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: '超级管理员',
  ADMIN: '商户管理员',
  CUSTOMER_SERVICE: '客服',
  FINANCE: '财务',
}

/** 各角色可访问的后台路由 path 集合。 */
const ROLE_ROUTES: Record<AdminRole, string[]> = {
  SUPER_ADMIN: [
    '/dashboard',
    '/homepage',
    '/homepage/bottom-recommendation',
    '/announcement',
    '/users',
    '/products',
    '/categories',
    '/shops',
    '/staff',
    '/admins',
    '/orders',
    '/orders/pickup',
    '/orders/address-audit',
    '/after-sale',
    '/invoices',
    '/health-survey',
    '/profit',
    '/wallets',
    '/transfers',
    '/withdraw',
    '/logs/verify',
    '/logs/audit',
  ],
  /** ADMIN（商户管理员）：业务模块可见；可看 核销日志 + 操作追溯；仅隐藏 系统设置/推广资金。 */
  ADMIN: [
    '/dashboard',
    '/homepage',
    '/homepage/bottom-recommendation',
    '/announcement',
    '/users',
    '/products',
    '/categories',
    '/shops',
    '/staff',
    '/admins',
    '/orders',
    '/orders/pickup',
    '/orders/address-audit',
    '/after-sale',
    '/invoices',
    '/health-survey',
    '/wallets',
    '/transfers',
    '/withdraw',
    '/logs/verify',
    '/logs/audit',
  ],
  CUSTOMER_SERVICE: [
    '/dashboard',
    '/users',
    '/products',
    '/shops',
    '/orders',
    '/orders/pickup',
    '/orders/address-audit',
    '/after-sale',
    '/invoices',
    '/health-survey',
    '/logs/verify',
  ],
  FINANCE: [
    '/dashboard',
    '/invoices',
    '/health-survey',
    '/profit',
    '/wallets',
    '/transfers',
    '/withdraw',
    '/logs/verify',
  ],
}

/** 路由 path 对应的权限中文名（与 router meta.title 保持一致）。 */
// '/wallets': '钱包管理'
const ROUTE_LABELS: Record<string, string> = {
  '/dashboard': '仪表盘',
  '/homepage': '首屏与品牌',
  '/homepage/bottom-recommendation': '底部推荐',
  '/announcement': '公告栏',
  '/users': '用户管理',
  '/products': '商品管理',
  '/categories': '分类管理',
  '/shops': '门店管理',
  '/staff': '店员管理',
  '/admins': '管理员管理',
  '/orders': '普通订单',
  '/orders/pickup': '自提订单',
  '/orders/address-audit': '地址变更审核',
  '/after-sale': '售后管理',
  '/invoices': '发票管理',
  '/health-survey': '健康问卷',
  '/profit': '推广资金',
  '/wallets': '钱包管理',
  '/transfers': '余额转账记录',
  '/withdraw': '提现审核',
  '/logs/verify': '核销日志',
  '/logs/audit': '操作追溯',
}

/** 各角色可访问功能的权限中文名（由 ROLE_ROUTES 映射而来，供后台展示）。 */
export const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  SUPER_ADMIN: ROLE_ROUTES.SUPER_ADMIN.map((path) => ROUTE_LABELS[path] ?? path),
  ADMIN: ROLE_ROUTES.ADMIN.map((path) => ROUTE_LABELS[path] ?? path),
  CUSTOMER_SERVICE: ROLE_ROUTES.CUSTOMER_SERVICE.map((path) => ROUTE_LABELS[path] ?? path),
  FINANCE: ROLE_ROUTES.FINANCE.map((path) => ROUTE_LABELS[path] ?? path),
}

/** 各角色登录后的默认落地页。 */
const ROLE_HOME: Record<AdminRole, string> = {
  SUPER_ADMIN: '/dashboard',
  ADMIN: '/dashboard',
  CUSTOMER_SERVICE: '/dashboard',
  FINANCE: '/dashboard',
}

/** 判断指定角色是否拥有某个路由 path 的访问权。 */
export function canAccess(role: AdminRole, path: string): boolean {
  return (ROLE_ROUTES[role] || []).includes(path)
}

/** 判断角色是否属于指定角色集合（用于菜单/按钮级过滤）。 */
export function hasRole(role: AdminRole, allowed: AdminRole[]): boolean {
  return allowed.includes(role)
}

/** 获取角色登录后的默认落地页。 */
export function homeForRole(role: AdminRole): string {
  return ROLE_HOME[role] || '/dashboard'
}

/** 判断角色是否为超级管理员。 */
export function isSuperAdmin(role: AdminRole): boolean {
  return role === 'SUPER_ADMIN'
}
