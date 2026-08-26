<script setup lang="ts">
/**
 * 系统工具授权（brand_tool）
 * 平台管理员为品牌勾选授权的工具（实名验证/物流查询/短信/邮件/客服/地图/ERP/监控/大屏/打印/统计等）。
 * 商户在「系统工具」页只能配置/启停平台已授权工具；后端 GET/PUT /api/admin/v2/brands/{appKey}/tools 就绪后接入真实数据。
 */
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'

const route = useRoute()
const appKey = ref(String(route.query.appKey || 'jinhua'))

/** 工具项（参考微三云「系统工具」目录）。 */
interface ToolItem {
  key: string
  name: string
  desc: string
}

const tools = ref<ToolItem[]>([])
/** 已授权的工具 key 集合。 */
const authorized = ref<Set<string>>(new Set())

const TOOL_CATALOG: ToolItem[] = [
  { key: 'realname', name: '实名验证', desc: '身份证/手机/银行卡要素校验' },
  { key: 'express', name: '物流查询', desc: '快递单号实时查询' },
  { key: 'sms', name: '短信服务', desc: '验证码/通知/营销短信' },
  { key: 'email', name: '邮件服务', desc: '通知/营销邮件' },
  { key: 'kefu', name: '客服服务', desc: '在线客服，及时沟通' },
  { key: 'map', name: '地图定位', desc: '专业精准的定位服务' },
  { key: 'erp', name: '管家婆ERP', desc: '商品库存同步/订单同步' },
  { key: 'monitor', name: '服务器监控', desc: '监控服务器与数据库性能' },
  { key: 'bigscreen', name: '月度大屏', desc: '月度销量数据大屏' },
  { key: 'print', name: '小票打印机', desc: '小票打印机管理' },
  { key: 'textdetect', name: '文本内容检测', desc: '屏蔽含关键词评论' },
  { key: 'stat', name: '百度统计', desc: '洞察用户行为，驱动增长' },
]

onMounted(() => {
  tools.value = TOOL_CATALOG.map((t) => ({ ...t }))
  // 占位：默认授权前 4 个（后端 GET /api/admin/v2/brands/{appKey}/tools 就绪后替换）
  authorized.value = new Set(tools.value.slice(0, 4).map((t) => t.key))
})

/** 勾选/取消授权工具。 */
function toggleTool(key: string): void {
  if (authorized.value.has(key)) authorized.value.delete(key)
  else authorized.value.add(key)
}

/** 保存授权。 */
function save(): void {
  ElMessage.success(`「${appKey.value}」已授权 ${authorized.value.size} 个工具（后端接口就绪后持久化）`)
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h2>系统工具授权</h2>
      <span class="brand-tag">当前品牌：{{ appKey }}</span>
    </div>

    <el-alert
      title="为品牌勾选可使用的系统工具；商户在「系统工具」页只能配置/启停已授权工具，不能自行开通。"
      type="info"
      :closable="false"
      show-icon
      class="page-tip"
    />

    <el-card shadow="never" class="content-card">
      <div class="tool-grid">
        <div
          v-for="tool in tools"
          :key="tool.key"
          class="tool-card"
          :class="{ 'tool-card--checked': authorized.has(tool.key) }"
          @click="toggleTool(tool.key)"
        >
          <el-checkbox :model-value="authorized.has(tool.key)" class="tool-check" @click.stop />
          <div class="tool-body">
            <div class="tool-name">{{ tool.name }}</div>
            <div class="tool-desc">{{ tool.desc }}</div>
          </div>
        </div>
      </div>
      <el-button type="primary" class="save-btn" @click="save">保存授权</el-button>
    </el-card>
  </div>
</template>

<style scoped>
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.brand-tag { color: #909399; font-size: 14px; }
.page-tip { margin-bottom: 16px; }
.tool-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.tool-card { display: flex; align-items: flex-start; gap: 10px; padding: 16px; border: 1px solid var(--vben-border); border-radius: 12px; cursor: pointer; transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease; background: var(--vben-surface); }
.tool-card:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,.08); }
.tool-card--checked { border-color: var(--vben-primary); }
.tool-body { display: flex; flex-direction: column; gap: 4px; }
.tool-name { font-weight: 600; font-size: 15px; color: var(--vben-text); }
.tool-desc { font-size: 13px; color: var(--vben-muted); }
.save-btn { margin-top: 20px; }
@media (max-width: 900px) { .tool-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
