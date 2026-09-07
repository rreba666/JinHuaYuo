# 2026-09-07 「更多福利」改为整页海报（长按识别）

## 背景
「更多福利」入口指向**合作方小程序**（非同一主体，微信禁止直接跨小程序跳转）。此前用**弹窗**展示小程序码海报，但合作方海报里小程序码占比太小，长按整图识别不到。经讨论改为：**点击「更多福利」直接跳转一个全屏海报页，整页一张海报占满屏**，用户长按即可识别图中小程序码。

> 说明：目标海报里的小程序码需足够大（占满屏后清晰可见），微信长按才能稳定识别。

## 改动
### 新增全屏海报页 `pages/promo/welfare-poster.vue`
- 自定义导航栏（`navigationStyle: custom`，悬浮顶部，避开状态栏，左上角返回箭头）。
- 整张海报 `<image mode="aspectFit">` **占满整个页面**，用户长按识别。
- 未配置海报时显示"福利海报暂未配置"占位。
- 点击海报可**保存到相册**（兜底：保存后用微信扫一扫-相册或相册长按识别）。

### `pages/index/index.vue`
- `handleWelfareImageTap`：点击「更多福利」（`index===0`）由"打开弹窗"改为 `navigateTo` 到全屏海报页，`src` 传海报 URL（`welfareMiniProgramQrUrl`）。
- 删除弹窗相关：`welfareLandingVisible`/`welfareAppId`/`welfareQrImage`/`welfareCodeImage`/`welfareSaving` 等 ref，及 `closeWelfareLanding`/`ensurePrivacyAuthorize`/`saveWelfarePoster`/`doSaveWelfarePoster` 方法，弹窗模板与样式。
- 保留福利区 Tab（`welfareTab`/`bottomImages`）与「更多福利」「今华有肽」两个标签切换展示。

### `api/homepage.ts`
- 移除上轮新增的 `welfareMiniProgramQrCodeUrl`（单独纯码图字段），本方案不再需要；仅保留 `welfareMiniProgramQrUrl`（海报图 URL）。

### `pages.json`
- 注册 `pages/promo/welfare-poster`（`navigationStyle: custom`）。

## 说明
- 长按识别是微信客户端对 `<image>` 渲染的合法小程序码的原生行为，无需 `@longpress`、无需隐私声明。
- 需 HBuilderX 重新编译并在**真机/微信预览**验证长按识别（H5 预览无此能力）。
- 海报仍来自后端 `welfareMiniProgramQrUrl` 配置；若为空，整页显示"暂未配置"占位。

## 提交
- `git add` 后提交 `pages/promo/welfare-poster.vue`、`pages/index/index.vue`、`api/homepage.ts`、`pages.json`。
