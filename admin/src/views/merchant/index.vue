<script setup lang="ts">
/**
 * 商户业务台（商户管理员登录后的默认落地页）
 * 展示本商户核心业务指标 + 常用功能快捷入口。
 * 说明：指标数据待后端接口就绪后接入；当前为布局骨架（静态示例值）。
 */
import { useRouter } from 'vue-router'

const router = useRouter()

/** 当前商户名（单商户系统固定；可从后端品牌配置读取）。 */
const brandName = '今华有'

/** 核心指标卡（示例：后端接口就绪后替换为真实数据）。 */
const metrics = [
  { key: 'orders', label: '今日订单', value: '0', note: '待处理订单' },
  { key: 'aftersale', label: '待处理售后', value: '0', note: '需及时响应' },
  { key: 'products', label: '在售商品', value: '0', note: '本品牌商品数' },
  { key: 'shops', label: '门店数', value: '0', note: '营业中门店' },
]

/** 常用功能快捷入口。 */
const quickActions = [
  { label: '商品管理', path: '/products', desc: '上架/改价/库存' },
  { label: '订单管理', path: '/orders', desc: '查看/处理订单' },
  { label: '售后管理', path: '/after-sale', desc: '退货/退款' },
  { label: '门店管理', path: '/shops', desc: '门店/自提点' },
  { label: '用户管理', path: '/users', desc: '会员/用户' },
  { label: '提现审核', path: '/withdraw', desc: '提现申请' },
]

function go(path: string): void {
  router.push(path)
}
</script>

<template>
  <section class="page-container page-enter merchant-page">
    <div class="page-heading">
      <div>
        <h1>商户业务台</h1>
        <p>您好，欢迎回来！这里是 <strong>{{ brandName }}</strong> 的运营概览。</p>
      </div>
    </div>

    <!-- 核心指标卡 -->
    <div class="merchant-metrics">
      <div v-for="metric in metrics" :key="metric.key" class="metric-panel">
        <span class="metric-label">{{ metric.label }}</span>
        <strong>{{ metric.value }}</strong>
        <small>{{ metric.note }}</small>
      </div>
    </div>

    <!-- 常用功能快捷入口 -->
    <el-card shadow="never" class="content-card">
      <div class="toolbar">
        <div><strong>常用功能</strong></div>
      </div>
      <div class="merchant-actions">
        <div v-for="action in quickActions" :key="action.path" class="action-card" @click="go(action.path)">
          <span class="action-title">{{ action.label }}</span>
          <span class="action-desc">{{ action.desc }}</span>
        </div>
      </div>
    </el-card>

    <el-alert
      title="指标数据待后端接口就绪后接入；当前为示例布局。"
      type="info"
      :closable="false"
      show-icon
      class="merchant-tip"
    />
  </section>
</template>

<style scoped>
.merchant-page { min-height: 60vh; }
.merchant-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 16px; }
.metric-panel { display: flex; flex-direction: column; gap: 6px; padding: 20px; border: 1px solid var(--vben-border); border-radius: var(--vben-card-radius); background: var(--vben-surface); box-shadow: var(--vben-shadow); color: var(--vben-text); }
.metric-label { color: var(--vben-muted); font-size: 14px; }
.metric-panel strong { font-size: 30px; font-weight: 700; }
.metric-panel small { color: var(--vben-muted); font-size: 12px; }
.merchant-actions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.action-card { display: flex; flex-direction: column; gap: 4px; padding: 18px; border: 1px solid var(--vben-border); border-radius: var(--vben-card-radius); background: var(--vben-surface); cursor: pointer; transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease; }
.action-card:hover { transform: translateY(-3px); box-shadow: var(--vben-shadow-hover); border-color: var(--vben-primary); }
.action-title { color: var(--vben-text); font-size: 16px; font-weight: 600; }
.action-desc { color: var(--vben-muted); font-size: 13px; }
.merchant-tip { margin-top: 16px; }
@media (max-width: 900px) { .merchant-metrics { grid-template-columns: repeat(2, 1fr); } .merchant-actions { grid-template-columns: repeat(2, 1fr); } }
</style>
