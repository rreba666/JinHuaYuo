/**
 * 库存对账相关类型（今华有肽后台）。
 *
 * 对应后端 2026-09-16 新增的两个**只读**接口：
 * - `GET /api/admin/stock/ledger`：库存台账（某 SKU 一段时间的变动明细 + 按来源汇总 + 期初/期末断言）
 * - `GET /api/admin/stock/refund-restock-gaps`：退款应补未补核对（已退款但库存未回补的订单项）
 *
 * ⚠️ 字段已按 2026-09-16 更新后的 `api-docs.json` 核对，接口 tag 为「库存对账（B端）」，
 * 响应 schema 为 `StockLedgerVO`（台账）与 `RefundRestockGapVO`（应补未补）。
 * 注意后端把**可空**语义用得很重（无流水 / SKU 已软删时返回 `null`），前端必须按可空处理，不能当 0。
 */

/** 库存变动来源（`changeType`，共 9 种）。 */
export type StockChangeType =
  | 'ORDER_CREATE'
  | 'ORDER_CLOSE'
  | 'ORDER_DELETE_RELEASE'
  | 'PAY_CLEAR_LOCK'
  | 'VERIFY_CLEAR_LOCK'
  | 'REFUND_RESTOCK'
  | 'RETURN_RESTOCK'
  | 'MANUAL_SET'
  | 'SKU_CREATE'
  | string

/** 状态流水触发方 / 操作方（api-docs 列 USER/MERCHANT/PLATFORM/SYSTEM；JOB 为兼容保留）。 */
export type StockOperatorType = 'USER' | 'MERCHANT' | 'PLATFORM' | 'SYSTEM' | 'JOB' | string

/** 来源单据类型。 */
export type StockBizType = 'ORDER' | 'AFTER_SALE' | 'MANUAL' | 'SYSTEM' | string

/** 库存台账：单条变动明细。 */
export interface StockLedgerDetail {
  /** 发生时间 */
  createTime: string
  changeType: StockChangeType
  /** 中文名（后端已给，可直接展示） */
  changeTypeName: string
  /** 可售库存变动量（正=增加，负=减少） */
  changeQty: number
  /** 锁定库存变动量 */
  lockedChangeQty: number
  /** 变动前后可售库存 */
  stockBefore: number
  stockAfter: number
  /** 变动前后锁定库存 */
  lockedBefore: number
  lockedAfter: number
  bizType: StockBizType
  /** 来源单号（订单号或售后单号），可点击跳转对应单据 */
  bizNo: string | null
  operatorType: StockOperatorType
  operatorId: string | null
  /** 原因（人工改库存时必填） */
  reason: string
  /** 备注（如「管理员保存商品覆盖可售库存: 15 → 35」） */
  remark: string
}

/** 库存台账：按来源汇总（整区间聚合，不受分页影响）。 */
export interface StockLedgerSummaryItem {
  changeType: StockChangeType
  changeTypeName: string
  /** 笔数 */
  count: number
  /** 该来源合计变动件数（±） */
  totalChangeQty: number
  /** 该来源合计锁定库存变动 */
  totalLockedChangeQty: number
}

/** 库存台账明细分页结果。 */
export interface StockLedgerDetails {
  total: number
  page: number
  pageSize: number
  list: StockLedgerDetail[]
}

/** 库存台账（`GET /api/admin/stock/ledger`）。 */
export interface StockLedger {
  skuId: string
  /** 商品 ID（SKU/流水都取不到时为 null） */
  productId: string | null
  /** 商品名（商品已删则为 null） */
  productName: string | null
  /** 本次台账是否由 `productId` 解析而来：true = 只传了商品 ID，`skuId` 是服务端解析出的唯一启用 SKU */
  resolvedFromProduct: boolean
  startTime: string | null
  endTime: string | null
  /** 期初可售库存（`openingUnavailable=true` 时为 null） */
  openingStock: number | null
  openingTime: string | null
  /** true = 期初不可考（该时点早于留痕上线） */
  openingUnavailable: boolean
  /** 期初取值来源：`LAST_LOG_BEFORE_START` / `EARLIEST_LOG_BEFORE`；取不到为 null */
  openingSource: string | null
  /** 期初中文说明（后端已给，可直接展示） */
  openingNote: string | null
  /** 最新一条流水的期末可售库存（**全表最新**，不是区间末）；无任何流水时为 null */
  closingStock: number | null
  /** 最新一条流水的期末锁定库存；无任何流水时为 null */
  closingLockedStock: number | null
  /** 最新一条流水的时间；无任何流水时为 null */
  closingTime: string | null
  /** `product_sku.stock` 实时值；SKU 已软删/不存在时为 null */
  currentStock: number | null
  /** `product_sku.locked_stock` 实时值；SKU 已软删/不存在时为 null */
  lockedStock: number | null
  /** false = 该 SKU 已被软删 */
  currentStockAvailable: boolean
  /** `closingStock − currentStock`，非 0 = 账实不符 */
  diff: number | null
  /** `diff == 0`；false 需标红「账实不符」 */
  consistent: boolean | null
  /** 区间内 Σ change_qty */
  totalChangeQty: number
  /** 期初 + Σ变动（理论期末）；期初为 null 时也为 null */
  expectedClosing: number | null
  /** `expectedClosing == closingStock`（"期初+变动=期末"自动断言） */
  assertionPassed: boolean | null
  /** 断言未通过时的中文原因；正常为 null */
  assertionNote: string | null
  /** 区间口径期末（`create_time ≤ endTime` 的最后一条） */
  rangeClosingStock: number | null
  rangeClosingTime: string | null
  summary: StockLedgerSummaryItem[]
  /** false = 区间流水超过服务端聚合上限，`summary`/`totalChangeQty` 只覆盖最早部分（明细仍完整分页） */
  summaryComplete: boolean
  details: StockLedgerDetails
}

/** 库存台账查询参数（`skuId` / `productId` **二选一，至少传一个**）。 */
export interface StockLedgerQuery {
  /** SKU ID（与 `productId` 二选一、至少传一个；两者同时传时**以本参数为准**） */
  skuId?: string
  /**
   * 商品 ID（与 `skuId` 二选一）。
   * 只传它时服务端解析该商品**唯一的启用 SKU** 并返回 `resolvedFromProduct=true`；
   * 该商品有**多个启用 SKU** → `code=1000`（message 里列出可选 skuId）；
   * 商品不存在/已删除 或 没有任何启用 SKU → `code=1002`。
   */
  productId?: string
  /** 起始时间 `yyyy-MM-dd HH:mm:ss`；不传=从留痕最早记录起 */
  startTime?: string
  endTime?: string
  /** 明细页码（只影响 details，不影响 summary） */
  page: number
  /** 明细每页条数，1~200 */
  size: number
}

/** 退款应补未补核对：一行 = 一个订单项。 */
export interface RefundRestockGap {
  afterSaleNo: string
  orderNo: string
  /** 1=仅退款 / 2=退货退款 */
  afterSaleType: number
  afterSaleTypeName: string
  refundAmount: number
  /** 微信退款单号 */
  refundNo: string
  /** 退款时间（取售后单 update_time） */
  refundTime: string
  /** 配送方式：api-docs 现列 0=物流 / 1=自提（同城 2 为兼容保留） */
  pickupType: number
  /** 货是否已离店（物流看 shipTime、自提看 pickupTime）；false 才应该补货 */
  goodsLeftShop: boolean
  shipTime: string | null
  pickupTime: string | null
  skuId: string
  /** 商品名（下单时快照） */
  productName: string
  quantity: number
  /** 该订单号在流水中的 REFUND_RESTOCK 条数（应为 0） */
  refundRestockRows: number
  /** 该售后单号在流水中的 RETURN_RESTOCK 条数 */
  returnRestockRows: number
  /** 是否需要补货（= 货未离店 && 两种回补流水都为 0） */
  needRestock: boolean
}

/** 退款应补未补核对查询参数。 */
export interface RefundRestockGapQuery {
  /** 起始时间；不传=后端自动取留痕上线时间 */
  startTime?: string
  /** ⚠️ 接口**暂不支持**结束时间（文档 §3.1 与 api-docs 都只有 startTime），传了会被后端忽略；后端补充后再启用 */
  endTime?: string
  /** 默认 false=只有"应补未补"的真问题；true=宽松口径（需前端自行判断） */
  includeNonActionable?: boolean
  page: number
  size: number
}

/** 退款应补未补核对分页结果。 */
export interface RefundRestockGapPage {
  total: number
  page: number
  pageSize: number
  list: RefundRestockGap[]
}
