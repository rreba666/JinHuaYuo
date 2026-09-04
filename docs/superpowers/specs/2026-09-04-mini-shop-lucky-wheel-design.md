# 今华有肽 大转盘抽奖活动 — 设计文档

> 关联工程：`E:\work\JJ\project`（今华有肽）。与 LonPin 无关。
> 日期：2026-09-04
> 技术选型：[lucky-canvas](https://github.com/buuing/lucky-canvas)（`lucky-canvas@1.7.27` + `@lucky-canvas/uni@0.0.14`）

## 1. 背景与目标

运营需要一个"大转盘抽奖活动"（近期上线）。活动由**后台管理系统控制**——奖品、格数、概率权重、内定中奖、活动开关、开启/结束时间、每人每日抽奖次数都由后台配置。小程序端负责展示与抽奖动画。

本次做三端：

1. **mini_shop 小程序端**：大转盘活动页 + 接口对接 + 个人页入口 + 抽奖动画。
2. **admin 后台前端**：大转盘活动配置管理页（开关/时间/次数/奖品/概率/内定名单）。
3. **后端服务**（独立部署，`api.jinhuayou365.com`）：负责提供配置/抽奖/记录接口，由后端团队实现。本次输出**接口契约文档**供后端参照。

## 2. 范围与非目标

### 在范围内
- 小程序端活动页（独立分包页面）。
- 小程序个人页入口。
- admin 后台"大转盘活动"配置页（沿用公告管理模式）。
- 前后端接口契约文档。
- lucky-canvas 核心库引入与 Vue3 适配。

### 非目标（YAGNI）
- 首页活动入口（用户明确"先管个人页，首页看后续需求"）。
- 复杂中奖名单的上传（先配置"内定"标记，名单后续扩展）。
- 多语言、多品牌差异（固定 `X-App-Key=jinhua`，与现网一致）。
- 抽奖音效、复杂动效（lucky-canvas 自带动画即可）。

## 3. 关键决策（已与用户确认）

| 决策项 | 结论 |
| --- | --- |
| 归属工程 | 今华有肽 project（与 LonPin 无关） |
| 抽奖类型 | 大转盘（圆形 6/8 格，由后台配置格数） |
| 数据来源 | 前端先本地 mock 跑通，后端就绪后接真实接口 |
| 入口位置 | 仅个人页菜单入口（首页暂不做） |
| 视觉 | 先用 lucky-canvas 默认绘制，后续由后台管理系统上传圆盘/按钮/格位图 |
| 登录限制 | 需登录才能抽奖，未登录点抽奖弹登录引导 |
| 后台权限 | `SUPER_ADMIN` + `ADMIN`（普通管理员）可控制大转盘活动 |
| 分工 | 前端（mini_shop + admin）+ 接口契约；后端由团队实现 |

## 4. 技术选型：lucky-canvas

- 核心引擎 `lucky-canvas@1.7.27` 微信小程序 UMD 包 `dist/lucky-canvas.js`，提供 `LuckyWheel` 类。
- uni 包装层 `@lucky-canvas/uni@0.0.14` 提供 `lucky-wheel.vue` 等组件。**注意**：该包装层为 Vue2 Options API 写法（内部有 `isVue3` 兼容判断），实现时需按项目 Vue3 + `<script setup>` 风格适配或重写为自封装组件。
- **落地方式**：mini_shop 为 HBuilderX-only（无根 package.json，无法 npm install）。将核心 JS 与转盘组件放入 `mini_shop/components/lucky-canvas/`，作为自带组件引用。
- 复用项目已有的微信 2D canvas 实践（参考 `components/PromotionCodePoster.vue`），符合 lucky-canvas 小程序端 `canvas type="2d"` 的用法。

## 5. mini_shop 小程序端设计

### 5.1 活动页（新分包）
- **路径**：`subpkg-activities/lucky-wheel/`（分包，避免主包体积膨胀）。
- 页面结构（`subpkg-activities/lucky-wheel/index.vue`）：
  - 顶部：自定义导航（返回 + 标题"大转盘"）。
  - 中部：圆形幸运大转盘（lucky-canvas `lucky-wheel`），居中。
  - 下方：剩余抽奖次数、活动规则说明、我的中奖记录列表。
  - 未登录点击抽奖：弹 `LoginGuide` 登录引导。
  - 中奖弹窗：展示中奖奖品名称/图片。
- 逻辑流程：
  1. 进入页面 → `GET /api/lucky/config` 拉取配置，渲染转盘格（数量/名称/权重），显示剩余次数，判断活动开关/时间是否可抽。
  2. 点中心抽奖按钮 → 校验登录态 + 剩余次数 → `POST /api/lucky/draw` 拿中奖索引 → 驱动 lucky-canvas `play` 动画转到该格。
  3. 动画结束 `end` → 弹中奖弹窗（以**后端返回的奖品索引**为准，不信任前端随机）。
  4. 中奖记录 `GET /api/lucky/records` 分页展示；空态"暂无记录"。

### 5.2 API 文件
`mini_shop/api/lucky.ts`，封装：
- `getLuckyConfig(): Promise<LuckyConfigVO>`
- `drawLucky(): Promise<LuckyDrawVO>`
- `getLuckyRecords(page, size): Promise<Page<LuckyRecordVO>>`
- `getLuckyRemain(): Promise<number>`（或并入 config）

### 5.3 个人页入口
- `pages/mine/mine.vue` 菜单区新增"大转盘"入口项（复用现有 `goMenu` 跳转逻辑），跳转到 `/subpkg-activities/lucky-wheel/index`。

### 5.4 本地 mock
- 后端未就绪时，用 mock 配置（`const MOCK_CONFIG`）渲染转盘 + 假中奖，保证动画与页面可跑通。通过环境标志（`VITE_LUCKY_MOCK`）切换，默认走 mock。

## 6. admin 后台端设计

### 6.1 路由
在 `admin/src/router/index.ts` 新增：
```
{ path: 'lucky', name: 'Lucky', component: () => import('@/views/lucky/index.vue'),
  meta: { title: '大转盘活动', roles: ['SUPER_ADMIN', 'ADMIN'], requiresAuth: true } }
```

### 6.2 角色与权限
- 补全 `admin/src/types/auth.ts` 的 `AdminRole` 枚举：`'SUPER_ADMIN' | 'ADMIN' | 'CUSTOMER_SERVICE' | 'FINANCE'`。
- 补全 `admin/src/utils/permission.ts`：
  - `ROLE_LABELS` 增加 `ADMIN: '普通管理员'`。
  - `ROLE_ROUTES` 增加 `ADMIN` 路由集合（至少含 `/lucky`，其余按后台现状决定）。
  - `ROLE_PERMISSIONS` / `ROLE_HOME` / `canAccess` / `hasRole` 兼容 `ADMIN`。
- `AdminLayout.vue` 增加角色判断（如 `isAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN'`）与菜单项"大转盘活动"。
- 注意：`ADMIN` 角色当前在部分菜单可见性判断中缺失（如 `isService` 只含 `CUSTOMER_SERVICE || SUPER_ADMIN`），实现时需确认"普通管理员"应看到哪些现有菜单，避免越权或漏显。本活动的菜单项单独用 `isAdmin` 控制即可。

### 6.3 配置页 `admin/src/views/lucky/index.vue`
沿用公告管理（`views/announcement`）模式：
- **活动基础信息**：活动名称、开关（enabled）、开始时间、结束时间、每人每日抽奖次数、活动说明。
- **奖品列表**（可增删排序）：格位索引、奖品名称、奖品图片（上传，走 `/api/common/upload`）、概率权重、是否"谢谢参与"、是否"内定"标记、内定中奖用户清单（预留）。
- 保存 / 修改 / 查询：调 `admin/src/api/lucky.ts`。

### 6.4 API 文件
`admin/src/api/lucky.ts`：
- `getLuckyConfig(): Promise<LuckyConfigVO>`
- `saveLuckyConfig(payload): Promise<void>`（POST 创建 / PUT 更新）
- `updateLuckyStatus(id, enabled): Promise<void>`

### 6.5 types
`admin/src/types/lucky.ts`：`LuckyConfigVO`、`LuckyPrizeVO`、`LuckySaveDTO` 等。

## 7. 后端接口契约（输出给后端团队）

三端共用一套契约。字段以字符串承载 ID、金额；时间用 ISO 字符串；品牌隔离用 `X-App-Key: jinhua`；鉴权用 `Authorization: Bearer <token>`。

### 7.1 小程序端（公开/用户态，通用 `{code,message,data,success}` 包裹）

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/api/lucky/config` | GET | 活动配置与奖品列表（需登录态按用户返回剩余次数） |
| `/api/lucky/draw` | POST | 抽奖，后端按权重随机/内定名单返回中奖索引 |
| `/api/lucky/records` | GET | 我的中奖记录（分页 `page`/`size`） |

**`config` 返回 Data 结构（示意）**：
```jsonc
{
  "id": "1",
  "enabled": 1,               // 1=开启 0=关闭
  "startTime": "2026-09-04 00:00:00",
  "endTime": "2026-09-30 23:59:59",
  "dailyCount": 3,            // 每人每日次数
  "remainCount": 2,           // 当前剩余（登录态下计算）
  "rule": "活动规则文案",
  "prizes": [
    { "index": 0, "name": "一等奖", "image": "", "weight": 1, "type": "REAL", "isDefault": false },
    { "index": 1, "name": "谢谢参与", "image": "", "weight": 90, "type": "NONE", "isDefault": true }
  ]
}
```

**`draw` 返回 Data（示意）**：
```
{ "prizeIndex": 1, "prizeName": "谢谢参与", "prizeType": "NONE", "recordId": "100" }
```

**`records` 返回 Data**：分页结构 `{ list, total, page, size }`，每条含奖品名/时间/状态。

### 7.2 admin 端（管理态）

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/api/admin/lucky` | GET | 查询当前活动配置 |
| `/api/admin/lucky` | POST | 创建配置 |
| `/api/admin/lucky/{id}` | PUT | 更新配置 |
| `/api/admin/lucky/{id}/status` | PUT | 启停开关 |

**配置数据结构**：同 `config`，另含"内定名单"字段 `designatedUsers`（预留，`type: string[]` 或对象数组）。

### 7.3 错误码约定
- `0`：成功。`code != 0` 视为业务失败，`message` 展示给用户。
- `401`：未登录/会话失效 → 前端触发登录。
- 非 `0` 业务码：如 `1001` 活动未开启、`1002` 活动未开始/已结束、`1003` 次数不足、`1004` 无权限等，前端按提示展示。

## 8. 关键流程与安全

- **抽奖结果以服务端为准**：前端仅负责动画，最终奖品由 `draw` 接口返回的 `prizeIndex` 决定，禁止前端自行计算中奖结果。
- **次数校验在服务端**：前端只做展示与提示，真正的次数扣减与校验由后端在 `draw` 内完成。
- **活动开关/时间在服务端校验**：`draw` 会校验 `enabled`、`startTime`、`endTime`、剩余次数，不满足返回对应错误码。
- **内定名单**：后端配置"内定"奖品 + 指定用户，抽奖时命中该用户则返回内定奖品；未配置则按权重随机。

## 9. 测试与验收

- **小程序端**：
  - 抽奖动画正常（点按钮 → 转盘旋转 → 停止在中奖格）。
  - 未登录点抽奖弹登录引导；登录后正常。
  - 次数不足 / 活动未开启 / 未开始 / 已结束 各错误提示正确。
  - 中奖记录列表、空态、分页正常。
- **admin 端**：
  - 配置页可增删改奖品、设置开关/时间/次数/概率。
  - `SUPER_ADMIN` 与 `ADMIN` 角色可访问，`CUSTOMER_SERVICE`/`FINANCE` 不可访问。
  - 保存后小程序端拉取到最新配置。

## 10. 交付文件清单

### mini_shop（今华有肽小程序）
- `mini_shop/components/lucky-canvas/lucky-wheel.vue`（lucky-canvas Vue3 适配组件）
- `mini_shop/components/lucky-canvas/lucky-canvas.js`（核心引擎）
- `mini_shop/pages.json`（注册分包 `subpkg-activities/lucky-wheel`）
- `mini_shop/subpkg-activities/lucky-wheel/index.vue`（活动页）
- `mini_shop/api/lucky.ts`（接口封装）
- `mini_shop/utils/lucky-mock.ts`（本地 mock 配置）
- `mini_shop/pages/mine/mine.vue`（个人页入口）

### admin（今华有肽后台管理前端）
- `admin/src/types/auth.ts`（补 `ADMIN` 角色）
- `admin/src/utils/permission.ts`（补 `ADMIN` 角色路由/标签/权限）
- `admin/src/types/lucky.ts`
- `admin/src/api/lucky.ts`
- `admin/src/views/lucky/index.vue`
- `admin/src/router/index.ts`（注册路由）
- `admin/src/layouts/AdminLayout.vue`（菜单入口）

### 文档
- `docs/logs/2026-09-04-今华有肽-大转盘抽奖活动-接口契约.md`（给后端团队的接口契约）
- 本设计文档

## 11. 风险与注意事项

- **lucky-canvas uni 包装层为 Vue2 写法**：可能与本项目 Vue3 `<script setup>` 和 TS 有兼容问题，需重写/适配为 Vue3 组件，测试真机（微信小程序）canvas 渲染。
- **HBuilderX-only**：`mini_shop` 无 npm build，所有改动需用户在 HBuilderX 重新编译验证。后台 admin 为 Vite 工程，可正常构建/测试。
- **后端未就绪**：先以 mock 跑通前端，接口字段以契约文档为准；下发给后端后需联调对齐。
- **`ADMIN` 角色引入**：需同步确认该角色在后台现有菜单中的可见范围，避免权限口径不一致。
