<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { useRoute } from 'vue-router'
import { useOrderStore } from '@/stores/order'
import DataTable from '@/components/DataTable.vue'
import type { Order, OrderAddressUpdateDTO, OrderRefundDTO, OrderStatus } from '@/types/order'
import { isVerifiedStatus } from '@/utils/orderRules'
import { Box, CircleCheck, Delete, RefreshLeft, View } from '@element-plus/icons-vue'

const store = useOrderStore()
const route = useRoute()
const selected = ref<Order[]>([])
const statusTab = ref<string>('')
const detailVisible = ref(false)
const shipVisible = ref(false)
const batchShipVisible = ref(false)
const verifyVisible = ref(false)
const addressVisible = ref(false)
const refundVisible = ref(false)
const traceVisible = ref(false)
const shipFormRef = ref<FormInstance>()
const batchShipFormRef = ref<FormInstance>()
const verifyFormRef = ref<FormInstance>()
const addressFormRef = ref<FormInstance>()
const shipForm = reactive({ expressCompany: '', expressCompanyCode: '', expressNo: '' })
const batchShipForm = reactive({ expressCompany: '', expressCompanyCode: '', expressNo: '' })
const verifyForm = reactive({ orderId: '', orderNo: '', code: '' })
const addressForm = reactive<OrderAddressUpdateDTO>({ receiverName: '', receiverPhone: '', receiverAddress: '' })
const refundForm = reactive({ orderId: '', orderNo: '', reason: '' })
const dateRange = ref<[string, string] | null>(null)
const orderNoInput = ref('')
const shipRules: FormRules = {
  expressCompanyCode: [{ required: true, message: '请选择快递公司', trigger: 'change' }],
  expressNo: [{ required: true, message: '请输入快递单号', trigger: 'blur' }],
}
const verifyRules: FormRules = {
  code: [{ required: true, message: '请输入自提码', trigger: 'blur' }],
}
const addressRules: FormRules = {
  receiverName: [{ required: true, message: '请输入收货人', trigger: 'blur' }],
  receiverPhone: [{ required: true, pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }],
  receiverAddress: [{ required: true, message: '请输入收货地址', trigger: 'blur' }],
}

const statusOptions: Array<{ label: string; value: OrderStatus }> = [
  { label: '待支付', value: 0 },
  { label: '已支付', value: 1 },
  { label: '已发货', value: 2 },
  { label: '已收货', value: 3 },
  { label: '已完成', value: 4 },
  { label: '已关闭', value: 5 },
  { label: '退款中', value: 6 },
  { label: '已退款', value: 7 },
  { label: '已核销', value: 8 },
]
const expressCompanyOptions = [
  { label: '顺丰速运', value: 'shunfeng' },
  { label: '圆通速递', value: 'yuantong' },
  { label: '中通快递', value: 'zhongtong' },
  { label: '申通快递', value: 'shentong' },
  { label: '韵达快递', value: 'yunda' },
  { label: '京东物流', value: 'jd' },
  { label: 'EMS', value: 'ems' },
  { label: '邮政快递包裹（国内）', value: 'youzhengguonei' },
  { label: '邮政国际包裹', value: 'youzhengguoji' },
  { label: '百世快递', value: 'huitongkuaidi' },
  { label: '极兔速递', value: 'jtexpress' },
  { label: '德邦物流', value: 'debangkuaidi' },
  { label: '天天快递', value: 'tiantian' },
  { label: '宅急送', value: 'zhaijisong' },
  { label: '中通快运', value: 'zhongtongkuaiyun' },
  { label: '韵达快运', value: 'yundakuaiyun' },
]
const hasSelection = computed(() => selected.value.length > 0)
const isPickupOrder = computed(() => route.path === '/orders/pickup')
const pageTitle = computed(() => isPickupOrder.value ? '自提订单' : '普通订单')
const eligibleSelected = computed(() => selected.value.filter((order) => !isDeleted(order) && order.status === 1))
const deletableSelected = computed(() => selected.value.filter((order) => !isDeleted(order)))
const restorableSelected = computed(() => selected.value.filter((order) => isDeleted(order)))

function statusType(status: OrderStatus): 'info' | 'warning' | 'primary' | 'success' | 'danger' {
  return ({ 0: 'info', 1: 'warning', 2: 'primary', 3: 'success', 4: 'success', 5: 'info', 6: 'warning', 7: 'danger', 8: 'success' } as const)[status]
}

/** 判断订单是否为后端标记的软删除记录。 */
function isDeleted(order: Order): boolean {
  return order.delFlag === 1
}

/** 仅已发货或已收货且未软删除的订单允许客服人工退款。 */
function isRefundable(order: Order): boolean {
  return !isDeleted(order) && (order.status === 2 || order.status === 3)
}

/** 仅已发货及后续物流订单允许查询轨迹，拦截状态异常但残留单号的数据。 */
function isTraceable(order: { pickupType: Order['pickupType']; status: OrderStatus; expressNo?: string }): boolean {
  return order.pickupType === 0 && order.status >= 2 && Boolean(order.expressNo?.trim())
}

/** 下拉框只提交后端需要的编码，同时把对应名称写入发货 DTO。 */
function syncExpressCompany(form: { expressCompany: string; expressCompanyCode: string }, code: string): void {
  form.expressCompanyCode = code
  form.expressCompany = expressCompanyOptions.find((option) => option.value === code)?.label || ''
}

/** 切换订单状态页签，并只提交当前接口支持的状态参数。 */
function handleStatusTabChange(value: string | number): void {
  const normalizedValue = String(value)
  store.filters.status = normalizedValue === '' ? '' : Number(normalizedValue) as OrderStatus
  store.page = 1
  void loadList()
}

/** 将日期选择器的日期转换为后端要求的下单时间范围。 */
function handleDateRangeChange(value: [string, string] | null): void {
  dateRange.value = value
  store.filters.startTime = value?.[0] ? `${value[0]} 00:00:00` : ''
  store.filters.endTime = value?.[1] ? `${value[1]} 23:59:59` : ''
  store.page = 1
  void loadList()
}

/** 按订单号搜索（精确匹配），回车或点击搜索触发。 */
function searchByOrderNo(): void {
  store.filters.orderNo = orderNoInput.value.trim()
  store.page = 1
  void loadList()
}

async function showDetail(order: Order): Promise<void> {
  try {
    await store.fetchDetail(order.id)
    detailVisible.value = true
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '订单详情查询失败')
  }
}

/** 打开普通物流订单的地址编辑表单。 */
function openAddressEditor(): void {
  if (!store.detail || store.detail.pickupType !== 0 || store.detail.status !== 1 || isDeleted(store.detail)) return
  addressForm.receiverName = store.detail.receiverName || ''
  addressForm.receiverPhone = store.detail.receiverPhone || ''
  addressForm.receiverAddress = store.detail.receiverAddress || ''
  addressVisible.value = true
}

/** 校验并提交订单收货地址修改。 */
async function submitAddress(): Promise<void> {
  const valid = await addressFormRef.value?.validate().catch(() => false)
  if (!valid || !store.detail) return
  try {
    await ElMessageBox.confirm('确认修改该订单的收货地址吗？', '修改地址确认')
    await store.updateAddress(store.detail.id, { ...addressForm })
    addressVisible.value = false
    ElMessage.success('订单地址已修改')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '订单地址修改失败')
  }
}

/** 打开客服人工退款表单。 */
function openRefund(order: Order): void {
  if (!isRefundable(order)) return
  refundForm.orderId = order.id
  refundForm.orderNo = order.orderNo
  refundForm.reason = ''
  refundVisible.value = true
}

/** 二次确认后提交人工全额退款。 */
async function submitRefund(): Promise<void> {
  if (!refundForm.orderId) return
  const reason = refundForm.reason.trim()
  if (reason.length > 200) {
    ElMessage.warning('退款原因不能超过 200 个字符')
    return
  }
  try {
    await ElMessageBox.confirm(`确认对订单“${refundForm.orderNo}”执行全额退款吗？退款将通过微信异步到账，请确认。`, '客服人工退款二次确认', { type: 'warning', confirmButtonText: '确认退款', cancelButtonText: '取消' })
    const payload: OrderRefundDTO = { reason: reason || null }
    await store.refund(refundForm.orderId, payload)
    refundVisible.value = false
    ElMessage.success('退款申请已提交')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '订单退款失败')
  }
}

/** 查询物流轨迹；无快递单号时不调用接口。 */
async function openTrace(): Promise<void> {
  if (!store.detail || !isTraceable(store.detail)) return
  traceVisible.value = true
  try {
    await store.fetchTrace(store.detail.id)
  } catch (error) {
    traceVisible.value = false
    ElMessage.error(error instanceof Error ? error.message : '物流轨迹查询失败')
  }
}

async function openShip(order: Order): Promise<void> {
  shipForm.expressCompany = ''
  shipForm.expressCompanyCode = ''
  shipForm.expressNo = ''
  shipVisible.value = true
  try {
    await store.fetchDetail(order.id)
  } catch {
    /* 详情加载失败不影响打开发货弹窗，提交时仍会阻止空详情。 */
  }
}

async function submitShip(): Promise<void> {
  const valid = await shipFormRef.value?.validate().catch(() => false)
  if (!valid || !store.detail) return
  try {
    await store.ship(store.detail.id, { ...shipForm })
    shipVisible.value = false
    ElMessage.success('订单已发货')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '订单发货失败')
  }
}

function openBatchShip(): void {
  if (!eligibleSelected.value.length) return
  batchShipForm.expressCompany = ''
  batchShipForm.expressCompanyCode = ''
  batchShipForm.expressNo = ''
  if (eligibleSelected.value.length !== selected.value.length) {
    ElMessage.info(`已跳过 ${selected.value.length - eligibleSelected.value.length} 个不可发货订单`)
  }
  batchShipVisible.value = true
}

async function submitBatchShip(): Promise<void> {
  const valid = await batchShipFormRef.value?.validate().catch(() => false)
  if (!valid || !eligibleSelected.value.length) return
  try {
    await ElMessageBox.confirm(`确认批量发货 ${eligibleSelected.value.length} 个订单吗？`, '批量发货确认')
    const result = await store.shipOrders(eligibleSelected.value.map((order) => order.id), { ...batchShipForm })
    batchShipVisible.value = false
    selected.value = []
    if (result.failedIds.length) {
      ElMessage.warning(`发货成功 ${result.successIds.length} 个，失败 ${result.failedIds.length} 个`)
    } else {
      ElMessage.success(`已批量发货 ${result.successIds.length} 个订单`)
    }
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '批量发货失败')
  }
}

function isDeletable(order: Order): boolean {
  return !isDeleted(order)
}

async function removeOrder(order: Order): Promise<void> {
  try {
    await ElMessageBox.confirm(`确认删除订单“${order.orderNo}”吗？删除后订单将从后台列表移除。`, '删除订单二次确认', { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' })
    await store.removeOrder(order.id)
    selected.value = []
    ElMessage.success('订单已删除')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '订单删除失败')
  }
}

async function removeSelected(): Promise<void> {
  if (!deletableSelected.value.length) {
    ElMessage.info('请选择要删除的订单')
    return
  }
  const skippedCount = selected.value.length - deletableSelected.value.length
  try {
    await ElMessageBox.confirm(`确认删除选中的 ${deletableSelected.value.length} 个订单吗？删除后订单将从后台列表移除。`, '批量删除订单二次确认', { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' })
    const result = await store.removeOrders(deletableSelected.value.map((order) => order.id))
    selected.value = []
    const skippedMessage = skippedCount ? `，已跳过 ${skippedCount} 个已删除订单` : ''
    if (result.failedIds.length) {
      ElMessage.warning(`删除成功 ${result.successIds.length} 个，失败 ${result.failedIds.length} 个${skippedMessage}`)
    } else {
      ElMessage.success(`已删除 ${result.successIds.length} 个订单${skippedMessage}`)
    }
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '批量删除失败')
  }
}

/** 批量恢复软删除订单，跳过当前选择中的正常订单。 */
async function restoreSelected(): Promise<void> {
  if (!restorableSelected.value.length) {
    ElMessage.info('请选择要恢复的订单')
    return
  }
  try {
    await ElMessageBox.confirm(`确认恢复选中的 ${restorableSelected.value.length} 个订单吗？`, '批量恢复订单二次确认', { type: 'warning', confirmButtonText: '确认恢复', cancelButtonText: '取消' })
    const result = await store.restoreOrders(restorableSelected.value.map((order) => order.id))
    selected.value = []
    if (result.failedIds.length) {
      ElMessage.warning(`恢复成功 ${result.successIds.length} 个，失败 ${result.failedIds.length} 个`)
    } else {
      ElMessage.success(`已恢复 ${result.successIds.length} 个订单`)
    }
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '批量恢复失败')
  }
}

/** 打开自提订单手工核销弹窗。 */
function openVerify(order: Order): void {
  verifyForm.orderId = order.id
  verifyForm.orderNo = order.orderNo
  verifyForm.code = ''
  verifyVisible.value = true
}

/** 校验自提码并提交后台手工核销。 */
async function submitVerify(): Promise<void> {
  const valid = await verifyFormRef.value?.validate().catch(() => false)
  if (!valid) return
  try {
    await store.verify(verifyForm.orderId, { code: verifyForm.code.trim() })
    verifyVisible.value = false
    ElMessage.success('订单核销成功')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '订单核销失败')
  }
}

async function loadList(): Promise<void> {
  store.filters.pickupType = isPickupOrder.value ? 1 : 0
  try {
    await store.fetchList()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '订单列表查询失败')
  }
}

/** 路由切换时清空普通订单选择状态，自提页不请求普通订单接口。 */
watch(() => route.path, (path) => {
  selected.value = []
  if (path === '/orders' || path === '/orders/pickup') {
    statusTab.value = ''
    store.resetFilters()
    store.filters.pickupType = path === '/orders/pickup' ? 1 : 0
    dateRange.value = null
    void loadList()
  }
})

onMounted(() => { void loadList() })
</script>

<template>
  <section class="page-container">
    <div class="page-heading">
      <div><h1>{{ pageTitle }}</h1><p>{{ isPickupOrder ? '管理到店提货订单及核销流程。' : '管理普通订单状态、履约流程和物流信息。' }}</p></div>
      <el-button v-if="!isPickupOrder" @click="loadList">刷新</el-button>
    </div>

    <el-card shadow="never" class="filter-card">
      <el-form inline class="order-filter-form">
        <el-form-item label="订单号"><el-input v-model="orderNoInput" placeholder="输入订单号" clearable style="width: 220px" @keyup.enter="searchByOrderNo" @clear="searchByOrderNo" /></el-form-item>
        <el-form-item><el-button type="primary" @click="searchByOrderNo">搜索</el-button></el-form-item>
        <el-form-item label="下单时间"><el-date-picker :model-value="dateRange" type="daterange" value-format="YYYY-MM-DD" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" @update:model-value="handleDateRangeChange" /></el-form-item>
        <el-form-item><el-button @click="store.resetFilters(); dateRange = null; orderNoInput = ''; void loadList()">重置</el-button></el-form-item>
      </el-form>
    </el-card>

    <el-tabs v-model="statusTab" class="order-status-tabs" @tab-change="handleStatusTabChange">
      <el-tab-pane label="全部" name="" />
      <el-tab-pane v-for="option in statusOptions" :key="option.value" :label="option.label" :name="String(option.value)" />
    </el-tabs>

    <template v-if="isPickupOrder">
      <el-card shadow="never" class="content-card">
         <div class="toolbar">
           <div><strong>自提订单</strong><span class="toolbar-count">共 {{ store.total }} 条</span></div>
           <div class="toolbar-actions pickup-order-actions">
           <span v-if="hasSelection" class="selection-tip">已选择 {{ selected.length }} 项</span>
             <el-button type="warning" plain :disabled="!restorableSelected.length || store.restoring" :loading="store.restoring" @click="restoreSelected"><el-icon><RefreshLeft /></el-icon>批量恢复</el-button>
             <el-button type="danger" plain :disabled="!deletableSelected.length || store.deleting" :loading="store.deleting" @click="removeSelected">批量删除</el-button>
           </div>
         </div>
         <DataTable :data="store.list" :loading="store.loading" :total="store.total" :page="store.page" :page-size="store.pageSize" @selection-change="selected = $event" @page-change="store.page = $event; void loadList()" @size-change="store.pageSize = $event; store.page = 1; void loadList()">
          <el-table-column prop="orderNo" label="订单号" min-width="200" />
          <el-table-column prop="userId" label="用户ID" min-width="120"><template #default="{ row }">{{ row.userId ?? '—' }}</template></el-table-column>
          <el-table-column label="商品" min-width="220"><template #default="{ row }"><div class="order-product"><el-image v-if="row.firstProductImage" :src="row.firstProductImage" class="order-image" fit="cover" /><span>{{ row.totalQuantity }} 件商品</span></div></template></el-table-column>
          <el-table-column label="订单金额" width="120"><template #default="{ row }">¥ {{ Number(row.payAmount || 0).toFixed(2) }}</template></el-table-column>
          <el-table-column prop="createTime" label="下单时间" min-width="180" />
          <el-table-column prop="shopName" label="自提门店" min-width="150"><template #default="{ row }">{{ row.shopName || '暂无数据' }}</template></el-table-column>
          <el-table-column label="核销状态" width="120"><template #default="{ row }"><el-tag :type="isVerifiedStatus(row.status) ? 'success' : 'warning'">{{ isVerifiedStatus(row.status) ? '已核销' : '待核销' }}</el-tag></template></el-table-column>
          <el-table-column label="订单状态" width="130"><template #default="{ row }"><div class="order-status"><el-tag :type="statusType(row.status)">{{ row.statusDesc }}</el-tag></div></template></el-table-column>
          <el-table-column label="操作" fixed="right" width="240"><template #default="{ row }"><div class="operator-actions"><el-button size="small" type="primary" @click="showDetail(row)"><el-icon><View /></el-icon>详情</el-button><el-button v-if="row.status === 1" size="small" type="success" :loading="store.verifying" @click="openVerify(row)"><el-icon><CircleCheck /></el-icon>核销</el-button><el-button size="small" type="danger" :disabled="!isDeletable(row) || store.deleting" :loading="store.deleting" title="删除订单" @click="removeOrder(row)"><el-icon><Delete /></el-icon>删除</el-button></div></template></el-table-column>
        </DataTable>
      </el-card>
    </template>

    <template v-else>
      <el-card shadow="never" class="content-card">
      <div class="toolbar">
        <div><strong>订单列表</strong><span class="toolbar-count">共 {{ store.total }} 条</span></div>
        <div class="toolbar-actions">
          <span v-if="hasSelection" class="selection-tip">已选择 {{ selected.length }} 项</span>
          <el-button type="primary" plain :disabled="!eligibleSelected.length || store.shipping" :loading="store.shipping" @click="openBatchShip">批量发货</el-button>
          <el-button type="warning" plain :disabled="!restorableSelected.length || store.restoring" :loading="store.restoring" @click="restoreSelected"><el-icon><RefreshLeft /></el-icon>批量恢复</el-button>
          <el-button type="danger" plain :disabled="!deletableSelected.length || store.deleting" :loading="store.deleting" @click="removeSelected">批量删除</el-button>
        </div>
      </div>
      <DataTable
        :data="store.list"
        :loading="store.loading"
        :total="store.total"
        :page="store.page"
        :page-size="store.pageSize"
        @selection-change="selected = $event"
        @page-change="store.page = $event; void loadList()"
        @size-change="store.pageSize = $event; store.page = 1; void loadList()"
      >
        <el-table-column prop="orderNo" label="订单号" min-width="190" />
        <el-table-column prop="userId" label="用户ID" min-width="120"><template #default="{ row }">{{ row.userId ?? '—' }}</template></el-table-column>
        <el-table-column label="商品" min-width="220">
          <template #default="{ row }"><div class="order-product"><el-image v-if="row.firstProductImage" :src="row.firstProductImage" class="order-image" fit="cover" /><span>{{ row.totalQuantity }} 件商品</span></div></template>
        </el-table-column>
        <el-table-column prop="createTime" label="下单时间" min-width="180" />
        <el-table-column label="实付金额" width="130"><template #default="{ row }">¥ {{ Number(row.payAmount || 0).toFixed(2) }}</template></el-table-column>
        <el-table-column prop="statusDesc" label="订单状态" width="150"><template #default="{ row }"><div class="order-status"><el-tag :type="statusType(row.status)">{{ row.statusDesc }}</el-tag></div></template></el-table-column>
        <el-table-column label="操作" fixed="right" width="240"><template #default="{ row }"><div class="operator-actions"><el-button size="small" type="primary" @click="showDetail(row)"><el-icon><View /></el-icon>详情</el-button><el-button v-if="row.status === 1" size="small" type="primary" @click="openShip(row)"><el-icon><Box /></el-icon>发货</el-button><el-button size="small" type="danger" :disabled="!isDeletable(row) || store.deleting" :loading="store.deleting" title="删除订单" @click="removeOrder(row)"><el-icon><Delete /></el-icon>删除</el-button></div></template></el-table-column>
      </DataTable>
      </el-card>
    </template>

    <el-dialog v-model="detailVisible" title="订单详情" width="820px" append-to-body>
      <el-skeleton v-if="store.detailLoading" :rows="8" animated />
      <template v-else-if="store.detail">
        <el-steps :active="Math.min(store.detail.status, 3)" finish-status="success" align-center><el-step title="提交订单" /><el-step title="支付" /><el-step title="发货" /><el-step title="完成" /></el-steps>
        <el-divider />
        <el-descriptions :column="2" border><el-descriptions-item label="订单号">{{ store.detail.orderNo }}</el-descriptions-item><el-descriptions-item label="订单状态"><span class="order-status"><el-tag :type="statusType(store.detail.status)">{{ store.detail.statusDesc }}</el-tag><el-tag v-if="isDeleted(store.detail)" type="danger" effect="plain">已删除</el-tag></span></el-descriptions-item><el-descriptions-item label="配送方式">{{ store.detail.pickupType === 1 ? '线下自提' : '物流配送' }}</el-descriptions-item><el-descriptions-item v-if="store.detail.pickupType === 1" label="核销状态">{{ isVerifiedStatus(store.detail.status) ? '已核销' : '待核销' }}</el-descriptions-item><el-descriptions-item v-if="store.detail.pickupType === 1" label="自提门店">{{ store.detail.shopName || '暂无数据' }}</el-descriptions-item><el-descriptions-item v-if="store.detail.pickupType === 1" label="自提码">{{ store.detail.pickupCode || '暂无数据' }}</el-descriptions-item><el-descriptions-item v-if="store.detail.pickupType === 1" label="物流轨迹"><el-empty :image-size="48" description="暂无物流轨迹" /></el-descriptions-item><el-descriptions-item v-if="store.detail.pickupType === 0" label="收货人">{{ store.detail.receiverName || '暂无数据' }}</el-descriptions-item><el-descriptions-item v-if="store.detail.pickupType === 0" label="联系电话">{{ store.detail.receiverPhone || '暂无数据' }}</el-descriptions-item><el-descriptions-item v-if="store.detail.pickupType === 0" label="收货地址" :span="2"><div class="address-detail-row"><span>{{ store.detail.receiverAddress || '暂无数据' }}</span><el-button v-if="store.detail.status === 1 && !isDeleted(store.detail)" link type="primary" @click="openAddressEditor">修改地址</el-button></div></el-descriptions-item><el-descriptions-item v-if="store.detail.pickupType === 0" label="快递公司">{{ store.detail.expressCompany || '暂无数据' }}</el-descriptions-item><el-descriptions-item v-if="store.detail.pickupType === 0" label="物流单号">{{ store.detail.expressNo || '暂无数据' }}</el-descriptions-item><el-descriptions-item v-if="store.detail.pickupType === 0" label="物流轨迹"><el-button v-if="isTraceable(store.detail)" link type="primary" :disabled="!isTraceable(store.detail) || store.traceLoading" :loading="store.traceLoading" @click="openTrace">物流轨迹</el-button><el-empty v-else :image-size="48" description="暂无物流轨迹" /></el-descriptions-item><el-descriptions-item label="商品总额">¥ {{ Number(store.detail.totalAmount || 0).toFixed(2) }}</el-descriptions-item><el-descriptions-item label="实付金额">¥ {{ Number(store.detail.payAmount || 0).toFixed(2) }}</el-descriptions-item></el-descriptions>
        <el-divider>商品明细</el-divider>
        <el-table :data="store.detail.items" border><el-table-column label="商品图" width="90"><template #default="{ row }"><el-image v-if="row.productImage" :src="row.productImage" class="detail-item-image" fit="cover" /><span v-else class="detail-item-image-placeholder">—</span></template></el-table-column><el-table-column prop="productName" label="商品名称" min-width="220" /><el-table-column prop="skuName" label="规格" min-width="150" /><el-table-column prop="price" label="单价" width="110" /><el-table-column prop="quantity" label="数量" width="90" /><el-table-column prop="subtotal" label="小计" width="110" /></el-table>
      </template>
       <el-empty v-else description="暂无订单详情" />
       <template #footer><el-button v-if="store.detail && isRefundable(store.detail)" type="warning" :loading="store.refunding" @click="openRefund(store.detail)">客服人工退款</el-button><el-button @click="detailVisible = false">关闭</el-button></template>
     </el-dialog>

    <el-dialog v-model="addressVisible" title="修改收货地址" width="560px" append-to-body>
      <el-form ref="addressFormRef" :model="addressForm" :rules="addressRules" label-width="90px">
        <el-form-item label="收货人" prop="receiverName"><el-input v-model="addressForm.receiverName" maxlength="30" show-word-limit /></el-form-item>
        <el-form-item label="手机号" prop="receiverPhone"><el-input v-model="addressForm.receiverPhone" maxlength="11" /></el-form-item>
        <el-form-item label="收货地址" prop="receiverAddress"><el-input v-model="addressForm.receiverAddress" type="textarea" :rows="3" maxlength="200" show-word-limit /></el-form-item>
      </el-form>
      <template #footer><el-button @click="addressVisible = false">取消</el-button><el-button type="primary" @click="submitAddress">确认修改</el-button></template>
    </el-dialog>

    <el-dialog v-model="shipVisible" title="订单发货" width="520px" append-to-body>
      <el-form ref="shipFormRef" :model="shipForm" :rules="shipRules" label-width="90px"><el-form-item label="快递公司" prop="expressCompanyCode"><el-select v-model="shipForm.expressCompanyCode" placeholder="请选择快递公司" style="width: 100%" @change="syncExpressCompany(shipForm, $event)"><el-option v-for="option in expressCompanyOptions" :key="option.value" :label="option.label" :value="option.value" /></el-select></el-form-item><el-form-item label="快递单号" prop="expressNo"><el-input v-model="shipForm.expressNo" placeholder="请输入快递单号" /></el-form-item></el-form>
      <template #footer><el-button @click="shipVisible = false">取消</el-button><el-button type="primary" :loading="store.shipping" @click="submitShip">确认发货</el-button></template>
    </el-dialog>

    <el-dialog v-model="batchShipVisible" title="批量发货" width="520px" append-to-body>
      <el-form ref="batchShipFormRef" :model="batchShipForm" :rules="shipRules" label-width="90px"><el-form-item label="快递公司" prop="expressCompanyCode"><el-select v-model="batchShipForm.expressCompanyCode" placeholder="请选择快递公司" style="width: 100%" @change="syncExpressCompany(batchShipForm, $event)"><el-option v-for="option in expressCompanyOptions" :key="option.value" :label="option.label" :value="option.value" /></el-select></el-form-item><el-form-item label="快递单号" prop="expressNo"><el-input v-model="batchShipForm.expressNo" placeholder="请输入快递单号" /></el-form-item></el-form>
      <template #footer><el-button @click="batchShipVisible = false">取消</el-button><el-button type="primary" :loading="store.shipping" @click="submitBatchShip">确认批量发货</el-button></template>
    </el-dialog>

    <el-dialog v-model="verifyVisible" title="手工核销自提订单" width="520px" append-to-body>
      <el-form ref="verifyFormRef" :model="verifyForm" :rules="verifyRules" label-width="90px"><el-form-item label="订单号"><el-input v-model="verifyForm.orderNo" disabled /></el-form-item><el-form-item label="自提码" prop="code"><el-input v-model="verifyForm.code" placeholder="请输入客户提供的自提码" /></el-form-item></el-form>
      <template #footer><el-button @click="verifyVisible = false">取消</el-button><el-button type="primary" :loading="store.verifying" @click="submitVerify">确认核销</el-button></template>
    </el-dialog>

    <el-dialog v-model="refundVisible" title="客服人工退款" width="560px" append-to-body>
      <el-form label-width="90px"><el-form-item label="订单号"><el-input v-model="refundForm.orderNo" disabled /></el-form-item><el-form-item label="退款原因"><el-input v-model="refundForm.reason" type="textarea" :rows="4" maxlength="200" show-word-limit placeholder="请输入退款原因，可为空" /></el-form-item></el-form>
      <template #footer><el-button @click="refundVisible = false">取消</el-button><el-button type="warning" :loading="store.refunding" @click="submitRefund">确认退款</el-button></template>
    </el-dialog>

    <el-dialog v-model="traceVisible" title="物流轨迹" width="680px" append-to-body>
      <el-skeleton v-if="store.traceLoading" :rows="5" animated />
      <template v-else-if="store.trace">
        <el-descriptions :column="2" border><el-descriptions-item label="快递公司">{{ store.trace.com || '暂无数据' }}</el-descriptions-item><el-descriptions-item label="物流单号">{{ store.trace.nu || '暂无数据' }}</el-descriptions-item><el-descriptions-item label="物流状态" :span="2">{{ store.trace.stateDesc || '暂无数据' }}</el-descriptions-item></el-descriptions>
        <el-empty v-if="store.trace && !store.trace.traces.length" description="暂无物流节点" />
        <el-timeline v-else class="trace-timeline"><el-timeline-item v-for="(item, index) in store.trace.traces" :key="`${item.time}-${index}`" :timestamp="item.time">{{ item.context }}</el-timeline-item></el-timeline>
      </template>
      <el-empty v-else description="暂无物流轨迹" />
    </el-dialog>
  </section>
</template>

<style scoped>
.order-product { display: flex; align-items: center; gap: 10px; }
.order-image { width: 38px; height: 38px; border-radius: 4px; flex-shrink: 0; }
.detail-item-image { width: 48px; height: 48px; border-radius: 4px; }
.detail-item-image-placeholder { display: inline-block; width: 48px; height: 48px; border-radius: 4px; background: var(--el-fill-color-light); color: var(--el-text-color-placeholder); line-height: 48px; text-align: center; }
.order-filter-form .el-form-item { margin-bottom: 0; }
.order-filter-form .el-date-editor { width: 280px; }
.order-status { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.operator-actions { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.operator-actions :deep(.el-button) { margin-left: 0; padding: 5px 8px; }
.operator-actions :deep(.el-icon) { margin-right: 4px; }
.order-status-tabs { margin-bottom: 16px; }
.order-status-tabs :deep(.el-tabs__header) { margin-bottom: 0; }
.address-detail-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
</style>
