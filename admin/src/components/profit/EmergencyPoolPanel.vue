<script setup lang="ts">
/**
 * 应急红包池面板（红包管理 → 应急红包池）
 *
 * 2026-09-19 改造：流水从「只有总量、看不到记录」升级为**可筛选的明细账**——
 * ① 支持 `type`（抽取 / 注入 / 注入结算 / 结余结转）与**发生日期区间**筛选；
 * ② 新增 `summary` 汇总（**按筛选范围聚合、与分页无关**）：抽取/注入/结转的合计与笔数，
 *    以及「单均抽取」——正常恒为 ¥100.00（业务规则是每单抽取 100），**不等于 100 就标红**，
 *    运营一眼就能发现某单抽取金额不对；
 * ③ 列表补齐来源信息：类型直接用后端下发的 `typeDesc`（中文），并展示**订单号 / 商品名**；
 *    历史 25 条商品名空白的记录，后端已用 `orderNo` 反查订单首个明细补全。
 *
 * 2026-09-24 改造（对接《老层一次性发放-前端对接文档》第七节「应急池注入」）：
 * ④ 注入表单从「只有一个金额」补齐为文档 §7.5 要求的 4 项：**金额 / 目标池 / 注入层 / 备注**；
 * ⑤ ⚠️ **换接口**：改用 `@/api/profit` 的 `injectEmergencyPool(payload: BonusInjectDTO)`
 *    （走 `POST /api/admin/profit/emergency-pool/inject`）。原 `@/api/emergencyPool` 里的**同名函数
 *    只接受一个金额数字**，根本组不出 `layer` / `poolId` / `remark` —— 用它等于「注入层白选了」：
 *    后端收不到层号会按默认 `BOTH` 拆两层，且不限池时这笔钱可能流到后面的周池（资金操作不可逆）。
 * ⑥ 注入层（`NEW` / `OLD` / `BOTH`）决定**钱加给谁**，两者的到账对象完全不同，
 *    所以选项说明与**确认弹窗**里都必须写清楚（文档 §7.3 / §7.5）；
 * ⑦ `allowSameDay` 收进「高级选项」折叠并标注「仅当日特别重发使用」，默认 false 且不传
 *    （传错会让**当天**的批次立刻把这笔注入吃掉，与「次日生效」预期不符）；
 * ⑧ 目标池 `poolId` 设为**必填**（文档 §7.5：给正在发放中的周池注入务必传）；
 * ⑨ 总账区补上自检恒等式 `balance = total_deducted − total_injected`（文档 §7.7 / 附录 A.1）。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Search, TrendCharts } from '@element-plus/icons-vue'
import DataTable from '@/components/DataTable.vue'
import { getEmergencyPool, getEmergencyPoolLogs } from '@/api/emergencyPool'
// ⚠️ 注入必须走「新接口」——`@/api/profit` 的版本才接收 `BonusInjectDTO`（含 layer / poolId / remark）。
// ⚠️ `@/api/emergencyPool` 也导出一个**同名**的 injectEmergencyPool，但它的签名是 (amount: number)，
//    千万不要从那边再导一次（重复导入会直接编译报错；改用旧签名则新字段全丢）。
import { getBonusPools, injectEmergencyPool } from '@/api/profit'
import type { BonusInjectLayer, SevenDayBonusPool } from '@/types/profit'
import type { EmergencyPoolLog, EmergencyPoolLogSummary, EmergencyPoolOverview } from '@/types/emergencyPool'

const overview = ref<EmergencyPoolOverview | null>(null)
const logs = ref<EmergencyPoolLog[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const summary = ref<EmergencyPoolLogSummary | null>(null)

/* ===================== 注入弹窗状态（2026-09-24 扩展） ===================== */
const injectVisible = ref(false)
const injectAmount = ref(0)
const injecting = ref(false)
/** 注入层：默认 `BOTH`（= 后端不传时的默认口径，按池子 70/30 拆成新/老两层）。 */
const injectLayer = ref<BonusInjectLayer>('BOTH')
/** 目标池 ID。用字符串保存便于和 `SevenDayBonusPool.id`（string）对齐，提交时再转成 number。**必填**。 */
const injectPoolId = ref('')
/** 备注：会写进应急池流水，便于事后追溯这笔钱是干什么用的。 */
const injectRemark = ref('')
/** ⚠️ 仅当日特别重发使用，默认 false（= 次日生效）；界面上藏在「高级选项」折叠里。 */
const injectAllowSameDay = ref(false)
/** 可选目标池列表（按池起始日倒序，最上面那条即最近的周池）。 */
const pools = ref<SevenDayBonusPool[]>([])
const poolsLoading = ref(false)

/**
 * 注入层选项（文档 §7.3）。
 * ⚠️ 三者的**到账对象完全不同**（新单 vs 老用户 vs 两者），所以每一项都把
 * 「钱加给谁 / 每份大约多少」写在界面上 —— 只显示 `NEW` / `OLD` 缩写运营很容易选错，
 * 而钱一旦注入就是不可逆的。
 */
const INJECT_LAYERS: { value: BonusInjectLayer; label: string; desc: string }[] = [
  { value: 'NEW', label: '新用户层', desc: '钱加进新用户层：发给本周的【新单】，按订单分，≈307.8 元/单·天' },
  { value: 'OLD', label: '老用户层', desc: '钱加进老用户层：发给【老用户】，按槽位分（整周轮到一次），≈201.88 元/槽' },
  { value: 'BOTH', label: '两层都加（默认）', desc: '按池子 70/30 拆成新层 / 老层，两类用户都会分到' },
]

/** 当前选中注入层的中文名（表单下方 + 确认弹窗都要用到）。 */
const injectLayerLabel = computed<string>(() => INJECT_LAYERS.find((item) => item.value === injectLayer.value)?.label || injectLayer.value)
/** 当前选中注入层的到账对象说明。 */
const injectLayerDesc = computed<string>(() => INJECT_LAYERS.find((item) => item.value === injectLayer.value)?.desc || '')

/** 流水筛选（2026-09-19 新增）：type 不传=全部；日期区间含当天。 */
const filters = reactive<{ type: string; dateRange: [string, string] | [] }>({ type: '', dateRange: [] })

function money(value?: number): string { return `¥ ${Number(value || 0).toFixed(2)}` }

/**
 * 总账自检（文档 §7.7 / 附录 A.1）：`balance = total_deducted − total_injected`。
 * 这个恒等式**永远成立**，不成立就说明总账数据异常 —— 此时应提示运营先核对、不要继续注入。
 * ⚠️ `pendingInject`（待注入）**不参与**该恒等式，不要把它算进来。
 * ⚠️ 金额先换算成「分」再比较：JS 浮点直接相减会出现 `0.1 + 0.2 !== 0.3` 这类假警报。
 */
const balanceCheck = computed<{ ok: boolean; expected: number } | null>(() => {
  const current = overview.value
  if (!current) return null
  const expectedCents = Math.round(Number(current.totalDeduct || 0) * 100) - Math.round(Number(current.totalInject || 0) * 100)
  return { ok: expectedCents === Math.round(Number(current.balance || 0) * 100), expected: expectedCents / 100 }
})

/** 类型文案：**优先用后端下发的 `typeDesc`**，未下发时按 type 兜底映射（兼容旧接口）。 */
function logTypeText(row: EmergencyPoolLog): string {
  if (row.typeDesc) return row.typeDesc
  return ({ DEDUCT: '订单抽取', INJECT: '后台注入', INJECT_SETTLE: '注入随结算入池', REMAINDER: '发放均分余数', REVERSAL: '冲账反向退回' } as Record<string, string>)[row.type] || row.type || '未知'
}
function logTypeTag(type: string): 'warning' | 'success' | 'info' { return type === 'DEDUCT' ? 'warning' : type === 'INJECT' ? 'success' : 'info' }

/**
 * 单均抽取的状态（业务规则：每单抽取 100，后端把它作为口径校验值）。
 * ⚠️ 后端「**无抽取时返回 `null`**」—— 此时既不算正常也不算异常，页面显示「无抽取」并保持中性色。
 */
function deductPerOrderState(): 'ok' | 'bad' | 'none' {
  const value = summary.value?.deductPerOrder
  if (value == null) return 'none'
  return Number(value) === 100 ? 'ok' : 'bad'
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const [ov, logResult] = await Promise.all([
      getEmergencyPool(),
      getEmergencyPoolLogs({
        page: page.value,
        pageSize: pageSize.value,
        // ⚠️ `type` 不传 = 全部；**不要传 `'ALL'`**（文档 §7.7）——后端会把 `ALL` 判为非法值再回退成
        // 「全部」，结果虽然正确，但每次查询都会多打一条 WARN 日志，污染后端日志。
        type: filters.type || undefined,
        startDate: filters.dateRange?.[0] || undefined,
        endDate: filters.dateRange?.[1] || undefined,
      }),
    ])
    overview.value = ov
    logs.value = logResult.list
    total.value = logResult.total
    summary.value = logResult.summary ?? null
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '应急红包池数据加载失败')
  } finally {
    loading.value = false
  }
}

/** 查询：筛选条件变化后回到第一页。 */
function search(): void { page.value = 1; void load() }
/** 重置筛选。 */
function resetFilters(): void { filters.type = ''; filters.dateRange = []; search() }

/** 目标池下拉文案：池号 + 起止日期（运营是按周次认池子的，只给 ID 很容易选错池）。 */
function poolLabel(pool: SevenDayBonusPool): string {
  const range = pool.startDate && pool.endDate ? `${pool.startDate} ~ ${pool.endDate}` : '日期未知'
  return `池 ${pool.id}（${range}）`
}

/**
 * 加载可选目标池。
 *
 * 文档 §7.5：给**正在发放中的周池**注入**务必传 `poolId`**，不传 = 不限池 ⇒ 这笔钱可能流到后面的周池。
 * ⚠️ 池列表接口**没有下发池状态**（`DISTRIBUTING` 等），因此这里按**池起始日倒序**排列，
 *    最上面那条即最近的周池（正常就是当前正在发放的池），由运营核对后**显式选择**。
 */
async function loadPools(): Promise<void> {
  poolsLoading.value = true
  try {
    const list = await getBonusPools()
    pools.value = [...list].sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)))
  } catch (error) {
    pools.value = []
    ElMessage.warning(error instanceof Error ? error.message : '分红池列表加载失败，请刷新后重试再注入')
  } finally {
    poolsLoading.value = false
  }
}

/** HTML 转义：确认弹窗走 `dangerouslyUseHTMLString`，备注是人工输入，必须先转义再拼串。 */
function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[char] || char) }

/**
 * 拼注入二次确认的弹窗内容（HTML）。
 *
 * ⚠️ 必须把「注入的是**新层**还是**老层**」显示清楚（文档 §7.5）——两层到账对象完全不同
 * （新层给本周新单、老层给老用户），只看金额点确认会发错人。
 */
function injectConfirmHtml(pool: SevenDayBonusPool | undefined): string {
  const sameDay = injectAllowSameDay.value
  return [
    `注入金额：<strong>${escapeHtml(money(injectAmount.value))}</strong>`,
    `目标池：<strong>${escapeHtml(pool ? poolLabel(pool) : `池 ${injectPoolId.value}`)}</strong>`,
    `注入层：<strong style="color:#e6a23c">${escapeHtml(injectLayerLabel.value)}（${escapeHtml(injectLayer.value)}）</strong>`
      + `<br/><span style="color:#909399">${escapeHtml(injectLayerDesc.value)}</span>`,
    `备注：${escapeHtml(injectRemark.value.trim() || '（未填写）')}`,
    `生效口径：${sameDay
      ? '<strong style="color:#f56c6c">已开启「当日生效」——今天正在发放的批次会立刻把这笔注入吃掉（仅当日特别重发才用）</strong>'
      : '次日生效：今天注入 → 从<b>明天</b>的发放批次开始被消费'}`,
  ].join('<br/>')
}

/** 打开注入弹窗：每次重新拉一遍池列表（避免选到过期的池号），并把所有输入复位到默认值。 */
function openInject(): void {
  injectAmount.value = 0
  injectLayer.value = 'BOTH'
  injectPoolId.value = ''
  injectRemark.value = ''
  injectAllowSameDay.value = false
  injectVisible.value = true
  void loadPools()
}

async function submitInject(): Promise<void> {
  if (injecting.value) return
  // ① 金额校验：对应后端 400「注入金额必须大于 0」，前端先拦一道，文案与后端保持一致
  if (!Number.isFinite(injectAmount.value) || injectAmount.value <= 0) {
    ElMessage.warning('注入金额必须大于 0')
    return
  }
  // ② 目标池必填（文档 §7.5）：不传 = 不限池 ⇒ 这笔钱可能流到后面的周池、发给不该发的批次。
  //    这是「钱发错地方」的资金错误且不可逆，所以宁可挡住操作，也不允许空着提交。
  const poolId = Number(injectPoolId.value)
  if (!injectPoolId.value || !Number.isFinite(poolId) || poolId <= 0) {
    ElMessage.warning('请选择目标分红池（给正在发放中的周池注入必须指定池号，否则这笔注入可能流到后面的周池）')
    return
  }
  const pool = pools.value.find((item) => String(item.id) === injectPoolId.value)
  try {
    await ElMessageBox.confirm(injectConfirmHtml(pool), '应急红包池注入确认', {
      type: 'warning',
      dangerouslyUseHTMLString: true,
      confirmButtonText: '确认注入',
      cancelButtonText: '取消',
    })
  } catch {
    return // 用户取消，静默返回（ElMessageBox 取消时 reject 的是字符串，不必提示）
  }
  injecting.value = true
  try {
    // 只传用户真正填了的字段：`allowSameDay` 为 false 时传 undefined（= 不传，后端默认「次日生效」），
    // 避免把一个含义敏感的字段显式写进请求体后被误读。
    await injectEmergencyPool({
      amount: injectAmount.value,
      poolId,
      layer: injectLayer.value,
      allowSameDay: injectAllowSameDay.value || undefined,
      remark: injectRemark.value.trim() || undefined,
    })
    injectVisible.value = false
    ElMessage.success('应急红包池注入成功；该笔注入从次日的发放批次开始生效（已开启当日生效时除外）')
    await load()
  } catch (error) {
    // ⚠️ 错误文案**原样展示、不做二次包装**（文档 §7.6）：
    // 400 注入金额必须大于 0 / 应急池余额不足，无法注入 / 注入目标层只能是 NEW / OLD / BOTH；
    // 403 角色不足（仅 SUPER_ADMIN / FINANCE）—— 后端 message 比前端兜底文案更准确，吞掉会让人查不出原因。
    ElMessage.error(error instanceof Error ? error.message : '注入失败')
  } finally {
    injecting.value = false
  }
}

function pageChange(next: number): void { page.value = next; void load() }
function sizeChange(size: number): void { pageSize.value = size; page.value = 1; void load() }

onMounted(() => { void load() })
</script>

<template>
  <div class="emergency-pool">
    <el-card shadow="never" class="content-card overview-card">
      <div class="toolbar">
        <div><strong>应急红包池</strong></div>
        <div class="toolbar-actions">
          <el-button :loading="loading" @click="load"><el-icon><Refresh /></el-icon>刷新</el-button>
          <el-button type="primary" @click="openInject"><el-icon><TrendCharts /></el-icon>注入应急红包池</el-button>
        </div>
      </div>
      <el-descriptions :column="4" border>
        <el-descriptions-item label="当前余额">{{ money(overview?.balance) }}</el-descriptions-item>
        <el-descriptions-item label="累计抽取">{{ money(overview?.totalDeduct) }}</el-descriptions-item>
        <el-descriptions-item label="累计注入">{{ money(overview?.totalInject) }}</el-descriptions-item>
        <el-descriptions-item label="待注入">{{ money(overview?.pendingInject) }}</el-descriptions-item>
      </el-descriptions>
      <!-- 总账自检（文档 §7.7 / 附录 A.1）：恒等式 balance = total_deducted − total_injected 永远成立，
           不成立即总账数据异常，提示运营先核对、先不要注入。注意「待注入」不参与该恒等式。 -->
      <div v-if="balanceCheck" class="ledger-check">
        <el-tag v-if="balanceCheck.ok" type="success" size="small">总账自检通过：余额 = 累计抽取 − 累计注入</el-tag>
        <el-tag v-else type="danger" size="small">⚠️ 总账自检不通过：余额应为 {{ money(balanceCheck?.expected) }}，与当前余额不符，请先核对账务再注入</el-tag>
      </div>
    </el-card>

    <el-card shadow="never" class="content-card">
      <div class="toolbar">
        <div><strong>流水明细</strong><span class="toolbar-count">共 {{ total }} 条</span></div>
        <div class="toolbar-actions">
          <!-- ⚠️ 不选中 = 不传 type = 全部；不要加一个 value="ALL" 的选项（后端会判非法并回退，多打 WARN 日志） -->
          <el-select v-model="filters.type" clearable placeholder="全部类型" style="width: 170px" @change="search">
            <el-option label="订单抽取" value="DEDUCT" />
            <el-option label="后台注入" value="INJECT" />
            <el-option label="注入随结算入池" value="INJECT_SETTLE" />
            <el-option label="发放均分余数" value="REMAINDER" />
            <el-option label="冲账反向退回" value="REVERSAL" />
          </el-select>
          <el-date-picker
            v-model="filters.dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 260px"
            @change="search"
          />
          <el-button type="primary" :icon="Search" :loading="loading" @click="search">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </div>
      </div>

      <!-- 汇总（按当前筛选范围聚合，与分页无关）；后端未下发 summary 时整块隐藏 -->
      <el-descriptions v-if="summary" :column="4" border class="summary-card">
        <el-descriptions-item label="抽取合计">
          {{ money(summary.deductAmount) }}<span class="summary-sub">（{{ summary.deductCount }} 笔）</span>
        </el-descriptions-item>
        <el-descriptions-item label="注入合计">
          {{ money(summary.injectAmount) }}<span class="summary-sub">（{{ summary.injectCount }} 笔）</span>
        </el-descriptions-item>
        <el-descriptions-item label="发放均分余数">
          {{ money(summary.remainderAmount) }}<span class="summary-sub">（{{ summary.remainderCount }} 笔）</span>
        </el-descriptions-item>
        <el-descriptions-item label="单均抽取">
          <el-tag v-if="deductPerOrderState() === 'none'" type="info" size="small">无抽取</el-tag>
          <el-tag v-else :type="deductPerOrderState() === 'ok' ? 'success' : 'danger'" size="small">{{ money(summary.deductPerOrder ?? undefined) }}</el-tag>
          <span class="summary-sub">正常应为 ¥100.00</span>
        </el-descriptions-item>
      </el-descriptions>

      <DataTable :data="logs" :loading="loading" :total="total" :page="page" :page-size="pageSize" empty-text="暂无应急红包池流水" @page-change="pageChange" @size-change="sizeChange">
        <el-table-column prop="createTime" label="时间" min-width="170" />
        <el-table-column label="类型" width="150"><template #default="{ row }"><el-tag :type="logTypeTag(row.type)">{{ logTypeText(row) }}</el-tag></template></el-table-column>
        <el-table-column label="金额" width="120"><template #default="{ row }">{{ money(row.amount) }}</template></el-table-column>
        <el-table-column prop="orderNo" label="来源订单号" min-width="180"><template #default="{ row }">{{ row.orderNo || '—' }}</template></el-table-column>
        <el-table-column prop="productName" label="来源商品" min-width="150"><template #default="{ row }">{{ row.productName || '—' }}</template></el-table-column>
        <el-table-column prop="remark" label="说明" min-width="170"><template #default="{ row }">{{ row.remark || '—' }}</template></el-table-column>
      </DataTable>
    </el-card>

    <el-dialog v-model="injectVisible" title="注入应急红包池" width="540px" append-to-body>
      <el-form label-width="90px">
        <el-form-item label="注入金额" required>
          <el-input-number v-model="injectAmount" :min="0" :precision="2" :step="0.01" controls-position="right" style="width: 200px" />
          <span class="inject-tip">当前应急池余额 {{ money(overview?.balance) }}，注入额不得超过余额（否则后端回 400「应急池余额不足」）</span>
        </el-form-item>

        <!-- ⚠️ 目标池**必填**（文档 §7.5）：给正在发放中的周池注入务必指定池号；
             不传 = 不限池 ⇒ 这笔钱可能流到后面的周池。列表按池起始日倒序，最上面是最近的周池。 -->
        <el-form-item label="目标池" required>
          <el-select v-model="injectPoolId" :loading="poolsLoading" clearable filterable placeholder="请选择目标分红池（按周次核对池号）" style="width: 100%">
            <el-option v-for="pool in pools" :key="pool.id" :label="poolLabel(pool)" :value="pool.id" />
          </el-select>
        </el-form-item>

        <!-- ⚠️ 注入层决定「钱加给谁」：新层 = 本周新单（按订单分）/ 老层 = 老用户（按槽位分）/ 两层 = 70/30 拆 -->
        <el-form-item label="注入层" required>
          <el-radio-group v-model="injectLayer" class="inject-layer-group">
            <el-radio v-for="item in INJECT_LAYERS" :key="item.value" :value="item.value">{{ item.label }}</el-radio>
          </el-radio-group>
          <div class="inject-layer-desc">{{ injectLayerDesc }}</div>
        </el-form-item>

        <el-form-item label="备注">
          <el-input v-model="injectRemark" type="textarea" :rows="2" maxlength="100" show-word-limit placeholder="建议写清用途，会写进应急池流水备查" />
        </el-form-item>

        <el-form-item label="生效口径">
          <span class="inject-tip">默认「次日生效」：注入日 ≤ 批次成交日才会被消费，所以正在发放中的周池也能吃到这笔钱（从明天的批次开始）。</span>
        </el-form-item>

        <!-- ⚠️ allowSameDay 默认不展示（文档 §7.5）：传错会让**当天**正在发放的批次立刻把这笔注入吃掉，
             与「次日生效」的预期不符，所以藏在「高级选项」里并标注用途。 -->
        <el-collapse class="inject-advanced">
          <el-collapse-item title="高级选项：当日生效（仅当日特别重发使用）" name="advanced">
            <div class="inject-advanced-row">
              <el-switch v-model="injectAllowSameDay" active-text="允许当日批次消费这笔注入" />
              <div class="inject-advanced-desc">
                开启后「发放日 = 注入日」的批次也会消费这笔注入，即<b>今天</b>正在发放的批次会立刻把它吃掉（与「次日生效」的预期不符）。只有当日特别重发时才开启。
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </el-form>
      <template #footer><el-button @click="injectVisible = false">取消</el-button><el-button type="primary" :loading="injecting" @click="submitInject">确认注入</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped>
.overview-card { margin-bottom: 16px; }
.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.toolbar-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.toolbar-count { margin-left: 12px; color: var(--el-text-color-secondary); font-size: 13px; }
/* 汇总区：与上方筛选栏拉开距离，视觉上归为一组 */
.summary-card { margin: 12px 0 16px; }
.summary-sub { margin-left: 6px; color: var(--el-text-color-secondary); font-size: 12px; }
.inject-tip { margin-left: 8px; color: var(--el-text-color-secondary); font-size: 13px; line-height: 1.6; }
/* 注入层三选项竖排：横向排会挤在一起，且说明文字放不下；gap 补上 el-radio 之间的默认右间距 */
.inject-layer-group { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
.inject-layer-desc { margin-top: 2px; color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.6; }
.inject-advanced { margin: 0 0 4px 6px; }
/* 高级选项内的说明：不复用 .inject-tip 的 margin-left，改为整块换行说明 */
.inject-advanced-row { padding: 0 2px; }
.inject-advanced-desc { margin-top: 6px; color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.6; }
/* 总账自检提示：紧跟在总账 descriptions 下方 */
.ledger-check { margin-top: 8px; }
</style>
