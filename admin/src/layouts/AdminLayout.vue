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

/** 角色是否为超级管理员（超管独享管理员管理、分类、店员、主页管理）。 */
const isSuper = computed(() => authStore.role === 'SUPER_ADMIN')
/** 是否为平台管理员（brandScope=ALL，可切品牌、见平台管理菜单）。 */
const isPlatform = computed(() => authStore.isPlatform)
/** 当前操作品牌（顶部品牌切换器显示）。 */
const currentAppKey = computed(() => authStore.currentAppKey)
/** 角色是否为客服（客服可见用户/商品/门店/订单/核销日志）。 */
const isService = computed(() => authStore.role === 'CUSTOMER_SERVICE' || authStore.role === 'SUPER_ADMIN')
/** 角色是否为财务（财务可见发票/推广资金/提现/操作追溯）。 */
const isFinance = computed(() => authStore.role === 'FINANCE' || authStore.role === 'SUPER_ADMIN')

/** 本人接口暂时失败时保留登录响应中的本地身份。 */
async function refreshCurrentAdmin(): Promise<void> {
  try {
    await authStore.refreshCurrentAdmin()
  } catch {
    // 网络或后端暂时不可用时，不影响已有登录态。
  }
}

/** 预载商品资金比例，确保商品编辑页使用最新系统默认值。 */
async function refreshFundRates(): Promise<void> {
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

/** 平台管理员可见的品牌下拉选项（占位：后端品牌接口 P3 接入后替换为动态列表）。 */
const brandOptions = [
  { label: '今华有', value: 'jinhua' },
  { label: '隆平', value: 'longping' },
]

/** 平台管理员切换当前品牌：更新 store + 提示（请求层自动带新 X-App-Key）。 */
function handleBrandChange(value: string): void {
  authStore.switchAppKey(value)
  const brand = brandOptions.find((item) => item.value === value)
  ElMessage.success(`已切换到：${brand?.label || value}`)
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
        <!-- 商户登录进业务台，平台/全局进仪表盘 -->
        <el-menu-item v-if="!isPlatform" index="/merchant">
          <el-icon><DataBoard /></el-icon>
          <template #title>商户业务台</template>
        </el-menu-item>
        <el-menu-item v-else index="/dashboard">
          <el-icon><DataBoard /></el-icon>
          <template #title>仪表盘</template>
        </el-menu-item>
        <el-sub-menu v-if="isSuper" index="/homepage">
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
        <el-menu-item v-if="isSuper" index="/categories">
          <el-icon><Collection /></el-icon>
          <template #title>分类管理</template>
        </el-menu-item>
        <el-menu-item v-if="isService" index="/shops">
          <el-icon><Shop /></el-icon>
          <template #title>门店管理</template>
        </el-menu-item>
        <el-menu-item v-if="isSuper" index="/staff">
          <el-icon><UserFilled /></el-icon>
          <template #title>店员管理</template>
        </el-menu-item>
        <el-menu-item v-if="isSuper" index="/admins">
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
        <el-menu-item v-if="isFinance" index="/profit">
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
        <el-sub-menu v-if="isSuper" index="/logs">
          <template #title><el-icon><Document /></el-icon><span>日志管理</span></template>
          <el-menu-item index="/logs/verify"><el-icon><Tickets /></el-icon><template #title>核销日志</template></el-menu-item>
          <el-menu-item index="/logs/audit"><el-icon><List /></el-icon><template #title>操作追溯</template></el-menu-item>
        </el-sub-menu>
        <el-sub-menu v-if="isSuper && isPlatform" index="/platform">
          <template #title><el-icon><Setting /></el-icon><span>平台管理</span></template>
          <el-menu-item index="/brands"><el-icon><Shop /></el-icon><template #title>品牌管理</template></el-menu-item>
          <el-menu-item index="/modules"><el-icon><Box /></el-icon><template #title>模块管理</template></el-menu-item>
          <el-menu-item index="/brands/auth"><el-icon><User /></el-icon><template #title>授权管理</template></el-menu-item>
          <el-menu-item index="/brands/tools"><el-icon><Tickets /></el-icon><template #title>系统工具授权</template></el-menu-item>
        </el-sub-menu>
        <el-menu-item v-if="isSuper" index="/settings">
          <el-icon><Setting /></el-icon>
          <template #title>业务设置</template>
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
          <!-- 平台管理员品牌切换器：切换后全局请求带对应 X-App-Key -->
          <el-select
            v-if="isPlatform"
            :model-value="currentAppKey || brandOptions[0]?.value"
            class="brand-switcher"
            size="small"
            @change="handleBrandChange"
          >
            <el-option v-for="brand in brandOptions" :key="brand.value" :label="brand.label" :value="brand.value" />
          </el-select>
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

<style scoped>
/* 平台管理员品牌切换器：位于顶部面包屑右侧 */
.brand-switcher {
  width: 140px;
  margin-left: 16px;
}
</style>
