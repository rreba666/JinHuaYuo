<script setup lang="ts">
/**
 * 红包发放明细（红包管理 → 红包明细）
 *
 * 2026-09-19 新增。回答「这一批红包发给了谁、每人多少、新/老用户层各发多少、账实是否相符」。
 *
 * 三条关键口径（来自接口契约）：
 * ① 列表**不分页、也不过过滤状态**（未发的批次也会返回）→ 前端自己按 `status` 分组筛选；
 * ② `distributedAmount` 是**逐用户明细合计（真值）**，`recordedAmount` 是**批次表登记值（仅对账用）**
 *    —— **两者不等 = 账实不符**，表格里直接标红（9/21 那次事故正是「登记值 = 0 但钱已实发」）；
 * ③ `recordCount`（明细条数）**不等于** `userCount`（发放人数）：同一用户当日会同时出现在
 *    「新用户层」与「老用户层」，因此条数会比人数多。
 *
 * 2026-09-24 新增「老层一次性补发」入口（对接文档《老层一次性发放-前端对接文档-20260924》）：
 * 老层的钱**按槽位发**，池内除已轮到过的槽位外还剩一批没发，可以不等的 7 天轮转、当天一次性发完。
 * 三条硬约束（都来自文档，代码里逐个注释了原因）：
 * ① **金额一律由后端按「该层目标总额 − 本池已发」推导**，前端只展示、不算钱、更不上传名单或金额
 *    （提交时服务端会**重新预演**，不信任前端）；
 * ② `confirmToken` **一次性 + 30 分钟有效**且绑定「池 + 槽位集合 + 金额摘要」，
 *    提交失败要回到预演重新拿令牌，**绝不做"重试直到成功"**；
 * ③ 补发批次 `batch_no` 固定为 **8**（常规日切片批次固定 `1~7`），列表里要打标签区分 ——
 *    且**同一天会出现两行**（常规批次 + 补发批次），前端**不得**按发放日去重/合并。
 *
 * 入口权限：`/api/admin/profit/**` 后端允许 `SUPER_ADMIN` / `FINANCE`，而本页所在路由 `/redpacket`
 * 本身就只对超管开放（`utils/permission.ts` 的 `ROLE_ROUTES`），所以这里不需要再加按钮级角色判断。
 */
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Money, Refresh, View } from '@element-plus/icons-vue'
import { commitOldLayerOneShot, getDividendPacketDetail, getDividendPackets, previewOldLayerOneShot } from '@/api/profit'
import type { DividendPacket, DividendPacketDetail, OldLayerOneShotVO } from '@/types/profit'
import { normalizeLegacyWording } from '@/utils/wording'

const packets = ref<DividendPacket[]>([])
const loading = ref(false)
const statusFilter = ref('')
const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<DividendPacketDetail | null>(null)
/** 当前查看的列表行（头信息兜底用，见 `detailView`）。 */
const detailRow = ref<DividendPacket | null>(null)

/**
 * 详情弹窗的头信息：**详情优先、列表行兜底**。
 *
 * ⚠️ 为什么不能只用详情：后端 `DividendPacketDetailVO` **不返回** `recordedAmount`（登记值）与
 * `recordCount`（明细条数），而这两个正是判断「账实是否相符」的关键字段 ——
 * 直接用详情会把它们显示成 `¥0.00` / 空。这份数据列表接口是有的，所以从列表行兜底取。
 */
const detailView = computed<Partial<DividendPacket & DividendPacketDetail>>(() => ({
  ...(detailRow.value || {}),
  ...(detail.value || {}),
}))

/**
 * 金额展示（元，固定两位小数）。
 * 入参放宽到 `number | null`：补发结果里的 `distributedAmount` / `toEmergencyPool` 类型就是可空的
 * （`strict` 下 `null` 不能赋给 `number | undefined`），这里统一兜底成 0，调用处不必再写 `?? 0`。
 */
function money(value?: number | null): string { return `¥ ${Number(value || 0).toFixed(2)}` }

/** 批次状态文案（后端枚举：`PENDING`=待发放 / `PROCESSING`=发放中 / `COMPLETED`=已发放）。 */
function statusText(status?: string): string {
  if (!status) return '—'
  return ({ PENDING: '待发放', PROCESSING: '发放中', COMPLETED: '已发放' } as Record<string, string>)[status] || status
}

/** 是否账实相符：真值（逐用户明细合计）与批次表登记值一致。 */
function isBalanced(row: DividendPacket): boolean {
  return Number(row.distributedAmount || 0) === Number(row.recordedAmount || 0)
}

/**
 * 是否为「老层一次性补发」批次（列表里打「一次性补发」标签用）。
 *
 * ⚠️ 文档 §八：补发批次 `batch_no` **固定为 8**，常规日切片批次号固定为 `1~7`（`k` = 该池第 k 天）。
 * 两者**可能落在同一天**（例如 09-24 同时有批次号 4 与 8 两行），不标出来运营会误以为重复发放。
 * ⚠️ 后端 `batchNo` 可能下发数字、也可能下发字符串（类型标的是 `string`），
 * 这里统一 `String()` 后比较，避免 `8 === '8'` 为 false 导致标签不显示。
 */
function isOneShotBatch(row: DividendPacket): boolean {
  return String(row.batchNo ?? '').trim() === '8'
}

/** 状态筛选项（从返回数据里归纳，避免硬编码；文案走 `statusText`）。 */
const statusOptions = computed(() => {
  const seen = new Set<string>()
  for (const row of packets.value) {
    const value = String(row.status ?? '')
    if (value) seen.add(value)
  }
  return [...seen].map((value) => ({ value, label: statusText(value) }))
})

/**
 * 状态过滤后的列表。
 *
 * ⚠️ **只过滤，不排序、不去重、不合并** —— 顺序完全沿用后端给的「发放日 DESC, 批次号 DESC」。
 * 文档 §八明确：补发批次与常规批次**发放日可以相同**（09-24 就是两行：批次号 4 与 8），
 * 补发那行会排在上面。一旦这里按 `distributionDate` 做 `Map`/去重/分组，两行就会被合并成一行、
 * 补发批次直接从页面上消失。另外表格没有设 `row-key`，不存在行合并问题。
 * 过滤器只按 `status` 过滤，不会打乱同一天多行的相对顺序。
 */
const visiblePackets = computed(() => (statusFilter.value
  ? packets.value.filter((row) => String(row.status ?? '') === statusFilter.value)
  : packets.value))

/** 当前筛选下的账实不符条数（列表上方提示用）。 */
const unbalancedCount = computed(() => visiblePackets.value.filter((row) => !isBalanced(row)).length)

/* ===================== 老层一次性补发（2026-09-24 新增） ===================== */

/** 预演中（工具栏按钮 loading + 置灰，防连点）。 */
const oneShotPreviewing = ref(false)
/** 提交中：不可逆操作，按钮必须置灰防连点（文档 §五 第 4 点：池24 起可能有上百个槽位，接口耗时略长）。 */
const oneShotCommitting = ref(false)
/** 补发弹窗显隐：预演 → 二次确认 → 提交结果 全在这一个弹窗里走完。 */
const oneShotVisible = ref(false)
/** 预演结果（含 `blockers` / `confirmToken` / 各口径金额）。 */
const oneShotPlan = ref<OldLayerOneShotVO | null>(null)
/** 提交成功后的执行结果（与预演同一个 VO，`executed = true`）。 */
const oneShotResult = ref<OldLayerOneShotVO | null>(null)

/**
 * 阻断项文案（`blockers` 非空即不可执行）。
 *
 * ⚠️ **原样展示后端下发的文案**：不改写、不归纳、不拼接。这里只过一遍 `normalizeLegacyWording` ——
 * 它是全站统一的"历史用词归一化"（旧词 → 「红包」），只换词、不改语义，符合"原样展示"的要求。
 * ⚠️ 兼容后端漏字段的情况，一律 `|| []`，避免模板里对 undefined 取 length。
 */
const oneShotBlockers = computed(() => (oneShotPlan.value?.blockers || []).map((text) => normalizeLegacyWording(text)))

/**
 * 是否允许提交：**无阻断项** 且 **拿到了预演令牌**。
 * 有阻断项时后端 `confirmToken` 为 `null`，两个条件任一不满足都要禁用提交（文档 §三 / §五）。
 */
const oneShotExecutable = computed(() => !oneShotBlockers.value.length && !!oneShotPlan.value?.confirmToken)

/** 老层发放模式文案（只读展示，让运营确认当前池走的是轮转还是一次性口径）。 */
function oldLayerModeText(mode?: string): string {
  return ({ ROTATION: '按名单 7 天轮转', ONE_SHOT: '每周一一次性发完' } as Record<string, string>)[String(mode || '')]
    || String(mode || '—')
}

/**
 * 池成交日区间（池窗口固定 7 天 = 首成交日 +0 ~ +6 天）。
 *
 * ⚠️ 接口只下发 `poolStartDate`（池首成交日），结束日是**前端推导的展示值**，仅供运营核对，
 * 与文档 §五 确认框示意里的「2026-09-14 ~ 09-20」口径一致。
 * ⚠️ 日期一律走 **UTC 运算 + UTC 格式化**：`new Date('2026-09-14')` 是按 UTC 午夜解析的，
 * 若再用本地时间 `toLocaleDateString()` 格式化，在西半球时区会**退回前一天**
 * （东八区看不出来，属于环境相关的隐性地雷，所以这里只做字符串化 UTC 运算）。
 */
function poolDateRange(startDate?: string): string {
  const matched = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(startDate || ''))
  if (!matched) return String(startDate || '—')
  const start = new Date(Date.UTC(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3])))
  const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000)
  const format = (date: Date): string => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
  return `${format(start)} ~ ${format(end)}`
}

/**
 * ① 预演（只读）：**不传 `poolId`** = 取当前**未关闭**的池（正常只有一个）。
 *
 * 预演结果只做两件事：给运营看清数字、拿到一次性令牌。
 * **前端绝不自己算钱、也绝不上传名单或金额**（文档 §三 / §四）。
 * ⚠️ 提交失败后要**自动回到这一步**（文档 §五 第 1 点），所以这里允许被重复调用并覆盖 `oneShotPlan`。
 */
async function previewOneShot(): Promise<void> {
  if (oneShotPreviewing.value) return // 防连点：池24 起可能上百个槽位，接口耗时略长
  oneShotPreviewing.value = true
  try {
    oneShotPlan.value = await previewOldLayerOneShot()
    // ⚠️ 重新预演 = 上一次的结果视图与旧令牌同时作废（令牌一次性且绑定计划摘要），
    // 必须清掉旧结果，否则运营可能把上一次的成功结果误当成这一次的。
    oneShotResult.value = null
    oneShotVisible.value = true
  } catch (error) {
    // 连预演都失败（网络 / 403 / 404 接口未上线）：关掉弹窗，不能让运营对着空弹窗点提交
    oneShotPlan.value = null
    oneShotResult.value = null
    oneShotVisible.value = false
    ElMessage.error(normalizeLegacyWording(error instanceof Error ? error.message : '老层一次性补发预演失败'))
  } finally {
    oneShotPreviewing.value = false
  }
}

/**
 * ③ 提交（**不可逆：提交后立即发钱**）：只回传 `poolId` + `confirmToken`。
 *
 * ⚠️ **绝对不传槽位列表或金额** —— 服务端会重新预演、不信任前端传来的任何名单/金额（文档 §四），
 * 传了也没用，只会造成"前端算的钱和实际发的钱不一致"的假象。
 * ⚠️ 失败（`code != 0`）时展示后端 `message` 并**自动回到 ① 重新预演**：
 * 令牌是一次性的，**不做"重试直到成功"**（文档 §五 第 2 点，重复提交必被拒）。
 */
async function submitOneShot(): Promise<void> {
  const plan = oneShotPlan.value
  if (!plan || oneShotCommitting.value) return
  if (oneShotBlockers.value.length) return // 有阻断项：提交按钮已置灰，这里再兜一道，防误触发
  const confirmToken = String(plan.confirmToken || '')
  if (!confirmToken) {
    // 令牌缺失/已失效（例如预演后在弹窗上停留超过 30 分钟）：不给提交，先重新预演拿新令牌
    ElMessage.warning('预演令牌已失效，正在重新预演，请再次确认')
    await previewOneShot()
    return
  }
  oneShotCommitting.value = true
  try {
    // 只回传这两个字段；服务端重新预演后按自己的口径发钱
    oneShotResult.value = await commitOldLayerOneShot({ poolId: plan.poolId, confirmToken })
    ElMessage.success('老层一次性补发已执行')
    // 刷新列表：补发批次（batch_no = 8）会立即出现（补发是单事务、一发到底，列表里不会出现"发放中"），
    // 运营可在本页直接核对这一行的「新层 + 老层 = 发放金额（真值）」。
    await load()
  } catch (error) {
    ElMessage.error(normalizeLegacyWording(error instanceof Error ? error.message : '老层一次性补发提交失败'))
    oneShotPlan.value = null // 先作废旧令牌，避免运营拿它再点一次提交（必被后端拒）
    // 自动回到第 ① 步重新预演；若本池已补发过，预演会直接下发对应的阻断文案，正好提示运营"已完成"
    await previewOneShot()
  } finally {
    oneShotCommitting.value = false
  }
}

/** 弹窗关闭后清空本地计划：令牌一次性 + 30 分钟有效，下次进入必须重新预演（文档 §五）。 */
function resetOneShot(): void {
  oneShotPlan.value = null
  oneShotResult.value = null
}

async function load(): Promise<void> {
  loading.value = true
  try {
    packets.value = await getDividendPackets()
  } catch (error) {
    packets.value = []
    ElMessage.error(error instanceof Error ? error.message : '红包明细加载失败')
  } finally {
    loading.value = false
  }
}

/** 查看某批次的发放人员明细。红包不存在时后端返回 code=1002，此处如实提示。 */
async function openDetail(row: DividendPacket): Promise<void> {
  detailRow.value = row
  detailVisible.value = true
  detailLoading.value = true
  detail.value = null
  try {
    detail.value = await getDividendPacketDetail(row.id)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '红包明细详情加载失败')
    detailVisible.value = false
  } finally {
    detailLoading.value = false
  }
}

/** 用户层文案：NEW 新用户层 / OLD 老用户层 / 历史数据为空。 */
function segmentText(segment?: string | null): string {
  if (!segment) return '—'
  return segment === 'NEW' ? '新用户层' : segment === 'OLD' ? '老用户层' : segment
}

onMounted(() => { void load() })
</script>

<template>
  <el-card shadow="never" class="content-card">
    <div class="toolbar">
      <div>
        <strong>红包发放明细</strong>
        <span class="toolbar-count">共 {{ visiblePackets.length }} 批</span>
        <!-- 账实不符直接提示到列表上方，避免运营逐行比对 -->
        <el-tag v-if="unbalancedCount" type="danger" size="small" class="unbalanced-tip">有 {{ unbalancedCount }} 批账实不符</el-tag>
      </div>
      <div class="toolbar-actions">
        <!-- 老层一次性补发入口：点击先预演（不传 poolId = 当前未关闭的池），再由弹窗二次确认 -->
        <el-button
          type="primary"
          :loading="oneShotPreviewing"
          :disabled="oneShotPreviewing || oneShotCommitting"
          @click="previewOneShot"
        >
          <el-icon><Money /></el-icon>老层一次性补发
        </el-button>
        <el-select v-model="statusFilter" clearable placeholder="全部状态" style="width: 160px">
          <el-option v-for="opt in statusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
        <el-button :loading="loading" @click="load"><el-icon><Refresh /></el-icon>刷新</el-button>
      </div>
    </div>

    <el-table :data="visiblePackets" v-loading="loading" border stripe max-height="620">
      <el-table-column prop="distributionDate" label="发放日期" width="130" />
      <el-table-column label="发放金额（真值）" width="160">
        <template #default="{ row }">
          <span class="amount-strong">{{ money(row.distributedAmount) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="登记值（对账）" width="160">
        <template #default="{ row }">
          <span :class="{ 'amount-mismatch': !isBalanced(row) }">{{ money(row.recordedAmount) }}</span>
          <el-tag v-if="!isBalanced(row)" type="danger" size="small" class="mismatch-tag">账实不符</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="userCount" label="发放人数" width="110" />
      <el-table-column label="明细条数" width="130">
        <template #default="{ row }">
          <span>{{ row.recordCount }}</span>
          <!-- 条数 > 人数是正常的：同一用户当日会在新/老两个用户层各有一条明细 -->
          <el-tooltip v-if="Number(row.recordCount) > Number(row.userCount)" content="条数多于人数属正常：同一用户当日会同时出现在新用户层与老用户层" placement="top">
            <el-icon class="tip-icon"><View /></el-icon>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="新用户层" width="130"><template #default="{ row }">{{ money(row.newUserAmount) }}</template></el-table-column>
      <el-table-column label="老用户层" width="130"><template #default="{ row }">{{ money(row.oldUserAmount) }}</template></el-table-column>
      <el-table-column label="批次号" min-width="150">
        <template #default="{ row }">
          <span>{{ row.batchNo || '—' }}</span>
          <!-- 批次号 8 = 老层一次性补发批次（常规日切片批次固定 1~7）：打标签避免运营以为重复发放 -->
          <el-tag v-if="isOneShotBatch(row)" type="warning" size="small" class="oneshot-tag">一次性补发</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="120">
        <template #default="{ row }"><el-tag size="small" :type="isBalanced(row) ? 'success' : 'warning'">{{ statusText(row.status) }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="completedAt" label="完成时间" min-width="170"><template #default="{ row }">{{ row.completedAt || '—' }}</template></el-table-column>
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }"><el-button size="small" type="primary" @click="openDetail(row)">查看明细</el-button></template>
      </el-table-column>
    </el-table>
  </el-card>

  <el-dialog v-model="detailVisible" title="红包发放人员明细" width="880px" append-to-body>
    <div v-loading="detailLoading">
      <el-descriptions v-if="detailRow" :column="3" border class="detail-head">
        <el-descriptions-item label="发放日期">{{ detailView.distributionDate || '—' }}</el-descriptions-item>
        <el-descriptions-item label="发放金额（真值）">{{ money(detailView.distributedAmount) }}</el-descriptions-item>
        <el-descriptions-item label="登记值（对账）">{{ money(detailView.recordedAmount) }}</el-descriptions-item>
        <el-descriptions-item label="发放人数">{{ detailView.userCount ?? '—' }}</el-descriptions-item>
        <el-descriptions-item label="明细条数">{{ detailView.recordCount ?? '—' }}</el-descriptions-item>
        <el-descriptions-item label="批次号">{{ detailView.batchNo || '—' }}</el-descriptions-item>
      </el-descriptions>
      <el-alert
        v-if="detailRow && Number(detailView.distributedAmount || 0) !== Number(detailView.recordedAmount || 0)"
        type="error"
        :closable="false"
        show-icon
        class="detail-alert"
        title="账实不符：发放真值与批次表登记值不一致"
        description="以「发放金额（真值）」为准（它是逐用户明细的合计）；登记值仅用于对账，不一致说明批次表写入有问题。"
      />
      <el-table :data="detail?.members || []" border stripe max-height="460">
        <el-table-column prop="userId" label="用户 ID" width="120" />
        <el-table-column label="用户" min-width="160">
          <template #default="{ row }">{{ row.nickname || `用户${row.userId}` }}</template>
        </el-table-column>
        <el-table-column label="发放金额" width="130"><template #default="{ row }">{{ money(row.amount) }}</template></el-table-column>
        <el-table-column label="用户层" width="120"><template #default="{ row }">{{ segmentText(row.userSegment) }}</template></el-table-column>
        <el-table-column prop="orderCount" label="参与分配订单数" width="150" />
        <el-table-column label="发放状态" width="110"><template #default="{ row }">{{ statusText(row.status) }}</template></el-table-column>
      </el-table>
      <el-empty v-if="!detailLoading && !(detail?.members || []).length" description="该批次暂无发放明细" />
    </div>
  </el-dialog>

  <!--
    老层一次性补发：预演结果 → 二次确认 → 提交结果，全部在这一个弹窗里走完（文档 §五 的流程图）。
    - close-on-click-modal=false：不可逆操作，避免误点遮罩关掉
    - 预演 / 提交进行中关闭右上角 X、禁用 ESC 与「关闭」：否则弹窗被关掉后，
      在途的请求返回时会把弹窗又"自动弹回来"，运营会以为是自己点错了
  -->
  <el-dialog
    v-model="oneShotVisible"
    title="老层一次性补发"
    width="640px"
    append-to-body
    :close-on-click-modal="false"
    :close-on-press-escape="!oneShotCommitting && !oneShotPreviewing"
    :show-close="!oneShotCommitting && !oneShotPreviewing"
    @closed="resetOneShot"
  >
    <!-- ②-0 阻断项：非空即不可执行，**原样展示后端文案**，提交按钮置灰，流程到此结束 -->
    <el-alert
      v-if="!oneShotResult && oneShotBlockers.length"
      type="error"
      :closable="false"
      show-icon
      class="oneshot-alert"
      title="当前不可执行补发"
      description="以下为后端预演下发的阻断原因（原样展示）。成因消除后点「重新预演」再看一次。"
    >
      <ul class="oneshot-blockers">
        <li v-for="(text, index) in oneShotBlockers" :key="index">{{ text }}</li>
      </ul>
    </el-alert>

    <!-- ③ 提交成功：批次号 / 实发金额 / 人数 + toEmergencyPool 非 0 时高亮告警 -->
    <template v-else-if="oneShotResult">
      <el-alert
        type="success"
        :closable="false"
        show-icon
        class="oneshot-alert"
        title="补发已执行完成"
        description="补发是单事务、一发到底的结果，无需轮询等待。"
      />
      <el-descriptions :column="2" border class="oneshot-desc">
        <el-descriptions-item label="补发批次">
          <span class="amount-strong">{{ oneShotResult.batchId ?? '—' }}</span>
          <span class="oneshot-sub">（列表中的批次号 8，带「一次性补发」标签）</span>
        </el-descriptions-item>
        <el-descriptions-item label="实发金额（真值）">{{ money(oneShotResult.distributedAmount) }}</el-descriptions-item>
        <el-descriptions-item label="实发人数">{{ oneShotResult.pendingSlotCount }} 人</el-descriptions-item>
        <el-descriptions-item label="逐人明细条数">{{ (oneShotResult.members || []).length }} 条</el-descriptions-item>
        <el-descriptions-item label="奖池 ID">{{ oneShotResult.poolId }}</el-descriptions-item>
        <el-descriptions-item label="执行时间">{{ oneShotResult.executedAt || '—' }}</el-descriptions-item>
        <el-descriptions-item v-if="oneShotResult.executedInfo" label="执行说明" :span="2">{{ oneShotResult.executedInfo }}</el-descriptions-item>
      </el-descriptions>
      <!--
        ⚠️ toEmergencyPool 正常恒为 0.00；非 0 表示**有槽位快到 1.5 倍封顶被截断**，
        钱没发到用户手里、进了应急池 —— 这属于必须让运营看见的异常，所以用 error 级高亮。
      -->
      <el-alert
        v-if="Number(oneShotResult.toEmergencyPool || 0) !== 0"
        type="error"
        :closable="false"
        show-icon
        class="oneshot-alert"
        :title="`⚠️ 有 ${money(oneShotResult.toEmergencyPool)} 未发放到用户、已进应急池`"
        description="说明本池有老层槽位已接近封顶额度被截断。请核对这些槽位并关注后续发放；不要拿这个金额去对应急池总账 —— 它只是「本批有没有被截断」的提示位。"
      />
      <p class="oneshot-hint">
        逐人明细可在下方「红包发放明细」列表找到本次批次（批次号 8，带「一次性补发」标签）后点「查看明细」；
        该行的批次 ID 为 {{ oneShotResult.batchId ?? '—' }}。
      </p>
    </template>

    <!-- ② 可执行：二次确认。必须让运营看清「发多少 / 人均怎么浮动 / 池与账务口径」三组数字 -->
    <template v-else-if="oneShotPlan">
      <el-descriptions :column="2" border class="oneshot-desc">
        <el-descriptions-item label="本次补发" :span="2">
          <span class="amount-strong">{{ oneShotPlan.pendingSlotCount }}</span> 个老层槽位
          <span class="oneshot-sub">（合格 {{ oneShotPlan.eligibleSlotCount }} − 已轮到 {{ oneShotPlan.alreadyPaidSlotCount }}）</span>
        </el-descriptions-item>
        <el-descriptions-item label="应发金额">
          <span class="amount-strong">{{ money(oneShotPlan.pendingAmount) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="其中注入">
          {{ money(oneShotPlan.injectAmount) }}
          <span class="oneshot-sub">（基础 {{ money(oneShotPlan.baseAmount) }}）</span>
        </el-descriptions-item>
        <el-descriptions-item label="人均约" :span="2">
          {{ money(oneShotPlan.perSlotAvg) }}
          <span class="oneshot-sub">逐人带 {{ oneShotPlan.floatMin }}~{{ oneShotPlan.floatMax }} 元浮动；合计精确等于应发、无尾差</span>
        </el-descriptions-item>
        <el-descriptions-item label="奖池与成交日" :span="2">
          {{ oneShotPlan.poolId }}
          <span class="oneshot-sub">（成交日 {{ poolDateRange(oneShotPlan.poolStartDate) }} · 状态 {{ oneShotPlan.poolStatus }} · 老层模式 {{ oldLayerModeText(oneShotPlan.oldLayerMode) }}）</span>
        </el-descriptions-item>
        <el-descriptions-item label="账务口径" :span="2">
          该层目标 {{ money(oneShotPlan.targetAmount) }} − 已发 {{ money(oneShotPlan.alreadyPaidAmount) }} = 本次应发 {{ money(oneShotPlan.pendingAmount) }}
        </el-descriptions-item>
      </el-descriptions>

      <!-- ⚠️ 不可撤销必须显式写出来，且用 error 级告警，不能只放在按钮文案里 -->
      <el-alert
        type="error"
        :closable="false"
        show-icon
        class="oneshot-alert"
        title="⚠️ 提交后立即发钱、不可撤销"
        description="确认后系统立即按本池剩余老层槽位逐人发钱。金额由后端按「目标总额 − 已发」推导，如与预期不符请取消并先核对账务；发错只能走人工补差 / 线下退款。"
      />
      <p class="oneshot-hint">
        提交只回传奖池 ID 与本次预演令牌，<strong>不上传槽位名单与金额</strong> —— 服务端会重新预演，避免照旧名单发钱。
      </p>
    </template>

    <template #footer>
      <!--
        ⚠️ 预演/提交进行中都禁用「取消/关闭」：否则弹窗被关掉后，在途的预演请求返回时会把弹窗
        又"自动弹回来"，运营会以为是自己点错了。
      -->
      <el-button :disabled="oneShotCommitting || oneShotPreviewing" @click="oneShotVisible = false">
        {{ oneShotResult ? '关闭' : '取消' }}
      </el-button>
      <!-- 阻断项多为「池内批次正在发放，请稍后重试」这类临时状态，给一个就地重跑的入口 -->
      <el-button
        v-if="!oneShotResult && oneShotBlockers.length"
        :loading="oneShotPreviewing"
        :disabled="oneShotCommitting || oneShotPreviewing"
        @click="previewOneShot"
      >
        重新预演
      </el-button>
      <!-- 有阻断项 / 无令牌时一律置灰，防止"以为能发其实发不了" -->
      <el-button
        v-if="!oneShotResult"
        type="danger"
        :loading="oneShotCommitting"
        :disabled="!oneShotExecutable || oneShotCommitting || oneShotPreviewing"
        @click="submitOneShot"
      >
        确认补发（立即发钱）
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.toolbar-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.toolbar-count { margin-left: 12px; color: var(--el-text-color-secondary); font-size: 13px; }
.unbalanced-tip { margin-left: 12px; }
.amount-strong { font-weight: 600; }
/* 账实不符：登记值标红，与「发放金额（真值）」形成对照 */
.amount-mismatch { color: var(--el-color-danger); font-weight: 600; }
.mismatch-tag { margin-left: 6px; }
.oneshot-tag { margin-left: 6px; }
.tip-icon { margin-left: 4px; color: var(--el-text-color-secondary); vertical-align: middle; }
.detail-head { margin-bottom: 12px; }
.detail-alert { margin-bottom: 12px; }
/* 老层一次性补发弹窗 */
.oneshot-alert { margin-bottom: 12px; }
.oneshot-desc { margin-bottom: 12px; }
.oneshot-blockers { margin: 4px 0 0; padding-left: 18px; line-height: 20px; }
.oneshot-sub { margin-left: 6px; color: var(--el-text-color-secondary); font-size: 12px; }
.oneshot-hint { margin: 0; color: var(--el-text-color-secondary); font-size: 12px; line-height: 18px; }
</style>
