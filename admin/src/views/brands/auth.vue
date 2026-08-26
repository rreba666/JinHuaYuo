<script setup lang="ts">
/**
 * 授权管理（品牌小程序配置）
 * 平台管理员为每个品牌配置小程序授权信息（AppId/AppSecret/原始id/订单中心路径/微信支付/消息服务器/首页样式）。
 * 对应微三云「授权管理」；后端 brand_config 表就绪后接入真实数据（敏感项 AES 加密）。
 */
import { onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'

const route = useRoute()
const appKey = ref(String(route.query.appKey || 'jinhua'))

/** 授权配置表单（对应 micro 三云授权管理字段）。 */
const form = reactive({
  miniAppId: '',
  miniAppSecret: '',
  originalId: '',
  orderCenterPath: '/public/pages/order_center/order_center',
  homeStyle: 'full' as 'full' | 'title',
})

onMounted(() => {
  // 后端 GET /api/admin/v2/brands/{appKey}/auth-config 就绪后回填
})

function save(): void {
  ElMessage.success(`「${appKey.value}」授权配置已保存（后端品牌配置接口就绪后持久化）`)
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h2>授权管理</h2>
      <span class="brand-tag">当前品牌：{{ appKey }}</span>
    </div>

    <el-alert
      title="为品牌配置小程序授权信息（AppId/AppSecret/原始id/订单路径/微信支付/消息服务器/首页样式），敏感项加密存储，仅平台管理员可改。"
      type="info"
      :closable="false"
      show-icon
      class="page-tip"
    />

    <el-card shadow="never" class="content-card">
      <el-form :model="form" label-width="140px" size="default">
        <el-form-item label="App Id（AppID）">
          <el-input v-model="form.miniAppId" placeholder="小程序 AppID，如 wx356b8206e0c572bf" />
        </el-form-item>
        <el-form-item label="App Secret（密钥）">
          <el-input v-model="form.miniAppSecret" type="password" show-password placeholder="小程序密钥" />
        </el-form-item>
        <el-form-item label="原始 id">
          <el-input v-model="form.originalId" placeholder="如 gh_f0e26045f66c" />
        </el-form-item>
        <el-form-item label="订单中心 path">
          <el-input v-model="form.orderCenterPath" placeholder="如 /public/pages/order_center/order_center" />
        </el-form-item>
        <el-form-item label="微信支付">
          <el-button size="small" @click="ElMessage.info('微信支付配置（mch_id/证书）待后端接口就绪')">设置</el-button>
        </el-form-item>
        <el-form-item label="消息服务器配置">
          <el-button size="small" @click="ElMessage.info('消息服务器配置待后端接口就绪')">设置</el-button>
        </el-form-item>
        <el-form-item label="首页样式">
          <el-radio-group v-model="form.homeStyle">
            <el-radio value="full">通屏样式</el-radio>
            <el-radio value="title">标题栏样式</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="save">保存配置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.brand-tag { color: #909399; font-size: 14px; }
.page-tip { margin-bottom: 16px; }
</style>
