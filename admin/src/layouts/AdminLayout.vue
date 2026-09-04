<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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
import { ROLE_LABELS } from '@/utils/permission'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const settingStore = useSettingStore()
const themeStore = useThemeStore()
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
/** 推广资金：仅财务 + 超管可见（商户管理员不可见）。 */
const isProfit = computed(() => authStore.role === 'FINANCE' || authStore.role === 'SUPER_ADMIN')
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

onMounted(() => {
  void refreshCurrentAdmin()
  void refreshFundRates()
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
          <el-menu-item index="/lucky"><el-icon><Tickets /></el-icon><template #title>大转盘活动</template></el-menu-item>
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
        <el-menu-item v-if="isProfit" index="/profit">
          <el-icon><Promotion /></el-icon>
          <template #title>推广资金</template>
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
          <el-button text class="header-icon-button" title="通知"><el-icon><Bell /></el-icon></el-button>
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
