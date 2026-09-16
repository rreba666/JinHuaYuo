<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Bell,
  Box,
  Collection,
  DataBoard,
  Document,
  Fold,
  House,
  List,
  Moon,
  Promotion,
  Present,
  Shop,
  WalletFilled,
  Sunny,
  Tickets,
  User,
  UserFilled,
  Expand,
  Search,
  Setting,
} from '@element-plus/icons-vue'

import { useAuthStore } from '@/stores/auth'
import { useSettingStore } from '@/stores/setting'
import { useThemeStore } from '@/stores/theme'
import { useTodoStore } from '@/stores/todo'
import { ROLE_LABELS } from '@/utils/permission'
import { getTodoSummary, type TodoItem } from '@/api/todo'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const settingStore = useSettingStore()
const themeStore = useThemeStore()
const todoStore = useTodoStore()
const collapsed = ref(false)
const keyword = ref('')

const pageTitle = computed(() => String(route.meta.title || '工作台'))
const adminName = computed(() => authStore.nickname || '管理员')
const adminRole = computed(() => ROLE_LABELS[authStore.role as keyof typeof ROLE_LABELS] || authStore.role || '管理员')
const adminAvatar = computed(() => adminName.value.slice(0, 1).toUpperCase())

/** 角色是否为超级管理员（超管独享日志/系统设置/推广资金）。 */
const isSuper = computed(() => authStore.role === 'SUPER_ADMIN')
/** 角色是否为商户管理员（ADMIN，业务模块可见，仅隐藏系统/日志/推广资金）。 */
const isAdmin = computed(() => authStore.role === 'ADMIN')
/** 超管 + 商户管理员均可见：主页管理/分类/店员/管理员管理/公告。 */
const isPlatformOrAdmin = computed(() => isSuper.value || isAdmin.value)
/** 角色是否为客服（客服可见用户/商品/门店/订单/核销日志）。 */
const isService = computed(() => authStore.role === 'CUSTOMER_SERVICE' || isPlatformOrAdmin.value)
/** 财务相关模块（钱包/转账/提现）：财务 + 超管 + 商户管理员可见。 */
const isFinance = computed(() => authStore.role === 'FINANCE' || isPlatformOrAdmin.value)
/** 推广管理：财务 + 超管 + 商户管理员可见（待推广金与推广关系）。 */
const isPromotion = computed(() => isFinance.value)
/** 红包管理：仅超级管理员可见（红包贡献/结算/用户额度）。 */
const isRedPacket = computed(() => isSuper.value)
/** 库存对账：财务 + 超管 + 商户管理员可见（库存台账 + 退款应补未补核对，均为只读）。 */
const isStock = computed(() => isFinance.value)
/** 核销日志：超管 + 客服 + 财务 + 商户管理员 均可见。 */
const isVerifyLog = computed(() => authStore.role === 'CUSTOMER_SERVICE' || authStore.role === 'FINANCE' || isPlatformOrAdmin.value)
/** 操作追溯：仅超管 + 商户管理员 可见。 */
const isAuditLog = computed(() => isSuper.value || isAdmin.value)
/** 日志管理：任一日志可见时展示该模块。 */
const isLogModule = computed(() => isVerifyLog.value || isAuditLog.value)

/** 本人接口暂时失败时保留登录响应中的本地身份。 */
async function refreshCurrentAdmin(): Promise<void> {
  try {
    await authStore.refreshCurrentAdmin()
  } catch {
    // 网络或后端暂时不可用时，不影响已有登录态。
  }
}

/** 预载商品资金比例，确保商品编辑页使用最新系统默认值。仅对能访问系统设置接口的角色(超管/财务)预载；商户管理员无权访问该接口，避免 403 触发登录跳转。 */
async function refreshFundRates(): Promise<void> {
  if (authStore.role !== 'SUPER_ADMIN' && authStore.role !== 'FINANCE') return
  try {
    await settingStore.loadProfitRates()
  } catch {
    // 设置读取失败时保留前端默认兜底值。
  }
}

/** 清理本地认证状态并返回登录页面。 */
function logout(): void {
  authStore.logout()
  ElMessage.success('已退出登录')
  router.replace('/login')
}

// ===== 右上角待办铃铛（GET /api/admin/todo/summary） =====
/** 待办总数（徽标；0 不显示，>99 显示 99+）。 */
const todoTotal = ref(0)
/** 待办明细（仅展示 count>0 的项）。 */
const todoItems = ref<TodoItem[]>([])
const todoLoading = ref(false)
let todoTimer: ReturnType<typeof setInterval> | null = null

/** 拉取待办汇总；失败时静默兜底（不显示徽标、下拉显示「暂无待办」）。 */
async function refreshTodo(): Promise<void> {
  todoLoading.value = true
  try {
    const summary = await getTodoSummary()
    todoTotal.value = Number(summary.total) || 0
    todoItems.value = summary.items.filter((item) => Number(item.count) > 0)
  } catch {
    todoTotal.value = 0
    todoItems.value = []
  } finally {
    todoLoading.value = false
  }
}

/**
 * 点击待办项：按后端给的 route 跳转（query 由后端保证与列表页筛选一致）。
 *
 * 两个坑：
 * 1. **同一模块内**点不同待办（如 `/orders?statuses=1&pickupType=0` → `/orders?wxShippingStatus=2`）
 *    路径相同、只有 query 变 → 目标页必须监听 `route.query` 才会响应（各页面已改）；
 * 2. **重复点同一个待办**（或手动改了筛选后想回到该待办视图）→ 目标路由与当前路由完全一致，
 *    vue-router 不会重新导航，页面也不会重跑筛选 → 这里额外广播一次点击信号，
 *    目标页监听 `useTodoStore().clickTick` 重新套用筛选并刷新。
 */
function openTodo(item: TodoItem): void {
  if (!item.route) return
  const todoStore = useTodoStore()
  const current = `${route.path}${route.query && Object.keys(route.query).length ? `?${new URLSearchParams(route.query as Record<string, string>).toString()}` : ''}`
  if (item.route === route.fullPath || item.route === current) {
    todoStore.notifyClick()
    return
  }
  todoStore.notifyClick()
  router.push(item.route)
}

/** 待办等级 → 标签颜色。 */
function todoTagType(level?: string): 'primary' | 'warning' | 'danger' {
  if (level === 'DANGER') return 'danger'
  if (level === 'WARN') return 'warning'
  return 'primary'
}

/** 徽标展示值：>99 显示 99+。 */
const todoBadge = computed(() => (todoTotal.value > 99 ? '99+' : String(todoTotal.value)))

onMounted(() => {
  void refreshCurrentAdmin()
  void refreshFundRates()
  // 待办铃铛：进入后台立即拉一次，之后 30s 轮询（需求建议 30~60s）
  void refreshTodo()
  todoTimer = setInterval(() => { void refreshTodo() }, 30000)
})

onUnmounted(() => {
  if (todoTimer) clearInterval(todoTimer)
  todoTimer = null
})

</script>

<template>
  <el-container class="admin-shell">
    <el-aside :width="collapsed ? '72px' : '240px'" class="admin-aside">
      <div class="brand" :class="{ 'brand--collapsed': collapsed }">
        <div class="brand-mark">E</div>
        <span v-if="!collapsed">E-Admin Pro</span>
      </div>
      <el-menu :default-active="route.path" :default-openeds="['/homepage', '/orders']" :collapse="collapsed" router class="admin-menu">
        <el-menu-item index="/dashboard">
          <el-icon><DataBoard /></el-icon>
          <template #title>仪表盘</template>
        </el-menu-item>
        <el-sub-menu v-if="isPlatformOrAdmin" index="/homepage">
          <template #title><el-icon><House /></el-icon><span>主页管理</span></template>
          <el-menu-item index="/homepage"><el-icon><DataBoard /></el-icon><template #title>首屏与品牌</template></el-menu-item>
          <el-menu-item index="/homepage/bottom-recommendation"><el-icon><Promotion /></el-icon><template #title>底部推荐</template></el-menu-item>
          <el-menu-item index="/announcement"><el-icon><Bell /></el-icon><template #title>公告栏</template></el-menu-item>
        </el-sub-menu>
        <el-menu-item v-if="isService" index="/users">
          <el-icon><User /></el-icon>
          <template #title>用户管理</template>
        </el-menu-item>
        <el-menu-item v-if="isService" index="/products">
          <el-icon><Box /></el-icon>
          <template #title>商品管理</template>
        </el-menu-item>
        <el-menu-item v-if="isPlatformOrAdmin" index="/categories">
          <el-icon><Collection /></el-icon>
          <template #title>分类管理</template>
        </el-menu-item>
        <el-menu-item v-if="isService" index="/shops">
          <el-icon><Shop /></el-icon>
          <template #title>门店管理</template>
        </el-menu-item>
        <el-menu-item v-if="isPlatformOrAdmin" index="/staff">
          <el-icon><UserFilled /></el-icon>
          <template #title>店员管理</template>
        </el-menu-item>
        <el-menu-item v-if="isPlatformOrAdmin" index="/admins">
          <el-icon><UserFilled /></el-icon>
          <template #title>管理员管理</template>
        </el-menu-item>
        <el-sub-menu v-if="isService" index="/orders">
          <template #title><el-icon><List /></el-icon><span>订单管理</span></template>
          <el-menu-item index="/orders"><template #title>普通订单</template></el-menu-item>
          <el-menu-item index="/orders/pickup"><template #title>自提订单</template></el-menu-item>
          <el-menu-item index="/orders/address-audit"><template #title>地址变更审核</template></el-menu-item>
          <el-menu-item index="/after-sale"><template #title>售后管理</template></el-menu-item>
        </el-sub-menu>
        <el-menu-item v-if="isFinance || isService" index="/invoices">
          <el-icon><Document /></el-icon>
          <template #title>发票管理</template>
        </el-menu-item>
        <el-menu-item v-if="isFinance || isService" index="/health-survey">
          <el-icon><Document /></el-icon>
          <template #title>健康问卷</template>
        </el-menu-item>
        <el-menu-item v-if="isPromotion" index="/promotion">
          <el-icon><Promotion /></el-icon>
          <template #title>推广管理</template>
        </el-menu-item>
        <el-menu-item v-if="isRedPacket" index="/redpacket">
          <el-icon><Present /></el-icon>
          <template #title>红包管理</template>
        </el-menu-item>
        <el-menu-item v-if="isFinance" index="/wallets">
          <el-icon><WalletFilled /></el-icon>
          <template #title>钱包管理</template>
        </el-menu-item>
        <el-menu-item v-if="isFinance" index="/transfers">
          <el-icon><Document /></el-icon>
          <template #title>余额转账记录</template>
        </el-menu-item>
        <el-menu-item v-if="isFinance" index="/withdraw">
          <el-icon><Tickets /></el-icon>
          <template #title>提现审核</template>
        </el-menu-item>
        <el-menu-item v-if="isStock" index="/stock">
          <el-icon><Box /></el-icon>
          <template #title>库存对账</template>
        </el-menu-item>
        <el-sub-menu v-if="isLogModule" index="/logs">
          <template #title><el-icon><Document /></el-icon><span>日志管理</span></template>
          <el-menu-item v-if="isVerifyLog" index="/logs/verify"><el-icon><Tickets /></el-icon><template #title>核销日志</template></el-menu-item>
          <el-menu-item v-if="isAuditLog" index="/logs/audit"><el-icon><List /></el-icon><template #title>操作追溯</template></el-menu-item>
        </el-sub-menu>
        <el-menu-item v-if="isSuper" index="/settings">
          <el-icon><Setting /></el-icon>
          <template #title>系统设置</template>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="admin-header">
        <div class="header-left">
          <el-button text class="header-collapse" title="收起侧栏" @click="collapsed = !collapsed">
            <el-icon size="20"><Expand v-if="collapsed" /><Fold v-else /></el-icon>
          </el-button>
          <el-breadcrumb separator="/">
            <el-breadcrumb-item>E-Admin Pro</el-breadcrumb-item>
            <el-breadcrumb-item>{{ pageTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-actions">
          <el-input v-model="keyword" placeholder="全局搜索（暂未接入）" clearable class="global-search">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-button text class="theme-toggle" :title="themeStore.isDark ? '切换浅色主题' : '切换暗色主题'" @click="themeStore.toggle"><el-icon><Sunny v-if="themeStore.isDark" /><Moon v-else /></el-icon></el-button>
          <!-- 待办铃铛：徽标 + 下拉清单（数据源 GET /api/admin/todo/summary，30s 轮询） -->
          <el-popover placement="bottom-end" :width="300" trigger="click">
            <template #reference>
              <el-badge :value="todoTotal > 0 ? todoBadge : ''" :hidden="todoTotal === 0" class="todo-badge">
                <el-button text class="header-icon-button" title="待办提醒"><el-icon><Bell /></el-icon></el-button>
              </el-badge>
            </template>
            <div class="todo-panel">
              <div class="todo-panel-head">
                <span>待办提醒</span>
                <span class="todo-refresh" @click="refreshTodo">{{ todoLoading ? '刷新中…' : '刷新' }}</span>
              </div>
              <div v-if="!todoItems.length" class="todo-empty">暂无待办</div>
              <div v-else class="todo-list">
                <div v-for="item in todoItems" :key="item.key" class="todo-item" @click="openTodo(item)">
                  <span class="todo-label">{{ item.label }}</span>
                  <el-tag :type="todoTagType(item.level)" size="small" effect="light">{{ item.count }}</el-tag>
                </div>
              </div>
            </div>
          </el-popover>
          <el-dropdown>
            <span class="profile-trigger"><el-avatar :size="32">{{ adminAvatar }}</el-avatar><span>{{ adminName }}</span></span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item>{{ adminRole }}</el-dropdown-item>
                <el-dropdown-item divided @click="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      <el-main class="admin-main"><RouterView /></el-main>
    </el-container>
  </el-container>
</template>
