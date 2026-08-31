<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { View } from '@element-plus/icons-vue'
import DataTable from '@/components/DataTable.vue'
import { getHealthSurveyList, type AdminHealthSurveyRecord } from '@/api/healthSurvey'
import { HEALTH_SURVEY_QUESTIONS } from '@/health/healthQuestions'

const list = ref<AdminHealthSurveyRecord[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const pageSize = ref(10)
const detailVisible = ref(false)
const detailRecord = ref<AdminHealthSurveyRecord | null>(null)

function levelType(level: number): 'success' | 'warning' | 'danger' | 'info' {
  return ({ 1: 'success', 2: 'warning', 3: 'danger' } as const)[level] ?? 'info'
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await getHealthSurveyList(page.value, pageSize.value)
    list.value = result.list
    total.value = result.total
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '健康问卷查询失败')
  } finally {
    loading.value = false
  }
}

function openDetail(row: AdminHealthSurveyRecord): void {
  detailRecord.value = row
  detailVisible.value = true
}

onMounted(() => { void load() })
</script>

<template>
  <section class="page-container page-enter">
    <div class="page-heading">
      <div><h1>健康自查问卷</h1><p>查看用户提交的健康自查问卷记录，含总分、等级与每题得分。</p></div>
      <el-button :loading="loading" @click="load">刷新</el-button>
    </div>

    <el-card shadow="never" class="content-card">
      <div class="toolbar">
        <div><strong>问卷记录</strong><span class="toolbar-count">共 {{ total }} 条</span></div>
      </div>
      <DataTable
        :data="list"
        :loading="loading"
        :total="total"
        :page="page"
        :page-size="pageSize"
        empty-text="暂无问卷记录"
        @page-change="page = $event; void load()"
        @size-change="pageSize = $event; page = 1; void load()"
      >
        <el-table-column prop="userNickname" label="用户" min-width="140"><template #default="{ row }">{{ row.userNickname || '—' }}</template></el-table-column>
        <el-table-column prop="userId" label="用户ID" min-width="150" />
        <el-table-column prop="totalScore" label="总分" width="90" />
        <el-table-column label="等级" width="120">
          <template #default="{ row }"><el-tag :type="levelType(row.level)">{{ row.levelDesc || `等级${row.level}` }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="createTime" label="测评时间" min-width="180" />
        <el-table-column label="操作" width="130" fixed="right">
          <template #default="{ row }"><el-button size="small" type="primary" @click="openDetail(row)"><el-icon><View /></el-icon>每题得分</el-button></template>
        </el-table-column>
      </DataTable>
    </el-card>

    <el-dialog v-model="detailVisible" title="问卷详情" width="560px" append-to-body>
      <template v-if="detailRecord">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="用户">{{ detailRecord.userNickname || '—' }}（ID: {{ detailRecord.userId }}）</el-descriptions-item>
          <el-descriptions-item label="总分">{{ detailRecord.totalScore }}</el-descriptions-item>
          <el-descriptions-item label="等级"><el-tag :type="levelType(detailRecord.level)">{{ detailRecord.levelDesc || `等级${detailRecord.level}` }}</el-tag></el-descriptions-item>
          <el-descriptions-item label="测评时间">{{ detailRecord.createTime }}</el-descriptions-item>
        </el-descriptions>
        <el-divider>每题得分</el-divider>
        <el-table :data="detailRecord.scores.map((score, index) => ({ index: index + 1, question: HEALTH_SURVEY_QUESTIONS[index], score }))" border>
          <el-table-column prop="index" label="题号" width="70" />
          <el-table-column label="题目" min-width="260"><template #default="{ row }">{{ row.question ? `${row.question.title}：${row.question.description}` : '—' }}</template></el-table-column>
          <el-table-column prop="score" label="得分" width="80" />
        </el-table>
      </template>
      <template #footer><el-button @click="detailVisible = false">关闭</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.toolbar { display: flex; align-items: center; justify-content: space-between; }
.toolbar-count { margin-left: 12px; color: var(--el-text-color-secondary); font-size: 13px; }
</style>
