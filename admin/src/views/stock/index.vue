<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { CopyDocument, Refresh, Search, Warning } from '@element-plus/icons-vue'
import DataTable from '@/components/DataTable.vue'
import { getRefundRestockGaps, getStockLedger, getStockOverview, getTotalStockDrifts } from '@/api/stock'
import type { RefundRestockGap, StockLedger, StockLedgerDetail, StockOverview, TotalStockDrift } from '@/types/stock'
import { copyToClipboard } from '@/utils/clipboard'

/**
 * 库存对账页（今华有肽后台，四个只读页签）。
 *
 * 数据源为后端的四个**只读**接口：
 * - 库存概览：`GET /api/admin/stock/overview` —— 每个启用 SKU 的**可售 / 锁定 / 在途 / 合计**（2026-09-18 新增，解决「锁定库存不可见导致对账对不上」）；
 * - 库存台账：`GET /api/admin/stock/ledger` —— 期初/期末/实际三值对照 + 「期初+变动=期末」自动断言；
 * - 退款应补未补：`GET /api/admin/stock/refund-restock-gaps` —— 已退款但库存未回补的订单项；
 * - 冗余列偏离：`GET /api/admin/stock/total-stock-drifts` —— `product.total_stock` 冗余列与真实可售库存的偏离基线。
 *
 * 入口：菜单「库存对账」，以及商品列表的「台账」列（带 `?productId=`/`?skuId=` 自动查询）。
 */
const route = useRoute()
const router = useRouter()
const activeTab = ref<'overview' | 'ledger' | 'gaps' | 'drifts'>('overview')

// ===== 页签零：库存概览（可售 / 锁定 / 在途 / 合计） =====
/**
 * 库存概览列表。接口**无分页**，一次拉全量、筛选在前端做。
 * 解决的核心盲区：**锁定库存**（下单占用但货未出库）此前在前端完全不可见，对账时对不上。
 */
const overviewList = ref<StockOverview[]>([])
const overviewLoading = ref(false)
const overviewLoaded = ref(false)
/** 接口未上线（404）时置 true：页内提示，避免看起来像参数或权限问题 */
const overviewUnavailable = ref(false)
/** 本地筛选关键词：商品名 / 商品 ID / SKU ID / SKU 名 */
const overviewKeyword = ref('')
/** 只看有锁定库存的 SKU（对账时通常最关心这部分） */
const overviewLockedOnly = ref(false)

/** 前端筛选后的概览行（接口无分页，全量在手）。 */
const overviewRows = computed(() => {
  const keyword = overviewKeyword.value.trim().toLowerCase()
  return overviewList.value.filter((row) => {
    if (overviewLockedOnly.value && row.lockedStock <= 0) return false
    if (!keyword) return true
    return String(row.productName).toLowerCase().includes(keyword)
      || String(row.productId).includes(keyword)
      || String(row.skuId).includes(keyword)
      || String(row.skuName).toLowerCase().includes(keyword)
  })
})

/** 概览汇总（按当前筛选结果）：SKU 数 / 可售 / 锁定 / 在途 合计。 */
const overviewSummary = computed(() => {
  const rows = overviewRows.value
  return {
    skuCount: rows.length,
    available: rows.reduce((sum, row) => sum + row.availableStock, 0),
    locked: rows.reduce((sum, row) => sum + row.lockedStock, 0),
    shipping: rows.reduce((sum, row) => sum + row.shipping, 0),
  }
})

/** 有锁定库存的行标黄：对账时最需要盯的部分。 */
function overviewRowClass({ row }: { row: StockOverview }): string {
  return row.lockedStock > 0 ? 'overview-locked-row' : ''
}

/** 加载库存实时概览（只读、无分页）。 */
async function loadOverview(): Promise<void> {
  overviewLoading.value = true
  try {
    overviewList.value = await getStockOverview()
    overviewLoaded.value = true
    overviewUnavailable.value = false
  } catch (error) {
    overviewList.value = []
    const message = error instanceof Error ? error.message : ''
    // 接口未上线（404 / 尚未上线）单独提示，避免与参数、权限问题混淆
    overviewUnavailable.value = /404|不存在|未上线|尚未上线/.test(message)
    ElMessage.error(message || '库存概览查询失败')
  } finally {
    overviewLoading.value = false
  }
}

// ===== 页签一：库存台账 =====
/** 台账查询的 ID 维度：`sku`=SKU ID（最精确） / `product`=商品 ID（后端解析该商品唯一的启用 SKU） */
const ledgerIdType = ref<'sku' | 'product'>('sku')
/** 台账查询的 ID 值（含义由 `ledgerIdType` 决定） */
const ledgerId = ref('')
const ledgerDateRange = ref<[string, string] | null>(null)
const ledger = ref<StockLedger | null>(null)
const ledgerLoading = ref(false)
const ledgerQueried = ref(false)
/** 明细每页条数（翻页页码用后端返回的 details.page，无需本地状态） */
const ledgerSize = ref(50)
/** 后端接口未上线（404 / 接口不存在）时置 true，页内改为提示而不是反复报错 */
const ledgerUnavailable = ref(false)

// ===== 页签二：退款应补未补 =====
/**
 * 退款**起始**时间。
 * ⚠️ 该接口只支持 `startTime`（文档 §3.1 与 api-docs 的参数都只有
 * `startTime` / `includeNonActionable` / `page` / `size`，**没有 `endTime`**），
 * 所以这里只做单日期选择，不做区间，避免出现"选了结束时间但其实没生效"的假象。
 */
const gapsStartDate = ref('')
/** 宽松口径：列出所有「已退款且无回补记录」的订单项（需人工判断），默认只列真问题 */
const gapsLooseMode = ref(false)
const gapsList = ref<RefundRestockGap[]>([])
const gapsTotal = ref(0)
const gapsPage = ref(1)
const gapsSize = ref(50)
const gapsLoading = ref(false)
const gapsLoaded = ref(false)
const gapsUnavailable = ref(false)

// ===== 页签三：冗余列偏离巡检 =====
/**
 * `product.total_stock` 是**只在「保存商品」时重算**的冗余列，下单/取消/退款回补等链路都不回写它；
 * 而商品列表的 `totalStock` 自 2026-09-16 起已改为**查询时实时聚合**，所以本清单只是"偏离观测基线"
 * （api-docs 原文：已知且无害，不是新的 bug）。它同时是"万一将来又有代码依赖该冗余列"的风险度量。
 */
const driftsList = ref<TotalStockDrift[]>([])
const driftsTotal = ref(0)
const driftsPage = ref(1)
const driftsSize = ref(50)
const driftsLoading = ref(false)
const driftsLoaded = ref(false)
const driftsUnavailable = ref(false)

/** 统一的错误消息提取。 */
function showError(error: unknown, fallback: string): void {
  ElMessage.error(error instanceof Error ? error.message : fallback)
}

/**
 * 识别「接口未上线」类错误（后端未发版时给出说明而不是反复报错）。
 * ⚠️ 只能匹配**接口级**文案（request.ts 对 HTTP 404/405 的固定说法），
 * **不能**用泛化的「不存在」——业务码 `1002` 的 message 是「商品不存在或已删除」，
 * 一旦匹配就会把整页切成"接口未上线"，把业务错误吞掉。
 */
function isUnavailableError(message: string): boolean {
  return /接口不存在|尚未上线|not\s*found|404/i.test(message)
}

/** 金额展示（退款金额等）。 */
function money(value: number): string {
  return `¥ ${Number(value || 0).toFixed(2)}`
}

/**
 * 时间展示：后端返回的是 ISO（`2026-09-16T18:00:35`，注意带 `T`），直接渲染很别扭，
 * 这里统一成「2026-09-16 18:00:35」；空值显示「—」。
 */
function formatTime(value: string | null | undefined): string {
  if (!value) return '—'
  return String(value).replace('T', ' ').slice(0, 19)
}

/**
 * 可空数值展示：`null` / `undefined` 显示「—」。
 * 后端的 `closingStock` / `currentStock` 等在「无流水 / SKU 已软删」时返回 null，
 * 直接插值会渲染成 `null` 字样，必须过这一层。
 */
function num(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : String(value)
}

/** 变动量展示：正数带 +，0 显示 0。 */
function signed(value: number): string {
  const num = Number(value || 0)
  if (num > 0) return `+${num}`
  return String(num)
}

/** 变动量配色：增绿减红、0 灰。 */
function qtyClass(value: number): string {
  const num = Number(value || 0)
  if (num > 0) return 'qty-up'
  if (num < 0) return 'qty-down'
  return 'qty-zero'
}

/** 时间区间 → 查询参数（日期补 00:00:00 / 23:59:59）。 */
function rangeToParams(range: [string, string] | null): { startTime?: string; endTime?: string } {
  if (!range?.[0] || !range?.[1]) return {}
  return { startTime: `${range[0]} 00:00:00`, endTime: `${range[1]} 23:59:59` }
}

/** 配送方式文案（api-docs 现列 0=物流 / 1=自提；2=同城为兼容保留）。 */
function pickupTypeText(value: number): string {
  if (Number(value) === 1) return '自提'
  if (Number(value) === 2) return '同城'
  return '物流'
}

/** 操作方文案。 */
function operatorText(value: string): string {
  return ({ USER: '用户', MERCHANT: '商家', PLATFORM: '平台', SYSTEM: '系统', JOB: '定时任务' } as Record<string, string>)[value] || value || '—'
}

/** 来源单据类型文案。 */
function bizTypeText(value: string): string {
  return ({ ORDER: '订单', AFTER_SALE: '售后单', MANUAL: '人工', SYSTEM: '系统' } as Record<string, string>)[value] || value || '—'
}

/** 期初展示文案：不可考时明确提示（而不是显示 0）。 */
const openingText = computed(() => {
  const data = ledger.value
  if (!data) return '--'
  if (data.openingUnavailable) return '不可考（早于留痕上线）'
  return data.openingStock === null ? '--' : String(data.openingStock)
})

/** 账实一致性徽标（`diff !== 0` 标红）。 */
const consistentTag = computed<{ type: 'success' | 'danger' | 'info'; text: string }>(() => {
  const data = ledger.value
  if (!data || data.consistent === null) return { type: 'info', text: '无法判定' }
  if (data.consistent) return { type: 'success', text: '账实一致' }
  return { type: 'danger', text: `账实不符（差 ${signed(Number(data.diff || 0))}）` }
})

/**
 * 断言未通过时，区分两种含义（文档 §2.2）：
 * - 「区间链断裂」= 理论期末 ≠ 区间口径期末 → 真问题（流水缺失或被人改过），标红；
 * - 「endTime 之后仍在变动」= 正常现象（查的是历史区间），弱提示。
 * 这里用数据判断而非依赖 `assertionNote` 文案，避免后端改文案后前端判错。
 */
const assertionState = computed<{ type: 'error' | 'info' | 'success'; text: string } | null>(() => {
  const data = ledger.value
  if (!data || data.assertionPassed === null) return null
  if (data.assertionPassed) return { type: 'success', text: '断言通过：期初 + 区间变动 = 期末' }
  const chainBroken = data.expectedClosing !== null
    && data.rangeClosingStock !== null
    && data.expectedClosing !== data.rangeClosingStock
  if (chainBroken) return { type: 'error', text: data.assertionNote || '区间链断裂：期初 + 区间变动 ≠ 区间期末（疑似流水缺失或被修改）' }
  return { type: 'info', text: data.assertionNote || 'endTime 之后仍有库存变动（查的是历史区间，属正常现象）' }
})

/**
 * 查询库存台账。
 *
 * `skuId` / `productId` **二选一**（后端规则，api-docs 2026-09-16 18:01 版）：
 * - 只传商品 ID → 服务端解析该商品**唯一的启用 SKU**，返回 `resolvedFromProduct=true`；
 * - 该商品有多个启用 SKU → `code=1000`（message 列出可选 skuId）；
 * - 商品不存在/已删除 或 没有启用 SKU → `code=1002`。
 * 后两种 message 后端已给中文，这里原样提示即可（多 SKU 时引导用户改填 SKU ID）。
 */
async function queryLedger(): Promise<void> {
  const id = ledgerId.value.trim()
  if (!/^[1-9]\d*$/.test(id)) {
    ElMessage.warning(`请输入正确的${ledgerIdType.value === 'sku' ? 'SKU ID' : '商品 ID'}（正整数）`)
    return
  }
  ledgerLoading.value = true
  try {
    const range = rangeToParams(ledgerDateRange.value)
    const idParam = ledgerIdType.value === 'sku' ? { skuId: id } : { productId: id }
    ledger.value = await getStockLedger({ ...idParam, ...range, page: 1, size: ledgerSize.value })
    ledgerQueried.value = true
    ledgerUnavailable.value = false
  } catch (error) {
    const message = error instanceof Error ? error.message : '库存台账查询失败'
    if (isUnavailableError(message)) {
      ledgerUnavailable.value = true
      ledger.value = null
    } else {
      showError(error, '库存台账查询失败')
    }
  } finally {
    ledgerLoading.value = false
  }
}

/** 明细翻页（只影响明细，汇总不受影响）。 */
async function ledgerPageChange(page: number): Promise<void> {
  const data = ledger.value
  if (!data) return
  ledgerLoading.value = true
  try {
    const range = rangeToParams(ledgerDateRange.value)
    ledger.value = await getStockLedger({ skuId: data.skuId, ...range, page, size: ledgerSize.value })
  } catch (error) {
    showError(error, '库存台账明细加载失败')
  } finally {
    ledgerLoading.value = false
  }
}

/** 明细切换每页条数。 */
async function ledgerSizeChange(size: number): Promise<void> {
  ledgerSize.value = size
  await ledgerPageChange(1)
}

/** 重置台账查询条件。 */
function resetLedger(): void {
  ledgerId.value = ''
  ledgerDateRange.value = null
  ledger.value = null
  ledgerQueried.value = false
}

/** 加载「退款应补未补」列表。 */
async function loadGaps(resetPage = false): Promise<void> {
  if (resetPage) gapsPage.value = 1
  gapsLoading.value = true
  try {
    // 只传起始时间：接口无 endTime 参数（见 gapsStartDate 注释）
    const startTime = gapsStartDate.value ? `${gapsStartDate.value} 00:00:00` : undefined
    const result = await getRefundRestockGaps({
      ...(startTime ? { startTime } : {}),
      includeNonActionable: gapsLooseMode.value || undefined,
      page: gapsPage.value,
      size: gapsSize.value,
    })
    gapsList.value = result.list
    gapsTotal.value = result.total
    gapsPage.value = result.page
    gapsLoaded.value = true
    gapsUnavailable.value = false
  } catch (error) {
    const message = error instanceof Error ? error.message : '退款应补未补核对失败'
    if (isUnavailableError(message)) {
      gapsUnavailable.value = true
      gapsList.value = []
      gapsTotal.value = 0
      gapsLoaded.value = true
    } else {
      showError(error, '退款应补未补核对失败')
    }
  } finally {
    gapsLoading.value = false
  }
}

/** 页签二：翻页。 */
function gapsPageChange(page: number): void {
  gapsPage.value = page
  void loadGaps()
}

/** 页签二：切换每页条数。 */
function gapsSizeChange(size: number): void {
  gapsSize.value = size
  void loadGaps(true)
}

/** 页签二：重置筛选。 */
function resetGaps(): void {
  gapsStartDate.value = ''
  gapsLooseMode.value = false
  void loadGaps(true)
}

/** 页签三：加载「冗余列偏离」清单（只分页，无筛选条件）。 */
async function loadDrifts(resetPage = false): Promise<void> {
  if (resetPage) driftsPage.value = 1
  driftsLoading.value = true
  try {
    const result = await getTotalStockDrifts({ page: driftsPage.value, size: driftsSize.value })
    driftsList.value = result.list
    driftsTotal.value = result.total
    driftsPage.value = result.page
    driftsLoaded.value = true
    driftsUnavailable.value = false
  } catch (error) {
    const message = error instanceof Error ? error.message : '冗余列偏离巡检失败'
    if (isUnavailableError(message)) {
      driftsUnavailable.value = true
      driftsList.value = []
      driftsTotal.value = 0
      driftsLoaded.value = true
    } else {
      showError(error, '冗余列偏离巡检失败')
    }
  } finally {
    driftsLoading.value = false
  }
}

/** 页签三：翻页。 */
function driftsPageChange(page: number): void {
  driftsPage.value = page
  void loadDrifts()
}

/** 页签三：切换每页条数。 */
function driftsSizeChange(size: number): void {
  driftsSize.value = size
  void loadDrifts(true)
}

/** 页签三行样式：冗余列偏大标红（真实库存比冗余列少）、偏小标橙（可能误显示售罄）。 */
function driftRowClass({ row }: { row: TotalStockDrift }): string {
  if (row.diff > 0) return 'drift-over-row'
  if (row.diff < 0) return 'drift-under-row'
  return ''
}

/** 商品状态文案（0=下架 / 1=上架）。 */
function productStatusText(status: number): string {
  return Number(status) === 1 ? '上架' : '下架'
}

/** 从偏离清单点商品 ID：切到「库存台账」并按该商品维度查询（后端会解析其唯一启用 SKU）。 */
function openLedgerByProduct(productId: string): void {
  const id = String(productId || '').trim()
  if (!/^[1-9]\d*$/.test(id)) return
  activeTab.value = 'ledger'
  ledgerIdType.value = 'product'
  ledgerId.value = id
  void queryLedger()
}

/**
 * 页头「刷新」按钮：按**当前页签**刷新对应数据。
 * （此前固定调 queryLedger，在「退款应补未补」页签下点刷新会去查台账，属于页签错配）
 */
function refreshCurrent(): void {
  if (activeTab.value === 'overview') void loadOverview()
  else if (activeTab.value === 'gaps') void loadGaps()
  else if (activeTab.value === 'drifts') void loadDrifts()
  else void queryLedger()
}

/** 复制文本（单号核对用）。 */
async function copyField(value: string | null | undefined, label: string): Promise<void> {
  const text = String(value || '').trim()
  if (!text) {
    ElMessage.warning(`没有可复制的${label}`)
    return
  }
  const ok = await copyToClipboard(text)
  if (ok) ElMessage.success(`${label}已复制`)
  else ElMessage.error('复制失败，请手动选中文本复制')
}

/**
 * 跳转到来源单据：
 * - 订单 → `/orders?orderNo=xxx`（订单页已支持该 query 自动筛选）
 * - 售后单 → `/after-sale?afterSaleNo=xxx`（售后列表接口暂不支持按单号查询，售后页会在当前结果中定位高亮并提示）
 */
function openBiz(bizType: string, bizNo: string | null): void {
  const no = String(bizNo || '').trim()
  if (!no) return
  if (bizType === 'ORDER') {
    void router.push({ path: '/orders', query: { orderNo: no } })
    return
  }
  if (bizType === 'AFTER_SALE') {
    void router.push({ path: '/after-sale', query: { afterSaleNo: no } })
    return
  }
  void copyField(no, '单号')
}

/** 人工改库存行标黄（人工干预记录，前后值 + 操作人 + 原因最有价值）。 */
function ledgerRowClass({ row }: { row: StockLedgerDetail }): string {
  return row.changeType === 'MANUAL_SET' ? 'manual-row' : ''
}

/** 应补未补行样式：需补货标红、货已离店置灰。 */
function gapRowClass({ row }: { row: RefundRestockGap }): string {
  if (row.needRestock) return 'need-restock-row'
  if (row.goodsLeftShop) return 'left-shop-row'
  return ''
}

// 首次切到「库存概览」「应补未补」「冗余列偏离」页签时懒加载
watch(activeTab, (tab) => {
  if (tab === 'overview' && !overviewLoaded.value) void loadOverview()
  if (tab === 'gaps' && !gapsLoaded.value) void loadGaps()
  if (tab === 'drifts' && !driftsLoaded.value) void loadDrifts()
})

/** 从路由 query 取台账查询目标（`?skuId=` 优先，其次 `?productId=`）。 */
function ledgerTargetFromQuery(): { type: 'sku' | 'product'; id: string } | null {
  const skuId = String(route.query.skuId || '').trim()
  if (/^[1-9]\d*$/.test(skuId)) return { type: 'sku', id: skuId }
  const productId = String(route.query.productId || '').trim()
  if (/^[1-9]\d*$/.test(productId)) return { type: 'product', id: productId }
  return null
}

/**
 * 已停留在本页时，从商品列表再次点「查看台账」是**同路径只变 query**，
 * onMounted 不会重跑，所以这里监听 skuId / productId 的变化并重新查询。
 */
watch(() => `${route.query.skuId ?? ''}|${route.query.productId ?? ''}`, () => {
  const target = ledgerTargetFromQuery()
  if (!target) return
  activeTab.value = 'ledger'
  ledgerIdType.value = target.type
  ledgerId.value = target.id
  void queryLedger()
})

onMounted(() => {
  // 支持从商品列表带 ID 直接进入：`/stock?skuId=24`（SKU 维度）或 `/stock?productId=900009`（商品维度）
  const target = ledgerTargetFromQuery()
  if (!target) {
    // 没带 query：停在默认页签「库存概览」，先看清货的去向
    void loadOverview()
    return
  }
  ledgerIdType.value = target.type
  ledgerId.value = target.id
  void queryLedger()
})
</script>

<template>
  <section class="page-container page-enter">
    <div class="page-heading">
      <div>
        <h1>库存对账</h1>
        <p>按 SKU 或商品核对库存变动流水（期初 → 期末 → 实际），并排查「已退款但库存未回补」的订单。</p>
      </div>
      <el-button :loading="ledgerLoading || gapsLoading || overviewLoading || driftsLoading" @click="refreshCurrent"><el-icon><Refresh /></el-icon>刷新</el-button>
    </div>

    <el-tabs v-model="activeTab" class="stock-tabs">
      <!-- ===== 库存概览（可售 / 锁定 / 在途 / 合计） ===== -->
      <el-tab-pane label="库存概览" name="overview">
        <el-alert
          v-if="overviewUnavailable"
          type="warning"
          :closable="false"
          show-icon
          class="stock-alert"
          title="当前环境的「库存实时概览」接口尚未上线，暂时查不到数据；后端发版后本页即可使用。"
        />
        <el-card shadow="never" class="content-card">
          <el-alert
            type="info"
            :closable="false"
            show-icon
            class="stock-alert"
            title="货的去向一次看全：可售 = 可下单卖出（不含锁定）；锁定 = 下单占用但货未出库（超时自动释放，自提单最长 30 天）；在途 = 已发货未确认收货（货已出库、不在库）；合计 = 可售 + 锁定（账面在库）。⚠️ 锁定库存含 2026-09-16 流水留痕上线前的历史遗留，无法逐单追溯，需人工盘点确认。"
          />

          <div class="overview-summary">
            <div class="overview-stat"><span class="overview-stat-value">{{ overviewSummary.skuCount }}</span><span class="overview-stat-label">SKU 数</span></div>
            <div class="overview-stat"><span class="overview-stat-value">{{ overviewSummary.available }}</span><span class="overview-stat-label">可售合计</span></div>
            <div class="overview-stat"><span class="overview-stat-value overview-stat-warn">{{ overviewSummary.locked }}</span><span class="overview-stat-label">锁定合计</span></div>
            <div class="overview-stat"><span class="overview-stat-value">{{ overviewSummary.shipping }}</span><span class="overview-stat-label">在途合计</span></div>
          </div>

          <div class="section-title">
            <strong>库存概览</strong>
            <span class="section-sub">按启用 SKU 展示可售 / 锁定 / 在途 / 合计（口径与库存台账 currentStock 一致）</span>
            <el-button link type="primary" :loading="overviewLoading" @click="loadOverview()">刷新</el-button>
          </div>

          <div class="overview-filters">
            <el-input v-model="overviewKeyword" placeholder="商品名 / 商品 ID / SKU ID / SKU 名" clearable class="overview-keyword" />
            <el-checkbox v-model="overviewLockedOnly">只看有锁定库存的 SKU</el-checkbox>
            <span class="section-sub">显示 {{ overviewRows.length }} 行 / 已加载 {{ overviewList.length }} 行</span>
          </div>

          <el-table
            :data="overviewRows"
            v-loading="overviewLoading"
            border
            stripe
            :row-class-name="overviewRowClass"
            empty-text="没有匹配的 SKU"
          >
            <el-table-column label="商品" min-width="200">
              <template #default="{ row }">
                <div class="overview-cell"><span>{{ row.productName }}</span><small>ID {{ row.productId }}</small></div>
              </template>
            </el-table-column>
            <el-table-column label="SKU" min-width="180">
              <template #default="{ row }">
                <div class="overview-cell"><span>{{ row.skuName || '—' }}</span><small>SKU {{ row.skuId }}</small></div>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="90">
              <template #default="{ row }">
                <el-tag :type="Number(row.status) === 1 ? 'success' : 'info'" size="small">{{ productStatusText(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="availableStock" label="可售库存" width="110" />
            <el-table-column label="锁定库存" width="110">
              <template #default="{ row }">
                <span :class="{ 'overview-locked-value': row.lockedStock > 0 }">{{ row.lockedStock }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="shipping" label="在途" width="90" />
            <el-table-column prop="totalStock" label="合计在库" width="110" />
            <el-table-column label="售价" width="110">
              <template #default="{ row }">¥ {{ row.price }}</template>
            </el-table-column>
            <el-table-column label="更新时间" min-width="170">
              <template #default="{ row }">{{ formatTime(row.updateTime) }}</template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <!-- ===== 库存台账 ===== -->
      <el-tab-pane label="库存台账" name="ledger">
        <el-alert
          v-if="ledgerUnavailable"
          type="warning"
          :closable="false"
          show-icon
          class="stock-alert"
          title="当前环境的库存台账接口尚未上线，暂时查不到数据；后端发版后本页即可使用。"
        />
        <el-card shadow="never" class="content-card">
          <el-form inline @submit.prevent="queryLedger">
            <el-form-item label="查询维度">
              <el-radio-group v-model="ledgerIdType">
                <el-radio-button value="sku">SKU ID</el-radio-button>
                <el-radio-button value="product">商品 ID</el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-form-item :label="ledgerIdType === 'sku' ? 'SKU ID' : '商品 ID'">
              <el-input
                v-model="ledgerId"
                clearable
                :placeholder="ledgerIdType === 'sku' ? '必填，如 24' : '单 SKU 商品可直接填商品 ID'"
                style="width: 220px"
                @keyup.enter="queryLedger"
              />
            </el-form-item>
            <span class="id-tip">商品 ID 仅在该商品只有 1 个启用 SKU 时可用；多个 SKU 请用 SKU ID</span>
            <el-form-item label="时间区间">
              <el-date-picker v-model="ledgerDateRange" type="daterange" value-format="YYYY-MM-DD" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :icon="Search" :loading="ledgerLoading" @click="queryLedger">查询</el-button>
              <el-button @click="resetLedger">重置</el-button>
            </el-form-item>
          </el-form>

          <el-empty v-if="!ledger && !ledgerLoading" description="输入 SKU ID 或商品 ID 查询库存台账" />

          <template v-if="ledger">
            <!-- 期初 → 期末 → 实际 三值对照 -->
            <div class="stock-triple">
              <div class="triple-item">
                <span class="triple-label">期初</span>
                <span class="triple-value" :class="{ 'triple-unknown': ledger.openingUnavailable }">{{ openingText }}</span>
                <span class="triple-sub">{{ formatTime(ledger.openingTime) }}</span>
                <span v-if="ledger.openingNote" class="triple-note">{{ ledger.openingNote }}</span>
              </div>
              <span class="triple-arrow">→</span>
              <div class="triple-item">
                <span class="triple-label">期末（最新流水）</span>
                <span class="triple-value">{{ num(ledger.closingStock) }}</span>
                <span class="triple-sub">锁定 {{ num(ledger.closingLockedStock) }} · {{ formatTime(ledger.closingTime) }}</span>
              </div>
              <span class="triple-arrow">→</span>
              <div class="triple-item">
                <span class="triple-label">实际库存</span>
                <span class="triple-value">{{ num(ledger.currentStock) }}</span>
                <span class="triple-sub">锁定 {{ num(ledger.lockedStock) }}</span>
                <span v-if="!ledger.currentStockAvailable" class="triple-note danger-text">该 SKU 已删除或不存在（实时库存读不到）</span>
              </div>
              <el-tag class="triple-badge" :type="consistentTag.type" size="large">{{ consistentTag.text }}</el-tag>
            </div>

            <!-- 断言与区间口径 -->
            <el-alert
              v-if="assertionState"
              :type="assertionState.type === 'success' ? 'success' : assertionState.type"
              :closable="false"
              show-icon
              class="stock-alert"
              :title="assertionState.text"
            />
            <p class="stock-meta">
              <span>商品：{{ ledger.productName || '（商品已删除或查不到）' }}</span>
              <span>SKU ID：{{ ledger.skuId }}</span>
              <!-- 只传商品 ID 查询时后端会解析出唯一启用 SKU，这里明确告知，避免运营以为查错了 SKU -->
              <span v-if="ledger.resolvedFromProduct" class="resolved-tip">由商品 ID {{ ledger.productId }} 解析（该商品只有 1 个启用 SKU）</span>
              <span>区间变动合计：<b :class="qtyClass(ledger.totalChangeQty)">{{ signed(ledger.totalChangeQty) }}</b></span>
              <span v-if="ledger.rangeClosingStock !== null">区间口径期末：{{ ledger.rangeClosingStock }}（{{ formatTime(ledger.rangeClosingTime) }}）</span>
              <span v-if="ledger.expectedClosing !== null">理论期末：{{ ledger.expectedClosing }}</span>
            </p>

            <!-- 按来源汇总 -->
            <div class="section-title">
              <strong>按来源汇总</strong>
              <span class="section-sub">整区间聚合，不受明细分页影响</span>
            </div>
            <el-alert
              v-if="!ledger.summaryComplete"
              type="warning"
              :closable="false"
              show-icon
              class="stock-alert"
              title="区间流水超过服务端聚合上限，汇总只覆盖最早部分（明细仍完整分页）；建议缩小时间范围后重查。"
            />
            <el-table :data="ledger.summary" border stripe size="small" empty-text="区间内没有库存变动">
              <el-table-column prop="changeTypeName" label="变动来源" min-width="150" />
              <el-table-column prop="count" label="笔数" width="90" />
              <el-table-column label="合计变动件数" width="140">
                <template #default="{ row }"><span :class="qtyClass(row.totalChangeQty)">{{ signed(row.totalChangeQty) }}</span></template>
              </el-table-column>
              <el-table-column label="锁定库存变动" width="140">
                <template #default="{ row }"><span :class="qtyClass(row.totalLockedChangeQty)">{{ signed(row.totalLockedChangeQty) }}</span></template>
              </el-table-column>
            </el-table>

            <!-- 变动明细 -->
            <div class="section-title">
              <strong>变动明细</strong>
              <span class="section-sub">共 {{ ledger.details.total }} 条；「人工改库存」标黄，单据号可点击跳转</span>
            </div>
            <DataTable
              :data="ledger.details.list"
              :loading="ledgerLoading"
              :total="ledger.details.total"
              :page="ledger.details.page"
              :page-size="ledger.details.pageSize"
              :show-selection="false"
              :row-class-name="ledgerRowClass"
              empty-text="区间内没有库存变动"
              @page-change="ledgerPageChange"
              @size-change="ledgerSizeChange"
            >
              <el-table-column label="发生时间" min-width="170"><template #default="{ row }">{{ formatTime(row.createTime) }}</template></el-table-column>
              <el-table-column label="变动来源" width="150">
                <template #default="{ row }">
                  <el-tag :type="row.changeType === 'MANUAL_SET' ? 'warning' : 'info'" size="small">{{ row.changeTypeName || row.changeType }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="可售变动" width="110">
                <template #default="{ row }"><span :class="qtyClass(row.changeQty)">{{ signed(row.changeQty) }}</span></template>
              </el-table-column>
              <el-table-column label="锁定变动" width="110">
                <template #default="{ row }"><span :class="qtyClass(row.lockedChangeQty)">{{ signed(row.lockedChangeQty) }}</span></template>
              </el-table-column>
              <el-table-column label="变动后可售" width="120">
                <template #default="{ row }">{{ row.stockBefore }} → <b>{{ row.stockAfter }}</b></template>
              </el-table-column>
              <el-table-column label="变动后锁定" width="120">
                <template #default="{ row }">{{ row.lockedBefore }} → <b>{{ row.lockedAfter }}</b></template>
              </el-table-column>
              <el-table-column label="来源单据" min-width="200">
                <template #default="{ row }">
                  <template v-if="row.bizNo">
                    <el-button link type="primary" @click="openBiz(row.bizType, row.bizNo)">{{ row.bizNo }}</el-button>
                    <el-button link type="primary" :icon="CopyDocument" @click="copyField(row.bizNo, '单号')">复制</el-button>
                  </template>
                  <span v-else class="muted">{{ bizTypeText(row.bizType) }}</span>
                </template>
              </el-table-column>
              <el-table-column label="操作方" width="140">
                <template #default="{ row }">
                  <div>{{ operatorText(row.operatorType) }}</div>
                  <!-- 文档 §5.1：人工改库存最有价值的是「前后值 + 操作人 + 原因」，所以把操作人 ID 一并显示 -->
                  <small v-if="row.operatorId" class="muted">操作人 ID {{ row.operatorId }}</small>
                </template>
              </el-table-column>
              <el-table-column label="原因 / 备注" min-width="240">
                <template #default="{ row }">
                  <div class="reason-cell">
                    <span v-if="row.reason">{{ row.reason }}</span>
                    <small v-if="row.remark" class="muted">{{ row.remark }}</small>
                  </div>
                </template>
              </el-table-column>
            </DataTable>
          </template>
        </el-card>
      </el-tab-pane>

      <!-- ===== 退款应补未补 ===== -->
      <el-tab-pane label="退款应补未补" name="gaps">
        <el-alert
          v-if="gapsUnavailable"
          type="warning"
          :closable="false"
          show-icon
          class="stock-alert"
          title="当前环境的「退款应补未补核对」接口尚未上线，暂时查不到数据；后端发版后本页即可使用。"
        />
        <el-card shadow="never" class="content-card">
          <el-form inline @submit.prevent="loadGaps(true)">
            <el-form-item label="退款起始时间">
              <el-date-picker v-model="gapsStartDate" type="date" value-format="YYYY-MM-DD" placeholder="不选=从留痕上线起" clearable />
            </el-form-item>
            <el-form-item label="宽松口径">
              <el-switch v-model="gapsLooseMode" />
              <span class="muted switch-tip">开启后列出所有「已退款且无回补记录」的订单项（含货已离店，需人工判断）</span>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :icon="Search" :loading="gapsLoading" @click="loadGaps(true)">查询</el-button>
              <el-button @click="resetGaps">重置</el-button>
            </el-form-item>
          </el-form>

          <el-alert
            type="info"
            :closable="false"
            show-icon
            class="stock-alert"
            title="默认口径只列「已退款 + 货未离店 + 无回补流水」的真问题；标红行表示需要补记库存。"
          />

          <DataTable
            :data="gapsList"
            :loading="gapsLoading"
            :total="gapsTotal"
            :page="gapsPage"
            :page-size="gapsSize"
            :show-selection="false"
            :row-class-name="gapRowClass"
            row-key="afterSaleNo"
            empty-text="没有需要补货的订单"
            @page-change="gapsPageChange"
            @size-change="gapsSizeChange"
          >
            <el-table-column label="售后单号" min-width="200">
              <template #default="{ row }">
                <el-button link type="primary" @click="openBiz('AFTER_SALE', row.afterSaleNo)">{{ row.afterSaleNo }}</el-button>
              </template>
            </el-table-column>
            <el-table-column label="订单号" min-width="200">
              <template #default="{ row }">
                <el-button link type="primary" @click="openBiz('ORDER', row.orderNo)">{{ row.orderNo }}</el-button>
              </template>
            </el-table-column>
            <el-table-column label="售后类型" width="110">
              <template #default="{ row }">{{ row.afterSaleTypeName || (row.afterSaleType === 2 ? '退货退款' : '仅退款') }}</template>
            </el-table-column>
            <el-table-column label="退款金额" width="120">
              <template #default="{ row }">{{ money(row.refundAmount) }}</template>
            </el-table-column>
            <el-table-column label="退款时间" min-width="170"><template #default="{ row }">{{ formatTime(row.refundTime) }}</template></el-table-column>
            <el-table-column label="退款单号" min-width="190">
              <template #default="{ row }">
                <template v-if="row.refundNo">
                  <span>{{ row.refundNo }}</span>
                  <el-button link type="primary" :icon="CopyDocument" @click="copyField(row.refundNo, '退款单号')">复制</el-button>
                </template>
                <span v-else class="muted">退款处理中</span>
              </template>
            </el-table-column>
            <el-table-column label="配送方式" width="100">
              <template #default="{ row }">{{ pickupTypeText(row.pickupType) }}</template>
            </el-table-column>
            <el-table-column prop="productName" label="商品" min-width="180" />
            <el-table-column prop="skuId" label="SKU ID" width="100" />
            <el-table-column prop="quantity" label="件数" width="80" />
            <el-table-column label="货已离店" width="110">
              <template #default="{ row }">
                <el-tag :type="row.goodsLeftShop ? 'info' : 'success'" size="small">{{ row.goodsLeftShop ? '已离店' : '未离店' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="回补流水" width="150">
              <template #default="{ row }">
                <span class="muted">退款回补 {{ row.refundRestockRows }} / 退货入库 {{ row.returnRestockRows }}</span>
              </template>
            </el-table-column>
            <el-table-column label="处理状态" width="130" fixed="right">
              <template #default="{ row }">
                <el-tag v-if="row.needRestock" type="danger" size="small"><el-icon><Warning /></el-icon>需补货</el-tag>
                <el-tag v-else-if="row.goodsLeftShop" type="info" size="small">货已离店，无需补货</el-tag>
                <el-tag v-else type="warning" size="small">待人工判断</el-tag>
              </template>
            </el-table-column>
          </DataTable>
        </el-card>
      </el-tab-pane>

      <!-- ===== 冗余列偏离巡检 ===== -->
      <el-tab-pane label="冗余列偏离" name="drifts">
        <el-alert
          v-if="driftsUnavailable"
          type="warning"
          :closable="false"
          show-icon
          class="stock-alert"
          title="当前环境的「冗余列偏离巡检」接口尚未上线，暂时查不到数据；后端发版后本页即可使用。"
        />
        <el-card shadow="never" class="content-card">
          <el-alert
            type="info"
            :closable="false"
            show-icon
            class="stock-alert"
            title="product.total_stock 是「保存商品」时重算的冗余列，下单/取消/退款等链路不回写它；商品列表的库存自 2026-09-16 起已改为查询时实时聚合，所以本清单只作偏离观测基线（已知且无害）。需要人工对齐时取「建议对齐值」——本接口只读，不会自动改库。"
          />

          <div class="section-title">
            <strong>冗余列偏离</strong>
            <span class="section-sub">共 {{ driftsTotal }} 个商品；偏离 = 冗余列现值 − 真实可售合计（不含锁定库存）</span>
            <el-button link type="primary" :loading="driftsLoading" @click="loadDrifts()">刷新</el-button>
          </div>

          <DataTable
            :data="driftsList"
            :loading="driftsLoading"
            :total="driftsTotal"
            :page="driftsPage"
            :page-size="driftsSize"
            :show-selection="false"
            :row-class-name="driftRowClass"
            row-key="productId"
            empty-text="没有偏离的商品（冗余列与真实可售库存一致）"
            @page-change="driftsPageChange"
            @size-change="driftsSizeChange"
          >
            <el-table-column label="商品 ID" width="110">
              <template #default="{ row }">
                <el-button link type="primary" @click="openLedgerByProduct(row.productId)">{{ row.productId }}</el-button>
              </template>
            </el-table-column>
            <el-table-column prop="productName" label="商品名称" min-width="200" show-overflow-tooltip />
            <el-table-column label="状态" width="90">
              <template #default="{ row }">
                <el-tag :type="Number(row.status) === 1 ? 'success' : 'info'" size="small">{{ productStatusText(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="totalStock" label="冗余列现值" width="110" />
            <el-table-column prop="skuStockSum" label="真实可售合计" width="130" />
            <el-table-column label="偏离" width="100">
              <template #default="{ row }"><span :class="qtyClass(row.diff)">{{ signed(row.diff) }}</span></template>
            </el-table-column>
            <el-table-column prop="enabledSkuCount" label="启用 SKU" width="100" />
            <el-table-column prop="suggestedTotalStock" label="建议对齐值" width="120" />
            <el-table-column label="冗余列最后写入" min-width="170">
              <template #default="{ row }">{{ formatTime(row.updateTime) }}</template>
            </el-table-column>
          </DataTable>
        </el-card>
      </el-tab-pane>
    </el-tabs>
  </section>
</template>

<style scoped>
.stock-tabs { min-width: 0; }
.stock-tabs :deep(.el-tabs__content) { overflow: visible; }

/* 库存概览：汇总卡 + 筛选行 + 锁定库存高亮 */
.overview-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 16px; }
.overview-stat { display: flex; flex-direction: column; padding: 12px 16px; background: var(--el-fill-color-lighter); border-radius: 6px; }
.overview-stat-value { color: var(--el-text-color-primary); font-size: 20px; font-weight: 600; }
.overview-stat-warn { color: var(--el-color-warning); }
.overview-stat-label { margin-top: 2px; color: var(--el-text-color-secondary); font-size: 12px; }
.overview-filters { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 12px; }
.overview-keyword { width: 280px; }
.overview-cell { display: flex; flex-direction: column; }
.overview-cell small { color: var(--el-text-color-secondary); font-size: 12px; }
.overview-locked-value { color: var(--el-color-warning); font-weight: 600; }
:deep(.overview-locked-row) { background: var(--el-color-warning-light-9); }
.stock-alert { margin-bottom: 12px; }
.muted { color: var(--el-text-color-secondary); font-size: 12px; }
.danger-text { color: var(--el-color-danger); }
.switch-tip { margin-left: 8px; }
/* 期初 → 期末 → 实际 三值对照 */
.stock-triple { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; margin-bottom: 12px; padding: 16px 18px; background: var(--el-fill-color-lighter); border-radius: 6px; }
.triple-item { display: flex; min-width: 150px; flex-direction: column; gap: 2px; }
.triple-label { color: var(--el-text-color-secondary); font-size: 12px; }
.triple-value { color: var(--el-text-color-primary); font-size: 26px; font-weight: 700; line-height: 32px; }
.triple-unknown { font-size: 15px; font-weight: 600; }
.triple-sub { color: var(--el-text-color-secondary); font-size: 12px; }
.triple-note { color: var(--el-text-color-secondary); font-size: 12px; }
.triple-arrow { color: var(--el-text-color-placeholder); font-size: 18px; }
.triple-badge { margin-left: auto; }
.stock-meta { display: flex; flex-wrap: wrap; gap: 18px; margin: 0 0 14px; color: var(--el-text-color-regular); font-size: 13px; }
.section-title { display: flex; align-items: baseline; gap: 10px; margin: 18px 0 10px; }
.section-sub { color: var(--el-text-color-secondary); font-size: 12px; }
.id-tip { color: var(--el-text-color-secondary); font-size: 12px; }
.resolved-tip { color: var(--el-color-success); }
/* 变动量配色 */
.qty-up { color: var(--el-color-success); font-weight: 600; }
.qty-down { color: var(--el-color-danger); font-weight: 600; }
.qty-zero { color: var(--el-text-color-secondary); }
.reason-cell { display: flex; flex-direction: column; gap: 2px; line-height: 18px; }
/* 人工改库存行标黄（背景要打在 td 上，否则会被 el-table 的斑马纹覆盖） */
:deep(.manual-row) td { background: var(--el-color-warning-light-9) !important; }
/* 需补货 / 货已离店行 */
:deep(.need-restock-row) td { background: var(--el-color-danger-light-9) !important; }
:deep(.left-shop-row) td { color: var(--el-text-color-secondary); background: var(--el-fill-color-light) !important; }
/* 冗余列偏离行：冗余列偏大红、偏小橙 */
:deep(.drift-over-row) td { background: var(--el-color-danger-light-9) !important; }
:deep(.drift-under-row) td { background: var(--el-color-warning-light-9) !important; }
</style>
