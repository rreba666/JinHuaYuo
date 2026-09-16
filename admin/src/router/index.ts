import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import type { AdminRole } from '@/types/auth'

const SUPER_ADMIN: AdminRole[] = ['SUPER_ADMIN']
const SUPER_AND_ADMIN: AdminRole[] = ['SUPER_ADMIN', 'ADMIN']
const SUPER_AND_ADMIN_SERVICE: AdminRole[] = ['SUPER_ADMIN', 'ADMIN', 'CUSTOMER_SERVICE']
const SUPER_AND_FINANCE: AdminRole[] = ['SUPER_ADMIN', 'FINANCE']
const SUPER_AND_ADMIN_FINANCE: AdminRole[] = ['SUPER_ADMIN', 'ADMIN', 'FINANCE']
const ALL: AdminRole[] = ['SUPER_ADMIN', 'ADMIN', 'CUSTOMER_SERVICE', 'FINANCE']

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/login/index.vue'),
      meta: { title: '管理员登录', public: true },
    },
    {
      path: '/',
      redirect: '/dashboard',
    },
    {
      path: '/',
      component: () => import('@/layouts/AdminLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: 'dashboard',
          name: 'Dashboard',
          component: () => import('@/views/dashboard/index.vue'),
          meta: { title: '仪表盘', permission: ['dashboard:read'], roles: ALL, requiresAuth: true },
        },
        {
          path: 'homepage',
          name: 'Homepage',
          component: () => import('@/views/homepage/index.vue'),
          meta: { title: '首屏与品牌', permission: ['homepage:read'], roles: SUPER_AND_ADMIN, requiresAuth: true },
        },
        {
          path: 'homepage/bottom-recommendation',
          name: 'HomepageBottomRecommendation',
          component: () => import('@/views/homepage/bottom-recommendation.vue'),
          meta: { title: '底部推荐', permission: ['homepage:read'], roles: SUPER_AND_ADMIN, requiresAuth: true },
        },
        // 保留旧地址兼容历史书签，但不再提供首页预览模块。
        { path: 'homepage/preview', redirect: '/homepage' },
        {
          path: 'users',
          name: 'Users',
          component: () => import('@/views/users/index.vue'),
          meta: { title: '用户管理', permission: ['user:read'], roles: SUPER_AND_ADMIN_SERVICE, requiresAuth: true },
        },
        {
          path: 'products',
          name: 'Products',
          component: () => import('@/views/products/index.vue'),
          meta: { title: '商品管理', permission: ['product:read'], roles: SUPER_AND_ADMIN_SERVICE, requiresAuth: true },
        },
        {
          path: 'categories',
          name: 'Categories',
          component: () => import('@/views/categories/index.vue'),
          meta: { title: '分类管理', permission: ['category:read'], roles: SUPER_AND_ADMIN, requiresAuth: true },
        },
        {
          path: 'shops',
          name: 'Shops',
          component: () => import('@/views/shops/index.vue'),
          meta: { title: '门店管理', permission: ['shop:read'], roles: SUPER_AND_ADMIN_SERVICE, requiresAuth: true },
        },
        {
          path: 'staff',
          name: 'Staff',
          component: () => import('@/views/staff/index.vue'),
          meta: { title: '店员管理', permission: ['staff:read'], roles: SUPER_AND_ADMIN, requiresAuth: true },
        },
        {
          path: 'admins',
          name: 'Admins',
          component: () => import('@/views/admin/index.vue'),
          meta: { title: '管理员管理', permission: ['admin:read'], roles: SUPER_AND_ADMIN, requiresAuth: true },
        },
        {
          path: 'orders',
          name: 'Orders',
          component: () => import('@/views/orders/index.vue'),
          meta: { title: '普通订单', permission: ['order:read'], roles: SUPER_AND_ADMIN_SERVICE, requiresAuth: true },
        },
        {
          path: 'orders/pickup',
          name: 'PickupOrders',
          component: () => import('@/views/orders/index.vue'),
          meta: { title: '自提订单', permission: ['order:read'], roles: SUPER_AND_ADMIN_SERVICE, requiresAuth: true },
        },
        {
          path: 'orders/address-audit',
          name: 'OrderAddressAudit',
          component: () => import('@/views/orders/address-audit.vue'),
          meta: { title: '地址变更审核', permission: ['order:read'], roles: SUPER_AND_ADMIN_SERVICE, requiresAuth: true },
        },
        {
          path: 'after-sale',
          name: 'AfterSale',
          component: () => import('@/views/after-sale/index.vue'),
          meta: { title: '售后管理', permission: ['order:read'], roles: SUPER_AND_ADMIN_SERVICE, requiresAuth: true },
        },
        {
          path: 'announcement',
          name: 'Announcement',
          component: () => import('@/views/announcement/index.vue'),
          meta: { title: '公告栏', roles: SUPER_AND_ADMIN, requiresAuth: true },
        },
        {
          path: 'invoices',
          name: 'Invoices',
          component: () => import('@/views/invoices/index.vue'),
          meta: { title: '发票管理', permission: ['invoice:read'], roles: ALL, requiresAuth: true },
        },
        {
          path: 'health-survey',
          name: 'HealthSurvey',
          component: () => import('@/views/health-survey/index.vue'),
          meta: { title: '健康问卷', permission: ['health-survey:read'], roles: ALL, requiresAuth: true },
        },
        {
          // 推广管理：待推广金 + 推广关系（超管 / 商户管理员 / 财务可见）
          path: 'promotion',
          name: 'Promotion',
          component: () => import('@/views/promotion/index.vue'),
          meta: { title: '推广管理', permission: ['profit:read'], roles: SUPER_AND_ADMIN_FINANCE, requiresAuth: true },
        },
        {
          // 红包管理：红包贡献 / 结算 / 用户额度（仅超级管理员可见）
          path: 'redpacket',
          name: 'RedPacket',
          component: () => import('@/views/redpacket/index.vue'),
          meta: { title: '红包管理', permission: ['profit:read'], roles: SUPER_ADMIN, requiresAuth: true },
        },
        // 旧的「推广资金」地址兼容：统一跳转到推广管理
        { path: 'profit', redirect: '/promotion' },
        {
          path: 'wallets',
          name: 'Wallets',
          component: () => import('@/views/wallet/index.vue'),
          meta: { title: '钱包管理', permission: ['wallet:read'], roles: SUPER_AND_ADMIN_FINANCE, requiresAuth: true },
        },
        {
          path: 'transfers',
          name: 'Transfers',
          component: () => import('@/views/transfers/index.vue'),
          meta: { title: '余额转账记录', permission: ['transfer:read'], roles: SUPER_AND_ADMIN_FINANCE, requiresAuth: true },
        },
        {
          path: 'withdraw',
          name: 'Withdraw',
          component: () => import('@/views/withdraw/index.vue'),
          meta: { title: '提现审核', permission: ['withdraw:read'], roles: SUPER_AND_ADMIN_FINANCE, requiresAuth: true },
        },
        {
          path: 'logs/verify',
          name: 'VerifyLogs',
          component: () => import('@/views/logs/verify.vue'),
          meta: { title: '核销日志', permission: ['verify:read'], roles: ALL, requiresAuth: true },
        },
        {
          path: 'logs/audit',
          name: 'AuditLogs',
          component: () => import('@/views/logs/audit.vue'),
          meta: { title: '操作追溯', permission: ['audit:read'], roles: SUPER_AND_ADMIN, requiresAuth: true },
        },
        {
          path: 'settings',
          name: 'Settings',
          component: () => import('@/views/settings/index.vue'),
          meta: { title: '系统设置', roles: SUPER_ADMIN, requiresAuth: true },
        },
      ],
    },
  ],
})

/** 仅允许跳转到当前站点内的路径，避免 redirect 参数造成外部跳转。 */
function getSafeRedirect(path: unknown): string {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') ? path : '/dashboard'
}

/** 设置页面标题、拦截未登录访问，并按角色校验路由访问权限。 */
router.beforeEach((to) => {
  document.title = `${String(to.meta.title || '电商后台')} - E-Admin Pro`
  const authStore = useAuthStore()
  authStore.restore()
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)

  if (to.name === 'Login' && authStore.isAuthenticated) {
    return getSafeRedirect(to.query.redirect)
  }
  if (requiresAuth && !authStore.isAuthenticated) {
    return { name: 'Login', query: { redirect: to.fullPath } }
  }
  // 角色守卫：已登录但角色不在路由允许列表中时，跳回默认落地页。
  if (requiresAuth && authStore.isAuthenticated) {
    const roles = to.matched.flatMap((record) => (record.meta.roles as AdminRole[] | undefined) || [])
    if (roles.length && !roles.includes(authStore.role as AdminRole)) {
      return { path: '/dashboard' }
    }
  }
  return true
})

export default router
