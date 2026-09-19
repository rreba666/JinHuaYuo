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
  /** 退款起始时间（含），`yyyy-MM-dd HH:mm:ss`；不传 = 后端自动取留痕上线时间 */
  startTime?: string
  /**
   * 退款结束时间（含），`yyyy-MM-dd HH:mm:ss`；可空 = 不过滤上界。
   * ⚠️ 不得早于 `startTime`（未传 `startTime` 时以留痕上线时间为下界）—— 2026-09-19 后端新增。
   */
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

/**
 * 冗余列偏离巡检（`GET /api/admin/stock/total-stock-drifts`）一行。
 *
 * 背景（api-docs 2026-09-16 18:41 版原文）：`product.total_stock` 是**只在「保存商品」时重算**的冗余列，
 * 下单/取消/退款回补等链路只改 `product_sku.stock`，所以保存之后每发生一次库存变动就漂移一次；
 * 而商品列表的 `totalStock` 自 2026-09-16 起已改为**查询时实时聚合**，因此本清单只作**观测基线**（已知且无害）。
 */
export interface TotalStockDrift {
  productId: string
  productName: string
  /** 商品状态：0=下架 / 1=上架 */
  status: number
  /** 冗余列现值（`product.total_stock`），即「保存商品」那一刻算出的旧值 */
  totalStock: number
  /** 真实可售库存合计 = `SUM(product_sku.stock)`（enabled=1 且未软删，**不含** locked_stock），与台账 `currentStock` 同口径 */
  skuStockSum: number
  /** 偏离值 = `totalStock − skuStockSum`；正数=冗余列偏大，负数=偏小 */
  diff: number
  /** 参与统计的启用 SKU 个数；0 = 该商品没有任何可售 SKU（视为售罄） */
  enabledSkuCount: number
  /** 建议对齐值 = `skuStockSum`（接口只读，不会自动改库） */
  suggestedTotalStock: number
  /** 冗余列最后一次被写入的时间（`product.update_time`，**不等于**库存最后变动时间） */
  updateTime: string
}

/** 冗余列偏离巡检查询参数。 */
export interface TotalStockDriftQuery {
  page: number
  size: number
}

/** 冗余列偏离巡检分页结果。 */
export interface TotalStockDriftPage {
  total: number
  page: number
  pageSize: number
  list: TotalStockDrift[]
}

/**
 * 库存实时概览（`GET /api/admin/stock/overview`，2026-09-18 新增）一行 = 一个**启用 SKU**。
 *
 * 用途：解决「锁定库存不可见导致对账对不上」的盲区，把货的去向一次说清。
 *
 * ⚠️ 口径（与 `GET /api/admin/stock/ledger` 台账一致，纯 SELECT 只读）：
 * - `availableStock` = `product_sku.stock`（可下单卖出，**不含**锁定）；
 * - `lockedStock` = `product_sku.locked_stock`（下单占用、货未出库，超时自动释放；**自提单最长 30 天**）。
 *   **含 9/16 流水留痕上线前的历史遗留**，无法逐单追溯，需人工盘点确认；
 * - `shipping` = 物流已发货（`pickup_type=0`、`status=2`）未确认收货的件数，**货已出库、不在库**；
 * - `totalStock` = `availableStock + lockedStock`（账面在库）。
 *
 * ⚠️ **命名陷阱**：商品列表 `ProductListVO.totalStock` 虽然同名，但那个是「所有启用 SKU 的 `stock` 之和」
 * = **可售**（不含锁定）；本接口的 `totalStock` 才是「可售 + 锁定」。展示时不要互相套用。
 */
export interface StockOverview {
  /** 商品 ID（`product.id`） */
  productId: string
  productName: string
  /** SKU ID（`product_sku.id`） */
  skuId: string
  skuName: string
  /** 商品状态：0=下架 / 1=上架 */
  status: number
  /** 可售库存 = `product_sku.stock`（可下单卖出数，不含锁定） */
  availableStock: number
  /** 锁定库存 = `product_sku.locked_stock`（下单占用、货未出库；含 9/16 前历史遗留，需人工盘点） */
  lockedStock: number
  /** 在途数量 = 物流已发货未确认收货件数（货已出库、不在库） */
  shipping: number
  /** 合计在库量 = 可售 + 锁定 */
  totalStock: number
  /** SKU 售价（元） */
  price: number
  /** SKU 更新时间（`product_sku.update_time`） */
  updateTime: string
}
